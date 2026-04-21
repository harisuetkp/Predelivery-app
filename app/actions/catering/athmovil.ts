"use server"

import { createClient } from "@/lib/supabase/server"
import { sendCateringOrderConfirmation } from "@/lib/email/send-catering-order-confirmation"
import { resolveCateringRouting, type CateringRoutingResolution } from "@/lib/catering/branch-settings"

// ATH Móvil API endpoints (from official ATHM-Payment-Button-API documentation)
const ATH_MOVIL_PAYMENT_URL = "https://payments.athmovil.com/api/business-transaction/ecommerce/payment"
const ATH_MOVIL_FIND_PAYMENT_URL = "https://payments.athmovil.com/api/business-transaction/ecommerce/business/findPayment"
// Authorization endpoint — must be called after status CONFIRM to actually capture
// funds. Without it the transaction never settles on ATH's side.
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

interface CateringATHMovilOrderData {
  restaurantId: string
  branchId?: string
  userId?: string | null
  cart: any[]
  total: number
  tax: number
  tip: number
  subtotal: number
  deliveryFee: number
  dispatchFee?: number
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

export async function createCateringATHMovilPayment(orderData: CateringATHMovilOrderData) {
  try {
    const supabase = await createClient()

    // ============================================================
    // Main Dispatch routing — resolve BEFORE reading payment tokens.
    // If the intake branch redirects to a hub, swap branchId to the
    // producing branch so ATH Móvil tokens below come from the branch
    // that actually produces the food (catering payment always credits
    // the producing branch).
    // ============================================================
    let routing: CateringRoutingResolution | null = null
    if (orderData.branchId) {
      routing = await resolveCateringRouting(orderData.branchId)
      if (routing?.wasRedirected) {
        orderData = { ...orderData, branchId: routing.producingBranchId }
      }
    }

    // ALWAYS get ATH Móvil credentials from database (branch or restaurant)
    // This ensures we use the correct tokens stored in the database
    let publicToken: string | null = null
    let ecommerceId: string | null = null

    // Try to get from catering branch first
    if (orderData.branchId) {
      const { data: branch } = await supabase
        .from("catering_branches")
        .select("athmovil_public_token, athmovil_ecommerce_id")
        .eq("id", orderData.branchId)
        .single()

      if (branch?.athmovil_public_token) {
        publicToken = branch.athmovil_public_token
        ecommerceId = branch.athmovil_ecommerce_id
      }
    }

    // If no branch token, get from catering restaurant
    if (!publicToken) {
      const { data: restaurant } = await supabase
        .from("catering_restaurants")
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
      console.log("[ATH Móvil Catering] Using default FoodNetPR account for restaurant:", orderData.restaurantId)
    }

    console.log("[ATH Móvil Catering] Using token for restaurant", orderData.restaurantId, "- token starts with:", publicToken?.substring(0, 10))

    // Build order description for metadata (max 40 chars each)
    const itemDescriptions = orderData.cart
      .map((item: any) => `${item.quantity}x ${item.name}`)
      .join(", ")

    const metadata1 = `${orderData.restaurantName || "Catering Order"}`.substring(0, 40)
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

    // ATH Móvil payment request payload (per official API documentation)
    // NOTE: We do NOT send phoneNumber - customer will enter it directly in ATH Móvil interface
    // This avoids PCUS_0007 "Invalid Customer Own Phone" errors from format issues
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
    }

    console.log("[ATH Móvil Catering] Creating payment with request:", JSON.stringify(paymentRequest, null, 2))

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
    console.log("[ATH Móvil Catering] API Response:", response.status, responseText)

    if (!response.ok) {
      console.error("[ATH Móvil Catering] API Error:", responseText)
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
    console.error("[ATH Móvil Catering] Payment creation error:", error)
    return {
      success: false,
      error: error.message || "Error al crear el pago de ATH Móvil",
    }
  }
}

/**
 * Authorize (capture) a catering ATH Móvil payment after the customer confirms in-app.
 * Mirrors authorizeATHMovilPayment in the OO path. Without this call the transaction
 * stays in CONFIRM and never settles into the merchant account.
 */
export async function authorizeCateringATHMovilPayment(
  ecommerceId: string,
  authToken: string,
  publicToken: string, // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  try {
    // Per Evertec docs: auth_token goes in the Authorization: Bearer header,
    // request body is empty. Bearer identifies the ecommerce session to capture.
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
    console.log("[ATH Móvil Catering] Authorization response for", ecommerceId, ":", response.status, responseText)

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
    console.error("[ATH Móvil Catering] Authorization error:", error)
    return { success: false, error: error.message || "Authorization request failed" }
  }
}

