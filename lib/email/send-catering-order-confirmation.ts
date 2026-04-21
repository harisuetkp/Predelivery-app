import { Resend } from "resend"
import { createClient } from "@/lib/supabase/server"
import { renderTemplate, formatMoney } from "./render-template"

type TemplateKey = "catering_confirmation"

type EmailTemplateRow = {
  subject: string
  html_body: string
  from_name: string | null
  reply_to: string | null
}

type OrderItemRow = {
  item_name: string | null
  quantity: number | string | null
  unit_price: number | string | null
  total_price: number | string | null
  selected_options?: unknown
  size_name?: string | null
}

async function loadCateringTemplate(operatorId: string): Promise<EmailTemplateRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("email_templates")
    .select("subject, html_body, from_name, reply_to")
    .eq("operator_id", operatorId)
    .eq("template_key", "catering_confirmation" satisfies TemplateKey)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    throw new Error(
      `[email:catering_confirmation] email_templates lookup failed for operator ${operatorId}: ${error.message}`
    )
  }
  if (!data) {
    throw new Error(
      `[email:catering_confirmation] no active default template for operator ${operatorId}`
    )
  }
  if (!data.html_body || !data.subject) {
    throw new Error(
      `[email:catering_confirmation] template for operator ${operatorId} is missing html_body or subject`
    )
  }
  return data as EmailTemplateRow
}

