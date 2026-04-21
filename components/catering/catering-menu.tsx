"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShoppingCart, X, Plus, Minus, MapPin, ChevronRight, Truck, Store, User, Filter, ChevronDown, Clock, PlusCircle, MinusCircle, Trash2 } from "lucide-react"
import type { CateringRestaurant, CateringCategory, CateringMenuItem, CateringBranch, CateringServicePackage } from "@/lib/catering"
import { cateringTemplateStyles, type CateringDesignTemplate } from "@/components/catering/catering-design-templates"

import { PromotionalPopup } from "@/components/promotional-popup"
import { AddressAutocomplete } from "@/components/address-autocomplete"
import { createClient } from "@/lib/supabase/client"
import { loadStripe } from "@stripe/stripe-js"
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js"
import { createCateringCheckoutSession } from "@/app/actions/catering/stripe"
import { createCateringATHMovilPayment, checkCateringATHMovilStatus, createCateringATHMovilOrder } from "@/app/actions/catering/athmovil"
import { calculateDispatchFee } from "@/lib/catering/dispatch-fee"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { getUnitLabel as getSellingUnitPriceLabel, getQuantityUnitLabel as getSellingQtyUnitLabel } from "@/lib/selling-units"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface CartItem {
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

interface CheckoutForm {
  name: string
  email: string
  phone: string
  eventDate: string
  eventTime: string
  guestCount: string
  orderType: "delivery" | "pickup"
  address: string
  city: string
  state: string
  zip: string
  specialInstructions: string
  tip: number
}

interface CateringMenuProps {
  restaurant: CateringRestaurant
  categories: CateringCategory[]
  menuItems: CateringMenuItem[]
  branches: CateringBranch[]
  servicePackages: CateringServicePackage[]
  selectedBranchId?: string | null
  isCustomDomain?: boolean
}

export default function CateringMenu({
  restaurant,
  categories,
  menuItems,
  branches,
  servicePackages,
  selectedBranchId,
  isCustomDomain = false,
}: CateringMenuProps) {
  // Validate primary_color is set - throw explicit error if null
  if (!restaurant.primary_color) {
    throw new Error(`[CateringMenu] primary_color is null for restaurant: ${restaurant.slug}`)
  }
  const primaryColor = restaurant.primary_color

  // Get design template from restaurant, default to "modern" with warning if missing
  const designTemplate: CateringDesignTemplate = (() => {
    const template = restaurant.design_template as CateringDesignTemplate | null
    if (!template) {
      console.warn("[CateringMenu] design_template is null or missing for restaurant:", restaurant.slug, "- defaulting to 'modern'")
      return "modern"
    }
    if (!cateringTemplateStyles[template]) {
      console.warn("[CateringMenu] Unknown design_template:", template, "for restaurant:", restaurant.slug, "- defaulting to 'modern'")
      return "modern"
    }
    return template
  })()
  const styles = cateringTemplateStyles[designTemplate]

  // Determine if SERVICIOS section should be shown based on restaurant setting
  const showServicesSection = (() => {
    const setting = restaurant.show_service_packages
    if (setting === null || setting === undefined) {
      console.warn("[CateringMenu] show_service_packages is null or undefined for restaurant:", restaurant.slug, "- defaulting to false (hiding SERVICIOS)")
      return false
    }
    return setting === true
  })()

  // JunteReady uses fixed brand colors instead of restaurant primary_color
  const stripeEnabled = (restaurant as any).stripe_enabled !== false
  const athMovilEnabled = !!(restaurant as any).athmovil_enabled && !!(restaurant as any).athmovil_public_token
  const cashEnabled = !!(restaurant as any).cash_payment_enabled
  const selectedBranch = selectedBranchId
    ? branches.find((b) => b.id === selectedBranchId) || null
    : null

  const cartStorageKey = `catering_cart_${restaurant.slug}`
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartLoaded, setCartLoaded] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(cartStorageKey)
      if (saved) {
        setCart(JSON.parse(saved))
      }
    } catch {
      // Storage unavailable
    }
    setCartLoaded(true)
  }, [cartStorageKey])

  // Load auth user on mount (delivery portal pattern)
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    checkAuth()
  }, [supabase])

  // Save cart to localStorage on changes (only after initial load)
  useEffect(() => {
    if (!cartLoaded) return
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cart))
    } catch {
      // Storage unavailable
    }
  }, [cart, cartStorageKey, cartLoaded])

  const goToCheckout = () => {
    // Facebook Pixel: Track InitiateCheckout (catering)
    if (typeof (globalThis as any).fbq !== "undefined") {
      (globalThis as any).fbq("track", "InitiateCheckout")
    }
    const branchForCheckout =
      selectedBranchId || (branches.length === 1 ? branches[0]!.id : null)
    try {
      sessionStorage.setItem("pendingCateringCart", JSON.stringify(cart))
      if (branchForCheckout) {
        sessionStorage.setItem("pendingCateringBranch", branchForCheckout)
      } else {
        sessionStorage.removeItem("pendingCateringBranch")
      }
    } catch {
      /* storage unavailable */
    }
    if (!user) {
      window.location.href = `/catering/${restaurant.slug}/customer-auth?mode=login&redirect=catering-checkout&slug=${restaurant.slug}`
      return
    }
    setShowCart(false)
    const checkoutUrl =
      `/catering/${restaurant.slug}/checkout` +
      (branchForCheckout ? `?branch=${encodeURIComponent(branchForCheckout)}` : "")
    window.location.href = checkoutUrl
  }

  const [selectedItem, setSelectedItem] = useState<CateringMenuItem | null>(null)
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [specialInstructions, setSpecialInstructions] = useState("")
  const [itemModalSpecialOpen, setItemModalSpecialOpen] = useState(false)
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("pickup")
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [showCheckout, setShowCheckout] = useState(false)
  const [showStripe, setShowStripe] = useState(false)
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [orderComplete, setOrderComplete] = useState(false)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    name: "",
    email: "",
    phone: "",
    eventDate: "",
    eventTime: "",
    guestCount: "",
    orderType: "pickup",
    address: "",
    city: "",
    state: "PR",
    zip: "",
    specialInstructions: "",
    tip: 0,
  })

  const [paymentMethod, setPaymentMethod] = useState<"card" | "athmovil" | "cash">("card")
  const [showATHMovil, setShowATHMovil] = useState(false)
  const [athMovilEcommerceId, setAthMovilEcommerceId] = useState<string | null>(null)
  const [athMovilPublicToken, setAthMovilPublicToken] = useState<string | null>(null)
  const [athMovilPolling, setAthMovilPolling] = useState(false)
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({})
  const [activeCategoryNav, setActiveCategoryNav] = useState<string | null>(null)

  const categoryNavScrollSpyKeys = useMemo(
    () =>
      categories
        .filter((c) => c.is_active)
        .sort((a, b) => a.display_order - b.display_order)
        .filter((c) => menuItems.some((item) => item.catering_category_id === c.id))
        .map((c) => c.name),
    [categories, menuItems]
  )

  useEffect(() => {
    const ACT = 140
    const tick = () => {
      let next: string | null = null
      for (const name of categoryNavScrollSpyKeys) {
        const el = categoryRefs.current[name]
        if (!el) continue
        if (el.getBoundingClientRect().top <= ACT) next = name
      }
      if (next === null && categoryNavScrollSpyKeys.length > 0) {
        next = categoryNavScrollSpyKeys[0]!
      }
      setActiveCategoryNav((prev) => (prev === next ? prev : next))
    }
    window.addEventListener("scroll", tick, { passive: true })
    window.addEventListener("resize", tick)
    tick()
    return () => {
      window.removeEventListener("scroll", tick)
      window.removeEventListener("resize", tick)
    }
  }, [categoryNavScrollSpyKeys])

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

