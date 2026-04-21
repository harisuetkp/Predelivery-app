"use server"

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

// Generate unique order number
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `ORD-${timestamp}-${random}`
}

// Validate order data
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
  
  if (!orderData.customerEmail && !orderData.customerPhone) {
    return { valid: false, error: "Email o teléfono requerido" }
  }
  
  const total = parseFloat(orderData.total) || 0
  if (total <= 0) {
    return { valid: false, error: "Total de orden inválido" }
  }
  
  if (total > 10000) {
    return { valid: false, error: "Total de orden excede el límite ($10,000)" }
  }
  
  return { valid: true }
}

export async function createCashOrder(orderData: any): Promise<{
  success: boolean
  orderId?: string
  orderNumber?: string
  error?: string
}> {
  // Validate order data
  const validation = validateOrderData(orderData)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  let supabase
  try {
    supabase = getSupabaseClient()
  } catch (error) {
    return { success: false, error: "Error de configuración del servidor" }
  }

  // Verify restaurant exists and is active
  try {
    const { data: restaurant, error: restError } = await supabase
      .from("restaurants")
      .select("id, name, is_active")
      .eq("id", orderData.restaurantId)
      .single()
    
    if (restError || !restaurant) {
      return { success: false, error: "Restaurante no encontrado" }
    }
    
    if (!restaurant.is_active) {
      return { success: false, error: "Restaurante no está activo actualmente" }
    }
  } catch (error) {
    return { success: false, error: "Error verificando restaurante" }
  }

  // Generate order number
  const orderNumber = generateOrderNumber()

  // Resolve or create customer record BEFORE order insert.
  // orders.customer_id FKs to customers.id — NEVER auth.users.id.
  // Two-phase: auth_user_id → email fallback → create (with 23505 race handling).
  let resolvedCustomerId: string | null = orderData.customerId || null

  // Phase 1: direct auth_user_id lookup
  if (!resolvedCustomerId && orderData.userId) {
    const { data: byAuth } = await supabase
      .from("customers")
      .select("id")
      .eq("auth_user_id", orderData.userId)
      .maybeSingle()
    if (byAuth) resolvedCustomerId = byAuth.id
  }

  // Phase 2: email fallback (handles guest + legacy records)
  const normalizedEmail = (orderData.customerEmail || "").trim().toLowerCase() || null
  if (!resolvedCustomerId && normalizedEmail) {
    const { data: byEmail } = await supabase
      .from("customers")
      .select("id, auth_user_id")
      .eq("email", normalizedEmail)
      .maybeSingle()
    if (byEmail) {
      resolvedCustomerId = byEmail.id
      // Link auth_user_id if customer has none yet and we have one
      if (!byEmail.auth_user_id && orderData.userId) {
        await supabase
          .from("customers")
          .update({ auth_user_id: orderData.userId })
          .eq("id", byEmail.id)
      }
    }
  }

  // Phase 3: create new customer if still unresolved
  if (!resolvedCustomerId && normalizedEmail) {
    const fullName = (orderData.eventDetails?.name || "").trim()
    const nameParts = fullName.split(" ")
    const firstName = nameParts[0] || null
    const lastName = nameParts.slice(1).join(" ") || null
    const phone = (orderData.customerPhone || "").trim() || null

    const { data: newCustomer, error: createError } = await supabase
      .from("customers")
      .insert({
        email: normalizedEmail,
        auth_user_id: orderData.userId || null,
        first_name: firstName,
        last_name: lastName,
        phone,
      })
      .select("id")
      .single()

    if (createError) {
      // 23505 race: another concurrent request just created this customer — re-read
      if ((createError as any).code === "23505") {
        const { data: raceResolved } = await supabase
          .from("customers")
          .select("id")
          .eq("email", normalizedEmail)
          .maybeSingle()
        if (raceResolved) resolvedCustomerId = raceResolved.id
      } else {
        console.error("[Orders] Customer create error (non-fatal):", createError)
      }
    } else if (newCustomer) {
      resolvedCustomerId = newCustomer.id
    }
  }

  // Create order
  let order
  try {
    const orderInsertData = {
      restaurant_id: orderData.restaurantId,
      branch_id: orderData.branchId || null,
      order_number: orderNumber,
      stripe_payment_intent_id: null,
      status: "pending",
      delivery_type: orderData.orderType || "delivery",
      delivery_date: orderData.eventDetails?.eventDate || new Date().toISOString().split("T")[0],
      customer_id: resolvedCustomerId,
      customer_name: (orderData.eventDetails?.name || "").trim(),
      customer_email: (orderData.customerEmail || "").trim().toLowerCase() || null,
      customer_phone: (orderData.customerPhone || "").trim(),
      delivery_address: (orderData.eventDetails?.address || "").trim() || null,
      apt_suite: (orderData.eventDetails?.addressLine2 || "").trim() || null,
      delivery_city: (orderData.eventDetails?.city || "").trim() || null,
      delivery_state: orderData.eventDetails?.state || "PR",
      delivery_zip: (orderData.eventDetails?.zip || orderData.eventDetails?.zipCode || "").trim() || null,
      // Pin lat/lng must persist on cash orders too — Shipday driver
      // dispatch reads order.delivery_latitude/longitude (see app/api/
      // shipday/create-order/route.ts:157-158). Without these the driver
      // navigates by street address only, defeating the whole pin-confirm
      // flow we just shipped. Stripe path already does this in
      // app/api/check-payment-status/route.ts:233-234.
      delivery_latitude: typeof orderData.eventDetails?.deliveryLatitude === "number"
        ? orderData.eventDetails.deliveryLatitude
        : null,
      delivery_longitude: typeof orderData.eventDetails?.deliveryLongitude === "number"
        ? orderData.eventDetails.deliveryLongitude
        : null,
      special_instructions: (orderData.eventDetails?.deliveryInstructions || "").trim() || null,
      subtotal: parseFloat(orderData.subtotal) || 0,
      tax: parseFloat(orderData.tax) || 0,
      delivery_fee: parseFloat(orderData.deliveryFee) || 0,
      dispatch_fee: parseFloat(orderData.dispatchFee) || 0,
      tip: parseFloat(orderData.tip) || 0,
      total: parseFloat(orderData.total) || 0,
      order_source: "web",
      payment_provider: "cash",
    }

    const { data, error } = await supabase
      .from("orders")
      .insert(orderInsertData)
      .select("id, order_number")
      .single()

    if (error) {
      console.error("[Orders] Order insert error:", error)
      return { success: false, error: `Error creando orden: ${error.message}` }
    }
    
    order = data
    const insertedOrder = { ...orderInsertData, ...data }
    sendOrderConfirmation(insertedOrder, { name: orderData.restaurant_name || "" }).catch(console.error)
  } catch (error: any) {
    console.error("[Orders] Order creation exception:", error)
    return { success: false, error: "Error inesperado creando orden" }
  }

  // Insert order items
  try {
    if (orderData.cart && orderData.cart.length > 0 && order) {
      const orderItems = orderData.cart.map((item: any) => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id || item.id || null,
        item_name: item.item_name || item.name || "Item sin nombre",
        quantity: parseInt(item.quantity) || 1,
        unit_price: parseFloat(item.unit_price || item.price || item.basePrice) || 0,
        total_price: parseFloat(item.total_price || item.totalPrice) || 
          ((parseFloat(item.unit_price || item.price || item.basePrice) || 0) * (parseInt(item.quantity) || 1)),
        selected_options: item.selected_options || item.selectedOptions || {},
      }))

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems)

      if (itemsError) {
        console.error("[Orders] Order items insert error (non-fatal):", itemsError)
      }
    }
  } catch (error) {
    console.error("[Orders] Order items exception (non-fatal):", error)
  }

  // Send notifications (fire and forget)
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://prdelivery.com"
    
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
          customerEmail: orderData.customerEmail,
          customerPhone: orderData.customerPhone,
        },
        sessionId: orderNumber,
        orderId: order.id,
      }),
    }).catch(err => console.error("[Orders] Notification error (non-fatal):", err))
  } catch (error) {
    console.error("[Orders] Notification setup error (non-fatal):", error)
  }

  // Update customer profile with missing info from checkout form
  // Only SET fields that are currently NULL — never overwrite existing data.
  // Non-fatal: order is already saved, profile enrichment is best-effort.
  if (resolvedCustomerId) {
    try {
      const { data: customer } = await supabase
        .from("customers")
        .select("id, phone, first_name, last_name")
        .eq("id", resolvedCustomerId)
        .maybeSingle()

      if (customer) {
        const fullName = orderData.eventDetails?.name || ""
        const nameParts = fullName.trim().split(" ")
        const firstName = nameParts[0] || null
        const lastName = nameParts.slice(1).join(" ") || null
        const phone = orderData.customerPhone || null

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
            console.error("[Orders] Customer profile update error (non-fatal):", updateError)
          }
        }
      }
    } catch (err) {
      console.error("[Orders] Customer profile enrichment exception (non-fatal):", err)
    }
  }

  return { 
    success: true, 
    orderId: order.id,
    orderNumber,
  }
}
