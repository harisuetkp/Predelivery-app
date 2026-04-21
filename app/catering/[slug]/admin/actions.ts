"use server"

import { createClient } from "@/lib/supabase/server"

// ============================================
// CATEGORIES
// ============================================

export async function fetchCateringCategories(restaurantId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_categories")
    .select("*")
    .eq("catering_restaurant_id", restaurantId)
    .order("display_order", { ascending: true })
  if (error) throw new Error(`Failed to fetch catering categories: ${error.message}`)
  return data || []
}

export async function createCateringCategory(data: {
  catering_restaurant_id: string
  name: string
  description?: string
  display_order?: number
  is_active?: boolean
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_categories")
    .insert(data)
    .select()
    .single()
  if (error) throw new Error(`Failed to create catering category: ${error.message}`)
  return result
}

export async function updateCateringCategory(id: string, data: {
  name?: string
  description?: string
  display_order?: number
  is_active?: boolean
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_categories")
    .update(data)
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(`Failed to update catering category: ${error.message}`)
  return result
}

export async function deleteCateringCategory(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("catering_categories").delete().eq("id", id)
  if (error) throw new Error(`Failed to delete catering category: ${error.message}`)
}

export async function reorderCateringCategories(categories: { id: string; display_order: number }[]) {
  const supabase = await createClient()
  await Promise.all(categories.map(({ id, display_order }) =>
    supabase.from("catering_categories").update({ display_order }).eq("id", id)
  ))
}

// ============================================
// MENU ITEMS
// ============================================

function normalizeCateringSellingUnit(unit: string | null | undefined): string | null | undefined {
  if (unit == null) return unit
  // DB constraint expects legacy keys
  if (unit === "pound") return "per_pound"
  if (unit === "person") return "per_person"
  if (unit === "botella_750ml") return "bottle_750ml"
  return unit
}

export async function fetchCateringMenuItems(restaurantId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_menu_items")
    .select("*")
    .eq("catering_restaurant_id", restaurantId)
    .order("display_order", { ascending: true })
  if (error) throw new Error(`Failed to fetch catering menu items: ${error.message}`)
  return data || []
}

export async function createCateringMenuItem(data: {
  catering_restaurant_id: string
  catering_category_id: string
  name: string
  description?: string
  price: number
  image_url?: string
  selling_unit?: string
  is_active?: boolean
  display_order?: number
  min_quantity?: number
  serves?: string
  container_type?: string
  lead_time_hours?: number
  is_cart_upsell?: boolean
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_menu_items")
    .insert({ ...data, selling_unit: normalizeCateringSellingUnit(data.selling_unit), is_active: data.is_active ?? true })
    .select()
    .single()
  if (error) throw new Error(`Failed to create catering menu item: ${error.message}`)
  return result
}

export async function updateCateringMenuItem(id: string, data: {
  catering_category_id?: string
  name?: string
  description?: string
  price?: number
  image_url?: string
  selling_unit?: string | null
  is_active?: boolean
  display_order?: number
  min_quantity?: number | null
  serves?: string
  container_type?: string
  lead_time_hours?: number
  is_cart_upsell?: boolean
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_menu_items")
    .update({ ...data, selling_unit: normalizeCateringSellingUnit(data.selling_unit) })
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(`Failed to update catering menu item: ${error.message}`)
  return result
}

export async function deleteCateringMenuItem(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("catering_menu_items").delete().eq("id", id)
  if (error) throw new Error(`Failed to delete catering menu item: ${error.message}`)
}

export async function updateCateringMenuItemOrder(itemIds: string[]) {
  const supabase = await createClient()
  await Promise.all(itemIds.map((id, index) =>
    supabase.from("catering_menu_items").update({ display_order: index }).eq("id", id)
  ))
}

// ============================================
// ITEM SIZES
// ============================================

export async function getCateringItemSizes(menuItemId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_item_sizes")
    .select("*")
    .eq("catering_menu_item_id", menuItemId)
    .order("catering_display_order", { ascending: true })
  if (error) throw new Error(`Failed to fetch catering item sizes: ${error.message}`)
  return data || []
}

export async function createCateringItemSize(data: {
  catering_menu_item_id: string
  catering_name: string
  catering_price: number
  catering_serves?: string
  catering_is_default?: boolean
  catering_display_order?: number
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_item_sizes").insert(data).select().single()
  if (error) throw new Error(`Failed to create catering item size: ${error.message}`)
  return result
}

export async function updateCateringItemSize(id: string, data: {
  catering_name?: string
  catering_price?: number
  catering_serves?: string
  catering_is_default?: boolean
  catering_display_order?: number
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_item_sizes").update(data).eq("id", id).select().single()
  if (error) throw new Error(`Failed to update catering item size: ${error.message}`)
  return result
}

export async function deleteCateringItemSize(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("catering_item_sizes").delete().eq("id", id)
  if (error) throw new Error(`Failed to delete catering item size: ${error.message}`)
}

export async function getCateringSizesFromOtherItems(
  restaurantId: string,
  currentMenuItemId: string
): Promise<Array<{ size: any; menuItemName: string; menuItemId: string }>> {
  const supabase = await createClient()
  const { data: menuItems, error: menuError } = await supabase
    .from("catering_menu_items").select("id, name")
    .eq("catering_restaurant_id", restaurantId).neq("id", currentMenuItemId)
  if (menuError) throw new Error(menuError.message)
  if (!menuItems || menuItems.length === 0) return []
  const menuItemIds = menuItems.map((item) => item.id)
  const menuItemMap = new Map(menuItems.map((item) => [item.id, item.name]))
  const { data: sizes, error: sizesError } = await supabase
    .from("catering_item_sizes").select("*")
    .in("catering_menu_item_id", menuItemIds)
    .order("catering_display_order", { ascending: true })
  if (sizesError) throw new Error(sizesError.message)
  return (sizes || []).map((size) => ({
    size,
    menuItemName: menuItemMap.get(size.catering_menu_item_id) || "Unknown Item",
    menuItemId: size.catering_menu_item_id,
  }))
}

export async function copyCateringSizeToMenuItem(
  sourceSize: { catering_name: string; catering_price: number; catering_serves?: string },
  targetMenuItemId: string
): Promise<void> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("catering_item_sizes").select("catering_display_order")
    .eq("catering_menu_item_id", targetMenuItemId)
    .order("catering_display_order", { ascending: false }).limit(1)
  const nextOrder = existing && existing.length > 0 ? (existing[0].catering_display_order || 0) + 1 : 0
  const { error } = await supabase.from("catering_item_sizes").insert({
    catering_menu_item_id: targetMenuItemId,
    catering_name: sourceSize.catering_name,
    catering_price: sourceSize.catering_price,
    catering_serves: sourceSize.catering_serves || null,
    catering_is_default: false,
    catering_display_order: nextOrder,
  })
  if (error) throw new Error(error.message)
}

// ============================================
// ITEM OPTIONS
// ============================================

export async function getCateringItemOptions(menuItemId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_item_options").select("*")
    .eq("catering_menu_item_id", menuItemId)
    .order("catering_display_order", { ascending: true })
  if (error) throw new Error(`Failed to fetch catering item options: ${error.message}`)
  return data || []
}

export async function createCateringItemOption(data: {
  catering_menu_item_id: string
  catering_name: string
  catering_prompt?: string
  catering_is_required?: boolean
  catering_min_selections?: number
  catering_max_selections?: number
  catering_display_type?: string
  catering_display_order?: number
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_item_options").insert(data).select().single()
  if (error) throw new Error(`Failed to create catering item option: ${error.message}`)
  return result
}

export async function updateCateringItemOption(id: string, data: {
  catering_name?: string
  catering_prompt?: string
  catering_is_required?: boolean
  catering_min_selections?: number
  catering_max_selections?: number
  catering_display_type?: string
  catering_display_order?: number
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_item_options").update(data).eq("id", id).select().single()
  if (error) throw new Error(`Failed to update catering item option: ${error.message}`)
  return result
}

export async function deleteCateringItemOption(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("catering_item_options").delete().eq("id", id)
  if (error) throw new Error(`Failed to delete catering item option: ${error.message}`)
}

export async function getCateringOptionsFromOtherItems(
  restaurantId: string,
  currentMenuItemId: string
): Promise<Array<{ option: any; menuItemName: string; menuItemId: string }>> {
  const supabase = await createClient()
  const { data: menuItems, error: menuError } = await supabase
    .from("catering_menu_items").select("id, name")
    .eq("catering_restaurant_id", restaurantId).neq("id", currentMenuItemId)
  if (menuError) throw new Error(menuError.message)
  if (!menuItems || menuItems.length === 0) return []
  const menuItemIds = menuItems.map((item) => item.id)
  const menuItemMap = new Map(menuItems.map((item) => [item.id, item.name]))
  const { data: options, error: optionsError } = await supabase
    .from("catering_item_options")
    .select("*, catering_item_option_choices(*)")
    .in("catering_menu_item_id", menuItemIds)
    .order("catering_name", { ascending: true })
  if (optionsError) throw new Error(optionsError.message)
  return (options || []).map((option) => ({
    option,
    menuItemName: menuItemMap.get(option.catering_menu_item_id) || "Unknown Item",
    menuItemId: option.catering_menu_item_id,
  }))
}

export async function copyCateringOptionToMenuItem(
  sourceOption: any,
  targetMenuItemId: string,
  currentOptionsCount: number
): Promise<void> {
  const supabase = await createClient()
  const { data: newOption, error: optionError } = await supabase
    .from("catering_item_options").insert({
      catering_menu_item_id: targetMenuItemId,
      catering_name: sourceOption.catering_name,
      catering_prompt: sourceOption.catering_prompt || null,
      catering_is_required: sourceOption.catering_is_required || false,
      catering_min_selections: sourceOption.catering_min_selections || 0,
      catering_max_selections: sourceOption.catering_max_selections || 1,
      catering_display_type: sourceOption.catering_display_type || "pills",
      catering_display_order: currentOptionsCount,
    }).select().single()
  if (optionError) throw new Error(optionError.message)
  const choices = sourceOption.catering_item_option_choices || []
  if (choices.length > 0) {
    const { error: choicesError } = await supabase.from("catering_item_option_choices").insert(
      choices.map((choice: any, idx: number) => ({
        catering_item_option_id: newOption.id,
        catering_name: choice.catering_name,
        catering_price_modifier: choice.catering_price_modifier || 0,
        catering_display_order: idx,
        catering_is_active: true,
      }))
    )
    if (choicesError) {
      // Roll back the option header to avoid a phantom empty option.
      await supabase.from("catering_item_options").delete().eq("id", newOption.id)
      throw new Error(choicesError.message)
    }
  }
}

// ============================================
// ITEM OPTION CHOICES
// ============================================

export async function getCateringItemOptionChoices(optionId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_item_option_choices").select("*")
    .eq("catering_item_option_id", optionId)
    .order("catering_display_order", { ascending: true })
  if (error) throw new Error(`Failed to fetch catering item option choices: ${error.message}`)
  return data || []
}

export async function createCateringItemOptionChoice(data: {
  catering_item_option_id: string
  catering_name: string
  catering_price_modifier?: number
  catering_display_order?: number
  catering_is_active?: boolean
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_item_option_choices")
    .insert({ ...data, catering_is_active: data.catering_is_active ?? true })
    .select().single()
  if (error) throw new Error(`Failed to create catering item option choice: ${error.message}`)
  return result
}

export async function updateCateringItemOptionChoice(id: string, data: {
  catering_name?: string
  catering_price_modifier?: number
  catering_display_order?: number
  catering_is_active?: boolean
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_item_option_choices").update(data).eq("id", id).select().single()
  if (error) throw new Error(`Failed to update catering item option choice: ${error.message}`)
  return result
}

export async function deleteCateringItemOptionChoice(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("catering_item_option_choices").delete().eq("id", id)
  if (error) throw new Error(`Failed to delete catering item option choice: ${error.message}`)
}

// ============================================
// ORDERS
// ============================================

export async function fetchCateringOrders(restaurantId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_orders")
    .select("*, catering_order_items(*)")
    .eq("catering_restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(`Failed to fetch catering orders: ${error.message}`)
  return data || []
}

export async function updateCateringOrderStatus(orderId: string, status: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_orders").update({ status }).eq("id", orderId).select().single()
  if (error) throw new Error(`Failed to update catering order status: ${error.message}`)
  return data
}

export async function fetchCateringOrderItems(orderId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_order_items").select("*").eq("catering_order_id", orderId)
  if (error) throw new Error(`Failed to fetch catering order items: ${error.message}`)
  return data || []
}

// ============================================
// RESTAURANT SETTINGS
// ============================================

export async function updateCateringRestaurantSettings(id: string, data: {
  name?: string
  description?: string
  logo_url?: string | null
  banner_logo_url?: string | null
  hero_image_url?: string | null
  default_item_image_url?: string | null
  hide_branch_title?: boolean
  primary_color?: string
  cuisine_type?: string
  design_template?: string
  custom_domain?: string | null
  is_active?: boolean
  show_in_marketplace?: boolean
  notification_email?: string | null
  notification_method?: string
  restaurant_address?: string | null
  latitude?: number | null
  longitude?: number | null
  tax_rate?: number
  delivery_fee?: number
  minimum_order?: number
  default_lead_time_hours?: number
  max_advance_days?: number
  delivery_turnaround_hours?: number | null
  pickup_turnaround_hours?: number | null
  min_delivery_order?: number | null
  min_pickup_order?: number | null
  delivery_radius_miles?: number
  tip_option_1?: number | null
  tip_option_2?: number | null
  tip_option_3?: number | null
  enable_delivery?: boolean
  enable_pickup?: boolean
  stripe_enabled?: boolean
  stripe_account_id?: string | null
  athmovil_enabled?: boolean
  athmovil_public_token?: string | null
  athmovil_private_token?: string | null
  cash_payment_enabled?: boolean
  payment_track?: string
  shipday_api_key?: string | null
  kds_access_token?: string | null
  kds_setup_code?: string | null
kds_admin_pin?: string | null
  printer_tier?: string | null
  eatabit_restaurant_key?: string | null
  show_service_packages?: boolean
  packages_section_title?: string
  footer_description?: string | null
  footer_phone?: string | null
  footer_email?: string | null
  is_chain?: boolean
  // Chain-level Main Dispatch default. Read by lib/catering/branch-settings.ts
  // when a catering_branches.route_to_main_dispatch override is NULL.
  route_to_main_dispatch_default?: boolean
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_restaurants").update(data).eq("id", id).select().single()
  if (error) throw new Error(`Failed to update catering restaurant settings: ${error.message}`)
  return result
}

// ============================================
// OPERATING HOURS
// ============================================

export async function fetchCateringOperatingHours(restaurantId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_operating_hours").select("*")
    .eq("catering_restaurant_id", restaurantId)
    .order("day_of_week", { ascending: true })
  if (error) throw new Error(`Failed to fetch catering operating hours: ${error.message}`)
  return data || []
}

export async function saveCateringOperatingHours(
  restaurantId: string,
  hours: Array<{ day_of_week: number; is_open: boolean; open_time: string; close_time: string }>
) {
  const supabase = await createClient()
  for (const hour of hours) {
    const { error } = await supabase
      .from("catering_operating_hours")
      .upsert({
        catering_restaurant_id: restaurantId,
        day_of_week: hour.day_of_week,
        is_open: hour.is_open,
        open_time: hour.open_time,
        close_time: hour.close_time,
      }, { onConflict: "catering_restaurant_id,day_of_week" })
    if (error) throw new Error(`Failed to save operating hours for day ${hour.day_of_week}: ${error.message}`)
  }
}

// --- Per-branch operating hours (overrides chain defaults) -------------------
// Lives in `catering_branch_operating_hours` (additive table, added 2026-04-17).
// Resolver pattern: branch row wins for a given day_of_week, otherwise fall back
// to the chain-level row in `catering_operating_hours`.

export async function fetchCateringBranchOperatingHours(branchId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_branch_operating_hours")
    .select("*")
    .eq("catering_branch_id", branchId)
    .order("day_of_week", { ascending: true })
  if (error) throw new Error(`Failed to fetch catering branch operating hours: ${error.message}`)
  return data || []
}

/**
 * Save per-branch operating hours.
 *
 * For each day in `hours`:
 *  - If `inherit` is true, deletes the branch row for that day so it falls back
 *    to the chain default in `catering_operating_hours`.
 *  - Otherwise upserts the branch row.
 *
 * IMPORTANT: never writes to `catering_operating_hours` (chain defaults). That's
 * what `saveCateringOperatingHours` is for.
 */
export async function saveCateringBranchOperatingHours(
  branchId: string,
  hours: Array<{
    day_of_week: number
    is_open: boolean
    open_time: string | null
    close_time: string | null
    inherit?: boolean
  }>,
) {
  const supabase = await createClient()
  for (const hour of hours) {
    if (hour.inherit) {
      const { error } = await supabase
        .from("catering_branch_operating_hours")
        .delete()
        .eq("catering_branch_id", branchId)
        .eq("day_of_week", hour.day_of_week)
      if (error) {
        throw new Error(
          `Failed to clear branch operating hours for day ${hour.day_of_week}: ${error.message}`,
        )
      }
      continue
    }

    const { error } = await supabase
      .from("catering_branch_operating_hours")
      .upsert(
        {
          catering_branch_id: branchId,
          day_of_week: hour.day_of_week,
          is_open: hour.is_open,
          open_time: hour.open_time,
          close_time: hour.close_time,
        },
        { onConflict: "catering_branch_id,day_of_week" },
      )
    if (error) {
      throw new Error(
        `Failed to save branch operating hours for day ${hour.day_of_week}: ${error.message}`,
      )
    }
  }
}

// ============================================
// DELIVERY ZONES
// ============================================

export async function fetchCateringDeliveryZones(restaurantId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_delivery_zones").select("*")
    .eq("catering_restaurant_id", restaurantId)
    .order("display_order", { ascending: true })
  if (error) throw new Error(`Failed to fetch catering delivery zones: ${error.message}`)
  return data || []
}

export async function createCateringDeliveryZone(data: {
  catering_restaurant_id: string
  name: string
  min_miles: number
  max_miles: number
  delivery_fee: number
  display_order?: number
  is_active?: boolean
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_delivery_zones").insert(data).select().single()
  if (error) throw new Error(`Failed to create catering delivery zone: ${error.message}`)
  return result
}

export async function updateCateringDeliveryZone(id: string, data: {
  name?: string
  min_miles?: number
  max_miles?: number
  delivery_fee?: number
  display_order?: number
  is_active?: boolean
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_delivery_zones").update(data).eq("id", id).select().single()
  if (error) throw new Error(`Failed to update catering delivery zone: ${error.message}`)
  return result
}

export async function deleteCateringDeliveryZone(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("catering_delivery_zones").delete().eq("id", id)
  if (error) throw new Error(`Failed to delete catering delivery zone: ${error.message}`)
}

// ============================================
// CONTAINER RATES
// ============================================

export async function fetchCateringContainerRates(restaurantId: string) {
  const supabase = await createClient()
  const { data: baseRate } = await supabase
    .from("catering_container_rates").select("*")
    .eq("catering_restaurant_id", restaurantId).single()
  const { data: tiers, error: tiersError } = await supabase
    .from("catering_container_rate_tiers").select("*")
    .eq("catering_restaurant_id", restaurantId)
    .order("display_order", { ascending: true })
  if (tiersError) throw new Error(`Failed to fetch container rate tiers: ${tiersError.message}`)
  return { baseRate: baseRate || null, tiers: tiers || [] }
}

export async function upsertCateringContainerBaseRate(data: {
  catering_restaurant_id: string
  base_fee: number
  containers_included: number
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_container_rates")
    .upsert(data, { onConflict: "catering_restaurant_id" })
    .select().single()
  if (error) throw new Error(`Failed to upsert container base rate: ${error.message}`)
  return result
}

export async function upsertCateringContainerRateTier(data: {
  id?: string
  catering_restaurant_id: string
  container_type: string
  label: string
  extra_fee_per_unit: number
  display_order?: number
}) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from("catering_container_rate_tiers")
    .upsert(data, { onConflict: "id" })
    .select().single()
  if (error) throw new Error(`Failed to upsert container rate tier: ${error.message}`)
  return result
}

export async function deleteCateringContainerRateTier(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("catering_container_rate_tiers").delete().eq("id", id)
  if (error) throw new Error(`Failed to delete container rate tier: ${error.message}`)
}

// ============================================
// BRANCHES
// ============================================

export async function fetchCateringBranchesForAdmin(restaurantId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catering_branches").select("*")
    .eq("catering_restaurant_id", restaurantId)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
  if (error) throw new Error(`Failed to fetch catering branches: ${error.message}`)
  return data || []
}

export async function reorderCateringBranches(orderedIds: string[]) {
  const supabase = await createClient()
  
  // Update display_order for each branch based on its position in the array
  const updates = orderedIds.map((id, index) => 
    supabase
      .from("catering_branches")
      .update({ display_order: index })
      .eq("id", id)
  )
  
  const results = await Promise.all(updates)
  const errors = results.filter(r => r.error)
  
  if (errors.length > 0) {
    throw new Error(`Failed to reorder branches: ${errors[0].error?.message}`)
  }
}

// Per-branch override fields (Phase 1 migration added these as nullable columns
// on catering_branches; NULL = inherit from parent catering_restaurant).
export type CateringBranchOverrides = {
  // Delivery / pickup toggles
  enable_delivery?: boolean | null
  enable_pickup?: boolean | null
  delivery_radius_miles?: number | null
  delivery_fee?: number | null
  min_delivery_order?: number | null
  min_pickup_order?: number | null
  // Lead times (hours)
  default_lead_time_hours?: number | null
  delivery_turnaround_hours?: number | null
  pickup_turnaround_hours?: number | null
  // Notifications
  notification_email?: string | null
  notification_method?: string | null
  // Printer / KDS
  eatabit_restaurant_key?: string | null
  printer_tier?: string | null
  // Payments
  athmovil_enabled?: boolean | null
  athmovil_public_token?: string | null
  athmovil_private_token?: string | null
  cash_payment_enabled?: boolean | null
  stripe_enabled?: boolean | null
  tax_rate?: number | null
  // Main Dispatch routing (tri-state: null = inherit restaurant default)
  route_to_main_dispatch?: boolean | null
  // When route_to_main_dispatch is false, optionally redirect to a sibling branch
  // that actually produces the food. Null = order stays on this branch as pending.
  dispatch_hub_branch_id?: string | null
}

export async function createCateringBranch(restaurantId: string, data: {
  name: string
  address: string
  city: string
  state: string
  zip_code: string
  phone: string
  email: string
  latitude: number | null
  longitude: number | null
} & CateringBranchOverrides) {
  const supabase = await createClient()
  const { data: branch, error } = await supabase
    .from("catering_branches")
    .insert({ ...data, catering_restaurant_id: restaurantId, is_active: true })
    .select()
    .single()
  if (error) throw new Error(`Failed to create branch: ${error.message}`)
  return branch
}

export async function updateCateringBranch(branchId: string, data: {
  name?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  email?: string
  is_active?: boolean
  latitude?: number | null
  longitude?: number | null
} & CateringBranchOverrides) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("catering_branches")
    .update(data)
    .eq("id", branchId)
  if (error) throw new Error(`Failed to update branch: ${error.message}`)
}

export async function deleteCateringBranch(branchId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("catering_branches")
    .delete()
    .eq("id", branchId)
  if (error) throw new Error(`Failed to delete branch: ${error.message}`)
}

// ============================================
// CUISINE TYPES
// ============================================

export async function fetchCuisineTypes() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cuisine_types")
    .select("id, name")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
  if (error) throw new Error(`Failed to fetch cuisine types: ${error.message}`)
  return data || []
}
