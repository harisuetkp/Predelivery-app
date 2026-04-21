"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import {
  type HubLandingSettings,
  type HubTestimonial,
  DEFAULT_SECTION_ORDER,
} from "@/components/landing-templates-shared"
import { normalizeLandingRow } from "./normalize"

/**
 * Server actions for the operator hub landing editor
 * (super-admin > Herramientas Compartidas > Diseños de Landing).
 *
 * Actions return an ActionResult discriminated union instead of throwing so
 * the production error boundary does not fire for user-fixable validation or
 * auth errors. Throws are reserved for truly unexpected infra failures.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function requireAdminOperator(): Promise<
  | {
      ok: true
      supabase: Awaited<ReturnType<typeof createClient>>
      operatorId: string
      userId: string
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated" }

  const { data: adminSelf, error } = await supabase
    .from("admin_users")
    .select("operator_id")
    .eq("auth_user_id", user.id)
    .single()

  if (error || !adminSelf?.operator_id) {
    return {
      ok: false,
      error: "admin_users record not found for authenticated user",
    }
  }

  return {
    ok: true,
    supabase,
    operatorId: adminSelf.operator_id as string,
    userId: user.id,
  }
}

/** Allowed section keys kept in a set to reject unknowns. */
const ALLOWED_SECTIONS = new Set([
  "hero",
  "tents",
  "mobile_apps",
  "testimonials",
  "trust_markers",
  "footer",
])

/**
 * Upsert the operator's landing settings. Every call writes the full row so
 * we don't carry optimistic concurrency complexity. RLS is enabled on the
 * table; this action runs authenticated via the user's cookies, so we also
 * verify operator_id match in the payload.
 */
export async function saveLandingSettings(
  payload: HubLandingSettings
): Promise<ActionResult<HubLandingSettings>> {
  const auth = await requireAdminOperator()
  if (!auth.ok) return { ok: false, error: auth.error }
  const { supabase, operatorId } = auth

  if (payload.operator_id !== operatorId) {
    return { ok: false, error: "Operator mismatch" }
  }

  // Normalize section order and drop unknown keys
  const sectionOrder = Array.isArray(payload.section_order)
    ? payload.section_order.filter((k) => ALLOWED_SECTIONS.has(k))
    : DEFAULT_SECTION_ORDER
  const dedupedOrder = Array.from(new Set(sectionOrder))

  // Mobile app URLs sanity check
  if (payload.mobile_apps_enabled) {
    if (!payload.ios_app_url && !payload.android_app_url) {
      return {
        ok: false,
        error: "Mobile Apps está activa pero no hay URL de iOS ni Android.",
      }
    }
  }

  const row = {
    operator_id: operatorId,
    template: payload.template,
    font_pair: payload.font_pair,
    icon_pack: payload.icon_pack,
    background_treatment: payload.background_treatment,
    accent_color: payload.accent_color,
    tents: payload.tents ?? {},
    mobile_apps_enabled: payload.mobile_apps_enabled,
    mobile_apps_variant: payload.mobile_apps_variant,
    mobile_apps_copy: payload.mobile_apps_copy,
    mobile_apps_hero_image_url: payload.mobile_apps_hero_image_url,
    ios_app_url: payload.ios_app_url,
    android_app_url: payload.android_app_url,
    testimonials_enabled: payload.testimonials_enabled,
    testimonials_variant: payload.testimonials_variant,
    testimonials_heading: payload.testimonials_heading,
    trust_markers_enabled: payload.trust_markers_enabled,
    trust_markers_heading: payload.trust_markers_heading,
    trust_markers: payload.trust_markers ?? [],
    section_order: dedupedOrder,
    is_published: payload.is_published,
  }

  const { data, error } = await supabase
    .from("operator_landing_settings")
    .upsert(row, { onConflict: "operator_id" })
    .select("*")
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/super-admin/landing-design")
  revalidatePath("/inicio")

  return { ok: true, data: normalizeLandingRow(data, operatorId) }
}

export async function publishLanding(
  shouldPublish: boolean
): Promise<ActionResult<{ is_published: boolean }>> {
  const auth = await requireAdminOperator()
  if (!auth.ok) return { ok: false, error: auth.error }
  const { supabase, operatorId } = auth

  const { data, error } = await supabase
    .from("operator_landing_settings")
    .update({ is_published: shouldPublish })
    .eq("operator_id", operatorId)
    .select("is_published")
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/super-admin/landing-design")
  revalidatePath("/inicio")
  return { ok: true, data: { is_published: data.is_published } }
}

export async function saveTestimonial(
  payload: Partial<HubTestimonial> & { id?: string }
): Promise<ActionResult<HubTestimonial>> {
  const auth = await requireAdminOperator()
  if (!auth.ok) return { ok: false, error: auth.error }
  const { supabase, operatorId } = auth

  if (!payload.author_name?.trim()) {
    return { ok: false, error: "Falta el nombre del autor" }
  }
  if (!payload.quote?.trim()) {
    return { ok: false, error: "Falta el texto del testimonio" }
  }
  if (
    payload.rating !== null &&
    payload.rating !== undefined &&
    (payload.rating < 1 || payload.rating > 5)
  ) {
    return { ok: false, error: "Rating debe estar entre 1 y 5" }
  }

  const row = {
    operator_id: operatorId,
    author_name: payload.author_name.trim(),
    author_location: payload.author_location?.trim() || null,
    rating: payload.rating ?? null,
    quote: payload.quote.trim(),
    avatar_url: payload.avatar_url?.trim() || null,
    display_order: payload.display_order ?? 0,
    is_published: payload.is_published ?? true,
  }

  if (payload.id) {
    const { data, error } = await supabase
      .from("operator_testimonials")
      .update(row)
      .eq("id", payload.id)
      .eq("operator_id", operatorId)
      .select("*")
      .single()
    if (error) return { ok: false, error: error.message }
    revalidatePath("/super-admin/landing-design")
    revalidatePath("/inicio")
    return { ok: true, data: data as HubTestimonial }
  }

  const { data, error } = await supabase
    .from("operator_testimonials")
    .insert(row)
    .select("*")
    .single()
  if (error) return { ok: false, error: error.message }

  revalidatePath("/super-admin/landing-design")
  revalidatePath("/inicio")
  return { ok: true, data: data as HubTestimonial }
}

export async function deleteTestimonial(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdminOperator()
  if (!auth.ok) return { ok: false, error: auth.error }
  const { supabase, operatorId } = auth

  const { error } = await supabase
    .from("operator_testimonials")
    .delete()
    .eq("id", id)
    .eq("operator_id", operatorId)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/super-admin/landing-design")
  revalidatePath("/inicio")
  return { ok: true, data: { id } }
}
