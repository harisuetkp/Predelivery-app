import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN

// Meta webhook verification (subscribe)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (!VERIFY_TOKEN) {
    console.error("[WhatsApp Webhook] WHATSAPP_VERIFY_TOKEN is not set")
    return new NextResponse("Not configured", { status: 503 })
  }

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse("Forbidden", { status: 403 })
}

// Incoming WhatsApp Cloud API events
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const change = body.entry?.[0]?.changes?.[0]
    const value = change?.value
    const message = value?.messages?.[0]
    const customerPhone = message?.from

    if (!message || !customerPhone) {
      return new NextResponse("OK", { status: 200 })
    }

    // Service-role client: webhook runs without a user session, and both
    // whatsapp_* tables are RLS-scoped to service_role only. Using the
    // anon/cookie client here would cause inserts to silently fail under
    // RLS. Meta's webhook retries on non-200 responses, so we still return
    // 500 on failure rather than swallowing errors.
    const supabase = createServiceRoleClient()

    const { data: conversation, error: findError } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("customer_phone", customerPhone)
      .eq("status", "open")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (findError) {
      console.error("[WhatsApp Webhook] Conversation lookup failed:", findError)
      return new NextResponse("Internal error", { status: 500 })
    }

    let conversationId = conversation?.id

    if (!conversationId) {
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", customerPhone)
        .maybeSingle()

      const { data: newConv, error: insertConvError } = await supabase
        .from("whatsapp_conversations")
        .insert({
          customer_phone: customerPhone,
          customer_id: customer?.id ?? null,
          status: "open",
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single()

      if (insertConvError || !newConv) {
        console.error("[WhatsApp Webhook] Failed to create conversation:", insertConvError)
        return new NextResponse("Internal error", { status: 500 })
      }

      conversationId = newConv.id
    }

    const { error: msgError } = await supabase.from("whatsapp_messages").insert({
      conversation_id: conversationId,
      direction: "inbound",
      message_id: message.id,
      content: message.text?.body ?? null,
      media_type: message.type !== "text" ? message.type : null,
      status: "received",
    })

    if (msgError) {
      console.error("[WhatsApp Webhook] Failed to save message:", msgError)
      return new NextResponse("Internal error", { status: 500 })
    }

    const { error: updateError } = await supabase
      .from("whatsapp_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId)

    if (updateError) {
      console.error("[WhatsApp Webhook] Failed to update conversation:", updateError)
      return new NextResponse("Internal error", { status: 500 })
    }

    return new NextResponse("OK", { status: 200 })
  } catch (error) {
    console.error("[WhatsApp Webhook] Error:", error)
    return new NextResponse("Internal error", { status: 500 })
  }
}
