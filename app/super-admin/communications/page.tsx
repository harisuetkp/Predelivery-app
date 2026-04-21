import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CommunicationsClient } from "./communications-client"
import { SuperAdminShell } from "../components/super-admin-shell"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function CommunicationsPage() {
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

  let { data: templates, error: templatesError } = await supabase
    .from("email_templates")
    .select("*")
    .eq("operator_id", operatorId)
    .order("template_key", { ascending: true })
    .order("template_name", { ascending: true })

  if (templatesError) {
    console.error("[communications] Error fetching email_templates:", templatesError)
  }

  return (
    <SuperAdminShell title="Comunicaciones" activeTab="communications">
      <CommunicationsClient
        operatorId={operatorId}
        initialTemplates={templates || []}
        embedded
      />
    </SuperAdminShell>
  )
}

