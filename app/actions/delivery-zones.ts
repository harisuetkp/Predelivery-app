"use server"

import { createServerClient } from "@/lib/supabase/server"

interface CalculateDeliveryFeeParams {
  restaurantId: string
  deliveryAddress: string
  restaurantAddress: string
  itemCount: number
  // Optional: exact customer lat/lng from confirmed pin. When
  // provided together with a restaurant origin (from the DB),
  // distance is computed via Haversine - bypasses the Routes API
  // and cannot be skewed by a re-geocode of the typed address.
  customerLat?: number
  customerLng?: number
}

interface CalculateDeliveryFeeResult {
  success: boolean
  fee: number           // Full fee — used for order totals, reporting, payment
  displayedFee: number  // Subsidy-reduced fee shown to the customer
  subsidy: number       // The subsidy amount (platform absorbs this)
  distance: number
  zoneName: string
  itemSurcharge: number
  error?: string
}

// Calculate delivery fee based on distance and item count
export async function calculateDeliveryFee(params: CalculateDeliveryFeeParams): Promise<CalculateDeliveryFeeResult> {
  try {
    const { restaurantId, deliveryAddress, restaurantAddress, itemCount, customerLat, customerLng } = params

    // Fetch delivery zones, platform subsidy, and restaurant row (with
    // lat/lng for pin-driven Haversine) in parallel.
    const supabase = await createServerClient()
    const [zonesResult, settingsResult, restaurantResult] = await Promise.all([
      supabase
        .from("delivery_zones")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("platform_settings")
        .select("delivery_fee_subsidy")
        .eq("tent", "online_ordering")
        .single(),
      supabase
        .from("restaurants")
        .select("delivery_fee, latitude, longitude")
        .eq("id", restaurantId)
        .single(),
    ])

    // Distance: prefer pin-to-restaurant Haversine when we have both.
    // Falls back to the legacy Routes-API path on typed addresses so
    // pickup-only / legacy callers still work.
    let distance: number
    const restLat = restaurantResult.data?.latitude != null ? Number(restaurantResult.data.latitude) : null
    const restLng = restaurantResult.data?.longitude != null ? Number(restaurantResult.data.longitude) : null
    if (
      typeof customerLat === "number" && typeof customerLng === "number" &&
      typeof restLat === "number" && typeof restLng === "number" &&
      !Number.isNaN(restLat) && !Number.isNaN(restLng)
    ) {
      distance = haversineDistance(restLat, restLng, customerLat, customerLng)
    } else {
      distance = await calculateDistance(restaurantAddress, deliveryAddress)
    }

    // Validate platform settings - no fallbacks allowed
    if (settingsResult.error || !settingsResult.data) {
      throw new Error(`platform_settings query failed: ${settingsResult.error?.message || "No data returned"}`)
    }
    if (settingsResult.data.delivery_fee_subsidy === null || settingsResult.data.delivery_fee_subsidy === undefined) {
      throw new Error("delivery_fee_subsidy is not set in platform_settings. This value must be configured.")
    }
    
    const subsidy = Number(settingsResult.data.delivery_fee_subsidy)
    const minFee = Number(restaurantResult.data?.delivery_fee ?? 0)
    const { data: zones, error } = zonesResult
    
    if (error || !zones || zones.length === 0) {
      // No zones configured — delivery unavailable
      return {
        success: false,
        fee: 0,
        displayedFee: 0,
        subsidy: 0,
        distance,
        zoneName: "",
        itemSurcharge: 0,
        error: "Delivery zones not configured for this restaurant.",
      }
    }

    // Find matching zone
    const matchingZone = zones.find((zone) => distance >= zone.min_distance && distance <= zone.max_distance)

    if (!matchingZone) {
      // Distance outside all zones
      return {
        success: false,
        fee: 0,
        displayedFee: 0,
        subsidy: 0,
        distance,
        zoneName: "",
        itemSurcharge: 0,
        error: `Delivery not available for ${distance.toFixed(1)} miles. Maximum delivery distance is ${Math.max(...zones.map((z) => z.max_distance))} miles.`,
      }
    }

    // Calculate item surcharge if applicable
    let itemSurcharge = 0
    if (itemCount > matchingZone.min_items_for_surcharge && matchingZone.per_item_surcharge > 0) {
      const extraItems = itemCount - matchingZone.min_items_for_surcharge
      itemSurcharge = extraItems * matchingZone.per_item_surcharge
    }

    // Apply minimum fee floor from restaurant config
    const totalFee = Math.max(Number(matchingZone.base_fee) + itemSurcharge, minFee)
    const displayedFee = Math.max(0, totalFee - subsidy)

    return {
      success: true,
      fee: totalFee,
      displayedFee,
      subsidy,
      distance,
      zoneName: matchingZone.zone_name,
      itemSurcharge,
    }
  } catch (err) {
    console.error("[v0] Error calculating delivery fee:", err)
    return {
      success: false,
      fee: 0,
      displayedFee: 0,
      subsidy: 0,
      distance: 0,
      zoneName: "",
      itemSurcharge: 0,
      error: "Failed to calculate delivery fee. Please try again.",
    }
  }
}

