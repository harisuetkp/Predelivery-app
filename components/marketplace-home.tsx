"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import Image from "next/image"
import { useState, useMemo, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, ArrowRight, Search, X, RotateCcw, Coffee } from "lucide-react"
import { InternalShopModal } from "./internal-shop-modal"
import { type UserLocation, type OrderMode } from "./location-bar"
import { CuisineBar } from "./cuisine-bar"
import { GlobalNavbar } from "./global-navbar"
import { PromotionalPopup } from "./promotional-popup"

type Restaurant = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  marketplace_image_url: string | null
  primary_color: string | null
  city: string | null
  state: string | null
  cuisine_type: string | null
  cuisine_types: string[] | null
  latitude?: string | null
  longitude?: string | null
  delivery_radius_miles?: number | null
  delivery_zip_codes?: string[] | null
  delivery_enabled?: boolean
  isOpen?: boolean
  nextOpenTime?: string | null
}

type RestaurantWithDistance = Restaurant & {
  calculatedDistance: number | null
  inDeliveryZone: boolean
  isOpen?: boolean
  nextOpenTime?: string | null
}

type MarketplaceSettings = {
  id: string
  hero_image_url: string | null
  hero_title: string
  hero_subtitle: string
}

type CuisineType = {
  id: string
  name: string
  icon_url: string | null
  display_order: number
}

type PromoVariant = "none" | "a" | "b" | "c" | "d" | "e"

type PromoVariants = {
  web: PromoVariant
  mobile: PromoVariant
  dImageUrl: string | null
  dHref: string | null
  eImage1Url: string | null
  eImage1Href: string | null
  eImage2Url: string | null
  eImage2Href: string | null
}

interface MarketplaceHomeProps {
  restaurants: Restaurant[]
  marketplaceSettings?: MarketplaceSettings
  promoVariants?: PromoVariants
  cuisineTypes: CuisineType[]
  blockedZipCodes?: string[]
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

const DEFAULT_PROMO_VARIANTS: PromoVariants = {
  web: "a",
  mobile: "a",
  dImageUrl: null,
  dHref: null,
  eImage1Url: null,
  eImage1Href: null,
  eImage2Url: null,
  eImage2Href: null,
}

export function MarketplaceHome({
  restaurants,
  marketplaceSettings,
  promoVariants = DEFAULT_PROMO_VARIANTS,
  cuisineTypes,
  blockedZipCodes = [],
}: MarketplaceHomeProps) {
  const heroImage = marketplaceSettings?.hero_image_url || "/images/partners-hero.jpg"
  const heroTitle = marketplaceSettings?.hero_title || "De Todo para Tu Junte"
  const heroSubtitle = marketplaceSettings?.hero_subtitle || "Monta el Party con nuestras deliciosas opciones..."

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [orderMode, setOrderMode] = useState<OrderMode>("delivery")
  const [cuisineFilter, setCuisineFilter] = useState<string>("all")
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")

  const AREAS = [
    "Hato Rey", "Condado", "Miramar", "Isla Verde", "Puerto Nuevo",
    "Rio Piedras", "Santurce", "Guaynabo Pueblo", "San Patricio", "Señorial",
  ]

  // Compute distance + delivery zone for every restaurant, then filter/sort
  const restaurantsWithDistance = useMemo((): RestaurantWithDistance[] => {
    return restaurants.map((restaurant) => {
      if (!userLocation || !restaurant.latitude || !restaurant.longitude) {
        return { ...restaurant, calculatedDistance: null, inDeliveryZone: true }
      }

      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        parseFloat(restaurant.latitude),
        parseFloat(restaurant.longitude)
      )

      // Check delivery zip code match if available
      let inDeliveryZone: boolean
      if (restaurant.delivery_zip_codes && restaurant.delivery_zip_codes.length > 0 && userLocation.zip) {
        inDeliveryZone = restaurant.delivery_zip_codes.includes(userLocation.zip)
      } else {
        const deliveryRadius = restaurant.delivery_radius_miles ?? 10
        inDeliveryZone = distance <= deliveryRadius
      }

      return { ...restaurant, calculatedDistance: distance, inDeliveryZone }
    })
  }, [restaurants, userLocation])

