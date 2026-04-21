"use server"

import { createClient } from "@/lib/supabase/server"
import { Resend } from "resend"
import { revalidatePath } from "next/cache"

export type MarketingCampaignRow = {
  id?: string
  operator_id: string
  name: string
  subject: string
  body_html: string
  body_text: string | null
  from_address: string
  audience_filter: Record<string, unknown>
  status?: string
  scheduled_for?: string | null
  created_by?: string | null
}

/**
 * Server actions in Next.js 14 that THROW cause the error boundary to render
 * in production (the "Server Components render" red banner). For user-fixable
 * validation and auth errors, we return a discriminated result instead so the
 * client can show a friendly inline message.
 *
 * Throws are reserved for truly unexpected infra failures that deserve the
 * error boundary (not used here).
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function requireAdminOperator(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; operatorId: string; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  const { data: adminSelf, error } = await supabase
    .from("admin_users")
    .select("operator_id")
    .eq("auth_user_id", user.id)
    .single()

  if (error || !adminSelf?.operator_id) {
    return { ok: false, error: "admin_users record not found for authenticated user" }
  }

  return {
    ok: true,
    supabase,
    operatorId: adminSelf.operator_id as string,
    userId: user.id,
  }
}

export async function saveMarketingCampaign(
  data: MarketingCampaignRow
): Promise<ActionResult<Record<string, unknown>>> {
  const auth = await requireAdminOperator()
  if (!auth.ok) return { ok: false, error: auth.error }
  const { supabase, operatorId, userId } = auth

  if (data.operator_id !== operatorId) {
    return { ok: false, error: "Operator mismatch" }
  }

  if (!data.name?.trim()) return { ok: false, error: "Campaign name is required" }
  if (!data.subject?.trim()) return { ok: false, error: "Subject is required" }
  if (!data.body_html?.trim()) return { ok: false, error: "HTML body is required" }
  if (!data.from_address?.trim()) return { ok: false, error: "From address is required" }

  // Only allow editing while draft; enforce server-side
  if (data.id) {
    const { data: existing, error: fetchErr } = await supabase
      .from("marketing_campaigns")
      .select("status, operator_id")
      .eq("id", data.id)
      .single()
    if (fetchErr || !existing) return { ok: false, error: "Campaign not found" }
    if (existing.operator_id !== operatorId) return { ok: false, error: "Operator mismatch" }
    if (existing.status !== "draft") {
      return { ok: false, error: `Cannot edit a campaign in status '${existing.status}'` }
    }
  }

  const payload: Record<string, unknown> = {
    operator_id: operatorId,
    name: data.name.trim(),
    subject: data.subject.trim(),
    body_html: data.body_html,
    body_text: data.body_text ?? null,
    from_address: data.from_address.trim(),
    audience_filter: data.audience_filter,
    status: "draft",
    created_by: data.created_by ?? userId,
  }
  if (data.id) payload.id = data.id

  const { data: saved, error } = await supabase
    .from("marketing_campaigns")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single()

  if (error) {
    console.error("[marketing] saveMarketingCampaign failed:", error)
    return { ok: false, error: error.message }
  }

  revalidatePath("/super-admin/marketing")
  return { ok: true, data: saved as Record<string, unknown> }
}

export async function deleteMarketingCampaign(
  id: string
): Promise<ActionResult> {
  const auth = await requireAdminOperator()
  if (!auth.ok) return { ok: false, error: auth.error }
  const { supabase, operatorId } = auth

  const { data: existing, error: fetchErr } = await supabase
    .from("marketing_campaigns")
    .select("status, operator_id")
    .eq("id", id)
    .single()
  if (fetchErr || !existing) return { ok: false, error: "Campaign not found" }
  if (existing.operator_id !== operatorId) return { ok: false, error: "Operator mismatch" }
  if (existing.status === "sending") {
    return { ok: false, error: "Cannot delete a campaign while it is sending" }
  }

  const { error } = await supabase
    .from("marketing_campaigns")
    .delete()
    .eq("id", id)
    .eq("operator_id", operatorId)

  if (error) {
    console.error("[marketing] deleteMarketingCampaign failed:", error)
    return { ok: false, error: error.message }
  }

  revalidatePath("/super-admin/marketing")
  return { ok: true, data: undefined }
}

export async function sendTestMarketingEmail(
  campaignId: string,
  testEmail: string
): Promise<ActionResult<{ messageId: string | null }>> {
  const auth = await requireAdminOperator()
  if (!auth.ok) return { ok: false, error: auth.error }
  const { supabase, operatorId } = auth

  if (!testEmail?.trim()) return { ok: false, error: "Test email required" }

  const { data: campaign, error } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("operator_id", operatorId)
    .single()

  if (error || !campaign) return { ok: false, error: "Campaign not found" }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY missing" }

  const resend = new Resend(apiKey)
  const result = await resend.emails.send({
    from: campaign.from_address,
    to: testEmail.trim(),
    subject: `[TEST] ${campaign.subject}`,
    html: campaign.body_html,
    text: campaign.body_text || undefined,
  })

  if ((result as any)?.error) {
    return {
      ok: false,
      error: `Resend error: ${(result as any).error.message || JSON.stringify((result as any).error)}`,
    }
  }

  return { ok: true, data: { messageId: (result as any)?.data?.id ?? null } }
}

/**
 * Snapshot audience into marketing_campaign_sends, then flip the campaign
 * to 'sending' so the cron drains it.
 *
 * Rules (per PLATFORM_CONTEXT):
 * - Platform is currently single-tenant (Operator #1 / FoodNetPR). The
 *   customers table has no operator_id column and there is no
 *   customer_operators junction table yet. Audience = all rows in customers
 *   with a non-null email and email_notifications IS NOT FALSE.
 * - Dedupe on lowercased email — one row per email address.
 * - Additive only: we never modify customers, only insert into campaign_sends.
 *
 * NOTE: If/when the platform becomes multi-operator, this query must be
 * rescoped through a customer_operators link. Do NOT add such a column to
 * customers here — schema changes are out of scope for this flow.
 */
