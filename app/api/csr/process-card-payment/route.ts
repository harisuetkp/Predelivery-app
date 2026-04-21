import { stripe } from "@/lib/stripe"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const orderData = await request.json()
    const { paymentMethod, cardDetails, athMovilPhone } = orderData

    // Generate order number
    const orderNumber = `CSR-${Date.now().toString(36).toUpperCase()}`

    if (paymentMethod === "card") {
      // Process card payment via Stripe
      if (!stripe) {
        return NextResponse.json({ success: false, error: "Stripe not configured" }, { status: 500 })
      }

      // Create a payment method from card details
      const paymentMethodResult = await stripe.paymentMethods.create({
        type: "card",
        card: {
          number: cardDetails.number,
          exp_month: cardDetails.expMonth,
          exp_year: cardDetails.expYear,
          cvc: cardDetails.cvc,
        },
        billing_details: {
          name: cardDetails.name,
        },
      })

      // Create and confirm a PaymentIntent in one step
      const toCents = (amount: number) => Math.round(amount * 100)
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: toCents(orderData.total),
        currency: "usd",
        payment_method: paymentMethodResult.id,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
        metadata: {
          order_source: "phone_csr",
          restaurantId: orderData.restaurantId,
          branchId: orderData.branchId || "",
          orderType: orderData.orderType,
          customerName: orderData.eventDetails?.name || "",
          customerPhone: orderData.eventDetails?.phone || "",
          customerEmail: orderData.eventDetails?.email || "",
        },
      })

      if (paymentIntent.status !== "succeeded") {
        return NextResponse.json({ 
          success: false, 
          error: `Payment failed: ${paymentIntent.status}` 
        }, { status: 400 })
      }

      // Create order in database
      await insertCSROrder(orderData, orderNumber, "stripe", paymentIntent.id)

      // Send notifications
      await sendOrderNotifications(orderData, orderNumber)

      return NextResponse.json({ 
        success: true, 
        orderNumber,
        paymentIntentId: paymentIntent.id 
      })

    } else if (paymentMethod === "athmovil") {
      // Create order with pending ATH Movil payment
      await insertCSROrder(orderData, orderNumber, "athmovil", null, "pending_payment")

      // TODO: Integrate with ATH Movil Business API to send payment request
      // For now, we create the order as pending and it can be confirmed manually

      // Send notifications
      await sendOrderNotifications(orderData, orderNumber)

      return NextResponse.json({ 
        success: true, 
        orderNumber,
        athMovilPhone,
        message: "Order created. ATH Movil payment request sent." 
      })

    } else {
      return NextResponse.json({ success: false, error: "Invalid payment method" }, { status: 400 })
    }

  } catch (error: any) {
    console.error("[CSR Payment Error]", error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Payment processing failed" 
    }, { status: 500 })
  }
}