  const filteredRestaurants = useMemo((): RestaurantWithDistance[] => {
    const filtered = restaurantsWithDistance.filter((restaurant) => {
      // Search filter - match name or cuisine
      const query = searchQuery.toLowerCase().trim()
      const cuisineList = restaurant.cuisine_types?.length
        ? restaurant.cuisine_types
        : restaurant.cuisine_type ? [restaurant.cuisine_type] : []
      
      const matchesSearch = query === "" || 
        restaurant.name.toLowerCase().includes(query) ||
        cuisineList.some((c) => c.toLowerCase().includes(query))
      
      const matchesCuisine =
        cuisineFilter === "all" ||
        cuisineList.some((c) => c.toLowerCase() === cuisineFilter.toLowerCase())
      const matchesLocation = locationFilter === "all" || (restaurant as any).area === locationFilter
      // Only show restaurants that are in the delivery zone
      const isInZone = restaurant.inDeliveryZone !== false
      return matchesSearch && matchesCuisine && matchesLocation && isInZone
    })

    // Sort: open restaurants first (by distance), then closed/pre-order restaurants (alphabetically)
    return [...filtered].sort((a, b) => {
      const aIsOpen = a.isOpen !== false
      const bIsOpen = b.isOpen !== false
      
      // Open restaurants come first
      if (aIsOpen && !bIsOpen) return -1
      if (!aIsOpen && bIsOpen) return 1
      
      // Among open restaurants, sort by distance
      if (aIsOpen && bIsOpen) {
        const dA = a.calculatedDistance ?? Infinity
        const dB = b.calculatedDistance ?? Infinity
        return dA - dB
      }
      
      // Among closed restaurants, sort alphabetically
      return a.name.localeCompare(b.name)
    })
  }, [restaurantsWithDistance, cuisineFilter, locationFilter, searchQuery])

  return (
    <div className="flex flex-col min-h-screen bg-white font-sans" role="main" id="main-content" aria-label="Directorio de restaurantes FoodNetPR">
      {/* Promotional Popup */}
      <PromotionalPopup placement="delivery_marketplace" />
      
      {/* Global Navigation with spacer bar */}
      <GlobalNavbar 
        showLocationBar={true}
        onLocationChange={setUserLocation}
        onModeChange={setOrderMode}
      />

      {/* Cuisine Type Icons Bar */}
      <CuisineBar
        selectedCuisine={cuisineFilter}
        onCuisineChange={setCuisineFilter}
        cuisineTypes={cuisineTypes}
        restaurantCuisines={restaurants.flatMap(r =>
          r.cuisine_types?.length ? r.cuisine_types : (r.cuisine_type ? [r.cuisine_type] : [])
        )}
      />

      {/* No location banner - shows above Ofertas when no address entered */}
      {!userLocation && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5">
          <div className="mx-auto max-w-7xl flex items-center gap-2 text-sm text-amber-800">
            <svg className="w-4 h-4 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Ingresa tu dirección para ver qué restaurantes entregan en tu zona.</span>
          </div>
        </div>
      )}

      {/* Ofertas y Promociones section */}
      <PromoBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        resultCount={filteredRestaurants.length}
        cuisineFilter={cuisineFilter}
        promoVariants={promoVariants}
        onResetFilters={() => {
          setCuisineFilter("all")
          setLocationFilter("all")
          setSearchQuery("")
        }}
      />

