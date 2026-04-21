/**
 * Google Address Validation API client (Phase 2 of geocoding overhaul)
 * https://developers.google.com/maps/documentation/address-validation
 *
 * Server-only. Sends structured address components to Google's validation
 * endpoint and returns a USPS-CASS-standardized canonical form plus higher
 * accuracy lat/lng. Called from /api/address/validate which is hit by the
 * address autocomplete widget immediately after a Google Places suggestion
 * is selected.
 *
 * If the verdict is "deliverable" (PREMISE/SUB_PREMISE granularity with no
 * unconfirmed components) the client silently replaces the form fields with
 * the canonical version. Otherwise the original Places values are kept.
 */

export interface AddressValidateInput {
  addressLines: string[]
  locality?: string           // city
  administrativeArea?: string // state, e.g. "PR"
  postalCode?: string
  regionCode?: string         // ISO 3166-1 alpha-2; defaults to "US"
}

export interface AddressValidateCanonical {
  formattedAddress: string
  addressLine1: string
  city: string
  state: string
  zip: string
  latitude?: number
  longitude?: number
}

export interface AddressValidateVerdict {
  validationGranularity?: string
  geocodeGranularity?: string
  addressComplete?: boolean
  hasUnconfirmedComponents?: boolean
  hasReplacedComponents?: boolean
  hasInferredComponents?: boolean
}

export interface AddressValidateResult {
  ok: boolean
  deliverable: boolean
  canonical?: AddressValidateCanonical
  verdict?: AddressValidateVerdict
}

export async function validateAddress(input: AddressValidateInput): Promise<AddressValidateResult> {
  const apiKey =
    process.env.GOOGLE_PLACES_SERVER_KEY ||
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.warn("[address/validate] No Google API key configured")
    return { ok: false, deliverable: false }
  }

  try {
    const res = await fetch(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: {
            regionCode: input.regionCode || "US",
            addressLines: input.addressLines,
            ...(input.locality ? { locality: input.locality } : {}),
            ...(input.administrativeArea ? { administrativeArea: input.administrativeArea } : {}),
            ...(input.postalCode ? { postalCode: input.postalCode } : {}),
          },
          // USPS CASS enrichment — gives us ZIP+4 and standardized street line
          // for US/PR addresses. Silently ignored for non-US regions.
          enableUspsCass: true,
        }),
      }
    )

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.warn("[address/validate] HTTP", res.status, body.slice(0, 500))
      return { ok: false, deliverable: false }
    }

    const data = await res.json()
    const result = data?.result
    if (!result) return { ok: false, deliverable: false }

    const verdict = result.verdict || {}
    const address = result.address || {}
    const postal = address.postalAddress || {}
    const geo = result.geocode?.location

    const granularity = verdict.validationGranularity
    const deliverable =
      (granularity === "PREMISE" || granularity === "SUB_PREMISE") &&
      !verdict.hasUnconfirmedComponents

    const addressLine1 = (postal.addressLines && postal.addressLines[0]) || ""
    let city = postal.locality || ""
    // PR quirk: Google Address Validation sometimes returns the municipality
    // (e.g. "San Juan", "Bayamón") in administrativeArea instead of the
    // 2-letter territory code "PR". USPS state codes are always exactly two
    // letters — anything longer is a municipality, not a state. We accept it
    // only if it matches the [A-Z]{2} format; otherwise we promote it to the
    // city slot (when locality is empty) and leave state blank.
    //
    // Note: the Places-details endpoint has the same quirk and applies the
    // same regex gate (see app/api/places/details/route.ts). When its state
    // value is blank, the client defaults to "PR" — correct for this
    // PR-only platform.
    const stateRaw = String(postal.administrativeArea || "").trim()
    let state = ""
    if (/^[A-Za-z]{2}$/.test(stateRaw)) {
      state = stateRaw.toUpperCase()
    } else if (stateRaw && !city) {
      // Looks like a municipality — use it as the city.
      city = stateRaw
    }
    const zip = postal.postalCode || ""

    // PR quirk fallbacks. Google Address Validation regularly returns a
    // Spanish municipality string in administrativeArea for PR addresses
    // (caught above and routed to city), which leaves `state` blank. But
    // downstream consumers — Shipday payload, receipts, CSR display —
    // expect a non-empty 2-letter code. Backfill in priority order:
    //   1. caller-provided input.administrativeArea if it's 2 letters
    //      (client typically passes "PR" from the Places-details step)
    //   2. zip-range heuristic: PR zip codes are 00600-00999, so when
    //      the zip falls in that band we default to "PR".
    if (!state && input.administrativeArea) {
      const inputState = String(input.administrativeArea).trim()
      if (/^[A-Za-z]{2}$/.test(inputState)) {
        state = inputState.toUpperCase()
      }
    }
    if (!state && /^00[6-9]\d{2}/.test(zip)) {
      state = "PR"
    }

    return {
      ok: true,
      deliverable,
      canonical: {
        formattedAddress: address.formattedAddress || "",
        addressLine1,
        city,
        state,
        zip,
        latitude: typeof geo?.latitude === "number" ? geo.latitude : undefined,
        longitude: typeof geo?.longitude === "number" ? geo.longitude : undefined,
      },
      verdict: {
        validationGranularity: verdict.validationGranularity,
        geocodeGranularity: verdict.geocodeGranularity,
        addressComplete: verdict.addressComplete,
        hasUnconfirmedComponents: verdict.hasUnconfirmedComponents,
        hasReplacedComponents: verdict.hasReplacedComponents,
        hasInferredComponents: verdict.hasInferredComponents,
      },
    }
  } catch (err: any) {
    console.warn("[address/validate] Exception:", err?.message || err)
    return { ok: false, deliverable: false }
  }
}
