import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const EATABIT_API_URL = "https://api.eatabit.io/v8/jobs"

interface OrderItem {
  name: string
  quantity: number
  selectedOptions?: Record<string, any>
  notes?: string
}

interface PrintOrderRequest {
  orderId?: string
  orderType: "delivery" | "catering"
  testPrint?: boolean
  printerId?: string
  // Catering-specific fields
  cateringOrderId?: string
}

function formatCateringTicket(order: any, restaurant: any, branch: any): string {
  const lines: string[] = []
  
  // Validate scheduled_for (single TIMESTAMPTZ field for event date/time)
  if (!order.scheduled_for) {
    throw new Error("Catering order missing scheduled_for")
  }
  
  // Order number (last 6 chars, uppercase) - same pattern as delivery
  const orderNumber = order.id.slice(-6).toUpperCase()
  
  // Header with [CATERING] label prominently at top
  lines.push("<lg><b>[CATERING]</b></lg>")
  lines.push("")
  lines.push(`<lg><b>ORDEN #${orderNumber}</b></lg>`)
  lines.push("")
  lines.push(`<center>${restaurant.name}</center>`)
  if (branch?.name) {
    lines.push(`<center>${branch.name}</center>`)
  }
  lines.push("")
  lines.push("================================")
  
  // Event date and time from scheduled_for
  const eventDateTime = new Date(order.scheduled_for)
  const eventDateStr = new Intl.DateTimeFormat("es-PR", { 
    timeZone: "America/Puerto_Rico",
    weekday: "long", 
    month: "long", 
    day: "numeric", 
    year: "numeric" 
  }).format(eventDateTime)
  const eventTimeStr = new Intl.DateTimeFormat("es-PR", { 
    timeZone: "America/Puerto_Rico",
    hour: "numeric", 
    minute: "2-digit", 
    hour12: true 
  }).format(eventDateTime)
  
  lines.push("")
  lines.push(`<b>FECHA DEL EVENTO:</b>`)
  lines.push(`${eventDateStr}`)
  lines.push(`<b>HORA:</b> ${eventTimeStr}`)
  lines.push("")
  
  // Prep by time - use prep_by column directly if available
  if (order.prep_by) {
    const prepDateTime = new Date(order.prep_by)
    const prepTimeStr = new Intl.DateTimeFormat("es-PR", { 
      timeZone: "America/Puerto_Rico",
      hour: "numeric", 
      minute: "2-digit", 
      hour12: true 
    }).format(prepDateTime)
    lines.push(`<b>PREPARAR PARA:</b> ${prepTimeStr}`)
    lines.push("")
  }
  
  // Delivery or pickup indicator - use delivery_type column
  const deliveryLabel = order.delivery_type === "delivery" ? "DELIVERY" : "RECOGIDO"
  lines.push(`<center><b>${deliveryLabel}</b></center>`)
  lines.push("")
  lines.push("================================")
  
  // Service package if available (optional - skip if not present)
  if (order.service_package_name) {
    lines.push("")
    lines.push(`<b>PAQUETE:</b> ${order.service_package_name}`)
    lines.push("")
  }
  
  // Items - kitchen ticket format (no prices)
  lines.push("")
  lines.push("<b>ITEMS:</b>")
  lines.push("")
  
  const items = order.catering_order_items
  if (!items || items.length === 0) {
    throw new Error("Catering order has no items - cannot print")
  }
  
  for (const item of items) {
    // Validate required item fields
    const name = item.menu_item_name ?? item.name
    if (!name) {
      throw new Error("Item missing name in order")
    }
    if (item.quantity == null) {
      throw new Error(`Item missing quantity: ${name}`)
    }
    
    const qty = item.quantity
    const unit = item.selling_unit
    
    // Format: 3x Arroz con Gandules (tray) - no price
    const itemLine = unit ? `${qty}x ${name} (${unit})` : `${qty}x ${name}`
    lines.push(itemLine)
    
    // Item notes if any
    if (item.notes) {
      lines.push(`   <sm>Nota: ${item.notes}</sm>`)
    }
  }
  
  lines.push("")
  lines.push("================================")
  
  // Special instructions - use notes column
  if (order.notes) {
    lines.push("")
    lines.push(`<b>INSTRUCCIONES:</b>`)
    lines.push(`${order.notes}`)
    lines.push("")
  }
  
  // Timestamp at bottom
  lines.push("--------------------------------")
  const orderDate = new Date(order.created_at)
  const timeStr = new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", hour: "2-digit", minute: "2-digit" }).format(orderDate)
  const dateStr = new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", month: "short", day: "numeric" }).format(orderDate)
  lines.push(`<sm><center>Impreso: ${dateStr} ${timeStr}</center></sm>`)
  
  return lines.join("\n")
}

