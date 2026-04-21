"use server"

import { createClient } from "@/lib/supabase/server"
import { sendOrderConfirmation } from "@/lib/email/send-order-confirmation"

// ATH Móvil API endpoints (from official ATHM-Payment-Button-API documentation)
const ATH_MOVIL_PAYMENT_URL = "https://payments.athmovil.com/api/business-transaction/ecommerce/payment"
const ATH_MOVIL_FIND_PAYMENT_URL = "https://payments.athmovil.com/api/business-transaction/ecommerce/business/findPayment"
// Authorization endpoint — MUST be called after the customer confirms in-app (status CONFIRM)
// to actually debit the customer and settle funds into the merchant account. Without this
// call, the transaction stays in CONFIRM, eventually expires, and NEVER appears in the
// merchant's ATH Business panel. Per Evertec docs:
//   https://github.com/evertec/ATHM-Payment-Button-API
const ATH_MOVIL_AUTHORIZATION_URL = "https://payments.athmovil.com/api/business-transaction/ecommerce/authorization"

// Default ATH Móvil credentials for FoodNetPR (used when restaurant doesn't have their own)
// These MUST be set as environment variables in Vercel - no fallbacks allowed
const DEFAULT_ATHMOVIL_PUBLIC_TOKEN = process.env.ATHMOVIL_PUBLIC_TOKEN
const DEFAULT_ATHMOVIL_ECOMMERCE_ID = process.env.ATHMOVIL_ECOMMERCE_ID

if (!DEFAULT_ATHMOVIL_PUBLIC_TOKEN) {
  console.error("ATHMOVIL_PUBLIC_TOKEN environment variable is not set")
}
if (!DEFAULT_ATHMOVIL_ECOMMERCE_ID) {
  console.error("ATHMOVIL_ECOMMERCE_ID environment variable is not set")
}

interface ATHMovilOrderData {
  restaurantId: string
  branchId?: string
  userId?: string | null
  cart: any[]
  total: number
  tax: number
  tip: number
  subtotal: number
  deliveryFee: number // "Costo de Entrega" - customer-facing delivery fee
  dispatchFee?: number // Platform dispatch fee
  customerEmail: string
  customerPhone?: string
  eventDetails?: any
  orderType: string
  restaurantName?: string
  branchName?: string
  athmovil_public_token?: string
  athmovil_ecommerce_id?: string
}

// Helper to convert dollars to cents (ATH Móvil uses dollars with 2 decimal places)
function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

