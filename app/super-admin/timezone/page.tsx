import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SuperAdminShell } from "../components/super-admin-shell"
import { TimezoneClient } from "./timezone-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function TimezonePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: adminSelf, error: adminErr } = await supabase
    .from("admin_users")
    .select("operator_id, role")
    .eq("auth_user_id", user.id)
    .single()

  if (adminErr || !adminSelf?.operator_id) {
    throw new Error(
      "admin_users record not found for authenticated user (cannot resolve operator_id)",
    )
  }

  const operatorId = adminSelf.operator_id as string

  const { data: operator, error: opErr } = await supabase
    .from("operators")
    .select("id, name, timezone")
    .eq("id", operatorId)
    .single()

  if (opErr || !operator) {
    throw new Error(
      `Operator not found for operator_id ${operatorId}: ${opErr?.message ?? "unknown"}`,
    )
  }

  return (
    <SuperAdminShell title="Zona Horaria" activeTab="timezone">
      <TimezoneClient
        operatorId={operator.id as string}
        operatorName={(operator.name as string) ?? ""}
        initialTimezone={(operator.timezone as string) ?? "America/Puerto_Rico"}
      />
    </SuperAdminShell>
  )
}
