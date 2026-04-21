import { Resend } from "resend"
import { createClient } from "@/lib/supabase/server"
import { renderTemplate, formatMoney } from "./render-template"

type TemplateKey = "delivery_confirmation"

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
}

async function loadDeliveryTemplate(operatorId: string): Promise<EmailTemplateRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("email_templates")
    .select("subject, html_body, from_name, reply_to")
    .eq("operator_id", operatorId)
    .eq("template_key", "delivery_confirmation" satisfies TemplateKey)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    throw new Error(
      `[email:delivery_confirmation] email_templates lookup failed for operator ${operatorId}: ${error.message}`
    )
  }
  if (!data) {
    throw new Error(
      `[email:delivery_confirmation] no active default template for operator ${operatorId}`
    )
  }
  if (!data.html_body || !data.subject) {
    throw new Error(
      `[email:delivery_confirmation] template for operator ${operatorId} is missing html_body or subject`
    )
  }
  return data as EmailTemplateRow
}

/**
 * Fetch the full restaurant row for brand/logo/operator data. Throws if the
 * row does not exist — callers must provide a valid restaurant_id path.
 */
async function enrichRestaurant(order: any, restaurant: any): Promise<any> {
  if (restaurant?.logo_url && restaurant?.primary_color && restaurant?.operator_id) {
    return restaurant
  }
  const restaurantId =
    order?.restaurant_id ?? order?.restaurantId ?? restaurant?.id
  if (!restaurantId) {
    throw new Error(
      "[email:delivery_confirmation] restaurant_id could not be resolved from order or restaurant arg"
    )
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, logo_url, primary_color, operator_id, phone, address, city, state")
    .eq("id", restaurantId)
    .maybeSingle()
  if (error) {
    throw new Error(
      `[email:delivery_confirmation] restaurants lookup failed for ${restaurantId}: ${error.message}`
    )
  }
  if (!data) {
    throw new Error(
      `[email:delivery_confirmation] restaurant ${restaurantId} not found`
    )
  }
  return { ...(restaurant ?? {}), ...data }
}

/**
 * Ensure we have an items array. If the order object doesn't carry one inline,
 * fetch from order_items. Throws if the order has no id (we can't recover).
 */
async function enrichOrderItems(order: any): Promise<OrderItemRow[]> {
  const inline =
    order?.items ??
    order?.order_items ??
    order?.orderItems ??
    order?.cart
  if (Array.isArray(inline) && inline.length > 0) {
    return inline as OrderItemRow[]
  }
  const orderId = order?.id ?? order?.order_id
  if (!orderId) {
    throw new Error(
      "[email:delivery_confirmation] order has no items inline and no id to fetch them"
    )
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("order_items")
    .select("item_name, quantity, unit_price, total_price, selected_options")
    .eq("order_id", orderId)
  if (error) {
    throw new Error(
      `[email:delivery_confirmation] order_items lookup failed for ${orderId}: ${error.message}`
    )
  }
  if (!data || data.length === 0) {
    throw new Error(
      `[email:delivery_confirmation] order ${orderId} has no line items`
    )
  }
  return data as OrderItemRow[]
}

function getServiceTypeLabel(order: any): string {
  const t = String(order?.delivery_type ?? order?.orderType ?? "").toLowerCase()
  if (t === "delivery" || t === "entrega") return "Entrega a domicilio"
  return "Recogido"
}

function buildVars(order: any, restaurant: any, items: OrderItemRow[]): Record<string, unknown> {
  const serviceType = getServiceTypeLabel(order)
  const isDelivery = serviceType === "Entrega a domicilio"

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

/**
 * Returns the raw delivery_confirmation template rendered with placeholder
 * values — for super-admin preview / seeding only. Live order sends go through
 * sendOrderConfirmation which renders real data.
 */
export async function buildSeedDeliveryConfirmationHtml(operatorId: string): Promise<string> {
  const tpl = await loadDeliveryTemplate(operatorId)
  const seedVars = {
    restaurant_name: "[RESTAURANTE]",
    order_number: "[NUMERO_ORDEN]",
    service_type: "Entrega a domicilio",
    delivery_address: "[DIRECCION]",
    subtotal: formatMoney(35),
    delivery_fee: formatMoney(5),
    dispatch_fee: formatMoney(0),
    tax: formatMoney(3.11),
    tip: formatMoney(5),
    total: formatMoney(48.11),
    items: [
      { name: "[ITEM_1]", qty: "2", price: formatMoney(12.5), line_total: formatMoney(25) },
      { name: "[ITEM_2]", qty: "1", price: formatMoney(10), line_total: formatMoney(10) },
    ],
  }
  return renderTemplate(tpl.html_body, seedVars)
}

/**
 * Send the order confirmation email. All error paths throw — callers that do
 * not want email failures to block order processing MUST attach an explicit
 * `.catch((err) => ...)` that logs / alerts on failure.
 */
export async function sendOrderConfirmation(order: any, restaurant: any): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("[email:delivery_confirmation] RESEND_API_KEY is not set")
  }
  const to = order?.customer_email
  if (!to) {
    throw new Error("[email:delivery_confirmation] order.customer_email is required")
  }

  const enrichedRestaurant = await enrichRestaurant(order, restaurant)
  const items = await enrichOrderItems(order)

  const operatorId = (order?.operator_id ?? enrichedRestaurant?.operator_id) as string | undefined
  if (!operatorId) {
    throw new Error(
      "[email:delivery_confirmation] operator_id could not be resolved from order or restaurant"
    )
  }

  const tpl = await loadDeliveryTemplate(operatorId)
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
      `[email:delivery_confirmation] Resend API returned error: ${JSON.stringify(error)}`
    )
  }
}
