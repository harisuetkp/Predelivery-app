import { stripe } from "@/lib/stripe"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendOrderConfirmation } from "@/lib/email/send-order-confirmation"

// Track which sessions we've already processed to avoid duplicates
const processedSessions = new Set<string>()

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get("session_id")

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 })
  }

  try {
    // Parse the stripeAccountId from the query if provided (for connected accounts)
    const stripeAccountId = searchParams.get("stripe_account_id")

    // Retrieve session, using connected account if specified
    const stripeOptions = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
    const session = await stripe.checkout.sessions.retrieve(sessionId, stripeOptions)

    // If payment is complete and we haven't processed this session yet
    if (session.payment_status === "paid" && session.metadata?.restaurantId && !processedSessions.has(sessionId)) {
      processedSessions.add(sessionId)

      // Reconstruct orderData from individual metadata fields
      const metadata = session.metadata
      const orderData = {
        restaurantId: metadata.restaurantId,
        branchId: metadata.branchId || null,
        order_source: metadata.order_source || "online",
        customerId: metadata.customerId || null,
        userId: metadata.userId || null,
        orderType: metadata.orderType,
        customerEmail: metadata.customerEmail || (!metadata.customerId ? session.customer_details?.email : null) || null,
        customerPhone: metadata.customerPhone,
        eventDetails: {
          name: metadata.customerName,
          email: metadata.customerEmail || (!metadata.customerId ? session.customer_details?.email : null) || null,
          phone: metadata.customerPhone,
          eventDate: metadata.eventDate,
          eventTime: metadata.eventTime,
          address: metadata.address,
          city: metadata.city,
          zip: metadata.zip,
          deliveryLatitude: metadata.deliveryLatitude ? parseFloat(metadata.deliveryLatitude) : null,
          deliveryLongitude: metadata.deliveryLongitude ? parseFloat(metadata.deliveryLongitude) : null,
        },
        subtotal: parseFloat(metadata.subtotal || "0"),
        tax: parseFloat(metadata.tax || "0"),
        deliveryFee: parseFloat(metadata.deliveryFee || "0"),
        dispatchFee: parseFloat(metadata.dispatchFee || "0"),
        tip: parseFloat(metadata.tip || "0"),
        total: parseFloat(metadata.total || "0"),
        includeUtensils: metadata.includeUtensils === "true",
        // Parse cart from truncated JSON (may be incomplete for very large orders)
        cart: metadata.cart ? (() => {
          try {
            const parsed = JSON.parse(metadata.cart.replace(/\.\.\.$/,""))
            // Expand the abbreviated cart back to full format
            return parsed.map((item: any) => ({
              name: item.n,
              quantity: item.q,
              price: item.p,
              totalPrice: item.p,
              type: item.t || "menu", // Restore item type
              internalShopItemId: item.iid || null, // Restore internal shop item ID
            }))
          } catch {
            return []
          }
        })() : [],
        stripeAccountId: stripeAccountId || null,
      }

      // --- Insert order into DB with financial snapshot ---
      try {
        await insertOrderWithFinancials(orderData, sessionId)
      } catch (dbError) {
        console.error("[v0] Order DB insert failed:", dbError)
        // Don't fail the payment flow if DB insert fails
      }

      // Send notifications
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/send-notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": process.env.INTERNAL_NOTIFY_SECRET || "",
        },
        body: JSON.stringify({ orderData, sessionId }),
      })

      // Shipday orders are sent manually from the CSR Dispatch screen
    }

    return NextResponse.json({
      status: session.status,
      payment_status: session.payment_status,
    })
  } catch (error: any) {
    console.error("Error checking payment status:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Insert the order into the DB and compute the financial split:
 * - food_subtotal: total of menu items only (what the restaurant provides)
 * - service_revenue: total of service package items (JunteReady's service/equipment)
 * - restaurant_discount_percent: the discount the restaurant gives JunteReady
 * - restaurant_payout: food_subtotal minus the discount
 */
async function insertOrderWithFinancials(orderData: any, sessionId: string) {
  const supabase = getSupabaseClient()
  const restaurantId = orderData.restaurantId
  const branchId = orderData.branchId

  // Separate cart into: restaurant items, internal shop items, service packages
  let foodSubtotal = 0 // Restaurant menu items
  let internalShopSubtotal = 0 // Platform-owned items (drinks, extras)
  let serviceRevenue = 0 // Service packages

  for (const item of orderData.cart || []) {
    const itemTotal = (item.price || 0) * (item.quantity || 1)
    if (item.type === "package") {
      serviceRevenue += itemTotal
    } else if (item.type === "internal_shop") {
      internalShopSubtotal += itemTotal
    } else if (item.type !== "delivery_fee") {
      foodSubtotal += itemTotal
    }
  }

  // Add service package total from orderData if present
  if (orderData.servicePackageTotal) {
    serviceRevenue += orderData.servicePackageTotal
  }

  // Restaurant subtotal is what the restaurant provided (food items only)
  const restaurantSubtotal = foodSubtotal

  // Fetch the applicable discount percentage based on order type
  const orderType = orderData.orderType // "delivery" or "pickup"
  let discountPercent = 0

  if (branchId) {
    // Check branch-level override first
    const { data: branch } = await supabase
      .from("branches")
      .select("restaurant_discount_percent, delivery_discount_percent, pickup_discount_percent")
      .eq("id", branchId)
      .single()

    if (branch) {
      // Use order-type-specific discount if available, otherwise fall back to general
      const typeDiscount = orderType === "delivery"
        ? branch.delivery_discount_percent
        : orderType === "pickup"
          ? branch.pickup_discount_percent
          : null

      if (typeDiscount != null && typeDiscount > 0) {
        discountPercent = typeDiscount
      } else if (branch.restaurant_discount_percent != null && branch.restaurant_discount_percent > 0) {
        discountPercent = branch.restaurant_discount_percent
      }
    }
  }

  // Fall back to restaurant-level discount
  if (discountPercent === 0 && restaurantId) {
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("restaurant_discount_percent, delivery_discount_percent, pickup_discount_percent")
      .eq("id", restaurantId)
      .single()

    if (restaurant) {
      const typeDiscount = orderType === "delivery"
        ? restaurant.delivery_discount_percent
        : orderType === "pickup"
          ? restaurant.pickup_discount_percent
          : null

      if (typeDiscount != null && typeDiscount > 0) {
        discountPercent = typeDiscount
      } else if (restaurant.restaurant_discount_percent != null) {
        discountPercent = restaurant.restaurant_discount_percent
      }
    }
  }

  // Calculate what JunteReady pays the restaurant
  const restaurantPayout = foodSubtotal * (1 - discountPercent / 100)

  // branchId is optional - system doesn't require branches, each restaurant is a unit

  // Generate order number
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`

  // Insert the order - only use columns that exist in the schema
  console.log("[v0] Inserting order for restaurant:", restaurantId, "branch:", branchId || "none", "delivery_date:", orderData.eventDetails?.eventDate || new Date().toISOString().split('T')[0])
  const { data: order, error } = await supabase.from("orders").insert({
    restaurant_id: restaurantId,
    branch_id: branchId || null,
    original_branch_id: branchId || null,
    customer_id: orderData.customerId || null,
    user_id: orderData.userId || null,
    order_number: orderNumber,
    stripe_account_id: orderData.stripeAccountId || null,
    stripe_payment_intent_id: sessionId,
    status: "pending",
    delivery_type: orderData.orderType || "pickup",
    delivery_date: orderData.eventDetails?.eventDate || new Date().toISOString().split('T')[0],
    customer_name: orderData.eventDetails?.name || null,
    customer_email: orderData.customerEmail || null,
    customer_phone: orderData.customerPhone || null,
    delivery_address: orderData.eventDetails?.address || null,
    delivery_city: orderData.eventDetails?.city || null,
    delivery_state: orderData.eventDetails?.state || "PR",
    delivery_zip: orderData.eventDetails?.zip || null,
    delivery_latitude: typeof orderData.eventDetails?.deliveryLatitude === "number" ? orderData.eventDetails.deliveryLatitude : null,
    delivery_longitude: typeof orderData.eventDetails?.deliveryLongitude === "number" ? orderData.eventDetails.deliveryLongitude : null,
    special_instructions: orderData.eventDetails?.specialInstructions || null,
    subtotal: orderData.subtotal || 0,
    tax: orderData.tax || 0,
    delivery_fee: orderData.deliveryFee || 0,
    dispatch_fee: orderData.dispatchFee || 0,
    tip: orderData.tip || 0,
    total: orderData.total || 0,
    food_subtotal: foodSubtotal,
    service_revenue: serviceRevenue,
    restaurant_discount_percent: discountPercent,
    restaurant_payout: Math.round(restaurantPayout * 100) / 100,
    restaurant_subtotal: restaurantSubtotal,
    internal_shop_subtotal: internalShopSubtotal,
    order_source: orderData.order_source || "online",
    payment_provider: "stripe",
  }).select().single()

  if (error) {
    console.error("[v0] Order insert error:", error)
    throw error
  }

  ;(async () => {
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("name")
      .eq("id", restaurantId)
      .single()
    sendOrderConfirmation(order, restaurant).catch(console.error)
  })().catch(console.error)

  // Insert order items into order_items table
  if (orderData.cart && orderData.cart.length > 0 && order) {
    const orderItems = orderData.cart
      .filter((item: any) => item.type !== "delivery_fee") // Exclude delivery fee pseudo-item
      .map((item: any) => ({
        order_id: order.id,
        menu_item_id: item.type === "internal_shop" ? null : (item.menu_item_id || item.id || null),
        item_name: item.name || item.item_name,
        quantity: item.quantity || 1,
        unit_price: item.price || item.unit_price || 0,
        total_price: item.total_price || (item.price * (item.quantity || 1)),
        selected_options: item.selectedOptions || item.selected_options || {},
        // Internal shop tracking
        is_internal_shop_item: item.type === "internal_shop",
        internal_shop_item_id: item.type === "internal_shop" ? item.internalShopItemId : null,
      }))

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems)
    if (itemsError) {
      console.error("[v0] Order items insert error:", itemsError)
    }
  }

  // Save customer profile and delivery address — lookup by userId OR email.
  // This ensures "guest" checkouts still link to existing customer records,
  // so order history in /mi-cuenta stays populated without a signup prompt.
  if (orderData.userId || orderData.customerEmail) {
    try {
      // Parse name into first/last
      const fullName = orderData.eventDetails?.name || ""
      const nameParts = fullName.trim().split(" ")
      const firstName = nameParts[0] || null
      const lastName = nameParts.slice(1).join(" ") || null
      const phone = orderData.customerPhone || orderData.eventDetails?.phone || null

      let customer: any = null

      // Phase 1: lookup by auth_user_id if we have it
      if (orderData.userId) {
        const { data } = await supabase
          .from("customers")
          .select("id, phone, first_name, last_name, auth_user_id")
          .eq("auth_user_id", orderData.userId)
          .maybeSingle()
        customer = data
      }

      // Phase 2: fallback lookup by email — catches "guest" checkouts whose
      // email matches an existing customer record
      if (!customer && orderData.customerEmail) {
        const { data } = await supabase
          .from("customers")
          .select("id, phone, first_name, last_name, auth_user_id")
          .eq("email", orderData.customerEmail)
          .maybeSingle()
        customer = data
      }

      // Phase 3: create new customer if no match (with unique-email race handling)
      if (!customer) {
        const { data: newCustomer, error: createError } = await supabase
          .from("customers")
          .insert({
            auth_user_id: orderData.userId || null,
            email: orderData.customerEmail || null,
            first_name: firstName,
            last_name: lastName,
            phone: phone,
          })
          .select("id, phone, first_name, last_name, auth_user_id")
          .single()

        if (createError && createError.code === "23505" && orderData.customerEmail) {
          // Race: someone else created this customer between our lookup and insert
          const { data } = await supabase
            .from("customers")
            .select("id, phone, first_name, last_name, auth_user_id")
            .eq("email", orderData.customerEmail)
            .maybeSingle()
          customer = data
        } else if (!createError) {
          customer = newCustomer
        } else {
          console.error("[v0] Customer create error:", createError)
        }
      } else {
        // Update missing fields (never overwrite existing data) and link
        // auth_user_id if the customer just logged in for the first time
        const updates: Record<string, any> = {}
        if (!customer.phone && phone) updates.phone = phone
        if (!customer.first_name && firstName) updates.first_name = firstName
        if (!customer.last_name && lastName) updates.last_name = lastName
        if (orderData.userId && !customer.auth_user_id) updates.auth_user_id = orderData.userId

        if (Object.keys(updates).length > 0) {
          await supabase
            .from("customers")
            .update(updates)
            .eq("id", customer.id)
        }
      }

      // Phase 4: backfill orders.customer_id so /mi-cuenta order history shows this order
      if (customer?.id && order?.id && !orderData.customerId) {
        await supabase
          .from("orders")
          .update({ customer_id: customer.id })
          .eq("id", order.id)
      }

      // Phase 5: save delivery address for delivery orders
      if (customer && orderData.orderType === "delivery" && orderData.eventDetails?.address) {
        const addressLine1 = orderData.eventDetails.address.split(",")[0]?.trim() || orderData.eventDetails.address
        const { data: existingAddress } = await supabase
          .from("customer_addresses")
          .select("id")
          .eq("customer_id", customer.id)
          .ilike("address_line_1", addressLine1)
          .limit(1)
          .single()

        // Only save if address doesn't already exist
        if (!existingAddress) {
          await supabase.from("customer_addresses").insert({
            customer_id: customer.id,
            label: "Delivery",
            address_line_1: addressLine1,
            city: orderData.eventDetails.city || "",
            state: orderData.eventDetails.state || "PR",
            postal_code: orderData.eventDetails.zip || orderData.eventDetails.zipCode || "",
            delivery_instructions: orderData.eventDetails.deliveryInstructions || null,
            is_default: false,
          })
        }
      }
    } catch (customerError) {
      console.error("[v0] Error saving customer profile/address:", customerError)
      // Don't fail the order if save fails
    }
  }

  console.log("[v0] Order created successfully:", order?.order_number)
}
