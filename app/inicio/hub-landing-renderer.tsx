/**
 * Server component (no "use client") that dispatches rendering of a hub
 * landing based on the operator's chosen template + section order.
 *
 * All six templates are implemented below:
 *   - losetas-verticales: alternating full-width slabs
 *   - principal-secundario: one primary hero-tent + narrow secondary rows
 *   - doble-puerta: two (or N) equally-weighted full-height gates (absorbs hero)
 *   - hub-unificado: single unified panel with tents as chips inside (absorbs hero)
 *   - mosaico: asymmetric masonry grid
 *   - carrusel: horizontally scroll-snapped tent cards
 *
 * doble-puerta and hub-unificado absorb the hero section (their tent layouts
 * occupy the full viewport headline slot), so we strip "hero" from the
 * section order when those templates are active.
 */

import Link from "next/link"
import {
  type HubLandingSettings,
  type HubSectionKey,
  type HubTentContent,
  type HubTentKey,
  type HubTestimonial,
  TENT_DEFAULT_PATHS,
  TENT_LABELS,
  defaultTentContent,
} from "@/components/landing-templates-shared"

/**
 * Templates whose tent layout doubles as the hero. When active, we suppress
 * the separate hero band so we don't end up with two stacked headlines.
 */
function templateAbsorbsHero(
  template: HubLandingSettings["template"]
): boolean {
  return template === "doble-puerta" || template === "hub-unificado"
}

interface OperatorLite {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string | null
}

interface Props {
  operator: OperatorLite
  settings: HubLandingSettings
  enabledTents: HubTentKey[]
  testimonials: HubTestimonial[]
  /** When true, a thin banner at the top reminds the admin this is a draft. */
  previewMode?: boolean
}

export function HubLandingRenderer(props: Props) {
  const { operator, settings, enabledTents, testimonials, previewMode } = props
  const accent = settings.accent_color || operator.primary_color || "#e91e8c"

  // Build sections in the requested order, filtering out ones that aren't
  // enabled or have no data to render.
  const absorbsHero = templateAbsorbsHero(settings.template)
  const sections = (settings.section_order ?? [])
    .filter((key) => !(absorbsHero && key === "hero"))
    .filter((key) => shouldRenderSection(key, settings, testimonials))

  const fontClass = fontPairClass(settings.font_pair)

  return (
    <div
      className={`min-h-screen bg-white text-gray-900 ${fontClass}`}
      style={{ ["--accent" as string]: accent } as React.CSSProperties}
    >
      {previewMode && !settings.is_published && (
        <div className="bg-amber-500 text-black text-sm font-medium text-center py-1.5 px-3">
          Vista previa — esta landing aún no está publicada. Los visitantes
          siguen viendo las páginas actuales.
        </div>
      )}
      <HeaderBar operator={operator} enabledTents={enabledTents} accent={accent} />

      <main>
        {sections.map((key) => (
          <SectionRouter
            key={key}
            section={key}
            settings={settings}
            operator={operator}
            enabledTents={enabledTents}
            testimonials={testimonials}
            accent={accent}
          />
        ))}
      </main>

      <FooterBar operator={operator} />
    </div>
  )
}

function shouldRenderSection(
  key: HubSectionKey,
  settings: HubLandingSettings,
  testimonials: HubTestimonial[]
): boolean {
  if (key === "mobile_apps") {
    if (!settings.mobile_apps_enabled) return false
    // Require at least one URL — no dead links
    return Boolean(settings.ios_app_url || settings.android_app_url)
  }
  if (key === "testimonials") {
    if (!settings.testimonials_enabled) return false
    return testimonials.length > 0
  }
  if (key === "trust_markers") {
    if (!settings.trust_markers_enabled) return false
    return (settings.trust_markers ?? []).length > 0
  }
  // hero, tents, footer always render
  return true
}