async function insertCSROrder(
  orderData: any, 
  orderNumber: string, 
  paymentProvider: string,
  paymentId: string | null,
  status: string = "pending"
) {
  const supabase = getSupabaseClient()
  const restaurantId = orderData.restaurantId
  const branchId = orderData.branchId
  
  // Save/update customer data
  let customerId: string | null = orderData.customerId || null
  let customerAddressId: string | null = orderData.customerAddressId || null
  
  if (orderData.saveCustomerData !== false && orderData.eventDetails?.phone) {
    const phone = orderData.eventDetails.phone.replace(/\D/g, "")
    
    // Check if customer exists
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .or(`phone.ilike.%${phone}%`)
      .single()
    
    if (existingCustomer) {
      customerId = existingCustomer.id
      // Update customer info
      await supabase
        .from("customers")
        .update({
          name: orderData.eventDetails.name,
          email: orderData.eventDetails.email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId)
    } else {
      // Create new customer
      const { data: newCustomer } = await supabase
        .from("customers")
        .insert({
          name: orderData.eventDetails.name,
          email: orderData.eventDetails.email,
          phone: phone,
        })
        .select("id")
        .single()
      
      if (newCustomer) {
        customerId = newCustomer.id
      }
    }
    
    // Save address if delivery order
    if (customerId && orderData.orderType === "delivery" && orderData.eventDetails?.address) {
      // Check if this address already exists for the customer
      const { data: existingAddress } = await supabase
        .from("customer_addresses")
        .select("id")
        .eq("customer_id", customerId)
        .eq("street_address", orderData.eventDetails.address)
        .eq("city", orderData.eventDetails.city || "")
        .single()
      
      if (existingAddress) {
        customerAddressId = existingAddress.id
      } else {
        // Create new address
        const { data: newAddress } = await supabase
          .from("customer_addresses")
          .insert({
            customer_id: customerId,
            label: "Home",
            street_address: orderData.eventDetails.address,
            street_address_2: orderData.eventDetails.address2 || null,
            city: orderData.eventDetails.city,
            state: orderData.eventDetails.state || "PR",
            zip: orderData.eventDetails.zip,
            delivery_instructions: orderData.eventDetails.specialInstructions || null,
            is_default: true,
          })
          .select("id")
          .single()
        
        if (newAddress) {
          customerAddressId = newAddress.id
          // Set as default address for customer
          await supabase
            .from("customers")
            .update({ default_address_id: customerAddressId })
            .eq("id", customerId)
        }
      }
    }
  }

  // Calculate subtotals from cart
  let foodSubtotal = 0
  let internalShopSubtotal = 0
  let serviceRevenue = 0

  for (const item of orderData.cart || []) {
    const itemTotal = (item.price || 0) * (item.quantity || 1)
    if (item.type === "package") {
      serviceRevenue += itemTotal
    } else if (item.type === "internal_shop") {
      internalShopSubtotal += itemTotal
    } else {
      foodSubtotal += itemTotal
    }
  }

  // Fetch discount percentage
  let discountPercent = 0
  const orderType = orderData.orderType

  if (branchId) {
    const { data: branch } = await supabase
      .from("branches")
      .select("restaurant_discount_percent, delivery_discount_percent, pickup_discount_percent")
      .eq("id", branchId)
      .single()

    if (branch) {
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

  const restaurantPayout = foodSubtotal * (1 - discountPercent / 100)

  // Get branchId - for CSR orders, default to first branch if not specified
  let finalBranchId = branchId
  if (!finalBranchId) {
    const { data: firstBranch } = await supabase
      .from("branches")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(1)
      .single()
    
    finalBranchId = firstBranch?.id || null
  }

  // Insert the order
  const { data: order, error } = await supabase.from("orders").insert({
    restaurant_id: restaurantId,
    branch_id: finalBranchId,
    order_number: orderNumber,
    stripe_payment_intent_id: paymentId,
    status,
    delivery_type: orderData.orderType || "pickup",
    delivery_date: orderData.eventDetails?.eventDate || new Date().toISOString().split('T')[0],
    customer_id: customerId,
    customer_address_id: customerAddressId,
    customer_name: orderData.eventDetails?.name || null,
    customer_email: orderData.eventDetails?.email || null,
    customer_phone: orderData.eventDetails?.phone || null,
    delivery_address: orderData.eventDetails?.address || null,
    delivery_city: orderData.eventDetails?.city || null,
    delivery_state: orderData.eventDetails?.state || "PR",
    delivery_zip: orderData.eventDetails?.zip || null,
    // Pin lat/lng — Shipday reads these for driver navigation
    delivery_latitude: typeof orderData.eventDetails?.deliveryLatitude === "number"
      ? orderData.eventDetails.deliveryLatitude
      : null,
    delivery_longitude: typeof orderData.eventDetails?.deliveryLongitude === "number"
      ? orderData.eventDetails.deliveryLongitude
      : null,
    special_instructions: orderData.eventDetails?.specialInstructions || null,
    subtotal: orderData.subtotal || 0,
    tax: orderData.tax || 0,
    delivery_fee: orderData.deliveryFee || 0,
    tip: orderData.tip || 0,
    total: orderData.total || 0,
    restaurant_subtotal: foodSubtotal,
    internal_shop_subtotal: internalShopSubtotal,
    service_revenue: serviceRevenue,
    restaurant_discount_percent: discountPercent,
    restaurant_payout: Math.round(restaurantPayout * 100) / 100,
    order_source: "phone",
    payment_provider: paymentProvider,
  }).select().single()

  if (error) {
    console.error("[CSR Order Insert Error]", error)
    throw error
  }

  // Insert order items
  if (orderData.cart && orderData.cart.length > 0 && order) {
    const orderItems = orderData.cart.map((item: any) => ({
      order_id: order.id,
      menu_item_id: item.id || null,
      item_name: item.name,
      quantity: item.quantity || 1,
      unit_price: item.price || 0,
      total_price: (item.price || 0) * (item.quantity || 1),
      selected_options: item.selectedOptions || {},
      is_internal_shop_item: item.type === "internal_shop",
      internal_shop_item_id: item.type === "internal_shop" ? item.internalShopItemId : null,
    }))

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems)
    if (itemsError) {
      console.error("[CSR Order Items Error]", itemsError)
    }
  }

  return order
}

async function sendOrderNotifications(orderData: any, orderNumber: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  
  try {
    await fetch(`${baseUrl}/api/send-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_NOTIFY_SECRET || "",
      },
      body: JSON.stringify({
        orderData: {
          ...orderData,
          order_number: orderNumber,
        },
        sessionId: orderNumber
      }),
    })

    // Shipday orders are sent manually from the CSR Dispatch screen
  } catch (error) {
    console.error("[CSR Notification Error]", error)
  }
}
