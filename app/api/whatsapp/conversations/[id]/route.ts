import { NextRequest, NextResponse } from "next/server"
import { requirePlatformRole } from "@/lib/auth/require-platform-role"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * PATCH /api/whatsapp/conversations/[id]
 *
 * Updates status (open | resolved) on a conversation.
 * Platform-role gated. Writes via service-role.
 *
 * Body: { status: "open" | "resolved" }
 *
 * Note: assigned_to is a FK to operators(id), not to a user. Per-user
 * assignment is out of scope for v1; reassigning to a different operator
 * is a multi-tenant routing concern to be handled separately.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing conversation id" }, { status: 400 })
  }

  const body = await request.json().catch(() => ({})) as {
    status?: string
  }

  if (body.status !== "open" && body.status !== "resolved") {
    return NextResponse.json(
      { error: "status must be 'open' or 'resolved'" },
      { status: 400 },
    )
  }
  const updates: Record<string, unknown> = { status: body.status }

  try {
    await requirePlatformRole()
  } catch (err: any) {
    const status = err?.status === 401 ? 401 : 403
    return NextResponse.json({ error: err?.message ?? "Forbidden" }, { status })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .update(updates)
    .eq("id", id)
    .select("id, status, assigned_to")
    .single()

  if (error) {
    console.error("[WhatsApp Inbox] Conversation update failed:", error)
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 })
  }

  return NextResponse.json({ conversation: data })
}
