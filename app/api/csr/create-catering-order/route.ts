import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { resolveCateringRouting } from "@/lib/catering/branch-settings"

// Lazy initialization to avoid build-time errors when RESEND_API_KEY is not set
function getResend(): Resend | null {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
}

interface CateringOrderItem {
  menuItemId: string
  name: string
  quantity: number
  unitPrice: number
  sellingUnit: string
  totalPrice: number
  sizeId?: string
  sizeName?: string
  serves?: string
  options?: Record<string, any>
}

interface CreateCateringOrderRequest {
  cateringRestaurantId: string
  branchId: string | null
  customerName: string
  customerPhone: string
  customerEmail: string
  deliveryType: "delivery" | "pickup"
  deliveryAddress?: string
  deliveryCity?: string
  deliveryState?: string
  deliveryZip?: string
  eventDate: string // YYYY-MM-DD
  eventTime: string // HH:MM
  guestCount?: number
  servicePackageId?: string | null
  items: CateringOrderItem[]
  subtotal: number
  taxAmount: number
  deliveryFee: number
  dispatchFee?: number
  containerFees?: number
  servicePackageFee?: number
  total: number
  specialInstructions?: string
  paymentMethod: string
  operatorId?: string
}

/**
 * POST /api/csr/create-catering-order
 * Creates a catering order in the catering_orders table.
 * order_source is set to 'phone' for CSR phone orders.
 * Sends confirmation email via Resend.
 */
