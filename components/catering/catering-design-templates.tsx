"use client"

import Image from "next/image"
import { Plus } from "lucide-react"
import { getCateringUnitLabelCard, getCateringMinQtyLabel } from "@/lib/catering-selling-units"
import type { CateringMenuItem, CateringServicePackage } from "@/lib/catering"

export type CateringDesignTemplate =
  | "modern"
  | "classic"
  | "bold"
  | "minimal"
  | "elegant"
  | "list-right"
  | "list-left"
  | "list-right-3col"
  | "list-left-3col"
  | "list-right-4col"
  | "list-left-4col"

export const CATERING_TEMPLATE_INFO: Record<CateringDesignTemplate, { name: string; description: string }> = {
  modern: { name: "Modern", description: "Clean lines, rounded corners, subtle shadows. Great for contemporary brands." },
  classic: { name: "Classic", description: "Traditional layout with serif accents and warm tones. Perfect for established restaurants." },
  bold: { name: "Bold", description: "High contrast, large typography, vibrant colors. Ideal for trendy, youthful brands." },
  minimal: { name: "Minimal", description: "Ultra-clean with lots of whitespace. Best for premium, upscale experiences." },
  elegant: { name: "Elegant", description: "Sophisticated with gold accents and refined typography. Perfect for fine dining." },
  "list-right": { name: "List Right (2 col)", description: "Horizontal rows with image on right. 2 columns on desktop." },
  "list-left": { name: "List Left (2 col)", description: "Horizontal rows with image on left. 2 columns on desktop." },
  "list-right-3col": { name: "List Right (3 col)", description: "Horizontal rows with image on right. 3 columns on desktop, ideal for short names." },
  "list-left-3col": { name: "List Left (3 col)", description: "Horizontal rows with image on left. 3 columns on desktop." },
  "list-right-4col": { name: "List Right (4 col)", description: "Horizontal rows with image on right. 4 columns on desktop, best for very short items." },
  "list-left-4col": { name: "List Left (4 col)", description: "Horizontal rows with image on left. 4 columns on desktop, best for very short items." },
}

interface CateringTemplateStyles {
  card: string
  cardHover: string
  image: string
  imageWrapper: string
  header: string
  title: string
  description: string
  price: string
  button: string
  grid: string
  sectionTitle: string
  categoryButton: string
  headerBar: string
  layout: "vertical" | "horizontal"
  imagePosition?: "left" | "right"
}

