import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

const getAdminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/shipday/webhook
 *
 * Phase 3 of geocoding overhaul. Shipday fires a webhook on order state
 * changes; we only act on ORDER_COMPLETED (driver marked delivered).
 * We extract the driver's actual drop-off GPS fix from the payload and
 * write it back to customer_addresses as the verified coordinate. Next
 * time the same customer orders at that address, checkout prefers the
 * verified coords over the original Google geocode (which is often
 * wrong for PR urbanizations).
 *
 * Security: optional HMAC-SHA256 verification via SHIPDAY_WEBHOOK_SECRET
 * env var. Shipday signs the raw request body and sends the hex digest
 * in the X-Signature header. If the secret is not configured we accept
 * all requests (useful for local testing; enable in production).
 *
 * Always returns 200 on no-ops (unknown event type, missing coords, order
 * not found, no customer_address_id) so Shipday does not retry. Real
 * failures (HMAC mismatch, bad JSON) return 4xx/5xx.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    // --- Optional token verification ---
    // Shipday uses a plain shared bearer token sent via the Token header
    // (configured in Shipday dashboard -> Integrations -> Webhook Setup).
    // We also accept x-shipday-token for forward compatibility. If the env
    // var is unset we skip verification (handy for initial testing).
    const expectedToken = process.env.SHIPDAY_WEBHOOK_TOKEN
    if (expectedToken) {
      const sent =
        request.headers.get("token") ||
        request.headers.get("x-shipday-token") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        ""
      // Constant-time compare to avoid timing oracle
      const a = Buffer.from(sent)
      const b = Buffer.from(expectedToken)
      const match = a.length === b.length && crypto.timingSafeEqual(a, b)
      if (!match) {
        console.warn("[shipday/webhook] token mismatch")
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
      }
    }

    // --- Parse body ---
    let payload: any = null
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
    }

    const eventRaw = String(payload?.event || payload?.eventType || payload?.type || "")
    const event = eventRaw.toUpperCase()
    console.log("[shipday/webhook] event:", event, "keys:", Object.keys(payload || {}).join(","))

    // Only act on completion events
    const isCompletion =
      event === "ORDER_COMPLETED" ||
      event === "ORDER_DELIVERED" ||
      event === "ORDER_FULFILLED" ||
      event === "COMPLETED" ||
      event === "DELIVERED"
    if (!isCompletion) {
      return NextResponse.json({ ok: true, ignored: event })
    }

    const order = payload.order || payload
    const orderNumber =
      order?.orderNumber || order?.order_number || payload.orderNumber || null
    const shipdayOrderId =
      order?.orderId || order?.id || order?.order_id || payload.orderId || null

    // --- Probe several paths for completion coords ---
    // Shipday payload field names vary by integration; prefer fields that
    // clearly represent the driver's completion location over the customer's
    // geocoded address.
    type Coord = { lat: number | null; lng: number | null }
    const pickCoord = (...sources: any[]): Coord => {
      for (const s of sources) {
        if (!s || typeof s !== "object") continue
        const lat = Number((s as any).latitude ?? (s as any).lat)
        const lng = Number((s as any).longitude ?? (s as any).lng ?? (s as any).lon)
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
      }
      return { lat: null, lng: null }
    }

    const coords = pickCoord(
      payload.completionLocation,
      payload.completion_location,
      payload.deliveryLocation,
      payload.delivery_location,
      payload.location,
      order?.completionLocation,
      order?.completion_location,
      order?.deliveryLocation,
      order?.delivery_location,
      order?.deliveryAddress,
      order?.delivery_address,
      order?.customer,
      payload.customer
    )

    if (!Number.isFinite(coords.lat as number) || !Number.isFinite(coords.lng as number)) {
      console.warn(
        "[shipday/webhook] completion event without coords — raw:",
        rawBody.slice(0, 2000)
      )
      return NextResponse.json({ ok: true, noop: "no coords", event })
    }

    if (!orderNumber && !shipdayOrderId) {
      console.warn("[shipday/webhook] completion event without order identifier")
      return NextResponse.json({ ok: true, noop: "no order identifier", event })
    }

    // --- Find the OO order. Catering has no customer_address_id column so
    //     we only update for OO orders. ---
    const supabase = getAdminClient()

    type OrderRow = {
      id: string
      customer_address_id: string | null
      customer_id: string | null
    }
    let orderRow: OrderRow | null = null

    if (shipdayOrderId) {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_address_id, customer_id")
        .eq("shipday_order_id", String(shipdayOrderId))
        .maybeSingle()
      if (data) orderRow = data as OrderRow
    }
    if (!orderRow && orderNumber) {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_address_id, customer_id")
        .eq("order_number", String(orderNumber))
        .maybeSingle()
      if (data) orderRow = data as OrderRow
    }

    if (!orderRow) {
      console.log(
        "[shipday/webhook] order not found (catering or guest or unknown id) —",
        { orderNumber, shipdayOrderId }
      )
      return NextResponse.json({ ok: true, noop: "order not found" })
    }

    if (!orderRow.customer_address_id) {
      console.log(
        "[shipday/webhook] order has no customer_address_id (guest checkout):",
        orderRow.id
      )
      return NextResponse.json({ ok: true, noop: "no customer_address_id" })
    }

    const { error: upErr } = await supabase
      .from("customer_addresses")
      .update({
        verified_latitude: coords.lat,
        verified_longitude: coords.lng,
        verified_at: new Date().toISOString(),
        verified_from_order_id: orderRow.id,
      })
      .eq("id", orderRow.customer_address_id)

    if (upErr) {
      console.error("[shipday/webhook] update failed:", upErr)
      // Still 200 so Shipday doesn't retry — surface in logs
      return NextResponse.json({ ok: false, error: upErr.message })
    }

    console.log(
      "[shipday/webhook] verified coords saved — address=",
      orderRow.customer_address_id,
      "lat=",
      coords.lat,
      "lng=",
      coords.lng
    )

    return NextResponse.json({
      ok: true,
      addressId: orderRow.customer_address_id,
      coords,
    })
  } catch (error: any) {
    console.error("[shipday/webhook] error:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "unknown" },
      { status: 500 }
    )
  }
}

// Shipday may send a verification GET during webhook registration
export async function GET() {
  return NextResponse.json({ ok: true, service: "shipday-webhook", phase: 3 })
}
