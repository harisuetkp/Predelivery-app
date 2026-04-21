"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { MapPin, Navigation, Loader2, Keyboard, Map, ChevronDown, X, Pencil, Plus, Check } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

// Saved address type from database
interface SavedAddress {
  id: string
  label: string
  address_line_1: string
  address_line_2: string | null
  city: string
  state: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  delivery_instructions: string | null
  is_default: boolean
}

const LOCATION_STORAGE_KEY = "foodnetpr_user_location"
const MODE_STORAGE_KEY = "foodnetpr_order_mode"

// Default Puerto Rico zip codes (fallback)
const DEFAULT_ZIP_CODES = [
  { zip: "00901", area: "Viejo San Juan" },
  { zip: "00907", area: "Condado" },
  { zip: "00909", area: "Santurce" },
  { zip: "00917", area: "Hato Rey" },
  { zip: "00918", area: "Hato Rey" },
  { zip: "00920", area: "Río Piedras" },
  { zip: "00923", area: "Cupey" },
  { zip: "00926", area: "Cupey Gardens" },
  { zip: "00949", area: "Toa Baja" },
  { zip: "00956", area: "Bayamón" },
  { zip: "00959", area: "Bayamón" },
  { zip: "00965", area: "Guaynabo" },
  { zip: "00968", area: "Guaynabo" },
  { zip: "00969", area: "Garden Hills" },
  { zip: "00976", area: "Trujillo Alto" },
  { zip: "00979", area: "Carolina" },
  { zip: "00983", area: "Isla Verde" },
]

export type OrderMode = "delivery" | "pickup"

export interface UserLocation {
  address: string
  lat: number
  lng: number
  zip?: string
  // Structured components — populated when selected from autocomplete or reverse geocode
  streetAddress?: string
  city?: string
  state?: string
}

interface LocationBarProps {
  onLocationChange: (location: UserLocation | null) => void
  onModeChange?: (mode: OrderMode) => void
  initialLocation?: UserLocation | null
  initialMode?: OrderMode
  showModeToggle?: boolean
  isMobile?: boolean
}