export const cateringTemplateStyles: Record<CateringDesignTemplate, CateringTemplateStyles> = {
  modern: {
    layout: "vertical",
    card: "bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden",
    cardHover: "hover:shadow-md hover:border-gray-200 transition-all duration-200",
    image: "object-cover w-full h-full",
    imageWrapper: "w-full h-48 bg-slate-100 relative",
    header: "p-3",
    title: "font-semibold text-gray-900 text-sm leading-tight",
    description: "text-xs text-gray-500 mt-0.5 line-clamp-2",
    price: "text-sm font-bold mt-2",
    button: "rounded-full w-7 h-7 flex items-center justify-center shadow-sm",
    grid: "grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-2 items-stretch",
    sectionTitle: "text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100",
    categoryButton: "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
    headerBar: "bg-white border-b border-gray-100 sticky top-0 z-10",
  },
  classic: {
    layout: "vertical",
    card: "bg-amber-50 rounded-lg border border-amber-100 overflow-hidden",
    cardHover: "hover:border-amber-300 hover:shadow-md transition-all duration-200",
    image: "object-cover w-full h-full",
    imageWrapper: "aspect-square w-full bg-amber-100",
    header: "p-3",
    title: "font-serif font-bold text-amber-900 text-sm leading-tight",
    description: "text-xs text-amber-700 mt-0.5 line-clamp-2 font-serif",
    price: "text-sm font-bold text-amber-800 mt-2 font-serif",
    button: "rounded w-7 h-7 flex items-center justify-center",
    grid: "grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-2",
    sectionTitle: "text-lg font-serif font-bold text-amber-900 mb-4 pb-2 border-b border-amber-200",
    categoryButton: "px-4 py-1.5 rounded text-sm font-serif font-medium transition-colors",
    headerBar: "bg-amber-50 border-b border-amber-200 sticky top-0 z-10",
  },
  bold: {
    layout: "vertical",
    card: "bg-black rounded-none border-2 border-yellow-400 overflow-hidden",
    cardHover: "hover:border-yellow-300 hover:shadow-lg hover:shadow-yellow-400/20 transition-all duration-200",
    image: "object-cover w-full h-full",
    imageWrapper: "aspect-square w-full bg-gray-900",
    header: "p-3",
    title: "font-black text-white text-sm uppercase tracking-wide leading-tight",
    description: "text-xs text-gray-400 mt-0.5 line-clamp-2",
    price: "text-sm font-black text-yellow-400 mt-2 uppercase",
    button: "rounded-none w-7 h-7 flex items-center justify-center border border-yellow-400",
    grid: "grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-2",
    sectionTitle: "text-lg font-black text-white mb-4 pb-2 border-b-2 border-yellow-400 uppercase tracking-widest",
    categoryButton: "px-4 py-1.5 rounded-none text-sm font-black uppercase tracking-wide transition-colors border",
    headerBar: "bg-black border-b-2 border-yellow-400 sticky top-0 z-10",
  },
  minimal: {
    layout: "vertical",
    card: "bg-white border-b border-gray-100 overflow-hidden rounded-none",
    cardHover: "hover:bg-gray-50 transition-colors duration-200",
    image: "object-cover w-full h-full",
    imageWrapper: "aspect-square w-full bg-gray-50",
    header: "p-3",
    title: "font-medium text-gray-900 text-sm leading-tight tracking-tight",
    description: "text-xs text-gray-400 mt-0.5 line-clamp-2",
    price: "text-sm font-medium text-gray-600 mt-2",
    button: "rounded-full w-7 h-7 flex items-center justify-center border border-gray-200",
    grid: "grid grid-cols-2 gap-0 sm:grid-cols-2 lg:grid-cols-2 divide-x divide-y divide-gray-100",
    sectionTitle: "text-sm font-medium text-gray-400 mb-4 uppercase tracking-widest",
    categoryButton: "px-4 py-1.5 rounded-none text-xs font-medium uppercase tracking-widest transition-colors",
    headerBar: "bg-white border-b border-gray-100 sticky top-0 z-10",
  },
  elegant: {
    layout: "vertical",
    card: "bg-stone-50 rounded-sm border border-stone-200 overflow-hidden",
    cardHover: "hover:border-yellow-600/40 hover:shadow-md transition-all duration-300",
    image: "object-cover w-full h-full",
    imageWrapper: "aspect-square w-full bg-stone-100",
    header: "p-3",
    title: "font-semibold text-stone-800 text-sm leading-tight tracking-wide",
    description: "text-xs text-stone-500 mt-0.5 line-clamp-2 italic",
    price: "text-sm font-semibold text-yellow-700 mt-2",
    button: "rounded-sm w-7 h-7 flex items-center justify-center border border-yellow-600/40",
    grid: "grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-2",
    sectionTitle: "text-base font-semibold text-stone-700 mb-4 pb-2 border-b border-yellow-600/30 tracking-widest uppercase",
    categoryButton: "px-4 py-1.5 rounded-sm text-xs font-medium uppercase tracking-widest transition-colors",
    headerBar: "bg-stone-50 border-b border-stone-200 sticky top-0 z-10",
  },
  "list-right": {
    layout: "horizontal",
    imagePosition: "right",
    card: "bg-white border-b border-gray-100 overflow-hidden",
    cardHover: "hover:bg-gray-50 transition-colors duration-200",
    image: "object-cover w-full h-full",
    imageWrapper: "w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden",
    header: "flex-1 py-3 pl-3",
    title: "font-medium text-gray-900 text-sm leading-tight",
    description: "text-xs text-gray-500 mt-0.5 line-clamp-2",
    price: "text-sm font-semibold mt-1",
    button: "rounded-full w-7 h-7 flex items-center justify-center shadow-sm flex-shrink-0",
    grid: "grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-2",
    sectionTitle: "text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100",
    categoryButton: "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
    headerBar: "bg-white border-b border-gray-100 sticky top-0 z-10",
  },
  "list-left": {
    layout: "horizontal",
    imagePosition: "left",
    card: "bg-white border-b border-gray-100 overflow-hidden",
    cardHover: "hover:bg-gray-50 transition-colors duration-200",
    image: "object-cover w-full h-full",
    imageWrapper: "w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden",
    header: "flex-1 py-3 pr-3",
    title: "font-medium text-gray-900 text-sm leading-tight",
    description: "text-xs text-gray-500 mt-0.5 line-clamp-2",
    price: "text-sm font-semibold mt-1",
    button: "rounded-full w-7 h-7 flex items-center justify-center shadow-sm flex-shrink-0",
    grid: "grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-2",
    sectionTitle: "text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100",
    categoryButton: "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
    headerBar: "bg-white border-b border-gray-100 sticky top-0 z-10",
  },
  "list-right-3col": {
    layout: "horizontal",
    imagePosition: "right",
    card: "bg-white border-b border-gray-100 overflow-hidden",
    cardHover: "hover:bg-gray-50 transition-colors duration-200",
    image: "object-cover w-full h-full",
    imageWrapper: "w-16 h-16 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden",
    header: "flex-1 py-2 pl-2",
    title: "font-medium text-gray-900 text-xs leading-tight",
    description: "text-xs text-gray-500 mt-0.5 line-clamp-1",
    price: "text-xs font-semibold mt-1",
    button: "rounded-full w-6 h-6 flex items-center justify-center shadow-sm flex-shrink-0",
    grid: "grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-3",
    sectionTitle: "text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100",
    categoryButton: "px-3 py-1 rounded-full text-xs font-medium transition-colors",
    headerBar: "bg-white border-b border-gray-100 sticky top-0 z-10",
  },
  "list-left-3col": {
    layout: "horizontal",
    imagePosition: "left",
    card: "bg-white border-b border-gray-100 overflow-hidden",
    cardHover: "hover:bg-gray-50 transition-colors duration-200",
    image: "object-cover w-full h-full",
    imageWrapper: "w-16 h-16 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden",
    header: "flex-1 py-2 pr-2",
    title: "font-medium text-gray-900 text-xs leading-tight",
    description: "text-xs text-gray-500 mt-0.5 line-clamp-1",
    price: "text-xs font-semibold mt-1",
    button: "rounded-full w-6 h-6 flex items-center justify-center shadow-sm flex-shrink-0",
    grid: "grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-3",
    sectionTitle: "text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100",
    categoryButton: "px-3 py-1 rounded-full text-xs font-medium transition-colors",
    headerBar: "bg-white border-b border-gray-100 sticky top-0 z-10",
  },
  "list-right-4col": {
    layout: "horizontal",
    imagePosition: "right",
    card: "bg-white border-b border-gray-100 overflow-hidden",
    cardHover: "hover:bg-gray-50 transition-colors duration-200",
    image: "object-cover w-full h-full",
    imageWrapper: "w-14 h-14 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden",
    header: "flex-1 py-2 pl-2",
    title: "font-medium text-gray-900 text-xs leading-tight",
    description: "text-xs text-gray-500 mt-0.5 line-clamp-1",
    price: "text-xs font-semibold mt-1",
    button: "rounded-full w-6 h-6 flex items-center justify-center shadow-sm flex-shrink-0",
    grid: "grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4",
    sectionTitle: "text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100",
    categoryButton: "px-3 py-1 rounded-full text-xs font-medium transition-colors",
    headerBar: "bg-white border-b border-gray-100 sticky top-0 z-10",
  },
  "list-left-4col": {
    layout: "horizontal",
    imagePosition: "left",
    card: "bg-white border-b border-gray-100 overflow-hidden",
    cardHover: "hover:bg-gray-50 transition-colors duration-200",
    image: "object-cover w-full h-full",
    imageWrapper: "w-14 h-14 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden",
    header: "flex-1 py-2 pr-2",
    title: "font-medium text-gray-900 text-xs leading-tight",
    description: "text-xs text-gray-500 mt-0.5 line-clamp-1",
    price: "text-xs font-semibold mt-1",
    button: "rounded-full w-6 h-6 flex items-center justify-center shadow-sm flex-shrink-0",
    grid: "grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4",
    sectionTitle: "text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100",
    categoryButton: "px-3 py-1 rounded-full text-xs font-medium transition-colors",
    headerBar: "bg-white border-b border-gray-100 sticky top-0 z-10",
  },
}