      {/* Blocked zip code banner */}
      {userLocation?.zip && blockedZipCodes.includes(userLocation.zip) && (
        <div className="bg-red-600 text-white px-4 py-3">
          <div className="mx-auto max-w-7xl flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              <p className="font-semibold text-sm">Zona temporalmente no disponible</p>
              <p className="text-sm text-red-100 mt-0.5">
                El código postal <span className="font-mono font-bold">{userLocation.zip}</span> está temporalmente bloqueado para entregas debido a un evento o cierre de vías. Por favor intenta más tarde.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Divider between Ofertas and Restaurant Grid */}
      <div className="px-4 mx-auto max-w-7xl">
        <div className="h-[2px] bg-slate-200 rounded-full" />
      </div>

      {/* Restaurant Grid */}
      {restaurants.length > 0 && (
        <section id="restaurantes" className="pt-3 sm:pt-4 pb-12 sm:pb-16">
          <div className="px-4 mx-auto max-w-7xl">
            <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredRestaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  distance={restaurant.calculatedDistance}
                  inDeliveryZone={restaurant.inDeliveryZone}
                  hasLocation={!!userLocation}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {filteredRestaurants.length === 0 && restaurants.length > 0 && (
        <div className="px-4 py-12 sm:py-20 text-center">
          <Card className="p-6 sm:p-12 max-w-2xl mx-auto border-slate-200">
            <h3 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-900">
              {searchQuery ? "No encontramos restaurantes" : "No Se Encontraron Restaurantes"}
            </h3>
            <p className="text-sm sm:text-base text-slate-600 mb-4 sm:mb-6">
              {searchQuery 
                ? `No encontramos restaurantes con "${searchQuery}". Intenta con otra busqueda.`
                : "No hay restaurantes que coincidan con los filtros seleccionados."
              }
            </p>
            <Button
              onClick={() => {
                setSearchQuery("")
                setCuisineFilter("all")
                setLocationFilter("all")
              }}
              variant="outline"
              className="border-slate-300"
            >
              {searchQuery ? "Limpiar Busqueda" : "Limpiar Filtros"}
            </Button>
          </Card>
        </div>
      )}

      {filteredRestaurants.length === 0 && restaurants.length === 0 && (
        <div className="px-4 py-12 sm:py-20 text-center">
          <Card className="p-6 sm:p-12 max-w-2xl mx-auto border-slate-200">
            <h3 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-900">No Hay Restaurantes Disponibles</h3>
            <p className="text-sm sm:text-base text-slate-600">Vuelva pronto mientras los restaurantes se unen a nuestro mercado.</p>
          </Card>
        </div>
      )}

      <MarketplaceFooter />
    </div>
  )
}

interface PromoCardData {
  id: string
  title: string | null
  subtitle: string | null
  badge_text: string | null
  badge_color: string
  image_url: string | null
  href: string | null
  display_order: number
  is_active: boolean
}

function PromoBar({
  searchQuery,
  onSearchChange,
  resultCount,
  cuisineFilter,
  promoVariants,
  onResetFilters,
}: {
  searchQuery: string
  onSearchChange: (query: string) => void
  resultCount: number
  cuisineFilter: string
  promoVariants: PromoVariants
  onResetFilters: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)
  const [promos, setPromos] = useState<PromoCardData[]>([])
  const [isShopAvailable, setIsShopAvailable] = useState(false)
  const [showShopModal, setShowShopModal] = useState(false)

  useEffect(() => {
    fetch("/api/super-admin/promo-cards")
      .then((r) => r.json())
      .then((data: PromoCardData[]) =>
        setPromos(data.filter((c) => c.is_active))
      )
      .catch(() => {})
    
    // Check if internal shop is available
    fetch("/api/internal-shop/availability")
      .then((r) => r.json())
      .then((data) => setIsShopAvailable(data.available))
      .catch(() => setIsShopAvailable(false))
  }, [])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setShowLeftArrow(scrollLeft > 10)
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
  }

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return
    const scrollAmount = 320
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    })
  }

  return (
    <section className="relative bg-white py-4 sm:py-6">
      <div className="px-4 mx-auto max-w-7xl">
        {/* Section header - hide title per-breakpoint when that variant is "none" */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          {cuisineFilter === "all" && promoVariants.web !== "none" && (
            <h2 className="hidden md:block text-base sm:text-lg font-bold text-slate-900">Ofertas y Promociones</h2>
          )}
          {cuisineFilter === "all" && promoVariants.mobile !== "none" && (
            <h2 className="md:hidden text-base sm:text-lg font-bold text-slate-900">Ofertas y Promociones</h2>
          )}
          {/* Restaurant search and filter controls */}
          <div className={`flex items-center gap-2 ml-auto ${cuisineFilter !== "all" ? "w-full justify-between" : ""}`}>
            {/* Bebidas y Extras button - only show when shop is open */}
            {isShopAvailable && (
              <button
                onClick={() => setShowShopModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-full transition-colors shadow-sm"
              >
                <Coffee className="w-4 h-4" />
                <span className="hidden sm:inline">Bebidas y Extras</span>
              </button>
            )}
            {/* Ver Todos button - shows when filters are active */}
            {(cuisineFilter !== "all" || searchQuery) && (
              <button
                onClick={onResetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ver Todos</span>
              </button>
            )}
            {/* Search input */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200 transition-colors min-w-[200px] sm:min-w-[280px]">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Busqueda de Restaurantes"
                className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 bg-transparent border-none outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange("")}
                  className="p-0.5 hover:bg-slate-100 rounded-full transition-colors"
                  aria-label="Limpiar busqueda"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* Promo tiles - hide when cuisine filter is active. Independent variant per breakpoint. */}
        {cuisineFilter === "all" && (
          <>
            <div className="hidden md:block">
              <PromoTiles variant={promoVariants.web} promos={promos} promoVariants={promoVariants} />
            </div>
            <div className="md:hidden">
              <PromoTiles variant={promoVariants.mobile} promos={promos} promoVariants={promoVariants} />
            </div>
          </>
        )}
      </div>

      {/* Internal Shop Modal */}
      <InternalShopModal
        isOpen={showShopModal}
        onClose={() => setShowShopModal(false)}
      />
    </section>
  )
}

function PromoTileCard({ promo }: { promo: PromoCardData }) {
  return (
    <Link href={promo.href ?? "#"} className="group block">
      <div className="relative aspect-[5/2] rounded-lg overflow-hidden bg-slate-100">
        {promo.image_url && (
          <Image
            src={promo.image_url}
            alt={promo.title || "Promo"}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
        {(promo.title || promo.subtitle || promo.badge_text) && (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {promo.badge_text && (
              <div className={`absolute top-2 left-2 ${promo.badge_color} text-white text-[10px] font-bold px-2 py-0.5 rounded`}>
                {promo.badge_text}
              </div>
            )}
            {(promo.title || promo.subtitle) && (
              <div className="absolute bottom-2 left-2 right-2">
                {promo.title && (
                  <h3 className="font-semibold text-sm text-white leading-tight">
                    {promo.title}
                  </h3>
                )}
                {promo.subtitle && <p className="text-[10px] text-white/80">{promo.subtitle}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </Link>
  )
}

function PromoTiles({
  variant,
  promos,
  promoVariants,
}: {
  variant: PromoVariant
  promos: PromoCardData[]
  promoVariants: PromoVariants
}) {
  const [carouselIdx, setCarouselIdx] = useState(0)

  // Auto-rotate carousel for variant B
  useEffect(() => {
    if (variant !== "b" || promos.length <= 1) return
    const timer = setInterval(() => {
      setCarouselIdx((i) => (i + 1) % Math.min(promos.length, 5))
    }, 5000)
    return () => clearInterval(timer)
  }, [variant, promos.length])

  if (variant === "none") return null

  // A: current 4-card grid
  if (variant === "a") {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {promos.slice(0, 4).map((promo) => (
          <PromoTileCard key={promo.id} promo={promo} />
        ))}
      </div>
    )
  }

  // B: large hero carousel (auto-rotates through promos)
  if (variant === "b") {
    const pool = promos.slice(0, 5)
    if (pool.length === 0) return null
    const current = pool[carouselIdx % pool.length]
    return (
      <div className="relative">
        <Link href={current.href ?? "#"} className="group block">
          <div className="relative aspect-[16/5] sm:aspect-[21/6] rounded-xl overflow-hidden bg-slate-100">
            {current.image_url && (
              <Image
                src={current.image_url}
                alt={current.title || "Promo"}
                fill
                priority
                className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
              />
            )}
            {(current.title || current.subtitle || current.badge_text) && (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                {current.badge_text && (
                  <div className={`absolute top-3 left-3 ${current.badge_color} text-white text-xs font-bold px-2.5 py-1 rounded`}>
                    {current.badge_text}
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6">
                  {current.title && (
                    <h3 className="font-bold text-lg sm:text-2xl text-white leading-tight drop-shadow">
                      {current.title}
                    </h3>
                  )}
                  {current.subtitle && (
                    <p className="text-sm text-white/90 mt-1">{current.subtitle}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </Link>
        {pool.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-2">
            {pool.map((_, i) => (
              <button
                key={i}
                onClick={() => setCarouselIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === carouselIdx % pool.length ? "w-6 bg-slate-700" : "w-1.5 bg-slate-300"
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // C: scrollable chip ribbon
  if (variant === "c") {
    if (promos.length === 0) return null
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {promos.map((promo) => (
          <Link
            key={promo.id}
            href={promo.href ?? "#"}
            className="group flex-shrink-0 w-64 sm:w-72"
          >
            <div className="relative aspect-[5/2] rounded-lg overflow-hidden bg-slate-100">
              {promo.image_url && (
                <Image
                  src={promo.image_url}
                  alt={promo.title || "Promo"}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              )}
              {(promo.title || promo.subtitle || promo.badge_text) && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  {promo.badge_text && (
                    <div className={`absolute top-2 left-2 ${promo.badge_color} text-white text-[10px] font-bold px-2 py-0.5 rounded`}>
                      {promo.badge_text}
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 right-2">
                    {promo.title && (
                      <h3 className="font-semibold text-sm text-white leading-tight">
                        {promo.title}
                      </h3>
                    )}
                    {promo.subtitle && <p className="text-[10px] text-white/80">{promo.subtitle}</p>}
                  </div>
                </>
              )}
            </div>
          </Link>
        ))}
      </div>
    )
  }

  // D: single uploaded banner
  if (variant === "d") {
    if (!promoVariants.dImageUrl) {
      return (
        <div className="aspect-[16/4] rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
          Sube un banner en Super Admin → Diseño del Marketplace
        </div>
      )
    }
    const content = (
      <div className="relative aspect-[16/4] rounded-xl overflow-hidden bg-slate-100">
        <Image
          src={promoVariants.dImageUrl}
          alt="Banner"
          fill
          priority
          className="object-cover"
        />
      </div>
    )
    return promoVariants.dHref ? (
      <Link href={promoVariants.dHref} className="block group hover:opacity-95 transition-opacity">
        {content}
      </Link>
    ) : (
      content
    )
  }

  // E: two banners side-by-side
  if (variant === "e") {
    const slot1 = promoVariants.eImage1Url ? (
      promoVariants.eImage1Href ? (
        <Link href={promoVariants.eImage1Href} className="block group hover:opacity-95 transition-opacity">
          <div className="relative aspect-[5/2] rounded-xl overflow-hidden bg-slate-100">
            <Image src={promoVariants.eImage1Url} alt="Banner 1" fill className="object-cover" />
          </div>
        </Link>
      ) : (
        <div className="relative aspect-[5/2] rounded-xl overflow-hidden bg-slate-100">
          <Image src={promoVariants.eImage1Url} alt="Banner 1" fill className="object-cover" />
        </div>
      )
    ) : (
      <div className="aspect-[5/2] rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
        Banner 1
      </div>
    )

    const slot2 = promoVariants.eImage2Url ? (
      promoVariants.eImage2Href ? (
        <Link href={promoVariants.eImage2Href} className="block group hover:opacity-95 transition-opacity">
          <div className="relative aspect-[5/2] rounded-xl overflow-hidden bg-slate-100">
            <Image src={promoVariants.eImage2Url} alt="Banner 2" fill className="object-cover" />
          </div>
        </Link>
      ) : (
        <div className="relative aspect-[5/2] rounded-xl overflow-hidden bg-slate-100">
          <Image src={promoVariants.eImage2Url} alt="Banner 2" fill className="object-cover" />
        </div>
      )
    ) : (
      <div className="aspect-[5/2] rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
        Banner 2
      </div>
    )

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {slot1}
        {slot2}
      </div>
    )
  }

  return null
}

function RestaurantCard({
  restaurant,
  distance,
  inDeliveryZone,
  hasLocation,
}: {
  restaurant: Restaurant
  distance: number | null
  inDeliveryZone: boolean
  hasLocation: boolean
}) {
  // Show only the main cuisine type on the tile (for cleaner display)
  // Falls back to first cuisine_type or cuisine_type field
  const cuisineLabel = restaurant.main_cuisine_type 
    || (restaurant.cuisine_types?.length ? restaurant.cuisine_types[0] : null)
    || restaurant.cuisine_type 
    || "Catering"
  const featuredImage = restaurant.marketplace_image_url
  const logoImage = restaurant.logo_url
  const unavailable = hasLocation && !inDeliveryZone
  const isOpen = restaurant.isOpen !== false // Default to open if not specified
  const nextOpenTime = restaurant.nextOpenTime
  const canPreOrder = !isOpen && inDeliveryZone && nextOpenTime

  const distanceLabel =
    distance !== null
      ? distance < 0.1
        ? "Menos de 0.1 mi"
        : `${distance.toFixed(1)} mi`
      : null

  // Build accessible description for screen readers
  const accessibleDescription = `${restaurant.name}, ${cuisineLabel}${distanceLabel ? `, a ${distanceLabel}` : ''}${canPreOrder ? ', disponible para pre-ordenar' : ''}${unavailable ? ', no disponible actualmente' : ''}`

  return (
    <Link
      href={unavailable ? "#" : `/${restaurant.slug}${canPreOrder ? "?preorder=true" : ""}`}
      className="block h-full"
      onClick={unavailable ? (e) => e.preventDefault() : undefined}
      aria-disabled={unavailable}
      aria-label={accessibleDescription}
    >
      <div
        className={`group overflow-hidden rounded-xl sm:rounded-2xl border bg-white transition-all duration-300 h-full flex flex-col ${
          unavailable
            ? "border-slate-100 opacity-50 cursor-not-allowed grayscale"
            : canPreOrder
            ? "border-slate-200 hover:border-pink-200 hover:shadow-lg hover:shadow-pink-600/5"
            : "border-slate-200 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-600/5"
        }`}
      >
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          {/* Featured/Background Image */}
          {featuredImage ? (
            <Image
              src={featuredImage}
              alt={`Imagen del restaurante ${restaurant.name}`}
              fill
              className={`object-cover ${canPreOrder ? "brightness-75" : ""} ${!unavailable && !canPreOrder ? "group-hover:scale-105 transition-transform duration-500" : ""}`}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 ${canPreOrder ? "brightness-75" : ""}`}>
              <span className="text-2xl sm:text-4xl font-bold text-slate-300">{restaurant.name.charAt(0)}</span>
            </div>
          )}

          {/* Pre-Ordenar badge - top right corner */}
          {canPreOrder && (
            <div className="absolute top-2 right-2 z-10 rounded-full bg-pink-500 px-2.5 py-0.5 text-[8px] sm:text-[10px] font-bold text-white shadow-sm">
              Pre-Ordenar
            </div>
          )}

          {/* Distance badge */}
          {distanceLabel && !canPreOrder && (
            <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              {distanceLabel}
            </div>
          )}

          {/* Pre-order delivery time overlay */}
          {canPreOrder && nextOpenTime && (() => {
            // Check if nextOpenTime starts with "Hoy" (opens later today)
            if (nextOpenTime.startsWith('Hoy ')) {
              const time = nextOpenTime.replace('Hoy ', '')
              return (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur-sm text-center">
                    <p className="text-sm sm:text-lg font-bold">Disponible hoy</p>
                    <p className="text-[10px] sm:text-xs opacity-80">desde las {time}</p>
                  </div>
                </div>
              )
            }
            
            // Check if nextOpenTime contains a day name (e.g., "Miércoles 11:00AM")
            const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
            const hasDay = dayNames.some(day => nextOpenTime.startsWith(day))
            
            if (hasDay) {
              // Format: "DayName Time" - show "Disponible [Day]" and "a las [Time]"
              const parts = nextOpenTime.split(' ')
              const dayName = parts[0]
              const time = parts.slice(1).join(' ')
              return (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur-sm text-center">
                    <p className="text-sm sm:text-lg font-bold">Disponible {dayName}</p>
                    <p className="text-[10px] sm:text-xs opacity-80">a las {time}</p>
                  </div>
                </div>
              )
            } else {
              // Just time - show "Disponible mañana"
              return (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur-sm text-center">
                    <p className="text-sm sm:text-lg font-bold">Disponible mañana</p>
                    <p className="text-[10px] sm:text-xs opacity-80">a las {nextOpenTime}</p>
                  </div>
                </div>
              )
            }
          })()}

          {/* Out-of-zone overlay label */}
          {unavailable && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-black/50 text-white text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-full backdrop-blur-sm">
                Fuera de zona
              </span>
            </div>
          )}

          {/* Logo Overlay - bottom left corner */}
          {logoImage ? (
            <div className="absolute bottom-2 left-2 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white shadow-md overflow-hidden border border-slate-200">
              <Image
                src={logoImage}
                alt={`${restaurant.name} logo`}
                fill
                className="object-contain p-1"
              />
            </div>
          ) : featuredImage ? (
            <div className="absolute bottom-2 left-2 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white shadow-md flex items-center justify-center border border-slate-200">
              <span className="text-sm sm:text-lg font-bold text-slate-400">{restaurant.name.charAt(0)}</span>
            </div>
          ) : null}
        </div>

        <div className="p-2.5 sm:p-4 bg-white flex-1 flex flex-col justify-center">
          <h3 className="font-semibold text-xs sm:text-sm text-slate-900 leading-tight line-clamp-2">
            {restaurant.name}
          </h3>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 uppercase tracking-wide truncate">{cuisineLabel}</p>
        </div>
      </div>
    </Link>
  )
}

function MarketplaceFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-6 sm:py-8 mt-auto">
      <div className="px-4 flex flex-col items-center justify-between gap-3 sm:gap-4 sm:flex-row">
        <Image
          src="/foodnetpr-logo.png"
          alt="FoodNetPR"
          width={120}
          height={36}
          className="h-6 sm:h-7 w-auto"
        />
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 text-[10px] sm:text-xs text-slate-500 text-center">
          <Link href="/partners" className="hover:text-slate-900 transition-colors">
            Para Restaurantes
          </Link>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <Link href="/privacy" className="hover:text-slate-900 transition-colors">
            Privacidad
          </Link>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <Link href="/terms" className="hover:text-slate-900 transition-colors">
            Términos de Servicio
          </Link>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <Link href="/connect" className="hover:text-slate-900 transition-colors">
            Acepta Pagos
          </Link>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <Link href="/setup" className="hover:text-slate-900 transition-colors">
            Setup
          </Link>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span suppressHydrationWarning>
            &copy; {new Date().getFullYear()} FoodNetDelivery
          </span>
        </div>
      </div>
    </footer>
  )
}