function SectionRouter({
  section,
  settings,
  operator,
  enabledTents,
  testimonials,
  accent,
}: {
  section: HubSectionKey
  settings: HubLandingSettings
  operator: OperatorLite
  enabledTents: HubTentKey[]
  testimonials: HubTestimonial[]
  accent: string
}) {
  if (section === "hero") {
    return <HeroBand operator={operator} accent={accent} />
  }
  if (section === "tents") {
    return (
      <TentsBand
        settings={settings}
        enabledTents={enabledTents}
        accent={accent}
        operator={operator}
      />
    )
  }
  if (section === "mobile_apps") {
    return <MobileAppsBand settings={settings} accent={accent} />
  }
  if (section === "testimonials") {
    return (
      <TestimonialsBand
        testimonials={testimonials}
        variant={settings.testimonials_variant}
        heading={settings.testimonials_heading}
        accent={accent}
      />
    )
  }
  if (section === "trust_markers") {
    return (
      <TrustMarkersBand
        markers={settings.trust_markers}
        heading={settings.trust_markers_heading}
      />
    )
  }
  return null
}

/* ------------------------- Header / Footer ------------------------- */

function HeaderBar({
  operator,
  enabledTents,
  accent,
}: {
  operator: OperatorLite
  enabledTents: HubTentKey[]
  accent: string
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
        <Link href="/inicio" className="flex items-center gap-2">
          {operator.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={operator.logo_url}
              alt={operator.name}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <span className="text-lg font-bold" style={{ color: accent }}>
              {operator.name}
            </span>
          )}
        </Link>

        <nav className="ml-auto hidden md:flex items-center gap-4 text-sm">
          {enabledTents.map((tent) => (
            <Link
              key={tent}
              href={TENT_DEFAULT_PATHS[tent]}
              className="text-gray-700 hover:text-gray-900"
            >
              {TENT_LABELS[tent]}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

function FooterBar({ operator }: { operator: OperatorLite }) {
  return (
    <footer className="border-t border-gray-100 bg-gray-50 mt-16">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 text-sm text-gray-600 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900">{operator.name}</div>
          <div className="text-xs text-gray-500">
            Plataforma operada por SaleCalle LLC
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Link href="/privacy" className="hover:text-gray-900">
            Privacidad
          </Link>
          <Link href="/terms" className="hover:text-gray-900">
            Términos
          </Link>
        </div>
      </div>
    </footer>
  )
}

/* --------------------------- Hero Band ----------------------------- */

function HeroBand({ operator, accent }: { operator: OperatorLite; accent: string }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${withAlpha(accent, 0.12)} 0%, ${withAlpha(accent, 0.02)} 100%)`,
      }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900">
          Bienvenido a {operator.name}
        </h1>
        <p className="mt-4 text-lg md:text-xl text-gray-700 max-w-2xl mx-auto">
          Tu punto único para ordenar comida, coordinar catering y más.
          Elige abajo la opción que necesitas.
        </p>
      </div>
    </section>
  )
}

/* ------------------------- Tents Band (dispatcher) ------------------------ */

/**
 * Row in the ordered tent list we pass down to each template renderer.
 */
type OrderedTent = {
  tent: HubTentKey
  content: HubTentContent
  /** 0-based index within the enabled+ordered list (useful for mosaic/stagger). */
  index: number
}

function TentsBand({
  settings,
  enabledTents,
  accent,
  operator,
}: {
  settings: HubLandingSettings
  enabledTents: HubTentKey[]
  accent: string
  operator: OperatorLite
}) {
  // Build the tent list in the configured order, only for enabled tents
  const ordered: OrderedTent[] = enabledTents
    .map((tent) => ({
      tent,
      content: settings.tents[tent] ?? defaultTentContent(tent),
    }))
    .sort((a, b) => a.content.order - b.content.order)
    .map((row, index) => ({ ...row, index }))

  if (ordered.length === 0) return null

  switch (settings.template) {
    case "principal-secundario":
      return <PrincipalSecundarioTents tents={ordered} accent={accent} />
    case "doble-puerta":
      return <DoblePuertaTents tents={ordered} accent={accent} operator={operator} />
    case "hub-unificado":
      return <HubUnificadoTents tents={ordered} accent={accent} operator={operator} />
    case "mosaico":
      return <MosaicoTents tents={ordered} accent={accent} />
    case "carrusel":
      return <CarruselTents tents={ordered} accent={accent} />
    case "losetas-verticales":
    default:
      return <LosetasVerticalesTents tents={ordered} accent={accent} />
  }
}

/* ----- 1. Losetas Verticales — alternating full-width slabs ----- */

function LosetasVerticalesTents({
  tents,
  accent,
}: {
  tents: OrderedTent[]
  accent: string
}) {
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-8">
      {tents.map(({ tent, content, index }) => (
        <TentSlab
          key={tent}
          tent={tent}
          content={content}
          accent={accent}
          reverse={index % 2 === 1}
        />
      ))}
    </section>
  )
}

function TentSlab({
  tent,
  content,
  accent,
  reverse,
}: {
  tent: HubTentKey
  content: HubTentContent
  accent: string
  reverse: boolean
}) {
  const href = TENT_DEFAULT_PATHS[tent]
  return (
    <article
      className={`grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm ${
        reverse ? "md:[&>*:first-child]:order-2" : ""
      }`}
    >
      <div className="relative min-h-[220px] md:min-h-[340px] bg-gray-100">
        {content.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.hero_image_url}
            alt={content.headline}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${withAlpha(accent, 0.6)})`,
            }}
          >
            {TENT_LABELS[tent]}
          </div>
        )}
      </div>
      <div className="p-6 md:p-10 flex flex-col justify-center">
        <div
          className="inline-flex items-center gap-1.5 self-start text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full"
          style={{ background: withAlpha(accent, 0.12), color: accent }}
        >
          {TENT_LABELS[tent]}
        </div>
        <h2 className="mt-3 text-2xl md:text-3xl font-bold text-gray-900">
          {content.headline}
        </h2>
        <p className="mt-2 text-base text-gray-700">{content.subhead}</p>
        <div className="mt-5">
          <Link
            href={href}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ background: accent }}
          >
            {content.cta_label}
          </Link>
        </div>
      </div>
    </article>
  )
}

