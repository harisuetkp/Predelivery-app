import { createClient } from "@/lib/supabase/server"
import { CSRDispatchClient } from "./csr-dispatch-client"

export const dynamic = "force-dynamic"

export default async function CSRDispatchPage() {
  const supabase = await createClient()

  // Get current user and check if super admin
  const { data: { user } } = await supabase.auth.getUser()
  let isSuperAdmin = false
  
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single()
    
    isSuperAdmin = profile?.is_super_admin || false
  }

  // Get today's date at midnight for filtering
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  // Fetch orders from today onwards
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      *,
      order_items (id, item_name, quantity, unit_price, total_price, selected_options),
      restaurants (id, name, slug, logo_url, shipday_api_key, eatabit_enabled, eatabit_printer_id, payment_type)
    `)
    .gte("delivery_date", todayStr)
    .order("created_at", { ascending: false })
    .limit(100)

  // Fetch catering orders from today onwards.
  // Also pull routing fields from both the branch and restaurant so we can
  // filter out orders whose producing branch has opted out of Main Dispatch
  // (see catering_branches.route_to_main_dispatch / catering_restaurants
  // .route_to_main_dispatch_default). Branch value wins when non-null.
  const { data: cateringOrdersRaw } = await supabase
    .from("catering_orders")
    .select(`
      *,
      catering_restaurants (id, name, slug, logo_url, route_to_main_dispatch_default),
      catering_branches (id, name, route_to_main_dispatch)
    `)
    .gte("event_date", todayStr)
    .order("created_at", { ascending: false })
    .limit(100)

  // Resolver filter: branch override wins; if NULL, fall back to restaurant default;
  // if restaurant default is also NULL (shouldn't happen — column is NOT NULL with
  // default true), fall back to true so the order is visible by default.
  const cateringOrders = (cateringOrdersRaw ?? []).filter((row: any) => {
    const branchVal = row?.catering_branches?.route_to_main_dispatch
    const restVal = row?.catering_restaurants?.route_to_main_dispatch_default
    const effective =
      branchVal !== null && branchVal !== undefined
        ? branchVal
        : restVal !== null && restVal !== undefined
          ? restVal
          : true
    return effective === true
  })
  
  // Fetch all active restaurants for reference
  const { data: restaurants, error: restaurantsError } = await supabase
    .from("restaurants")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })
  
  if (restaurantsError) {
    console.error("[v0] Error fetching restaurants:", restaurantsError)
  }

  // Fetch active catering restaurants for catering mode
  const { data: cateringRestaurants, error: cateringError } = await supabase
    .from("catering_restaurants")
    .select("id, slug, name, description, logo_url, cuisine_type, default_lead_time_hours, max_advance_days, is_active, is_chain, tax_rate")
    .eq("is_active", true)
    .order("name", { ascending: true })
  
  if (cateringError) {
    throw new Error(`Failed to fetch catering restaurants: ${cateringError.message}`)
  }

  if (!cateringRestaurants || cateringRestaurants.length === 0) {
    throw new Error("No active catering restaurants found")
  }

  return (
    <CSRDispatchClient 
      initialOrders={orders || []} 
      initialCateringOrders={cateringOrders || []}
      restaurants={restaurants || []}
      cateringRestaurants={cateringRestaurants || []}
      isSuperAdmin={isSuperAdmin}
    />
  )
}
