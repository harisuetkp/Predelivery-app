"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, ChevronUp, ShoppingCart, Store, Truck } from "lucide-react"
import { loadStripe } from "@stripe/stripe-js"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import type { CateringRestaurant } from "@/lib/catering"
import { AddressAutocomplete } from "@/components/address-autocomplete"
import { DeliveryPinConfirm } from "@/components/delivery-pin-confirm"
import { LocateMeButton } from "@/components/locate-me-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { calculateDispatchFee } from "@/lib/catering/dispatch-fee"
import { calculateCateringDeliveryFee } from "@/app/actions/catering/delivery-zones"
import { createCateringCheckoutSession } from "@/app/actions/catering/stripe"
import {
  createCateringATHMovilPayment,
  checkCateringATHMovilStatus,
  createCateringATHMovilOrder,
  authorizeCateringATHMovilPayment,
} from "@/app/actions/catering/athmovil"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export type CateringCheckoutBranchRow = {
  id: string
  name: string
  stripe_account_id: string | null
  catering_restaurant_id: string
  is_active?: boolean
  latitude: number | null
  longitude: number | null
}

type SessionCartItem = {
  id: string
  name: string
  price: number
  quantity: number
  min_quantity?: number | null
  sizeName?: string
  sizeServes?: string
  image_url?: string | null
  menu_item_id: string
}

function normalizeCateringTaxRate(raw: number | null | undefined): number {
  if (raw == null || Number.isNaN(Number(raw))) return 0
  const n = Number(raw)
  return n > 1 ? n / 100 : n
}

function timeSlotsHalfHour(): string[] {
  const slots: string[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
    }
  }
  return slots
}

export type CateringOperatingHourRow = {
  catering_branch_id: string | null
  day_of_week: number // 0 = Sunday .. 6 = Saturday
  is_open: boolean
  open_time: string | null // "HH:MM:SS"
  close_time: string | null // "HH:MM:SS"
}

/**
 * Resolve the open/close window for a given branch + day of week.
 * Rule: per-branch row (catering_branch_id = X) wins; otherwise restaurant-level
 * row (catering_branch_id IS NULL). Returns null if the day is closed or no rows exist.
 */
function resolveHoursForDay(
  hours: CateringOperatingHourRow[],
  branchId: string,
  dayOfWeek: number,
): { openHM: string; closeHM: string } | "closed" | null {
  if (!hours || hours.length === 0) return null // no hours configured at all
  const branchRow = hours.find((r) => r.catering_branch_id === branchId && r.day_of_week === dayOfWeek)
  const restaurantRow = hours.find((r) => r.catering_branch_id === null && r.day_of_week === dayOfWeek)
  const row = branchRow || restaurantRow
  if (!row) return null
  if (!row.is_open || !row.open_time || !row.close_time) return "closed"
  return { openHM: row.open_time.slice(0, 5), closeHM: row.close_time.slice(0, 5) }
}

function formatTimeSlotLabel(t: string): string {
  const [hs, ms] = t.split(":")
  const h = parseInt(hs, 10)
  const m = parseInt(ms, 10)
  const displayHour = h % 12 === 0 ? 12 : h % 12
  const ampm = h >= 12 ? "PM" : "AM"
  return `${displayHour}:${String(m).padStart(2, "0")} ${ampm}`
}

interface CateringCheckoutClientProps {
  slug: string
  restaurant: CateringRestaurant & {
    stripe_account_id?: string | null
    stripe_enabled?: boolean | null
    athmovil_enabled?: boolean | null
    athmovil_public_token?: string | null
  }
  branches: CateringCheckoutBranchRow[]
  operatingHours: CateringOperatingHourRow[]
  initialBranchId: string | null
  authUserId: string
  authEmail: string
  initialFullName: string
  initialPhone: string
  customerId: string | null
}

