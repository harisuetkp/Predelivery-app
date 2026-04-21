/**
 * Address confidence scoring for the checkout pin-confirmation flow.
 *
 * We combine three signals to decide whether a picked place needs forced
 * pin confirmation from the customer:
 *
 *   1. Does the Places Details response have BOTH a street_number AND a
 *      route component? A picked place with neither is a landmark /
 *      establishment without a formal address (parks, beaches, etc).
 *   2. Is the Places geometry viewport reasonably small? A single street
 *      address has a viewport a few meters wide. A park has a viewport
 *      kilometers wide. A big viewport means the lat/lng is a centroid,
 *      not a rooftop pin.
 *   3. Did the Address Validation (USPS-CASS) verdict come back at
 *      PREMISE or SUB_PREMISE granularity? Anything coarser (ROUTE,
 *      LOCALITY, etc) means we don't have a rooftop-accurate fix.
 *
 * Any single signal tripping flips the confidence to "low" — which the
 * UI turns into a bigger satellite map + Street View panel + required
 * "Confirmar ubicación" button before the pay CTA unlocks.
 */

export type Confidence = "high" | "low"

export interface Viewport {
  // Diagonal bounding box around the Place, in degrees.
  // Matches Google Places Details `geometry.viewport` shape:
  //   { northeast: {lat,lng}, southwest: {lat,lng} }
  northeast: { lat: number; lng: number }
  southwest: { lat: number; lng: number }
}

export interface ConfidenceSignals {
  hasStreetNumber: boolean
  hasRoute: boolean
  viewport: Viewport | null
  // Google Address Validation verdict.granularity from /api/address/validate.
  // Undefined if the validation call was skipped or failed.
  validationGranularity?: string | null
}

// At PR latitude (~18°N), 1° lat ~ 111 km and 1° lng ~ 106 km.
// A typical residential street address viewport is ~0.0006° ~ 65 m.
// We treat anything > 0.003° (~330 m) as a non-rooftop result.
const VIEWPORT_MAX_SPAN_DEG = 0.003

export function detectConfidence(s: ConfidenceSignals): Confidence {
  // Signal 1 — missing street number or route means no formal address
  if (!s.hasStreetNumber || !s.hasRoute) return "low"

  // Signal 2 — viewport span too wide (landmark / POI centroid)
  if (s.viewport) {
    const latSpan = Math.abs(s.viewport.northeast.lat - s.viewport.southwest.lat)
    const lngSpan = Math.abs(s.viewport.northeast.lng - s.viewport.southwest.lng)
    if (latSpan > VIEWPORT_MAX_SPAN_DEG || lngSpan > VIEWPORT_MAX_SPAN_DEG) {
      return "low"
    }
  }

  // Signal 3 — validation verdict too coarse
  if (s.validationGranularity) {
    const g = s.validationGranularity.toUpperCase()
    if (g !== "PREMISE" && g !== "SUB_PREMISE") return "low"
  }

  return "high"
}

/**
 * Convenience: derive the signals from a Places Details payload + optional
 * Validation verdict. Centralizes the shape-matching so callers don't have
 * to remember which fields feed which signal.
 */
export function confidenceFromDetailsResponse(
  details: {
    addressComponents?: Array<{ types?: string[] }> | null
    viewport?: Viewport | null
  },
  validationGranularity?: string | null
): Confidence {
  const comps = Array.isArray(details.addressComponents) ? details.addressComponents : []
  const hasStreetNumber = comps.some((c) => (c.types || []).includes("street_number"))
  const hasRoute = comps.some((c) => (c.types || []).includes("route"))
  return detectConfidence({
    hasStreetNumber,
    hasRoute,
    viewport: details.viewport || null,
    validationGranularity,
  })
}
