"use server"

import { createClient } from "@/lib/supabase/server"
import { Resend } from "resend"

export type EmailTemplateKey =
  | "delivery_confirmation"
  | "catering_confirmation"
  | "welcome"

export type EmailTemplateRow = {
  id?: string
  operator_id: string
  template_key: EmailTemplateKey
  template_name: string
  subject: string
  html_body: string
  from_name: string | null
  reply_to: string | null
  is_active: boolean
  is_default: boolean
}

export async function saveEmailTemplate(data: EmailTemplateRow) {
  const supabase = await createClient()

  const { data: saved, error } = await supabase
    .from("email_templates")
    .upsert(data, { onConflict: "id" })
    .select("*")
    .single()

  if (error) {
    console.error("[communications] saveEmailTemplate failed:", error)
    throw new Error(error.message)
  }

  return saved
}

export async function deleteEmailTemplate(id: string, operatorId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", id)
    .eq("operator_id", operatorId)

  if (error) {
    console.error("[communications] deleteEmailTemplate failed:", error)
    throw new Error(error.message)
  }
}

export async function setDefaultTemplate(
  id: string,
  operatorId: string,
  templateKey: EmailTemplateKey
) {
  const supabase = await createClient()

  const { error: clearError } = await supabase
    .from("email_templates")
    .update({ is_default: false })
    .eq("operator_id", operatorId)
    .eq("template_key", templateKey)

  if (clearError) {
    console.error("[communications] setDefaultTemplate(clear) failed:", clearError)
    throw new Error(clearError.message)
  }

  const { data: updated, error: setError } = await supabase
    .from("email_templates")
    .update({ is_default: true })
    .eq("id", id)
    .eq("operator_id", operatorId)
    .select("*")
    .single()

  if (setError) {
    console.error("[communications] setDefaultTemplate(set) failed:", setError)
    throw new Error(setError.message)
  }

  return updated
}