export async function launchMarketingCampaign(
  campaignId: string
): Promise<ActionResult<{ recipientCount: number }>> {
  const auth = await requireAdminOperator()
  if (!auth.ok) return { ok: false, error: auth.error }
  const { supabase, operatorId } = auth

  const { data: campaign, error: fetchErr } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("operator_id", operatorId)
    .single()

  if (fetchErr || !campaign) return { ok: false, error: "Campaign not found" }
  if (campaign.status !== "draft") {
    return { ok: false, error: `Cannot launch a campaign in status '${campaign.status}'` }
  }

  // Pull all customers with a usable email, paginated to respect Supabase
  // row caps (default max is 1000 per request).
  const customers: Array<{ id: string; email: string | null; email_notifications: boolean | null }> = []
  const pageSize = 1000
  let from = 0
  // Safety cap — we expect ~22k customers. If this ever exceeds 500k we
  // should revisit the design, not silently truncate.
  const hardCap = 500_000

  while (from < hardCap) {
    const { data: rows, error: custErr } = await supabase
      .from("customers")
      .select("id, email, email_notifications")
      .not("email", "is", null)
      .neq("email_notifications", false)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)

    if (custErr) {
      console.error("[marketing] customers fetch failed:", custErr)
      return { ok: false, error: custErr.message }
    }
    if (!rows || rows.length === 0) break
    customers.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }

  if (customers.length === 0) {
    return { ok: false, error: "Audience resolved to 0 recipients (no opted-in customers)" }
  }

  // Filter + dedupe
  const seen = new Set<string>()
  const sendRows: Array<{
    campaign_id: string
    customer_id: string
    email: string
    status: string
    attempt_count: number
  }> = []

  for (const c of customers) {
    if (!c.email) continue
    // email_notifications=null is treated as opted-in by default (column is nullable).
    // Only opt-out if explicitly false.
    if (c.email_notifications === false) continue
    const normalized = c.email.trim().toLowerCase()
    if (!normalized) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    sendRows.push({
      campaign_id: campaignId,
      customer_id: c.id,
      email: normalized,
      status: "pending",
      attempt_count: 0,
    })
  }

  if (sendRows.length === 0) {
    return { ok: false, error: "Audience resolved to 0 recipients" }
  }

  // Insert in chunks of 500 to stay within Supabase payload limits
  const insertChunk = 500
  for (let i = 0; i < sendRows.length; i += insertChunk) {
    const chunk = sendRows.slice(i, i + insertChunk)
    const { error: insertErr } = await supabase
      .from("marketing_campaign_sends")
      .insert(chunk)

    if (insertErr) {
      console.error("[marketing] campaign_sends insert failed:", insertErr)
      // Rollback: remove any rows we managed to insert for this campaign so we
      // don't leave a partial snapshot behind.
      await supabase
        .from("marketing_campaign_sends")
        .delete()
        .eq("campaign_id", campaignId)
      return { ok: false, error: insertErr.message }
    }
  }

  // Flip campaign to sending. Use a conditional update on status='draft' so
  // concurrent launches don't double-send.
  const { data: updated, error: flipErr } = await supabase
    .from("marketing_campaigns")
    .update({
      status: "sending",
      started_at: new Date().toISOString(),
      total_recipients: sendRows.length,
    })
    .eq("id", campaignId)
    .eq("status", "draft")
    .select("*")
    .single()

  if (flipErr || !updated) {
    console.error("[marketing] campaign flip to sending failed:", flipErr)
    // Rollback: remove the snapshot so the user can retry cleanly
    await supabase
      .from("marketing_campaign_sends")
      .delete()
      .eq("campaign_id", campaignId)
    return {
      ok: false,
      error: flipErr?.message || "Campaign was no longer in draft state",
    }
  }

  revalidatePath("/super-admin/marketing")
  return { ok: true, data: { recipientCount: sendRows.length } }
}