// Calculate delivery fee using customer lat/lng directly (no geocoding needed)
export async function calculateDeliveryFeeByCoords(params: {
  restaurantId: string
  customerLat: number
  customerLng: number
  restaurantLat: number
  restaurantLng: number
  itemCount: number
}): Promise<CalculateDeliveryFeeResult> {
  try {
    const { restaurantId, customerLat, customerLng, restaurantLat, restaurantLng, itemCount } = params

    const distance = haversineDistance(restaurantLat, restaurantLng, customerLat, customerLng)

    const supabase = await createServerClient()
    const [zonesResult, settingsResult, restaurantResult] = await Promise.all([
      supabase
        .from("delivery_zones")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("platform_settings")
        .select("delivery_fee_subsidy")
        .eq("tent", "online_ordering")
        .single(),
      supabase
        .from("restaurants")
        .select("delivery_fee")
        .eq("id", restaurantId)
        .single(),
    ])

    // Validate platform settings - no fallbacks allowed
    if (settingsResult.error || !settingsResult.data) {
      throw new Error(`platform_settings query failed: ${settingsResult.error?.message || "No data returned"}`)
    }
    if (settingsResult.data.delivery_fee_subsidy === null || settingsResult.data.delivery_fee_subsidy === undefined) {
      throw new Error("delivery_fee_subsidy is not set in platform_settings. This value must be configured.")
    }
    
    const subsidy = Number(settingsResult.data.delivery_fee_subsidy)
    const minFee = Number(restaurantResult.data?.delivery_fee ?? 0)
    const { data: zones, error } = zonesResult

    if (error || !zones || zones.length === 0) {
      return { success: false, fee: 0, displayedFee: 0, subsidy: 0, distance, zoneName: "", itemSurcharge: 0, error: "Delivery zones not configured." }
    }

    const matchingZone = zones.find((z) => distance >= z.min_distance && distance <= z.max_distance)
    if (!matchingZone) {
      return {
        success: false, fee: 0, displayedFee: 0, subsidy: 0, distance, zoneName: "", itemSurcharge: 0,
        error: `Delivery not available for ${distance.toFixed(1)} miles. Maximum is ${Math.max(...zones.map((z) => z.max_distance))} miles.`,
      }
    }

    let itemSurcharge = 0
    if (itemCount > matchingZone.min_items_for_surcharge && matchingZone.per_item_surcharge > 0) {
      itemSurcharge = (itemCount - matchingZone.min_items_for_surcharge) * matchingZone.per_item_surcharge
    }

    // Apply minimum fee floor from restaurant config
    const totalFee = Math.max(Number(matchingZone.base_fee) + itemSurcharge, minFee)
    return {
      success: true,
      fee: totalFee,
      displayedFee: Math.max(0, totalFee - subsidy),
      subsidy,
      distance,
      zoneName: matchingZone.zone_name,
      itemSurcharge,
    }
  } catch (error) {
    console.error("[v0] Error calculating delivery fee by coords:", error)
    return { success: false, fee: 0, displayedFee: 0, subsidy: 0, distance: 0, zoneName: "", itemSurcharge: 0, error: "Failed to calculate delivery fee." }
  }
}

// Haversine formula to calculate distance between two lat/lng points in miles
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Geocode an address to lat/lng using Google Maps Geocoding API
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) return null

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
    url.searchParams.append("address", address)
    url.searchParams.append("key", apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== "OK" || !data.results || data.results.length === 0) return null

    const { lat, lng } = data.results[0].geometry.location
    return { lat, lng }
  } catch {
    return null
  }
}

interface CheckDeliveryZoneResult {
  inZone: boolean
  distance: number | null
  radius: number
  closerBranch: { id: string; name: string; address: string; distance: number } | null
}

