import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { requirePlatformRole } from "@/lib/auth/require-platform-role"

const GRAPH_API_VERSION = "v21.0"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, message } = body as {
      conversationId?: string
      message?: string
    }

    if (!conversationId || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "conversationId and a non-empty message are required" },
        { status: 400 },
      )
    }

    const token = process.env.WHATSAPP_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

    if (!token || !phoneNumberId) {
      console.error("[WhatsApp Send] WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not set")
      return NextResponse.json({ error: "WhatsApp is not configured" }, { status: 503 })
    }

    // Auth guard - only platform-level admins (super_admin | manager | csr) can
    // send on behalf of the business. requirePlatformRole uses the cookie-bound
    // client under the hood, so the identity check is still RLS-subject. DB
    // writes below use service-role (whatsapp_* tables are service_role-only).
    try {
      await requirePlatformRole()
    } catch (err: any) {
      const status = err?.status === 401 ? 401 : 403
      return NextResponse.json({ error: err?.message ?? "Forbidden" }, { status })
    }

    const supabase = createServiceRoleClient()

    const { data: conversation, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select("id, customer_phone")
      .eq("id", conversationId)
      .single()

    if (convError || !conversation?.customer_phone) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const text = message.trim()

    const metaRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: conversation.customer_phone,
          type: "text",
          text: { preview_url: false, body: text },
        }),
      },
    )

    const metaJson = (await metaRes.json()) as {
      messages?: { id: string }[]
      error?: { message: string; code?: number }
    }

    if (!metaRes.ok) {
      console.error("[WhatsApp Send] Meta API error:", metaJson)
      return NextResponse.json(
        { error: "Failed to send via WhatsApp", details: metaJson.error ?? metaJson },
        { status: metaRes.status >= 400 && metaRes.status < 600 ? metaRes.status : 502 },
      )
    }

    const waMessageId = metaJson.messages?.[0]?.id ?? null

    const { error: insertError } = await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      message_id: waMessageId,
      content: text,
      media_type: null,
      status: "sent",
    })

    if (insertError) {
      console.error("[WhatsApp Send] Failed to persist message:", insertError)
      return NextResponse.json(
        { error: "Sent via WhatsApp but failed to save message", waMessageId },
        { status: 500 },
      )
    }

    const { error: updateError } = await supabase
      .from("whatsapp_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id)

    if (updateError) {
      console.error("[WhatsApp Send] Failed to update conversation timestamp:", updateError)
    }

    return NextResponse.json({ success: true, waMessageId })
  } catch (error) {
    console.error("[WhatsApp Send] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