function formatTicket(order: any, restaurant: any, branch: any): string {
  const lines: string[] = []
  
  // Order number (last 6 chars, uppercase)
  const orderNumber = order.id.slice(-6).toUpperCase()
  
  // Header
  lines.push(`<lg><b>PEDIDO #${orderNumber}</b></lg>`)
  lines.push("")
  lines.push(`<center>${restaurant.name}</center>`)
  if (branch?.name) {
    lines.push(`<center>${branch.name}</center>`)
  }
  lines.push("")
  
  // Order type - DELIVERY or PICKUP
  const orderType = order.delivery_method === "delivery" ? "DELIVERY" : "RECOGIDO"
  lines.push(`<center><b>${orderType}</b></center>`)
  lines.push("")
  lines.push("================================")
  
  // Scheduled time if applicable
  if (order.scheduled_date || order.scheduled_time) {
    lines.push("")
    lines.push(`<b>PROGRAMADO:</b>`)
    if (order.scheduled_date) lines.push(`Fecha: ${order.scheduled_date}`)
    if (order.scheduled_time) lines.push(`Hora: ${order.scheduled_time}`)
    lines.push("")
  }
  
  // Items - kitchen ticket format (no prices)
  lines.push("")
  lines.push("<b>ITEMS:</b>")
  lines.push("")
  
  // Use order_items from the joined table (not order.items JSONB)
  const items = order.order_items
  if (!items || items.length === 0) {
    throw new Error("Order has no items - cannot print. Ensure order_items table has records for this order.")
  }
  
  for (const item of items) {
    // Skip fee items (item_name is the column name from order_items table)
    const itemName = item.item_name
    if (itemName === "Delivery Fee" || itemName === "Dispatch Fee") continue
    
    if (!itemName) {
      throw new Error("Item missing item_name in order")
    }
    if (item.quantity == null) {
      throw new Error(`Item missing quantity: ${itemName}`)
    }
    
    const qty = item.quantity
    
    // Format: 2x Mofongo con Pollo - no price
    lines.push(`${qty}x ${itemName}`)
    
    // Options/modifications (selected_options is JSONB column from order_items)
    if (item.selected_options && typeof item.selected_options === "object") {
      for (const [key, value] of Object.entries(item.selected_options)) {
        if (typeof value === "string" && value) {
          lines.push(`   - ${value}`)
        } else if (Array.isArray(value)) {
          for (const v of value) {
            if (typeof v === "string") lines.push(`   - ${v}`)
            else if (v?.name) lines.push(`   - ${v.name}`)
          }
        }
      }
    }
  }
  
  lines.push("")
  lines.push("================================")
  
  // Special instructions
  if (order.special_instructions) {
    lines.push("")
    lines.push(`<b>INSTRUCCIONES:</b>`)
    lines.push(`${order.special_instructions}`)
    lines.push("")
  }
  
  // Timestamp at bottom
  lines.push("--------------------------------")
  const orderDate = new Date(order.created_at)
  const timeStr = new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", hour: "2-digit", minute: "2-digit" }).format(orderDate)
  const dateStr = new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", month: "short", day: "numeric" }).format(orderDate)
  lines.push(`<sm><center>Impreso: ${dateStr} ${timeStr}</center></sm>`)
  
  return lines.join("\n")
}