/* ----- 2. Principal + Secundario — one tall hero tent + narrow sidekicks ----- */

function PrincipalSecundarioTents({
  tents,
  accent,
}: {
  tents: OrderedTent[]
  accent: string
}) {
  const [primary, ...rest] = tents
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-6">
      {/* Primary: full-bleed hero card */}
      <PrimaryTentCard row={primary} accent={accent} />

      {/* Secondaries: compact horizontal rows */}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rest.map((row) => (
            <SecondaryTentRow key={row.tent} row={row} accent={accent} />
          ))}
        </div>
      )}
    </section>
  )
}

function PrimaryTentCard({ row, accent }: { row: OrderedTent; accent: string }) {
  const { tent, content } = row
  const href = TENT_DEFAULT_PATHS[tent]
  return (
    <article className="relative overflow-hidden rounded-3xl shadow-lg min-h-[360px] md:min-h-[480px] flex items-end">
      {content.hero_image_url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.hero_image_url}
            alt={content.headline}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${withAlpha(accent, 0.55)})`,
          }}
        />
      )}
      <div className="relative p-6 md:p-12 max-w-2xl text-white">
        <div
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-white/20 backdrop-blur"
        >
          {TENT_LABELS[tent]}
        </div>
        <h2 className="mt-3 text-3xl md:text-5xl font-bold tracking-tight drop-shadow-sm">
          {content.headline}
        </h2>
        <p className="mt-3 text-base md:text-lg text-white/90 max-w-xl">
          {content.subhead}
        </p>
        <div className="mt-6">
          <Link
            href={href}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-white text-gray-900 shadow-sm transition hover:bg-gray-100"
          >
            {content.cta_label}
          </Link>
        </div>
      </div>
    </article>
  )
}

function SecondaryTentRow({
  row,
  accent,
}: {
  row: OrderedTent
  accent: string
}) {
  const { tent, content } = row
  const href = TENT_DEFAULT_PATHS[tent]
  return (
    <Link
      href={href}
      className="group relative flex items-stretch rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-md transition"
    >
      <div
        className="w-28 md:w-36 flex-shrink-0 relative"
        style={{
          background: `linear-gradient(135deg, ${accent}, ${withAlpha(accent, 0.55)})`,
        }}
      >
        {content.hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.hero_image_url}
            alt={content.headline}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>
      <div className="flex-1 p-4 md:p-5 flex flex-col justify-center">
        <div
          className="inline-flex items-center gap-1 self-start text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: withAlpha(accent, 0.12), color: accent }}
        >
          {TENT_LABELS[tent]}
        </div>
        <h3 className="mt-1.5 text-base md:text-lg font-bold text-gray-900">
          {content.headline}
        </h3>
        <p className="text-xs md:text-sm text-gray-600 line-clamp-1">
          {content.subhead}
        </p>
        <span
          className="mt-2 text-xs md:text-sm font-semibold group-hover:underline"
          style={{ color: accent }}
        >
          {content.cta_label} →
        </span>
      </div>
    </Link>
  )
}

/* ----- 3. Doble Puerta — N equally-weighted full-height gates (absorbs hero) ----- */

function DoblePuertaTents({
  tents,
  accent,
  operator,
}: {
  tents: OrderedTent[]
  accent: string
  operator: OperatorLite
}) {
  const gridCols =
    tents.length === 1
      ? "md:grid-cols-1"
      : tents.length === 2
      ? "md:grid-cols-2"
      : "md:grid-cols-3"
  return (
    <section className="relative">
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-10 pb-6 text-center">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900">
          Bienvenido a {operator.name}
        </h1>
        <p className="mt-3 text-base md:text-lg text-gray-700 max-w-2xl mx-auto">
          Elige por dónde quieres empezar.
        </p>
      </div>
      <div className={`grid grid-cols-1 ${gridCols} gap-4 md:gap-6 max-w-6xl mx-auto px-4 md:px-6 pb-10`}>
        {tents.map((row) => (
          <DoorPanel key={row.tent} row={row} accent={accent} />
        ))}
      </div>
    </section>
  )
}

function DoorPanel({ row, accent }: { row: OrderedTent; accent: string }) {
  const { tent, content } = row
  const href = TENT_DEFAULT_PATHS[tent]
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-3xl min-h-[360px] md:min-h-[560px] shadow-md hover:shadow-xl transition"
    >
      {content.hero_image_url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.hero_image_url}
            alt={content.headline}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        </>
      ) : (
        <div
          className="absolute inset-0 group-hover:brightness-110 transition"
          style={{
            background: `linear-gradient(160deg, ${accent}, ${withAlpha(accent, 0.55)})`,
          }}
        />
      )}
      <div className="relative h-full w-full flex flex-col justify-end p-6 md:p-10 text-white">
        <div className="inline-flex self-start items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-white/20 backdrop-blur">
          {TENT_LABELS[tent]}
        </div>
        <h2 className="mt-3 text-2xl md:text-4xl font-bold tracking-tight">
          {content.headline}
        </h2>
        <p className="mt-2 text-sm md:text-base text-white/90 max-w-md">
          {content.subhead}
        </p>
        <span className="mt-4 inline-flex items-center gap-2 self-start px-4 py-2 rounded-xl font-semibold bg-white text-gray-900 shadow-sm">
          {content.cta_label} →
        </span>
      </div>
    </Link>
  )
}

/* ----- 4. Hub Unificado — single panel with tents as chips (absorbs hero) ----- */

function HubUnificadoTents({
  tents,
  accent,
  operator,
}: {
  tents: OrderedTent[]
  accent: string
  operator: OperatorLite
}) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(150deg, ${withAlpha(accent, 0.14)} 0%, ${withAlpha(
          accent,
          0.03
        )} 55%, #ffffff 100%)`,
      }}
    >
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-24">
        <div className="text-center">
          <div
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full"
            style={{ background: withAlpha(accent, 0.15), color: accent }}
          >
            {operator.name}
          </div>
          <h1 className="mt-4 text-4xl md:text-6xl font-bold tracking-tight text-gray-900">
            Todo en un mismo lugar
          </h1>
          <p className="mt-4 text-lg md:text-xl text-gray-700 max-w-2xl mx-auto">
            Ordena, planifica y recibe — elige abajo el servicio que necesitas
            hoy.
          </p>
        </div>

        <div className="mt-10 rounded-3xl bg-white shadow-xl border border-gray-100 p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {tents.map((row) => (
              <ChipCard key={row.tent} row={row} accent={accent} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ChipCard({ row, accent }: { row: OrderedTent; accent: string }) {
  const { tent, content } = row
  const href = TENT_DEFAULT_PATHS[tent]
  return (
    <Link
      href={href}
      className="group relative block rounded-2xl p-5 md:p-6 border border-gray-100 bg-white hover:border-transparent hover:shadow-lg transition"
      style={{
        backgroundImage: `linear-gradient(white, white), linear-gradient(135deg, ${accent}, ${withAlpha(
          accent,
          0.4
        )})`,
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold mb-3"
        style={{ background: accent }}
      >
        {TENT_LABELS[tent].charAt(0)}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {TENT_LABELS[tent]}
      </div>
      <h3 className="mt-1 text-lg md:text-xl font-bold text-gray-900">
        {content.headline}
      </h3>
      <p className="mt-1.5 text-sm text-gray-600 line-clamp-2">
        {content.subhead}
      </p>
      <span
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all"
        style={{ color: accent }}
      >
        {content.cta_label} →
      </span>
    </Link>
  )
}

/* ----- 5. Mosaico — asymmetric masonry grid ----- */

function MosaicoTents({
  tents,
  accent,
}: {
  tents: OrderedTent[]
  accent: string
}) {
  // Assign varied tile sizes deterministically by index so each tent always
  // lands in the same slot between renders.
  const tileClass = (index: number, total: number): string => {
    // Featured rhythm: big, small, wide, tall, small, wide ...
    const pattern = [
      "md:col-span-2 md:row-span-2", // big square
      "md:col-span-1 md:row-span-1", // small
      "md:col-span-2 md:row-span-1", // wide
      "md:col-span-1 md:row-span-2", // tall
      "md:col-span-1 md:row-span-1", // small
      "md:col-span-2 md:row-span-1", // wide
    ]
    // When there are few tents, avoid gaps by always making the first one big
    if (total === 1) return "md:col-span-4 md:row-span-2"
    if (total === 2 && index === 0) return "md:col-span-2 md:row-span-2"
    if (total === 2 && index === 1) return "md:col-span-2 md:row-span-2"
    return pattern[index % pattern.length]
  }

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 py-10">
      <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[180px] md:auto-rows-[200px] gap-3 md:gap-4">
        {tents.map((row, idx) => (
          <MosaicTile
            key={row.tent}
            row={row}
            accent={accent}
            sizeClass={tileClass(idx, tents.length)}
          />
        ))}
      </div>
    </section>
  )
}

function MosaicTile({
  row,
  accent,
  sizeClass,
}: {
  row: OrderedTent
  accent: string
  sizeClass: string
}) {
  const { tent, content } = row
  const href = TENT_DEFAULT_PATHS[tent]
  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-2xl shadow-sm hover:shadow-xl transition ${sizeClass}`}
    >
      {content.hero_image_url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.hero_image_url}
            alt={content.headline}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${withAlpha(accent, 0.55)})`,
          }}
        />
      )}
      <div className="relative h-full w-full flex flex-col justify-end p-4 md:p-5 text-white">
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
          {TENT_LABELS[tent]}
        </div>
        <h3 className="mt-1 text-lg md:text-2xl font-bold leading-tight drop-shadow-sm">
          {content.headline}
        </h3>
        <span className="mt-1 text-xs md:text-sm font-semibold opacity-90 group-hover:opacity-100">
          {content.cta_label} →
        </span>
      </div>
    </Link>
  )
}

