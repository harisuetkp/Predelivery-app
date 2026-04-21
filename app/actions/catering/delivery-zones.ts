"use server"

import { createClient } from "@/lib/supabase/server"

export interface CateringDeliveryZoneResult {
  isWithinZone: boolean
  deliveryFee: number
  zoneName?: string
  distance?: number
  errorMessage?: string
}

export async function calculateCateringDeliveryFee(
  restaurantId: string,
  branchId: string,
  customerAddress: string,
  customerCity: string,
  customerState: string,
  customerCoords?: { lat: number; lng: number } | null,
): Promise<CateringDeliveryZoneResult> {
  try {
    const supabase = await createClient()

    // Fetch branch coordinates
    const { data: branch, error: branchError } = await supabase
      .from("catering_branches")
      .select("latitude, longitude, address, city, state")
      .eq("id", branchId)
      .single()

    if (branchError || !branch) {
      throw new Error(`Catering branch not found: ${branchId}`)
    }

    if (!branch.latitude || !branch.longitude) {
      // No coordinates — fetch delivery zones by zone name match
      const { data: zones, error: zonesError } = await supabase
        .from("catering_delivery_zones")
        .select("*")
        .eq("catering_restaurant_id", restaurantId)
        .order("min_distance", { ascending: true })

      if (zonesError) {
        throw new Error(`Failed to fetch catering delivery zones: ${zonesError.message}`)
      }

      if (!zones || zones.length === 0) {
        return { isWithinZone: true, deliveryFee: 0 }
      }

      // Default to first zone if no coordinates available
      const defaultZone = zones[0]
      return {
        isWithinZone: true,
        deliveryFee: defaultZone.delivery_fee || 0,
        zoneName: defaultZone.zone_name || "Default",
      }
    }

    // Calculate distance using Haversine formula. Prefer the
    // confirmed pin coords when supplied; otherwise geocode the
    // typed address as a fallback for legacy callers.
    let customerLat: number
    let customerLng: number
    if (
      customerCoords &&
      typeof customerCoords.lat === "number" &&
      typeof customerCoords.lng === "number"
    ) {
      customerLat = customerCoords.lat
      customerLng = customerCoords.lng
    } else {
      const customerFullAddress = `${customerAddress}, ${customerCity}, ${customerState}`
      const geocodeUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://prdelivery.com"}/api/places/geocode?address=${encodeURIComponent(customerFullAddress)}`

      const geocodeResponse = await fetch(geocodeUrl)
      if (!geocodeResponse.ok) {
        // Cannot geocode — return no delivery fee
        return { isWithinZone: true, deliveryFee: 0 }
      }

      const geocodeData = await geocodeResponse.json()
      if (!geocodeData.lat || !geocodeData.lng) {
        return { isWithinZone: true, deliveryFee: 0 }
      }
      customerLat = geocodeData.lat
      customerLng = geocodeData.lng
    }

    const distance = haversineDistance(
      branch.latitude,
      branch.longitude,
      customerLat,
      customerLng
    )

    // Fetch delivery zones
    const { data: zones, error: zonesError } = await supabase
      .from("catering_delivery_zones")
      .select("*")
      .eq("catering_restaurant_id", restaurantId)
      .order("min_distance", { ascending: true })

    if (zonesError) {
      throw new Error(`Failed to fetch catering delivery zones: ${zonesError.message}`)
    }

    if (!zones || zones.length === 0) {
      return { isWithinZone: true, deliveryFee: 0, distance }
    }

    // Find matching zone
    for (const zone of zones) {
      const minDist = zone.min_distance || 0
      const maxDist = zone.max_distance || Infinity
      if (distance >= minDist && distance <= maxDist) {
        return {
          isWithinZone: true,
          deliveryFee: zone.delivery_fee || 0,
          zoneName: zone.zone_name,
          distance,
        }
      }
    }

    // Outside all zones
    return {
      isWithinZone: false,
      deliveryFee: 0,
      distance,
      errorMessage: "Lo sentimos, no realizamos entregas a esta dirección.",
    }

  } catch (error: any) {
    console.error("[catering/delivery-zones] Error:", error)
    throw new Error(`Failed to calculate catering delivery fee: ${error.message}`)
  }
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

export interface CheckDeliveryZoneResult {
  inZone: boolean
  message?: string
  distance?: number
}

export async function checkDeliveryZone(
  restaurantId: string,
  branchId: string,
  fullAddress: string,
  customerCoords?: { lat: number; lng: number } | null,
): Promise<CheckDeliveryZoneResult> {
  try {
    // Parse city and state from full address
    const parts = fullAddress.split(",").map(p => p.trim())
    const cityState = parts.length >= 2 ? parts[parts.length - 2] : ""
    const city = cityState || ""
    const state = parts.length >= 1 ? parts[parts.length - 1].replace(/\d+/g, "").trim() : ""
    const streetAddress = parts.length >= 3 ? parts.slice(0, -2).join(", ") : fullAddress

    const result = await calculateCateringDeliveryFee(
      restaurantId,
      branchId,
      streetAddress,
      city,
      state,
      customerCoords,
    )

    return {
      inZone: result.isWithinZone,
      message: result.errorMessage,
      distance: result.distance,
    }
  } catch (error: any) {
    console.error("[catering/checkDeliveryZone] Error:", error)
    return {
      inZone: false,
      message: "No pudimos verificar la zona de entrega. Por favor intente de nuevo.",
    }
  }
}
