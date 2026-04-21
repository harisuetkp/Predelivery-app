import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    // Internal shared-secret gate — this endpoint is server-to-server only
    const secret = process.env.INTERNAL_NOTIFY_SECRET
    if (!secret) {
      return NextResponse.json(
        { error: "Server misconfigured: INTERNAL_NOTIFY_SECRET missing" },
        { status: 500 }
      )
    }
    const headerSecret = request.headers.get("x-internal-secret")
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { orderData, sessionId, orderId } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Fetch the complete catering order
    const { data: order, error: orderError } = await supabase
      .from("catering_orders")
      .select(`
        *,
        catering_restaurants (
          name,
          logo_url,
          phone
        ),
        catering_branches (
          catering_name,
          address,
          city,
          state,
          phone
        )
      `)
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      throw new Error(`Failed to fetch catering order for notifications: ${orderError?.message}`)
    }

    const customerEmail = order.customer_email
    const restaurantName = order.catering_restaurants?.name || "Restaurant"

    // Send customer confirmation email via Resend
    if (customerEmail && process.env.RESEND_API_KEY) {
      await sendCateringConfirmationEmail({
        to: customerEmail,
        customerName: order.customer_name || "Cliente",
        orderNumber: order.order_number,
        restaurantName,
        eventDate: order.event_date,
        eventTime: order.event_time,
        total: order.total,
        deliveryType: order.delivery_type,
        deliveryAddress: order.delivery_address
          ? `${order.delivery_address}, ${order.delivery_city}`
          : null,
        specialInstructions: order.special_instructions,
      })
    }

    // Log notification sent
    console.log(`[catering/notifications] Sent confirmation for order ${order.order_number}`)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("[catering/send-notifications] Error:", error)
    // Do not throw — notifications failing should not break the order flow
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function sendCateringConfirmationEmail({
  to,
  customerName,
  orderNumber,
  restaurantName,
  eventDate,
  eventTime,
  total,
  deliveryType,
  deliveryAddress,
  specialInstructions,
}: {
  to: string
  customerName: string
  orderNumber: string
  restaurantName: string
  eventDate: string | null
  eventTime: string | null
  total: number
  deliveryType: string
  deliveryAddress: string | null
  specialInstructions: string | null
}) {
  if (!process.env.RESEND_API_KEY) return

  const formattedDate = eventDate
    ? new Intl.DateTimeFormat("es-PR", {
        timeZone: "America/Puerto_Rico",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(eventDate))
    : null

  const deliveryLabel = deliveryType === "delivery" ? "Entrega" : "Recogido"

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: #1e293b; color: white; padding: 24px; text-align: center; }
        .content { padding: 24px; }
        .order-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
        .value { font-size: 16px; font-weight: 600; color: #1e293b; }
        .total { font-size: 24px; font-weight: 700; color: #1e293b; }
        .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin:0">¡Pedido Confirmado!</h1>
        <p style="margin:8px 0 0">${restaurantName} Catering</p>
      </div>
      <div class="content">
        <p>Hola ${customerName},</p>
        <p>Tu pedido de catering ha sido confirmado. Aquí están los detalles:</p>

        <div class="order-box">
          <div class="label">Número de Orden</div>
          <div class="value">${orderNumber}</div>
        </div>

        ${formattedDate ? `
        <div class="order-box">
          <div class="label">Fecha de ${deliveryLabel}</div>
          <div class="value">${formattedDate}${eventTime ? ` a las ${eventTime}` : ""}</div>
        </div>
        ` : ""}

        <div class="order-box">
          <div class="label">Tipo de Servicio</div>
          <div class="value">${deliveryLabel}</div>
          ${deliveryAddress ? `<div style="color:#64748b;font-size:14px;margin-top:4px">${deliveryAddress}</div>` : ""}
        </div>

        ${specialInstructions ? `
        <div class="order-box">
          <div class="label">Instrucciones Especiales</div>
          <div class="value" style="font-weight:normal;font-size:14px">${specialInstructions}</div>
        </div>
        ` : ""}

        <div class="order-box" style="text-align:center">
          <div class="label">Total</div>
          <div class="total">$${Number(total).toFixed(2)}</div>
        </div>

        <p>Si tienes preguntas sobre tu pedido, contáctanos directamente.</p>
        <p>¡Gracias por elegir ${restaurantName}!</p>
      </div>
      <div class="footer">
        <p>Este es un correo automático. Por favor no respondas a este mensaje.</p>
      </div>
    </body>
    </html>
  `

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "FoodNetPR Catering <catering@foodnetpr.com>",
      to: [to],
      subject: `¡Pedido Confirmado! ${orderNumber} - ${restaurantName} Catering`,
      html,
    }),
  })
}