export async function POST(request: NextRequest) {
  try {
    // Auth gate: accept either the internal shared secret (server-to-server)
    // OR a valid authenticated admin/CSR session (all current callers are client-side admin UIs).
    const secret = process.env.INTERNAL_NOTIFY_SECRET
    const headerSecret = request.headers.get("x-internal-secret")
    const hasValidSecret = secret ? headerSecret === secret : false

    if (!hasValidSecret) {
      const authClient = await createClient()
      const {
        data: { user: authUser },
      } = await authClient.auth.getUser()
      if (!authUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      const { data: adminRow } = await authClient
        .from("admin_users")
        .select("id, role")
        .eq("auth_user_id", authUser.id)
        .maybeSingle()
      if (!adminRow) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const body = (await request.json()) as PrintOrderRequest
    const { orderId, orderType, testPrint, printerId: testPrinterId, cateringOrderId } = body

    // Require order_type for all non-test print jobs
    if (!testPrint && !orderType) {
      throw new Error("order_type is required for all print jobs. Must be 'delivery' or 'catering'.")
    }
    
    // Handle test print
    if (testPrint && testPrinterId) {
      const eatabitSid = process.env.EATABIT_API_SID
      const eatabitToken = process.env.EATABIT_API_TOKEN
      
      console.log("[Eatabit Test Print] SID exists:", !!eatabitSid, "Token exists:", !!eatabitToken)
      console.log("[Eatabit Test Print] SID prefix:", eatabitSid?.substring(0, 8))
      
      if (!eatabitSid || !eatabitToken) {
        return NextResponse.json({ error: "Eatabit credentials not configured" }, { status: 500 })
      }
      
      const testTicket = [
        "<lg><b>PRUEBA DE IMPRESION</b></lg>",
        "",
        "<center>================================</center>",
        "",
        "Esta es una prueba de impresion",
        "de Eatabit Cloud Printing.",
        "",
        "Si puedes leer esto, tu impresora",
        "esta configurada correctamente!",
        "",
        "<center>================================</center>",
        "",
        `<sm>Printer ID: ${testPrinterId}</sm>`,
        `<sm>Fecha: ${new Date().toLocaleString("es-PR")}</sm>`,
      ].join("\n")
      
      const authHeader = Buffer.from(`${eatabitSid}:${eatabitToken}`).toString("base64")
      console.log("[Eatabit Test Print] URL:", EATABIT_API_URL)
      console.log("[Eatabit Test Print] Printer ID:", testPrinterId)
      
      const eatabitResponse = await fetch(EATABIT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.api+json",
          "Accept": "application/vnd.api+json",
          "Authorization": `Basic ${authHeader}`,
        },
        body: JSON.stringify({
          data: {
            type: "jobs",
            attributes: {
              body: testTicket,
              quantity: 1,
              external_id: `test-${Date.now()}`,
              slug: "test-print",
              status_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/eatabit/status-callback`,
            },
            relationships: {
              printers: {
                data: {
                  type: "printers",
                  id: testPrinterId,
                },
              },
            },
          },
        }),
      })
      
      const responseText = await eatabitResponse.text()
      console.log("[Eatabit Test Print] Response status:", eatabitResponse.status)
      console.log("[Eatabit Test Print] Response text:", responseText.substring(0, 500))
      
      let eatabitData: any
      try {
        eatabitData = JSON.parse(responseText)
      } catch {
        return NextResponse.json({ 
          success: false, 
          error: `Eatabit API returned invalid response: ${responseText.substring(0, 200)}` 
        }, { status: 500 })
      }
      console.log("[eatabit v8] Response:", JSON.stringify(eatabitData))
      const jobId = eatabitData.data?.id || eatabitData.data?.attributes?.external_id || null
      
      if (!eatabitResponse.ok) {
        return NextResponse.json({ 
          success: false, 
          error: eatabitData.errors?.[0]?.detail || eatabitData.message || "Failed to send test print" 
        }, { status: 400 })
      }
      
      return NextResponse.json({ success: true, message: "Test print sent", jobId })
    }
    
    const supabase = await createClient()
    
    let order: any
    let restaurant: any
    let branch: any
    let printerId: string | null = null
    let ticketBody: string
    
    if (orderType === "catering") {
      // Handle catering order
      if (!cateringOrderId) {
        throw new Error("cateringOrderId is required for catering order prints")
      }
      
      // Get catering order with restaurant info
      const { data: cateringOrder, error: cateringError } = await supabase
        .from("catering_orders")
        .select(`
          *,
          catering_restaurants!inner (
            id,
            name,
            printer_tier,
            eatabit_restaurant_key
          ),
          catering_branches (
            id,
            name,
            eatabit_restaurant_key
          ),
          catering_order_items (
            id,
            menu_item_name,
            quantity,
            unit_price,
            selling_unit,
            total_price
          )
        `)
        .eq("id", cateringOrderId)
        .single()
      
      if (cateringError || !cateringOrder) {
        throw new Error(`Catering order not found: ${cateringError?.message}`)
      }
      
      order = cateringOrder
      restaurant = cateringOrder.catering_restaurants
      branch = cateringOrder.catering_branches
      
      // Check printer_tier - must be 'eatabit' for catering
      if (restaurant.printer_tier !== "eatabit") {
        throw new Error(`Cannot print: printer_tier is '${restaurant.printer_tier}', expected 'eatabit'`)
      }
      
      // Determine which printer to use
      // Priority: branch eatabit_restaurant_key → restaurant eatabit_restaurant_key
      if (branch?.eatabit_restaurant_key) {
        printerId = branch.eatabit_restaurant_key
      } else if (restaurant?.eatabit_restaurant_key) {
        printerId = restaurant.eatabit_restaurant_key
      }
      
      if (!printerId) {
        throw new Error("No EataBit printer configured for this catering restaurant. Set eatabit_restaurant_key on restaurant or branch.")
      }
      
      // Format catering ticket
      ticketBody = formatCateringTicket(order, restaurant, branch)
      
    } else if (orderType === "delivery") {
      // Handle delivery order (existing behavior)
      if (!orderId) {
        throw new Error("orderId is required for delivery order prints")
      }
      
      // Get order with restaurant, branch, and order items
      // Use explicit foreign key hint for branches to avoid ambiguity (orders has multiple FKs to branches)
      const { data: deliveryOrder, error: orderError } = await supabase
        .from("orders")
        .select(`
          *,
          restaurants!inner (
            id,
            name,
            printer_tier,
            eatabit_enabled,
            eatabit_restaurant_key
          ),
          branches!orders_branch_id_fkey (
            id,
            name,
            eatabit_enabled,
            eatabit_restaurant_key
          ),
          order_items (
            id,
            item_name,
            quantity,
            unit_price,
            total_price,
            selected_options
          )
        `)
        .eq("id", orderId)
        .single()
      
      if (orderError || !deliveryOrder) {
        throw new Error(`Delivery order not found: ${orderError?.message}`)
      }
      
      order = deliveryOrder
      restaurant = deliveryOrder.restaurants
      branch = deliveryOrder.branches
      
      // Check printer_tier - must be 'eatabit' for delivery
      if (restaurant.printer_tier !== "eatabit") {
        throw new Error(`Cannot print: printer_tier is '${restaurant.printer_tier}', expected 'eatabit'`)
      }
      
      // Determine which printer to use
      // Priority: branch eatabit_restaurant_key → restaurant eatabit_restaurant_key
      // Branch key takes priority if set, otherwise fall back to restaurant key
      if (branch?.eatabit_restaurant_key) {
        printerId = branch.eatabit_restaurant_key
      } else if (restaurant?.eatabit_restaurant_key) {
        printerId = restaurant.eatabit_restaurant_key
      }
      
      if (!printerId) {
        throw new Error("No EataBit printer configured for this restaurant/branch. Set eatabit_restaurant_key on restaurant or branch.")
      }
      
      // Format delivery ticket (existing format)
      ticketBody = formatTicket(order, restaurant, branch)
      
    } else {
      throw new Error(`Invalid order_type: '${orderType}'. Must be 'delivery' or 'catering'.`)
    }
    
    // Send to Eatabit API
    const eatabitSid = process.env.EATABIT_API_SID
    const eatabitToken = process.env.EATABIT_API_TOKEN
    
    if (!eatabitSid || !eatabitToken) {
      console.error("Eatabit credentials not configured")
      return NextResponse.json({ error: "Eatabit not configured" }, { status: 500 })
    }
    
    // Validate printerId is not empty
    if (!printerId || printerId.trim() === "") {
      throw new Error("Printer ID is empty or invalid - cannot send print job")
    }
    
    // Validate ticket body is not empty
    if (!ticketBody || ticketBody.trim() === "") {
      throw new Error("Print content is empty - cannot send print job")
    }
    
    const authHeader = Buffer.from(`${eatabitSid}:${eatabitToken}`).toString("base64")
    const externalId = orderType === "catering" ? cateringOrderId : orderId
    
    // Validate externalId exists and is not empty
    if (!externalId || externalId.trim() === "") {
      throw new Error("Order ID is empty - cannot send print job")
    }
    
    // Generate slug - ensure it's not empty after processing
    const slug = externalId.replace(/-/g, "").substring(0, 15)
    if (!slug || slug.length === 0) {
      throw new Error(`Invalid order ID format - slug would be empty: ${externalId}`)
    }
    
    const statusUrl = process.env.NEXT_PUBLIC_BASE_URL 
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/eatabit/webhook`
      : process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL.startsWith("http") ? process.env.NEXT_PUBLIC_APP_URL : `https://${process.env.NEXT_PUBLIC_APP_URL}`}/api/eatabit/webhook`
        : null
    
    // Log the payload being sent for debugging
    console.log("[Eatabit] Sending print job:", {
      printerId,
      slug,
      externalId,
      bodyLength: ticketBody.length,
      hasStatusUrl: !!statusUrl
    })
    
    const eatabitResponse = await fetch(EATABIT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.api+json",
        "Accept": "application/vnd.api+json",
        "Authorization": `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        data: {
          type: "jobs",
          attributes: {
            body: ticketBody,
            quantity: 1,
            external_id: externalId,
            slug: ("ORD-" + externalId.slice(0, 10)).slice(0, 15),
            status_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/eatabit/status-callback`,
          },
          relationships: {
            printers: {
              data: {
                type: "printers",
                id: printerId,
              },
            },
          },
        },
      }),
    })
    
    const responseText = await eatabitResponse.text()
    let eatabitData: any
    try {
      eatabitData = JSON.parse(responseText)
    } catch {
      console.error("Eatabit API returned invalid JSON:", responseText.substring(0, 500))
      return NextResponse.json({ 
        success: false,
        error: `Eatabit API returned invalid response: ${responseText.substring(0, 200)}`,
        orderType,
        orderId: externalId
      }, { status: 500 })
    }
    console.log("[eatabit v8] Response:", JSON.stringify(eatabitData))
    
    if (!eatabitResponse.ok) {
      // Surface EataBit API error explicitly
      const errorMessage = eatabitData.errors?.[0]?.detail || eatabitData.message || eatabitData.error || JSON.stringify(eatabitData)
      console.error("Eatabit API error:", eatabitData)
      return NextResponse.json({ 
        success: false,
        error: `EataBit API Error: ${errorMessage}`,
        eatabitResponse: eatabitData,
        orderType,
        orderId: externalId
      }, { status: 500 })
    }
    
    // Update order with Eatabit job info
    const jobId = eatabitData.data?.id || eatabitData.data?.attributes?.external_id || null
    if (jobId) {
      if (orderType === "catering") {
        // Update catering order
        await supabase
          .from("catering_orders")
          .update({ 
            eatabit_job_id: jobId,
            eatabit_status: "queued"
          })
          .eq("id", cateringOrderId)
      } else {
        // Update delivery order
        await supabase
          .from("orders")
          .update({ 
            eatabit_job_id: jobId,
            eatabit_status: "queued"
          })
          .eq("id", orderId)
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      jobId,
      orderType,
      message: `${orderType === "catering" ? "Catering" : "Delivery"} order sent to printer`
    })
    
  } catch (error) {
    // Surface all errors explicitly - no fallbacks
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("Error printing order:", errorMessage)
    return NextResponse.json({ 
      success: false,
      error: errorMessage 
    }, { status: 500 })
  }
}
