import { createClient } from "@/lib/supabase/server"
import type { Operator } from "@/contexts/operator-context"

export interface CateringRestaurant {
  id: string
  restaurant_id: string | null
  slug: string
  name: string
  description: string | null
  logo_url: string | null
  hero_image_url: string | null
  default_item_image_url: string | null
  primary_color: string | null
  cuisine_type: string | null
  cuisine_types: string[] | null
  design_template: string | null
  custom_domain: string | null
  is_active: boolean
  show_in_marketplace: boolean
  show_service_packages: boolean | null
  is_chain: boolean
  default_lead_time_hours: number
  max_advance_days: number
  tax_rate: number
  delivery_fee: number | null
  tip_option_1: number | null
  tip_option_2: number | null
  tip_option_3: number | null
  tip_option_4: number | null
  default_tip_option: number | null
  operator_id: string | null
  created_at: string
  // Dispatch fee configuration
  dispatch_fee_type: "none" | "fixed" | "percentage" | "per_order" | null
  dispatch_fee_value: number | null
  dispatch_fee_applies_to: "entrega" | "recogido" | "both" | null
}

export interface CateringCategory {
  id: string
  catering_restaurant_id: string
  name: string
  description: string | null
  display_order: number
  is_active: boolean
}

export interface CateringItemSize {
  id: string
  catering_menu_item_id: string
  catering_name: string
  catering_price: number
  catering_serves: string | null
  catering_is_default: boolean
  catering_display_order: number
}

export interface CateringItemOptionChoice {
  id: string
  catering_item_option_id: string
  catering_name: string
  catering_price_modifier: number
  catering_display_order: number
  catering_is_active: boolean
}

export interface CateringItemOption {
  id: string
  catering_menu_item_id: string
  catering_name: string
  catering_prompt: string | null
  catering_is_required: boolean
  catering_min_selections: number
  catering_max_selections: number
  catering_display_type: string
  catering_display_order: number
  item_option_choices: CateringItemOptionChoice[]
}

export interface CateringMenuItem {
  id: string
  catering_restaurant_id: string
  catering_category_id: string
  name: string
  description: string | null
  image_url: string | null
  price: number
  base_price?: number
  selling_unit: string | null
  min_quantity: number | null
  is_active: boolean
  display_order: number
  sizes?: CateringItemSize[]
  item_options?: CateringItemOption[]
}

export interface CateringBranch {
  id: string
  catering_restaurant_id: string
  name: string
  address: string
  city: string
  state: string
  zip_code: string
  phone: string | null
  is_active: boolean
  latitude: number | null
  longitude: number | null
  /** Stripe Connect destination for this branch (catering checkout). */
  stripe_account_id?: string | null
}

export interface CateringServicePackage {
  id: string
  catering_restaurant_id: string
  name: string
  description: string | null
  base_price: number
  image_url: string | null
  is_active: boolean
  display_order: number
  created_at: string
  inclusions?: CateringPackageInclusion[]
  addons?: CateringPackageAddon[]
}

export interface CateringPackageInclusion {
  id: string
  catering_service_package_id: string
  description: string | null
  is_active: boolean
  display_order: number
  created_at: string
}

export interface CateringPackageAddon {
  id: string
  catering_service_package_id: string
  name: string
  price: number
  unit_label: string | null
  is_active: boolean
  display_order: number
  created_at: string
}

export interface CateringDeliveryZone {
  id: string
  catering_restaurant_id: string
  catering_branch_id: string | null
  min_distance: number
  max_distance: number
  base_fee: number
  created_at: string
}

/**
 * Validates that the operator has catering enabled and landing page visible.
 * Throws an error with a specific code if validation fails.
 */
export function validateOperatorForCatering(operator: Operator): void {
  if (!operator.catering_enabled) {
    const error = new Error("Catering is not enabled for this operator")
    ;(error as any).code = "CATERING_DISABLED"
    throw error
  }

  if (!operator.show_catering_landing) {
    const error = new Error("Catering landing page is not enabled for this operator")
    ;(error as any).code = "CATERING_LANDING_DISABLED"
    throw error
  }
}

/**
 * Fetches all active catering restaurants for the marketplace.
 */
