/**
 * Client-side reverse-geocoding helper.
 *
 * Uses the already-loaded google.maps.Geocoder (loaded via the address
 * autocomplete or the pin map). No extra server round-trip.
 *
 * v2: retries for up to `waitMs` milliseconds if Maps JS hasn't finished
 * loading yet. The address autocomplete mounts on the checkout page and
 * loads Maps JS asynchronously, so if a customer taps Ubicarme within the
 * first ~500ms of landing on checkout, the Geocoder may not yet exist.
 * A short retry loop sidesteps that race without requiring callers to
 * manage load state themselves.
 */

export interface ResolvedAddressComponents {
  streetNumber?: string
  route?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export interface ResolvedAddress {
  formattedAddress: string
  // streetNumber + " " + route when both present; falls back to route alone.
  streetAddress: string
  components: ResolvedAddressComponents
}

function extractComponents(components: any[]): ResolvedAddressComponents {
  const out: ResolvedAddressComponents = {}
  for (const c of components || []) {
    const types: string[] = c.types || []
    if (types.includes("street_number")) out.streetNumber = c.long_name
    else if (types.includes("route")) out.route = c.long_name
    else if (types.includes("locality")) out.city = c.long_name
    else if (!out.city && (types.includes("sublocality") || types.includes("sublocality_level_1"))) {
      out.city = c.long_name
    }
    else if (!out.city && types.includes("administrative_area_level_2")) out.city = c.long_name
    else if (types.includes("administrative_area_level_1")) out.state = c.short_name
    else if (types.includes("postal_code")) out.postalCode = c.long_name
    else if (types.includes("country")) out.country = c.short_name
  }
  return out
}

function runGeocode(
  lat: number,
  lng: number
): Promise<ResolvedAddress | null> {
  const w = window as any
  const geocoder = new w.google.maps.Geocoder()
  return new Promise((resolve) => {
    try {
      geocoder.geocode({ location: { lat, lng } }, (results: any[] | null, status: string) => {
        if (status !== "OK" || !results || !results.length) {
          resolve(null)
          return
        }

        // Plus codes look like "9W3H+X24" (Open Location Code). They
        // are valid coordinates but useless as a delivery address label,
        // so skip them below.
        const plusCodeRe = /^[23456789CFGHJMPQRVWX]{2,7}\+[23456789CFGHJMPQRVWX]{2,3}\b/i
        const isPlusCodeText = (s: string) => plusCodeRe.test((s || "").trim())

        // Extract components from every result so we can merge locality /
        // state / postal across siblings below. Google's reverse-geocode
        // often splits that info across multiple results (e.g. the route
        // result has no postal_code, but the plus-code result does).
        const perResultAll = results.map((r: any) => ({
          types: (r.types || []) as string[],
          formatted: (r.formatted_address || "") as string,
          components: extractComponents(r.address_components || []),
        }))

        // Drop plus-code-only results from the candidate pool for the
        // picker (still keep them in perResultAll for component merging
        // below - they often carry the ZIP).
        const perResult = perResultAll.filter(r =>
          !(r.types.includes("plus_code") && !r.components.route)
        )

        if (!perResult.length) {
          // Nothing but plus codes - leave the typed address alone.
          resolve(null)
          return
        }

        // Select the most-street-like result. Preference order:
        //   1. street_address (number + road, most precise)
        //   2. premise / subpremise (individual buildings)
        //   3. ANY result whose components include a route - this is the
        //      key escape hatch that lets us pick a street when the top
        //      result is a park / neighborhood / political polygon with
        //      no route of its own.
        //   4. route-type result
        //   5. perResult[0] as last resort (still non-plus-code).
        const typeMatch = (t: string) => perResult.find(r => r.types.includes(t))
        const withRoute = perResult.find(r => !!r.components.route)
        const preferred =
          typeMatch("street_address") ||
          typeMatch("premise") ||
          typeMatch("subpremise") ||
          withRoute ||
          typeMatch("route") ||
          perResult[0]

        // Fill missing city/state/postal from any sibling result (include
        // the dropped plus-code ones here - they often carry the ZIP).
        const comps = { ...preferred.components }
        for (const r of perResultAll) {
          if (!comps.city && r.components.city) comps.city = r.components.city
          if (!comps.state && r.components.state) comps.state = r.components.state
          if (!comps.postalCode && r.components.postalCode) comps.postalCode = r.components.postalCode
        }

        const street = comps.streetNumber && comps.route
          ? comps.streetNumber + " " + comps.route
          : (comps.route || "")

        // Sanitize formattedAddress for the consumer's fallback path so
        // it cannot smuggle a plus code into Direccion.
        const safeFormatted = isPlusCodeText(preferred.formatted)
          ? ""
          : preferred.formatted

        // Dev-gated trace. Set `window.__pinDebug = true` in DevTools to
        // see exactly what Google returned - helps diagnose cases where
        // the pin lands near landmark polygons.
        try {
          if ((w as any).__pinDebug) {
            // eslint-disable-next-line no-console
            console.log("[reverseGeocode]", {
              lat, lng,
              resultTypes: perResult.map(r => r.types),
              pickedTypes: preferred.types,
              pickedFormatted: preferred.formatted,
              mergedComponents: comps,
              finalStreet: street,
            })
          }
        } catch {}

        resolve({
          formattedAddress: safeFormatted || "",
          streetAddress: street,
          components: comps,
        })
      })
    } catch {
      resolve(null)
    }
  })
}

export function reverseGeocode(
  lat: number,
  lng: number,
  waitMs: number = 2500
): Promise<ResolvedAddress | null> {
  if (typeof window === "undefined") return Promise.resolve(null)
  return new Promise((resolve) => {
    const start = Date.now()
    const tick = () => {
      const w = window as any
      if (w && w.google && w.google.maps && w.google.maps.Geocoder) {
        runGeocode(lat, lng).then(resolve).catch(() => resolve(null))
        return
      }
      if (Date.now() - start >= waitMs) {
        resolve(null)
        return
      }
      setTimeout(tick, 200)
    }
    tick()
  })
}
