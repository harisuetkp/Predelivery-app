import { Resend } from "resend"
import { createClient } from "@/lib/supabase/server"
import { renderTemplate } from "./render-template"

type TemplateKey = "welcome"

type EmailTemplateRow = {
  subject: string
  html_body: string
  from_name: string | null
  reply_to: string | null
}

/**
 * Load the single active default welcome template for an operator.
 * Throws loudly if the template is missing/inactive/not default — per the
 * project-wide NO FALLBACKS rule. Callers should not attempt to recover.
 */
async function loadWelcomeTemplate(operatorId: string): Promise<EmailTemplateRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("email_templates")
    .select("subject, html_body, from_name, reply_to")
    .eq("operator_id", operatorId)
    .eq("template_key", "welcome" satisfies TemplateKey)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    throw new Error(
      `[email:welcome] email_templates lookup failed for operator ${operatorId}: ${error.message}`
    )
  }
  if (!data) {
    throw new Error(
      `[email:welcome] no active default template for operator ${operatorId} (template_key=welcome, is_default=true, is_active=true)`
    )
  }
  if (!data.html_body || !data.subject) {
    throw new Error(
      `[email:welcome] template for operator ${operatorId} is missing html_body or subject`
    )
  }
  return data as EmailTemplateRow
}

/**
 * Returns the raw welcome template HTML as stored in DB for the given operator.
 * Used by super-admin preview UIs and by seed / migration scripts. Substitutes
 * a placeholder name so the preview renders as a complete email.
 */
export async function buildSeedWelcomeHtml(operatorId: string): Promise<string> {
  const tpl = await loadWelcomeTemplate(operatorId)
  return renderTemplate(tpl.html_body, { customer_name: "[NOMBRE_CLIENTE]" })
}

/**
 * Send the welcome email. All error paths throw — callers that do not want
 * email failures to block their flow MUST attach an explicit `.catch(err => ...)`
 * that logs / alerts on failure. A caught error must NEVER be swallowed silently.
 */
export async function sendWelcomeEmail(
  customerEmail: string,
  customerName: string,
  operatorId: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("[email:welcome] RESEND_API_KEY is not set")
  }
  if (!customerEmail) {
    throw new Error("[email:welcome] customerEmail is required")
  }
  if (!operatorId) {
    throw new Error("[email:welcome] operatorId is required")
  }

  const tpl = await loadWelcomeTemplate(operatorId)

  const vars: Record<string, unknown> = {
    customer_name: customerName && customerName.trim().length > 0 ? customerName : "¡Bienvenido!",
  }

  const html = renderTemplate(tpl.html_body, vars)
  const subject = renderTemplate(tpl.subject, vars)
  const fromName = tpl.from_name || "PR Delivery"
  const replyTo = tpl.reply_to || undefined

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: `${fromName} <noreply@prdelivery.com>`,
    to: customerEmail,
    subject,
    html,
    replyTo,
  })
  if (error) {
    throw new Error(
      `[email:welcome] Resend API returned error: ${JSON.stringify(error)}`
    )
  }
}