// Validate tip configuration - throw visible error if not configured
  if (restaurant.tip_option_1 == null || restaurant.tip_option_2 == null || 
      restaurant.tip_option_3 == null || restaurant.tip_option_4 == null) {
    throw new Error("Tip options not configured for this restaurant")
  }
  if (restaurant.default_tip_option == null) {
    throw new Error("Default tip option not configured for this restaurant")
  }

  // Set default tip based on restaurant config when cart loads
  useEffect(() => {
    if (cartLoaded && cartTotal > 0 && checkoutForm.tip === 0) {
      const defaultOption = restaurant.default_tip_option!
      const tipPercentages = [
        restaurant.tip_option_1!,
        restaurant.tip_option_2!,
        restaurant.tip_option_3!,
        restaurant.tip_option_4!
      ]
      const defaultPct = tipPercentages[defaultOption - 1]
      const defaultTipAmount = Math.round(cartTotal * defaultPct) / 100
      setCheckoutForm((f) => ({ ...f, tip: defaultTipAmount }))
    }
  }, [cartLoaded, cartTotal, restaurant.default_tip_option, restaurant.tip_option_1, restaurant.tip_option_2, restaurant.tip_option_3, restaurant.tip_option_4, checkoutForm.tip])

  // Unit label helper
  const getUnitLabel = (unit: string, qty: number): string => {
    const labels: Record<string, string> = {
      'per_person': qty === 1 ? 'persona' : 'personas',
      'tray': qty === 1 ? 'bandeja' : 'bandejas',
      'half_tray': qty === 1 ? 'media bandeja' : 'medias bandejas',
      'each': qty === 1 ? 'unidad' : 'unidades',
      'per_pound': qty === 1 ? 'libra' : 'libras',
      'box': qty === 1 ? 'caja' : 'cajas',
      'boxed_lunch': qty === 1 ? 'lunch' : 'lunches',
      'bowl': qty === 1 ? 'bowl' : 'bowls',
      'gallon': qty === 1 ? 'galón' : 'galones',
      'liter': qty === 1 ? 'litro' : 'litros',
      'paquete': qty === 1 ? 'paquete' : 'paquetes',
      'orden': qty === 1 ? 'orden' : 'órdenes',
      'cena_completa': qty === 1 ? 'cena completa' : 'cenas completas',
    }
    return labels[unit] || unit
  }

  // Quantity options generator
  const getQuantityOptions = (unit: string, minQty: number): number[] => {
    if (unit === 'per_person') {
      const options: number[] = []
      let current = minQty
      while (current <= 100) {
        options.push(current)
        if (current < 50) current += 5
        else current += 10
      }
      return options
    }
    if (unit === 'tray' || unit === 'half_tray') {
      return Array.from(
        { length: Math.max(10, 10 - minQty + 1) }, 
        (_, i) => minQty + i
      )
    }
    // For other units use +/- counter, return empty array
    return []
  }

  function openItem(item: CateringMenuItem) {
    if (!item.selling_unit) {
      throw new Error(`Item ${item.id} has no selling_unit`)
    }
    setSelectedItem(item)
    setQuantity(item.min_quantity || 1)
    setSpecialInstructions("")
    setItemModalSpecialOpen(false)
    const defaultSize = item.sizes?.find((s) => s.catering_is_default) || item.sizes?.[0] || null
    setSelectedSizeId(defaultSize?.id || null)
  }

  function getSelectedSize() {
    if (!selectedItem?.sizes?.length) return null
    return selectedItem.sizes.find((s) => s.id === selectedSizeId) || selectedItem.sizes[0]
  }

  function getItemPrice(): number {
    const size = getSelectedSize()
    if (size) return Number(size.catering_price) || 0
    return Number(selectedItem?.price) || 0
  }

  function addToCart() {
    if (!selectedItem) return
    // Facebook Pixel: Track AddToCart (catering)
    if (typeof (globalThis as any).fbq !== "undefined") {
      (globalThis as any).fbq("track", "AddToCart")
    }
    const quantityOptions = Array.from({ length: 60 }, (_, i) => (selectedItem.min_quantity || 1) + i)
    const q = quantityOptions.includes(quantity) ? quantity : quantityOptions[0]!
    const size = getSelectedSize()
    const price = getItemPrice()
    const newItem: CartItem = {
      id: `${selectedItem.id}-${size?.id || "base"}-${Date.now()}`,
      name: selectedItem.name,
      price,
      quantity: q,
      min_quantity: selectedItem.min_quantity ?? null,
      sizeName: size?.catering_name || undefined,
      sizeServes: size?.catering_serves || undefined,
      image_url: selectedItem.image_url,
      menu_item_id: selectedItem.id,
    }
    setCart((prev) => [...prev, newItem])
    closeCateringItemDialog()
    // On desktop, keep the cart sidebar open for the remainder of the order flow
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      setShowCart(true)
    }
  }

  function closeCateringItemDialog() {
    setSelectedItem(null)
    setSelectedSizeId(null)
    setQuantity(1)
    setSpecialInstructions("")
    setItemModalSpecialOpen(false)
  }

  function updateQuantity(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item
          const currentQty = item.quantity
          const minQty = item.min_quantity || 1
          const newQty = Math.max(minQty, currentQty + delta)
          return { ...item, quantity: newQty }
        })
    )
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((item) => item.id !== id))
  }