export async function getCateringRestaurants(): Promise<CateringRestaurant[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("catering_restaurants")
    .select("*")
    .eq("is_active", true)
    .eq("show_in_marketplace", true)
    .order("name")

  if (error) {
    throw new Error(`Failed to fetch catering restaurants: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error("No active catering restaurants found for this operator")
  }

  return data
}

/**
 * Fetches a single catering restaurant by slug.
 * Returns null if not found or not active.
 */
export async function getCateringRestaurantBySlug(
  slug: string
): Promise<CateringRestaurant | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("catering_restaurants")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("is_manually_blocked", false)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned - restaurant not found
      return null
    }
    throw new Error(`Failed to fetch catering restaurant: ${error.message}`)
  }

  return data
}

/**
 * Fetches a single catering restaurant by ID.
 * Used when middleware provides the ID via custom domain routing.
 * Returns null if not found or not active.
 */
export async function getCateringRestaurantById(
  id: string
): Promise<CateringRestaurant | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("catering_restaurants")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .eq("is_manually_blocked", false)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return null
    }
    throw new Error(`Failed to fetch catering restaurant by ID: ${error.message}`)
  }

  return data
}

/**
 * Fetches all data needed for a catering restaurant portal.
 */
export async function getCateringRestaurantFullData(restaurantId: string) {
  const supabase = await createClient()

  // Fetch categories
  const { data: categories, error: categoriesError } = await supabase
    .from("catering_categories")
    .select("*")
    .eq("catering_restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("display_order")

  if (categoriesError) {
    throw new Error(`Failed to fetch catering categories: ${categoriesError.message}`)
  }

  if (!categories) {
    throw new Error("Failed to fetch catering categories: no data returned")
  }

  // Fetch menu items
  const { data: menuItems, error: menuItemsError } = await supabase
    .from("catering_menu_items")
    .select("*")
    .eq("catering_restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("display_order")

  if (menuItemsError) {
    throw new Error(`Failed to fetch catering menu items: ${menuItemsError.message}`)
  }

  if (!menuItems) {
    throw new Error("Failed to fetch catering menu items: no data returned")
  }

  // Fetch item sizes for all menu items
  const menuItemIds = menuItems.map((item) => item.id)

  const { data: itemSizes, error: sizesError } = menuItemIds.length > 0
    ? await supabase
        .from("catering_item_sizes")
        .select("*")
        .in("catering_menu_item_id", menuItemIds)
        .order("catering_display_order", { ascending: true })
    : { data: [], error: null }

  if (sizesError) {
    throw new Error(`Failed to fetch catering item sizes: ${sizesError.message}`)
  }

  // Fetch item options for all menu items
  const { data: itemOptions, error: optionsError } = menuItemIds.length > 0
    ? await supabase
        .from("catering_item_options")
        .select("*")
        .in("catering_menu_item_id", menuItemIds)
        .order("catering_display_order", { ascending: true })
    : { data: [], error: null }

  if (optionsError) {
    throw new Error(`Failed to fetch catering item options: ${optionsError.message}`)
  }

  // Fetch option choices for all options
  const optionIds = (itemOptions || []).map((opt) => opt.id)

  const { data: optionChoices, error: choicesError } = optionIds.length > 0
    ? await supabase
        .from("catering_item_option_choices")
        .select("*")
        .in("catering_item_option_id", optionIds)
        .eq("catering_is_active", true)
        .order("catering_display_order", { ascending: true })
    : { data: [], error: null }

  if (choicesError) {
    throw new Error(`Failed to fetch catering item option choices: ${choicesError.message}`)
  }

  // Attach sizes and options to menu items
  const menuItemsWithOptions = menuItems.map((item) => ({
    ...item,
    base_price: item.price,
    sizes: (itemSizes || []).filter((size) => size.catering_menu_item_id === item.id),
    item_options: (itemOptions || [])
      .filter((opt) => opt.catering_menu_item_id === item.id)
      .map((opt) => ({
        ...opt,
        item_option_choices: (optionChoices || []).filter(
          (choice) => choice.catering_item_option_id === opt.id
        ),
      })),
  }))

  // Fetch branches
  const { data: branches, error: branchesError } = await supabase
    .from("catering_branches")
    .select("*")
    .eq("catering_restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })

  if (branchesError) {
    throw new Error(`Failed to fetch catering branches: ${branchesError.message}`)
  }

  if (!branches) {
    throw new Error("Failed to fetch catering branches: no data returned")
  }

  // Fetch service packages with inclusions and addons
  const { data: packages, error: packagesError } = await supabase
    .from("catering_service_packages")
    .select("*")
    .eq("catering_restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("display_order")

  if (packagesError) {
    throw new Error(`Failed to fetch catering service packages: ${packagesError.message}`)
  }

  let servicePackages: CateringServicePackage[] = packages || []

  if (servicePackages.length > 0) {
    const packageIds = servicePackages.map((pkg) => pkg.id)

    // Fetch inclusions
    const { data: inclusions, error: inclusionsError } = await supabase
      .from("catering_package_inclusions")
      .select("*")
      .in("catering_service_package_id", packageIds)
      .eq("is_active", true)
      .order("display_order")

    if (inclusionsError) {
      throw new Error(`Failed to fetch package inclusions: ${inclusionsError.message}`)
    }

    // Fetch addons
    const { data: addons, error: addonsError } = await supabase
      .from("catering_package_addons")
      .select("*")
      .in("catering_service_package_id", packageIds)
      .eq("is_active", true)
      .order("display_order")

    if (addonsError) {
      throw new Error(`Failed to fetch package addons: ${addonsError.message}`)
    }

    // Attach inclusions and addons to packages
    servicePackages = servicePackages.map((pkg) => ({
      ...pkg,
      inclusions: (inclusions || []).filter((inc) => inc.catering_service_package_id === pkg.id),
      addons: (addons || []).filter((addon) => addon.catering_service_package_id === pkg.id),
    }))
  }

  // Fetch delivery zones (distance-based, no is_active flag)
  const { data: deliveryZones, error: zonesError } = await supabase
    .from("catering_delivery_zones")
    .select("*")
    .eq("catering_restaurant_id", restaurantId)
    .order("min_distance")

  if (zonesError) {
    throw new Error(`Failed to fetch catering delivery zones: ${zonesError.message}`)
  }

  if (!deliveryZones) {
    throw new Error("Failed to fetch catering delivery zones: no data returned")
  }

  return {
    categories,
    menuItems: menuItemsWithOptions,
    branches,
    servicePackages,
    deliveryZones,
  }
}
