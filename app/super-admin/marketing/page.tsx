import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MarketingClient } from "./marketing-client"
import { SuperAdminShell } from "../components/super-admin-shell"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function MarketingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: adminSelf, error: adminSelfError } = await supabase
    .from("admin_users")
    .select("operator_id, role")
    .eq("auth_user_id", user.id)
    .single()

  if (adminSelfError || !adminSelf?.operator_id) {
    throw new Error(
      "admin_users record not found for authenticated user (cannot resolve operator_id)"
    )
  }

  const operatorId = adminSelf.operator_id as string

  const { data: campaigns, error: campaignsError } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("operator_id", operatorId)
    .order("created_at", { ascending: false })

  if (campaignsError) {
    console.error("[marketing] Error fetching marketing_campaigns:", campaignsError)
    throw new Error(campaignsError.message)
  }

  return (
    <SuperAdminShell title="Marketing & Sales" activeTab="marketing">
      <MarketingClient
        operatorId={operatorId}
        initialCampaigns={campaigns || []}
        currentUserId={user.id}
      />
    </SuperAdminShell>
  )
}