async function enrichCateringRestaurant(order: any, restaurant: any): Promise<any> {
  if (restaurant?.logo_url && restaurant?.primary_color && restaurant?.operator_id) {
    return restaurant
  }
  const restaurantId =
    order?.catering_restaurant_id ?? order?.restaurant_id ?? order?.restaurantId ?? restaurant?.id
  if (!restaurantId) {
    throw new Error(
      "[email:catering_confirmation] catering restaurant id could not be resolved"
    )
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_restaurants")
    .select("id, name, logo_url, primary_color, operator_id")
    .eq("id", restaurantId)
    .maybeSingle()
  if (error) {
    throw new Error(
      `[email:catering_confirmation] catering_restaurants lookup failed for ${restaurantId}: ${error.message}`
    )
  }
  if (!data) {
    throw new Error(
      `[email:catering_confirmation] catering restaurant ${restaurantId} not found`
    )
  }
  return { ...(restaurant ?? {}), ...data }
}

async function enrichCateringOrderItems(order: any): Promise<OrderItemRow[]> {
  const inline =
    order?.items ??
    order?.order_items ??
    order?.orderItems ??
    order?.cart
  if (Array.isArray(inline) && inline.length > 0) {
    return inline as OrderItemRow[]
  }
  const orderId = order?.id ?? order?.catering_order_id
  if (!orderId) {
    throw new Error(
      "[email:catering_confirmation] order has no items inline and no id to fetch them"
    )
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_order_items")
    .select("item_name, quantity, unit_price, total_price, selected_options, size_name")
    .eq("catering_order_id", orderId)
  if (error) {
    throw new Error(
      `[email:catering_confirmation] catering_order_items lookup failed for ${orderId}: ${error.message}`
    )
  }
  if (!data || data.length === 0) {
    throw new Error(
      `[email:catering_confirmation] catering order ${orderId} has no line items`
    )
  }
  return data as OrderItemRow[]
}

function getServiceTypeLabel(order: any): string {
  const t = String(order?.service_type ?? order?.delivery_type ?? "").toLowerCase()
  if (t === "delivery" || t === "entrega") return "Entrega"
  return "Recogido"
}

function buildVars(order: any, restaurant: any, items: OrderItemRow[]): Record<string, unknown> {
  const serviceType = getServiceTypeLabel(order)
  const isDelivery = serviceType === "Entrega"

  const addressParts = [
    order?.delivery_address ?? order?.eventDetails?.address,
    order?.delivery_city ?? order?.eventDetails?.city,
    order?.delivery_state ?? order?.eventDetails?.state,
    order?.delivery_zip ?? order?.eventDetails?.zip,
  ].filter((p) => p != null && String(p).trim().length > 0)
  const addressLine = addressParts.join(", ")

  const renderedItems = items.map((item) => {
    const qty = Number(item.quantity) || 1
    const name = item.item_name ?? "Artículo"
    const unit = Number(item.unit_price ?? 0)
    const lineTotal = Number(item.total_price ?? unit * qty)
    return {
      name,
      qty: String(qty),
      price: formatMoney(unit),
      line_total: formatMoney(lineTotal),
    }
  })

  return {
    restaurant_name: String(restaurant?.name ?? "PR Delivery"),
    order_number: String(order?.order_number ?? order?.orderNumber ?? ""),
    event_date: String(order?.event_date ?? order?.eventDetails?.eventDate ?? ""),
    event_time: String(order?.event_time ?? order?.eventDetails?.eventTime ?? ""),
    service_type: serviceType,
    delivery_address: isDelivery && addressLine ? addressLine : "Recogido en restaurante",
    subtotal: formatMoney(order?.subtotal ?? 0),
    delivery_fee: formatMoney(order?.delivery_fee ?? order?.deliveryFee ?? 0),
    dispatch_fee: formatMoney(order?.dispatch_fee ?? order?.dispatchFee ?? 0),
    tax: formatMoney(order?.tax ?? 0),
    tip: formatMoney(order?.tip ?? 0),
    total: formatMoney(order?.total ?? 0),
    items: renderedItems,
  }
}

export async function buildSeedCateringConfirmationHtml(operatorId: string): Promise<string> {
  const tpl = await loadCateringTemplate(operatorId)
  const seedVars = {
    restaurant_name: "[RESTAURANTE]",
    order_number: "[NUMERO_ORDEN]",
    event_date: "[FECHA_EVENTO]",
    event_time: "[HORA_EVENTO]",
    service_type: "Entrega",
    delivery_address: "[DIRECCION]",
    subtotal: formatMoney(120),
    delivery_fee: formatMoney(10),
    dispatch_fee: formatMoney(0),
    tax: formatMoney(10.66),
    tip: formatMoney(0),
    total: formatMoney(140.66),
    items: [
      { name: "[ITEM_1]", qty: "10", price: formatMoney(10), line_total: formatMoney(100) },
      { name: "[ITEM_2]", qty: "1", price: formatMoney(20), line_total: formatMoney(20) },
    ],
  }
  return renderTemplate(tpl.html_body, seedVars)
}

export async function sendCateringOrderConfirmation(order: any, restaurant: any): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("[email:catering_confirmation] RESEND_API_KEY is not set")
  }
  const to = order?.customer_email
  if (!to) {
    throw new Error("[email:catering_confirmation] order.customer_email is required")
  }

  const enrichedRestaurant = await enrichCateringRestaurant(order, restaurant)
  const items = await enrichCateringOrderItems(order)

  const operatorId = (order?.operator_id ?? enrichedRestaurant?.operator_id) as string | undefined
  if (!operatorId) {
    throw new Error(
      "[email:catering_confirmation] operator_id could not be resolved from order or restaurant"
    )
  }

  const tpl = await loadCateringTemplate(operatorId)
  const vars = buildVars(order, enrichedRestaurant, items)
  const html = renderTemplate(tpl.html_body, vars)
  const subject = renderTemplate(tpl.subject, vars)
  const fromName = tpl.from_name || enrichedRestaurant?.name || "PR Delivery"
  const replyTo = tpl.reply_to || undefined

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: `${fromName} <noreply@prdelivery.com>`,
    to,
    subject,
    html,
    replyTo,
  })
  if (error) {
    throw new Error(
      `[email:catering_confirmation] Resend API returned error: ${JSON.stringify(error)}`
    )
  }
}
