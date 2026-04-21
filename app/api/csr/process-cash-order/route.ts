import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendOrderConfirmation } from "@/lib/email/send-order-confirmation"

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error("Database configuration missing")
  }
  
  return createClient(url, key)
}

// Validation function for required fields
function validateOrderData(orderData: any): { valid: boolean; error?: string } {
  if (!orderData) {
    return { valid: false, error: "Datos de orden vacíos" }
  }
  
  if (!orderData.restaurantId) {
    return { valid: false, error: "Restaurante no seleccionado" }
  }
  
  if (!orderData.cart || orderData.cart.length === 0) {
    return { valid: false, error: "El carrito está vacío" }
  }
  
  if (!orderData.eventDetails?.name?.trim()) {
    return { valid: false, error: "Nombre del cliente requerido" }
  }
  
  if (!orderData.eventDetails?.phone?.trim()) {
    return { valid: false, error: "Teléfono del cliente requerido" }
  }
  
  const orderType = orderData.orderType || "delivery"
  if (orderType === "delivery") {
    if (!orderData.eventDetails?.address?.trim()) {
      return { valid: false, error: "Dirección de entrega requerida" }
    }
  }
  
  // Validate totals are reasonable
  const total = parseFloat(orderData.total) || 0
  if (total <= 0) {
    return { valid: false, error: "Total de orden inválido" }
  }
  
  if (total > 10000) {
    return { valid: false, error: "Total de orden excede el límite ($10,000)" }
  }
  
  return { valid: true }
}

// Generate unique order number with collision prevention
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `CSR-${timestamp}-${random}`
}

