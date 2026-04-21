import { createServerClient } from "@/lib/supabase/server"
import { MarketplaceHome } from "@/components/marketplace-home"
import { getRestaurantsOpenStatus, getPlatformSettings } from "@/lib/availability"

// Env vars updated - force rebuild
export default async function HomePage() {
  const supabase = await createServerClient()

  // Check if POP restaurants are blocked
  const platformSettings = await getPlatformSettings()
  const isPOPBlocked = platformSettings?.is_pop_blocked ?? false

  // Fetch all marketplace restaurants with coordinates for client-side filtering
  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("id, name, slug, logo_url, marketplace_image_url, primary_color, cuisine_type, cuisine_types, city, state, area, latitude, longitude, delivery_radius, delivery_radius_miles, delivery_zip_codes, delivery_enabled, payment_type, block_override")
    .eq("is_active", true)
    .eq("show_in_marketplace", true)
    .order("name")

  if (error) {
    console.error("Error fetching marketplace restaurants:", error)
    return <MarketplaceHome restaurants={[]} cuisineTypes={[]} />
  }

  // Filter out blocked POP restaurants (unless they have an override)
  const filteredRestaurants = restaurants?.filter(r => {
    if (isPOPBlocked && r.payment_type === 'pop' && !r.block_override) {
      return false
    }
    return true
  }) || []

  // Get open/closed status for all restaurants
  const restaurantIds = filteredRestaurants.map(r => r.id)
  const openStatusMap = await getRestaurantsOpenStatus(restaurantIds)
  
  // Merge open status into restaurant data
  const restaurantsWithStatus = filteredRestaurants.map(r => {
    const status = openStatusMap.get(r.id)
    return {
      ...r,
      isOpen: status?.isOpen ?? true,
      nextOpenTime: status?.nextOpenTime ?? null,
    }
  })

  // Fetch cuisine types from database
  const { data: cuisineTypes } = await supabase
    .from("cuisine_types")
    .select("id, name, icon_url, display_order")
    .eq("is_active", true)
    .order("display_order")

  // Fetch all settings from platform_settings (single source of truth)
  const { data: allPlatformSettings, error: settingsError } = await supabase
    .from("platform_settings")
    .select("hero_title, hero_subtitle, hero_image_url, blocked_zip_codes, marketplace_promo_variant_web, marketplace_promo_variant_mobile, marketplace_promo_variant_d_image_url, marketplace_promo_variant_d_href, marketplace_promo_variant_e_image_1_url, marketplace_promo_variant_e_image_1_href, marketplace_promo_variant_e_image_2_url, marketplace_promo_variant_e_image_2_href")
    .eq("tent", "online_ordering")
    .single()

  if (settingsError) {
    throw new Error(`platform_settings query failed: ${settingsError.message}`)
  }

  return (
    <MarketplaceHome
      restaurants={restaurantsWithStatus}
      marketplaceSettings={allPlatformSettings ? {
        hero_title: allPlatformSettings.hero_title,
        hero_subtitle: allPlatformSettings.hero_subtitle,
        hero_image_url: allPlatformSettings.hero_image_url,
      } : undefined}
      promoVariants={{
        web: (allPlatformSettings?.marketplace_promo_variant_web ?? "a") as "none" | "a" | "b" | "c" | "d" | "e",
        mobile: (allPlatformSettings?.marketplace_promo_variant_mobile ?? "a") as "none" | "a" | "b" | "c" | "d" | "e",
        dImageUrl: allPlatformSettings?.marketplace_promo_variant_d_image_url ?? null,
        dHref: allPlatformSettings?.marketplace_promo_variant_d_href ?? null,
        eImage1Url: allPlatformSettings?.marketplace_promo_variant_e_image_1_url ?? null,
        eImage1Href: allPlatformSettings?.marketplace_promo_variant_e_image_1_href ?? null,
        eImage2Url: allPlatformSettings?.marketplace_promo_variant_e_image_2_url ?? null,
        eImage2Href: allPlatformSettings?.marketplace_promo_variant_e_image_2_href ?? null,
      }}
      cuisineTypes={cuisineTypes || []}
      blockedZipCodes={allPlatformSettings?.blocked_zip_codes || []}
    />
  )
}
