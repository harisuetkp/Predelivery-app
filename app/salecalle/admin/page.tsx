import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { fetchAllOperators } from "./actions"
import { SaleCalleAdminClient } from "./salecalle-admin-client"

export const dynamic = "force-dynamic"

export default async function SaleCalleAdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: adminRecord } = await supabase
    .from("admin_users")
    .select("role")
    .eq("auth_user_id", user.id)
    .single()

  if (!adminRecord || adminRecord.role !== "super_admin") {
    redirect("/super-admin")
  }

  const operators = await fetchAllOperators()

  const [
    { data: restaurantCounts },
    { data: cateringCounts },
    { data: orderCounts },
    { data: cateringOrderCounts },
    { data: orderRevenue },
    { data: cateringOrderRevenue },
  ] = await Promise.all([
    supabase.from("restaurants").select("operator_id"),
    supabase.from("catering_restaurants").select("operator_id"),
    supabase.from("orders").select("operator_id"),
    supabase.from("catering_orders").select("operator_id"),
    supabase.from("orders").select("operator_id, total"),
    supabase.from("catering_orders").select("operator_id, total"),
  ])

  const statsMap: Record<string, {
    restaurants: number
    cateringPortals: number
    orders: number
    cateringOrders: number
    deliveryRevenue: number
    cateringRevenue: number
  }> = {}

  operators.forEach((op) => {
    statsMap[op.id] = { restaurants: 0, cateringPortals: 0, orders: 0, cateringOrders: 0, deliveryRevenue: 0, cateringRevenue: 0 }
  })

  restaurantCounts?.forEach((r) => {
    if (r.operator_id && statsMap[r.operator_id]) statsMap[r.operator_id].restaurants++
  })
  cateringCounts?.forEach((r) => {
    if (r.operator_id && statsMap[r.operator_id]) statsMap[r.operator_id].cateringPortals++
  })
  orderCounts?.forEach((r) => {
    if (r.operator_id && statsMap[r.operator_id]) statsMap[r.operator_id].orders++
  })
  cateringOrderCounts?.forEach((r) => {
    if (r.operator_id && statsMap[r.operator_id]) statsMap[r.operator_id].cateringOrders++
  })
  orderRevenue?.forEach((r: any) => {
    if (r.operator_id && statsMap[r.operator_id]) statsMap[r.operator_id].deliveryRevenue += Number(r.total) || 0
  })
  cateringOrderRevenue?.forEach((r: any) => {
    if (r.operator_id && statsMap[r.operator_id]) statsMap[r.operator_id].cateringRevenue += Number(r.total) || 0
  })

  const operatorsWithStats = operators.map((op) => ({
    ...op,
    stats: statsMap[op.id] || { restaurants: 0, cateringPortals: 0, orders: 0, cateringOrders: 0, deliveryRevenue: 0, cateringRevenue: 0 },
  }))

  return <SaleCalleAdminClient operators={operatorsWithStats} />
}
