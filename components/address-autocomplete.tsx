"use client"

/**
 * AddressAutocomplete - Custom autocomplete using Google Places API (New) via REST.
 * Uses the Places API (New) which works for all customers including new API keys.
 */

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { confidenceFromDetailsResponse, type Confidence } from "@/lib/places/confidence"

export interface AddressComponents {
  streetAddress: string
  city: string
  state: string
  zip: string
  latitude?: number | null
  longitude?: number | null
  /** "low" means the picked place needs forced pin confirmation at checkout. */
  confidence?: Confidence
}

interface Prediction {
  placeId: string
  text: string
  mainText: string
  secondaryText: string
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onAddressSelected?: (components: AddressComponents) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  /**
   * When true, this input acts as a *secondary* search bar (e.g. Line 2
   * "Apt, Urb, Suite" in the CSR portal). On pick the input is cleared
   * instead of being filled with the selected street address, and the
   * "no results found" manual-entry dropdown + Ingresar-manualmente
   * toggle are suppressed. The onAddressSelected callback still fires
   * with the full components so the parent can populate the primary
   * Line 1 + city/state/zip + coordinates.
   */
  secondarySearch?: boolean
  /**
   * When true, no autocomplete fetches fire and no suggestion dropdown
   * renders — the field behaves like a plain text input. Used as
   * Guardrail A on customer checkout: Line 2 only offers suggestions
   * when Line 1 is empty, so an accidental POI pick can’t wipe out an
   * already-entered street address.
   */
  suppressPredictions?: boolean
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelected,
  onBlur,
  placeholder = "Número de Casa o Edificio, Calle",
  className = "",
  secondarySearch = false,
  suppressPredictions = false,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isManualMode, setIsManualMode] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [noResultsFound, setNoResultsFound] = useState(false)
  // Manual entry fields for when Google can't find the address
  const [manualCity, setManualCity] = useState("")
  const [manualState, setManualState] = useState("PR")
  const [manualZip, setManualZip] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Sync external value changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Fetch predictions from our API
  const fetchPredictions = useCallback(async (input: string) => {
    if (suppressPredictions) {
      // Guardrail: caller has asked us to stay silent (e.g. Line 2 on
      // customer checkout when Line 1 is already populated).
      setPredictions([])
      setNoResultsFound(false)
      setShowDropdown(false)
      return
    }
    if (input.length < 3) {
      setPredictions([])
      setNoResultsFound(false)
      return
    }

    setIsLoading(true)
    setNoResultsFound(false)
    try {
      const response = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(input)}`
      )
      const data = await response.json()
      
      if (data.predictions && data.predictions.length > 0) {
        setPredictions(data.predictions)
        setShowDropdown(true)
        setNoResultsFound(false)
      } else if (secondarySearch) {
        // Secondary search bar: silently show no suggestions; don't
        // hijack the input with a manual-entry panel (user may simply
        // be typing a free-text apt/unit like "Apt 2B").
        setPredictions([])
        setNoResultsFound(false)
        setShowDropdown(false)
      } else {
        // No results found - show manual entry form
        setPredictions([])
        setNoResultsFound(true)
        setShowDropdown(true)
        // Reset manual fields for fresh entry
        setManualCity("")
        setManualState("PR")
        setManualZip("")
      }
    } catch (error) {
      console.error("Failed to fetch predictions:", error)
      setNoResultsFound(true)
      setShowDropdown(true)
    } finally {
      setIsLoading(false)
    }
  }, [suppressPredictions])

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    setSelectedIndex(-1)

    if (isManualMode || suppressPredictions) return

    // Debounce API calls
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      fetchPredictions(newValue)
    }, 300)
  }

  // Parse city from secondary text (e.g., "San Juan, Puerto Rico" -> "San Juan")
  const parseCityFromSecondaryText = (secondaryText: string): string => {
    if (!secondaryText) return ""
    const parts = secondaryText.split(",").map(p => p.trim())
    // First part is usually the city
    return parts[0] || ""
  }

  // Handle prediction selection
  const handleSelectPrediction = async (prediction: Prediction) => {
    setShowDropdown(false)
    setIsLoading(true)

    try {
      // Fetch place details
      const response = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(prediction.placeId)}`
      )
      const data = await response.json()

      // Handle API error - use fallback from prediction data
      if (!response.ok || !data.addressComponents) {
        const fallbackCity = parseCityFromSecondaryText(prediction.secondaryText)
        
        if (secondarySearch) {
          setInputValue("")
          onChange("")
        } else {
          setInputValue(prediction.mainText)
          onChange(prediction.mainText)
        }
        
        if (onAddressSelected) {
          onAddressSelected({
            streetAddress: prediction.mainText,
            city: fallbackCity,
            state: "PR",
            zip: "", // User will need to enter manually
            latitude: null,
            longitude: null,
          })
        }
        
        if (onBlur) {
          setTimeout(onBlur, 300)
        }
        return
      }

      // Success path - use API data
      const streetAddress = data.streetAddress || prediction.mainText
      if (secondarySearch) {
        // Clear the Line 2 input so the CSR can type the real apt/unit.
        setInputValue("")
        onChange("")
      } else {
        setInputValue(streetAddress)
        onChange(streetAddress)
      }

      // Phase 2 — silent USPS-CASS normalization via Google Address Validation.
      // If the verdict is "deliverable" (PREMISE/SUB_PREMISE granularity, no
      // unconfirmed components), use the canonical components + higher-accuracy
      // lat/lng. Otherwise keep the Places data as-is. Failures are non-fatal.
      let finalStreet = streetAddress
      let finalCity = data.city || ""
      let finalState = data.state || "PR"
      let finalZip = data.zip || ""
      let finalLat: number | null = typeof data.lat === "number" ? data.lat : null
      let finalLng: number | null = typeof data.lng === "number" ? data.lng : null
      let validationGranularity: string | null = null

      try {
        const vRes = await fetch("/api/address/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addressLines: [streetAddress],
            locality: finalCity,
            administrativeArea: finalState,
            postalCode: finalZip,
            regionCode: "US",
          }),
        })
        if (vRes.ok) {
          const v = await vRes.json()
          if (v?.verdict?.validationGranularity) {
            validationGranularity = String(v.verdict.validationGranularity)
          }
          if (v?.deliverable && v?.canonical) {
            const c = v.canonical
            if (c.addressLine1) finalStreet = c.addressLine1
            if (c.city) finalCity = c.city
            if (c.state) finalState = c.state
            if (c.zip) finalZip = c.zip
            if (typeof c.latitude === "number") finalLat = c.latitude
            if (typeof c.longitude === "number") finalLng = c.longitude
            if (!secondarySearch && finalStreet !== streetAddress) {
              setInputValue(finalStreet)
              onChange(finalStreet)
            }
          }
        }
      } catch {
        // Non-fatal — proceed with Places data
      }

      // Compute confidence for the downstream pin UX. Low confidence triggers
      // the forced-confirm mode (bigger satellite map + Street View panel).
      const confidence = confidenceFromDetailsResponse(
        {
          addressComponents: Array.isArray(data.addressComponents)
            ? data.addressComponents
            : [],
          viewport: data.viewport || null,
        },
        validationGranularity
      )

      if (onAddressSelected) {
        onAddressSelected({
          streetAddress: finalStreet,
          city: finalCity,
          state: finalState,
          zip: finalZip,
          latitude: finalLat,
          longitude: finalLng,
          confidence,
        })
      }

      // Trigger distance calculation after form state has updated
      if (onBlur) {
        setTimeout(onBlur, 300)
      }
    } catch {
      // Fallback on catch
      const fallbackCity = parseCityFromSecondaryText(prediction.secondaryText)
      if (secondarySearch) {
        setInputValue("")
        onChange("")
      } else {
        setInputValue(prediction.mainText)
        onChange(prediction.mainText)
      }
      
      if (onAddressSelected) {
        onAddressSelected({
          streetAddress: prediction.mainText,
          city: fallbackCity,
          state: "PR",
          zip: "",
          latitude: null,
          longitude: null,
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || predictions.length === 0) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) => 
          prev < predictions.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case "Enter":
        e.preventDefault()
        if (selectedIndex >= 0) {
          handleSelectPrediction(predictions[selectedIndex])
        }
        break
      case "Escape":
        setShowDropdown(false)
        break
    }
  }

  const handleSwitchToManual = () => {
    setIsManualMode(true)
    setPredictions([])
    setShowDropdown(false)
  }

  const handleSwitchToAuto = () => {
    setIsManualMode(false)
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        required
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (predictions.length > 0 && !isManualMode && !suppressPredictions) {
            setShowDropdown(true)
          }
        }}
        onBlur={(e) => {
          // Delay to allow click on dropdown
          setTimeout(() => {
            if (!dropdownRef.current?.contains(document.activeElement)) {
              setShowDropdown(false)
              if (onBlur) onBlur()
            }
          }, 150)
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      )}

      {/* Predictions dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-[10001] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {predictions.map((prediction, index) => (
            <button
              key={prediction.placeId}
              type="button"
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 border-b border-gray-100 last:border-b-0 ${
                index === selectedIndex ? "bg-gray-100" : ""
              }`}
              onClick={() => handleSelectPrediction(prediction)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <svg
                className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <div>
                <div className="font-medium text-gray-900">
                  {prediction.mainText}
                </div>
                <div className="text-sm text-gray-500">
                  {prediction.secondaryText}
                </div>
              </div>
            </button>
          ))}
          <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50">
            powered by Google
          </div>
        </div>
      )}

      {/* No predictions from Google - read-only hint. Manual entry
          is disabled by policy: every order needs authoritative
          lat/lng from a Places pick + pin confirmation. If Google
          cannot match the text the customer has to refine it or
          contact the restaurant out-of-band. */}
      {!secondarySearch && showDropdown && noResultsFound && predictions.length === 0 && !isLoading && (
        <div
          ref={dropdownRef}
          className="absolute z-[10001] w-full mt-1 bg-white border border-amber-300 rounded-md shadow-lg overflow-hidden"
        >
          <div className="p-3 bg-amber-50">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">No encontramos esta direccion</p>
                <p className="text-xs text-amber-700 mt-1">
                  Intenta con el numero de casa y nombre de calle, o un punto de referencia cercano.
                  Si tu direccion no aparece, comunicate con el restaurante.
                </p>
              </div>
            </div>
          </div>
          <div className="p-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setShowDropdown(false)
                setNoResultsFound(false)
              }}
              className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Manual-entry escape removed by policy - every address must
          come from a Places Autocomplete pick so checkout has
          trusted lat/lng. `isManualMode` + `handleSwitchToManual`
          remain as unreachable code for now; safe to clean up in a
          follow-up commit. */}
    </div>
  )
}