export async function checkCateringATHMovilStatus(ecommerceId: string, publicToken: string) {
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
    console.log("[ATH Móvil Catering] Find Payment Response:", response.status, responseText)

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
    console.error("[ATH Móvil Catering] Status check error:", error)
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
export async function createCateringATHMovilOrder(orderData: CateringATHMovilOrderData & {
  athMovilTransactionId?: string
}): Promise<{ success: boolean; error?: string; orderId?: string }> {
  try {
    console.log("[ATH Móvil Catering] createCateringATHMovilOrder called with branchId:", orderData.branchId, "restaurantId:", orderData.restaurantId)
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
    let branchId: string | null = orderData.branchId || null
    if (!branchId && orderData.restaurantId) {
      const { data: defaultBranch } = await supabase
        .from("catering_branches")
        .select("id")
        .eq("catering_restaurant_id", orderData.restaurantId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single()

      if (defaultBranch?.id) {
        branchId = defaultBranch.id
      }
    }

    // ============================================================
    // Main Dispatch routing — apply BEFORE the insert so the order row is
    // pinned to the producing branch. Note: the payment has already been
    // captured via createCateringATHMovilPayment (which also resolves
    // routing), so branchId here should already be the producing branch,
    // but we re-resolve defensively in case this function is called
    // stand-alone (e.g. from the CSR phone order path in the future).
    // ============================================================
    if (branchId) {
      const routing = await resolveCateringRouting(branchId)
      if (routing?.wasRedirected) {
        branchId = routing.producingBranchId
      }
    }

    // Get restaurant discount percent
    let discountPercent = 0
    if (orderData.restaurantId) {
      const { data: restaurant } = await supabase
        .from("catering_restaurants")
        .select("catering_discount_percent")
        .eq("id", orderData.restaurantId)
        .single()

      if (restaurant?.catering_discount_percent) {
        discountPercent = restaurant.catering_discount_percent
      }
    }

    const restaurantPayout = foodSubtotal * (1 - discountPercent / 100)

    // --- Resolve customer BEFORE order insert ---
    // Supports both logged-in (userId) and "guest" (email-only) checkouts.
    // The email fallback is what keeps guest orders attached to /mi-cuenta history.
    // NOTE: prior version set customer_id = userId (an auth.users UUID), breaking
    // the FK relationship to customers.id. Resolved customer.id is the correct value.
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
            console.error("[ATH Móvil Catering] Customer create error:", createError)
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
        console.error("[ATH Móvil Catering] Error resolving customer:", customerError)
        // Don't fail the order if resolution fails
      }
    }
    const resolvedCustomerId: string | null = resolvedCustomer?.id || null

    // Generate order number
    const orderNumber = `ORD-CAT-${Date.now().toString(36).toUpperCase()}`

    // Insert the order
    const { data: order, error } = await supabase.from("catering_orders").insert({
      catering_restaurant_id: orderData.restaurantId,
      catering_branch_id: branchId,
      customer_id: resolvedCustomerId,
      order_number: orderNumber,
      status: "pending",
      order_type: "catering",
      delivery_type: orderData.orderType || "pickup",
      scheduled_for: orderData.eventDetails?.eventDate
        ? `${orderData.eventDetails.eventDate}T${orderData.eventDetails.eventTime || "12:00"}:00`
        : new Date().toISOString(),
      customer_name: orderData.eventDetails?.name || orderData.customerEmail?.split('@')[0] || "Guest",
      customer_email: orderData.customerEmail || null,
      customer_phone: orderData.customerPhone || "0000000000",
      delivery_address: orderData.eventDetails?.address || null,
      delivery_city: orderData.eventDetails?.city || null,
      delivery_state: orderData.eventDetails?.state || "PR",
      delivery_zip: orderData.eventDetails?.zip || null,
      notes: orderData.eventDetails?.specialInstructions || null,
      subtotal: orderData.subtotal || 0,
      tax: orderData.tax || 0,
      delivery_fee: orderData.deliveryFee || 0,
      dispatch_fee: orderData.dispatchFee || 0,
      service_package_fee: 0,
      container_fees: 0,
      total: orderData.total || 0,
      payment_method: "athmovil",
      payment_status: "paid",
    }).select().single()

    if (error) {
      console.error("[ATH Móvil Catering] Order insert error:", error)
      return { success: false, error: error.message }
    }

    console.log("[ATH Móvil Catering] Order created successfully:", order?.id, "branch_id:", order?.catering_branch_id)

    ;(async () => {
      const { data: restaurant } = await supabase
        .from("catering_restaurants")
        .select("name")
        .eq("id", orderData.restaurantId)
        .single()
      sendCateringOrderConfirmation(
        { ...order, items: orderData.cart || [] },
        restaurant
      ).catch(console.error)
    })().catch(console.error)

    // Insert order items
    if (orderData.cart && orderData.cart.length > 0 && order) {
      const orderItems = orderData.cart.map((item: any) => ({
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

      const { error: itemsError } = await supabase.from("catering_order_items").insert(orderItems)
      if (itemsError) {
        console.error("[ATH Móvil Catering] Order items insert error:", itemsError)
      }
    }

    // Customer resolution (lookup/create/update) already happened before the
    // order insert — resolvedCustomer has the canonical customers.id that's
    // now stored in catering_orders.customer_id.

    console.log("[ATH Móvil Catering] Order created:", orderNumber)
    return { success: true, orderId: order?.id }
  } catch (error: any) {
    console.error("[ATH Móvil Catering] Order creation error:", error)
    return { success: false, error: error.message || "Error creating order" }
  }
}

export async function testCateringATHMovilConnection(publicToken: string) {
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
