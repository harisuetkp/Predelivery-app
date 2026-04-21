import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import CateringAdminClient from "./catering-admin-client"

export default async function CateringAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirect("/auth/login")
  }

  // Get catering restaurant by slug
  const { data: restaurant, error: restaurantError } = await supabase
    .from("catering_restaurants")
    .select("*")
    .eq("slug", slug)
    .single()

  if (restaurantError || !restaurant) {
    notFound()
  }

  // Check if user has access
  const { data: adminData } = await supabase
    .from("admin_users")
    .select("role, restaurant_id")
    .eq("auth_user_id", session.user.id)
    .single()

  if (!adminData) {
    redirect("/auth/login")
  }

  const platformRoles = ["super_admin", "manager", "csr"]
  const hasAccess =
    platformRoles.includes(adminData.role) ||
    adminData.restaurant_id === restaurant.restaurant_id

  if (!hasAccess) {
    redirect("/auth/login")
  }

  const isSuperAdmin = adminData.role === "super_admin"

  // Fetch initial data
  const { data: categories } = await supabase
    .from("catering_categories")
    .select("*")
    .eq("catering_restaurant_id", restaurant.id)
    .order("display_order", { ascending: true })

  const { data: menuItems } = await supabase
    .from("catering_menu_items")
    .select("*")
    .eq("catering_restaurant_id", restaurant.id)
    .order("display_order", { ascending: true })

  const { data: branches } = await supabase
    .from("catering_branches")
    .select("*")
    .eq("catering_restaurant_id", restaurant.id)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })

  const { data: orders } = await supabase
    .from("catering_orders")
    .select("*")
    .eq("catering_restaurant_id", restaurant.id)
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <CateringAdminClient
      restaurant={restaurant}
      initialCategories={categories || []}
      initialMenuItems={menuItems || []}
      initialBranches={branches || []}
      initialOrders={orders || []}
      isSuperAdmin={isSuperAdmin}
      userRole={adminData.role}
    />
  )
}
