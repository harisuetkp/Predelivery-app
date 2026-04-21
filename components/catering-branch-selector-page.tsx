"use client"

import { useRouter } from "next/navigation"
import { useCallback, useState, useMemo } from "react"
import Image from "next/image"
import { ChevronRight, MapPin } from "lucide-react"
import dynamic from "next/dynamic"
import type { CateringRestaurant, CateringBranch } from "@/lib/catering"

const BranchMap = dynamic(
  () => import("@/components/branch-map").then((mod) => mod.BranchMap),
  { ssr: false }
)

interface CateringBranchSelectorPageProps {
  restaurant: CateringRestaurant
  branches: CateringBranch[]
  slug: string
}

export default function CateringBranchSelectorPage({
  restaurant,
  branches,
  slug,
}: CateringBranchSelectorPageProps) {
  if (branches.length === 0) {
    throw new Error(`Chain restaurant ${restaurant.name} has no active branches`)
  }

  const router = useRouter()
  const [selectedRegion, setSelectedRegion] = useState<string>("all")

  const handleBranchSelect = useCallback(
    (branch: { id: string }) => {
      router.push(`/catering/${slug}?branch=${branch.id}`)
    },
    [router, slug]
  )

  const primaryColor = restaurant.primary_color ?? "#3b82f6"

  // Get unique regions from branches
  const regions = useMemo(() => {
    const regionSet = new Set<string>()
    branches.forEach((b) => {
      if (b.state) regionSet.add(b.state)
    })
    return Array.from(regionSet).sort()
  }, [branches])

  // Filter branches by selected region
  const filteredBranches = useMemo(() => {
    if (selectedRegion === "all") return branches
    return branches.filter((b) => b.state === selectedRegion)
  }, [branches, selectedRegion])

  const mapBranches = filteredBranches.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    city: b.city,
    state: b.state,
    latitude: b.latitude,
    longitude: b.longitude,
  }))

  const hasMapData = filteredBranches.some(
    (b) => b.latitude !== null && b.longitude !== null
  )

  // Debug: log branch data to check if lat/lng exists
  console.log("[v0] Branches for map:", filteredBranches.map(b => ({ name: b.name, lat: b.latitude, lng: b.longitude })))
  console.log("[v0] hasMapData:", hasMapData)

  return (
    <main
      id="main-content"
      className="min-h-screen relative"
      style={{ backgroundColor: primaryColor }}
    >
      {/* Full-bleed hero background */}
      {restaurant.hero_image_url && (
        <div className="absolute inset-0">
          <Image
            src={restaurant.hero_image_url}
            alt=""
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      {/* Content overlay */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header with logo */}
        <div className="container mx-auto px-4 py-8 text-center">
          {restaurant.logo_url && (
            <div className="inline-block mb-4">
              <Image
                src={restaurant.logo_url}
                alt={restaurant.name}
                width={280}
                height={100}
                className="h-20 md:h-24 w-auto object-contain"
              />
            </div>
          )}
          {!restaurant.logo_url && (
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {restaurant.name}
            </h1>
          )}
          <div
            className="w-12 h-1 mx-auto mb-4 rounded"
            style={{ backgroundColor: primaryColor }}
          />
          <p className="text-white/90 italic text-lg">
            Selecciona tu Restaurante mas cercano
          </p>
        </div>

        {/* Region filter tabs */}
        {regions.length > 1 && (
          <div className="flex justify-center gap-2 mb-6 px-4 flex-wrap">
            <button
              onClick={() => setSelectedRegion("all")}
              className="px-5 py-2 rounded-full text-sm font-medium transition-colors text-white"
              style={{
                backgroundColor: selectedRegion === "all" ? primaryColor : "rgba(255,255,255,0.2)",
              }}
            >
              Todas
            </button>
            {regions.map((region) => {
              const count = branches.filter((b) => b.state === region).length
              return (
                <button
                  key={region}
                  onClick={() => setSelectedRegion(region)}
                  className="px-5 py-2 rounded-full text-sm font-medium transition-colors text-white"
                  style={{
                    backgroundColor: selectedRegion === region ? primaryColor : "rgba(255,255,255,0.2)",
                  }}
                >
                  {region} ({count})
                </button>
              )
            })}
          </div>
        )}

        {/* Map section */}
        <div className="container mx-auto px-4 mb-6">
          {hasMapData ? (
            <div className="rounded-xl overflow-hidden shadow-xl h-64 md:h-80">
              <BranchMap
                branches={mapBranches}
                primaryColor={primaryColor}
                onSelect={handleBranchSelect}
              />
            </div>
          ) : (
            <div className="rounded-xl h-64 md:h-80 flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
              <p className="text-white/60 text-sm">Mapa no disponible - coordenadas pendientes</p>
            </div>
          )}
        </div>

        {/* Branch cards grid */}
        <div className="container mx-auto px-4 pb-12 flex-1">
          <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
            {filteredBranches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => handleBranchSelect(branch)}
                className="group text-left rounded-xl p-5 flex items-center gap-4 bg-white/20 backdrop-blur-sm text-white transition-colors hover:bg-white/30"
              >
                {/* Location icon */}
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-white" />
                </div>

                {/* Branch info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold leading-snug text-white">
                    {branch.name}
                  </h3>
                  <p className="text-sm text-white/80 truncate">
                    {branch.address}, {branch.city}, {branch.state}
                  </p>
                </div>

                {/* Chevron */}
                <ChevronRight className="w-5 h-5 flex-shrink-0 text-white/70 transition-colors group-hover:text-white" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
