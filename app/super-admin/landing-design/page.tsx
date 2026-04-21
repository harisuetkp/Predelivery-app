import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SuperAdminShell } from "../components/super-admin-shell"
import { LandingDesignClient } from "./landing-design-client"
import { normalizeLandingRow } from "./normalize"
import {
  type HubTentKey,
  getEnabledTents,
} from "@/components/landing-templates-shared"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function LandingDesignPage() {
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

  // Pull operator (for enabled tents) and current settings + testimonials
  const [operatorRes, settingsRes, testimonialsRes] = await Promise.all([
    supabase
      .from("operators")
      .select(
        "id, name, slug, delivery_enabled, catering_enabled, subscription_enabled, logo_url, primary_color, default_language"
      )
      .eq("id", operatorId)
      .single(),
    supabase
      .from("operator_landing_settings")
      .select("*")
      .eq("operator_id", operatorId)
      .maybeSingle(),
    supabase
      .from("operator_testimonials")
      .select("*")
      .eq("operator_id", operatorId)
      .order("display_order", { ascending: true }),
  ])

  if (operatorRes.error || !operatorRes.data) {
    throw new Error(
      `Operator not found for operator_id ${operatorId}: ${operatorRes.error?.message ?? "unknown"}`
    )
  }

  const operator = operatorRes.data
  const enabledTents: HubTentKey[] = getEnabledTents(operator)

  const settings = normalizeLandingRow(
    (settingsRes.data as Record<string, unknown> | null) ?? null,
    operatorId
  )

  return (
    <SuperAdminShell title="Diseños de Landing" activeTab="landing-design">
      <LandingDesignClient
        operator={{
          id: operator.id,
          name: operator.name,
          slug: operator.slug,
          logo_url: operator.logo_url,
          primary_color: operator.primary_color,
        }}
        enabledTents={enabledTents}
        initialSettings={settings}
        initialTestimonials={testimonialsRes.data ?? []}
      />
    </SuperAdminShell>
  )
}
