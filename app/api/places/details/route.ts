import { NextRequest, NextResponse } from "next/server"

/**
 * Places API (New) Place Details — GET https://places.googleapis.com/v1/places/{id}
 *
 * Migrated from legacy `maps.googleapis.com/maps/api/place/details/json`
 * (Task #53). Response shape is transformed to match what the autocomplete
 * widget and CSR portal already consume:
 *   { lat, lng, address, addressComponents, formattedAddress,
 *     streetAddress, city, state, zip, viewport }
 *
 * Requires "Places API (New)" enabled in GCP. Key: GOOGLE_PLACES_SERVER_KEY.
 *
 * IMPORTANT: New API uses `longText`/`shortText`/`types` per address component
 * (vs legacy `long_name`/`short_name`/`types`). We rebuild the legacy shape so
 * downstream consumers don't change. Viewport changed from
 * `{northeast, southwest}` to `{low, high}` — also rebuilt to legacy shape.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const placeId = searchParams.get("place_id") || searchParams.get("placeId")

  if (!placeId) {
    return NextResponse.json({ error: "Place ID required" }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_PLACES_SERVER_KEY

  if (!apiKey) {
    return NextResponse.json({ error: "Places server key not configured" }, { status: 500 })
  }

  try {
    // Request only the fields we need. Omitting languageCode preserves accurate
    // short_name values for state abbreviations (PR, FL, NY, etc.).
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,formattedAddress,addressComponents,location,viewport",
        },
      }
    )

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      console.warn("[places/details] HTTP", response.status, body.slice(0, 500))
      return NextResponse.json({ error: "Failed to fetch place details" }, { status: 500 })
    }

    const result = await response.json()

    // Rebuild legacy-shaped addressComponents for downstream consumers.
    const legacyComponents = (result.addressComponents || []).map((c: any) => ({
      long_name: c.longText || "",
      short_name: c.shortText || "",
      types: c.types || [],
    }))

    // Parse address components
    let streetNumber = ""
    let route = ""
    let city = ""
    let state = ""
    let zip = ""

    for (const comp of legacyComponents) {
      const types = comp.types || []

      if (types.includes("street_number")) {
        streetNumber = comp.long_name || ""
      }
      if (types.includes("route")) {
        route = comp.long_name || ""
      }
      if (types.includes("locality")) {
        city = comp.long_name || ""
      }
      if (!city && types.includes("sublocality_level_1")) {
        city = comp.long_name || ""
      }
      if (!city && types.includes("administrative_area_level_2")) {
        city = comp.long_name || ""
      }
      // PR quirk: administrative_area_level_1.short_name is sometimes the
      // municipality (e.g. "San Juan") instead of the 2-letter territory
      // code. USPS state codes are always exactly two letters. Accept only
      // [A-Z]{2}; otherwise promote to city if city is empty, and let the
      // later default fill in "PR".
      if (types.includes("administrative_area_level_1")) {
        const raw = (comp.short_name || "").trim()
        if (/^[A-Za-z]{2}$/.test(raw)) {
          state = raw.toUpperCase()
        } else if (raw && !city) {
          city = raw
        }
      }
      if (types.includes("postal_code")) {
        zip = comp.long_name || ""
      }
    }

    // Fallback: parse from formatted_address
    const formattedAddress = result.formattedAddress || ""
    if (formattedAddress) {
      if (!city) {
        const parts = formattedAddress.split(",").map((p: string) => p.trim())
        if (parts.length >= 2) {
          city = parts[1]
        }
      }
      if (!zip) {
        // Try to extract ZIP from formatted address (PR format: 00XXX or XXXXX)
        const zipMatch = formattedAddress.match(/\b(00\d{3}|\d{5})(?:-\d{4})?\b/)
        if (zipMatch) {
          zip = zipMatch[1]
        }
      }
    }

    // Default state to PR
    if (!state) {
      state = "PR"
    }

    const streetAddress = (streetNumber + " " + route).trim()

    const lat = result.location?.latitude ?? null
    const lng = result.location?.longitude ?? null

    // Viewport — used by the checkout pin component for confidence scoring.
    // New API shape: { low: {latitude, longitude}, high: {latitude, longitude} }
    // Big viewport = landmark / POI centroid, not a rooftop pin.
    const viewportRaw = result.viewport
    const viewport = viewportRaw
      ? {
          northeast: {
            lat: viewportRaw.high?.latitude ?? null,
            lng: viewportRaw.high?.longitude ?? null,
          },
          southwest: {
            lat: viewportRaw.low?.latitude ?? null,
            lng: viewportRaw.low?.longitude ?? null,
          },
        }
      : null

    return NextResponse.json({
      lat,
      lng,
      address: formattedAddress,
      addressComponents: legacyComponents,
      formattedAddress,
      streetAddress,
      city,
      state,
      zip,
      viewport,
    })
  } catch (err: any) {
    console.warn("[places/details] Exception:", err?.message || err)
    return NextResponse.json({ error: "Failed to fetch place details" }, { status: 500 })
  }
}
