import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"
import { sendCateringOrderConfirmation } from "@/lib/email/send-catering-order-confirmation"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
})

async function insertCateringOrder(orderData: any, sessionId: string) {
  const supabase = await createClient()

  const restaurantId = orderData.restaurantId
  const branchId = orderData.branchId

  if (!branchId) {
    throw new Error("CRITICAL: branchId is required for catering orders — no fallback allowed")
  }

  // Calculate food vs service revenue split
  let foodSubtotal = 0
  let serviceRevenue = 0

  for (const item of orderData.cart || []) {
    const itemTotal = (item.price || 0) * (item.quantity || 1)
    if (item.type === "package") {
      serviceRevenue += itemTotal
    } else {
      foodSubtotal += itemTotal
    }
  }

  if (orderData.servicePackageTotal) {
    serviceRevenue += orderData.servicePackageTotal
  }

  // Fetch discount from catering branch
  let discountPercent = 0
  const { data: branch } = await supabase
    .from("catering_branches")
    .select("catering_discount_percent")
    .eq("id", branchId)
    .single()

  if (branch?.catering_discount_percent) {
    discountPercent = branch.catering_discount_percent
  }

  if (discountPercent === 0) {
    const { data: restaurant } = await supabase
      .from("catering_restaurants")
      .select("catering_discount_percent")
      .eq("id", restaurantId)
      .single()

    if (restaurant?.catering_discount_percent) {
      discountPercent = restaurant.catering_discount_percent
    }
  }

  const restaurantPayout = foodSubtotal * (1 - discountPercent / 100)
  const orderNumber = `ORD-CAT-${Date.now().toString(36).toUpperCase()}`

  const { data: order, error } = await supabase
    .from("catering_orders")
    .insert({
      catering_restaurant_id: restaurantId,
      catering_branch_id: branchId,
      fulfilling_branch_id: branchId,
      order_number: orderNumber,
      stripe_payment_intent_id: sessionId,
      stripe_account_id: orderData.stripeAccountId || null,
      payment_track: orderData.payment_track || "portal",
      status: "pending",
      payment_provider: "stripe",
      payment_method: "card",
      payment_status: "paid",
      delivery_type: orderData.orderType || "pickup",
      event_date: orderData.eventDetails?.eventDate || null,
      event_time: orderData.eventDetails?.eventTime || null,
      guest_count: orderData.eventDetails?.guestCount || null,
      customer_name: orderData.eventDetails?.name || null,
      customer_email: orderData.customerEmail || null,
      customer_phone: orderData.customerPhone || null,
      customer_id: orderData.customerId || null,
      delivery_address:
        [orderData.eventDetails?.address, orderData.eventDetails?.addressLine2].filter(Boolean).join(", ") ||
        null,
      delivery_city: orderData.eventDetails?.city || null,
      delivery_state: orderData.eventDetails?.state || "PR",
      delivery_zip: orderData.eventDetails?.zip || null,
      delivery_latitude: typeof orderData.eventDetails?.deliveryLatitude === "number" ? orderData.eventDetails.deliveryLatitude : null,
      delivery_longitude: typeof orderData.eventDetails?.deliveryLongitude === "number" ? orderData.eventDetails.deliveryLongitude : null,
      special_instructions: orderData.eventDetails?.specialInstructions || null,
      subtotal: orderData.subtotal || 0,
      tax: orderData.tax || 0,
      delivery_fee: orderData.deliveryFee || 0,
      tip: orderData.tip || 0,
      total: orderData.total || 0,
      food_subtotal: foodSubtotal,
      service_revenue: serviceRevenue,
      restaurant_discount_percent: discountPercent,
      restaurant_payout: Math.round(restaurantPayout * 100) / 100,
      order_source: orderData.order_source || "online",
    })
    .select()
    .single()

  if (error) {
    console.error("[catering/check-payment-status] Order insert error:", error)
    throw new Error(`Failed to insert catering order: ${error.message}`)
  }

  // Insert catering order items
  if (orderData.cart && orderData.cart.length > 0 && order) {
    const orderItems = orderData.cart
      .filter((item: any) => item.type !== "delivery_fee" && item.type !== "tax" && item.type !== "tip")
      .map((item: any) => ({
        catering_order_id: order.id,
        catering_menu_item_id: item.menu_item_id || item.id || null,
        item_name: item.name || item.item_name,
        quantity: item.quantity || 1,
        unit_price: item.price || item.unit_price || 0,
        total_price: item.total_price || (item.price * (item.quantity || 1)),
        selected_options: item.selectedOptions || item.selected_options || {},
        size_name: item.size_name || null,
        serves: item.serves || null,
      }))

    const { error: itemsError } = await supabase
      .from("catering_order_items")
      .insert(orderItems)

    if (itemsError) {
      console.error("[catering/check-payment-status] Order items insert error:", itemsError)
      throw new Error(`Failed to insert catering order items: ${itemsError.message}`)
    }
  }

  // Update customer profile with missing info from checkout form
  // Only SET fields that are currently NULL - never overwrite existing data
  if (orderData.userId) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, phone, first_name, last_name")
      .eq("auth_user_id", orderData.userId)
      .single()

    if (customerError) {
      console.error("[catering] Customer profile fetch error:", customerError)
      throw new Error(`Customer profile fetch failed: ${customerError.message}`)
    }

    if (customer) {
      // Parse name into first/last
      const fullName = orderData.eventDetails?.name || ""
      const nameParts = fullName.trim().split(" ")
      const firstName = nameParts[0] || null
      const lastName = nameParts.slice(1).join(" ") || null
      const phone = orderData.customerPhone || null

      // Only update NULL fields
      const updates: Record<string, any> = {}
      if (!customer.phone && phone) updates.phone = phone
      if (!customer.first_name && firstName) updates.first_name = firstName
      if (!customer.last_name && lastName) updates.last_name = lastName

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("customers")
          .update(updates)
          .eq("id", customer.id)

        if (updateError) {
          console.error("[catering] Customer profile update error:", updateError)
          throw new Error(`Customer profile update failed: ${updateError.message}`)
        }
      }
    }
  }

  console.log("[catering] Order created successfully:", order?.order_number)
  return order
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("session_id")

  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== "paid") {
      return NextResponse.json({
        status: session.payment_status,
        paid: false,
      })
    }

    // Check if catering order already exists for this session
    const supabase = await createClient()
    const { data: existingOrder } = await supabase
      .from("catering_orders")
      .select("id, order_number, total")
      .eq("stripe_payment_intent_id", sessionId)
      .single()

    if (existingOrder) {
      return NextResponse.json({
        status: "paid",
        paid: true,
        orderId: existingOrder.id,
        orderNumber: existingOrder.order_number,
        total: existingOrder.total ?? 0,
      })
    }

    // Reconstruct order data from Stripe metadata
    const metadata = session.metadata || {}
    const cart = JSON.parse(metadata.cart || "[]")

    const orderData = {
      restaurantId: metadata.restaurantId,
      branchId: metadata.branchId,
      customerId: metadata.customerId || null,
      userId: metadata.userId || null,
      orderType: metadata.orderType,
      customerEmail: metadata.customerEmail || session.customer_details?.email || null,
      customerPhone: metadata.customerPhone || session.customer_details?.phone || null,
      cart,
      subtotal: parseFloat(metadata.subtotal || "0"),
      tax: parseFloat(metadata.tax || "0"),
      deliveryFee: parseFloat(metadata.deliveryFee || "0"),
      tip: parseFloat(metadata.tip || "0"),
      total: parseFloat(metadata.total || "0"),
      servicePackageTotal: parseFloat(metadata.servicePackageTotal || "0"),
      order_source: metadata.order_source || "online",
      stripeAccountId: metadata.stripeAccountId || null,
      payment_track: metadata.payment_track || "portal",
      eventDetails: {
        name: metadata.customerName || null,
        email: metadata.customerEmail || null,
        phone: metadata.customerPhone || null,
        eventDate: metadata.eventDate || null,
        eventTime: metadata.eventTime || null,
        guestCount: metadata.guestCount ? parseInt(metadata.guestCount) : null,
        address: metadata.address || null,
        addressLine2: metadata.addressLine2 || null,
        city: metadata.city || null,
        state: metadata.state || null,
        zip: metadata.zip || null,
        deliveryLatitude: metadata.deliveryLatitude ? parseFloat(metadata.deliveryLatitude) : null,
        deliveryLongitude: metadata.deliveryLongitude ? parseFloat(metadata.deliveryLongitude) : null,
        specialInstructions: metadata.specialInstructions || null,
      },
    }

    // Create the catering order
    const order = await insertCateringOrder(orderData, sessionId)

    ;(async () => {
      const supabase = await createClient()
      const { data: restaurant } = await supabase
        .from("catering_restaurants")
        .select("name")
        .eq("id", orderData.restaurantId)
        .single()

      const { data: items } = await supabase
        .from("catering_order_items")
        .select("item_name, quantity, unit_price, total_price")
        .eq("catering_order_id", order.id)

      sendCateringOrderConfirmation({ ...order, items: items || [] }, restaurant).catch(console.error)
    })().catch(console.error)

    // Send notifications
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://prdelivery.com"
    await fetch(`${baseUrl}/api/catering/send-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_NOTIFY_SECRET || "",
      },
      body: JSON.stringify({ orderData, sessionId, orderId: order.id }),
    }).catch((err) => {
      console.error("[catering] Failed to send notifications:", err)
    })

    return NextResponse.json({
      status: "paid",
      paid: true,
      orderId: order.id,
      orderNumber: order.order_number,
      total: orderData.total ?? 0,
    })

  } catch (error: any) {
    console.error("[catering/check-payment-status] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to check payment status" },
      { status: 500 }
    )
  }
}