export async function sendTestEmail(
  templateId: string,
  testEmail: string,
  operatorId: string
) {
  const supabase = await createClient()

  const { data: template, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", templateId)
    .eq("operator_id", operatorId)
    .single()

  if (error || !template) {
    console.error("[communications] sendTestEmail template fetch failed:", error)
    throw new Error("Template not found")
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY missing")
  }

  const resend = new Resend(apiKey)
  await resend.emails.send({
    from: `${template.from_name || "PR Delivery"} <noreply@prdelivery.com>`,
    to: testEmail,
    subject: template.subject,
    html: template.html_body,
    replyTo: template.reply_to || undefined,
  })
}

export async function seedDefaultTemplates(operatorId: string) {
  const supabase = await createClient()

  const brandPink = "#e91e8c"
  const baseCss = `
    body { margin:0; padding:0; background:#f6f7f9; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111827; }
    .wrapper { width:100%; padding:24px 12px; }
    .container { max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; overflow:hidden; }
    .brand { padding:18px 22px; border-bottom:1px solid #f1f5f9; }
    .brand-title { font-size:16px; font-weight:900; letter-spacing:0.5px; color:${brandPink}; }
    .content { padding:18px 22px; }
    .h1 { font-size:22px; font-weight:900; margin:0; line-height:1.2; color:#0f172a; }
    .sub { margin-top:8px; font-size:14px; color:#475569; line-height:1.5; }
    .card { margin-top:14px; border:1px solid #e5e7eb; border-radius:12px; padding:14px; background:#ffffff; }
    .row { display:flex; justify-content:space-between; gap:12px; font-size:13px; color:#334155; padding:6px 0; }
    .row strong { color:#0f172a; }
    .divider { height:1px; background:#eef2f7; margin:10px 0; }
    .table { width:100%; border-collapse:collapse; margin-top:10px; }
    .th { text-align:left; font-size:12px; color:#64748b; font-weight:700; padding:10px 0; border-bottom:1px solid #eef2f7; }
    .td { font-size:13px; color:#0f172a; padding:10px 0; border-bottom:1px solid #f1f5f9; vertical-align:top; }
    .muted { color:#64748b; font-size:12px; }
    .right { text-align:right; white-space:nowrap; }
    .total { font-weight:900; font-size:14px; }
    .btn { display:inline-block; margin-top:14px; background:${brandPink}; color:#ffffff !important; text-decoration:none; font-weight:800; padding:12px 16px; border-radius:10px; }
    .footer { padding:16px 22px; background:#fafafa; border-top:1px solid #f1f5f9; font-size:12px; color:#64748b; }
    .footer a { color:#64748b; text-decoration:underline; }
    @media (max-width: 620px) {
      .wrapper { padding:16px 10px; }
      .content, .brand, .footer { padding-left:16px; padding-right:16px; }
      .h1 { font-size:20px; }
    }
  `

  const deliveryHtml = `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Confirmación de Orden</title>
      <style>${baseCss}</style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="brand">
            <div class="brand-title">PR DELIVERY</div>
          </div>
          <div class="content">
            <h1 class="h1">Tu orden ha sido confirmada</h1>
            <div class="sub">
              Gracias por ordenar en <strong>{{restaurant_name}}</strong>. Estamos preparando tu orden.
            </div>

            <div class="card">
              <div class="row"><span>Número de Orden</span><strong>#{{order_number}}</strong></div>
              <div class="row"><span>Restaurante</span><strong>{{restaurant_name}}</strong></div>
              <div class="row"><span>Tipo</span><strong>{{service_type}}</strong></div>
              <div class="divider"></div>
              <div class="row">
                <span>Dirección</span>
                <strong>{{delivery_address}}</strong>
              </div>
              <div class="muted">Si es recogido, este campo puede mostrar “Recogido en restaurante”.</div>
            </div>

            <table class="table" role="presentation">
              <thead>
                <tr>
                  <th class="th">Artículos</th>
                  <th class="th right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="td">
                    <div><strong>{{items[0].name}}</strong></div>
                    <div class="muted">Cantidad: {{items[0].qty}} · Precio: {{items[0].price}}</div>
                  </td>
                  <td class="td right">{{items[0].line_total}}</td>
                </tr>
                <tr>
                  <td class="td">
                    <div><strong>{{items[1].name}}</strong></div>
                    <div class="muted">Cantidad: {{items[1].qty}} · Precio: {{items[1].price}}</div>
                  </td>
                  <td class="td right">{{items[1].line_total}}</td>
                </tr>
              </tbody>
            </table>

            <div class="card">
              <div class="row"><span>Subtotal</span><strong>{{subtotal}}</strong></div>
              <div class="row"><span>Delivery</span><strong>{{delivery_fee}}</strong></div>
              <div class="row"><span>Dispatch</span><strong>{{dispatch_fee}}</strong></div>
              <div class="row"><span>IVU</span><strong>{{tax}}</strong></div>
              <div class="row"><span>Propina</span><strong>{{tip}}</strong></div>
              <div class="divider"></div>
              <div class="row total"><span>Total</span><strong>{{total}}</strong></div>
            </div>
          </div>
          <div class="footer">
            PR Delivery | <a href="https://prdelivery.com">prdelivery.com</a> | Puerto Rico
          </div>
        </div>
      </div>
    </body>
  </html>`

  const cateringHtml = `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Confirmación de Catering</title>
      <style>${baseCss}</style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="brand">
            <div class="brand-title">PR DELIVERY</div>
          </div>
          <div class="content">
            <h1 class="h1">Tu orden de catering ha sido confirmada</h1>
            <div class="sub">
              ¡Qué emoción! Gracias por elegir <strong>{{restaurant_name}}</strong> para tu evento.
            </div>

            <div class="card">
              <div class="row"><span>Evento</span><strong>{{event_date}} · {{event_time}}</strong></div>
              <div class="row"><span>Servicio</span><strong>{{service_type}}</strong></div>
              <div class="row"><span>Restaurante</span><strong>{{restaurant_name}}</strong></div>
              <div class="divider"></div>
              <div class="row"><span>Dirección (si aplica)</span><strong>{{delivery_address}}</strong></div>
              <div class="muted">Si es recogido, este campo puede estar vacío.</div>
            </div>

            <table class="table" role="presentation">
              <thead>
                <tr>
                  <th class="th">Artículos</th>
                  <th class="th right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="td">
                    <div><strong>{{items[0].name}}</strong></div>
                    <div class="muted">Cantidad: {{items[0].qty}} · Precio: {{items[0].price}}</div>
                  </td>
                  <td class="td right">{{items[0].line_total}}</td>
                </tr>
                <tr>
                  <td class="td">
                    <div><strong>{{items[1].name}}</strong></div>
                    <div class="muted">Cantidad: {{items[1].qty}} · Precio: {{items[1].price}}</div>
                  </td>
                  <td class="td right">{{items[1].line_total}}</td>
                </tr>
              </tbody>
            </table>

            <div class="card">
              <div class="row"><span>Subtotal</span><strong>{{subtotal}}</strong></div>
              <div class="row"><span>Dispatch</span><strong>{{dispatch_fee}}</strong></div>
              <div class="row"><span>IVU</span><strong>{{tax}}</strong></div>
              <div class="row"><span>Propina</span><strong>{{tip}}</strong></div>
              <div class="divider"></div>
              <div class="row total"><span>Total</span><strong>{{total}}</strong></div>
            </div>
          </div>
          <div class="footer">
            PR Delivery | <a href="https://prdelivery.com">prdelivery.com</a> | Puerto Rico
          </div>
        </div>
      </div>
    </body>
  </html>`

  const welcomeHtml = `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Bienvenido</title>
      <style>${baseCss}</style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="brand">
            <div class="brand-title">PR DELIVERY</div>
          </div>
          <div class="content">
            <h1 class="h1">¡Bienvenido a PR Delivery! 🎉</h1>
            <div class="sub">
              Hola <strong>{{customer_name}}</strong>, qué bueno tenerte con nosotros.
            </div>

            <div class="card">
              <div style="font-weight:800;color:#0f172a;margin-bottom:8px;">¿Por qué PR Delivery?</div>
              <div class="row"><span>Variedad</span><strong>Restaurantes para todos los gustos</strong></div>
              <div class="row"><span>Fácil</span><strong>Ordena en minutos, sin complicaciones</strong></div>
              <div class="row"><span>Rápido</span><strong>Entrega ágil en Puerto Rico</strong></div>
            </div>

            <a class="btn" href="https://prdelivery.com">Explorar Restaurantes</a>
          </div>
          <div class="footer">
            PR Delivery | <a href="https://prdelivery.com">prdelivery.com</a> | Puerto Rico
          </div>
        </div>
      </div>
    </body>
  </html>`

  const keys: EmailTemplateKey[] = [
    "delivery_confirmation",
    "catering_confirmation",
    "welcome",
  ]

  const { data: existing, error: existingError } = await supabase
    .from("email_templates")
    .select("template_key")
    .eq("operator_id", operatorId)
    .in("template_key", keys)

  if (existingError) {
    console.error("[communications] seedDefaultTemplates existing lookup failed:", existingError)
    return []
  }

  const existingKeys = new Set<EmailTemplateKey>((existing || []).map((r: any) => r.template_key))
  const toInsert: any[] = []

  if (!existingKeys.has("delivery_confirmation")) {
    toInsert.push({
      operator_id: operatorId,
      template_key: "delivery_confirmation",
      template_name: "Plantilla Base",
      subject: "✅ Tu orden #{{order_number}} ha sido confirmada - {{restaurant_name}}",
      html_body: deliveryHtml,
      from_name: "PR Delivery",
      reply_to: null,
      is_active: true,
      is_default: true,
    })
  }

  if (!existingKeys.has("catering_confirmation")) {
    toInsert.push({
      operator_id: operatorId,
      template_key: "catering_confirmation",
      template_name: "Plantilla Base",
      subject: "✅ Tu orden de catering ha sido confirmada - {{restaurant_name}}",
      html_body: cateringHtml,
      from_name: "PR Delivery",
      reply_to: null,
      is_active: true,
      is_default: true,
    })
  }

  if (!existingKeys.has("welcome")) {
    toInsert.push({
      operator_id: operatorId,
      template_key: "welcome",
      template_name: "Plantilla Base",
      subject: "¡Bienvenido a PR Delivery! 🎉",
      html_body: welcomeHtml,
      from_name: "PR Delivery",
      reply_to: null,
      is_active: true,
      is_default: true,
    })
  }

  if (toInsert.length === 0) return []

  const { data: inserted, error: insertError } = await supabase
    .from("email_templates")
    .insert(toInsert)
    .select("*")

  if (insertError) {
    console.error("[communications] seedDefaultTemplates insert failed:", insertError)
    return []
  }

  return inserted || []
}

