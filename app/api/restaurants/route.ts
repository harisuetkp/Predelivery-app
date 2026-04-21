"use server"

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getPlatformSettings } from "@/lib/availability"

// GET /api/restaurants - Returns all active restaurants
export async function GET() {
  try {
    const supabase = await createClient()

    // Check if POP restaurants are blocked
    const platformSettings = await getPlatformSettings()
    const isPOPBlocked = platformSettings?.is_pop_blocked ?? false

    const { data: restaurants, error } = await supabase
      .from("restaurants")
      .select(`
        id,
        slug,
        name,
        logo_url,
        restaurant_address,
        phone,
        marketplace_image_url,
        cuisine_type,
        hero_image_url,
        is_active,
        payment_type,
        block_override
      `)
      .eq("is_active", true)
      .order("name")

    if (error) {
      console.error("Error fetching restaurants:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter out blocked POP restaurants and map to expected format
    const formattedRestaurants = restaurants
      ?.filter((r) => {
        // Skip if POP restaurant is blocked (unless it has an override)
        if (isPOPBlocked && r.payment_type === 'pop' && !r.block_override) {
          return false
        }
        return true
      })
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        logo_url: r.logo_url,
        address: r.restaurant_address,
        phone: r.phone,
        image_url: r.marketplace_image_url || r.hero_image_url,
        cuisine_type: r.cuisine_type,
      })) || []

    return NextResponse.json(formattedRestaurants)
  } catch (error) {
    console.error("Error in GET /api/restaurants:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