export async function cancelMarketingCampaign(
  campaignId: string
): Promise<ActionResult> {
  const auth = await requireAdminOperator()
  if (!auth.ok) return { ok: false, error: auth.error }
  const { supabase, operatorId } = auth

  const { data: campaign, error: fetchErr } = await supabase
    .from("marketing_campaigns")
    .select("status, operator_id")
    .eq("id", campaignId)
    .single()

  if (fetchErr || !campaign) return { ok: false, error: "Campaign not found" }
  if (campaign.operator_id !== operatorId) return { ok: false, error: "Operator mismatch" }
  if (campaign.status !== "sending" && campaign.status !== "draft") {
    return { ok: false, error: `Cannot cancel a campaign in status '${campaign.status}'` }
  }

  // Cancel any pending rows so the cron stops picking them up. Rows already
  // in 'sending' or 'sent' are left alone (the cron tick owns them).
  const { error: sendsErr } = await supabase
    .from("marketing_campaign_sends")
    .update({ status: "failed", error_message: "cancelled by admin" })
    .eq("campaign_id", campaignId)
    .eq("status", "pending")

  if (sendsErr) {
    console.error("[marketing] cancel pending sends failed:", sendsErr)
    return { ok: false, error: sendsErr.message }
  }

  const { error: campErr } = await supabase
    .from("marketing_campaigns")
    .update({ status: "cancelled" })
    .eq("id", campaignId)
    .eq("operator_id", operatorId)

  if (campErr) {
    console.error("[marketing] cancel campaign failed:", campErr)
    return { ok: false, error: campErr.message }
  }

  revalidatePath("/super-admin/marketing")
  return { ok: true, data: undefined }
}

export async function getCampaignProgress(
  campaignId: string
): Promise<
  ActionResult<{
    campaign: {
      id: string
      name: string
      status: string
      total_recipients: number | null
      total_sent: number
      total_failed: number
      started_at: string | null
      sent_at: string | null
    }
    pending: number
    sending: number
  }>
> {
  const auth = await requireAdminOperator()
  if (!auth.ok) return { ok: false, error: auth.error }
  const { supabase, operatorId } = auth

  const { data: campaign, error } = await supabase
    .from("marketing_campaigns")
    .select("id, name, status, total_recipients, total_sent, total_failed, started_at, sent_at")
    .eq("id", campaignId)
    .eq("operator_id", operatorId)
    .single()

  if (error || !campaign) return { ok: false, error: "Campaign not found" }

  const { count: pendingCount } = await supabase
    .from("marketing_campaign_sends")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending")

  const { count: sendingCount } = await supabase
    .from("marketing_campaign_sends")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "sending")

  return {
    ok: true,
    data: {
      campaign: campaign as any,
      pending: pendingCount ?? 0,
      sending: sendingCount ?? 0,
    },
  }
}