/* ----- 6. Carrusel — horizontal scroll-snap cards (pure CSS, no client JS) ----- */

function CarruselTents({
  tents,
  accent,
}: {
  tents: OrderedTent[]
  accent: string
}) {
  return (
    <section className="py-10">
      <div className="max-w-6xl mx-auto px-4 md:px-6 flex items-end justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">
          Explora nuestros servicios
        </h2>
        <span className="text-xs text-gray-500 hidden md:block">
          Desliza para ver más →
        </span>
      </div>
      <div
        className="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory px-4 md:px-6 pb-4 scroll-smooth"
        style={{ scrollbarWidth: "thin" }}
      >
        {tents.map((row) => (
          <CarouselCard key={row.tent} row={row} accent={accent} />
        ))}
        {/* Trailing spacer so last card can snap with breathing room */}
        <div aria-hidden className="shrink-0 w-2 md:w-4" />
      </div>
    </section>
  )
}

function CarouselCard({
  row,
  accent,
}: {
  row: OrderedTent
  accent: string
}) {
  const { tent, content } = row
  const href = TENT_DEFAULT_PATHS[tent]
  return (
    <Link
      href={href}
      className="group snap-start shrink-0 w-[78%] md:w-[420px] overflow-hidden rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-lg transition"
    >
      <div className="relative h-48 md:h-56">
        {content.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.hero_image_url}
            alt={content.headline}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${withAlpha(accent, 0.55)})`,
            }}
          >
            {TENT_LABELS[tent]}
          </div>
        )}
      </div>
      <div className="p-5 md:p-6">
        <div
          className="inline-flex items-center gap-1 self-start text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: withAlpha(accent, 0.12), color: accent }}
        >
          {TENT_LABELS[tent]}
        </div>
        <h3 className="mt-2 text-xl md:text-2xl font-bold text-gray-900">
          {content.headline}
        </h3>
        <p className="mt-1.5 text-sm text-gray-600 line-clamp-2">
          {content.subhead}
        </p>
        <span
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all"
          style={{ color: accent }}
        >
          {content.cta_label} →
        </span>
      </div>
    </Link>
  )
}

/* --------------------- Mobile Apps Band --------------------- */

function MobileAppsBand({
  settings,
  accent,
}: {
  settings: HubLandingSettings
  accent: string
}) {
  const copy = settings.mobile_apps_copy || "Descarga nuestra app"

  if (settings.mobile_apps_variant === "compact") {
    return (
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div
          className="rounded-2xl px-6 py-5 flex flex-col md:flex-row items-center gap-4 justify-between"
          style={{ background: withAlpha(accent, 0.08) }}
        >
          <p className="text-lg font-semibold text-gray-900">{copy}</p>
          <div className="flex items-center gap-3">
            <StoreBadges settings={settings} />
          </div>
        </div>
      </section>
    )
  }

  // showcase
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="flex items-center justify-center">
          {settings.mobile_apps_hero_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.mobile_apps_hero_image_url}
              alt="App mockup"
              className="w-full max-w-xs object-contain"
            />
          ) : (
            <div
              className="w-48 h-96 rounded-[2.5rem] border-8 border-gray-900 bg-gray-50 shadow-xl flex items-center justify-center text-gray-400 text-sm"
              aria-hidden
            >
              App preview
            </div>
          )}
        </div>
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{copy}</h2>
          <p className="mt-3 text-gray-700">
            Ordena más rápido, guarda tus direcciones y mira el estado de tu
            pedido en tiempo real.
          </p>
          <div className="mt-5">
            <StoreBadges settings={settings} />
          </div>
        </div>
      </div>
    </section>
  )
}

function StoreBadges({ settings }: { settings: HubLandingSettings }) {
  return (
    <div className="flex items-center gap-3">
      {settings.ios_app_url && (
        <Link
          href={settings.ios_app_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          <span className="text-[10px] leading-none uppercase opacity-80">
            Disponible en
          </span>
          <span className="text-base font-semibold leading-none">App Store</span>
        </Link>
      )}
      {settings.android_app_url && (
        <Link
          href={settings.android_app_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          <span className="text-[10px] leading-none uppercase opacity-80">
            Disponible en
          </span>
          <span className="text-base font-semibold leading-none">Google Play</span>
        </Link>
      )}
    </div>
  )
}

/* --------------------- Testimonials Band --------------------- */

function TestimonialsBand({
  testimonials,
  variant,
  heading,
  accent,
}: {
  testimonials: HubTestimonial[]
  variant: HubLandingSettings["testimonials_variant"]
  heading: string | null
  accent: string
}) {
  if (testimonials.length === 0) return null

  const title = heading || "Lo que dicen nuestros clientes"

  if (variant === "big-quote") {
    const t = testimonials[0]
    return (
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-16 text-center">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-6">
          {title}
        </h2>
        <blockquote
          className="text-2xl md:text-3xl font-semibold leading-snug text-gray-900"
          style={{ borderLeft: `4px solid ${accent}`, paddingLeft: "1rem", textAlign: "left" }}
        >
          &ldquo;{t.quote}&rdquo;
        </blockquote>
        <div className="mt-4 text-sm text-gray-600">
          — {t.author_name}
          {t.author_location ? ` · ${t.author_location}` : ""}
        </div>
      </section>
    )
  }

  if (variant === "marquee") {
    return (
      <section className="py-12 bg-gray-50 overflow-hidden">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-gray-500 mb-6">
          {title}
        </h2>
        <div className="flex gap-4 overflow-x-auto px-4 md:px-6 snap-x">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="min-w-[260px] snap-center bg-white rounded-xl p-4 shadow-sm border border-gray-100"
            >
              <Stars rating={t.rating} />
              <p className="mt-2 text-sm text-gray-800 italic">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-2 text-xs text-gray-600">
                — {t.author_name}
                {t.author_location ? ` · ${t.author_location}` : ""}
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  // cards-row (default)
  const visible = testimonials.slice(0, 3)
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 py-12">
      <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-gray-500 mb-8">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {visible.map((t) => (
          <div
            key={t.id}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col"
          >
            <Stars rating={t.rating} />
            <p className="mt-3 text-base text-gray-800 flex-1">&ldquo;{t.quote}&rdquo;</p>
            <div className="mt-4 flex items-center gap-3">
              {t.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.avatar_url}
                  alt={t.author_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: accent }}
                >
                  {t.author_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {t.author_name}
                </div>
                {t.author_location && (
                  <div className="text-xs text-gray-500">{t.author_location}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null
  return (
    <div className="text-amber-500 text-sm">
      {"★".repeat(rating)}
      <span className="text-gray-300">{"★".repeat(5 - rating)}</span>
    </div>
  )
}

/* --------------------- Trust Markers Band --------------------- */

function TrustMarkersBand({
  markers,
  heading,
}: {
  markers: HubLandingSettings["trust_markers"]
  heading: string | null
}) {
  if (!markers || markers.length === 0) return null
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 py-10">
      {heading && (
        <h2 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-6">
          {heading}
        </h2>
      )}
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {markers.map((m, i) => {
          const content = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.logo_url}
              alt={m.name}
              className="h-8 md:h-10 w-auto object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition"
            />
          )
          return m.url ? (
            <Link key={i} href={m.url} target="_blank" rel="noopener noreferrer">
              {content}
            </Link>
          ) : (
            <div key={i}>{content}</div>
          )
        })}
      </div>
    </section>
  )
}

/* --------------------- utils --------------------- */

function withAlpha(color: string, alpha: number): string {
  // Accepts #rgb / #rrggbb / rgb(...) / rgba(...) / arbitrary strings.
  // Falls back to an rgba with 0 if parsing fails.
  if (!color) return `rgba(0,0,0,${alpha})`
  if (color.startsWith("#")) {
    const hex = color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    if ([r, g, b].every((n) => !Number.isNaN(n))) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
  }
  if (color.startsWith("rgb")) {
    return color.replace(/rgba?\(([^)]+)\)/, (_m, inner) => {
      const parts = inner.split(",").map((s: string) => s.trim())
      const [r, g, b] = parts
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    })
  }
  return color
}

function fontPairClass(pair: HubLandingSettings["font_pair"]): string {
  if (pair === "serif-sans") return "font-serif [&_h1]:font-serif [&_h2]:font-serif"
  if (pair === "display-sans") return "tracking-tight"
  return ""
}
