"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp,
  ShoppingCart,
  Clock,
  Gift,
  CreditCard,
  Banknote,
  User,
  Mail,
  Building,
  Pencil
} from "lucide-react"
import { AddressAutocomplete, type AddressComponents } from "./address-autocomplete"
import { DeliveryPinConfirm } from "./delivery-pin-confirm"
import { LocateMeButton } from "./locate-me-button"
import { calculateDeliveryFee } from "@/app/actions/delivery-zones"
import StripeCheckout from "./stripe-checkout"
import ATHMovilCheckout from "./athmovil-checkout"

interface CheckoutClientProps {
  restaurant: any
}

// Round tip to nearest $0.05 for accurate display
function roundTip(amount: number): number {
  return Math.round(amount * 20) / 20
}

// Build the 4 tip percentage presets (mirrors Catering: 10/12/15/18 by default)
// Restaurant columns store whole percentages (e.g. 10, 12, 15, 18).
function getTipPercents(
  tipOption1: number | null | undefined,
  tipOption2: number | null | undefined,
  tipOption3: number | null | undefined,
  tipOption4: number | null | undefined,
): number[] {
  // Legacy rows may have stored decimal values (0.15); normalize to whole percentages.
  const normalizePercent = (val: number | null | undefined, fallback: number): number => {
    if (val == null || val === 0) return fallback
    return val < 1 ? val * 100 : val
  }
  return [
    normalizePercent(tipOption1, 10),
    normalizePercent(tipOption2, 12),
    normalizePercent(tipOption3, 15),
    normalizePercent(tipOption4, 18),
  ]
}

export function CheckoutClient({ restaurant }: CheckoutClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const primaryColor = restaurant.primary_color || "#e11d48"
  
  // Auth state
  const [user, setUser] = useState<any>(null)
  const [customer, setCustomer] = useState<any>(null)
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([])
  
  // Cart state (from localStorage)
  const [cart, setCart] = useState<any[]>([])
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("delivery")
  
  // Form state
  const [contactInfo, setContactInfo] = useState({
    fullName: "",
    email: "",
    phone: "",
    company: "",
  })
  
  const [deliveryInfo, setDeliveryInfo] = useState<{
    streetAddress: string
    streetAddress2: string
    city: string
    state: string
    zip: string
    instructions: string
    latitude: number | null
    longitude: number | null
  }>({
    streetAddress: "",
    streetAddress2: "",
    city: "",
    state: "PR",
    zip: "",
    instructions: "",
    latitude: null,
    longitude: null,
  })
  
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split("T")[0])
  const [deliveryTime, setDeliveryTime] = useState("") // Empty = "Lo antes posible"
  const [showPreOrderOptions, setShowPreOrderOptions] = useState(false) // Toggle for pre-order date/time picker
  
  // Tip state - use index to avoid duplicate value selection issues
  const [selectedTipIndex, setSelectedTipIndex] = useState<number | null>(null)
  const [customTip, setCustomTip] = useState("")
  const [showCustomTip, setShowCustomTip] = useState(false)
  
  // UI state
  const [showOrderSummary, setShowOrderSummary] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCalculatingFee, setIsCalculatingFee] = useState(false)
  
  // Payment checkout dialogs
  const [showStripeCheckout, setShowStripeCheckout] = useState(false)
  const [showATHMovilCheckout, setShowATHMovilCheckout] = useState(false)
  const [checkoutData, setCheckoutData] = useState<any>(null)
  
  // Delivery fee calculation result (like customer-portal)
  const [deliveryFeeCalculation, setDeliveryFeeCalculation] = useState({
    fee: 0,
    displayedFee: 0,
    subsidy: 0,
    distance: 0,
    zoneName: "",
  })

  // Pin-confirmation gate (geocoding Phase 4b).
  // addressConfidence "low" = picked place missing rooftop-accurate fix; the
  // customer MUST confirm the pin on the map before the pay CTA unlocks.
  // pinConfirmed resets to false on every new address selection.
  const [addressConfidence, setAddressConfidence] = useState<"high" | "low">("high")
  const [pinConfirmed, setPinConfirmed] = useState(false)

  // Load cart and user data on mount
  useEffect(() => {
    // Load cart from localStorage
    const savedCart = localStorage.getItem(`cart_${restaurant.id}`)
    if (savedCart) {
      const parsed = JSON.parse(savedCart)
      setCart(parsed.items || [])
      setDeliveryMethod(parsed.deliveryMethod || "delivery")
    } else {
      // No cart, redirect back
      router.push(`/${restaurant.slug}`)
    }
    
    // Check auth
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        // Get customer record
        const { data: customerData } = await supabase
          .from("customers")
          .select("*")
          .eq("auth_user_id", user.id)
          .single()
        
        if (customerData) {
          setCustomer(customerData)
          // The customers table stores first_name / last_name (not full_name).
          // Compose a full display name, falling back to auth metadata for legacy rows.
          const composedName =
            [customerData.first_name, customerData.last_name]
              .filter(Boolean)
              .join(" ")
              .trim() ||
            user.user_metadata?.full_name ||
            ""
          setContactInfo({
            fullName: composedName,
            email: user.email || "",
            phone: customerData.phone || "",
            company: customerData.company_name || "",
          })
          
          // Get saved addresses
          const { data: addresses } = await supabase
            .from("customer_addresses")
            .select("*")
            .eq("customer_id", customerData.id)
            .order("is_default", { ascending: false })
          
          if (addresses && addresses.length > 0) {
            setCustomerAddresses(addresses)
            // Auto-select default address. Route through handleSelectAddress so
            // we carry verified_latitude/longitude over (previously dropped here,
            // which is why the Step 3 pin-confirm never appeared on auto-select)
            // AND so rows without coords trigger the /api/address/validate
            // geocode fallback to back-fill lat/lng before Step 3 renders.
            const defaultAddr = addresses.find(a => a.is_default) || addresses[0]
            if (defaultAddr) {
              handleSelectAddress(defaultAddr)
            }
          }
        }
      }
    }
    
    checkAuth()
  }, [restaurant.id, restaurant.slug, router, supabase])

  // Calculate totals
  const subtotal = useMemo(() => {
    return cart.filter(item => item.type !== "delivery_fee")
      .reduce((sum, item) => sum + (item.totalPrice || item.basePrice || 0), 0)
  }, [cart])

  const taxRate = restaurant.tax_rate || 0.115
  const taxAmount = subtotal * taxRate
  
  // 4 percentage presets (parity with Catering)
  const tipPercentOptions = useMemo(() => getTipPercents(
    restaurant.tip_option_1,
    restaurant.tip_option_2,
    restaurant.tip_option_3,
    restaurant.tip_option_4,
  ), [restaurant.tip_option_1, restaurant.tip_option_2, restaurant.tip_option_3, restaurant.tip_option_4])
  // Dollar amounts derived from subtotal × percent, rounded to nearest $0.05
  const tipPresets = useMemo(
    () => tipPercentOptions.map(pct => roundTip(subtotal * (pct / 100))),
    [subtotal, tipPercentOptions],
  )
  const tipAmount = showCustomTip ? Number(customTip || 0) : (selectedTipIndex !== null ? tipPresets[selectedTipIndex] || 0 : 0)
  
  // Calculate dispatch fee (platform fee = % of subtotal + delivery subsidy)
  const dispatchFeePercent = deliveryMethod === "delivery" ? Number((restaurant as any).dispatch_fee_percent || 0) : 0
  const hasCalculatedFee = deliveryFeeCalculation.distance > 0 || deliveryFeeCalculation.zoneName !== ""
  const deliverySubsidy = deliveryMethod === "delivery" && hasCalculatedFee
    ? Math.max(0, deliveryFeeCalculation.fee - deliveryFeeCalculation.displayedFee)
    : 0
  const dispatchFee = dispatchFeePercent > 0
    ? Math.ceil(((subtotal * dispatchFeePercent / 100) + deliverySubsidy) / 0.05) * 0.05
    : 0
  
  const total = subtotal + (deliveryMethod === "delivery" ? deliveryFeeCalculation.displayedFee + dispatchFee : 0) + taxAmount + tipAmount

