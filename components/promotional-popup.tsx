"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Lock, Loader2, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { submitPopupLead } from "@/app/actions/popup-lead"

type PopupPlacement = 
  | "delivery_marketplace"
  | "catering_marketplace"
  | "restaurant_portal"
  | "catering_portal"

interface PromotionalPopupProps {
  placement: PopupPlacement
  restaurantId?: string
  cateringRestaurantId?: string
  cateringBranchId?: string
  operatorId?: string
}

interface Popup {
  id: string
  title: string
  body: string
  image_url: string | null
  cta_text: string | null
  cta_url: string | null
  delay_seconds: number
  frequency: "once_per_session" | "every_visit"
  collect_email: boolean
  email_capture_label: string | null
  email_button_text: string | null
}

export function PromotionalPopup({
  placement,
  restaurantId,
  cateringRestaurantId,
  cateringBranchId,
  operatorId,
}: PromotionalPopupProps) {
  const [popup, setPopup] = useState<Popup | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Email capture state
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailSubmitted, setEmailSubmitted] = useState(false)

  const fetchPopup = useCallback(async () => {
    try {
      const supabase = createClient()
      const today = new Date().toISOString().split("T")[0]

      // Build the query based on placement
      let query = supabase
        .from("promotional_popups")
        .select("id, title, body, image_url, cta_text, cta_url, delay_seconds, frequency, restaurant_id, catering_restaurant_id, catering_branch_id, collect_email, email_capture_label, email_button_text")
        .eq("is_active", true)

      // Filter by placement (using correct column names)
      switch (placement) {
        case "delivery_marketplace":
          query = query.eq("show_on_delivery", true)
          break
        case "catering_marketplace":
          query = query.eq("show_on_catering", true)
          break
        case "restaurant_portal":
          query = query.eq("show_on_restaurant_portal", true)
          break
        case "catering_portal":
          query = query.eq("show_on_catering_portal", true)
          break
      }

      // Filter by date range
      query = query
        .or(`start_date.is.null,start_date.lte.${today}`)
        .or(`end_date.is.null,end_date.gte.${today}`)

      const { data: popups, error } = await query

      if (error || !popups || popups.length === 0) return

      // Filter popups based on restaurant/catering_restaurant/branch targeting
      const matchingPopups = popups.filter((p: any) => {
        // Platform-wide popups (no specific restaurant)
        if (!p.restaurant_id && !p.catering_restaurant_id) return true

        // For restaurant portals, check if this popup targets this specific restaurant
        if (placement === "restaurant_portal" && restaurantId) {
          if (p.restaurant_id === restaurantId) return true
          if (!p.restaurant_id) return true // Platform-wide also shows
          return false
        }

        // For catering portals, check if this popup targets this specific catering restaurant/branch
        if (placement === "catering_portal" && cateringRestaurantId) {
          // Must match the catering restaurant (or be platform-wide)
          if (p.catering_restaurant_id && p.catering_restaurant_id !== cateringRestaurantId) {
            return false
          }
          
          // If popup targets a specific branch, check if it matches
          if (p.catering_branch_id) {
            // Only show if current branch matches OR if no branch is specified for the portal
            return !cateringBranchId || p.catering_branch_id === cateringBranchId
          }
          
          // Popup applies to all branches of this restaurant (catering_branch_id is null)
          return true
        }

        // For marketplaces, show platform-wide popups and restaurant-specific if they match
        if (placement === "delivery_marketplace") {
          // Only show platform-wide or if restaurantId matches (though marketplace usually doesn't have one)
          return !p.restaurant_id || p.restaurant_id === restaurantId
        }

        if (placement === "catering_marketplace") {
          return !p.catering_restaurant_id || p.catering_restaurant_id === cateringRestaurantId
        }

        return true
      })

      if (matchingPopups.length === 0) return

      // Get the first matching popup (could be randomized or prioritized in the future)
      const selectedPopup = matchingPopups[0]

      // Check sessionStorage for once_per_session frequency
      if (selectedPopup.frequency === "once_per_session") {
        const shownPopups = sessionStorage.getItem("shown_popups")
        const shownIds = shownPopups ? JSON.parse(shownPopups) : []
        if (shownIds.includes(selectedPopup.id)) return
      }

      // Check if email was already submitted for this popup (don't show email form again)
      if (selectedPopup.collect_email) {
        const submittedPopups = sessionStorage.getItem("email_submitted_popups")
        const submittedIds = submittedPopups ? JSON.parse(submittedPopups) : []
        if (submittedIds.includes(selectedPopup.id)) {
          // Email already submitted this session - mark as submitted
          setEmailSubmitted(true)
        }
      }

      // Set the popup and schedule display
      setPopup(selectedPopup)

      // Show after delay
      const timeoutId = setTimeout(() => {
        setIsVisible(true)

        // Mark as shown in sessionStorage if once_per_session
        if (selectedPopup.frequency === "once_per_session") {
          const shownPopups = sessionStorage.getItem("shown_popups")
          const shownIds = shownPopups ? JSON.parse(shownPopups) : []
          shownIds.push(selectedPopup.id)
          sessionStorage.setItem("shown_popups", JSON.stringify(shownIds))
        }
      }, selectedPopup.delay_seconds * 1000)

      return () => clearTimeout(timeoutId)
    } catch (err) {
      console.error("[PromotionalPopup] Error fetching popup:", err)
    }
  }, [placement, restaurantId, cateringRestaurantId, cateringBranchId])

  useEffect(() => {
    fetchPopup()
  }, [fetchPopup])

  const handleClose = () => {
    // Mark as dismissed in sessionStorage for once_per_session frequency
    // This ensures the popup won't show again this session even if user closes without interacting
    if (popup && popup.frequency === "once_per_session") {
      const shownPopups = sessionStorage.getItem("shown_popups")
      const shownIds = shownPopups ? JSON.parse(shownPopups) : []
      if (!shownIds.includes(popup.id)) {
        shownIds.push(popup.id)
        sessionStorage.setItem("shown_popups", JSON.stringify(shownIds))
      }
    }

    setIsClosing(true)
    setTimeout(() => {
      setIsVisible(false)
      setPopup(null)
    }, 200)
  }

  const handleCTAClick = () => {
    if (popup?.cta_url) {
      window.open(popup.cta_url, "_blank", "noopener,noreferrer")
    }
    handleClose()
  }

  // Email validation
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Handle email submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError("")

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setEmailError("Ingresa tu email")
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setEmailError("Email inválido")
      return
    }

    if (!popup) return

    setIsSubmitting(true)
    try {
      await submitPopupLead({
        popupId: popup.id,
        email: trimmedEmail,
        operatorId: operatorId || "",
        restaurantId: restaurantId,
        cateringRestaurantId: cateringRestaurantId,
        cateringBranchId: cateringBranchId,
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
      })

      // Mark as submitted in sessionStorage
      const submittedPopups = sessionStorage.getItem("email_submitted_popups")
      const submittedIds = submittedPopups ? JSON.parse(submittedPopups) : []
      submittedIds.push(popup.id)
      sessionStorage.setItem("email_submitted_popups", JSON.stringify(submittedIds))

      setEmailSubmitted(true)
    } catch (err: any) {
      setEmailError(err.message || "Error al enviar. Intenta de nuevo.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!popup || !isVisible) return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 transition-opacity duration-200 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
          isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 p-1.5 bg-white/90 hover:bg-white rounded-full shadow-md transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        {/* Image */}
        {popup.image_url && (
          <div className="w-full h-48 relative">
            <img
              src={popup.image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {popup.title}
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-5">
            {popup.body}
          </p>

          {/* Email Capture Form */}
          {popup.collect_email && !emailSubmitted && (
            <form onSubmit={handleEmailSubmit} className="space-y-3 mb-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setEmailError("")
                  }}
                  placeholder={popup.email_capture_label || "Ingresa tu email para desbloquear la oferta"}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F2901C] text-sm ${
                    emailError ? "border-red-400 bg-red-50" : "border-gray-200"
                  }`}
                  disabled={isSubmitting}
                />
              </div>
              {emailError && (
                <p className="text-sm text-red-500">{emailError}</p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-[#F2901C] hover:bg-[#e0850f] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  popup.email_button_text || "Desbloquear oferta"
                )}
              </button>
            </form>
          )}

          {/* Email Submitted Thank You */}
          {popup.collect_email && emailSubmitted && (
            <div className="space-y-4 mb-4">
              <div className="flex items-center justify-center gap-2 py-3 px-4 bg-green-50 text-green-700 rounded-lg">
                <Check className="h-5 w-5" />
                <span className="font-medium">¡Gracias! Tu oferta ha sido aplicada.</span>
              </div>
              {popup.cta_text && popup.cta_url && (
                <button
                  onClick={handleCTAClick}
                  className="w-full py-3 px-4 bg-[#F2901C] hover:bg-[#e0850f] text-white font-semibold rounded-lg transition-colors"
                >
                  Ver oferta →
                </button>
              )}
            </div>
          )}

          {/* CTA Button (only show if not collecting email OR email already submitted) */}
          {(!popup.collect_email) && popup.cta_text && popup.cta_url && (
            <button
              onClick={handleCTAClick}
              className="w-full py-3 px-4 bg-[#F2901C] hover:bg-[#e0850f] text-white font-semibold rounded-lg transition-colors"
            >
              {popup.cta_text}
            </button>
          )}

          {/* Close text link - secondary close option */}
          <button
            onClick={handleClose}
            className="w-full mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            No gracias, cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