export async function POST(request: NextRequest) {
  const body: CreateCateringOrderRequest = await request.json()

  // Validate required fields
  if (!body.cateringRestaurantId) {
    return NextResponse.json({ error: "cateringRestaurantId is required" }, { status: 400 })
  }
  if (!body.customerName) {
    return NextResponse.json({ error: "customerName is required" }, { status: 400 })
  }
  if (!body.customerPhone) {
    return NextResponse.json({ error: "customerPhone is required" }, { status: 400 })
  }
  if (!body.deliveryType) {
    return NextResponse.json({ error: "deliveryType is required" }, { status: 400 })
  }
  if (body.deliveryType === "delivery" && !body.deliveryAddress) {
    return NextResponse.json({ error: "deliveryAddress is required for delivery orders" }, { status: 400 })
  }
  if (!body.eventDate) {
    return NextResponse.json({ error: "eventDate is required" }, { status: 400 })
  }
  if (!body.eventTime) {
    return NextResponse.json({ error: "eventTime is required" }, { status: 400 })
  }
  if (!body.items || body.items.length === 0) {
    return NextResponse.json({ error: "At least one menu item is required" }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch the catering restaurant to get operator_id
  const { data: cateringRestaurant, error: cateringRestaurantError } = await supabase
    .from("catering_restaurants")
    .select("id, name, operator_id, tax_rate")
    .eq("id", body.cateringRestaurantId)
    .single()

  if (cateringRestaurantError || !cateringRestaurant) {
    return NextResponse.json(
      { error: `Failed to fetch catering restaurant: ${cateringRestaurantError?.message || "not found"}` },
      { status: 500 }
    )
  }

  // Generate order number for catering
  const orderNumber = `CAT-${Date.now().toString(36).toUpperCase()}`

  // Combine event date and time into scheduled_for timestamp
  const scheduledFor = new Date(`${body.eventDate}T${body.eventTime}:00`)

  // ============================================================
  // Main Dispatch routing — resolve BEFORE insert so the order row is
  // pinned to the producing branch. CSR manual phone orders follow the
  // same rule as online orders: if the intake branch redirects to a hub,
  // the order is created on the hub's branch so the hub owns dispatch
  // and billing. Policy: catering payment always credits the producing
  // branch (even when the CSR is collecting cash/ATH on the phone).
  // ============================================================
  let resolvedBranchId: string | null = body.branchId || null
  if (resolvedBranchId) {
    const routing = await resolveCateringRouting(resolvedBranchId)
    if (routing?.wasRedirected) {
      resolvedBranchId = routing.producingBranchId
    }
  }

  // Create order in catering_orders table
  const { data: order, error: orderError } = await supabase
    .from("catering_orders")
    .insert({
      catering_restaurant_id: body.cateringRestaurantId,
      catering_branch_id: resolvedBranchId,
      customer_name: body.customerName,
      customer_phone: body.customerPhone,
      customer_email: body.customerEmail || null,
      order_type: "catering",
      delivery_type: body.deliveryType,
      scheduled_for: scheduledFor.toISOString(),
      delivery_address: body.deliveryAddress || null,
      delivery_city: body.deliveryCity || null,
      delivery_state: body.deliveryState || "PR",
      delivery_zip: body.deliveryZip || null,
      subtotal: body.subtotal,
      delivery_fee: body.deliveryFee || 0,
      service_package_fee: body.servicePackageFee || 0,
      container_fees: body.containerFees || 0,
      tax: body.taxAmount,
      total: body.total,
      service_package_id: body.servicePackageId || null,
      status: "pending",
      payment_method: body.paymentMethod,
      payment_status: body.paymentMethod === "CASH" ? "pending" : "pending",
      notes: body.specialInstructions || null,
      operator_id: cateringRestaurant.operator_id || body.operatorId || null,
      order_number: orderNumber,
      order_source: "phone",
      guest_count: body.guestCount || null,
      dispatch_fee: body.dispatchFee || 0,
    })
    .select()
    .single()

  if (orderError || !order) {
    return NextResponse.json(
      { error: `Failed to create catering order: ${orderError?.message || "unknown error"}` },
      { status: 500 }
    )
  }

  // Create order items in catering_order_items table
  const orderItems = body.items.map((item) => ({
    catering_order_id: order.id,
    catering_menu_item_id: item.menuItemId,
    catering_item_size_id: item.sizeId || null,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    size_name: item.sizeName || null,
    serves: item.serves || null,
    selling_unit: item.sellingUnit,
    options: item.options ? JSON.stringify(item.options) : null,
    subtotal: item.totalPrice,
  }))

  const { error: itemsError } = await supabase
    .from("catering_order_items")
    .insert(orderItems)

  if (itemsError) {
    // Rollback: delete the order if items failed
    await supabase.from("catering_orders").delete().eq("id", order.id)
    return NextResponse.json(
      { error: `Failed to create catering order items: ${itemsError.message}` },
      { status: 500 }
    )
  }

  // Send confirmation email via Resend
  const resend = getResend()
  if (resend && body.customerEmail) {
    try {
      const formattedDate = new Intl.DateTimeFormat("es-PR", {
        timeZone: "America/Puerto_Rico",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(scheduledFor)
      const formattedTime = new Intl.DateTimeFormat("es-PR", {
        timeZone: "America/Puerto_Rico",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(scheduledFor)

      // Send immediate confirmation email
      await resend.emails.send({
        from: "Catering <noreply@ordenapr.com>",
        to: body.customerEmail,
        subject: `Confirmacion de Orden de Catering #${orderNumber}`,
        html: `
          <h1>Gracias por tu orden de catering!</h1>
          <p><strong>Orden #:</strong> ${orderNumber}</p>
          <p><strong>Restaurante:</strong> ${cateringRestaurant.name}</p>
          <p><strong>Fecha de ${body.deliveryType === "delivery" ? "Entrega" : "Recogido"}:</strong> ${formattedDate}</p>
          <p><strong>Hora de ${body.deliveryType === "delivery" ? "Entrega" : "Recogido"}:</strong> ${formattedTime}</p>
          ${body.deliveryType === "delivery" ? `<p><strong>Direccion:</strong> ${body.deliveryAddress}</p>` : `<p><strong>Tipo:</strong> Recogido en restaurante</p>`}
          ${body.guestCount ? `<p><strong>Invitados:</strong> ${body.guestCount}</p>` : ""}
          <p><strong>Total:</strong> $${body.total.toFixed(2)}</p>
          <hr />
          <h2>Items:</h2>
          <ul>
            ${body.items.map((item) => `<li>${item.quantity}x ${item.name} - $${item.totalPrice.toFixed(2)}</li>`).join("")}
          </ul>
          <p><strong>Subtotal:</strong> $${body.subtotal.toFixed(2)}</p>
          <p><strong>IVU:</strong> $${body.taxAmount.toFixed(2)}</p>
          ${body.deliveryFee > 0 ? `<p><strong>Cargo de entrega:</strong> $${body.deliveryFee.toFixed(2)}</p>` : ""}
          ${body.dispatchFee && body.dispatchFee > 0 ? `<p><strong>Dispatch Fee:</strong> $${body.dispatchFee.toFixed(2)}</p>` : ""}
          <p><strong>Total:</strong> $${body.total.toFixed(2)}</p>
          <hr />
          <p><em>Orden tomada por telefono - CSR Portal</em></p>
        `,
      })

      // Schedule 24-hour reminder email
      const reminder24h = new Date(scheduledFor.getTime() - 24 * 60 * 60 * 1000)
      if (reminder24h > new Date()) {
        await resend.emails.send({
          from: "Catering <noreply@ordenapr.com>",
          to: body.customerEmail,
          subject: `Recordatorio: Tu orden de catering es manana - #${orderNumber}`,
          html: `
            <h1>Recordatorio de tu orden de catering</h1>
            <p>Tu orden de catering esta programada para manana.</p>
            <p><strong>Orden #:</strong> ${orderNumber}</p>
            <p><strong>Restaurante:</strong> ${cateringRestaurant.name}</p>
            <p><strong>Fecha:</strong> ${formattedDate}</p>
            <p><strong>Hora:</strong> ${formattedTime}</p>
            ${body.deliveryType === "delivery" ? `<p><strong>Direccion:</strong> ${body.deliveryAddress}</p>` : ""}
          `,
          scheduledAt: reminder24h.toISOString(),
        })
      }
    } catch (emailError) {
      // Log email error but don't fail the order
      console.error("[CSR Catering] Email send error:", emailError)
    }
  }

  return NextResponse.json({
    success: true,
    orderId: order.id,
    orderNumber,
  })
}
