"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import { MapPin, ChevronRight } from "lucide-react"
import dynamic from "next/dynamic"

const BranchMap = dynamic(() => import("@/components/branch-map"), { ssr: false })

interface Branch {
  id: string
  name: string
  slug?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  region?: string
  latitude?: number | null
  longitude?: number | null
  is_active: boolean
  display_order?: number
}

interface ServicePackage {
  id: string
  name: string
  description?: string
  min_guests?: number
  max_guests?: number
  price_per_person?: number
  image_url?: string | null
}

interface BranchSelectorProps {
  restaurantName: string
  logoUrl?: string
  bannerLogoUrl?: string
  heroImageUrl?: string
  hideTitle?: boolean
  primaryColor: string
  branches: Branch[]
  servicePackages?: ServicePackage[]
  whiteLabel?: boolean
  onSelect: (branch: Branch) => void
}

export function BranchSelector({
  restaurantName,
  logoUrl,
  bannerLogoUrl,
  heroImageUrl,
  hideTitle,
  primaryColor,
  branches,
  servicePackages,
  whiteLabel,
  onSelect,
}: BranchSelectorProps) {
  const activeBranches = branches.filter((b) => b.is_active !== false)

  // Extract unique regions for filter tabs
  const regions = useMemo(() => {
    const regionSet = new Set<string>()
    activeBranches.forEach((b) => {
      if (b.region) regionSet.add(b.region)
      else if (b.state) regionSet.add(b.state)
    })
    return Array.from(regionSet)
  }, [activeBranches])

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  // Filter branches by selected region
  const filteredBranches = useMemo(() => {
    if (!selectedRegion) return activeBranches
    return activeBranches.filter(
      (b) => b.region === selectedRegion || b.state === selectedRegion
    )
  }, [activeBranches, selectedRegion])

  // Count branches per region
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    activeBranches.forEach((b) => {
      const region = b.region || b.state
      if (region) {
        counts[region] = (counts[region] || 0) + 1
      }
    })
    return counts
  }, [activeBranches])

  const hasMapData = filteredBranches.some(
    (b) => b.latitude !== null && b.longitude !== null
  )

  const mapBranches = filteredBranches.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    city: b.city,
    state: b.state,
    latitude: b.latitude,
    longitude: b.longitude,
  }))

  // Determine which logo to show
  const displayLogo = whiteLabel && bannerLogoUrl ? bannerLogoUrl : logoUrl

  return (
    <div className="relative min-h-screen w-full flex flex-col">
      {/* Background Image */}
      {heroImageUrl ? (
        <div className="fixed inset-0 z-0">
          <Image src={heroImageUrl} alt="" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-black/50" />
        </div>
      ) : (
        <div className="fixed inset-0 bg-gradient-to-b from-gray-800 to-gray-900 z-0" />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full px-4 py-8 md:py-12">
        {/* Logo and Branding */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-4 mb-4">
            {displayLogo ? (
              <Image
                src={displayLogo}
                alt={restaurantName}
                width={320}
                height={100}
                className="max-h-24 w-auto object-contain"
              />
            ) : (
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                {restaurantName}
              </h1>
            )}
          </div>
          <div className="w-12 h-1 rounded-full mb-4" style={{ backgroundColor: primaryColor }} />
          {!hideTitle && (
            <p className="text-lg text-white/90 text-center italic">
              Selecciona tu Restaurante mas cercano
            </p>
          )}
        </div>

        {/* Region Filter Tabs */}
        {regions.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <button
              onClick={() => setSelectedRegion(null)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                selectedRegion === null
                  ? "text-white"
                  : "bg-white/20 text-white/80 hover:bg-white/30"
              }`}
              style={selectedRegion === null ? { backgroundColor: primaryColor } : {}}
            >
              Todas
            </button>
            {regions.map((region) => (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedRegion === region
                    ? "text-white"
                    : "bg-white/20 text-white/80 hover:bg-white/30"
                }`}
                style={selectedRegion === region ? { backgroundColor: primaryColor } : {}}
              >
                {region} ({regionCounts[region] || 0})
              </button>
            ))}
          </div>
        )}

        {/* Map Section */}
        {hasMapData && (
          <div className="w-full max-w-4xl h-56 md:h-72 rounded-xl overflow-hidden mb-6 shadow-xl">
            <BranchMap
              branches={mapBranches}
              primaryColor={primaryColor}
              onSelect={(branch) => {
                const fullBranch = activeBranches.find((b) => b.id === branch.id)
                if (fullBranch) onSelect(fullBranch)
              }}
            />
          </div>
        )}

        {/* Branch Cards Grid */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredBranches.map((branch) => {
            const addressParts = [branch.address, branch.city, branch.state].filter(Boolean)
            const fullAddress = addressParts.join(", ")
            
            return (
              <button
                key={branch.id}
                onClick={() => onSelect(branch)}
                className="group flex items-center gap-4 p-4 rounded-xl bg-black/40 backdrop-blur-sm text-left text-white transition-colors hover:bg-black/60"
              >
                <div
                  className="flex items-center justify-center w-11 h-11 rounded-full shrink-0"
                  style={{ backgroundColor: `${primaryColor}20`, borderColor: primaryColor, borderWidth: 2 }}
                >
                  <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base text-white">{branch.name}</h3>
                  {fullAddress && (
                    <p className="text-sm text-white/80 truncate">{fullAddress}</p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 shrink-0 text-white/70 transition-colors group-hover:text-white" />
              </button>
            )
          })}
        </div>

        {/* Service Packages Preview */}
        {servicePackages && servicePackages.length > 0 && (
          <div className="w-full max-w-4xl mt-10">
            <h2 className="text-xl font-semibold text-white mb-4 text-center">
              Paquetes de Servicio Disponibles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {servicePackages.slice(0, 3).map((pkg) => (
                <div
                  key={pkg.id}
                  className="rounded-xl bg-white/90 backdrop-blur-sm p-4 text-center"
                >
                  {pkg.image_url && (
                    <div className="w-full h-24 mb-3 rounded-lg overflow-hidden">
                      <Image
                        src={pkg.image_url}
                        alt={pkg.name}
                        width={200}
                        height={96}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <h3 className="font-medium text-gray-900">{pkg.name}</h3>
                  {pkg.price_per_person && (
                    <p className="text-sm text-gray-500 mt-1">
                      ${pkg.price_per_person.toFixed(2)} / persona
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