// Auto-select the operator-configured default tip on mount. Mirrors
// catering: restaurants.default_tip_option is 1-based (1..4), so we
// subtract 1 to get the preset index. Legacy rows with a null value
// fall back to index 2 (Option 3) - the hardcoded default shipped
// before the dropdown existed.
  useEffect(() => {
  if (tipPercentOptions.length >= 3 && selectedTipIndex === null && !showCustomTip) {
    const raw = (restaurant as any).default_tip_option
    const idx = typeof raw === "number" && raw >= 1 && raw <= 4 ? raw - 1 : 2
    setSelectedTipIndex(idx)
  }
  }, [tipPercentOptions, selectedTipIndex, showCustomTip, restaurant])

  // Calculate delivery fee when address changes
  const handleCalculateDeliveryFee = async (addressData: typeof deliveryInfo) => {
    if (deliveryMethod !== "delivery" || !addressData.streetAddress || !addressData.city) {
      return
    }
    
    setIsCalculatingFee(true)
    const deliveryAddress = `${addressData.streetAddress}, ${addressData.city}, ${addressData.state} ${addressData.zip}`
    const itemCount = cart.filter((item) => item.type !== "delivery_fee").length
    
    
    
    try {
      const result = await calculateDeliveryFee({
        restaurantId: restaurant.id,
        deliveryAddress,
        restaurantAddress: restaurant.restaurant_address || "",
        itemCount,
        // Pin coords from the confirmed-pin UI. When present the
        // server uses Haversine against the restaurant lat/lng and
        // bypasses the Routes-API typed-address geocode entirely.
        customerLat: typeof addressData.latitude === "number" ? addressData.latitude : undefined,
        customerLng: typeof addressData.longitude === "number" ? addressData.longitude : undefined,
      })
      
      if (result.success) {
        setDeliveryFeeCalculation({
          fee: result.fee,
          displayedFee: result.displayedFee,
          subsidy: result.subsidy,
          distance: result.distance,
          zoneName: result.zoneName,
        })
      }
    } catch (error) {
      console.error("[v0] Error calculating delivery fee:", error)
    } finally {
      setIsCalculatingFee(false)
    }
  }

  // Calculate delivery fee when address is auto-populated on page load,
  // and again whenever the confirmed pin moves - dragging the pin is
  // the signal that the customer is correcting a sloppy geocode, and
  // the fee should follow.
  useEffect(() => {
    if (deliveryMethod === "delivery" && deliveryInfo.streetAddress && deliveryInfo.city && deliveryInfo.zip) {
      handleCalculateDeliveryFee(deliveryInfo)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryInfo.streetAddress, deliveryInfo.city, deliveryInfo.zip, deliveryInfo.latitude, deliveryInfo.longitude, deliveryMethod])

  // Handle address selection
  const handleSelectAddress = async (address: any) => {
    const hasCoords =
      (typeof address.verified_latitude === "number" && typeof address.verified_longitude === "number") ||
      (typeof address.latitude === "number" && typeof address.longitude === "number")

    const newInfo = {
      streetAddress: address.address_line_1,
      streetAddress2: address.address_line_2 || "",
      city: address.city,
      state: address.state || "PR",
      zip: address.postal_code || "",
      instructions: address.delivery_instructions || "",
      latitude: typeof address.verified_latitude === "number" ? address.verified_latitude : typeof address.latitude === "number" ? address.latitude : null,
      longitude: typeof address.verified_longitude === "number" ? address.verified_longitude : typeof address.longitude === "number" ? address.longitude : null,
    }
    setDeliveryInfo(newInfo)
    // Selecting a saved address is a new context — force an explicit
    // pin confirmation before payment unlocks. If the saved row already
    // has verified coords we trust the geocode (high confidence),
    // otherwise fall back to low-confidence mode which forces the
    // bigger map + street view to help the customer verify manually.
    setAddressConfidence(hasCoords ? "high" : "low")
    setPinConfirmed(false)
    // Trigger delivery fee calculation
    handleCalculateDeliveryFee(newInfo)

    // If the saved row has no coords (legacy rows or rows that came in
    // before coord capture landed), back-fill via /api/address/validate
    // so the Step 3 pin confirm map can render. Without this, Step 3
    // never appears and the payment buttons stay grayed forever.
    if (!hasCoords && newInfo.streetAddress && newInfo.zip) {
      try {
        const res = await fetch("/api/address/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addressLines: [newInfo.streetAddress],
            locality: newInfo.city,
            administrativeArea: newInfo.state,
            postalCode: newInfo.zip,
            regionCode: "US",
          }),
        })
        if (res.ok) {
          const v = await res.json()
          const lat = v?.canonical?.latitude
          const lng = v?.canonical?.longitude
          if (typeof lat === "number" && typeof lng === "number") {
            const nextInfo = { ...newInfo, latitude: lat, longitude: lng }
            setDeliveryInfo(nextInfo)
            // Re-run delivery fee calc now that we have real coords.
            handleCalculateDeliveryFee(nextInfo)
          }
        }
      } catch {
        // Non-fatal — user can still edit the address manually, and
        // the Ubicarme / autocomplete paths will populate coords.
      }
    }
  }

  const handleBack = () => {
    router.push(`/${restaurant.slug}?cart=open`)
  }

  // Prepare checkout data for payment processing
  const prepareCheckoutData = () => {
    const orderData = {
      restaurantId: restaurant.id,
      branchId: (restaurant as any).default_branch_id || null,
      userId: user?.id || null,
      customerEmail: contactInfo.email,
      customerPhone: contactInfo.phone,
      orderType: deliveryMethod,
      restaurantName: restaurant.name,
      stripeAccountId: (restaurant as any).stripe_account_id || null,
      athmovilPublicToken: (restaurant as any).athmovil_public_token || null,
      athmovilEcommerceId: (restaurant as any).athmovil_ecommerce_id || null,
      paymentProvider: (restaurant as any).payment_provider || "stripe",
      cart: cart.map((item) => ({
        ...item,
        menu_item_id: item.id,
        item_name: item.name,
        unit_price: item.basePrice || item.price || 0,
        total_price: item.totalPrice || item.basePrice || 0,
        selected_options: item.selectedOptions || {},
      })),
      subtotal,
      tax: taxAmount,
      tip: tipAmount,
      deliveryFee: deliveryFeeCalculation.displayedFee,
      dispatchFee,
      total,
      eventDetails: deliveryMethod === "delivery" ? {
        name: contactInfo.fullName,
        address: deliveryInfo.streetAddress,
        addressLine2: deliveryInfo.streetAddress2,
        city: deliveryInfo.city,
        state: deliveryInfo.state,
        zip: deliveryInfo.zip,
        zipCode: deliveryInfo.zip,
        deliveryInstructions: deliveryInfo.instructions,
        deliveryLatitude: deliveryInfo.latitude,
        deliveryLongitude: deliveryInfo.longitude,
        eventDate: deliveryDate,
        eventTime: deliveryTime || null,
      } : {
        name: contactInfo.fullName,
        eventDate: deliveryDate,
        eventTime: deliveryTime || null,
      },
    }
    setCheckoutData(orderData)
    return orderData
  }

  // Handle payment button clicks
  const handlePayWithCard = () => {
    if (!validateForm()) return
    prepareCheckoutData()
    setShowStripeCheckout(true)
  }

  const handlePayWithATH = () => {
    if (!validateForm()) return
    prepareCheckoutData()
    setShowATHMovilCheckout(true)
  }

  const handlePayWithCash = async () => {
    if (!validateForm()) return
    setIsSubmitting(true)
    const orderData = prepareCheckoutData()
    
    try {
      // Import and use the cash order creation action
      const { createCashOrder } = await import("@/app/actions/orders")
      const result = await createCashOrder(orderData)
      
      if (result.success) {
        // Clear cart and redirect to confirmation
        localStorage.removeItem(`cart_${restaurant.id}`)
        router.push(`/${restaurant.slug}/order-confirmation?orderId=${result.orderId}`)
      } else {
        alert(result.error || "Error al procesar el pedido")
      }
    } catch (error: any) {
      alert(error.message || "Error al procesar el pedido")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Validate form before payment
  const validateForm = () => {
    if (!contactInfo.fullName || !contactInfo.email || !contactInfo.phone) {
      alert("Por favor completa tu información de contacto")
      return false
    }
    if (deliveryMethod === "delivery") {
      if (!deliveryInfo.streetAddress || !deliveryInfo.city || !deliveryInfo.zip) {
        alert("Por favor completa tu dirección de entrega")
        return false
      }
      if (deliveryInfo.zip.length !== 5) {
        alert("Por favor ingresa un código postal válido de 5 dígitos")
        return false
      }
      // v5: every delivery order must have a pin-confirmed location,
      // regardless of geocoder confidence. This is the commitment gesture.
      if (!pinConfirmed) {
        alert("Confirma tu ubicación exacta en el mapa antes de continuar")
        return false
      }
    }
    if (cart.length === 0) {
      alert("Tu carrito está vacío")
      return false
    }
    return true
  }

  // Handle successful payment
  const handlePaymentSuccess = () => {
    setShowStripeCheckout(false)
    setShowATHMovilCheckout(false)
    // Clear cart
    localStorage.removeItem(`cart_${restaurant.id}`)
    setCart([])
    // Redirect to confirmation
    router.push(`/${restaurant.slug}/order-confirmation`)
  }

  // Check if restaurant offers both delivery and pickup
  // Only show toggle if BOTH are explicitly true
  const offersDelivery = restaurant.offers_delivery === true
  const offersPickup = restaurant.offers_pickup === true
  const showDeliveryToggle = offersDelivery && offersPickup

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation - FoodNet PR Branding */}
      <header className="sticky top-0 z-50 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Menú
          </button>
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/foodnetpr-logo.png"
              alt="FoodNet PR"
              width={150}
              height={50}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>
          <div className="w-24" /> {/* Spacer */}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column - Forms */}
          <div className="flex-1 space-y-6">
            {/* Section 1: Account Details */}
            <section className="border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-3" style={{ backgroundColor: primaryColor }}>
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <span className="w-6 h-6 rounded-full text-sm flex items-center justify-center bg-white" style={{ color: primaryColor }}>1</span>
                  Información de Contacto
                </h2>
                {user && (
                  <div className="text-right">
                    <span className="text-sm text-white/90">{user.email}</span>
                    <div className="flex items-center justify-end gap-2 mt-0.5">
                      <button
                        onClick={() => router.push(`/account`)}
                        className="text-xs text-white/80 hover:text-white underline"
                      >
                        Mi Cuenta
                      </button>
                      <span className="text-xs text-white/50">·</span>
                      <button
                        onClick={async () => {
                          const { createClient } = await import("@/lib/supabase/client")
                          const supabase = createClient()
                          await supabase.auth.signOut()
                          router.push(`/${restaurant.slug}/customer-auth?mode=login&redirect=checkout`)
                        }}
                        className="text-xs text-white/80 hover:text-white underline"
                      >
                        Usar otra cuenta
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6">
              {!user ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Inicia sesión para un checkout más rápido</p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => router.push(`/${restaurant.slug}/customer-auth?mode=login&redirect=checkout`)}
                      style={{ backgroundColor: primaryColor }}
                      className="text-white"
                    >
                      Iniciar Sesión
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/${restaurant.slug}/customer-auth?mode=signup&redirect=checkout`)}
                    >
                      Crear Cuenta
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <Label>Nombre Completo *</Label>
                      <Input
                        value={contactInfo.fullName}
                        onChange={(e) => setContactInfo({ ...contactInfo, fullName: e.target.value })}
                        placeholder="Tu nombre"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Correo Electrónico *</Label>
                      <Input
                        type="email"
                        value={contactInfo.email}
                        onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                        placeholder="tu@email.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Teléfono *</Label>
                      <Input
                        type="tel"
                        value={contactInfo.phone}
                        onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                        placeholder="(787) 000-0000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Compañía (Opcional)</Label>
                      <Input
                        value={contactInfo.company}
                        onChange={(e) => setContactInfo({ ...contactInfo, company: e.target.value })}
                        placeholder="Nombre de empresa"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500 text-xs">Nombre</Label>
                    <p className="font-medium">{contactInfo.fullName || "No configurado"}</p>
                  </div>
                  <div>
<Label className="text-slate-500 text-xs">Teléfono *</Label>
  <Input
  type="tel"
  value={contactInfo.phone}
  onChange={(e) => setContactInfo(prev => ({ ...prev, phone: e.target.value }))}
  placeholder="(787) 000-0000"
  className="h-8 text-sm"
  required
  />
                  </div>
                </div>
              )}
              </div>
            </section>

            {/* Section 2: Shipping/Delivery Details */}
            <section className="border rounded-xl overflow-hidden">
              <div className="px-6 py-3" style={{ backgroundColor: primaryColor }}>
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <span className="w-6 h-6 rounded-full text-sm flex items-center justify-center bg-white" style={{ color: primaryColor }}>2</span>
                  {deliveryMethod === "delivery" ? "Detalles de Entrega" : "Detalles de Pickup"}
                </h2>
              </div>
              <div className="p-6">

              {/* Delivery/Pickup Toggle - Only show if restaurant offers both */}
              {showDeliveryToggle && (
                <div className="flex bg-slate-100 rounded-full p-1 w-fit mb-6">
                  <button
                    onClick={() => setDeliveryMethod("delivery")}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                      deliveryMethod === "delivery" 
                        ? "bg-slate-900 text-white" 
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Delivery
                  </button>
                  <button
                    onClick={() => setDeliveryMethod("pickup")}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                      deliveryMethod === "pickup" 
                        ? "bg-slate-900 text-white" 
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Pickup
                  </button>
                </div>
              )}

              {deliveryMethod === "delivery" && (
                <>
                  {/* Saved Addresses */}
                  {customerAddresses.length > 0 && (
                    <div className="mb-6">
                      <Label className="text-sm font-medium mb-2 block">Direcciones Guardadas</Label>
                      <div className="space-y-2">
                        {customerAddresses.map((addr) => (
                          <button
                            key={addr.id}
                            onClick={() => handleSelectAddress(addr)}
                            className={`w-full flex items-start gap-3 p-3 border rounded-lg text-left transition-colors ${
                              deliveryInfo.streetAddress === addr.address_line_1
                                ? "border-slate-900 bg-slate-50"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div className="mt-0.5">
                              {deliveryInfo.streetAddress === addr.address_line_1 ? (
                                <div className="w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center">
                                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{addr.address_line_1}</p>
                              <p className="text-sm text-slate-500">
                                {addr.city}, {addr.state} {addr.postal_code}
                              </p>
                            </div>
                            <Pencil className="w-4 h-4 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Address Form */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label>Dirección *</Label>
                        <LocateMeButton
                          onLocated={(lat, lng) => {
                            setDeliveryInfo(prev => ({ ...prev, latitude: lat, longitude: lng }))
                            setPinConfirmed(true)
                          }}
                          onAddressResolved={(addr) => {
                            // Ubicarme is an explicit user action — populate whatever
                            // came back, even without a house number. The pin on the
                            // map shows exactly where they are, so they can type the
                            // street number by hand if Google didn't know it.
                            const c = addr.components || {}
                            const nextStreet = addr.streetAddress || c.route || ""
                            setDeliveryInfo(prev => ({
                              ...prev,
                              streetAddress: nextStreet || prev.streetAddress,
                              city: c.city || prev.city,
                              state: c.state || prev.state || "PR",
                              zip: c.postalCode || prev.zip,
                            }))
                            // Only promote to high confidence when we got a full rooftop hit.
                            if (c.streetNumber && c.route) {
                              setAddressConfidence("high")
                            }
                          }}
                        />
                      </div>
                      <AddressAutocomplete
                        value={deliveryInfo.streetAddress}
                        onChange={(val) => setDeliveryInfo(prev => ({ ...prev, streetAddress: val }))}
                        onAddressSelected={(components: AddressComponents) => {
                          // IMPORTANT: Always use the new address data, never preserve old values
                          // This prevents sending deliveries to wrong locations
                          const newInfo = {
                            streetAddress: components.streetAddress || "",
                            streetAddress2: "", // Clear line 2 for new address
                            city: components.city || "",
                            state: components.state || "PR",
                            zip: components.zip || "", // Clear if not provided - user must enter manually
                            instructions: deliveryInfo.instructions, // Keep delivery instructions
                            latitude: typeof components.latitude === "number" ? components.latitude : null,
                            longitude: typeof components.longitude === "number" ? components.longitude : null,
                          }
                          setDeliveryInfo(newInfo)
                          // Capture confidence for the pin gate. Fresh address =>
                          // reset confirmation so low-confidence picks force a
                          // new explicit pin confirmation before checkout.
                          setAddressConfidence(components.confidence === "low" ? "low" : "high")
                          setPinConfirmed(false)
                          // Only calculate delivery if we have complete address with ZIP
                          if (newInfo.zip && newInfo.streetAddress && newInfo.city) {
                            handleCalculateDeliveryFee(newInfo)
                          }
                        }}
                        placeholder="Ingresa tu dirección"
                        className="mt-1"
                      />
                    </div>
                    {/* Línea 2 — opt-in secondary autocomplete so the
                        customer can search by building/condo name (e.g.
                        "Condominio Altomonte"). Guardrail A: suggestions
                        are suppressed when Línea 1 already has content,
                        so an accidental POI pick can’t overwrite a good
                        street address. */}
                    <div>
                      <Label>Dirección Línea 2</Label>
                      <AddressAutocomplete
                        value={deliveryInfo.streetAddress2}
                        onChange={(val) => setDeliveryInfo(prev => ({ ...prev, streetAddress2: val }))}
                        onAddressSelected={(components: AddressComponents) => {
                          const newInfo = {
                            streetAddress: components.streetAddress || "",
                            streetAddress2: "",
                            city: components.city || "",
                            state: components.state || "PR",
                            zip: components.zip || "",
                            instructions: deliveryInfo.instructions,
                            latitude: typeof components.latitude === "number" ? components.latitude : null,
                            longitude: typeof components.longitude === "number" ? components.longitude : null,
                          }
                          setDeliveryInfo(newInfo)
                          setAddressConfidence(components.confidence === "low" ? "low" : "high")
                          setPinConfirmed(false)
                          if (newInfo.zip && newInfo.streetAddress && newInfo.city) {
                            handleCalculateDeliveryFee(newInfo)
                          }
                        }}
                        placeholder="Apt, Suite, Urb, Edificio, Piso, etc."
                        className="mt-1"
                        secondarySearch
                        suppressPredictions={!!deliveryInfo.streetAddress}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Ciudad *</Label>
                        <Input
                          value={deliveryInfo.city}
                          onChange={(e) => setDeliveryInfo(prev => ({ ...prev, city: e.target.value }))}
                          onBlur={() => {
                            // Recalculate delivery fee when city is filled
                            if (deliveryInfo.city && deliveryInfo.streetAddress && deliveryInfo.zip.length === 5) {
                              handleCalculateDeliveryFee(deliveryInfo)
                            }
                          }}
                          placeholder="San Juan"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Estado</Label>
                        <div className="mt-1 px-3 py-2 border rounded-md bg-slate-50 text-sm">PR</div>
                      </div>
                      <div>
                        <Label>ZIP *</Label>
                        <Input
                          value={deliveryInfo.zip}
                          onChange={(e) => {
                            const newZip = e.target.value.replace(/\D/g, "").slice(0, 5)
                            setDeliveryInfo(prev => ({ ...prev, zip: newZip }))
                          }}
                          onBlur={() => {
                            // Recalculate delivery fee when ZIP is filled
                            if (deliveryInfo.zip.length === 5 && deliveryInfo.streetAddress && deliveryInfo.city) {
                              handleCalculateDeliveryFee(deliveryInfo)
                            }
                          }}
                          placeholder="00000"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Instrucciones de Entrega</Label>
                      <Input
                        value={deliveryInfo.instructions}
                        onChange={(e) => setDeliveryInfo({ ...deliveryInfo, instructions: e.target.value })}
                        placeholder="Código de acceso, dejar en puerta, etc."
                        className="mt-1"
                      />
                    </div>
                    {typeof deliveryInfo.latitude === "number" && typeof deliveryInfo.longitude === "number" && (
                      <>
                        {/* Step 3: Pin confirmation — surfaces the confirm gate as its own numbered step so customers don't miss it (task #38) */}
                        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-white mt-4" style={{ backgroundColor: primaryColor }}>
                          <span className="w-6 h-6 rounded-full text-sm flex items-center justify-center bg-white" style={{ color: primaryColor }}>3</span>
                          <h2 className="text-lg font-bold">Confirma tu Ubicación</h2>
                        </div>
                      <DeliveryPinConfirm
                        latitude={deliveryInfo.latitude}
                        longitude={deliveryInfo.longitude}
                        onChange={(lat, lng) => {
                          setDeliveryInfo(prev => ({ ...prev, latitude: lat, longitude: lng }))
                          // v5: never auto-confirm on drag, even in
                          // high-confidence mode. The customer must
                          // click 'Confirmar ubicacion' to commit.
                        }}
                        confidence={addressConfidence}
                        onConfirm={() => setPinConfirmed(true)}
                        onUnconfirm={() => setPinConfirmed(false)}
                        confirmed={pinConfirmed}
                        onAddressResolved={(addr) => {
                          // In low-confidence mode the pin is the source of truth -
                          // whatever address the customer typed only applied to the
                          // original geocode. Once they drag, update the text to
                          // match the new pin so it never drifts into misleading
                          // state (e.g. "Parque San Ignacio" while pin sits on a
                          // gas station a mile away).
                          // Prefer streetNumber+route, fall back to route alone,
                          // then to the first segment of formattedAddress so
                          // business/landmark hits (Texaco, Teppanyaki 2 Go) still
                          // produce a readable label.
                          const c = addr.components || {}
                          const newStreet =
                            addr.streetAddress ||
                            (addr.formattedAddress || "").split(",")[0].trim()
                          if (newStreet) {
                            setDeliveryInfo(prev => ({
                              ...prev,
                              streetAddress: newStreet,
                              city: c.city || prev.city,
                              state: c.state || prev.state || "PR",
                              zip: c.postalCode || prev.zip,
                            }))
                          }
                        }}
                      />
                      </>
                    )}
                  </div>
                </>
              )}

              {deliveryMethod === "pickup" && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-slate-500 mt-0.5" />
                    <div>
                      <p className="font-medium">{restaurant.name}</p>
                      <p className="text-sm text-slate-500">{restaurant.address}</p>
                      <p className="text-sm text-slate-500">{restaurant.city}, PR {restaurant.zip_code}</p>
                    </div>
                  </div>
                </div>
              )}

  {/* Pre-Order Option - Show link by default, expand when clicked */}
  <div className="mt-6 pt-6 border-t">
  {!showPreOrderOptions ? (
    <button
      type="button"
      onClick={() => setShowPreOrderOptions(true)}
      className="flex items-center gap-2 text-sm hover:underline"
      style={{ color: primaryColor }}
    >
      <Clock className="w-4 h-4" />
      Programar {deliveryMethod === "delivery" ? "entrega" : "pickup"} para después
    </button>
  ) : (
    <>
      <div className="flex items-center justify-between mb-2">
        <Label className="font-medium">
          {deliveryMethod === "delivery" ? "Fecha de Entrega" : "Fecha de Pickup"}
        </Label>
        <button
          type="button"
          onClick={() => {
            setShowPreOrderOptions(false)
            setDeliveryTime("") // Reset to "order now"
            setDeliveryDate(new Date().toISOString().split("T")[0]) // Reset to today
          }}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Cancelar
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
          />
        </div>
        <div>
          <select
            value={deliveryTime}
            onChange={(e) => setDeliveryTime(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background text-sm"
          >
            <option value="">Selecciona hora</option>
            {Array.from({ length: 20 }, (_, i) => {
              const hour = Math.floor(i / 2) + 11
              const min = (i % 2) * 30
              const time = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`
              const displayHour = hour > 12 ? hour - 12 : hour
              const ampm = hour >= 12 ? "PM" : "AM"
              return (
                <option key={time} value={time}>
                  {displayHour}:{min.toString().padStart(2, "0")} {ampm}
                </option>
              )
            })}
          </select>
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Selecciona fecha y hora para programar tu orden.
      </p>
    </>
  )}
  </div>
              </div>
            </section>

            {/* Mobile Order Summary Section - Hidden on large screens since it's in sidebar */}
            <section className="space-y-4 lg:hidden">
              {/* Restaurant Info */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                {restaurant.logo_url && (
                  <Image
                    src={restaurant.logo_url}
                    alt={restaurant.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">Tu orden de</p>
                  <p className="font-bold truncate">{restaurant.name}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>

              {/* Collapsible Order Summary */}
              <div className="border rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowOrderSummary(!showOrderSummary)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    <span className="font-medium">Resumen del Pedido ({cart.length} {cart.length === 1 ? "item" : "items"})</span>
                  </div>
                  {showOrderSummary ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                
                {showOrderSummary && (
                  <div className="px-4 pb-4 border-t">
                    <div className="py-3 space-y-3">
                      {cart.filter(item => item.type !== "delivery_fee").map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          {item.image_url && (
                            <Image
                              src={item.image_url}
                              alt={item.name}
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-slate-500">Cant: {item.quantity || 1}</p>
                          </div>
                          <p className="font-medium text-sm">
                            ${(item.totalPrice || item.basePrice || 0).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Payment Buttons (Step 3 is pin confirm — see DeliveryPinConfirm in Section 2) */}
              <div className="border rounded-xl p-6">
                <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-sm flex items-center justify-center">4</span>
                  Procesar tu Orden
                </h2>
                
                <div className="space-y-3">
                  {/* Credit Card */}
                  <button
                    onClick={handlePayWithCard}
                    disabled={isSubmitting || (deliveryMethod === "delivery" && !pinConfirmed)}
                    className="w-full flex items-center justify-between p-4 border-2 border-[#635BFF] rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-[#635BFF]" />
                      <span className="font-medium text-[#635BFF]">Pagar con Tarjeta</span>
                    </div>
                    <img 
                      src="/images/cc-logos.png" 
                      alt="Cards" 
                      className="h-5"
                    />
                  </button>

                  {/* ATH Movil */}
                  <button
                    onClick={handlePayWithATH}
                    disabled={isSubmitting || (deliveryMethod === "delivery" && !pinConfirmed)}
                    className="w-full flex items-center justify-center p-4 border-2 border-[#F58220] rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                  >
                    <img 
                      src="/images/ath-movil-logo.png" 
                      alt="ATH Móvil" 
                      className="h-7"
                    />
                  </button>

                  {/* Cash */}
                  {restaurant.cash_payment_enabled && (
                    <button
                      onClick={handlePayWithCash}
                      disabled={isSubmitting || (deliveryMethod === "delivery" && !pinConfirmed)}
                      className="w-full flex items-center justify-center gap-2 p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <Banknote className="w-5 h-5" />
                      <span className="font-medium">{isSubmitting ? "Procesando..." : "Pagar en Efectivo"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Pricing Breakdown */}
              <div className="border rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {deliveryMethod === "delivery" && (
                  <>
                    <div className="flex justify-between">
                      <span>Delivery</span>
                      <span>{isCalculatingFee ? "..." : !deliveryInfo.streetAddress || !deliveryInfo.zip ? "(Entra la dirección)" : deliveryFeeCalculation.displayedFee > 0 ? `${deliveryFeeCalculation.displayedFee.toFixed(2)}` : "Gratis"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dispatch</span>
                      <span>${dispatchFee.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span>IVU</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Propina</span>
                  <span>${tipAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Tip Selection — 4 % presets + Otro (mirrors Catering) */}
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-2">
                  {tipPercentOptions.map((pct, idx) => (
                    <button
                      key={`mobile-tip-${idx}`}
                      onClick={() => {
                        setSelectedTipIndex(idx)
                        setShowCustomTip(false)
                        setCustomTip("")
                      }}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                        selectedTipIndex === idx && !showCustomTip
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowCustomTip(true)
                      setSelectedTipIndex(null)
                    }}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      showCustomTip
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    Otro
                  </button>
                </div>

                {showCustomTip && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.25"
                      value={customTip}
                      onChange={(e) => setCustomTip(e.target.value)}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="flex justify-between py-3 border-t">
                <span className="font-bold">Total</span>
                <span className="font-bold text-xl">${total.toFixed(2)}</span>
              </div>

              {/* Back to Cart Link */}
              <button
                onClick={handleBack}
                className="w-full text-center text-sm text-slate-500 hover:text-slate-700 py-2 border rounded-lg"
              >
                Volver al Carrito
              </button>
            </section>
          </div>

          {/* Right Column - Sticky Order Summary (hidden on mobile, shown on lg+) */}
          <div className="hidden lg:block lg:w-[380px]">
            <div className="lg:sticky lg:top-20 space-y-4">
              {/* Restaurant Info */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                {restaurant.logo_url && (
                  <Image
                    src={restaurant.logo_url}
                    alt={restaurant.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">Tu orden de</p>
                  <p className="font-bold truncate">{restaurant.name}</p>
                </div>
              </div>

              {/* Step 4: Procesa tu Orden - Only on desktop since mobile has it in main column. Step 3 is pin confirm. */}
              <div className="hidden lg:flex items-center gap-2 rounded-xl px-6 py-3 text-white" style={{ backgroundColor: primaryColor }}>
                <span className="w-6 h-6 rounded-full text-sm flex items-center justify-center bg-white" style={{ color: primaryColor }}>4</span>
                <h2 className="text-lg font-bold">Procesa tu Orden:</h2>
              </div>

              {/* Collapsible Order Summary */}
              <div className="border rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowOrderSummary(!showOrderSummary)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    <span className="font-medium">Resumen del Pedido ({cart.length} {cart.length === 1 ? "item" : "items"})</span>
                  </div>
                  {showOrderSummary ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                
                {showOrderSummary && (
                  <div className="px-4 pb-4 border-t">
                    <div className="py-3 space-y-3">
                      {cart.filter(item => item.type !== "delivery_fee").map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          {item.image_url && (
                            <Image
                              src={item.image_url}
                              alt={item.name}
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-slate-500">Cant: {item.quantity || 1}</p>
                          </div>
                          <p className="font-medium text-sm">
                            ${(item.totalPrice || item.basePrice || 0).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Buttons */}
              <div className="space-y-3">
                {/* Credit Card */}
                <button 
                  onClick={handlePayWithCard}
                  disabled={isSubmitting || (deliveryMethod === "delivery" && !pinConfirmed)}
                  className="w-full flex items-center justify-between p-4 border-2 border-[#635BFF] rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-[#635BFF]" />
                    <span className="font-medium text-[#635BFF]">Pagar con Tarjeta</span>
                  </div>
                  <img src="/images/cc-logos.png" alt="Cards" className="h-5" />
                </button>

                {/* ATH Movil */}
                <button 
                  onClick={handlePayWithATH}
                  disabled={isSubmitting || (deliveryMethod === "delivery" && !pinConfirmed)}
                  className="w-full flex items-center justify-center p-4 border-2 border-[#F58220] rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                >
                  <img src="/images/ath-movil-logo.png" alt="ATH Móvil" className="h-7" />
                </button>

                {/* Cash */}
                {restaurant.cash_payment_enabled && (
                  <button 
                    onClick={handlePayWithCash}
                    disabled={isSubmitting || (deliveryMethod === "delivery" && !pinConfirmed)}
                    className="w-full flex items-center justify-center gap-2 p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Banknote className="w-5 h-5" />
                    <span className="font-medium">{isSubmitting ? "Procesando..." : "Pagar en Efectivo"}</span>
                  </button>
                )}
              </div>

{/* Pricing Breakdown */}
  <div className="border-t pt-4 space-y-2 text-sm">
  <div className="flex justify-between">
  <span>Subtotal</span>
  <span>${subtotal.toFixed(2)}</span>
  </div>
  {deliveryMethod === "delivery" && (
  <>
  <div className="flex justify-between">
  <span>Delivery</span>
  <span>{isCalculatingFee ? "..." : !deliveryInfo.streetAddress || !deliveryInfo.zip ? "(Entra la dirección)" : deliveryFeeCalculation.displayedFee > 0 ? `${deliveryFeeCalculation.displayedFee.toFixed(2)}` : "Gratis"}</span>
  </div>
  <div className="flex justify-between">
  <span>Dispatch</span>
  <span>${dispatchFee.toFixed(2)}</span>
  </div>
  </>
  )}
  <div className="flex justify-between">
  <span>IVU</span>
  <span>${taxAmount.toFixed(2)}</span>
  </div>
  <div className="flex justify-between">
  <span>Propina</span>
  <span>${tipAmount.toFixed(2)}</span>
  </div>
              </div>

              {/* Tip Selection — 4 % presets + Otro (mirrors Catering) */}
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-2">
                  {tipPercentOptions.map((pct, idx) => (
                    <button
                      key={`tip-${idx}`}
                      onClick={() => {
                        setSelectedTipIndex(idx)
                        setShowCustomTip(false)
                        setCustomTip("")
                      }}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                        selectedTipIndex === idx && !showCustomTip
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowCustomTip(true)
                      setSelectedTipIndex(null)
                    }}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      showCustomTip
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    Otro
                  </button>
                </div>
                
                {showCustomTip && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.25"
                      value={customTip}
                      onChange={(e) => setCustomTip(e.target.value)}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="flex justify-between py-3 border-t">
                <span className="font-bold">Total</span>
                <span className="font-bold text-xl">${total.toFixed(2)}</span>
              </div>

              {/* Back to Cart Link */}
              <button
                onClick={handleBack}
                className="w-full text-center text-sm text-slate-500 hover:text-slate-700 py-2 border rounded-lg"
              >
                Volver al Carrito
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Stripe Checkout Dialog */}
      {showStripeCheckout && checkoutData && (
        <StripeCheckout
          orderData={checkoutData}
          onSuccess={handlePaymentSuccess}
          onCancel={() => setShowStripeCheckout(false)}
          stripeAccountId={checkoutData.stripeAccountId}
          restaurantName={restaurant.name}
          primaryColor={primaryColor}
        />
      )}

      {/* ATH Movil Checkout Dialog */}
      {showATHMovilCheckout && checkoutData && (
        <ATHMovilCheckout
          orderData={checkoutData}
          onSuccess={handlePaymentSuccess}
          onCancel={() => setShowATHMovilCheckout(false)}
          publicToken={checkoutData.athmovilPublicToken}
          restaurantName={restaurant.name}
          primaryColor={primaryColor}
        />
      )}
    </div>
  )
}