export function getCateringTemplateStyles(template: CateringDesignTemplate): CateringTemplateStyles {
  return cateringTemplateStyles[template] || cateringTemplateStyles.modern
}

interface CateringMenuItemCardProps {
  item: CateringMenuItem
  onAdd?: () => void
  onSelect?: () => void
  primaryColor?: string
  template?: CateringDesignTemplate
  defaultItemImageUrl?: string | null
  defaultItemImageAlt?: string
}

export function CateringMenuItemCard({
  item,
  onAdd,
  onSelect,
  primaryColor = "#000000",
  template = "modern",
  defaultItemImageUrl = null,
  defaultItemImageAlt = "",
}: CateringMenuItemCardProps) {
  const styles = getCateringTemplateStyles(template)
  const price = typeof item.price === "string" ? parseFloat(item.price) : item.price
  const hasSizes = item.sizes && item.sizes.length > 0
  const defaultSize = hasSizes
    ? item.sizes!.find((s) => s.catering_is_default) || item.sizes![0]
    : null
  const displayPrice = defaultSize
    ? (typeof defaultSize.catering_price === "string"
        ? parseFloat(defaultSize.catering_price)
        : defaultSize.catering_price)
    : price

  const unitLabel = getCateringUnitLabelCard(item.selling_unit, 1)
  const minQtyLabel = (item as any).min_quantity && (item as any).min_quantity > 1
    ? getCateringMinQtyLabel(item.selling_unit, (item as any).min_quantity)
    : null

  if (styles.layout === "horizontal") {
    const isImageRight = styles.imagePosition === "right"
    return (
      <div
        className={`flex items-center gap-2 px-3 cursor-pointer ${styles.card} ${styles.cardHover}`}
        onClick={() => (onAdd || onSelect)?.()}
      >
        {!isImageRight && (
          <div className={styles.imageWrapper}>
            {item.image_url ? (
              <Image src={item.image_url} alt={item.name} width={80} height={80} className={styles.image} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">🍽️</div>
            )}
          </div>
        )}
        <div className={`${styles.header} flex-1 min-w-0`}>
          <p className={styles.title}>{item.name}</p>
          {item.description && <p className={styles.description}>{item.description}</p>}
          <p className={styles.price} style={{ color: primaryColor }}>
            ${displayPrice.toFixed(2)}
            {unitLabel && <span className="font-normal text-gray-500 text-xs"> {unitLabel}</span>}
          </p>
          {(item as any).serves && (
            <p className="text-xs text-gray-400 mt-0.5">Sirve {(item as any).serves}</p>
          )}
          {minQtyLabel && (
            <p className="text-xs text-gray-400">Min: {minQtyLabel}</p>
          )}
        </div>
        {isImageRight && (
          <div className="relative">
            <div className={styles.imageWrapper}>
              {item.image_url ? (
                <Image src={item.image_url} alt={item.name} width={80} height={80} className={styles.image} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">🍽️</div>
              )}
            </div>
            <button
              className={styles.button}
              style={{ backgroundColor: primaryColor, color: "white", position: "absolute", bottom: -8, right: -8 }}
              onClick={(e) => { e.stopPropagation(); (onAdd || onSelect)?.() }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {!isImageRight && (
          <button
            className={styles.button}
            style={{ backgroundColor: primaryColor, color: "white" }}
            onClick={(e) => { e.stopPropagation(); (onAdd || onSelect)?.() }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className={`cursor-pointer ${template === "modern" ? "h-full" : ""} ${styles.card} ${styles.cardHover}`}
      onClick={() => (onAdd || onSelect)?.()}
    >
      <div className={styles.imageWrapper}>
        {template === "modern" ? (
          item.image_url ? (
            <Image src={item.image_url} alt={item.name} fill className={styles.image} />
          ) : defaultItemImageUrl ? (
            <Image
              src={defaultItemImageUrl}
              alt={defaultItemImageAlt}
              fill
              className={`${styles.image} opacity-40`}
            />
          ) : (
            <div className="w-full h-full bg-slate-100 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-10 h-10 text-slate-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2a5 5 0 00-5 5v6h3.5a1.5 1.5 0 011.5 1.5v.5M16 22v-4"
                />
              </svg>
            </div>
          )
        ) : item.image_url ? (
          <Image src={item.image_url} alt={item.name} fill className={styles.image} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🍽️</div>
        )}
      </div>
      <div className={styles.header}>
        <p className={styles.title}>{item.name}</p>
        {item.description && <p className={styles.description}>{item.description}</p>}
        <p className={styles.price} style={{ color: primaryColor }}>
          ${displayPrice.toFixed(2)}
          {unitLabel && <span className="font-normal text-gray-500 text-xs"> {unitLabel}</span>}
        </p>
        {(item as any).serves && (
          <p className="text-xs text-gray-400 mt-0.5">Sirve {(item as any).serves}</p>
        )}
        {minQtyLabel && (
          <p className="text-xs text-gray-400">Min: {minQtyLabel}</p>
        )}
        <div className="flex justify-end mt-2">
          <button
            className={styles.button}
            style={{ backgroundColor: primaryColor, color: "white" }}
            onClick={(e) => { e.stopPropagation(); (onAdd || onSelect)?.() }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface CateringServicePackageCardProps {
  pkg: CateringServicePackage
  onAdd?: () => void
  onSelect?: () => void
  primaryColor?: string
  template?: CateringDesignTemplate
}

export function CateringServicePackageCard({
  pkg,
  onAdd,
  onSelect,
  primaryColor = "#000000",
  template = "modern",
}: CateringServicePackageCardProps) {
  const styles = getCateringTemplateStyles(template)
  const price = typeof pkg.base_price === "string" ? parseFloat(pkg.base_price) : pkg.base_price

  return (
    <div
      className={`cursor-pointer ${styles.card} ${styles.cardHover}`}
      onClick={() => (onAdd || onSelect)?.()}
    >
      {pkg.image_url && (
        <div className="w-full h-40 relative bg-gray-100 overflow-hidden">
          <Image src={pkg.image_url} alt={pkg.name} fill className="object-cover" />
        </div>
      )}
      <div className={styles.header}>
        <p className={styles.title}>{pkg.name}</p>
        {pkg.description && <p className={styles.description}>{pkg.description}</p>}
        <p className={styles.price} style={{ color: primaryColor }}>
          Desde ${price.toFixed(2)}
        </p>
        <div className="flex justify-end mt-2">
          <button
            className={styles.button}
            style={{ backgroundColor: primaryColor, color: "white" }}
            onClick={(e) => { e.stopPropagation(); (onAdd || onSelect)?.() }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function CateringTemplatePreview({
  template,
  isSelected,
  onSelect,
}: {
  template: CateringDesignTemplate
  isSelected: boolean
  onSelect: () => void
}) {
  const info = CATERING_TEMPLATE_INFO[template]

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
        isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="text-xs font-medium text-gray-900 mb-1">{info.name}</div>
      <div className="text-xs text-gray-500">{info.description}</div>
      {isSelected && (
        <div className="mt-2 text-xs text-blue-600 font-medium">✓ Seleccionado</div>
      )}
    </div>
  )
}
