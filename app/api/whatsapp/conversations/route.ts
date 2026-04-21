import { NextResponse } from "next/server"
import { requirePlatformRole } from "@/lib/auth/require-platform-role"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * GET /api/whatsapp/conversations
 *
 * Returns every conversation plus:
 *   - the latest message (for list preview + sort key)
 *   - joined customer name/email if customer_id is linked
 *   - joined operator name if assigned_to is set (FK → operators.id)
 *
 * Platform-role gated (super_admin | manager | csr). RLS on whatsapp_*
 * is service_role-only, so reads happen via the service-role client
 * AFTER the caller's identity has been verified.
 */
export async function GET() {
  try {
    await requirePlatformRole()
  } catch (err: any) {
    const status = err?.status === 401 ? 401 : 403
    return NextResponse.json({ error: err?.message ?? "Forbidden" }, { status })
  }

  const supabase = createServiceRoleClient()

  const { data: conversations, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, customer_phone, customer_id, status, assigned_to, last_message_at, created_at")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("[WhatsApp Inbox] Conversations fetch failed:", error)
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 })
  }

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ conversations: [] })
  }

  const conversationIds = conversations.map(c => c.id)
  const customerIds = Array.from(
    new Set(conversations.map(c => c.customer_id).filter((v): v is string => !!v)),
  )
  const assigneeIds = Array.from(
    new Set(conversations.map(c => c.assigned_to).filter((v): v is string => !!v)),
  )

  // Latest message per conversation — small N so a single pull + groupBy is fine
  const { data: recentMessages, error: msgError } = await supabase
    .from("whatsapp_messages")
    .select("conversation_id, direction, content, media_type, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(600)

  if (msgError) {
    console.error("[WhatsApp Inbox] Message preview fetch failed:", msgError)
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 })
  }

  const latestByConv = new Map<string, { direction: string; content: string | null; media_type: string | null; created_at: string }>()
  for (const m of recentMessages ?? []) {
    if (!latestByConv.has(m.conversation_id)) {
      latestByConv.set(m.conversation_id, {
        direction: m.direction,
        content: m.content,
        media_type: m.media_type,
        created_at: m.created_at,
      })
    }
  }

  let customersById = new Map<string, { id: string; name: string | null; email: string | null }>()
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, first_name, last_name, email")
      .in("id", customerIds)
    for (const c of customers ?? []) {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || null
      customersById.set(c.id, { id: c.id, name, email: c.email })
    }
  }

  let operatorsById = new Map<string, { id: string; name: string | null }>()
  if (assigneeIds.length > 0) {
    const { data: operators } = await supabase
      .from("operators")
      .select("id, name")
      .in("id", assigneeIds)
    for (const o of operators ?? []) operatorsById.set(o.id, o)
  }

  const enriched = conversations.map(c => ({
    ...c,
    customer: c.customer_id ? customersById.get(c.customer_id) ?? null : null,
    assigned_operator: c.assigned_to ? operatorsById.get(c.assigned_to) ?? null : null,
    last_message: latestByConv.get(c.id) ?? null,
  }))

  return NextResponse.json({ conversations: enriched })
}
