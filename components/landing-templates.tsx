"use client"

// Hub landing templates — client-only React components.
//
// Types, constants, and pure helpers have moved to
// ./landing-templates-shared.ts so server components can import them safely.
// Only the React preview component lives here.

import {
  type HubLandingTemplate,
  TEMPLATE_INFO,
} from "./landing-templates-shared"

// Re-export the public API from the shared module so existing imports like
// `import { HubTentKey, getEnabledTents } from "@/components/landing-templates"`
// continue to resolve through the client entry point. Server-side imports
// should use landing-templates-shared directly.
export * from "./landing-templates-shared"

/**
 * TemplatePreview card — same visual pattern as components/design-templates.tsx
 * TemplatePreview. Shows a mini wireframe of the template, the name, the
 * description, and a checkmark when selected.
 */
interface HubLandingPreviewProps {
  template: HubLandingTemplate
  isSelected: boolean
  onSelect: () => void
}

export function HubLandingPreview({ template, isSelected, onSelect }: HubLandingPreviewProps) {
  const info = TEMPLATE_INFO[template]

  return (
    <div
      className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
        isSelected
          ? "border-purple-500 ring-2 ring-purple-500/20"
          : "border-gray-200 hover:border-gray-300"
      }`}
      onClick={onSelect}
    >
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center shadow">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}

      <div className="mb-3 rounded overflow-hidden border bg-white">
        <MiniMockup template={template} />
      </div>

      <div className="flex items-center justify-between mb-1">
        <h4 className="font-semibold text-sm">{info.name}</h4>
        <span className="text-[10px] font-medium uppercase tracking-wide text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
          {info.recommendedTentsLabel}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1 leading-snug">{info.description}</p>
    </div>
  )
}

/**
 * Tiny wireframe renderings per template. Pure CSS, no real data, no images —
 * just schematic rectangles to communicate layout. Kept visually close to the
 * restaurant TemplatePreview mini-mockups.
 */
function MiniMockup({ template }: { template: HubLandingTemplate }) {
  const headerBar = (
    <div className="h-5 bg-gray-50 border-b flex items-center px-2">
      <div className="w-5 h-2.5 bg-gray-300 rounded-sm" />
      <div className="ml-auto flex gap-1">
        <div className="w-5 h-2 bg-gray-200 rounded-sm" />
        <div className="w-5 h-2 bg-gray-200 rounded-sm" />
      </div>
    </div>
  )

  if (template === "doble-puerta") {
    return (
      <div>
        {headerBar}
        <div className="h-24 flex">
          <div className="flex-1 bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center">
            <div className="w-10 h-3 bg-white/80 rounded" />
          </div>
          <div className="flex-1 bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
            <div className="w-10 h-3 bg-white/80 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (template === "losetas-verticales") {
    return (
      <div>
        {headerBar}
        <div className="space-y-0.5">
          <div className="h-8 bg-gradient-to-r from-pink-100 to-pink-200 flex items-center px-2">
            <div className="w-10 h-2 bg-white/80 rounded" />
            <div className="ml-auto w-6 h-3 bg-white rounded-sm" />
          </div>
          <div className="h-8 bg-gradient-to-r from-amber-100 to-amber-200 flex items-center px-2">
            <div className="w-10 h-2 bg-white/80 rounded" />
            <div className="ml-auto w-6 h-3 bg-white rounded-sm" />
          </div>
          <div className="h-8 bg-gradient-to-r from-sky-100 to-sky-200 flex items-center px-2">
            <div className="w-10 h-2 bg-white/80 rounded" />
            <div className="ml-auto w-6 h-3 bg-white rounded-sm" />
          </div>
        </div>
      </div>
    )
  }

  if (template === "hub-unificado") {
    return (
      <div>
        {headerBar}
        <div className="h-24 bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center gap-2">
          <div className="w-24 h-3 bg-gray-300 rounded" />
          <div className="flex gap-1">
            <div className="w-8 h-3 bg-purple-500 rounded-full" />
            <div className="w-8 h-3 bg-white border rounded-full" />
            <div className="w-8 h-3 bg-white border rounded-full" />
          </div>
          <div className="w-28 h-4 bg-white border rounded" />
        </div>
      </div>
    )
  }

  if (template === "mosaico") {
    return (
      <div>
        {headerBar}
        <div className="h-24 bg-slate-50 flex items-center justify-center">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="w-12 h-10 bg-white rounded border flex items-center justify-center">
              <div className="w-4 h-4 bg-pink-300 rounded-full" />
            </div>
            <div className="w-12 h-10 bg-white rounded border flex items-center justify-center">
              <div className="w-4 h-4 bg-amber-300 rounded-full" />
            </div>
            <div className="w-12 h-10 bg-white rounded border flex items-center justify-center">
              <div className="w-4 h-4 bg-sky-300 rounded-full" />
            </div>
            <div className="w-12 h-10 bg-white/50 rounded border border-dashed" />
          </div>
        </div>
      </div>
    )
  }

  if (template === "principal-secundario") {
    return (
      <div>
        {headerBar}
        <div className="space-y-0.5">
          <div className="h-14 bg-gradient-to-br from-pink-200 to-pink-300 flex items-center px-2">
            <div className="space-y-1">
              <div className="w-16 h-2 bg-white rounded" />
              <div className="w-10 h-1.5 bg-white/70 rounded" />
              <div className="w-8 h-3 bg-white rounded-sm" />
            </div>
          </div>
          <div className="flex gap-0.5">
            <div className="h-8 flex-1 bg-amber-100 flex items-center px-2">
              <div className="w-8 h-2 bg-white rounded" />
            </div>
            <div className="h-8 flex-1 bg-sky-100 flex items-center px-2">
              <div className="w-8 h-2 bg-white rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // carrusel
  return (
    <div>
      {headerBar}
      <div className="h-16 bg-gradient-to-br from-pink-200 to-pink-300 flex items-center justify-center relative">
        <div className="space-y-1">
          <div className="w-16 h-2 bg-white rounded mx-auto" />
          <div className="w-10 h-1.5 bg-white/70 rounded mx-auto" />
        </div>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
          <div className="w-1.5 h-1.5 bg-white rounded-full" />
          <div className="w-1.5 h-1.5 bg-white/50 rounded-full" />
          <div className="w-1.5 h-1.5 bg-white/50 rounded-full" />
        </div>
      </div>
      <div className="h-8 bg-slate-50 flex items-center justify-center gap-1 border-t">
        <div className="w-10 h-5 bg-white border rounded" />
        <div className="w-10 h-5 bg-white border rounded" />
        <div className="w-10 h-5 bg-white border rounded" />
      </div>
    </div>
  )
}
