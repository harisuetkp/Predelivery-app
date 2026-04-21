import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  type HubLandingSettings,
  type HubTentKey,
  type HubTestimonial,
  defaultSettings,
  getEnabledTents,
} from "@/components/landing-templates-shared"
import { HubLandingRenderer } from "./hub-landing-renderer"

export const dynamic = "force-dynamic"

/**
 * Public hub landing at /inicio. Single-tenant today (SaleCalle / Operator #1).
 *
 * Rendering gates (all must pass or we 404):
 *  1. Operator exists and is active
 *  2. operator_landing_settings row exists
 *  3. operator_landing_settings.is_published = true
 *
 * Preview bypass: if the query string has `?preview=1` AND the request is
 * authenticated as an admin of this operator, gate #3 is relaxed. The admin
 * sees the unpublished draft (and all testimonials, published or not). Nothing
 * about the public cache changes — the page is force-dynamic.
 *
 * These guardrails mean the new landing cannot accidentally stomp the existing
 * /  (delivery marketplace) or /junteready (catering) flows.
 */
export default async function InicioPage({
  searchParams,
}: {
  searchParams?: Promise<{ preview?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const wantsPreview = sp.preview === "1"

  const supabase = await createClient()

  const { data: operator, error: operatorErr } = await supabase
    .from("operators")
    .select(
      "id, name, slug, logo_url, primary_color, delivery_enabled, catering_enabled, subscription_enabled, default_language"
    )
    .eq("slug", "foodnetpr")
    .eq("is_active", true)
    .maybeSingle()

  if (operatorErr || !operator) notFound()

  // If this request is asking for preview, verify the caller is an admin of
  // THIS operator before relaxing the is_published gate. Otherwise fall back
  // to strict public gating.
  let isAuthorizedPreview = false
  if (wantsPreview) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: adminSelf } = await supabase
        .from("admin_users")
        .select("operator_id")
        .eq("auth_user_id", user.id)
        .maybeSingle()
      isAuthorizedPreview =
        !!adminSelf && adminSelf.operator_id === operator.id
    }
  }

  // Strict public read goes through RLS (is_published=true).
  // Preview read bypasses the is_published filter — and the admin's own
  // credentials are used, so RLS still only lets them see their own operator.
  let settingsQuery = supabase
    .from("operator_landing_settings")
    .select("*")
    .eq("operator_id", operator.id)

  if (!isAuthorizedPreview) {
    settingsQuery = settingsQuery.eq("is_published", true)
  }

  const { data: settingsRow, error: settingsErr } =
    await settingsQuery.maybeSingle()

  // Public requests 404 when there's no published row. Authorized previews
  // render with defaults so admins can see the template system even before
  // their first Guardar.
  if (settingsErr) notFound()
  if (!settingsRow && !isAuthorizedPreview) notFound()

  const settings: HubLandingSettings = {
    ...defaultSettings(operator.id),
    ...((settingsRow as object) ?? {}),
    operator_id: operator.id,
  } as HubLandingSettings

  // Only load testimonials if section is on — avoids wasted RTT
  let testimonials: HubTestimonial[] = []
  if (settings.testimonials_enabled) {
    let testimonialsQuery = supabase
      .from("operator_testimonials")
      .select("*")
      .eq("operator_id", operator.id)
      .order("display_order", { ascending: true })
    if (!isAuthorizedPreview) {
      testimonialsQuery = testimonialsQuery.eq("is_published", true)
    }
    const { data } = await testimonialsQuery
    testimonials = (data ?? []) as HubTestimonial[]
  }

  const enabledTents: HubTentKey[] = getEnabledTents(operator)

  return (
    <HubLandingRenderer
      operator={{
        id: operator.id,
        name: operator.name,
        slug: operator.slug,
        logo_url: operator.logo_url,
        primary_color: operator.primary_color,
      }}
      settings={settings}
      enabledTents={enabledTents}
      testimonials={testimonials}
      previewMode={isAuthorizedPreview}
    />
  )
}