export default function CateringCheckoutClient({
  slug,
  restaurant,
  branches,
  operatingHours,
  initialBranchId,
  authUserId,
  authEmail,
  initialFullName,
  initialPhone,
  customerId,
}: CateringCheckoutClientProps) {
  const router = useRouter()
  const primaryColor = restaurant.primary_color || "#e11d48"
  const taxRate = normalizeCateringTaxRate(restaurant.tax_rate)
  const taxPercentLabel =
    taxRate > 0 ? `${Number.isInteger(taxRate * 100) ? (taxRate * 100).toFixed(0) : (taxRate * 100).toFixed(2)}%` : "0%"

  const stripeEnabled = restaurant.stripe_enabled !== false
  const athMovilEnabled =
    !!restaurant.athmovil_enabled && !!(restaurant as { athmovil_public_token?: string }).athmovil_public_token

  // Validate tip configuration - throw visible error if not configured (matches catering-menu.tsx)
  if (restaurant.tip_option_1 == null || restaurant.tip_option_2 == null ||
      restaurant.tip_option_3 == null || restaurant.tip_option_4 == null) {
    throw new Error("Tip options not configured for this restaurant")
  }
  if (restaurant.default_tip_option == null) {
    throw new Error("Default tip option not configured for this restaurant")
  }

  const tipPercentOptions: number[] = [
    restaurant.tip_option_1!,
    restaurant.tip_option_2!,
    restaurant.tip_option_3!,
    restaurant.tip_option_4!,
  ]
  const defaultTipPct = tipPercentOptions[restaurant.default_tip_option! - 1] ?? tipPercentOptions[0]

  const [ready, setReady] = useState(false)
  const [cart, setCart] = useState<SessionCartItem[]>([])
  const [selectedBranch, setSelectedBranch] = useState<CateringCheckoutBranchRow | null>(null)

  const [fullName, setFullName] = useState(initialFullName)
  const [email, setEmail] = useState(authEmail)
  const [phone, setPhone] = useState(initialPhone)
  const [eventDate, setEventDate] = useState("")
  const [eventTime, setEventTime] = useState("")
  const [guestCount, setGuestCount] = useState("")
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("pickup")
  const [address, setAddress] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("PR")
  const [zip, setZip] = useState("")
  const [deliveryLatitude, setDeliveryLatitude] = useState<number | null>(null)
  const [deliveryLongitude, setDeliveryLongitude] = useState<number | null>(null)
  // Pin-confirmation gate — low-confidence picks must be confirmed on the
  // map before the pay CTA unlocks. Resets on every new address selection.
  const [addressConfidence, setAddressConfidence] = useState<"high" | "low">("high")
  const [pinConfirmed, setPinConfirmed] = useState(false)
  const [specialInstructions, setSpecialInstructions] = useState("")

  const [tipMode, setTipMode] = useState<"pct" | "custom">("pct")
  const [tipPercent, setTipPercent] = useState<number>(defaultTipPct)
  const [customTip, setCustomTip] = useState("")

  const [zoneDeliveryFee, setZoneDeliveryFee] = useState<number | null>(null)
  const [zoneLabel, setZoneLabel] = useState<string>("")
  const [zoneComputing, setZoneComputing] = useState(false)

  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [showOrderSummary, setShowOrderSummary] = useState(false)

  const [showStripe, setShowStripe] = useState(false)
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null)
  const [stripeSessionId, setStripeSessionId] = useState<string | null>(null)

  const [showATHMovil, setShowATHMovil] = useState(false)
  const [athMovilEcommerceId, setAthMovilEcommerceId] = useState<string | null>(null)
  const [athMovilPublicToken, setAthMovilPublicToken] = useState<string | null>(null)
  const [athMovilPolling, setAthMovilPolling] = useState(false)

  const menuHref = `/catering/${slug}${selectedBranch ? `?branch=${selectedBranch.id}` : ""}`

  const minDateStr = useMemo(() => {
    const minMs = Date.now() + restaurant.default_lead_time_hours * 3600000
    return new Date(minMs).toISOString().split("T")[0]
  }, [restaurant.default_lead_time_hours])

  const maxDateStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + restaurant.max_advance_days)
    return d.toISOString().split("T")[0]
  }, [restaurant.max_advance_days])

  // Time slots, filtered by operating hours for the selected branch + event date.
  // Fallback behavior: if no operating_hours rows exist for this restaurant at all,
  // we show the full 48-slot list (no filtering). Once hours are configured for a
  // given day of week, slots are constrained to [open_time, close_time] inclusive.
  const dayOfWeek: number | null = useMemo(() => {
    if (!eventDate) return null
    // eventDate is "YYYY-MM-DD" — parse as local date, not UTC, to avoid TZ drift.
    const [y, m, d] = eventDate.split("-").map((v) => parseInt(v, 10))
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d).getDay()
  }, [eventDate])

  const timeOptions = useMemo(() => {
    const allSlots = timeSlotsHalfHour()
    if (!selectedBranch || dayOfWeek === null) return allSlots
    const window = resolveHoursForDay(operatingHours, selectedBranch.id, dayOfWeek)
    if (window === null) return allSlots // no hours configured — show full list (legacy behavior)
    if (window === "closed") return [] // explicitly closed that day
    return allSlots.filter((s) => s >= window.openHM && s <= window.closeHM)
  }, [operatingHours, selectedBranch, dayOfWeek])

  // If the currently selected eventTime is no longer a valid slot (e.g. user changed
  // eventDate to a day with tighter hours), clear it so the customer re-picks.
  useEffect(() => {
    if (eventTime && timeOptions.length > 0 && !timeOptions.includes(eventTime)) {
      setEventTime("")
    }
    if (eventTime && timeOptions.length === 0) {
      setEventTime("")
    }
  }, [eventTime, timeOptions])

  useEffect(() => {
    let cancelled = false
    try {
      const raw = sessionStorage.getItem("pendingCateringCart")
      const items: SessionCartItem[] = raw ? JSON.parse(raw) : []
      if (!Array.isArray(items) || items.length === 0) {
        router.replace(`/catering/${slug}`)
        return
      }
      if (cancelled) return
      setCart(items)

      let branchKey = initialBranchId
      try {
        const pb = sessionStorage.getItem("pendingCateringBranch")
        if (!branchKey && pb) branchKey = pb
      } catch {
        /* ignore */
      }
      if (!branchKey && branches.length === 1) {
        branchKey = branches[0].id
      }
      const br = branches.find((b) => b.id === branchKey)
      if (!br) {
        router.replace(`/catering/${slug}`)
        return
      }
      setSelectedBranch(br)
      setReady(true)
    } catch {
      router.replace(`/catering/${slug}`)
    }
    return () => {
      cancelled = true
    }
  }, [slug, router, branches, initialBranchId])

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  )

  const orderTypeDispatch = orderType === "delivery" ? "entrega" : "recogido"
  const dispatchFee = useMemo(
    () => calculateDispatchFee(restaurant, orderTypeDispatch, subtotal),
    [restaurant, orderTypeDispatch, subtotal],
  )

  const flatDeliveryFee = orderType === "delivery" ? restaurant.delivery_fee || 0 : 0

  const deliveryLineFee = useMemo(() => {
    if (orderType !== "delivery") return 0
    if (zoneDeliveryFee != null && zoneDeliveryFee > 0) return zoneDeliveryFee
    return flatDeliveryFee
  }, [orderType, zoneDeliveryFee, flatDeliveryFee])

  const taxAmount = Math.round(subtotal * taxRate * 100) / 100

  const tipAmount = useMemo(() => {
    if (tipMode === "custom") {
      const v = parseFloat(customTip)
      return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0
    }
    return Math.round(subtotal * (tipPercent / 100) * 100) / 100
  }, [tipMode, customTip, subtotal, tipPercent])

  const total = useMemo(
    () => Math.round((subtotal + taxAmount + deliveryLineFee + dispatchFee + tipAmount) * 100) / 100,
    [subtotal, taxAmount, deliveryLineFee, dispatchFee, tipAmount],
  )

  const refreshZoneFee = useCallback(async () => {
    if (orderType !== "delivery" || !selectedBranch) {
      setZoneDeliveryFee(null)
      setZoneLabel("")
      return
    }
    if (!address.trim() || !city.trim() || !state.trim()) {
      setZoneDeliveryFee(null)
      setZoneLabel("")
      return
    }
    setZoneComputing(true)
    try {
      // When we have the confirmed pin, hand its coords to the
      // server so distance is Haversine against the catering
      // branch lat/lng - no typed-address geocode round-trip.
      const pinCoords =
        typeof deliveryLatitude === "number" && typeof deliveryLongitude === "number"
          ? { lat: deliveryLatitude, lng: deliveryLongitude }
          : null
      const res = await calculateCateringDeliveryFee(
        restaurant.id,
        selectedBranch.id,
        address,
        city,
        state,
        pinCoords,
      )
      setZoneDeliveryFee(res.deliveryFee ?? 0)
      setZoneLabel(res.zoneName || "")
    } catch {
      setZoneDeliveryFee(null)
      setZoneLabel("")
    } finally {
      setZoneComputing(false)
    }
  }, [orderType, selectedBranch, restaurant.id, address, city, state, deliveryLatitude, deliveryLongitude])

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshZoneFee()
    }, 500)
    return () => clearTimeout(t)
  }, [refreshZoneFee])

  const stripeConnectAccountId =
    selectedBranch?.stripe_account_id || restaurant.stripe_account_id || null

  function buildCartPayload() {
    return cart.map((item) => ({
      name: item.sizeName ? `${item.name} (${item.sizeName})` : item.name,
      price: item.price,
      quantity: item.quantity,
      type: "item" as const,
      menu_item_id: item.menu_item_id,
      size_name: item.sizeName,
      serves: item.sizeServes,
    }))
  }

  function validateForm(): string | null {
    if (!fullName.trim()) return "Por favor ingresa tu nombre"
    if (!email.trim()) return "Por favor ingresa tu correo electrónico"
    if (!phone.trim()) return "Por favor ingresa tu teléfono"
    if (!eventDate) return "Por favor selecciona la fecha del evento"
    if (!eventTime) return "Por favor selecciona la hora del evento"
    if (orderType === "delivery") {
      if (!address.trim()) return "Por favor ingresa la dirección de entrega"
      if (!city.trim()) return "Por favor ingresa la ciudad"
      if (!zip.trim()) return "Por favor ingresa el código postal"
      // v5: every delivery order must have a pin-confirmed location.
      if (!pinConfirmed) {
        return "Confirma tu ubicación exacta en el mapa antes de continuar"
      }
    }
    if (!selectedBranch) return "No se ha seleccionado una sucursal"
    return null
  }

  function buildOrderDataBase() {
    if (!selectedBranch) throw new Error("Missing branch")
    const cartItems = buildCartPayload()
    return {
      restaurantId: restaurant.id,
      branchId: selectedBranch.id,
      cart: cartItems,
      subtotal,
      tax: taxAmount,
      deliveryFee: deliveryLineFee,
      dispatchFee,
      tip: tipAmount,
      total,
      orderType,
      customerEmail: email,
      customerPhone: phone,
      customerId: customerId || undefined,
      userId: authUserId,
      order_source: "online",
      eventDetails: {
        name: fullName,
        email,
        phone,
        eventDate,
        eventTime,
        guestCount: guestCount ? parseInt(guestCount, 10) : undefined,
        address,
        addressLine2: addressLine2.trim() || undefined,
        city,
        state,
        zip,
        deliveryLatitude,
        deliveryLongitude,
        specialInstructions,
      },
      stripeAccountId: stripeConnectAccountId,
    }
  }

  function buildAthOrderPayload() {
    return {
      ...buildOrderDataBase(),
      restaurantName: restaurant.name,
      branchName: selectedBranch!.name,
    }
  }

  async function handlePayCard() {
    setCheckoutError(null)
    const err = validateForm()
    if (err) {
      setCheckoutError(err)
      return
    }
    setCheckoutLoading(true)
    try {
      const orderData = buildOrderDataBase()
      const result = await createCateringCheckoutSession(orderData)
      if (!result.clientSecret || !result.sessionId) {
        throw new Error("No se recibió la sesión de pago de Stripe")
      }
      setStripeClientSecret(result.clientSecret)
      setStripeSessionId(result.sessionId)
      setShowStripe(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al iniciar el pago"
      setCheckoutError(msg)
    } finally {
      setCheckoutLoading(false)
    }
  }

  function startATHMovilPolling(
    ecommerceId: string,
    publicToken: string,
    authToken: string | null,
    orderData: ReturnType<typeof buildAthOrderPayload>,
  ) {
    setAthMovilPolling(true)
    let attempts = 0
    const maxAttempts = 60
    // Guard so the authorization call only fires once even though the poll runs every 5s.
    let authorizationSent = false
    const interval = setInterval(async () => {
      attempts++
      try {
        const status = await checkCateringATHMovilStatus(ecommerceId, publicToken)

        // When the customer confirms in-app, status moves to CONFIRM. We must call the
        // authorization endpoint to actually capture funds — otherwise ATH will expire
        // the transaction and it will never appear in the merchant's dashboard.
        if (status.status === "CONFIRM" && !authorizationSent && authToken) {
          authorizationSent = true
          const authResult = await authorizeCateringATHMovilPayment(
            ecommerceId,
            authToken,
            publicToken,
          )
          if (!authResult.success) {
            clearInterval(interval)
            setAthMovilPolling(false)
            setShowATHMovil(false)
            setCheckoutError(authResult.error || "El pago no pudo ser autorizado")
            return
          }
          // Authorization succeeded — create the order with the real referenceNumber.
          clearInterval(interval)
          setAthMovilPolling(false)
          const orderResult = await createCateringATHMovilOrder({
            ...orderData,
            athMovilTransactionId: authResult.referenceNumber || ecommerceId,
          })
          if (!orderResult.success) {
            setCheckoutError(orderResult.error || "Error al crear la orden")
            setShowATHMovil(false)
            return
          }
          try {
            sessionStorage.removeItem("pendingCateringCart")
            sessionStorage.removeItem("pendingCateringBranch")
          } catch {
            /* ignore */
          }
          setShowATHMovil(false)
          setCart([])
          router.push(`/catering/${slug}?branch=${selectedBranch!.id}`)
          return
        }

        if (status.status === "COMPLETED") {
          // Merchant has auto-capture enabled — status skipped CONFIRM and went
          // straight to COMPLETED. Create the order directly.
          clearInterval(interval)
          setAthMovilPolling(false)
          const orderResult = await createCateringATHMovilOrder({
            ...orderData,
            athMovilTransactionId: status.transactionId || ecommerceId,
          })
          if (!orderResult.success) {
            setCheckoutError(orderResult.error || "Error al crear la orden")
            setShowATHMovil(false)
            return
          }
          try {
            sessionStorage.removeItem("pendingCateringCart")
            sessionStorage.removeItem("pendingCateringBranch")
          } catch {
            /* ignore */
          }
          setShowATHMovil(false)
          setCart([])
          router.push(`/catering/${slug}?branch=${selectedBranch!.id}`)
        } else if (status.status === "CANCEL" || status.status === "EXPIRED") {
          clearInterval(interval)
          setAthMovilPolling(false)
          setShowATHMovil(false)
          setCheckoutError("El pago fue cancelado. Por favor intenta de nuevo.")
        } else if (attempts >= maxAttempts) {
          clearInterval(interval)
          setAthMovilPolling(false)
          setShowATHMovil(false)
          setCheckoutError("El tiempo de espera expiró. Por favor intenta de nuevo.")
        }
      } catch {
        /* keep polling */
      }
    }, 5000)
  }

  async function handlePayATH() {
    setCheckoutError(null)
    const err = validateForm()
    if (err) {
      setCheckoutError(err)
      return
    }
    setCheckoutLoading(true)
    try {
      const orderData = buildAthOrderPayload()
      const athResult = await createCateringATHMovilPayment(orderData)
      if (!athResult.success || !athResult.ecommerceId) {
        throw new Error(athResult.error || "No se pudo iniciar el pago con ATH Móvil")
      }
      setAthMovilEcommerceId(athResult.ecommerceId)
      setAthMovilPublicToken(athResult.publicToken || null)
      setShowATHMovil(true)
      if (athResult.publicToken) {
        startATHMovilPolling(
          athResult.ecommerceId,
          athResult.publicToken,
          athResult.authToken || null,
          orderData,
        )
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al procesar el pago"
      setCheckoutError(msg)
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (!ready || !selectedBranch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: primaryColor }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push(menuHref)}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Menú
          </button>
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/junteready-logo.jpg"
              alt="JunteReady"
              width={150}
              height={50}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-6">
            {checkoutError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{checkoutError}</div>
            )}

            <section className="border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-3" style={{ backgroundColor: primaryColor }}>
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <span className="w-6 h-6 rounded-full text-sm flex items-center justify-center bg-white" style={{ color: primaryColor }}>1</span>
                  INFORMACIÓN DE CONTACTO
                </h2>
                {authEmail ? (
                  <div className="text-right">
                    <span className="text-sm text-white/80">{authEmail}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        const { createClient } = await import("@/lib/supabase/client")
                        const supabase = createClient()
                        await supabase.auth.signOut()
                        window.location.href = `/catering/${slug}/customer-auth?mode=login&redirect=catering-checkout`
                      }}
                      className="block text-sm text-white underline font-medium mt-0.5 hover:text-white/80"
                    >
                      Cambiar cuenta
                    </button>
                  </div>
                ) : (
                  <a
                    href={`/catering/${slug}/customer-auth?mode=login&redirect=catering-checkout`}
                    className="text-sm text-white underline font-medium hover:text-white/80"
                  >
                    Iniciar Sesión
                  </a>
                )}
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nombre completo *</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Correo electrónico *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <Label>Teléfono *</Label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
                </div>
              </div>
            </section>

            <section className="border rounded-xl overflow-hidden">
              <div className="px-6 py-3" style={{ backgroundColor: primaryColor }}>
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <span className="w-6 h-6 rounded-full text-sm flex items-center justify-center bg-white" style={{ color: primaryColor }}>2</span>
                  DETALLES DEL EVENTO
                </h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Fecha de {orderType === "delivery" ? "Entrega" : "Recogido"} *</Label>
                  <Input
                    type="date"
                    value={eventDate}
                    min={minDateStr}
                    max={maxDateStr}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Hora de {orderType === "delivery" ? "Entrega" : "Recogido"} *</Label>
                  <select
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    disabled={eventDate !== "" && timeOptions.length === 0}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">
                      {eventDate !== "" && timeOptions.length === 0
                        ? "Cerrado este día"
                        : "Selecciona hora"}
                    </option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>
                        {formatTimeSlotLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label>Número de personas (opcional)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    className="mt-1"
                    placeholder="Ej. 50"
                  />
                </div>
              </div>
            </section>

            <section className="border rounded-xl overflow-hidden">
              <div className="px-6 py-3" style={{ backgroundColor: primaryColor }}>
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <span className="w-6 h-6 rounded-full text-sm flex items-center justify-center bg-white" style={{ color: primaryColor }}>3</span>
                  TIPO DE SERVICIO
                </h2>
              </div>
              <div className="p-6">
              <div className="flex bg-slate-100 rounded-full p-1 w-fit mb-6">
                <button
                  type="button"
                  onClick={() => setOrderType("pickup")}
                  className={`flex items-center gap-1.5 px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                    orderType === "pickup" ? "text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                  style={orderType === "pickup" ? { backgroundColor: primaryColor } : {}}
                >
                  <Store className="w-4 h-4" />
                  Recogido
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType("delivery")}
                  className={`flex items-center gap-1.5 px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                    orderType === "delivery" ? "text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                  style={orderType === "delivery" ? { backgroundColor: primaryColor } : {}}
                >
                  <Truck className="w-4 h-4" />
                  Entrega
                </button>
              </div>

              {orderType === "delivery" && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Dirección *</Label>
                      <LocateMeButton
                        onLocated={(lat, lng) => {
                          setDeliveryLatitude(lat)
                          setDeliveryLongitude(lng)
                          setPinConfirmed(true)
                        }}
                        onAddressResolved={(addr) => {
                          // Ubicarme is an explicit user action — populate whatever
                          // came back, even without a house number. The pin on the
                          // map shows exactly where they are.
                          const c = addr.components || {}
                          const nextStreet = addr.streetAddress || c.route || ""
                          if (nextStreet) setAddress(nextStreet)
                          if (c.city) setCity(c.city)
                          if (c.state) setState(c.state)
                          if (c.postalCode) setZip(c.postalCode)
                          if (c.streetNumber && c.route) {
                            setAddressConfidence("high")
                          }
                        }}
                      />
                    </div>
                    <AddressAutocomplete
                      value={address}
                      onChange={(v) => setAddress(v)}
                      onAddressSelected={(c) => {
                        setAddress(c.streetAddress)
                        setCity(c.city)
                        setState(c.state || "PR")
                        setZip(c.zip)
                        setDeliveryLatitude(typeof c.latitude === "number" ? c.latitude : null)
                        setDeliveryLongitude(typeof c.longitude === "number" ? c.longitude : null)
                        setAddressConfidence(c.confidence === "low" ? "low" : "high")
                        setPinConfirmed(false)
                      }}
                      placeholder="Dirección línea 1"
                      className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <Label>Línea 2 (opcional)</Label>
                    <Input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-1">
                      <Label>Ciudad *</Label>
                      <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>Estado *</Label>
                      <Input value={state} onChange={(e) => setState(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>ZIP *</Label>
                      <Input value={zip} onChange={(e) => setZip(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  {typeof deliveryLatitude === "number" && typeof deliveryLongitude === "number" && (
                    <DeliveryPinConfirm
                      latitude={deliveryLatitude}
                      longitude={deliveryLongitude}
                      onChange={(lat, lng) => {
                        setDeliveryLatitude(lat)
                        setDeliveryLongitude(lng)
                        // v5: never auto-confirm on drag, even in
                        // high-confidence mode. The customer must
                        // click 'Confirmar ubicacion' to commit.
                      }}
                      confidence={addressConfidence}
                      onConfirm={() => setPinConfirmed(true)}
                      onUnconfirm={() => setPinConfirmed(false)}
                      confirmed={pinConfirmed}
                      onAddressResolved={(addr) => {
                        // Pin is authoritative in low-confidence mode. Update the
                        // text fields to match the new position so the typed
                        // landmark name doesn't linger after the pin moves away.
                        const c = addr.components || {}
                        const newStreet =
                          addr.streetAddress ||
                          (addr.formattedAddress || "").split(",")[0].trim()
                        if (newStreet) {
                          setAddress(newStreet)
                          if (c.city) setCity(c.city)
                          if (c.state) setState(c.state)
                          if (c.postalCode) setZip(c.postalCode)
                        }
                      }}
                    />
                  )}
                </div>
              )}
              </div>
            </section>

            <section className="border rounded-xl overflow-hidden">
              <div className="px-6 py-3" style={{ backgroundColor: primaryColor }}>
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <span className="w-6 h-6 rounded-full text-sm flex items-center justify-center bg-white" style={{ color: primaryColor }}>4</span>
                  INSTRUCCIONES ESPECIALES
                </h2>
              </div>
              <div className="p-6">
                <Textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Alergias, preferencias, instrucciones de montaje, etc."
                  className="min-h-[100px]"
                />
              </div>
            </section>

            <div className="space-y-4 lg:hidden">
              <div className="border rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Propina</p>
                <div className="flex flex-wrap gap-2">
                  {tipPercentOptions.map((pct) => {
                    const active = tipMode === "pct" && tipPercent === pct
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setTipMode("pct")
                          setTipPercent(pct)
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                          active ? "text-white" : "border-slate-200 text-slate-700"
                        }`}
                        style={active ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                      >
                        {pct}%
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setTipMode("custom")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                      tipMode === "custom" ? "text-white" : "border-slate-200 text-slate-700"
                    }`}
                    style={tipMode === "custom" ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                  >
                    Otro
                  </button>
                </div>
                {tipMode === "custom" && (
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="pl-7"
                      value={customTip}
                      onChange={(e) => setCustomTip(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
              <div className="border rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {orderType === "delivery" && (
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery{zoneLabel ? ` (${zoneLabel})` : ""}</span>
                    <span>{zoneComputing ? "…" : `$${deliveryLineFee.toFixed(2)}`}</span>
                  </div>
                )}
                {dispatchFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Dispatch</span>
                    <span>${dispatchFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>IVU</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Propina</span>
                  <span>${tipAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
              {stripeEnabled && (
                <Button
                  type="button"
                  className="w-full text-white py-4 text-base font-semibold"
                  style={{ backgroundColor: primaryColor }}
                  disabled={checkoutLoading || (orderType === "delivery" && !pinConfirmed)}
                  onClick={() => void handlePayCard()}
                >
                  {checkoutLoading ? (
                    "Procesando…"
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <span>Pagar con Tarjeta</span>
                      <img src="/images/cc-logos.png" alt="Cards" className="h-5" />
                    </div>
                  )}
                </Button>
              )}
              {athMovilEnabled && (
                <button
                  type="button"
                  onClick={() => void handlePayATH()}
                  disabled={checkoutLoading || (orderType === "delivery" && !pinConfirmed)}
                  className="w-full flex items-center justify-center p-4 bg-white border-2 border-[#F58220] rounded-lg hover:bg-orange-50 disabled:opacity-50"
                >
                  <img src="/images/ath-movil-logo.png" alt="ATH Móvil" className="h-8" />
                </button>
              )}
            </div>
          </div>

          <div className="hidden lg:block lg:w-[380px]">
            <div className="lg:sticky lg:top-20 space-y-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                {restaurant.logo_url ? (
                  <Image
                    src={restaurant.logo_url}
                    alt={restaurant.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold"
                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                    aria-hidden="true"
                  >
                    {restaurant.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">Tu orden de</p>
                  <p className="font-bold truncate">{restaurant.name}</p>
                  <p className="text-xs text-slate-600 truncate mt-0.5">{selectedBranch.name}</p>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowOrderSummary(!showOrderSummary)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    <span className="font-medium">
                      Resumen del Pedido ({cart.length} {cart.length === 1 ? "artículo" : "artículos"})
                    </span>
                  </div>
                  {showOrderSummary ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                {showOrderSummary && (
                  <div className="px-4 pb-4 border-t space-y-3 pt-3">
                    {cart.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm gap-2">
                        <span className="text-slate-600">
                          {item.quantity}× {item.name}
                          {item.sizeName ? ` (${item.sizeName})` : ""}
                        </span>
                        <span className="font-medium whitespace-nowrap">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {orderType === "delivery" && (
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery{zoneLabel ? ` (${zoneLabel})` : ""}</span>
                    <span>{zoneComputing ? "…" : `$${deliveryLineFee.toFixed(2)}`}</span>
                  </div>
                )}
                {dispatchFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Dispatch</span>
                    <span>${dispatchFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>IVU</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Propina</span>
                  <span>${tipAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Propina</p>
                <div className="flex flex-wrap gap-2">
                  {tipPercentOptions.map((pct) => {
                    const active = tipMode === "pct" && tipPercent === pct
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setTipMode("pct")
                          setTipPercent(pct)
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                          active ? "text-white" : "border-slate-200 text-slate-700"
                        }`}
                        style={active ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                      >
                        {pct}%
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setTipMode("custom")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                      tipMode === "custom" ? "text-white" : "border-slate-200 text-slate-700"
                    }`}
                    style={tipMode === "custom" ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                  >
                    Otro
                  </button>
                </div>
                {tipMode === "custom" && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="pl-7"
                      value={customTip}
                      onChange={(e) => setCustomTip(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>

              <div className="border rounded-xl p-6 space-y-3">
                <h2 className="text-lg font-bold">Pago</h2>
                {stripeEnabled && (
                  <button
                    type="button"
                    onClick={() => void handlePayCard()}
                    disabled={checkoutLoading || (orderType === "delivery" && !pinConfirmed)}
                    className="w-full flex items-center justify-between p-4 border-2 border-[#635BFF] rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
                  >
                    <span className="font-medium text-[#635BFF]">
                      {checkoutLoading ? "Procesando…" : "Pagar con Tarjeta"}
                    </span>
                    <img src="/images/cc-logos.png" alt="" className="h-5" />
                  </button>
                )}
                {athMovilEnabled && (
                  <button
                    type="button"
                    onClick={() => void handlePayATH()}
                    disabled={checkoutLoading || (orderType === "delivery" && !pinConfirmed)}
                    className="w-full flex items-center justify-center p-4 border-2 border-[#F58220] rounded-lg hover:bg-orange-50 disabled:opacity-50"
                  >
                    <img src="/images/ath-movil-logo.png" alt="ATH Móvil" className="h-7" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {showStripe && stripeClientSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden max-h-[95vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-lg" style={{ color: primaryColor }}>
                Pago Seguro
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowStripe(false)
                  setStripeClientSecret(null)
                }}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Cerrar
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  clientSecret: stripeClientSecret,
                  onComplete: () => {
                    try {
                      sessionStorage.removeItem("pendingCateringCart")
                      sessionStorage.removeItem("pendingCateringBranch")
                    } catch {
                      /* ignore */
                    }
                    const sid = stripeSessionId
                    setShowStripe(false)
                    setStripeClientSecret(null)
                    if (sid) {
                      window.location.href = `/catering/order-confirmation?session_id=${encodeURIComponent(sid)}`
                    }
                  },
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </div>
        </div>
      )}

      {showATHMovil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-8 text-center shadow-2xl">
            <img src="/images/ath-movil-logo.png" alt="ATH Móvil" className="h-12 mx-auto mb-6" />
            <h2 className="text-xl font-bold mb-2" style={{ color: primaryColor }}>
              Completar Pago en ATH Móvil
            </h2>
            <p className="text-slate-500 mb-6">
              Abre tu app de ATH Móvil y aprueba el pago de{" "}
              <span className="font-bold" style={{ color: primaryColor }}>
                ${total.toFixed(2)}
              </span>
            </p>
            {athMovilPolling && (
              <div className="flex items-center justify-center gap-3 text-slate-400 mb-6">
                <div
                  className="w-5 h-5 border-2 border-slate-200 rounded-full animate-spin"
                  style={{ borderTopColor: primaryColor }}
                />
                <span className="text-sm">Esperando confirmación…</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setShowATHMovil(false)
                setAthMovilPolling(false)
              }}
              className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