export async function createATHMovilPayment(orderData: ATHMovilOrderData) {
  try {
    const supabase = await createClient()

    // ALWAYS get ATH Móvil credentials from database (branch or restaurant)
    // This ensures we use the correct tokens stored in the database
    let publicToken: string | null = null
    let ecommerceId: string | null = null

    // Try to get from branch first
    if (orderData.branchId) {
      const { data: branch } = await supabase
        .from("branches")
        .select("athmovil_public_token, athmovil_ecommerce_id")
        .eq("id", orderData.branchId)
        .single()

      if (branch?.athmovil_public_token) {
        publicToken = branch.athmovil_public_token
        ecommerceId = branch.athmovil_ecommerce_id
      }
    }

    // If no branch token, get from restaurant
    if (!publicToken) {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("athmovil_public_token, athmovil_ecommerce_id")
        .eq("id", orderData.restaurantId)
        .single()

      if (restaurant?.athmovil_public_token) {
        publicToken = restaurant.athmovil_public_token
        ecommerceId = restaurant.athmovil_ecommerce_id
      }
    }

    // Fall back to default FoodNetPR ATH Móvil account if restaurant doesn't have their own
    if (!publicToken) {
      if (!DEFAULT_ATHMOVIL_PUBLIC_TOKEN || !DEFAULT_ATHMOVIL_ECOMMERCE_ID) {
        throw new Error("ATH Móvil credentials not configured. Restaurant has no ATH Móvil token and ATHMOVIL_PUBLIC_TOKEN/ATHMOVIL_ECOMMERCE_ID environment variables are not set.")
      }
      publicToken = DEFAULT_ATHMOVIL_PUBLIC_TOKEN
      ecommerceId = DEFAULT_ATHMOVIL_ECOMMERCE_ID
      console.log("[ATH Móvil] Using default FoodNetPR account for restaurant:", orderData.restaurantId)
    }

    console.log("[ATH Móvil] Using token for restaurant", orderData.restaurantId, "- token starts with:", publicToken?.substring(0, 10))

    // Build order description for metadata (max 40 chars each)
    const itemDescriptions = orderData.cart
      .map((item: any) => `${item.quantity}x ${item.name}`)
      .join(", ")

    const metadata1 = `${orderData.restaurantName || "Order"}`.substring(0, 40)
    const metadata2 = itemDescriptions.substring(0, 40)

    // Build items array for ATH Móvil (required field)
    const items = orderData.cart.slice(0, 10).map((item: any) => ({
      name: (item.name || "Item").substring(0, 50),
      description: (item.selectedOptions
        ? Object.values(item.selectedOptions).flat().map((opt: any) =>
            typeof opt === "string" ? opt : opt?.name || ""
          ).filter(Boolean).join(", ")
        : "Item").substring(0, 100) || "Item",
      quantity: String(item.quantity || 1),
      price: formatAmount(item.totalPrice ?? item.finalPrice ?? item.price ?? 0),
      tax: "0",
      metadata: null,
    }))

    // Validate phone number for ATH Móvil (must be exactly 10 digits, no country code)
    const cleanPhone = orderData.customerPhone?.replace(/\D/g, '') || ''
    // Remove leading 1 if 11 digits starting with 1 (strip US country code)
    const normalizedPhone = cleanPhone.length === 11 && cleanPhone.startsWith('1')
      ? cleanPhone.slice(1)
      : cleanPhone
    // Only send if exactly 10 digits after normalization
    const isValidPhone = normalizedPhone.length === 10

    // ATH Móvil payment request payload (per official API documentation)
    const paymentRequest = {
      env: "production",
      publicToken: publicToken,
      timeout: 600, // 10 minutes timeout (between 120-600)
      total: formatAmount(orderData.total),
      subtotal: formatAmount(orderData.subtotal),
      tax: formatAmount(orderData.tax),
      metadata1: metadata1,
      metadata2: metadata2,
      items: items,
      // Only include phoneNumber if it's exactly 10 digits (no country code)
      ...(isValidPhone ? { phoneNumber: normalizedPhone } : {}),
    }

    // Log full request body (excluding publicToken for security)
    const logSafeRequest = {
      ...paymentRequest,
      publicToken: paymentRequest.publicToken ? `${paymentRequest.publicToken.substring(0, 8)}...REDACTED` : "MISSING",
    }
    console.log("[ATH Móvil] === PAYMENT REQUEST DEBUG ===")
    console.log("[ATH Móvil] Endpoint:", ATH_MOVIL_PAYMENT_URL)
    console.log("[ATH Móvil] Full request body:", JSON.stringify(logSafeRequest, null, 2))
    console.log("[ATH Móvil] Items count:", items.length)
    console.log("[ATH Móvil] Total amount:", paymentRequest.total)

    // Create the ATH Móvil payment session via their API
    const response = await fetch(ATH_MOVIL_PAYMENT_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentRequest),
    })

    const responseText = await response.text()
    console.log("[ATH Móvil] === PAYMENT RESPONSE DEBUG ===")
    console.log("[ATH Móvil] HTTP Status Code:", response.status)
    console.log("[ATH Móvil] HTTP Status Text:", response.statusText)
    console.log("[ATH Móvil] Response Headers:", JSON.stringify(Object.fromEntries(response.headers.entries())))
    console.log("[ATH Móvil] Full Response Body:", responseText)

    // Parse and log any error fields
    try {
      const parsedResponse = JSON.parse(responseText)
      console.log("[ATH Móvil] Parsed Response status:", parsedResponse.status)
      console.log("[ATH Móvil] Parsed Response message:", parsedResponse.message)
      if (parsedResponse.errorCode) console.log("[ATH Móvil] Error Code:", parsedResponse.errorCode)
      if (parsedResponse.error) console.log("[ATH Móvil] Error Field:", parsedResponse.error)
      if (parsedResponse.data) console.log("[ATH Móvil] Response Data:", JSON.stringify(parsedResponse.data, null, 2))
    } catch (parseErr) {
      console.log("[ATH Móvil] Could not parse response as JSON")
    }

    if (!response.ok) {
      console.error("[ATH Móvil] API Error:", responseText)
      throw new Error(`ATH Móvil API error: ${response.status} - ${responseText}`)
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      throw new Error(`Invalid response from ATH Móvil: ${responseText}`)
    }

    if (result.status !== "success" || !result.data?.ecommerceId) {
      throw new Error(result.message || "Error creating ATH Móvil payment")
    }

    // Return the ecommerceId which is needed to check payment status
    return {
      success: true,
      ecommerceId: result.data.ecommerceId,
      authToken: result.data.auth_token, // Needed for authorization step
      publicToken: publicToken,
      total: orderData.total,
    }
  } catch (error: any) {
    console.error("[ATH Móvil] Payment creation error:", error)
    return {
      success: false,
      error: error.message || "Error al crear el pago de ATH Móvil",
    }
  }
}

