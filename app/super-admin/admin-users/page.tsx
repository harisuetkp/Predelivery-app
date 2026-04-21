import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AdminUsersClient } from "./admin-users-client"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: adminRecord } = await supabase
    .from("admin_users")
    .select("role, tent_permissions")
    .eq("auth_user_id", user.id)
    .single()

  if (!adminRecord || !["super_admin", "manager"].includes(adminRecord.role)) {
    redirect("/super-admin")
  }

  const { data: operator } = await supabase
    .from("operators")
    .select("id, name, delivery_enabled, catering_enabled, subscription_enabled")
    .eq("slug", "foodnetpr")
    .single()

  if (!operator) redirect("/super-admin")

  const { data: adminUsers } = await supabase
    .from("admin_users")
    .select("*")
    .eq("operator_id", operator.id)
    .order("created_at", { ascending: false })

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id, name, slug")
    .eq("operator_id", operator.id)
    .order("name")

  const { data: cateringRestaurants } = await supabase
    .from("catering_restaurants")
    .select("id, name, slug")
    .eq("operator_id", operator.id)
    .order("name")

  return (
    <AdminUsersClient
      operator={operator}
      adminUsers={adminUsers || []}
      restaurants={restaurants || []}
      cateringRestaurants={cateringRestaurants || []}
      currentUserRole={adminRecord.role}
    />
  )
}
