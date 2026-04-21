import { createClient } from "@supabase/supabase-js"
import { sendMarketingBatch } from "@/lib/email/send-marketing-email"

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set")
  }

  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  }

  return createClient(url, key)
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    throw new Error("CRON_SECRET is not set")
  }

  const authHeader = request.headers.get("Authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = getSupabaseAdmin()

  const { data: campaigns, error: campaignError } = await supabase
    .from("marketing_campaigns")
    .select("id, from_address, subject, body_html, total_sent, total_failed")
    .eq("status", "sending")
    .order("started_at", { ascending: true, nullsFirst: false })
    .limit(1)

  if (campaignError) {
    throw new Error(`Failed to load active campaign: ${campaignError.message}`)
  }

  if (!campaigns || campaigns.length === 0) {
    return Response.json({ processed: 0, message: "no active campaigns" }, { status: 200 })
  }

  const campaign = campaigns[0] as {
    id: string
    from_address: string
    subject: string
    body_html: string
    total_sent: number | null
    total_failed: number | null
  }

  if (!campaign.id) {
    throw new Error("Active campaign row missing id")
  }

  if (!campaign.from_address) {
    throw new Error("Active campaign row missing from_address")
  }

  if (!campaign.subject) {
    throw new Error("Active campaign row missing subject")
  }

  if (!campaign.body_html) {
    throw new Error("Active campaign row missing body_html")
  }

  if (campaign.total_sent === null || campaign.total_sent === undefined) {
    throw new Error("Active campaign row missing total_sent")
  }

  if (campaign.total_failed === null || campaign.total_failed === undefined) {
    throw new Error("Active campaign row missing total_failed")
  }

  const { data: pendingRows, error: pendingError } = await supabase
    .from("marketing_campaign_sends")
    .select("id, email")
    .eq("campaign_id", campaign.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100)

  if (pendingError) {
    throw new Error(`Failed to load pending sends: ${pendingError.message}`)
  }

  if (!pendingRows) {
    throw new Error("Failed to load pending sends: no data returned")
  }

  if (pendingRows.length === 0) {
    const { data: statusRows, error: statusError } = await supabase
      .from("marketing_campaign_sends")
      .select("status")
      .eq("campaign_id", campaign.id)

    if (statusError) {
      throw new Error(`Failed to load send statuses for finalize: ${statusError.message}`)
    }

    if (!statusRows) {
      throw new Error("Failed to load send statuses for finalize: no data returned")
    }

    const counts: Record<string, number> = {}
    for (const row of statusRows as Array<{ status: string }>) {
      counts[row.status] = (counts[row.status] || 0) + 1
    }

    const sentCount = counts["sent"] || 0
    const failedCount = counts["failed"] || 0

    const { error: finalizeError } = await supabase
      .from("marketing_campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        total_sent: sentCount,
        total_failed: failedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)

    if (finalizeError) {
      throw new Error(`Failed to finalize campaign: ${finalizeError.message}`)
    }

    return Response.json({ processed: 0, campaignId: campaign.id, completed: true }, { status: 200 })
  }

  const batchIds = pendingRows.map((r) => {
    if (!r.id) {
      throw new Error("Pending send row missing id")
    }
    return r.id as string
  })

  const { data: claimedRows, error: claimError } = await supabase
    .from("marketing_campaign_sends")
    .update({ status: "sending" })
    .in("id", batchIds)
    .eq("status", "pending")
    .select("id, email")

  if (claimError) {
    throw new Error(`Failed to claim batch: ${claimError.message}`)
  }

  if (!claimedRows) {
    throw new Error("Failed to claim batch: no data returned")
  }

  if (claimedRows.length === 0) {
    return Response.json(
      { processed: 0, campaignId: campaign.id, message: "batch already claimed" },
      { status: 200 },
    )
  }

  if (claimedRows.length !== batchIds.length) {
    throw new Error(
      `Batch claim mismatch: expected ${batchIds.length} rows, claimed ${claimedRows.length} rows`,
    )
  }

  for (const row of claimedRows as Array<{ id: string; email: string | null }>) {
    if (!row.email) {
      throw new Error(`Claimed send row ${row.id} missing email`)
    }
  }

  let results: Array<{ email: string; messageId: string }>
  try {
    results = await sendMarketingBatch({
      from: campaign.from_address,
      subject: campaign.subject,
      bodyHtml: campaign.body_html,
      recipients: (claimedRows as Array<{ email: string }>).map((r) => ({ email: r.email })),
    })
  } catch (err: any) {
    const message = err?.message ? String(err.message) : String(err)

    const claimedIds = (claimedRows as Array<{ id: string }>).map((r) => r.id)

    const { error: failRowsError } = await supabase
      .from("marketing_campaign_sends")
      .update({
        status: "failed",
        error_message: message,
      })
      .in("id", claimedIds)

    if (failRowsError) {
      throw new Error(`Failed to mark sends failed after batch error: ${failRowsError.message}`)
    }

    const nextTotalFailed = campaign.total_failed + claimedIds.length

    const { error: failCampaignError } = await supabase
      .from("marketing_campaigns")
      .update({
        total_failed: nextTotalFailed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)

    if (failCampaignError) {
      throw new Error(`Failed to update campaign totals after batch error: ${failCampaignError.message}`)
    }

    return Response.json({ processed: 0, campaignId: campaign.id, error: message }, { status: 500 })
  }

  const emailToSendId = new Map<string, string>()
  for (const row of claimedRows as Array<{ id: string; email: string }>) {
    if (emailToSendId.has(row.email)) {
      throw new Error(`Duplicate email in claimed batch: ${row.email}`)
    }
    emailToSendId.set(row.email, row.id)
  }

  for (const r of results) {
    const sendId = emailToSendId.get(r.email)
    if (!sendId) {
      throw new Error(`Resend result email not found in claimed batch: ${r.email}`)
    }

    const { error: sentRowError } = await supabase
      .from("marketing_campaign_sends")
      .update({
        status: "sent",
        resend_message_id: r.messageId,
        sent_at: new Date().toISOString(),
      })
      .eq("id", sendId)

    if (sentRowError) {
      throw new Error(`Failed to update send row after success: ${sentRowError.message}`)
    }
  }

  const nextTotalSent = campaign.total_sent + results.length

  const { error: sentCampaignError } = await supabase
    .from("marketing_campaigns")
    .update({
      total_sent: nextTotalSent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id)

  if (sentCampaignError) {
    throw new Error(`Failed to update campaign totals after success: ${sentCampaignError.message}`)
  }

  return Response.json({ processed: results.length, campaignId: campaign.id }, { status: 200 })
}
