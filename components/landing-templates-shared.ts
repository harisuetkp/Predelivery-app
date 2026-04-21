// Hub landing templates — SHARED module (no "use client" directive).
//
// This file contains only types, constants, and pure helper functions that are
// safe to import from both server components (app/super-admin/landing-design/page.tsx,
// app/inicio/**, server actions, normalize helper) and client components.
//
// The React components (HubLandingPreview, MiniMockup) that are client-only
// live in ./landing-templates.tsx, which has "use client" at the top.
//
// Splitting is required because Next.js treats ALL non-type exports from a
// "use client" module as client references — a server component that calls
// getEnabledTents() from such a module will hit
// "Attempted to call getEnabledTents() from the server but getEnabledTents is on the client".

export type HubLandingTemplate =
  | "doble-puerta"
  | "losetas-verticales"
  | "hub-unificado"
  | "mosaico"
  | "principal-secundario"
  | "carrusel"

export type HubFontPair = "sans-sans" | "serif-sans" | "display-sans"
export type HubIconPack = "clasico" | "moderno" | "ilustrado"
export type HubBackgroundTreatment = "photo" | "pattern" | "solid" | "gradient"
export type MobileAppsVariant = "compact" | "showcase"
export type TestimonialsVariant = "cards-row" | "marquee" | "big-quote"
export type HubSectionKey =
  | "hero"
  | "tents"
  | "mobile_apps"
  | "testimonials"
  | "trust_markers"
  | "footer"

export interface HubTentContent {
  order: number
  hero_image_url: string | null
  headline: string
  subhead: string
  cta_label: string
}

export type HubTentKey = "delivery" | "catering" | "subscription"

export interface HubLandingSettings {
  operator_id: string
  template: HubLandingTemplate
  font_pair: HubFontPair
  icon_pack: HubIconPack
  background_treatment: HubBackgroundTreatment
  accent_color: string | null
  tents: Partial<Record<HubTentKey, HubTentContent>>
  mobile_apps_enabled: boolean
  mobile_apps_variant: MobileAppsVariant
  mobile_apps_copy: string | null
  mobile_apps_hero_image_url: string | null
  ios_app_url: string | null
  android_app_url: string | null
  testimonials_enabled: boolean
  testimonials_variant: TestimonialsVariant
  testimonials_heading: string | null
  trust_markers_enabled: boolean
  trust_markers_heading: string | null
  trust_markers: Array<{ name: string; logo_url: string; url?: string | null }>
  section_order: HubSectionKey[]
  is_published: boolean
}

export interface HubTestimonial {
  id: string
  author_name: string
  author_location: string | null
  rating: number | null
  quote: string
  avatar_url: string | null
  display_order: number
  is_published: boolean
}

export const TEMPLATE_INFO: Record<
  HubLandingTemplate,
  {
    name: string
    description: string
    recommendedTents: "1" | "2" | "3" | "any"
    recommendedTentsLabel: string
  }
> = {
  "doble-puerta": {
    name: "Doble Puerta",
    description:
      "Pantalla partida a mitades (2 tents) o tercios (3 tents). Cada mitad con imagen a bleed completo y un CTA grande. La decisión de tent es lo primero que ve el visitante.",
    recommendedTents: "2",
    recommendedTentsLabel: "Ideal para 2 tents",
  },
  "losetas-verticales": {
    name: "Losetas Verticales",
    description:
      "Página larga con una banda por tent, imagen propia y CTA. Escala 2→3 sin compromisos y lee perfecto en móvil.",
    recommendedTents: "any",
    recommendedTentsLabel: "Ideal para 2-3 tents",
  },
  "hub-unificado": {
    name: "Hub Unificado",
    description:
      "Un solo buscador con píldoras de modo (Delivery / Catering / Suscripción). Se siente como una sola plataforma, no tres productos.",
    recommendedTents: "3",
    recommendedTentsLabel: "Ideal para 3 tents",
  },
  mosaico: {
    name: "Mosaico",
    description:
      "Fondo limpio con 2-3 losetas pequeñas tipo lanzador de app. Mínimo, carga rápido, perfecto para links de SMS/email.",
    recommendedTents: "any",
    recommendedTentsLabel: "Ideal para 2-3 tents",
  },
  "principal-secundario": {
    name: "Principal + Secundario",
    description:
      "Un tent protagonista con hero completo, los demás como bandas secundarias. Úsalo cuando un tent concentra la mayoría del tráfico.",
    recommendedTents: "any",
    recommendedTentsLabel: "Ideal cuando 1 tent domina",
  },
  carrusel: {
    name: "Carrusel",
    description:
      "Hero rotativo, un tent por slide, con cards persistentes debajo. Visualmente rico; ten en cuenta que los carruseles no convierten tanto como bandas estáticas.",
    recommendedTents: "any",
    recommendedTentsLabel: "2-3 tents",
  },
}

export const DEFAULT_SECTION_ORDER: HubSectionKey[] = [
  "hero",
  "tents",
  "mobile_apps",
  "testimonials",
  "trust_markers",
  "footer",
]

export function defaultTentContent(tent: HubTentKey): HubTentContent {
  if (tent === "delivery") {
    return {
      order: 1,
      hero_image_url: null,
      headline: "Ordena comida a domicilio",
      subhead: "Recibe de nuestros restaurantes locales en minutos.",
      cta_label: "Ordenar ahora",
    }
  }
  if (tent === "catering") {
    return {
      order: 2,
      hero_image_url: null,
      headline: "Catering para eventos",
      subhead: "Comida para grupos grandes, reservada con anticipación.",
      cta_label: "Cotizar evento",
    }
  }
  return {
    order: 3,
    hero_image_url: null,
    headline: "Suscripciones de comidas",
    subhead: "Comidas recurrentes, a tu horario, con ahorro semanal.",
    cta_label: "Ver planes",
  }
}

/**
 * Helpers used by both the admin picker and the public renderer.
 */
export function getEnabledTents(operator: {
  delivery_enabled: boolean | null
  catering_enabled: boolean | null
  subscription_enabled: boolean | null
}): HubTentKey[] {
  const out: HubTentKey[] = []
  if (operator.delivery_enabled) out.push("delivery")
  if (operator.catering_enabled) out.push("catering")
  if (operator.subscription_enabled) out.push("subscription")
  return out
}

export function defaultSettings(operatorId: string): HubLandingSettings {
  return {
    operator_id: operatorId,
    template: "losetas-verticales",
    font_pair: "sans-sans",
    icon_pack: "moderno",
    background_treatment: "photo",
    accent_color: null,
    tents: {
      delivery: defaultTentContent("delivery"),
      catering: defaultTentContent("catering"),
      subscription: defaultTentContent("subscription"),
    },
    mobile_apps_enabled: false,
    mobile_apps_variant: "compact",
    mobile_apps_copy: null,
    mobile_apps_hero_image_url: null,
    ios_app_url: null,
    android_app_url: null,
    testimonials_enabled: false,
    testimonials_variant: "cards-row",
    testimonials_heading: null,
    trust_markers_enabled: false,
    trust_markers_heading: null,
    trust_markers: [],
    section_order: DEFAULT_SECTION_ORDER,
    is_published: false,
  }
}

export const TENT_LABELS: Record<HubTentKey, string> = {
  delivery: "Delivery",
  catering: "Catering",
  subscription: "Suscripciones",
}

export const TENT_DEFAULT_PATHS: Record<HubTentKey, string> = {
  delivery: "/",
  catering: "/junteready",
  subscription: "/subscriptions",
}
