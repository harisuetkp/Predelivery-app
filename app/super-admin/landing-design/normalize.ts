import {
  type HubLandingSettings,
  defaultSettings,
} from "@/components/landing-templates-shared"

/**
 * Normalize a raw operator_landing_settings row into a fully-typed
 * HubLandingSettings, filling defaults for any missing fields.
 *
 * Lives in its own module (not actions.ts) because Next.js requires every
 * non-type export from a "use server" file to be an async function. This
 * helper is sync, so it belongs outside the action boundary.
 */
export function normalizeLandingRow(
  row: Record<string, unknown> | null,
  operatorId: string
): HubLandingSettings {
  const base = defaultSettings(operatorId)
  if (!row) return base
  return {
    operator_id: operatorId,
    template: (row.template as HubLandingSettings["template"]) ?? base.template,
    font_pair:
      (row.font_pair as HubLandingSettings["font_pair"]) ?? base.font_pair,
    icon_pack:
      (row.icon_pack as HubLandingSettings["icon_pack"]) ?? base.icon_pack,
    background_treatment:
      (row.background_treatment as HubLandingSettings["background_treatment"]) ??
      base.background_treatment,
    accent_color:
      (row.accent_color as string | null) ?? base.accent_color,
    tents:
      (row.tents as HubLandingSettings["tents"]) &&
      Object.keys(row.tents as object).length
        ? (row.tents as HubLandingSettings["tents"])
        : base.tents,
    mobile_apps_enabled:
      (row.mobile_apps_enabled as boolean) ?? base.mobile_apps_enabled,
    mobile_apps_variant:
      (row.mobile_apps_variant as HubLandingSettings["mobile_apps_variant"]) ??
      base.mobile_apps_variant,
    mobile_apps_copy:
      (row.mobile_apps_copy as string | null) ?? base.mobile_apps_copy,
    mobile_apps_hero_image_url:
      (row.mobile_apps_hero_image_url as string | null) ??
      base.mobile_apps_hero_image_url,
    ios_app_url: (row.ios_app_url as string | null) ?? base.ios_app_url,
    android_app_url:
      (row.android_app_url as string | null) ?? base.android_app_url,
    testimonials_enabled:
      (row.testimonials_enabled as boolean) ?? base.testimonials_enabled,
    testimonials_variant:
      (row.testimonials_variant as HubLandingSettings["testimonials_variant"]) ??
      base.testimonials_variant,
    testimonials_heading:
      (row.testimonials_heading as string | null) ?? base.testimonials_heading,
    trust_markers_enabled:
      (row.trust_markers_enabled as boolean) ?? base.trust_markers_enabled,
    trust_markers_heading:
      (row.trust_markers_heading as string | null) ??
      base.trust_markers_heading,
    trust_markers:
      (row.trust_markers as HubLandingSettings["trust_markers"]) ??
      base.trust_markers,
    section_order:
      Array.isArray(row.section_order) &&
      (row.section_order as unknown[]).length > 0
        ? (row.section_order as HubLandingSettings["section_order"])
        : base.section_order,
    is_published: (row.is_published as boolean) ?? base.is_published,
  }
}