function scrollToCategory(name: string) {
    setActiveCategoryNav(name)
    categoryRefs.current[name]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const rawTaxRate = (restaurant as any).tax_rate ?? 10.5
  const TAX_RATE = rawTaxRate > 1 ? rawTaxRate / 100 : rawTaxRate // Convert percentage to decimal if needed

  function getOrderTotals() {
    const subtotal = cartTotal
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100
    const deliveryFee = checkoutForm.orderType === "delivery" ? (restaurant.delivery_fee || 0) : 0
    const orderTypeForDispatch = checkoutForm.orderType === "delivery" ? "entrega" : "recogido"
    const dispatchFee = calculateDispatchFee(restaurant, orderTypeForDispatch, subtotal)
    const tip = checkoutForm.tip || 0
    const total = subtotal + tax + deliveryFee + dispatchFee + tip
    return { subtotal, tax, deliveryFee, dispatchFee, tip, total }
  }

  async function handleSubmitCheckout(method: "card" | "athmovil" | "cash" = "card") {
    console.log("[v0] [checkout] Starting checkout with method:", method)
    console.log("[v0] [checkout] Form state:", checkoutForm)
    console.log("[v0] [checkout] Selected branch:", selectedBranch?.id)
    setCheckoutError(null)
    setPaymentMethod(method)

    // Validate required fields
    if (!checkoutForm.name.trim()) {
      setCheckoutError("Por favor ingresa tu nombre")
      return
    }
    if (!checkoutForm.email.trim()) {
      setCheckoutError("Por favor ingresa tu correo electrónico")
      return
    }
    if (!checkoutForm.phone.trim()) {
      setCheckoutError("Por favor ingresa tu teléfono")
      return
    }
    if (!checkoutForm.eventDate) {
      setCheckoutError("Por favor selecciona la fecha del evento")
      return
    }
    if (!checkoutForm.eventTime) {
      setCheckoutError("Por favor selecciona la hora del evento")
      return
    }
    if (checkoutForm.orderType === "delivery" && !checkoutForm.address.trim()) {
      setCheckoutError("Por favor ingresa la dirección de entrega")
      return
    }
    if (!selectedBranch) {
      setCheckoutError("No se ha seleccionado una sucursal")
      return
    }

    setCheckoutLoading(true)

try {
      const { subtotal, tax, deliveryFee, dispatchFee, tip, total } = getOrderTotals()

      const cartItems = cart.map((item) => ({
        name: item.sizeName ? `${item.name} (${item.sizeName})` : item.name,
        price: item.price,
        quantity: item.quantity,
        type: "item" as const,
        menu_item_id: item.menu_item_id,
        size_name: item.sizeName,
        serves: item.sizeServes,
      }))

      const orderData = {
        restaurantId: restaurant.id,
        branchId: selectedBranch.id,
        cart: cartItems,
        subtotal,
        tax,
        deliveryFee,
        dispatchFee,
        tip,
        total,
        orderType: checkoutForm.orderType,
        customerEmail: checkoutForm.email,
        customerPhone: checkoutForm.phone,
        order_source: "online",
        eventDetails: {
          name: checkoutForm.name,
          email: checkoutForm.email,
          phone: checkoutForm.phone,
          eventDate: checkoutForm.eventDate,
          eventTime: checkoutForm.eventTime,
          guestCount: checkoutForm.guestCount ? parseInt(checkoutForm.guestCount) : undefined,
          address: checkoutForm.address,
          city: checkoutForm.city,
          state: checkoutForm.state,
          zip: checkoutForm.zip,
          specialInstructions: checkoutForm.specialInstructions,
        },
        stripeAccountId:
          (selectedBranch as { stripe_account_id?: string | null })?.stripe_account_id ||
          (restaurant as any).stripe_account_id ||
          null,
        athMovilPublicToken: (restaurant as any).athmovil_public_token || null,
      }

      if (method === "athmovil") {
        console.log("[v0] [checkout] Creating ATH Movil payment...")
        const athResult = await createCateringATHMovilPayment(orderData)
        console.log("[v0] [checkout] ATH Movil result:", athResult)
        if (!athResult.success || !athResult.ecommerceId) {
          throw new Error(athResult.error || "No se pudo iniciar el pago con ATH Móvil")
        }
        setAthMovilEcommerceId(athResult.ecommerceId)
        setAthMovilPublicToken(athResult.publicToken || null)
        setShowCheckout(false)
        setShowATHMovil(true)
        // Start polling for ATH Movil payment status
        startATHMovilPolling(athResult.ecommerceId, athResult.publicToken!, orderData)
        return
      }

      if (method === "cash") {
        // Cash payment — create order directly without payment processing
        setShowCheckout(false)
        setOrderComplete(true)
        setCart([])
        return
      }

      // Default: Stripe card payment
      const result = await createCateringCheckoutSession(orderData)
      if (!result.clientSecret) {
        throw new Error("No se recibió el cliente secreto de Stripe")
      }
      setStripeClientSecret(result.clientSecret)
      setShowCheckout(false)
      setShowStripe(true)

    } catch (error: any) {
      console.error("[checkout] Error:", error)
      setCheckoutError(error.message || "Error al procesar el pago. Por favor intenta de nuevo.")
    } finally {
      setCheckoutLoading(false)
    }
  }

  function startATHMovilPolling(ecommerceId: string, publicToken: string, orderData: any) {
    setAthMovilPolling(true)
    let attempts = 0
    const maxAttempts = 60 // 5 minutes at 5 second intervals

    const interval = setInterval(async () => {
      attempts++
      console.log("[v0] [athmovil polling] Attempt", attempts, "for ecommerceId:", ecommerceId)
      try {
        const status = await checkCateringATHMovilStatus(ecommerceId, publicToken)
        console.log("[v0] [athmovil polling] Status:", status)
        if (status.status === "COMPLETED") {
          clearInterval(interval)
          setAthMovilPolling(false)
          console.log("[v0] [athmovil polling] Payment completed, creating order...")
          const orderResult = await createCateringATHMovilOrder({
            ...orderData,
            athMovilTransactionId: status.transactionId || ecommerceId,
          })
          console.log("[v0] [athmovil polling] Order result:", orderResult)
          setShowATHMovil(false)
          setCart([])
          setOrderComplete(true)
        } else if (status.status === "CANCEL" || status.status === "EXPIRED") {
          clearInterval(interval)
          setAthMovilPolling(false)
          setShowATHMovil(false)
          setShowCheckout(true)
          setCheckoutError("El pago fue cancelado. Por favor intenta de nuevo.")
        } else if (attempts >= maxAttempts) {
          clearInterval(interval)
          setAthMovilPolling(false)
          setShowATHMovil(false)
          setShowCheckout(true)
          setCheckoutError("El tiempo de espera expiró. Por favor intenta de nuevo.")
        }
      } catch (error) {
        console.error("[v0] [athmovil polling] Error:", error)
      }
    }, 5000)
  }
  
  function toggleCategory(categoryId: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  return (
    <div className={`min-h-screen bg-slate-50 transition-[padding] duration-200 ${showCart ? "lg:pr-[28rem]" : ""}`}>
      {/* Promotional Popup */}
      <PromotionalPopup placement="catering_portal" cateringRestaurantId={restaurant.id} />
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="px-4 lg:px-8 py-3 flex items-center justify-between max-w-7xl mx-auto">
          {/* Left: Logo + Restaurant Name */}
          <div className="flex items-center gap-4">
            {isCustomDomain ? (
              /* Custom domain: Show restaurant's own banner logo or just name */
              <div className="flex items-center gap-3">
                {(restaurant as any).banner_logo_url ? (
                  <img
                    src={(restaurant as any).banner_logo_url}
                    alt={restaurant.name}
                    className="h-8 w-auto object-contain"
                  />
                ) : (
                  <span className="font-bold text-lg" style={{ color: primaryColor }}>{restaurant.name}</span>
                )}
                {selectedBranch && (
                  <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{selectedBranch.name}</span>
                  </div>
                )}
              </div>
            ) : (
              /* Standard JunteReady marketplace view */
              <>
                <Link href="/catering" className="flex-shrink-0">
                  <img
                    src="/junteready-logo.jpg"
                    alt="JunteReady"
                    className="h-6 sm:h-8 w-auto object-contain"
                  />
                </Link>
                <div className="flex items-center gap-2 min-w-0" style={{ color: primaryColor }}>
                  <span className="text-slate-300 text-lg">|</span>
                  <span className="font-bold text-base tracking-tight truncate">{restaurant.name}</span>
                  {selectedBranch && (
                    <>
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-500 hidden sm:inline">{selectedBranch.name}</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right: Delivery Toggle + Account + Cart */}
          <div className="flex items-center gap-3">
            {/* Delivery/Pickup Toggle - JunteReady Style (Recogido-first to mirror checkout default) */}
            <div className="hidden md:flex items-center bg-slate-100 rounded-full p-1">
              <button
                onClick={() => setDeliveryMethod("pickup")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  deliveryMethod === "pickup" ? "text-white" : "text-slate-500 hover:text-slate-700"
                }`}
                style={deliveryMethod === "pickup" ? { backgroundColor: primaryColor } : {}}
              >
                <Store className="w-4 h-4" />
                Recogido
              </button>
              <button
                onClick={() => setDeliveryMethod("delivery")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  deliveryMethod === "delivery" ? "text-white" : "text-slate-500 hover:text-slate-700"
                }`}
                style={deliveryMethod === "delivery" ? { backgroundColor: primaryColor } : {}}
              >
                <Truck className="w-4 h-4" />
                Entrega
              </button>
            </div>

            {/* Account */}
            <button
              type="button"
              onClick={() => {
                window.location.href = "/account"
              }}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <User className="w-4 h-4" />
              Cuenta
            </button>

            {/* Cart */}
            <button
              onClick={() => setShowCart(true)}
              className="relative flex items-center justify-center w-10 h-10 rounded-xl text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span 
                  className="absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      {(restaurant as any).hero_image_url && (
        <div className="w-full h-32 lg:h-40 overflow-hidden relative">
          <img
            src={(restaurant as any).hero_image_url}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      )}

      {/* Category Nav */}
      <div className="bg-white border-b border-slate-100 sticky top-16 z-40 shadow-sm">
        <div className="px-4 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 overflow-x-auto py-3 scrollbar-hide">
            {/* Filter Button */}
            <button
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              <Filter className="w-4 h-4" />
              Filtrar
            </button>

            {/* Service Packages nav — same gates as a SERVICIOS block: show_service_packages + ≥1 active package */}
            {showServicesSection && servicePackages.some((pkg) => pkg.is_active) && (
              <button
                onClick={() => scrollToCategory("SERVICIOS")}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-colors whitespace-nowrap ${activeCategoryNav === "SERVICIOS" ? "" : "hover:bg-slate-50"}`}
                style={
                  activeCategoryNav === "SERVICIOS"
                    ? { backgroundColor: primaryColor, color: "white", borderColor: primaryColor }
                    : { borderColor: primaryColor, color: primaryColor }
                }
              >
                SERVICIOS
              </button>
            )}

            {/* Category pills */}
            {categories
              .filter((c) => c.is_active)
              .sort((a, b) => a.display_order - b.display_order)
              .map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.name)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-colors whitespace-nowrap ${activeCategoryNav === cat.name ? "" : "hover:bg-slate-50"}`}
                  style={
                    activeCategoryNav === cat.name
                      ? { backgroundColor: primaryColor, color: "white", borderColor: primaryColor }
                      : { borderColor: primaryColor, color: primaryColor }
                  }
                >
                  {cat.name}
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="px-4 lg:px-8 py-6 space-y-8 max-w-7xl mx-auto">
        {categories
          .filter((c) => c.is_active)
          .sort((a, b) => a.display_order - b.display_order)
          .map((category) => {
            const items = menuItems.filter((item) => item.catering_category_id === category.id)
            if (items.length === 0) return null
            return (
              <section
                key={category.id}
                ref={(el) => { categoryRefs.current[category.name] = el }}
                className="scroll-mt-32"
              >
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between px-5 py-3 rounded-xl mb-4 transition-colors hover:opacity-95"
                  style={{ backgroundColor: primaryColor }}
                >
                  <h2 className="text-white font-bold uppercase tracking-wider text-sm">
                    {category.name}
                  </h2>
                  <Minus className={`w-5 h-5 text-white transition-transform ${collapsedCategories.has(category.id) ? "rotate-90" : ""}`} />
                </button>
{!collapsedCategories.has(category.id) && (
                  <div className={styles.layout === "horizontal" 
                    ? `grid gap-3 ${
                        designTemplate.includes("4col") ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" :
                        designTemplate.includes("3col") ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" :
                        "grid-cols-1 md:grid-cols-2"
                      }`
                    : "grid grid-cols-2 md:grid-cols-4 gap-5"
                  }>
                    {items.map((item) => {
                      const price = Number(item.price) || 0
                      const hasSizes = item.sizes && item.sizes.length > 0
                      const defaultSize = hasSizes
                        ? item.sizes!.find((s) => s.catering_is_default) || item.sizes![0]
                        : null
                      const displayPrice = defaultSize
                        ? Number(defaultSize.catering_price) || price
                        : price
                      // Get the display label for selling_unit - use inline getUnitLabel
                      const rawUnit = item.selling_unit || (defaultSize?.catering_name ? null : "tray")
                      const sellingUnitLabel = rawUnit ? getUnitLabel(rawUnit, 1) : ""

                      // Horizontal list layout (list-left, list-right variants)
                      // Each item is a compact horizontal ROW with fixed-size thumbnail
                      if (styles.layout === "horizontal") {
                        const imageOnRight = styles.imagePosition === "right"
                        return (
                          <div
                            key={item.id}
                            onClick={() => openItem(item)}
                            className={`bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center gap-3 p-3 ${imageOnRight ? "flex-row" : "flex-row-reverse"}`}
                          >
                            {/* Fixed size thumbnail - 100x100px, rounded */}
                            {item.image_url && (
                              <div className="w-[100px] h-[100px] flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            {/* Content area - name, description, price beside the image */}
                            <div className="flex-1 min-w-0 py-1">
                              <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-1">{item.name}</h3>
                              {item.description && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                              )}
                              <div className="mt-2">
                                <p className="text-sm font-bold" style={{ color: primaryColor }}>
                                  ${displayPrice.toFixed(2)}
{sellingUnitLabel && (
                                <span className="text-xs font-normal text-slate-400"> {sellingUnitLabel}</span>
                              )}
                                </p>
                                {defaultSize?.catering_serves && (
                                  <p className="text-xs text-slate-400 mt-0.5">Sirve {defaultSize.catering_serves}</p>
                                )}
                              </div>
                            </div>
                            {/* Add button on far right */}
                            <button
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0 transition-transform hover:scale-110"
                              style={{ backgroundColor: primaryColor }}
                              onClick={(e) => { e.stopPropagation(); openItem(item) }}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      }

                      // Vertical card layout (modern, classic, bold, minimal, elegant)
                      // These keep the tall card layout with large images - matches the reference image
                      return (
                        <div
                          key={item.id}
                          onClick={() => openItem(item)}
                          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer hover:shadow-lg hover:border-slate-300 transition-all duration-200 relative group"
                        >
                          {item.image_url ? (
                            <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          ) : (restaurant as any).default_item_image_url ? (
                            <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                              <img
                                src={(restaurant as any).default_item_image_url}
                                alt={restaurant.name}
                                className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          ) : (
                            <div className="aspect-[4/3] w-full bg-slate-100 flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2a5 5 0 00-5 5v6h3.5a1.5 1.5 0 011.5 1.5v.5M16 22v-4" />
                              </svg>
                            </div>
                          )}
                          <div className="p-4">
                            <h3 className="font-semibold text-slate-900 text-sm leading-tight line-clamp-1">
                              {item.name}
                            </h3>
                            {item.description && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            <div className="mt-3">
                              <p className="text-sm font-bold" style={{ color: primaryColor }}>
                                ${displayPrice.toFixed(2)}
{sellingUnitLabel && (
                                <span className="text-xs font-normal text-slate-400"> {sellingUnitLabel}</span>
                              )}
                              </p>
                              {defaultSize?.catering_serves && (
                                <p className="text-xs text-slate-400 mt-0.5">Sirve {defaultSize.catering_serves}</p>
                              )}
                            </div>
                            {/* Plus button - bottom right corner */}
                            <button
                              className="absolute bottom-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md transition-transform hover:scale-110"
                              style={{ backgroundColor: primaryColor }}
                              onClick={(e) => { e.stopPropagation(); openItem(item) }}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
      </div>

      {/* Item Modal */}
      <Dialog
        open={!!selectedItem}
        onOpenChange={(open) => {
          if (!open) closeCateringItemDialog()
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0 sm:max-w-3xl"
        >
          {selectedItem && (() => {
            const unitKey =
              selectedItem.selling_unit === "per_person"
                ? "person"
                : selectedItem.selling_unit === "per_pound"
                  ? "pound"
                  : selectedItem.selling_unit!
            const quantityOptions = Array.from({ length: 60 }, (_, i) => (selectedItem.min_quantity || 1) + i)
            const displayQty = quantityOptions.includes(quantity) ? quantity : quantityOptions[0]!
            const qIdx = quantityOptions.indexOf(displayQty)
            const unitLabel = getSellingUnitPriceLabel(unitKey, 1)
            const minQtyRaw = selectedItem.min_quantity
            const qtyUnitLabel = getSellingQtyUnitLabel(unitKey, minQtyRaw || 1)
            const serves = getSelectedSize()?.catering_serves

            return (
              <>
                {selectedItem.image_url ? (
                  <div className="relative w-full h-48 md:h-56 shrink-0 overflow-hidden">
                    <img
                      src={selectedItem.image_url}
                      alt={selectedItem.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={closeCateringItemDialog}
                      className="absolute top-2 right-2 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                      aria-label="Cerrar"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : null}

                <div className={`relative shrink-0 ${selectedItem.image_url ? "px-6 pt-4" : "px-6 pt-6"}`}>
                  {!selectedItem.image_url && (
                    <button
                      type="button"
                      onClick={closeCateringItemDialog}
                      className="absolute top-4 right-4 z-10 rounded-full bg-muted/80 p-1.5 text-foreground transition-colors hover:bg-muted"
                      aria-label="Cerrar"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                  <DialogHeader className="pb-4 border-b text-center">
                    <DialogTitle className="text-2xl font-bold text-center">{selectedItem.name}</DialogTitle>
                    <p className="mt-1 text-center text-lg font-semibold text-foreground">
                      ${getItemPrice().toFixed(2)}
                      <span className="text-base font-normal text-muted-foreground">
                        {unitLabel && (
                          <>
                            {" "}
                            {unitLabel.toLowerCase().startsWith("por")
                              ? unitLabel.toLowerCase()
                              : `/ ${unitLabel}`}
                          </>
                        )}
                        {serves ? (
                          <>
                            {" "}
                            | (Sirve {serves})
                          </>
                        ) : null}
                        {minQtyRaw ? (
                          <>
                            {" "}
                            | Minimo {minQtyRaw} {qtyUnitLabel}
                          </>
                        ) : null}
                      </span>
                    </p>
                    {selectedItem.description ? (
                      <p className="mt-2 text-center text-sm text-muted-foreground">{selectedItem.description}</p>
                    ) : null}
                  </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                  {selectedItem.sizes && selectedItem.sizes.length > 0 ? (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-slate-700">Seleccionar tamaño:</p>
                      <div className="space-y-2">
                        {selectedItem.sizes.map((size) => {
                          const sizePrice = Number(size.catering_price) || 0
                          const isSelected = selectedSizeId === size.id
                          return (
                            <button
                              key={size.id}
                              type="button"
                              onClick={() => setSelectedSizeId(size.id)}
                              className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 transition-all ${
                                isSelected ? "" : "border-slate-200 hover:border-slate-300"
                              }`}
                              style={
                                isSelected
                                  ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` }
                                  : undefined
                              }
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="flex h-4 w-4 items-center justify-center rounded-full border-2"
                                  style={isSelected ? { borderColor: primaryColor } : { borderColor: "#cbd5e1" }}
                                >
                                  {isSelected ? (
                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                                  ) : null}
                                </div>
                                <span className="text-sm font-medium text-slate-700">
                                  {size.catering_name}
                                  {size.catering_serves ? (
                                    <span className="font-normal text-slate-400"> (Sirve {size.catering_serves})</span>
                                  ) : null}
                                </span>
                              </div>
                              <span className="text-sm font-semibold" style={{ color: primaryColor }}>
                                ${sizePrice.toFixed(2)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Seleccionar cantidad:</Label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (qIdx > 0) setQuantity(quantityOptions[qIdx - 1]!)
                        }}
                        disabled={qIdx <= 0}
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                        style={{ backgroundColor: primaryColor }}
                        aria-label="Disminuir cantidad"
                      >
                        -
                      </button>
                      <select
                        value={displayQty}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm"
                      >
                        {quantityOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt} {getSellingQtyUnitLabel(unitKey, opt)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (qIdx < quantityOptions.length - 1) setQuantity(quantityOptions[qIdx + 1]!)
                        }}
                        disabled={qIdx >= quantityOptions.length - 1}
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                        style={{ backgroundColor: primaryColor }}
                        aria-label="Aumentar cantidad"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                      style={{ color: primaryColor }}
                      onClick={() => setItemModalSpecialOpen(!itemModalSpecialOpen)}
                    >
                      {itemModalSpecialOpen ? (
                        <MinusCircle className="h-4 w-4" />
                      ) : (
                        <PlusCircle className="h-4 w-4" />
                      )}
                      Instrucciones especiales
                    </button>
                    {itemModalSpecialOpen ? (
                      <textarea
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        placeholder="Alergias, preferencias, etc."
                        className="mt-2 min-h-[80px] w-full resize-y rounded-lg border border-slate-200 p-3 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                        style={{ "--tw-ring-color": primaryColor } as any}
                        rows={3}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0 border-t bg-background p-4">
                  <button
                    type="button"
                    onClick={addToCart}
                    className="flex w-full items-center justify-between rounded-lg p-4 text-lg font-bold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span>Agregar al Carrito</span>
                    <span>${(getItemPrice() * displayQty).toFixed(2)}</span>
                  </button>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Cart Drawer — persistent sidebar on desktop, overlay on mobile */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex lg:pointer-events-none">
          <div
            className="absolute inset-0 bg-black/40 lg:hidden"
            onClick={() => setShowCart(false)}
            aria-hidden="true"
          />
          <div className="relative ml-auto w-full max-w-md bg-white h-full flex flex-col shadow-2xl overflow-hidden lg:pointer-events-auto lg:border-l lg:border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" style={{ color: primaryColor }} />
                <h2 className="font-bold text-lg" style={{ color: primaryColor }}>Carrito de Compras</h2>
              </div>
              <button 
                onClick={() => setShowCart(false)} 
                className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Cart Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-16">
                  <div 
                    className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <ShoppingCart className="w-10 h-10" style={{ color: primaryColor }} />
                  </div>
                  <p className="text-slate-700 font-medium mb-1">Tu carrito esta vacio</p>
                  <p className="text-slate-400 text-sm">Agrega algunos articulos deliciosos para comenzar</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-900">{item.name}</p>
                      {item.sizeName && (
                        <p className="text-xs text-slate-500">
                          {item.sizeName}{item.sizeServes ? ` · Sirve ${item.sizeServes}` : ""}
                        </p>
                      )}
                      <p className="text-sm font-bold mt-1" style={{ color: primaryColor }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        aria-label="Eliminar del carrito"
                        className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={item.quantity <= (item.min_quantity || 1)}
                        className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Minus className="w-3 h-3 text-slate-600" />
                      </button>
                      <span className="text-sm font-semibold w-4 text-center" style={{ color: primaryColor }}>{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-100 transition-colors"
                      >
                        <Plus className="w-3 h-3 text-slate-600" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer with checkout button */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-white">
                <div className="flex justify-between mb-4">
                  <span className="font-semibold text-slate-700">Subtotal</span>
                  <span className="font-bold text-lg" style={{ color: primaryColor }}>${cartTotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={goToCheckout}
                  className="w-full py-4 rounded-xl text-white font-bold text-base transition-colors hover:opacity-95"
                  style={{ backgroundColor: primaryColor }}
                >
                  Proceder al Pago
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Form Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60">
          <div className="bg-white w-full max-w-lg rounded-t-2xl md:rounded-2xl overflow-hidden max-h-[95vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="font-bold text-lg" style={{ color: primaryColor }}>Detalles del Evento</h2>
              <button onClick={() => setShowCheckout(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-5 divide-y divide-slate-100">
              {checkoutError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
                  {checkoutError}
                </div>
              )}

              {/* Contact Info */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Informacion de Contacto</p>
                {!user && (
                  <div className="space-y-4 mb-4">
                    <p className="text-sm text-slate-600">Inicia sesión para un checkout más rápido</p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const b = selectedBranchId || (branches.length === 1 ? branches[0]!.id : null)
                          try {
                            sessionStorage.setItem("pendingCateringCart", JSON.stringify(cart))
                            if (b) sessionStorage.setItem("pendingCateringBranch", b)
                            else sessionStorage.removeItem("pendingCateringBranch")
                          } catch {
                            /* ignore */
                          }
                          window.location.href = `/catering/${restaurant.slug}/customer-auth?mode=login&redirect=catering-checkout&slug=${restaurant.slug}`
                        }}
                        className="px-4 py-2 rounded-md text-white font-medium text-sm transition-colors"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Iniciar Sesión
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const b = selectedBranchId || (branches.length === 1 ? branches[0]!.id : null)
                          try {
                            sessionStorage.setItem("pendingCateringCart", JSON.stringify(cart))
                            if (b) sessionStorage.setItem("pendingCateringBranch", b)
                            else sessionStorage.removeItem("pendingCateringBranch")
                          } catch {
                            /* ignore */
                          }
                          window.location.href = `/catering/${restaurant.slug}/customer-auth?mode=signup&redirect=catering-checkout&slug=${restaurant.slug}`
                        }}
                        className="px-4 py-2 rounded-md border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
                      >
                        Crear Cuenta
                      </button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Nombre completo *"
                    value={checkoutForm.name}
                    onChange={(e) => setCheckoutForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": primaryColor } as any}
                  />
                  <input
                    type="email"
                    placeholder="Correo electronico *"
                    value={checkoutForm.email}
                    onChange={(e) => setCheckoutForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": primaryColor } as any}
                  />
                  <input
                    type="tel"
                    placeholder="Telefono *"
                    value={checkoutForm.phone}
                    onChange={(e) => setCheckoutForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": primaryColor } as any}
                  />
                </div>
              </div>

              {/* Event Details */}
              <div className="pt-5">
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Detalles del Evento</p>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={checkoutForm.eventDate}
                    min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                    onChange={(e) => setCheckoutForm((f) => ({ ...f, eventDate: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": primaryColor } as any}
                  />
                  <input
                    type="time"
                    value={checkoutForm.eventTime}
                    onChange={(e) => setCheckoutForm((f) => ({ ...f, eventTime: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": primaryColor } as any}
                  />
                  <input
                    type="number"
                    placeholder="Numero de personas"
                    value={checkoutForm.guestCount}
                    onChange={(e) => setCheckoutForm((f) => ({ ...f, guestCount: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": primaryColor } as any}
                  />
                </div>
              </div>

              {/* Delivery or Pickup */}
              <div className="pt-5">
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Tipo de Servicio</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCheckoutForm((f) => ({ ...f, orderType: "pickup" }))}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all flex items-center justify-center gap-2 ${
                      checkoutForm.orderType === "pickup" ? "text-white" : "text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                    style={checkoutForm.orderType === "pickup" ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                  >
                    <Store className="w-4 h-4" />
                    Recogido
                  </button>
                  <button
                    onClick={() => setCheckoutForm((f) => ({ ...f, orderType: "delivery" }))}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all flex items-center justify-center gap-2 ${
                      checkoutForm.orderType === "delivery" ? "text-white" : "text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                    style={checkoutForm.orderType === "delivery" ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                  >
                    <Truck className="w-4 h-4" />
                    Entrega
                  </button>
                </div>
              </div>

              {/* Delivery Address */}
              {checkoutForm.orderType === "delivery" && (
                <div className="pt-5">
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Direccion de Entrega</p>
                  <div className="space-y-2">
                    <AddressAutocomplete
                      value={checkoutForm.address}
                      onChange={(value) => setCheckoutForm((f) => ({ ...f, address: value }))}
                      onAddressSelected={(components) => {
                        setCheckoutForm((f) => ({
                          ...f,
                          address: components.streetAddress,
                          city: components.city,
                          state: components.state,
                          zip: components.zip,
                        }))
                      }}
                      placeholder="Direccion *"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Ciudad"
                        value={checkoutForm.city}
                        onChange={(e) => setCheckoutForm((f) => ({ ...f, city: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                        style={{ "--tw-ring-color": primaryColor } as any}
                      />
                      <input
                        type="text"
                        placeholder="Codigo Postal"
                        value={checkoutForm.zip}
                        onChange={(e) => setCheckoutForm((f) => ({ ...f, zip: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                        style={{ "--tw-ring-color": primaryColor } as any}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Special Instructions */}
              <div className="pt-5">
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Instrucciones Especiales</p>
                <textarea
                  placeholder="Alergias, preferencias, instrucciones de montaje, etc."
                  value={checkoutForm.specialInstructions}
                  onChange={(e) => setCheckoutForm((f) => ({ ...f, specialInstructions: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": primaryColor } as any}
                />
              </div>

{/* Tip */}
              <div className="pt-5">
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Propina (Sugerida)</p>
                <div className="flex gap-2">
                  {[restaurant.tip_option_1!, restaurant.tip_option_2!, restaurant.tip_option_3!, restaurant.tip_option_4!].map((pct) => {
                    const tipAmount = Math.round(cartTotal * pct) / 100
                    const isSelected = checkoutForm.tip === tipAmount
                    return (
                      <button
                        key={pct}
                        onClick={() => setCheckoutForm((f) => ({ ...f, tip: tipAmount }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                          isSelected ? "text-white" : "text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                        style={isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                      >
                        {`${pct}%`}
                      </button>
                    )
                  })}
                </div>
                {/* Custom tip input */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-slate-500">Otro:</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                      onChange={(e) => {
                        const customTip = parseFloat(e.target.value) || 0
                        setCheckoutForm((f) => ({ ...f, tip: customTip }))
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="pt-5">
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: primaryColor }}>Método de Pago</p>
                <div className="space-y-3">
                  {stripeEnabled && (
                    <button
                      type="button"
                      onClick={async () => {
                        setPaymentMethod("card")
                        await handleSubmitCheckout("card")
                      }}
                      disabled={checkoutLoading}
                      className="w-full flex flex-col items-center justify-center p-4 bg-white border-2 border-[#635BFF] rounded-lg hover:bg-purple-50 transition-colors shadow-lg cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <span className="font-semibold text-lg text-[#635BFF]">
                        {checkoutLoading && paymentMethod === "card" ? "Procesando..." : "Pagar con Tarjeta"}
                      </span>
                      <img
                        src="/images/cc-logos.png"
                        alt="Visa, Mastercard, American Express"
                        className="h-6 mt-2"
                      />
                    </button>
                  )}

                  {athMovilEnabled && (
                    <button
                      type="button"
                      onClick={async () => {
                        setPaymentMethod("athmovil")
                        await handleSubmitCheckout("athmovil")
                      }}
                      disabled={checkoutLoading}
                      className="w-full flex items-center justify-center p-4 bg-white border-2 border-[#F58220] rounded-lg hover:bg-orange-50 transition-colors shadow-lg cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <img
                        src="/images/ath-movil-logo.png"
                        alt="ATH Móvil"
                        className="h-8"
                      />
                    </button>
                  )}

                  {cashEnabled && (
                    <button
                      type="button"
                      onClick={async () => {
                        setPaymentMethod("cash")
                        await handleSubmitCheckout("cash")
                      }}
                      disabled={checkoutLoading}
                      className="w-full flex items-center justify-center gap-3 p-4 bg-white border-2 border-green-500 rounded-lg hover:bg-green-50 transition-colors shadow-lg cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <span className="font-semibold text-lg text-green-600">Pagar en Efectivo</span>
                    </button>
                  )}

                  {!stripeEnabled && !athMovilEnabled && !cashEnabled && (
                    <p className="text-center text-gray-400 text-sm py-4">
                      No hay métodos de pago configurados. Contacta al restaurante.
                    </p>
                  )}
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 pt-5 border border-slate-100">
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: primaryColor }}>Resumen del Pedido</p>
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-600">{item.quantity}x {item.name}{item.sizeName ? ` (${item.sizeName})` : ""}</span>
                    <span className="font-medium text-slate-900">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="text-slate-700">${getOrderTotals().subtotal.toFixed(2)}</span>
                  </div>
                  {getOrderTotals().deliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Delivery</span>
                      <span className="text-slate-700">${getOrderTotals().deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  {getOrderTotals().dispatchFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Dispatch</span>
                      <span className="text-slate-700">${getOrderTotals().dispatchFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">IVU (10.5%)</span>
                    <span className="text-slate-700">${getOrderTotals().tax.toFixed(2)}</span>
                  </div>
                  {getOrderTotals().tip > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Propina</span>
                      <span className="text-slate-700">${getOrderTotals().tip.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-2">
                    <span style={{ color: primaryColor }}>Total</span>
                    <span style={{ color: primaryColor }}>${getOrderTotals().total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex-shrink-0 bg-white">
              <p className="text-center text-xs text-slate-400">
                Pago seguro y encriptado
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Embedded Checkout Modal */}
      {showStripe && stripeClientSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden max-h-[95vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="font-bold text-lg" style={{ color: primaryColor }}>Pago Seguro</h2>
              <button onClick={() => { setShowStripe(false); setShowCheckout(true) }} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  clientSecret: stripeClientSecret,
                  onComplete: () => {
                    setShowStripe(false)
                    setCart([])
                    setOrderComplete(true)
                  },
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </div>
        </div>
)}

      {/* ATH Movil Waiting Modal */}
      {showATHMovil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-8 text-center shadow-2xl">
            <img
              src="/images/ath-movil-logo.png"
              alt="ATH Móvil"
              className="h-12 mx-auto mb-6"
            />
            <h2 className="text-xl font-bold mb-2" style={{ color: primaryColor }}>
              Completar Pago en ATH Móvil
            </h2>
            <p className="text-slate-500 mb-6">
              Abre tu app de ATH Móvil y aprueba el pago de <span className="font-bold" style={{ color: primaryColor }}>${getOrderTotals().total.toFixed(2)}</span>
            </p>
            {athMovilPolling && (
              <div className="flex items-center justify-center gap-3 text-slate-400 mb-6">
                <div className="w-5 h-5 border-2 border-slate-200 rounded-full animate-spin" style={{ borderTopColor: primaryColor }} />
                <span className="text-sm">Esperando confirmación...</span>
              </div>
            )}
            <button
              onClick={() => {
                setShowATHMovil(false)
                setShowCheckout(true)
                setAthMovilPolling(false)
              }}
              className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Order Complete */}
      {orderComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primaryColor}20` }}>
              <svg className="w-8 h-8" style={{ color: primaryColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: primaryColor }}>Pedido Confirmado!</h2>
            <p className="text-slate-500 mb-6">Tu pedido de catering ha sido recibido. Te enviaremos una confirmacion por correo electronico.</p>
            <button
              onClick={() => setOrderComplete(false)}
              className="w-full py-3 rounded-xl text-white font-bold transition-colors hover:opacity-95"
              style={{ backgroundColor: primaryColor }}
            >
              Hacer Otro Pedido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
