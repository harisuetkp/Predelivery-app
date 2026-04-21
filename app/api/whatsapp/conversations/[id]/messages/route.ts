import { NextRequest, NextResponse } from "next/server"
import { requirePlatformRole } from "@/lib/auth/require-platform-role"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * GET /api/whatsapp/conversations/[id]/messages
 *
 * Returns the full message thread for one conversation in chronological
 * order. Platform-role gated. Reads via service-role (RLS is service_role-only).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing conversation id" }, { status: 400 })
  }

  try {
    await requirePlatformRole()
  } catch (err: any) {
    const status = err?.status === 401 ? 401 : 403
    return NextResponse.json({ error: err?.message ?? "Forbidden" }, { status })
  }

  const supabase = createServiceRoleClient()
  const { data: messages, error } = await supabase
    .from("whatsapp_messages")
    .select("id, conversation_id, direction, message_id, content, media_url, media_type, status, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(500)

  if (error) {
    console.error("[WhatsApp Inbox] Message fetch failed:", error)
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 })
  }

  return NextResponse.json({ messages: messages ?? [] })
}