export function LocationBar({ 
  onLocationChange, 
  onModeChange,
  initialLocation, 
  initialMode = "delivery",
  showModeToggle = true,
  isMobile = false
}: LocationBarProps) {
  const [location, setLocation] = useState<UserLocation | null>(initialLocation || null)
  const [mode, setMode] = useState<OrderMode>(initialMode)
  const [isLoadingGeo, setIsLoadingGeo] = useState(false)
  const [addressInput, setAddressInput] = useState("")
  const [isAutoMode, setIsAutoMode] = useState(true)
  const [suggestions, setSuggestions] = useState<Array<{ text: string; placeId: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  
  // Saved addresses state
  const [user, setUser] = useState<User | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false)
  
  // Dynamic zip codes from database
  const [zipCodes, setZipCodes] = useState(DEFAULT_ZIP_CODES)

  useEffect(() => { setIsMounted(true) }, [])

  // Fetch zip codes from API
  useEffect(() => {
    fetch("/api/service-areas")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setZipCodes(data)
        }
      })
      .catch(() => {
        // Use defaults on error
      })
  }, [])

  // Check auth and fetch saved addresses
  useEffect(() => {
    const supabase = createClient()
    
    const checkUserAndFetchAddresses = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        setIsLoadingAddresses(true)
        // Get customer ID
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("auth_user_id", user.id)
          .single()
        
        if (customer) {
          setCustomerId(customer.id)
          // Fetch saved addresses
          const { data: addresses } = await supabase
            .from("customer_addresses")
            .select("*")
            .eq("customer_id", customer.id)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: false })
          
          if (addresses) {
            setSavedAddresses(addresses)
            // If we have a default address and no location set, use it
            const defaultAddr = addresses.find(a => a.is_default)
            if (defaultAddr && !location) {
              selectSavedAddress(defaultAddr)
            }
          }
        }
        setIsLoadingAddresses(false)
      }
    }
    
    checkUserAndFetchAddresses()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      if (!session?.user) {
        setSavedAddresses([])
        setCustomerId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Select a saved address
  const selectSavedAddress = (address: SavedAddress) => {
    const fullAddress = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.postal_code
    ].filter(Boolean).join(", ")
    
    handleLocationSet({
      address: fullAddress,
      lat: address.latitude || 18.4655,
      lng: address.longitude || -66.1057,
      zip: address.postal_code || "",
      streetAddress: address.address_line_1,
      city: address.city,
      state: address.state || "PR",
    })
    setSelectedAddressId(address.id)
    setShowAddressModal(false)
  }

  const updateDropdownRect = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownRect({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }

  // Load from localStorage on mount
  useEffect(() => {
    const savedLocation = localStorage.getItem(LOCATION_STORAGE_KEY)
    const savedMode = localStorage.getItem(MODE_STORAGE_KEY) as OrderMode | null
    
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation)
        setLocation(parsed)
        setAddressInput(parsed.address || "")
        onLocationChange(parsed)
      } catch (e) {
        console.error("Failed to parse saved location", e)
      }
    }
    
    if (savedMode) {
      setMode(savedMode)
      onModeChange?.(savedMode)
    }
  }, [])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleModeChange = (newMode: OrderMode) => {
    setMode(newMode)
    localStorage.setItem(MODE_STORAGE_KEY, newMode)
    onModeChange?.(newMode)
  }

  const handleLocationSet = (newLocation: UserLocation) => {
    setLocation(newLocation)
    setAddressInput(newLocation.address)
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(newLocation))
    onLocationChange(newLocation)
    // Notify same-tab listeners (e.g. customer-portal) that the location changed
    window.dispatchEvent(new CustomEvent("foodnet:location-changed", { detail: newLocation }))
    setShowSuggestions(false)
    setSuggestions([])
  }

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
          
          if (data.address) {
            handleLocationSet({
              address: data.address,
              lat: latitude,
              lng: longitude,
              zip: data.zip || "",
              streetAddress: data.street || "",
              city: data.city || "",
              state: data.state || "PR",
            })
          } else {
            handleLocationSet({
              address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              lat: latitude,
              lng: longitude,
            })
          }
        } catch (error) {
          handleLocationSet({
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            lat: latitude,
            lng: longitude,
          })
        }
        setIsLoadingGeo(false)
      },
      (error) => {
        console.error("Geolocation error:", error)
        alert("No pudimos obtener tu ubicación. Por favor ingresa tu dirección manualmente.")
        setIsLoadingGeo(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleAddressInputChange = async (value: string) => {
    setAddressInput(value)
    
    if (value.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    try {
      const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(value)}`)
      const data = await response.json()
      
      if (data.predictions && data.predictions.length > 0) {
        setSuggestions(data.predictions.slice(0, 5))
        setShowSuggestions(true)
        updateDropdownRect()
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error)
    }
  }

  const handleSuggestionSelect = async (suggestion: { text: string; placeId: string }) => {
    try {
      const response = await fetch(`/api/places/details?placeId=${suggestion.placeId}`)
      const data = await response.json()

      if (data.lat && data.lng) {
        handleLocationSet({
          address: suggestion.text,
          lat: data.lat,
          lng: data.lng,
          zip: data.zip || "",
          streetAddress: data.streetAddress || "",
          city: data.city || "",
          state: data.state || "PR",
        })
      }
    } catch (error) {
      console.error("Error getting place details:", error)
    }
  }

  const handleAddressSubmit = async () => {
    if (!addressInput.trim()) return

    try {
      const response = await fetch(`/api/places/geocode?address=${encodeURIComponent(addressInput)}`)
      const data = await response.json()

      if (data.lat && data.lng) {
        // Reverse-geocode to get structured components from the resolved coords
        const rgRes = await fetch(`/api/places/reverse-geocode?lat=${data.lat}&lng=${data.lng}`)
        const geo = await rgRes.json()

        handleLocationSet({
          address: geo.address || addressInput,
          lat: data.lat,
          lng: data.lng,
          zip: geo.zip || "",
          streetAddress: geo.street || "",
          city: geo.city || "",
          state: geo.state || "PR",
        })
      }
    } catch (error) {
      console.error("Error geocoding address:", error)
    }
  }

  const handleZipSelect = async (zip: string) => {
    const zipData = zipCodes.find((z) => z.zip === zip)
    if (!zipData) return

    try {
      const response = await fetch(`/api/places/geocode?address=${zip}, Puerto Rico`)
      const data = await response.json()

      if (data.lat && data.lng) {
        // Use default_address if set, otherwise fall back to reverse geocoding
        let displayAddress = zipData.defaultAddress || `${zipData.area}, PR ${zip}`
        let streetAddress = ""
        let city = zipData.area
        let state = "PR"

        // Only reverse-geocode if no default address is set
        if (!zipData.defaultAddress) {
          const rgRes = await fetch(`/api/places/reverse-geocode?lat=${data.lat}&lng=${data.lng}`)
          const geo = await rgRes.json()
          displayAddress = geo.address || displayAddress
          streetAddress = geo.street || ""
          city = geo.city || zipData.area
          state = geo.state || "PR"
        }

        handleLocationSet({
          address: displayAddress,
          lat: data.lat,
          lng: data.lng,
          zip,
          streetAddress,
          city,
          state,
        })
      }
    } catch (error) {
      console.error("Error geocoding zip:", error)
    }
  }

  // Address Modal (DoorDash style)
  const addressModal = isMounted && showAddressModal ? createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-start justify-center pt-16 px-4"
      onClick={() => setShowAddressModal(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Modal */}
      <div 
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <button
            onClick={() => setShowAddressModal(false)}
            className="p-1 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold">Addresses</h2>
          <div className="w-7" /> {/* Spacer for centering */}
        </div>
        
        {/* Search Input */}
        <div className="p-4 border-b">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Enter Your Address"
              value={addressInput}
              onChange={(e) => handleAddressInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddressSubmit()
                  setShowAddressModal(false)
                }
              }}
              className="pl-10 h-10"
            />
          </div>
          
          {/* Suggestions in modal */}
          {suggestions.length > 0 && (
            <div className="mt-2 border rounded-lg overflow-hidden">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.placeId || index}
                  onClick={() => {
                    handleSuggestionSelect(suggestion)
                    setShowAddressModal(false)
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-100 transition-colors flex items-center gap-2 border-b last:border-b-0"
                >
                  <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="line-clamp-2">{suggestion.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Saved Addresses List */}
        <div className="flex-1 overflow-y-auto">
          {/* Add Label button (like DoorDash) */}
          <button
            onClick={() => {
              // Could open add address form
              setShowAddressModal(false)
              window.location.href = "/account?tab=addresses"
            }}
            className="w-full px-4 py-3 flex items-center gap-2 text-sm font-medium hover:bg-slate-50 transition-colors border-b"
          >
            <Plus className="w-4 h-4" />
            Add new address
          </button>
          
          {isLoadingAddresses ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : savedAddresses.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No saved addresses yet
            </div>
          ) : (
            savedAddresses.map((address) => (
              <div
                key={address.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b cursor-pointer"
                onClick={() => selectSavedAddress(address)}
              >
                {/* Radio button */}
                <div className="mt-1">
                  {selectedAddressId === address.id || (location?.streetAddress === address.address_line_1) ? (
                    <div className="w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                  )}
                </div>
                
                {/* Address details */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900">
                    {address.address_line_1}
                    {address.label && address.label !== "Home" && (
                      <span className="ml-2 text-xs text-slate-500">({address.label})</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500 truncate">
                    {[address.city, address.state, address.postal_code].filter(Boolean).join(", ")}
                  </p>
                </div>
                
                {/* Edit button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    window.location.href = `/account?tab=addresses&edit=${address.id}`
                  }}
                  className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                >
                  <Pencil className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null

  const suggestionsDropdown =
    isMounted && showSuggestions && suggestions.length > 0 && dropdownRect && !showAddressModal
      ? createPortal(
          <div
            ref={suggestionsRef}
            style={{
              position: "absolute",
              top: dropdownRect.top,
              left: Math.max(8, Math.min(dropdownRect.left, window.innerWidth - 340)),
              width: Math.max(320, Math.min(dropdownRect.width, window.innerWidth - 16)),
              maxWidth: "calc(100vw - 16px)",
              zIndex: 99999,
            }}
            className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.placeId || index}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSuggestionSelect(suggestion)
                }}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-100 transition-colors flex items-center gap-2"
              >
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="line-clamp-2">{suggestion.text}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex flex-col gap-2">
        {/* Row 1: Delivery badge + Use Location Button + Zip Dropdown */}
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 bg-black text-white text-sm font-medium px-3 py-1.5 rounded-full">
            Delivery
          </span>
          <button
            onClick={handleUseMyLocation}
            disabled={isLoadingGeo}
            title={isLoadingGeo ? "Buscando..." : "Usar mi ubicación"}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors flex-shrink-0 disabled:opacity-50"
          >
            {isLoadingGeo ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {isLoadingGeo ? "..." : "Mi ubicación"}
            </span>
          </button>
          {/* Zip Code Dropdown */}
          <Select
            value={location?.zip || ""}
onValueChange={(zip) => {
  const zipData = zipCodes.find((z) => z.zip === zip)
  if (zipData) {
  handleLocationSet({
  address: `${zipData.area}, PR ${zip}`,
  lat: 18.4655,
  lng: -66.1057,
  zip: zip,
  city: zipData.area,
  state: "PR",
  })
  }
  }}
          >
            <SelectTrigger className="w-auto min-w-[80px] h-9 px-3 border-slate-300 rounded-full text-sm">
              <Keyboard className="w-4 h-4 mr-1.5" />
              <SelectValue placeholder="Zip" />
            </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {zipCodes.map((zipCode) => (
                      <SelectItem key={zipCode.zip} value={zipCode.zip}>
                        {zipCode.zip}
                      </SelectItem>
                    ))}
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: Address Input (Full Width) or Saved Address Button */}
        {user && savedAddresses.length > 0 ? (
          <button
            onClick={() => setShowAddressModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-left"
          >
            <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span className="text-sm truncate flex-1">
              {location?.streetAddress || location?.address || "Select address"}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </button>
        ) : (
          <div className="relative w-full">
            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
              <div className="flex items-center px-2.5 border-r border-slate-200 bg-slate-50">
                <MapPin className="w-4 h-4 text-slate-500" />
              </div>
              <Input
                ref={inputRef}
                type="text"
                placeholder="Buscar dirección"
                value={addressInput}
                onChange={(e) => handleAddressInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddressSubmit()
                  }
                }}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true)
                    updateDropdownRect()
                  }
                }}
                className="border-0 h-10 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
              />
            </div>
            {suggestionsDropdown}
          </div>
        )}
        
        {/* Address Modal */}
        {addressModal}
      </div>
    )
  }

  // Desktop Layout
  return (
    <div className="flex items-center gap-2 flex-1">
      {/* Delivery badge */}
      <span className="flex-shrink-0 bg-black text-white text-sm font-medium px-3 py-1 rounded-full">
        Delivery
      </span>

      {/* Use My Location Button - icon only */}
      <button
        onClick={handleUseMyLocation}
        disabled={isLoadingGeo}
        title={isLoadingGeo ? "Buscando..." : "Usar mi ubicación"}
        className="flex items-center justify-center w-8 h-8 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors flex-shrink-0 disabled:opacity-50"
      >
        {isLoadingGeo ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Navigation className="w-4 h-4" />
        )}
      </button>

      {/* Address Input / Saved Address Selector */}
      {user && savedAddresses.length > 0 ? (
        /* Logged in with saved addresses - show clickable address with dropdown */
        <button
          onClick={() => setShowAddressModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex-1 min-w-[200px] max-w-md text-left"
        >
          <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <span className="text-sm truncate flex-1">
            {location?.streetAddress || location?.address || "Select address"}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </button>
      ) : (
        /* Not logged in or no saved addresses - show input */
        <div className="relative flex-1 min-w-[200px]">
          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
            <div className="flex items-center gap-1.5 px-2 border-r border-slate-200 bg-slate-50">
              <Keyboard className="w-4 h-4 text-slate-500" />
            </div>
            <Input
              ref={inputRef}
              type="text"
              placeholder="Ingresar dirección"
              value={addressInput}
              onChange={(e) => handleAddressInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddressSubmit()
                }
              }}
              onFocus={() => {
                if (user && savedAddresses.length > 0) {
                  setShowAddressModal(true)
                } else if (suggestions.length > 0) {
                  setShowSuggestions(true)
                  updateDropdownRect()
                }
              }}
              className="border-0 h-8 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
            />
            {/* Auto/Manual toggle */}
            <button
              onClick={() => setIsAutoMode(!isAutoMode)}
              className="px-2 text-xs text-slate-500 hover:text-slate-700 border-l border-slate-200 h-full bg-slate-50 whitespace-nowrap"
            >
              {isAutoMode ? "Auto" : "Manual"}
            </button>
          </div>
          {suggestionsDropdown}
        </div>
      )}

      {/* Zip Code Dropdown */}
      <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white flex-shrink-0">
        <div className="flex items-center gap-1 px-2 border-r border-slate-200 bg-slate-50">
          <Map className="w-4 h-4 text-slate-500" />
        </div>
        <Select onValueChange={handleZipSelect} value={location?.zip || ""}>
          <SelectTrigger className="border-0 h-8 text-sm w-[90px] focus:ring-0 focus:ring-offset-0">
            <SelectValue placeholder="Zip" />
          </SelectTrigger>
                <SelectContent className="max-h-60">
                  {zipCodes.map((z) => (
                    <SelectItem key={z.zip} value={z.zip}>
                      {z.zip}
                    </SelectItem>
                  ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Address Modal */}
      {addressModal}
    </div>
  )
}
