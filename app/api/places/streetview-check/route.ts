import { NextRequest, NextResponse } from "next/server"

/**
 * Check whether Google has Street View imagery at a given lat/lng before
 * we render the <img> tag. Avoids showing the generic "no imagery"
 * placeholder in the pin-confirmation panel.
 *
 * Uses the Street View metadata endpoint (free; no imagery charges).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const latStr = searchParams.get("lat")
  const lngStr = searchParams.get("lng")
  const lat = latStr ? Number(latStr) : NaN
  const lng = lngStr ? Number(lngStr) : NaN

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ available: false }, { status: 400 })
  }

  const apiKey =
    process.env.GOOGLE_PLACES_SERVER_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return NextResponse.json({ available: false, reason: "no_key" })
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/streetview/metadata")
    url.searchParams.set("location", lat + "," + lng)
    url.searchParams.set("key", apiKey)
    // Prefer Google-owned outdoor panoramas over user uploads
    url.searchParams.set("source", "outdoor")

    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json({ available: false, reason: "http_" + res.status })
    }
    const data = await res.json()
    const available = data?.status === "OK"
    return NextResponse.json({
      available,
      status: data?.status || "UNKNOWN",
      panoId: data?.pano_id || null,
    })
  } catch (err: any) {
    return NextResponse.json({ available: false, reason: "fetch_error" })
  }
}
