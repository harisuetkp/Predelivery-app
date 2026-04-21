"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import {
  Loader2,
  Save,
  Pencil,
  Eye,
  Rocket,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Smartphone,
  MessageSquareQuote,
  ExternalLink,
  BadgeCheck,
  Palette,
} from "lucide-react"
import {
  HubLandingPreview,
  TEMPLATE_INFO,
  TENT_LABELS,
  TENT_DEFAULT_PATHS,
  DEFAULT_SECTION_ORDER,
  defaultTentContent,
  type HubLandingSettings,
  type HubLandingTemplate,
  type HubTentKey,
  type HubTentContent,
  type HubTestimonial,
  type HubFontPair,
  type HubIconPack,
  type HubBackgroundTreatment,
} from "@/components/landing-templates"
import {
  saveLandingSettings,
  publishLanding,
  saveTestimonial,
  deleteTestimonial,
} from "./actions"
import { ImageUpload } from "@/components/image-upload"

interface OperatorLite {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string | null
}

interface Props {
  operator: OperatorLite
  enabledTents: HubTentKey[]
  initialSettings: HubLandingSettings
  initialTestimonials: HubTestimonial[]
}

const TEMPLATE_ORDER: HubLandingTemplate[] = [
  "losetas-verticales",
  "doble-puerta",
  "hub-unificado",
  "mosaico",
  "principal-secundario",
  "carrusel",
]

const FONT_PAIRS: Array<{ value: HubFontPair; label: string; sample: string }> = [
  { value: "sans-sans", label: "Sans / Sans", sample: "Moderno y neutral" },
  { value: "serif-sans", label: "Serif / Sans", sample: "Clásico con carácter" },
  { value: "display-sans", label: "Display / Sans", sample: "Impacto visual" },
]

const ICON_PACKS: Array<{ value: HubIconPack; label: string }> = [
  { value: "moderno", label: "Moderno" },
  { value: "clasico", label: "Clásico" },
  { value: "ilustrado", label: "Ilustrado" },
]

const BG_TREATMENTS: Array<{ value: HubBackgroundTreatment; label: string }> = [
  { value: "photo", label: "Foto" },
  { value: "pattern", label: "Patrón" },
  { value: "solid", label: "Color sólido" },
  { value: "gradient", label: "Gradiente" },
]