export async function POST(request: NextRequest) {
  let supabase
  let orderData: any
  
  // Step 1: Parse request with error handling
  try {
    orderData = await request.json()
  } catch (parseError) {
    console.error("[CSR Cash] JSON parse error:", parseError)
    return NextResponse.json({ 
      success: false, 
      error: "Datos de solicitud inválidos" 
    }, { status: 400 })
  }
  
  // Step 2: Validate required fields
  const validation = validateOrderData(orderData)
  if (!validation.valid) {
    console.error("[CSR Cash] Validation failed:", validation.error)
    return NextResponse.json({ 
      success: false, 
      error: validation.error 
    }, { status: 400 })
  }
  
  // Step 3: Initialize database connection
  try {
    supabase = getSupabaseClient()
  } catch (dbConfigError) {
    console.error("[CSR Cash] Database config error:", dbConfigError)
    return NextResponse.json({ 
      success: false, 
      error: "Error de configuración del servidor" 
    }, { status: 500 })
  }
  
  // Step 4: Verify restaurant exists and is active
  try {
    const { data: restaurant, error: restError } = await supabase
      .from("restaurants")
      .select("id, name, is_active")
      .eq("id", orderData.restaurantId)
      .single()
    
    if (restError || !restaurant) {
      console.error("[CSR Cash] Restaurant not found:", orderData.restaurantId)
      return NextResponse.json({ 
        success: false, 
        error: "Restaurante no encontrado" 
      }, { status: 404 })
    }
    
    if (!restaurant.is_active) {
      return NextResponse.json({ 
        success: false, 
        error: "Restaurante no está activo actualmente" 
      }, { status: 400 })
    }
  } catch (restCheckError) {
    console.error("[CSR Cash] Restaurant check error:", restCheckError)
    return NextResponse.json({ 
      success: false, 
      error: "Error verificando restaurante" 
    }, { status: 500 })
  }
  
  // Step 5: Generate order number
  const orderNumber = generateOrderNumber()
  
  // Step 6: Create order with explicit field mapping
  let order
  try {
    const orderInsertData = {
      restaurant_id: orderData.restaurantId,
      branch_id: orderData.branchId || null,
      order_number: orderNumber,
      stripe_payment_intent_id: null,
      status: "pending",
      delivery_type: orderData.orderType || "delivery",
      delivery_date: orderData.eventDetails?.eventDate || new Date().toISOString().split('T')[0],
      customer_id: orderData.customerId || null,
      customer_name: (orderData.eventDetails?.name || "").trim(),
      customer_email: (orderData.eventDetails?.email || "").trim().toLowerCase() || null,
      customer_phone: (orderData.eventDetails?.phone || "").trim(),
      delivery_address: (orderData.eventDetails?.address || "").trim() || null,
      apt_suite: (orderData.eventDetails?.apt || "").trim() || null,
      delivery_city: (orderData.eventDetails?.city || "").trim() || null,
      delivery_state: orderData.eventDetails?.state || "PR",
      delivery_zip: (orderData.eventDetails?.zip || "").trim() || null,
      // Pin lat/lng — Shipday reads these for driver navigation
      delivery_latitude: typeof orderData.eventDetails?.deliveryLatitude === "number"
        ? orderData.eventDetails.deliveryLatitude
        : null,
      delivery_longitude: typeof orderData.eventDetails?.deliveryLongitude === "number"
        ? orderData.eventDetails.deliveryLongitude
        : null,
      special_instructions: (orderData.eventDetails?.specialInstructions || "").trim() || null,
      subtotal: parseFloat(orderData.subtotal) || 0,
      tax: parseFloat(orderData.tax) || 0,
      delivery_fee: parseFloat(orderData.deliveryFee) || 0,
      tip: parseFloat(orderData.tip) || 0,
      total: parseFloat(orderData.total) || 0,
      order_source: "csr",
      payment_provider: "cash",
    }

    const { data, error } = await supabase
      .from("orders")
      .insert(orderInsertData)
      .select("id, order_number")
      .single()

    if (error) {
      console.error("[CSR Cash] Order insert error:", error)
      return NextResponse.json({ 
        success: false, 
        error: `Error creando orden: ${error.message}` 
      }, { status: 500 })
    }
    
    order = data
    const insertedOrder = { ...orderInsertData, ...data }
    sendOrderConfirmation(insertedOrder, { name: orderData.restaurant_name || "" }).catch(console.error)
  } catch (orderCreateError: any) {
    console.error("[CSR Cash] Order creation exception:", orderCreateError)
    return NextResponse.json({ 
      success: false, 
      error: "Error inesperado creando orden" 
    }, { status: 500 })
  }

  // Step 7: Insert order items (with error recovery)
  try {
    if (orderData.cart && orderData.cart.length > 0 && order) {
      const orderItems = orderData.cart.map((item: any) => ({
        order_id: order.id,
        menu_item_id: item.id || null,
        item_name: item.name || "Item sin nombre",
        quantity: parseInt(item.quantity) || 1,
        unit_price: parseFloat(item.price) || 0,
        total_price: (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1),
        selected_options: item.selectedOptions || {},
      }))

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems)

      if (itemsError) {
        // Log but don't fail the order - items can be fixed manually
        console.error("[CSR Cash] Order items insert error (non-fatal):", itemsError)
      }
    }
  } catch (itemsError) {
    // Non-fatal: order was created, items failed
    console.error("[CSR Cash] Order items exception (non-fatal):", itemsError)
  }

  // Step 8: Send notifications (completely non-blocking, fire and forget)
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://prdelivery.com"
    
    // Use AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
    
    fetch(`${baseUrl}/api/send-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_NOTIFY_SECRET || "",
      },
      body: JSON.stringify({
        orderData: {
          ...orderData,
          order_number: orderNumber,
          orderNumber: orderNumber,
          customerName: orderData.eventDetails?.name,
          customerEmail: orderData.eventDetails?.email,
          customerPhone: orderData.eventDetails?.phone,
        },
        sessionId: orderNumber,
        orderId: order.id,
      }),
      signal: controller.signal,
    })
    .then(() => clearTimeout(timeoutId))
    .catch(notifyError => {
      clearTimeout(timeoutId)
      console.error("[CSR Cash] Notification error (non-fatal):", notifyError)
    })
  } catch (notifySetupError) {
    // Completely ignore notification errors
    console.error("[CSR Cash] Notification setup error (non-fatal):", notifySetupError)
  }

  // Step 9: Return success
  return NextResponse.json({ 
    success: true, 
    orderNumber,
    orderId: order.id,
    message: "Orden creada exitosamente - Pago en efectivo"
  })
}
