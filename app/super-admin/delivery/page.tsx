// Super Admin Page - Last updated: March 19, 2026 - KDS Button Added
import { createClient } from "@/lib/supabase/server"
import { SuperAdminClient } from "../components/super-admin-client"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"
export const revalidate = 0 // Force no caching - rebuild required

export default async function SuperAdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Resolve operator_id from authenticated admin user (multi-tenant)
  const { data: adminSelf, error: adminSelfError } = await supabase
    .from("admin_users")
    .select("operator_id, role")
    .eq("auth_user_id", user.id)
    .single()

  if (adminSelfError || !adminSelf?.operator_id) {
    console.error(
      "admin_users record not found for authenticated user (cannot resolve operator_id)",
      adminSelfError,
    )
    redirect("/auth/login")
  }

  const operatorId = adminSelf.operator_id as string

  // Fetch all restaurants with counts - alphabetically ordered
  const { data: restaurants, error: restaurantsError } = await supabase
    .from("restaurants")
    .select("*")
    .eq("operator_id", operatorId)
    .order("name", { ascending: true })

  if (restaurantsError) {
    console.error("Error fetching restaurants:", restaurantsError)
  }

  // Fetch counts - need to handle Supabase's default 1000 row limit
  // Fetch in batches or use count aggregation
  let allMenuCounts: { restaurant_id: string }[] = []
  let offset = 0
  const batchSize = 1000

  const restaurantIds = (restaurants || []).map((r: any) => r.id)
  
  // Fetch menu items in batches to get all of them
  while (true) {
    const { data: batch, error } = await supabase
      .from("menu_items")
      .select("restaurant_id")
      .in("restaurant_id", restaurantIds)
      .range(offset, offset + batchSize - 1)
    
    if (error) {
      console.error("[v0] Super Admin - Error fetching menu items:", error.message)
      break
    }
    
    if (!batch || batch.length === 0) break
    allMenuCounts = [...allMenuCounts, ...batch]
    if (batch.length < batchSize) break
    offset += batchSize
  }
  
  console.log("[v0] Super Admin - Total menu items fetched:", allMenuCounts.length)
  
  // Fetch categories (usually less than 1000 total)
  const { data: categoryCounts } = await supabase
    .from("categories")
    .select("restaurant_id")
    .eq("operator_id", operatorId)
  
  // Fetch orders (usually less than 1000 for now)
  const { data: orderCounts } = await supabase
    .from("orders")
    .select("restaurant_id")
    .eq("operator_id", operatorId)

  // Fetch platform settings (single source of truth) - includes hero settings and operations settings
  const { data: platformSettings } = await supabase
    .from("platform_settings")
    .select("*")
    .eq("operator_id", operatorId)
    .eq("tent", "online_ordering")
    .maybeSingle()
  
  // Fetch active scheduled blocks
  const { data: scheduledBlocks } = await supabase
    .from("scheduled_blocks")
    .select("*, restaurants(name)")
    .eq("is_active", true)
    .eq("operator_id", operatorId)
    .order("starts_at", { ascending: true })

  // Fetch cuisine types
  const { data: cuisineTypes } = await supabase
    .from("cuisine_types")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })

  // Fetch marketplace areas
  const { data: marketplaceAreas } = await supabase
    .from("marketplace_areas")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })

  // Fetch admin users for admin management tab
  const { data: adminUsers } = await supabase
    .from("admin_users")
    .select("*, restaurants(name, slug)")
    .eq("operator_id", operatorId)
    .order("created_at", { ascending: false })

  // Fetch operator platform hours (breakfast/lunch/dinner)
  const { data: operatorHours, error: operatorHoursError } = await supabase
    .from("operator_hours")
    .select("*")
    .eq("operator_id", operatorId)
    .order("day_of_week", { ascending: true })

  if (operatorHoursError) {
    console.error("operator_hours query failed:", operatorHoursError)
  }
  const operatorHoursResolved = operatorHoursError ? [] : (operatorHours ?? [])

  // Aggregate counts
  const menuCountMap: Record<string, number> = {}
  const orderCountMap: Record<string, number> = {}
  const categoryCountMap: Record<string, number> = {}

  allMenuCounts.forEach((item) => {
    if (item.restaurant_id) {
      menuCountMap[item.restaurant_id] = (menuCountMap[item.restaurant_id] || 0) + 1
    }
  })
  
  console.log("[v0] Super Admin - menuCountMap has", Object.keys(menuCountMap).length, "restaurants with items")

  orderCounts?.forEach((item) => {
    orderCountMap[item.restaurant_id] = (orderCountMap[item.restaurant_id] || 0) + 1
  })

  categoryCounts?.forEach((item) => {
    categoryCountMap[item.restaurant_id] = (categoryCountMap[item.restaurant_id] || 0) + 1
  })

  // Combine data
  const restaurantsWithCounts = (restaurants || []).map((restaurant) => ({
    ...restaurant,
    menu_items_count: menuCountMap[restaurant.id] || 0,
    orders_count: orderCountMap[restaurant.id] || 0,
    categories_count: categoryCountMap[restaurant.id] || 0,
  }))

  return (
    <SuperAdminClient 
      restaurants={restaurantsWithCounts} 
      operatorId={operatorId}
      operatorHours={operatorHoursResolved}
      marketplaceSettings={platformSettings ? {
        id: platformSettings.id,
        hero_title: platformSettings.hero_title,
        hero_subtitle: platformSettings.hero_subtitle,
        hero_image_url: platformSettings.hero_image_url,
      } : undefined} 
      initialCuisineTypes={cuisineTypes || []} 
      initialMarketplaceAreas={marketplaceAreas || []}
      platformSettings={platformSettings}
      scheduledBlocks={scheduledBlocks || []}
      adminUsers={adminUsers || []}
    />
  )
}
