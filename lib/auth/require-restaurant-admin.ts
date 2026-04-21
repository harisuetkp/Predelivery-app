import { createClient } from "@/lib/supabase/server"

/**
 * Gate admin server actions on (a) authenticated + (b) admin_users row
 * with access to the given restaurant.
 *
 * Platform roles (super_admin, manager, csr) can touch any restaurant.
 * Restaurant admins can only touch their own.
 *
 * Throws on any failure so callers can use plain try/await without
 * threading success/error contracts through every mutation.
 *
 * IMPORTANT: uses the cookie-scoped supabase client (not service-role),
 * so this call itself is subject to RLS and cannot be spoofed server-side.
 */
export async function requireRestaurantAdmin(restaurantId: string): Promise<{
  userId: string
  role: string
  adminRestaurantId: string | null
}> {
  if (!restaurantId || typeof restaurantId !== "string") {
    throw new Error("Forbidden: restaurantId is required")
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("Forbidden: not authenticated")
  }

  const { data: adminRow, error: adminError } = await supabase
    .from("admin_users")
    .select("role, restaurant_id")
    .eq("auth_user_id", user.id)
    .single()

  if (adminError || !adminRow) {
    throw new Error("Forbidden: not an admin")
  }

  const platformRoles = new Set(["super_admin", "manager", "csr"])
  const isPlatformRole = platformRoles.has(adminRow.role)
  const ownsRestaurant = adminRow.restaurant_id === restaurantId

  if (!isPlatformRole && !ownsRestaurant) {
    throw new Error("Forbidden: restaurant access denied")
  }

  return {
    userId: user.id,
    role: adminRow.role,
    adminRestaurantId: adminRow.restaurant_id,
  }
}

/**
 * Variant for actions scoped to a branch/category/menu item id where the
 * caller may only know the child id, not the parent restaurant id.
 * Looks up the owning restaurant_id on the given table and delegates.
 *
 * Throws if the row doesn't exist (treat as forbidden to avoid leaking
 * existence info).
 */
export async function requireAdminForRecord(
  table: "branches" | "categories" | "menu_items" | "item_options" | "item_option_choices" | "service_packages" | "delivery_zones" | "restaurant_hours" | "restaurant_hours_override" | "branch_menu_overrides" | "package_addons",
  recordId: string,
): Promise<{ userId: string; role: string; restaurantId: string }> {
  if (!recordId || typeof recordId !== "string") {
    throw new Error("Forbidden: recordId is required")
  }

  const supabase = await createClient()

  // item_option_choices and package_addons need a join to reach restaurant_id.
  let restaurantId: string | null = null

  if (table === "item_option_choices") {
    const { data } = await supabase
      .from("item_option_choices")
      .select("item_option_id, item_options!inner(menu_item_id, menu_items!inner(restaurant_id))")
      .eq("id", recordId)
      .single()
    restaurantId = (data as any)?.item_options?.menu_items?.restaurant_id ?? null
  } else if (table === "item_options") {
    const { data } = await supabase
      .from("item_options")
      .select("menu_item_id, menu_items!inner(restaurant_id)")
      .eq("id", recordId)
      .single()
    restaurantId = (data as any)?.menu_items?.restaurant_id ?? null
  } else if (table === "package_addons") {
    const { data } = await supabase
      .from("package_addons")
      .select("package_id, service_packages!inner(restaurant_id)")
      .eq("id", recordId)
      .single()
    restaurantId = (data as any)?.service_packages?.restaurant_id ?? null
  } else if (table === "branch_menu_overrides") {
    const { data } = await supabase
      .from("branch_menu_overrides")
      .select("branch_id, branches!inner(restaurant_id)")
      .eq("id", recordId)
      .single()
    restaurantId = (data as any)?.branches?.restaurant_id ?? null
  } else if (table === "restaurant_hours_override") {
    const { data } = await supabase
      .from(table)
      .select("restaurant_id")
      .eq("id", recordId)
      .single()
    restaurantId = (data as any)?.restaurant_id ?? null
  } else {
    // branches, categories, menu_items, service_packages, delivery_zones, restaurant_hours
    // all have restaurant_id directly.
    const { data } = await supabase
      .from(table)
      .select("restaurant_id")
      .eq("id", recordId)
      .single()
    restaurantId = (data as any)?.restaurant_id ?? null
  }

  if (!restaurantId) {
    throw new Error("Forbidden: record not found or inaccessible")
  }

  const { userId, role, adminRestaurantId } = await requireRestaurantAdmin(restaurantId)
  return { userId, role, restaurantId }
}
