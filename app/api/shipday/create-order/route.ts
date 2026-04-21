import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const getAdminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = getAdminClient()

    // Support both formats: direct orderData (from checkout) or orderId (from CSR dispatch)
    let order: any = null
    let restaurantId: string
    let branchId: string | null = null

    if (body.orderId) {
      // CSR Dispatch format: fetch order from database
      const { data: fetchedOrder, error: orderError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (id, item_name, quantity, unit_price, total_price, selected_options),
          restaurants (id, name, shipday_api_key, restaurant_address)
        `)
        .eq("id", body.orderId)
        .single()

      if (orderError || !fetchedOrder) {
        console.error("[Shipday] Could not fetch order:", orderError)
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
      }

      order = fetchedOrder
      restaurantId = body.restaurantId || order.restaurant_id
      branchId = body.branchId || order.branch_id

      // Only process delivery orders
      if (order.delivery_type !== "delivery") {
        return NextResponse.json({ success: true, message: "Not a delivery order" })
      }
    } else if (body.orderData) {
      // Checkout format: use provided orderData directly
      const orderData = body.orderData

      // Only process delivery orders
      if (orderData.orderType !== "delivery" && orderData.orderType !== "Delivery") {
        return NextResponse.json({ success: true, message: "Not a delivery order" })
      }

      restaurantId = orderData.restaurantId
      branchId = orderData.branchId || null

      if (!restaurantId) {
        console.error("[Shipday] No restaurantId in orderData")
        return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: "Missing orderId or orderData" }, { status: 400 })
    }

    // Fetch the restaurant's Shipday API key from the database
    const { data: restaurant, error } = await supabase
      .from("restaurants")
      .select("shipday_api_key, name, restaurant_address, latitude, longitude, phone")
      .eq("id", restaurantId)
      .single()

    if (error || !restaurant) {
      console.error("[Shipday] Could not fetch restaurant:", error)
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    // Check for branch-specific overrides
    let branchData: any = null
    if (branchId) {
      const { data: branch } = await supabase
        .from("branches")
        .select("shipday_api_key, name, address, city, state, zip, latitude, longitude, phone")
        .eq("id", branchId)
        .single()
      branchData = branch
    }

    // API key priority: branch -> restaurant -> platform default
    const apiKey = branchData?.shipday_api_key || restaurant.shipday_api_key || process.env.SHIPDAY_API_KEY
    if (!apiKey) {
      console.log("[Shipday] No Shipday API key configured for restaurant:", restaurantId)
      return NextResponse.json({ error: "Shipday no está configurado para este restaurante" }, { status: 400 })
    }

    // Pickup address: use branch address if available, otherwise restaurant
    const pickupAddress = branchData
      ? [branchData.address, branchData.city, branchData.state, branchData.zip].filter(Boolean).join(", ")
      : restaurant.restaurant_address || ""

    let shipdayOrder: any

    if (order) {
      // Build from database order (CSR Dispatch format)
      const customerAddress = [
        order.delivery_address,
        order.delivery_city,
        order.delivery_state,
        order.delivery_zip,
      ]
        .filter(Boolean)
        .join(", ")

      // Calculate pickup and delivery times in Puerto Rico timezone
      // Pickup = NOW + 30 minutes, Delivery = NOW + 50 minutes
      const pickupMinutesFromNow = 30
      const deliveryMinutesFromNow = 50
      
      const now = new Date()
      const pickupTimestamp = new Date(now.getTime() + pickupMinutesFromNow * 60 * 1000)
      const deliveryTimestamp = new Date(now.getTime() + deliveryMinutesFromNow * 60 * 1000)
      
      // Format time in Puerto Rico timezone using Intl
      const formatPRTime = (date: Date): string => {
        const formatter = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'America/Puerto_Rico',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
        return formatter.format(date)
      }
      
      // Format date in Puerto Rico timezone
      const formatPRDate = (date: Date): string => {
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Puerto_Rico',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        })
        return formatter.format(date)
      }
      
      const pickupTime = formatPRTime(pickupTimestamp)
      const deliveryTime = formatPRTime(deliveryTimestamp)
      const deliveryDate = formatPRDate(now)

      // Postgres `numeric` columns come back from supabase-js as STRINGS (for
      // arbitrary-precision safety), so the previous `typeof === "number"`
      // guards silently dropped every pin-confirmed coordinate before forwarding
      // to Shipday. Coerce here with a NaN check so numeric strings ("18.456")
      // and real numbers (18.456) both flow through, while null/undefined/"" are
      // still rejected cleanly.
      const toNum = (v: any): number | undefined => {
        if (v === null || v === undefined || v === "") return undefined
        const n = typeof v === "number" ? v : Number(v)
        return Number.isFinite(n) ? n : undefined
      }

      shipdayOrder = {
        orderNumber: order.order_number || `ORD-${order.id.slice(0, 8)}`,
        customerName: order.customer_name || "Customer",
        customerAddress: customerAddress || "Address not provided",
        customerEmail: order.customer_email || "",
        customerPhoneNumber: order.customer_phone || "",
        restaurantName: branchData ? `${restaurant.name} - ${branchData.name}` : restaurant.name,
        restaurantAddress: pickupAddress,
        restaurantPhoneNumber: branchData?.phone || restaurant.phone || "",
        pickupLatitude: toNum(branchData?.latitude) ?? toNum(restaurant.latitude),
        pickupLongitude: toNum(branchData?.longitude) ?? toNum(restaurant.longitude),
        deliveryLatitude: toNum(order.delivery_latitude),
        deliveryLongitude: toNum(order.delivery_longitude),
        orderItem: (order.order_items || []).map((item: any) => ({
          name: item.item_name,
          quantity: item.quantity || 1,
          unitPrice: item.unit_price || 0,
          addOns: item.selected_options
            ? Object.values(item.selected_options)
                .flat()
                .map((opt: any) => (typeof opt === "string" ? opt : opt?.name || ""))
                .filter(Boolean)
            : [],
        })),
        // Only send subtotal (items total) - exclude delivery fee and tax
        totalOrderCost: order.subtotal || (order.total - (order.delivery_fee || 0) - (order.tax || 0) - (order.tip || 0)) || 0,
        tips: order.tip || 0, // Only tips are sent to Shipday
        expectedDeliveryDate: deliveryDate,
        expectedPickupTime: pickupTime,
        expectedDeliveryTime: deliveryTime,
        deliveryInstruction: order.special_instructions || "",
        orderSource: "FoodNetPR",
      }
    } else {
      // Build from orderData (checkout format)
      const orderData = body.orderData
      const eventDetails = orderData.eventDetails || {}
      const customerAddress = [
        eventDetails.address,
        eventDetails.address2,
        eventDetails.city,
        eventDetails.state,
        eventDetails.zip,
      ]
        .filter(Boolean)
        .join(", ")

      // Same numeric-string coercion as the order-from-DB path above —
      // restaurant.latitude/longitude come from supabase-js as strings.
      // eventDetails.deliveryLatitude/Longitude come from the JSON body
      // (already real numbers) but we run them through toNum2 too for safety.
      const toNum2 = (v: any): number | undefined => {
        if (v === null || v === undefined || v === "") return undefined
        const n = typeof v === "number" ? v : Number(v)
        return Number.isFinite(n) ? n : undefined
      }

      shipdayOrder = {
        orderNumber: `CAT-${Date.now()}`,
        customerName: eventDetails.name || eventDetails.company || orderData.customerEmail?.split("@")[0] || "Customer",
        customerAddress: customerAddress || "Address not provided",
        customerEmail: orderData.customerEmail || "",
        customerPhoneNumber: orderData.customerPhone || "",
        restaurantName: branchData ? `${restaurant.name} - ${branchData.name}` : (restaurant.name || orderData.restaurantName || ""),
        restaurantAddress: pickupAddress || orderData.restaurantAddress || "",
        restaurantPhoneNumber: branchData?.phone || restaurant.phone || "",
        pickupLatitude: toNum2(branchData?.latitude) ?? toNum2(restaurant.latitude),
        pickupLongitude: toNum2(branchData?.longitude) ?? toNum2(restaurant.longitude),
        deliveryLatitude: toNum2(eventDetails.deliveryLatitude),
        deliveryLongitude: toNum2(eventDetails.deliveryLongitude),
        orderItem: (orderData.cart || []).map((item: any) => ({
          name: item.name,
          quantity: item.quantity || 1,
          unitPrice: item.price || 0,
          addOns: item.selectedOptions
            ? Object.values(item.selectedOptions)
                .flat()
                .map((opt: any) => (typeof opt === "string" ? opt : opt?.name || ""))
                .filter(Boolean)
            : [],
        })),
        // Only send subtotal (items total) - exclude delivery fee and tax
        totalOrderCost: orderData.subtotal || (orderData.total - (orderData.deliveryFee || 0) - (orderData.tax || 0) - (orderData.tip || 0)) || 0,
        tips: orderData.tip || 0, // Only tips are sent to Shipday
        expectedDeliveryDate: eventDetails.eventDate || "",
        expectedPickupTime: eventDetails.eventTime || "12:00:00",
        expectedDeliveryTime: eventDetails.eventTime || "12:00:00",
        deliveryInstruction: [
          eventDetails.specialInstructions || "",
          orderData.includeUtensils ? "Include utensils." : "",
          orderData.deliveryZone ? `Zone: ${orderData.deliveryZone}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
        orderSource: "FoodNetPR",
      }
    }

    console.log("[Shipday] Creating delivery order:", shipdayOrder.orderNumber, "for:", shipdayOrder.restaurantName)
    console.log("[Shipday] Full request payload:", JSON.stringify(shipdayOrder, null, 2))

    // Call Shipday API
    const response = await fetch("https://api.shipday.com/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(shipdayOrder),
    })

    const responseText = await response.text()
    console.log("[Shipday] API response status:", response.status, response.statusText)
    console.log("[Shipday] API response body:", responseText)

    if (!response.ok) {
      console.error("[Shipday] API error - Status:", response.status, "Body:", responseText)
      throw new Error(`Shipday API error: ${response.status} - ${responseText}`)
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      console.error("[Shipday] Could not parse response as JSON:", responseText)
      throw new Error("Invalid response from Shipday API")
    }
    
    console.log("[Shipday] Order created successfully. Full response:", JSON.stringify(result))

    // Shipday API may return the ID in different fields depending on the response format
    const shipdayOrderId = result.orderId || result.id || result.order_id || result.orderID || 
                           (result.order && (result.order.id || result.order.orderId)) ||
                           (Array.isArray(result) && result[0]?.orderId)

    // Update the order with the Shipday ID if we have an order from database
    if (order && shipdayOrderId) {
      await supabase
        .from("orders")
        .update({ shipday_order_id: String(shipdayOrderId) })
        .eq("id", order.id)
    }

    return NextResponse.json({
      success: true,
      shipdayOrderId,
      trackingUrl: result.trackingUrl || null,
    })
  } catch (error: any) {
    console.error("[Shipday] Error creating order:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