export function LandingDesignClient({
  operator,
  enabledTents,
  initialSettings,
  initialTestimonials,
}: Props) {
  const [settings, setSettings] = useState<HubLandingSettings>(initialSettings)
  const [testimonials, setTestimonials] = useState<HubTestimonial[]>(initialTestimonials)
  const [savePending, startSave] = useTransition()
  const [publishPending, startPublish] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState<string | null>(null)
  const [draftTestimonial, setDraftTestimonial] = useState<Partial<HubTestimonial> | null>(null)
  const [testimonialError, setTestimonialError] = useState<string | null>(null)
  const [testimonialPending, startTestimonial] = useTransition()

  const enabledSet = useMemo(() => new Set(enabledTents), [enabledTents])

  const handleSave = () => {
    setSaveError(null)
    setSaveOk(null)

    // Client pre-validation
    if (settings.mobile_apps_enabled) {
      if (!settings.ios_app_url && !settings.android_app_url) {
        setSaveError("Mobile Apps está activa pero no hay URL de iOS ni Android.")
        return
      }
    }

    startSave(async () => {
      const res = await saveLandingSettings(settings)
      if (!res.ok) {
        setSaveError(res.error)
        return
      }
      setSettings(res.data)
      setSaveOk("Configuración guardada")
      setTimeout(() => setSaveOk(null), 2500)
    })
  }

  const handleTogglePublish = () => {
    setSaveError(null)
    const next = !settings.is_published
    startPublish(async () => {
      const res = await publishLanding(next)
      if (!res.ok) {
        setSaveError(res.error)
        return
      }
      setSettings((s) => ({ ...s, is_published: res.data.is_published }))
      setSaveOk(
        res.data.is_published
          ? "Landing publicada en /inicio"
          : "Landing despublicada"
      )
      setTimeout(() => setSaveOk(null), 2500)
    })
  }

  const updateTent = (tent: HubTentKey, patch: Partial<HubTentContent>) => {
    setSettings((s) => ({
      ...s,
      tents: {
        ...s.tents,
        [tent]: {
          ...(s.tents[tent] ?? defaultTentContent(tent)),
          ...patch,
        },
      },
    }))
  }

  const toggleSection = (key: string) => {
    setSettings((s) => {
      const order = s.section_order.includes(key as (typeof DEFAULT_SECTION_ORDER)[number])
        ? s.section_order.filter((k) => k !== key)
        : [...s.section_order, key as (typeof DEFAULT_SECTION_ORDER)[number]]
      return { ...s, section_order: order }
    })
  }

  const handleSaveTestimonial = () => {
    if (!draftTestimonial) return
    setTestimonialError(null)
    startTestimonial(async () => {
      const res = await saveTestimonial(draftTestimonial)
      if (!res.ok) {
        setTestimonialError(res.error)
        return
      }
      setTestimonials((list) => {
        const existing = list.findIndex((t) => t.id === res.data.id)
        if (existing >= 0) {
          const next = [...list]
          next[existing] = res.data
          return next
        }
        return [...list, res.data].sort((a, b) => a.display_order - b.display_order)
      })
      setDraftTestimonial(null)
    })
  }

  const handleDeleteTestimonial = (id: string) => {
    if (!confirm("¿Eliminar este testimonio?")) return
    setTestimonialError(null)
    startTestimonial(async () => {
      const res = await deleteTestimonial(id)
      if (!res.ok) {
        setTestimonialError(res.error)
        return
      }
      setTestimonials((list) => list.filter((t) => t.id !== id))
    })
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Top summary bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
            <Palette className="w-4 h-4" />
            Diseños de Landing · {operator.name}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Página unificada de operador en{" "}
            <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">/inicio</code>.
            Los tents activos son:{" "}
            {enabledTents.length === 0 ? (
              <span className="text-red-600 font-medium">Ninguno</span>
            ) : (
              <span className="font-medium text-gray-800">
                {enabledTents.map((t) => TENT_LABELS[t]).join(" · ")}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveOk && (
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              {saveOk}
            </span>
          )}
          {saveError && (
            <span className="flex items-center gap-1 text-sm text-red-600 max-w-xs">
              <XCircle className="w-4 h-4" />
              {saveError}
            </span>
          )}

          <Link
            href="/inicio?preview=1"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Eye className="w-4 h-4" />
            Previsualizar
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </Link>

          <button
            type="button"
            onClick={handleSave}
            disabled={savePending}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60"
          >
            {savePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>

          <button
            type="button"
            onClick={handleTogglePublish}
            disabled={publishPending || savePending}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg disabled:opacity-60 ${
              settings.is_published
                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                : "bg-purple-600 text-white hover:bg-purple-700"
            }`}
          >
            {publishPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            {settings.is_published ? "Despublicar" : "Publicar"}
          </button>
        </div>
      </div>

      {/* Template picker */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-900">Plantilla</h2>
          <p className="text-xs text-gray-500">
            Elige el esqueleto de la landing. La misma plantilla se diferencia por operador
            usando tipografía, íconos, colores y fotos.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATE_ORDER.map((t) => (
            <HubLandingPreview
              key={t}
              template={t}
              isSelected={settings.template === t}
              onSelect={() => setSettings((s) => ({ ...s, template: t }))}
            />
          ))}
        </div>
      </section>

      {/* Branding controls */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FieldCard title="Tipografía" hint="Pareja de fuentes">
          <div className="space-y-2">
            {FONT_PAIRS.map((fp) => (
              <label
                key={fp.value}
                className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer ${
                  settings.font_pair === fp.value
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{fp.label}</div>
                  <div className="text-xs text-gray-500">{fp.sample}</div>
                </div>
                <input
                  type="radio"
                  name="font_pair"
                  className="accent-purple-600"
                  checked={settings.font_pair === fp.value}
                  onChange={() => setSettings((s) => ({ ...s, font_pair: fp.value }))}
                />
              </label>
            ))}
          </div>
        </FieldCard>

        <FieldCard title="Íconos" hint="Estilo de íconos">
          <div className="space-y-2">
            {ICON_PACKS.map((ip) => (
              <label
                key={ip.value}
                className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer ${
                  settings.icon_pack === ip.value
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="text-sm font-medium">{ip.label}</span>
                <input
                  type="radio"
                  name="icon_pack"
                  className="accent-purple-600"
                  checked={settings.icon_pack === ip.value}
                  onChange={() => setSettings((s) => ({ ...s, icon_pack: ip.value }))}
                />
              </label>
            ))}
          </div>
        </FieldCard>

        <FieldCard title="Fondo / Color" hint="Estilo de fondo + acento">
          <div className="space-y-2">
            <select
              value={settings.background_treatment}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  background_treatment: e.target.value as HubBackgroundTreatment,
                }))
              }
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              {BG_TREATMENTS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.accent_color ?? operator.primary_color ?? "#e91e8c"}
                onChange={(e) => setSettings((s) => ({ ...s, accent_color: e.target.value }))}
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={settings.accent_color ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, accent_color: e.target.value || null }))
                }
                placeholder={operator.primary_color ?? "#e91e8c"}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono"
              />
            </div>
            <p className="text-xs text-gray-500">
              Dejar vacío para usar el color primario del operador.
            </p>
          </div>
        </FieldCard>
      </section>

      {/* Per-tent content */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-900">Contenido por Tent</h2>
          <p className="text-xs text-gray-500">
            Cada tent que tu operador tiene activo aparece en la landing. Las
            configuraciones para tents inactivos se guardan pero no se muestran.
          </p>
        </div>

        <div className="space-y-3">
          {(["delivery", "catering", "subscription"] as HubTentKey[]).map((tent) => {
            const content = settings.tents[tent] ?? defaultTentContent(tent)
            const isActive = enabledSet.has(tent)
            return (
              <div
                key={tent}
                className={`rounded-xl border p-4 ${
                  isActive ? "bg-white border-gray-200" : "bg-gray-50 border-gray-200 opacity-70"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-gray-900">
                    {TENT_LABELS[tent]}
                  </span>
                  {isActive ? (
                    <span className="text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                      Activo
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                      Inactivo
                    </span>
                  )}
                  <span className="ml-auto text-xs text-gray-500 font-mono">
                    {TENT_DEFAULT_PATHS[tent]}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <TextField
                    label="Titular"
                    value={content.headline}
                    onChange={(v) => updateTent(tent, { headline: v })}
                  />
                  <TextField
                    label="Subtítulo"
                    value={content.subhead}
                    onChange={(v) => updateTent(tent, { subhead: v })}
                  />
                  <TextField
                    label="Etiqueta del CTA"
                    value={content.cta_label}
                    onChange={(v) => updateTent(tent, { cta_label: v })}
                  />
                  <ImageUpload
                    label="Imagen hero"
                    value={content.hero_image_url ?? ""}
                    onChange={(url) =>
                      updateTent(tent, { hero_image_url: url || null })
                    }
                    onRemove={() => updateTent(tent, { hero_image_url: null })}
                    bucket="images"
                    folder={`landing/tents/${tent}`}
                  />
                  <NumberField
                    label="Orden"
                    value={content.order}
                    onChange={(v) => updateTent(tent, { order: v })}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Mobile Apps section */}
      <section>
        <SectionToggleHeader
          icon={<Smartphone className="w-4 h-4" />}
          title="Mobile Apps"
          hint="Muestra los badges de App Store / Google Play si tienes apps disponibles"
          enabled={settings.mobile_apps_enabled}
          onToggle={(v) => setSettings((s) => ({ ...s, mobile_apps_enabled: v }))}
        />

        {settings.mobile_apps_enabled && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex gap-2">
              {(["compact", "showcase"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({ ...s, mobile_apps_variant: v }))
                  }
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                    settings.mobile_apps_variant === v
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {v === "compact" ? "Compacto (banda + badges)" : "Showcase (mockup + features)"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextField
                label="Copy principal"
                value={settings.mobile_apps_copy ?? ""}
                placeholder="Descarga nuestra app"
                onChange={(v) =>
                  setSettings((s) => ({ ...s, mobile_apps_copy: v || null }))
                }
              />
              <div className="md:col-span-2">
                <ImageUpload
                  label="Imagen mockup (solo showcase)"
                  value={settings.mobile_apps_hero_image_url ?? ""}
                  onChange={(url) =>
                    setSettings((s) => ({
                      ...s,
                      mobile_apps_hero_image_url: url || null,
                    }))
                  }
                  onRemove={() =>
                    setSettings((s) => ({
                      ...s,
                      mobile_apps_hero_image_url: null,
                    }))
                  }
                  bucket="images"
                  folder="landing/mobile-apps"
                />
              </div>
              <TextField
                label="URL App Store (iOS)"
                value={settings.ios_app_url ?? ""}
                placeholder="https://apps.apple.com/..."
                onChange={(v) =>
                  setSettings((s) => ({ ...s, ios_app_url: v.trim() || null }))
                }
              />
              <TextField
                label="URL Google Play (Android)"
                value={settings.android_app_url ?? ""}
                placeholder="https://play.google.com/..."
                onChange={(v) =>
                  setSettings((s) => ({ ...s, android_app_url: v.trim() || null }))
                }
              />
            </div>
            <p className="text-xs text-gray-500">
              Si no hay URLs, la sección no se renderiza aunque esté activa (sin
              "próximamente" ni links muertos).
            </p>
          </div>
        )}
      </section>

      {/* Testimonials section */}
      <section>
        <SectionToggleHeader
          icon={<MessageSquareQuote className="w-4 h-4" />}
          title="Testimonios de Clientes"
          hint="Muestra reseñas reales de clientes en una banda configurable"
          enabled={settings.testimonials_enabled}
          onToggle={(v) => setSettings((s) => ({ ...s, testimonials_enabled: v }))}
        />

        {settings.testimonials_enabled && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              {(["cards-row", "marquee", "big-quote"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({ ...s, testimonials_variant: v }))
                  }
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                    settings.testimonials_variant === v
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {v === "cards-row"
                    ? "3 Tarjetas"
                    : v === "marquee"
                      ? "Marquesina"
                      : "Quote grande"}
                </button>
              ))}

              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() =>
                    setDraftTestimonial({
                      author_name: "",
                      author_location: "",
                      rating: 5,
                      quote: "",
                      avatar_url: "",
                      display_order: testimonials.length,
                      is_published: true,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir testimonio
                </button>
              </div>
            </div>

            <TextField
              label="Encabezado de la sección"
              value={settings.testimonials_heading ?? ""}
              placeholder="Lo que dicen nuestros clientes"
              onChange={(v) =>
                setSettings((s) => ({ ...s, testimonials_heading: v || null }))
              }
            />

            {testimonialError && (
              <div className="flex items-center gap-1.5 text-sm text-red-600">
                <XCircle className="w-4 h-4" />
                {testimonialError}
              </div>
            )}

            {/* Testimonial list */}
            {testimonials.length === 0 && !draftTestimonial && (
              <div className="text-sm text-gray-500 italic">
                Aún no hay testimonios. Añade al menos uno para que la sección se muestre.
              </div>
            )}

            {testimonials.length > 0 && (
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {testimonials.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start gap-3 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {t.author_name}
                        </span>
                        {t.author_location && (
                          <span className="text-xs text-gray-500">
                            · {t.author_location}
                          </span>
                        )}
                        {t.rating && (
                          <span className="text-xs text-amber-500">
                            {"★".repeat(t.rating)}
                            <span className="text-gray-300">
                              {"★".repeat(5 - t.rating)}
                            </span>
                          </span>
                        )}
                        {!t.is_published && (
                          <span className="text-[10px] font-semibold uppercase bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                            Oculto
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                        {t.quote}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDraftTestimonial(t)}
                        className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTestimonial(t.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Testimonial editor */}
            {draftTestimonial && (
              <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <TextField
                    label="Nombre del autor"
                    value={draftTestimonial.author_name ?? ""}
                    onChange={(v) =>
                      setDraftTestimonial((d) => ({ ...(d ?? {}), author_name: v }))
                    }
                  />
                  <TextField
                    label="Ubicación"
                    value={draftTestimonial.author_location ?? ""}
                    placeholder="San Juan, PR"
                    onChange={(v) =>
                      setDraftTestimonial((d) => ({ ...(d ?? {}), author_location: v }))
                    }
                  />
                  <NumberField
                    label="Rating (1-5)"
                    value={draftTestimonial.rating ?? 5}
                    min={1}
                    max={5}
                    onChange={(v) =>
                      setDraftTestimonial((d) => ({ ...(d ?? {}), rating: v }))
                    }
                  />
                  <ImageUpload
                    label="Avatar (opcional)"
                    value={draftTestimonial.avatar_url ?? ""}
                    onChange={(url) =>
                      setDraftTestimonial((d) => ({
                        ...(d ?? {}),
                        avatar_url: url || null,
                      }))
                    }
                    onRemove={() =>
                      setDraftTestimonial((d) => ({
                        ...(d ?? {}),
                        avatar_url: null,
                      }))
                    }
                    bucket="images"
                    folder="landing/testimonials"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Testimonio
                  </label>
                  <textarea
                    value={draftTestimonial.quote ?? ""}
                    onChange={(e) =>
                      setDraftTestimonial((d) => ({ ...(d ?? {}), quote: e.target.value }))
                    }
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={draftTestimonial.is_published ?? true}
                      onChange={(e) =>
                        setDraftTestimonial((d) => ({
                          ...(d ?? {}),
                          is_published: e.target.checked,
                        }))
                      }
                    />
                    Publicado
                  </label>
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDraftTestimonial(null)}
                      className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTestimonial}
                      disabled={testimonialPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60"
                    >
                      {testimonialPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Guardar testimonio
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Trust markers section */}
      <section>
        <SectionToggleHeader
          icon={<BadgeCheck className="w-4 h-4" />}
          title="Socios / Prensa"
          hint="Logos de socios, premios o medios donde el operador ha aparecido"
          enabled={settings.trust_markers_enabled}
          onToggle={(v) =>
            setSettings((s) => ({ ...s, trust_markers_enabled: v }))
          }
        />

        {settings.trust_markers_enabled && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <TextField
              label="Encabezado"
              value={settings.trust_markers_heading ?? ""}
              placeholder="Confían en nosotros"
              onChange={(v) =>
                setSettings((s) => ({ ...s, trust_markers_heading: v || null }))
              }
            />
            <TrustMarkersEditor
              markers={settings.trust_markers}
              onChange={(markers) =>
                setSettings((s) => ({ ...s, trust_markers: markers }))
              }
            />
          </div>
        )}
      </section>

      {/* Section order */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-900">Orden de secciones</h2>
          <p className="text-xs text-gray-500">
            Activa/desactiva y reordena bandas opcionales. "hero" y "tents" son siempre primeros.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
          {DEFAULT_SECTION_ORDER.filter(
            (k) => k === "mobile_apps" || k === "testimonials" || k === "trust_markers"
          ).map((key) => {
            const active = settings.section_order.includes(key)
            const enabledForKey =
              key === "mobile_apps"
                ? settings.mobile_apps_enabled
                : key === "testimonials"
                  ? settings.testimonials_enabled
                  : settings.trust_markers_enabled
            return (
              <div
                key={key}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100"
              >
                <div>
                  <div className="text-sm font-medium capitalize">
                    {key.replace("_", " ")}
                  </div>
                  {!enabledForKey && (
                    <div className="text-xs text-gray-400">
                      Sección desactivada arriba — no se renderizará aunque esté en el orden.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleSection(key)}
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    active
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {active ? "En la página" : "Excluida"}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Summary card */}
      <section>
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium mb-1">Resumen</p>
          <p>
            Plantilla: <strong>{TEMPLATE_INFO[settings.template].name}</strong>. Tents
            activos: <strong>{enabledTents.map((t) => TENT_LABELS[t]).join(" · ") || "ninguno"}</strong>.
            Mobile Apps: <strong>{settings.mobile_apps_enabled ? "activa" : "off"}</strong>.
            Testimonios: <strong>{settings.testimonials_enabled ? `activos (${testimonials.length})` : "off"}</strong>.
            Estado: <strong>{settings.is_published ? "Publicada en /inicio" : "Borrador"}</strong>.
          </p>
        </div>
      </section>
    </div>
  )
}

/* ---------- Subcomponents ---------- */

function FieldCard({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
      />
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
      />
    </div>
  )
}

function SectionToggleHeader({
  icon,
  title,
  hint,
  enabled,
  onToggle,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  enabled: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
          {icon}
          {title}
        </div>
        <p className="text-xs text-gray-500">{hint}</p>
      </div>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <span className="text-xs text-gray-600">{enabled ? "Activa" : "Desactivada"}</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="sr-only peer"
        />
        <span className="w-10 h-6 bg-gray-300 rounded-full peer-checked:bg-purple-600 relative transition-colors">
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              enabled ? "translate-x-4" : ""
            }`}
          />
        </span>
      </label>
    </div>
  )
}

function TrustMarkersEditor({
  markers,
  onChange,
}: {
  markers: Array<{ name: string; logo_url: string; url?: string | null }>
  onChange: (m: Array<{ name: string; logo_url: string; url?: string | null }>) => void
}) {
  const update = (idx: number, patch: Partial<{ name: string; logo_url: string; url: string | null }>) => {
    onChange(markers.map((m, i) => (i === idx ? { ...m, ...patch } : m)))
  }
  const remove = (idx: number) => onChange(markers.filter((_, i) => i !== idx))
  const add = () => onChange([...markers, { name: "", logo_url: "", url: null }])

  return (
    <div className="space-y-2">
      {markers.length === 0 && (
        <div className="text-sm text-gray-500 italic">
          Aún no hay socios/medios. Añade al menos uno para que la banda se muestre.
        </div>
      )}
      {markers.map((m, idx) => (
        <div
          key={idx}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start border border-gray-100 rounded-lg p-3"
        >
          <div className="space-y-3">
            <TextField
              label="Nombre"
              value={m.name}
              onChange={(v) => update(idx, { name: v })}
            />
            <TextField
              label="Link (opcional)"
              value={m.url ?? ""}
              onChange={(v) => update(idx, { url: v || null })}
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded"
              title="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
          </div>
          <div className="md:col-span-2">
            <ImageUpload
              label="Logo"
              value={m.logo_url}
              onChange={(url) => update(idx, { logo_url: url })}
              onRemove={() => update(idx, { logo_url: "" })}
              bucket="images"
              folder="landing/trust-markers"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <Plus className="w-3.5 h-3.5" />
        Añadir socio/medio
      </button>
    </div>
  )
}