/**
 * Authorize (capture) an ATH Móvil payment after the customer has confirmed in-app.
 * Call this when ecommerceStatus transitions to "CONFIRM". This is the step that
 * actually moves money from the customer to the merchant account and causes the
 * transaction to appear in the ATH Business dashboard.
 *
 * IMPORTANT: Without this call the transaction will NEVER complete on ATH's side,
 * even though our DB may show an order. The customer is never charged and the
 * merchant never receives funds.
 */
export async function authorizeATHMovilPayment(
  ecommerceId: string,
  authToken: string,
  publicToken: string, // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  try {
    // Per Evertec docs the auth_token from /payment must be passed as a Bearer token
    // in the Authorization header. The request body is empty — the bearer identifies
    // the ecommerce session to capture.
    //   POST /ecommerce/authorization
    //   Authorization: Bearer <auth_token>
    const response = await fetch(ATH_MOVIL_AUTHORIZATION_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: "",
    })

    const responseText = await response.text()
    console.log("[ATH Móvil] Authorization response for", ecommerceId, ":", response.status, responseText)

    if (!response.ok) {
      return {
        success: false,
        error: `Authorization failed: ${response.status} - ${responseText}`,
      }
    }

    let result: any
    try {
      result = JSON.parse(responseText)
    } catch {
      return { success: false, error: "Invalid authorization response" }
    }

    if (result.status !== "success") {
      return {
        success: false,
        error: result.message || "Authorization rejected by ATH Móvil",
      }
    }

    return {
      success: true,
      referenceNumber: result.data?.referenceNumber || null,
      dailyTransactionId: result.data?.dailyTransactionId || null,
      total: result.data?.total,
    }
  } catch (error: any) {
    console.error("[ATH Móvil] Authorization error:", error)
    return { success: false, error: error.message || "Authorization request failed" }
  }
}

export async function checkATHMovilPaymentStatus(ecommerceId: string, publicToken: string) {
  try {
    // Use the findPayment endpoint to check transaction status
    const response = await fetch(ATH_MOVIL_FIND_PAYMENT_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ecommerceId: ecommerceId,
        publicToken: publicToken,
      }),
    })

    const responseText = await response.text()
    console.log("[ATH Móvil] Find Payment Response:", response.status, responseText)

    if (!response.ok) {
      return {
        success: false,
        status: "error",
        error: `Failed to check payment status: ${response.status}`,
      }
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      return {
        success: false,
        status: "error",
        error: "Invalid response from ATH Móvil",
      }
    }

    if (result.status !== "success" || !result.data) {
      return {
        success: false,
        status: "error",
        error: result.message || "Error checking payment status",
      }
    }

    // ecommerceStatus values: "OPEN" (pending), "CONFIRM" (user confirmed, needs authorization), "COMPLETED", "CANCEL"
    const ecommerceStatus = result.data.ecommerceStatus

    return {
      success: true,
      status: ecommerceStatus, // "OPEN", "CONFIRM", "COMPLETED", "CANCEL"
      transactionId: result.data.referenceNumber || null,
      dailyTransactionId: result.data.dailyTransactionId || null,
      ecommerceId: result.data.ecommerceId,
      total: result.data.total,
      completedAt: result.data.transactionDate || null,
      businessName: result.data.businessName,
    }
  } catch (error: any) {
    console.error("[ATH Móvil] Status check error:", error)
    return {
      success: false,
      status: "error",
      error: error.message,
    }
  }
}

/**
 * Create order in database after ATH Movil payment is confirmed
 */
