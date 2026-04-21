"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { MapPin, Navigation, Loader2, Search, X, Clock, Truck, Store, ChevronLeft, ChevronRight, ShoppingBag, User, Menu } from "lucide-react"
import type { CateringRestaurant } from "@/lib/catering"
import { PromotionalPopup } from "./promotional-popup"

// JunteReady brand colors
const JUNTE_ORANGE = "#F2901C"
const READY_NAVY = "#1E3A5F"

type OrderMode = "delivery" | "pickup"

interface UserLocation {
  address: string
  lat: number
  lng: number
  zip?: string
}

interface JunteReadyHomeProps {
  restaurants: CateringRestaurant[]
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

export function JunteReadyHome({ restaurants }: JunteReadyHomeProps) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [orderMode, setOrderMode] = useState<OrderMode>("delivery")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoadingGeo, setIsLoadingGeo] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // Hero slideshow state
  const [currentSlide, setCurrentSlide] = useState(0)
  const heroImages = [
    "/images/catering-hero-1.jpg",
    "/images/catering-hero-2.jpg",
    "/images/catering-hero-3.jpg",
  ]

  // Auto-advance slideshow
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [heroImages.length])

  // Load saved location from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("junteready_user_location")
    if (saved) {
      try {
        setUserLocation(JSON.parse(saved))
      } catch (e) {
        console.error("Error loading saved location:", e)
      }
    }
  }, [])

  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización")
      return
    }

    setIsLoadingGeo(true)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords

        try {
          const response = await fetch(`/api/places/reverse-geocode?lat=${latitude}&lng=${longitude}`)
          const data = await response.json()

          const newLocation: UserLocation = {
            address: data.address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            lat: latitude,
            lng: longitude,
            zip: data.zip || "",
          }
          
          setUserLocation(newLocation)
          localStorage.setItem("junteready_user_location", JSON.stringify(newLocation))
        } catch (error) {
          const newLocation: UserLocation = {
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            lat: latitude,
            lng: longitude,
          }
          setUserLocation(newLocation)
          localStorage.setItem("junteready_user_location", JSON.stringify(newLocation))
        }
        setIsLoadingGeo(false)
      },
      (error) => {
        console.error("Geolocation error:", error)
        alert("No pudimos obtener tu ubicación. Por favor intenta de nuevo.")
        setIsLoadingGeo(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Filter and sort restaurants
  const sortedRestaurants = useMemo(() => {
    let filtered = restaurants.filter((r) => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        r.name.toLowerCase().includes(q) ||
        r.cuisine_type?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      )
    })

    // Sort: if location available, sort by distance; otherwise alphabetically
    if (userLocation) {
      return [...filtered].sort((a, b) => {
        // Manual override would go here (check for display_order field)
        // For now, sort by distance
        const distA = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          18.4655, // Default PR coords - would use branch coords if available
          -66.1057
        )
        const distB = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          18.4655,
          -66.1057
        )
        // Since we don't have per-restaurant coords yet, fall back to alphabetical
        return a.name.localeCompare(b.name)
      })
    }

    // Default: alphabetical
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  }, [restaurants, searchQuery, userLocation])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Promotional Popup */}
      <PromotionalPopup placement="catering_marketplace" />
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200">
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center justify-between max-w-7xl mx-auto px-4 py-2">
          {/* Logo */}
          <Link href="/catering" className="flex-shrink-0">
            <Image
              src="/junteready-logo.jpg"
              alt="JunteReady"
              width={140}
              height={36}
              className="h-8 w-auto"
            />
          </Link>

          {/* Center: Mode Toggle + Location */}
          <div className="flex items-center gap-3">
            {/* Delivery/Pickup Toggle */}
            <div className="flex items-center rounded-full p-1" style={{ backgroundColor: `${READY_NAVY}10` }}>
              <button
                onClick={() => setOrderMode("delivery")}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{
                  backgroundColor: orderMode === "delivery" ? READY_NAVY : "transparent",
                  color: orderMode === "delivery" ? "white" : READY_NAVY,
                }}
              >
                <Truck className="w-4 h-4" />
                Entrega
              </button>
              <button
                onClick={() => setOrderMode("pickup")}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{
                  backgroundColor: orderMode === "pickup" ? READY_NAVY : "transparent",
                  color: orderMode === "pickup" ? "white" : READY_NAVY,
                }}
              >
                <Store className="w-4 h-4" />
                Recogido
              </button>
            </div>

            {/* Cerca de mí button */}
            <button
              onClick={handleUseMyLocation}
              disabled={isLoadingGeo}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors hover:bg-slate-100"
              style={{ color: READY_NAVY }}
            >
              {isLoadingGeo ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              {userLocation ? (
                <span className="max-w-[200px] truncate">{userLocation.address}</span>
              ) : (
                "Cerca de mí"
              )}
            </button>
          </div>

          {/* Right: Auth */}
          <div className="flex items-center gap-3">
            <Link
              href="/auth/customer/login"
              className="px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-100 rounded-lg"
              style={{ color: READY_NAVY }}
            >
              Cuenta
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 text-sm font-medium text-white rounded-full transition-colors"
              style={{ backgroundColor: JUNTE_ORANGE }}
            >
              Registrarse
            </Link>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <div className="flex items-center justify-between px-4 py-2">
            <Link href="/catering">
              <Image
                src="/junteready-logo.jpg"
                alt="JunteReady"
                width={120}
                height={32}
                className="h-7 w-auto"
              />
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={handleUseMyLocation}
                disabled={isLoadingGeo}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                style={{ color: READY_NAVY }}
              >
                {isLoadingGeo ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Mode Toggle */}
          <div className="px-4 pb-2">
            <div className="flex items-center rounded-full p-0.5" style={{ backgroundColor: `${READY_NAVY}10` }}>
              <button
                onClick={() => setOrderMode("delivery")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors"
                style={{
                  backgroundColor: orderMode === "delivery" ? READY_NAVY : "transparent",
                  color: orderMode === "delivery" ? "white" : READY_NAVY,
                }}
              >
                <Truck className="w-4 h-4" />
                Entrega
              </button>
              <button
                onClick={() => setOrderMode("pickup")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors"
                style={{
                  backgroundColor: orderMode === "pickup" ? READY_NAVY : "transparent",
                  color: orderMode === "pickup" ? "white" : READY_NAVY,
                }}
              >
                <Store className="w-4 h-4" />
                Recogido
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="border-t border-slate-200 px-4 py-3 space-y-2 bg-white">
              <Link
                href="/auth/customer/login"
                className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-slate-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                <User className="w-4 h-4" />
                Iniciar sesión
              </Link>
              <Link
                href="/auth/register"
                className="block px-3 py-2.5 text-sm font-medium text-center text-white rounded-lg"
                style={{ backgroundColor: JUNTE_ORANGE }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Crear cuenta
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section - Compact Slideshow */}
      <section className="relative h-40 md:h-52 overflow-hidden">
        {/* Slideshow Images */}
        {heroImages.map((img, index) => (
          <div
            key={img}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: currentSlide === index ? 1 : 0 }}
          >
            <Image
              src={img}
              alt=""
              fill
              className="object-cover"
              priority={index === 0}
            />
          </div>
        ))}

        {/* Navy Overlay */}
        <div className="absolute inset-0" style={{ backgroundColor: `${READY_NAVY}CC` }} />

        {/* Hero Content */}
        <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
            Catering para Tu Junte
          </h1>
          <p className="text-white/80 text-sm md:text-base max-w-xl">
            Desde bodas hasta eventos corporativos, encuentra el catering perfecto
          </p>
        </div>

        {/* Slide Indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {heroImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className="w-2 h-2 rounded-full transition-colors"
              style={{
                backgroundColor: currentSlide === index ? "white" : "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div>
      </section>

      {/* Search Bar */}
      <div className="sticky top-[49px] md:top-[52px] z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-slate-100 rounded-lg focus-within:ring-2 focus-within:ring-slate-300">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar restaurantes o cocina..."
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Restaurant Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        {sortedRestaurants.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {sortedRestaurants.map((restaurant) => (
              <CateringRestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              No se encontraron restaurantes
            </h2>
            <p className="text-slate-500 mb-4">
              {searchQuery
                ? `No hay resultados para "${searchQuery}"`
                : "No hay restaurantes de catering disponibles"}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image
                src="/junteready-logo.jpg"
                alt="JunteReady"
                width={120}
                height={32}
                className="h-8 w-auto"
              />
              <span className="text-sm text-slate-500">by PR Delivery</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link href="/catering/partners" className="hover:text-slate-700 font-medium" style={{ color: "#F2901C" }}>Para Restaurantes</Link>
              <Link href="/terms" className="hover:text-slate-700">Términos</Link>
              <Link href="/privacy" className="hover:text-slate-700">Privacidad</Link>
              <Link href="/connect" className="hover:text-slate-700">Acepta Pagos</Link>
              <Link href="/" className="hover:text-slate-700">PR Delivery</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function CateringRestaurantCard({ restaurant }: { restaurant: CateringRestaurant }) {
  const leadTimeHours = restaurant.default_lead_time_hours || 24
  // Always express in hours (24 horas, 48 horas, 72 horas)
  const leadTimeText = `${leadTimeHours} horas mín.`

  // Assume restaurant supports both unless specified
  const supportsDelivery = true
  const supportsPickup = true

  return (
    <Link
      href={`/catering/${restaurant.slug}`}
      className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-200"
    >
      {/* Image Section - More compact aspect ratio */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {restaurant.hero_image_url ? (
          <Image
            src={restaurant.hero_image_url}
            alt={restaurant.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : restaurant.logo_url ? (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
            <Image
              src={restaurant.logo_url}
              alt={restaurant.name}
              width={60}
              height={60}
              className="object-contain"
            />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
            <span className="text-lg font-bold text-white/90 uppercase tracking-wide">
              {restaurant.name}
            </span>
          </div>
        )}

        {/* Logo overlay in corner if hero image exists */}
        {restaurant.hero_image_url && restaurant.logo_url && (
          <div className="absolute bottom-2 left-2 w-8 h-8 rounded-md bg-white shadow-md overflow-hidden">
            <Image
              src={restaurant.logo_url}
              alt=""
              fill
              className="object-contain p-0.5"
            />
          </div>
        )}
      </div>

      {/* Content Section - More compact */}
      <div className="p-3">
        <h3 className="font-semibold text-slate-900 group-hover:text-slate-700 transition-colors line-clamp-1 text-sm">
          {restaurant.name}
        </h3>

{/* Cuisine types - show up to 2 joined by " - " */}
        {(restaurant.cuisine_types?.length || restaurant.cuisine_type) && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
            {restaurant.cuisine_types?.length 
              ? restaurant.cuisine_types.slice(0, 2).join(" - ")
              : restaurant.cuisine_type}
          </p>
        )}

        {/* Icons Row - show icons for available services */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
          {/* Delivery icon - orange car (show if restaurant offers delivery) */}
          {supportsDelivery && (
            <Image
              src="/icons/delivery-icon.png"
              alt="Delivery"
              width={28}
              height={28}
              title="Delivery"
            />
          )}
          
          {/* Pickup icon - blue bag (show if restaurant offers pickup) */}
          {supportsPickup && (
            <Image
              src="/icons/pickup-icon.png"
              alt="Pick-Up"
              width={28}
              height={28}
              title="Pick-Up"
            />
          )}

          {/* Lead time */}
          <div className="flex items-center gap-1 ml-auto text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            <span>Pre-orden: {leadTimeText}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
