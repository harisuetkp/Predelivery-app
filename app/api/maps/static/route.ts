import { NextRequest, NextResponse } from "next/server"

/**
 * Google Maps Static API proxy — GET /api/maps/static?lat=..&lng=..
 *
 * Returns a PNG showing a single marker at the given coordinates. Used on
 * order confirmation pages (Task #54) to give customers a non-interactive
 * visual of where their delivery is going, without shipping a full JS map
 * widget or exposing the API key to the client.
 *
 * Query params:
 *   lat, lng     (required) — rooftop pin coordinates
 *   zoom         (optional, default 16) — Google Maps zoom level
 *   size         (optional, default "600x300") — WIDTHxHEIGHT in pixels
 *   scale        (optional, default 2) — 1 or 2 (2 = retina)
 *
 * Costs ~$0.002 per image (static maps) vs ~$0.007 per map-load for the JS
 * widget. Cached at the edge for 24h since the pin never changes for a
 * given order.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const lat = Number(searchParams.get("lat"))
  const lng = Number(searchParams.get("lng"))
  const zoom = Number(searchParams.get("zoom") || "16")
  const size = searchParams.get("size") || "600x300"
  const scale = Number(searchParams.get("scale") || "2")

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 })
  }

  // Sanity-clamp: valid size format and reasonable dimensions
  if (!/^\d{2,4}x\d{2,4}$/.test(size)) {
    return NextResponse.json({ error: "invalid size" }, { status: 400 })
  }

  const apiKey =
    process.env.GOOGLE_PLACES_SERVER_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: "Maps key not configured" }, { status: 500 })
  }

  const url = new URL("https://maps.googleapis.com/maps/api/staticmap")
  url.searchParams.set("center", `${lat},${lng}`)
  url.searchParams.set("zoom", String(Math.max(1, Math.min(21, zoom))))
  url.searchParams.set("size", size)
  url.searchParams.set("scale", String(scale === 1 ? 1 : 2))
  url.searchParams.set("maptype", "roadmap")
  // Red pin at the delivery location. `color:red|` uses Google's default
  // red marker; no label so the pin shape reads cleanly on small widths.
  url.searchParams.set("markers", `color:red|${lat},${lng}`)
  url.searchParams.set("key", apiKey)

  try {
    const res = await fetch(url.toString())
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.warn("[maps/static] HTTP", res.status, body.slice(0, 500))
      return NextResponse.json({ error: "upstream failed" }, { status: 502 })
    }

    const contentType = res.headers.get("content-type") || "image/png"
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Immutable for the lifetime of the order — the pin doesn't change.
        // 24h browser + 30d CDN = cheap repeat views.
        "Cache-Control": "public, max-age=86400, s-maxage=2592000, immutable",
      },
    })
  } catch (err: any) {
    console.warn("[maps/static] Exception:", err?.message || err)
    return NextResponse.json({ error: "proxy failed" }, { status: 500 })
  }
}