export async function createATHMovilOrder(orderData: ATHMovilOrderData & {
  athMovilTransactionId?: string
}): Promise<{ success: boolean; error?: string; orderId?: string }> {
  try {
    console.log("[v0] createATHMovilOrder called with branchId:", orderData.branchId, "restaurantId:", orderData.restaurantId)
    const supabase = await createClient()

    // Calculate financial split
    let foodSubtotal = 0
    let serviceRevenue = 0

    if (orderData.cart) {
      for (const item of orderData.cart) {
        if (item.item_type === "service_package") {
          serviceRevenue += item.total_price || 0
        } else {
          foodSubtotal += item.total_price || 0
        }
      }
    }

    // If branchId is not provided, try to get the default branch for this restaurant
    // For independent restaurants without branches, branchId can be null
    let branchId: string | null = orderData.branchId || null
    if (!branchId && orderData.restaurantId) {
      const { data: defaultBranch } = await supabase
        .from("branches")
        .select("id")
        .eq("restaurant_id", orderData.restaurantId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single()

      if (defaultBranch?.id) {
        branchId = defaultBranch.id
      }
      // If no branch found, that's OK for independent restaurants - branchId stays null
    }

    // Get restaurant discount percent
    let discountPercent = 0
    if (orderData.restaurantId) {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("restaurant_discount_percent")
        .eq("id", orderData.restaurantId)
        .single()

      if (restaurant?.restaurant_discount_percent) {
        discountPercent = restaurant.restaurant_discount_percent
      }
    }

    const restaurantPayout = foodSubtotal * (1 - discountPercent / 100)

    // --- Resolve customer BEFORE order insert so orders.customer_id is populated ---
    // Supports both logged-in (userId) and "guest" (email-only) checkouts — the
    // email fallback is what keeps guest orders attached to /mi-cuenta history
    // when the email matches an existing customer record.
    let resolvedCustomer: any = null

    const fullName = orderData.eventDetails?.name || ""
    const nameParts = fullName.trim().split(" ")
    const firstName = nameParts[0] || null
    const lastName = nameParts.slice(1).join(" ") || null
    const phone = orderData.customerPhone || orderData.eventDetails?.phone || null

    if (orderData.userId || orderData.customerEmail) {
      try {
        // Phase 1: lookup by auth_user_id
        if (orderData.userId) {
          const { data } = await supabase
            .from("customers")
            .select("id, phone, first_name, last_name, auth_user_id")
            .eq("auth_user_id", orderData.userId)
            .maybeSingle()
          resolvedCustomer = data
        }
        // Phase 2: fallback lookup by email
        if (!resolvedCustomer && orderData.customerEmail) {
          const { data } = await supabase
            .from("customers")
            .select("id, phone, first_name, last_name, auth_user_id")
            .eq("email", orderData.customerEmail)
            .maybeSingle()
          resolvedCustomer = data
        }
        // Phase 3: create if no match (with unique-email race handling)
        if (!resolvedCustomer) {
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
            const { data } = await supabase
              .from("customers")
              .select("id, phone, first_name, last_name, auth_user_id")
              .eq("email", orderData.customerEmail)
              .maybeSingle()
            resolvedCustomer = data
          } else if (!createError) {
            resolvedCustomer = newCustomer
          } else {
            console.error("[v0] ATH Movil customer create error:", createError)
          }
        } else {
          // Update missing fields + link auth_user_id if newly logged in
          const updates: Record<string, any> = {}
          if (!resolvedCustomer.phone && phone) updates.phone = phone
          if (!resolvedCustomer.first_name && firstName) updates.first_name = firstName
          if (!resolvedCustomer.last_name && lastName) updates.last_name = lastName
          if (orderData.userId && !resolvedCustomer.auth_user_id) updates.auth_user_id = orderData.userId

          if (Object.keys(updates).length > 0) {
            await supabase
              .from("customers")
              .update(updates)
              .eq("id", resolvedCustomer.id)
          }
        }
      } catch (customerError) {
        console.error("[v0] ATH Movil: error resolving customer:", customerError)
      }
    }
    const resolvedCustomerId: string | null = resolvedCustomer?.id || null

    // Generate order number
    const orderNumber = `ATH-${Date.now().toString(36).toUpperCase()}`

    // Insert the order - branch_id can be null for independent restaurants
    const { data: order, error } = await supabase.from("orders").insert({
      restaurant_id: orderData.restaurantId,
      branch_id: branchId,
      original_branch_id: branchId,
      customer_id: resolvedCustomerId,
      user_id: orderData.userId || null,
      order_number: orderNumber,
      status: "pending",
      delivery_type: orderData.orderType || "pickup",
      customer_name: orderData.eventDetails?.name || orderData.customerEmail?.split('@')[0] || null,
      customer_email: orderData.customerEmail || null,
      customer_phone: orderData.customerPhone || null,
      delivery_date: orderData.eventDetails?.eventDate || new Date().toISOString().split('T')[0],
      delivery_address: orderData.eventDetails?.address || null,
      delivery_city: orderData.eventDetails?.city || null,
      delivery_state: orderData.eventDetails?.state || "PR",
      delivery_zip: orderData.eventDetails?.zip || null,
      // Pin lat/lng — Shipday driver dispatch reads these (see
      // shipday/create-order/route.ts:157-158). Without them the driver
      // navigates by street address only, defeating pin confirmation.
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
      dispatch_fee: orderData.dispatchFee || 0,
      tip: orderData.tip || 0,
      total: orderData.total || 0,
      food_subtotal: foodSubtotal,
      service_revenue: serviceRevenue,
      restaurant_discount_percent: discountPercent,
      restaurant_payout: Math.round(restaurantPayout * 100) / 100,
      order_source: "online",
      payment_provider: "athmovil",
      payment_status: "paid",
      athmovil_reference_number: orderData.athMovilTransactionId || null,
    }).select().single()

    if (error) {
      console.error("[v0] ATH Movil order insert error:", error)
      return { success: false, error: error.message }
    }

    sendOrderConfirmation(order, { name: (orderData as any).restaurant_name || "" }).catch(console.error)

    console.log("[v0] ATH Movil order created successfully:", order?.id, "branch_id:", order?.branch_id)

    // Insert order items
    if (orderData.cart && orderData.cart.length > 0 && order) {
      const orderItems = orderData.cart.map((item: any) => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id || item.id || null,
        item_name: item.name || item.item_name,
        quantity: item.quantity || 1,
        unit_price: item.price || item.unit_price || 0,
        total_price: item.total_price || (item.price * (item.quantity || 1)),
        selected_options: item.selectedOptions || item.selected_options || {},
        special_instructions: item.specialInstructions || null,
      }))

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems)
      if (itemsError) {
        console.error("[v0] ATH Movil order items insert error:", itemsError)
      }
    }

    // Save delivery address for the resolved customer (if delivery order).
    // Customer create/update/lookup already happened above, before order insert.
    if (resolvedCustomer && orderData.orderType === "delivery" && orderData.eventDetails?.address) {
      try {
        const addressLine1 = orderData.eventDetails.address.split(",")[0]?.trim() || orderData.eventDetails.address
        const { data: existingAddress } = await supabase
          .from("customer_addresses")
          .select("id")
          .eq("customer_id", resolvedCustomer.id)
          .ilike("address_line_1", addressLine1)
          .limit(1)
          .single()

        // Only save if address doesn't already exist
        if (!existingAddress) {
          await supabase.from("customer_addresses").insert({
            customer_id: resolvedCustomer.id,
            label: "Delivery",
            address_line_1: addressLine1,
            city: orderData.eventDetails.city || "",
            state: orderData.eventDetails.state || "PR",
            postal_code: orderData.eventDetails.zip || orderData.eventDetails.zipCode || "",
            delivery_instructions: orderData.eventDetails.deliveryInstructions || null,
            is_default: false,
          })
        }
      } catch (addressError) {
        console.error("[v0] Error saving customer address:", addressError)
        // Don't fail the order if save fails
      }
    }

    console.log("[v0] ATH Movil order created:", orderNumber)
    return { success: true, orderId: order?.id }
  } catch (error: any) {
    console.error("[v0] ATH Movil order creation error:", error)
    return { success: false, error: error.message || "Error creating order" }
  }
}

export async function testATHMovilConnection(publicToken: string) {
  try {
    // Simple validation - check if the token looks valid
    if (!publicToken || publicToken.length < 10) {
      return {
        success: false,
        error: "Token público inválido",
      }
    }

    // ATH Móvil doesn't have a dedicated test endpoint,
    // so we just validate the token format
    return {
      success: true,
      message: "Token configurado correctamente. La conexión se verificará al procesar un pago.",
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    }
  }
}
