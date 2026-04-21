import { createClient } from "@/lib/supabase/server"
import { CSRPortalClient } from "./csr-portal-client"
import { getPlatformSettings } from "@/lib/availability"

export const dynamic = "force-dynamic"

export default async function CSRPortalPage() {
  const supabase = await createClient()

  // Check if POP restaurants are blocked
  const platformSettings = await getPlatformSettings()
  const isPOPBlocked = platformSettings?.is_pop_blocked ?? false

  // Fetch all active delivery restaurants for the selector
  const { data: restaurants, error: restaurantsError } = await supabase
    .from("restaurants")
    .select(`
      id, name, slug, logo_url, cuisine_type, cuisine_types, area, tax_rate,
      delivery_fee, delivery_base_fee, dispatch_fee_percent,
      address, city, state,
      athmovil_public_token, athmovil_ecommerce_id, athmovil_enabled,
      stripe_account_id,
      payment_type,
      block_override
    `)
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (restaurantsError) {
    throw new Error(`Failed to fetch restaurants: ${restaurantsError.message}`)
  }

  // Fetch all active catering restaurants for the selector
  const { data: cateringRestaurants, error: cateringError } = await supabase
    .from("catering_restaurants")
    .select(`
      id, name, slug, logo_url, description, cuisine_type,
      tax_rate, default_lead_time_hours, max_advance_days,
      operator_id,
      dispatch_fee_type, dispatch_fee_value, dispatch_fee_applies_to
    `)
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (cateringError) {
    throw new Error(`Failed to fetch catering restaurants: ${cateringError.message}`)
  }

  return (
    <CSRPortalClient 
      restaurants={restaurants || []} 
      cateringRestaurants={cateringRestaurants || []}
      isPOPBlocked={isPOPBlocked} 
    />
  )
}