// Check if a delivery address is within the branch's delivery radius.
// If out of zone, find the closest branch from the same restaurant.
export async function checkDeliveryZone(
  restaurantId: string,
  branchId: string,
  deliveryAddress: string,
  customerCoords?: { lat: number; lng: number } | null,
): Promise<CheckDeliveryZoneResult> {
  const defaultResult: CheckDeliveryZoneResult = { inZone: true, distance: null, radius: 4, closerBranch: null }

  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    // We still need Google either way - geocode fallback or Routes API
    // for legacy callers, and Haversine doesn't need the key when we
    // already have both endpoints' coords. Only skip-out if we have
    // neither a key nor customer coords.
    if (!apiKey && !customerCoords) return defaultResult

    const supabase = await createServerClient()

    // Get all branches for this restaurant
    const { data: branches, error } = await supabase
      .from("branches")
      .select("id, name, address, city, state, zip, latitude, longitude, delivery_radius")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)

    if (error || !branches || branches.length === 0) return defaultResult

    // Get the restaurant-level default radius
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("delivery_radius")
      .eq("id", restaurantId)
      .single()

    const defaultRadius = restaurant?.delivery_radius ?? 4.0

    // Find the current branch
    const currentBranch = branches.find((b) => b.id === branchId)
    if (!currentBranch) return defaultResult

    const branchRadius = currentBranch.delivery_radius ?? defaultRadius

    // Prefer caller-supplied pin coords. Only fall back to geocoding
    // the typed delivery address when they were not provided.
    const coords =
      (customerCoords && typeof customerCoords.lat === "number" && typeof customerCoords.lng === "number")
        ? customerCoords
        : await geocodeAddress(deliveryAddress)
    if (!coords) return defaultResult // Can't geocode -- allow order

    // If branch has lat/lng, use Haversine; otherwise use Google Distance Matrix
    let distanceToBranch: number | null = null

    if (currentBranch.latitude && currentBranch.longitude) {
      distanceToBranch = haversineDistance(
        currentBranch.latitude, currentBranch.longitude,
        coords.lat, coords.lng
      )
    } else {
      // Fallback: use the branch address string
      const branchAddr = [currentBranch.address, currentBranch.city, currentBranch.state, currentBranch.zip].filter(Boolean).join(", ")
      distanceToBranch = await calculateDistance(branchAddr, deliveryAddress)
    }

    const inZone = distanceToBranch <= branchRadius

    // If in zone, return early
    if (inZone) {
      return { inZone: true, distance: distanceToBranch, radius: branchRadius, closerBranch: null }
    }

    // Out of zone -- find the closest branch
    let closerBranch: CheckDeliveryZoneResult["closerBranch"] = null

    const otherBranches = branches.filter((b) => b.id !== branchId)
    for (const branch of otherBranches) {
      let dist: number | null = null
      if (branch.latitude && branch.longitude) {
        dist = haversineDistance(branch.latitude, branch.longitude, coords.lat, coords.lng)
      } else {
        const addr = [branch.address, branch.city, branch.state, branch.zip].filter(Boolean).join(", ")
        dist = await calculateDistance(addr, deliveryAddress)
      }

      if (dist !== null) {
        const thisBranchRadius = branch.delivery_radius ?? defaultRadius
        if (dist <= thisBranchRadius && (!closerBranch || dist < closerBranch.distance)) {
          closerBranch = {
            id: branch.id,
            name: branch.name,
            address: [branch.address, branch.city, branch.state].filter(Boolean).join(", "),
            distance: Math.round(dist * 10) / 10,
          }
        }
      }
    }

    return {
      inZone: false,
      distance: Math.round(distanceToBranch * 10) / 10,
      radius: branchRadius,
      closerBranch,
    }
  } catch (error) {
    console.error("[v0] Error checking delivery zone:", error)
    return defaultResult
  }
}

// Calculate distance between two addresses using Google Routes API (New).
// Falls back to geocoding + Haversine if Routes API fails (Task #55 migration).
async function calculateDistance(origin: string, destination: string): Promise<number> {
  const DEFAULT_DISTANCE = 0.5 // Default fallback distance in miles (uses Tier 1 pricing)

  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      console.log("[v0] No Google Maps API key, using default distance")
      return DEFAULT_DISTANCE
    }

    // Routes API (New) -- computeRouteMatrix. Replaces legacy Distance Matrix API.
    // Docs: https://developers.google.com/maps/documentation/routes/compute_route_matrix
    const response = await fetch(
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "originIndex,destinationIndex,distanceMeters,status,condition",
        },
        body: JSON.stringify({
          origins: [{ waypoint: { address: origin } }],
          destinations: [{ waypoint: { address: destination } }],
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_UNAWARE",
        }),
      }
    )

    if (response.ok) {
      const data = await response.json()
      // Response is a JSON array of matrix entries (one per origin x destination pair).
      const entry = Array.isArray(data) ? data[0] : null
      if (
        entry &&
        entry.condition === "ROUTE_EXISTS" &&
        typeof entry.distanceMeters === "number"
      ) {
        return entry.distanceMeters / 1609.34
      }
    } else {
      const errBody = await response.text().catch(() => "")
      console.warn(
        "[delivery-zones] Routes API HTTP",
        response.status,
        errBody.slice(0, 300)
      )
    }

    // Routes API failed - try geocoding both addresses and use Haversine
    console.log("[v0] Routes API failed, trying geocoding fallback")
    const [originCoords, destCoords] = await Promise.all([
      geocodeAddress(origin),
      geocodeAddress(destination)
    ])

    if (originCoords && destCoords) {
      const distance = haversineDistance(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng)
      console.log("[v0] Haversine distance calculated:", distance)
      return distance
    }

    // All methods failed - return default distance
    console.log("[v0] All distance methods failed, using default:", DEFAULT_DISTANCE)
    return DEFAULT_DISTANCE
  } catch (error) {
    console.error("[v0] Error calculating distance:", error)
    return DEFAULT_DISTANCE
  }
}
