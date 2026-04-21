import { NextRequest, NextResponse } from "next/server"

/**
 * Places API (New) Autocomplete — POST https://places.googleapis.com/v1/places:autocomplete
 *
 * Migrated from legacy `maps.googleapis.com/maps/api/place/autocomplete/json`
 * (Task #53). Response shape is transformed to match what
 * components/address-autocomplete.tsx already consumes:
 *   { predictions: [{ placeId, text, description, mainText, secondaryText }] }
 *
 * Requires "Places API (New)" enabled in GCP. Key: GOOGLE_PLACES_SERVER_KEY.
 *
 * No `includedPrimaryTypes` restriction — returns a mix of street addresses
 * and establishments so users can search by business name (e.g.
 * "Marriott Condado", "Hospital Auxilio Mutuo").
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const input = searchParams.get("input")

  if (!input) {
    return NextResponse.json({ predictions: [] })
  }

  const apiKey = process.env.GOOGLE_PLACES_SERVER_KEY

  if (!apiKey) {
    return NextResponse.json({ error: "Places server key not configured" }, { status: 500 })
  }

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input,
        languageCode: "es",
        regionCode: "pr",
        includedRegionCodes: ["pr"],
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      console.warn("[places/autocomplete] HTTP", response.status, body.slice(0, 500))
      return NextResponse.json({ predictions: [] })
    }

    const data = await response.json()

    // Transform Places API (New) response → legacy-shaped predictions for clients.
    // Shape: { suggestions: [{ placePrediction: { placeId, text: {text}, structuredFormat: {...} } }] }
    const predictions = (data.suggestions || [])
      .map((s: any) => s.placePrediction)
      .filter(Boolean)
      .map((p: any) => ({
        placeId: p.placeId,
        text: p.text?.text || "",
        description: p.text?.text || "",
        mainText: p.structuredFormat?.mainText?.text || p.text?.text || "",
        secondaryText: p.structuredFormat?.secondaryText?.text || "",
      }))

    return NextResponse.json({ predictions })
  } catch (err: any) {
    console.warn("[places/autocomplete] Exception:", err?.message || err)
    return NextResponse.json({ predictions: [] })
  }
}
