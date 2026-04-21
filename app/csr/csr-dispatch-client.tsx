"use client"

import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { 
  Phone, Search, RefreshCw, Truck, Clock, CheckCircle, XCircle, 
  ChefHat, Package, Send, User, Calendar, Store, 
  Building2, AlertCircle, ChevronDown, ArrowLeft, MapPin, FileText, MessageCircle,
  DollarSign, CreditCard, RotateCcw, Pencil, MonitorPlay, Plus, Minus, Trash2, Printer, UtensilsCrossed
} from "lucide-react"
import { OrderChat } from "@/components/order-chat"
import { WhatsAppInboxPanel } from "./whatsapp-inbox-panel"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

type Order = {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  customer_email: string
  delivery_type: string
  delivery_address: string
  apt_suite?: string | null
  delivery_city: string
  delivery_state: string
  delivery_zip: string
  delivery_date: string
  delivery_time?: string | null
  special_instructions: string
  status: string
  total: number
  subtotal: number
  tax: number
  delivery_fee: number
  dispatch_fee?: number
  tip: number
  created_at: string
  updated_at: string
  printed_at: string | null
  shipday_order_id: string | null
  eatabit_job_id: string | null
  eatabit_status: string | null
  sent_to_restaurant?: boolean
  order_source: string | null
  restaurant_id: string
  branch_id: string | null
  stripe_payment_intent_id: string | null
  athmovil_reference_number: string | null
  order_items: Array<{
    id: string
    item_name: string
    quantity: number
    unit_price: number
    total_price: number
    selected_options: any
  }>
restaurants: {
  id: string
  name: string
  slug: string
  logo_url: string | null
  shipday_api_key: string | null
  eatabit_enabled: boolean | null
  eatabit_printer_id: string | null
  payment_type: "ach" | "pop" | "ath" | "pbp" | "poo" | "pgc" | null
  order_notification_method: string | null
  } | null
  }

type Restaurant = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  shipday_api_key: string | null
  eatabit_enabled: boolean | null
  eatabit_printer_id: string | null
  payment_type: "ach" | "pop" | "ath" | "pbp" | "poo" | "pgc" | null
  order_notification_method: string | null
}

type CateringRestaurant = {
  id: string
  slug: string
  name: string
  description: string | null
  logo_url: string | null
  cuisine_type: string | null
  default_lead_time_hours: number
  max_advance_days: number
  is_active: boolean
  is_chain: boolean
  tax_rate: number
}

function normalizeCateringOrder(o: any): Order & { tent: "catering"; catering_restaurant_id: string } {
  return {
    id: o.id,
    order_number: o.order_number || o.id.slice(0, 6).toUpperCase(),
    customer_name: o.customer_name || "",
    customer_phone: o.customer_phone || "",
    customer_email: o.customer_email || "",
    delivery_type: o.delivery_type || "pickup",
    delivery_address: o.delivery_address || "",
    apt_suite: null,
    delivery_city: o.delivery_city || "",
    delivery_state: o.delivery_state || "PR",
    delivery_zip: o.delivery_zip || "",
    delivery_date: o.event_date || o.created_at,
    delivery_time: o.event_time || null,
    special_instructions: o.special_instructions || "",
    status: o.status || "pending",
    total: Number(o.total) || 0,
    subtotal: Number(o.subtotal) || 0,
    tax: Number(o.tax) || 0,
    delivery_fee: Number(o.delivery_fee) || 0,
    tip: Number(o.tip) || 0,
    created_at: o.created_at,
    updated_at: o.created_at,
    printed_at: null,
    shipday_order_id: null,
    eatabit_job_id: null,
    eatabit_status: null,
    sent_to_restaurant: false,
    order_source: "catering",
    restaurant_id: o.catering_restaurant_id,
    catering_restaurant_id: o.catering_restaurant_id,
    branch_id: o.catering_branch_id || null,
    stripe_payment_intent_id: o.stripe_payment_intent_id || null,
    athmovil_reference_number: null,
    order_items: Array.isArray(o.items) ? o.items.map((item: any, i: number) => ({
      id: `${o.id}-${i}`,
      item_name: item.name || item.item_name || "",
      quantity: item.quantity || 1,
      unit_price: item.price || item.unit_price || 0,
      total_price: (item.price || 0) * (item.quantity || 1),
      selected_options: item.selected_options || [],
    })) : [],
    restaurants: o.catering_restaurants ? {
      id: o.catering_restaurants.id,
      name: o.catering_restaurants.name,
      slug: o.catering_restaurants.slug,
      logo_url: o.catering_restaurants.logo_url,
      shipday_api_key: null,
      eatabit_enabled: false,
      eatabit_printer_id: null,
      payment_type: "portal" as const,
    } : null,
    tent: "catering",
  }
}

// Memoized chat modal to prevent re-renders from parent timer
const MemoizedChatModal = memo(function MemoizedChatModal({
  openChatOrderId,
  orders,
  onClose
}: {
  openChatOrderId: string
  orders: Order[]
  onClose: () => void
}) {
  // Memoize the order data to prevent re-renders
  const chatOrderData = useMemo(() => {
    const order = orders.find(o => o.id === openChatOrderId)
    if (!order) return null
    return {
      id: order.id,
      restaurantId: order.restaurant_id,
      orderNumber: order.order_number,
      items: order.order_items?.map(i => ({ id: i.id, item_name: i.item_name })) || []
    }
  }, [openChatOrderId, orders])

  if (!chatOrderData) return null

  return (
    <OrderChat
      orderId={chatOrderData.id}
      restaurantId={chatOrderData.restaurantId}
      senderType="csr"
      orderNumber={chatOrderData.orderNumber}
      orderItems={chatOrderData.items}
      compact={false}
      isOpen={true}
      onOpenChange={(open) => { if (!open) onClose() }}
    />
  )
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if the specific order changed
  return prevProps.openChatOrderId === nextProps.openChatOrderId &&
         prevProps.onClose === nextProps.onClose
})

interface CSRDispatchClientProps {
  initialOrders: Order[]
  initialCateringOrders: any[]
  restaurants: Restaurant[]
  cateringRestaurants: CateringRestaurant[]
  isSuperAdmin?: boolean
  }

// Horizontal section configuration - CSR focused workflow
// Flow: Pendientes → En Restaurante (preparing + ready with alert) → En Camino → Completados
const SECTIONS = [
  {
    id: "pending",
    label: "Pendientes",
    description: "Llamadas por confirmar y enviar",
    color: "bg-amber-500",
    textColor: "text-white",
    icon: Phone,
    statuses: ["pending", "confirmed"],
    defaultCollapsed: false
  },
  {
    id: "in_restaurant",
    label: "En Restaurante",
    description: "Preparando o listo para recoger",
    color: "bg-orange-500",
    textColor: "text-white",
    icon: ChefHat,
    statuses: ["preparing", "ready"], // Ready orders show LISTO! alert here
    defaultCollapsed: false
  },
  {
    id: "en_camino",
    label: "En Camino",
    description: "Driver salio del restaurante",
    color: "bg-purple-600",
    textColor: "text-white",
    icon: Truck,
    statuses: ["out_for_delivery"],
    defaultCollapsed: false
  },
  {
    id: "completed",
    label: "Completados Hoy",
    description: "Ordenes entregadas",
    color: "bg-gray-500",
    textColor: "text-white",
    icon: CheckCircle,
    statuses: ["completed"],
    defaultCollapsed: true
  },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendiente", color: "bg-yellow-500", icon: Clock },
  confirmed: { label: "Confirmado", color: "bg-blue-500", icon: CheckCircle },
  preparing: { label: "Preparando", color: "bg-orange-500", icon: ChefHat },
  ready: { label: "Listo", color: "bg-green-500", icon: Package },
  out_for_delivery: { label: "En Camino", color: "bg-purple-500", icon: Truck },
  completed: { label: "Completado", color: "bg-gray-500", icon: CheckCircle },
  cancelled: { label: "Cancelado", color: "bg-red-500", icon: XCircle },
}

export function CSRDispatchClient({ initialOrders, initialCateringOrders, restaurants, cateringRestaurants, isSuperAdmin = false }: CSRDispatchClientProps) {
  const supabase = createClient()
  
  // Tent filter for order types
  const [tentFilter, setTentFilter] = useState<"all" | "online_ordering" | "catering" | "subscriptions">("all")
  
  // Normalize and merge orders from both tables
  const normalizedCatering = (initialCateringOrders || []).map(normalizeCateringOrder)
  const allOrders = [
    ...initialOrders.map(o => ({ ...o, tent: "online_ordering" as const })),
    ...normalizedCatering,
  ]
  const [orders, setOrders] = useState(allOrders)
  
  // CSR Mode: delivery (default) or catering
  const [csrMode, setCsrMode] = useState<"delivery" | "catering">("delivery")
  const [selectedCateringRestaurant, setSelectedCateringRestaurant] = useState<CateringRestaurant | null>(null)
  
  // Catering form state
  const [cateringDataLoading, setCateringDataLoading] = useState(false)
  const [cateringDataError, setCateringDataError] = useState<string | null>(null)
  const [cateringBranches, setCateringBranches] = useState<Array<{
    id: string
    name: string
    address: string
    city: string
    state: string
    zip_code: string
    phone: string | null
  }>>([])
  const [cateringServicePackages, setCateringServicePackages] = useState<Array<{
    id: string
    name: string
    description: string | null
    base_price: number
    image_url: string | null
  }>>([])
  const [cateringCategories, setCateringCategories] = useState<Array<{
    id: string
    name: string
    display_order: number
  }>>([])
  const [cateringMenuItems, setCateringMenuItems] = useState<Array<{
    id: string
    catering_category_id: string
    name: string
    description: string | null
    price: number
    selling_unit: string
    image_url: string | null
  }>>([])
  
  // Catering form fields
  const [cateringSelectedBranch, setCateringSelectedBranch] = useState<string | null>(null)
  const [cateringEventDate, setCateringEventDate] = useState("")
  const [cateringEventTime, setCateringEventTime] = useState("")
  const [cateringDateTimeError, setCateringDateTimeError] = useState<string | null>(null)
  const [cateringCustomerName, setCateringCustomerName] = useState("")
  const [cateringCustomerPhone, setCateringCustomerPhone] = useState("")
  const [cateringCustomerEmail, setCateringCustomerEmail] = useState("")
  const [cateringDeliveryAddress, setCateringDeliveryAddress] = useState("")
  const [cateringSelectedPackage, setCateringSelectedPackage] = useState<string | null>(null)
  const [cateringItemQuantities, setCateringItemQuantities] = useState<Record<string, number>>({})
  const [cateringDeliveryFee, setCateringDeliveryFee] = useState("")
  const [cateringSpecialInstructions, setCateringSpecialInstructions] = useState("")
  const [cateringSubmitting, setCateringSubmitting] = useState(false)
  const [cateringSubmitError, setCateringSubmitError] = useState<string | null>(null)
  
  const [searchTerm, setSearchTerm] = useState("")
  const [restaurantFilter, setRestaurantFilter] = useState<string>("all")
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Reset restaurant filter when tent filter changes
  useEffect(() => {
    setRestaurantFilter("all")
  }, [tentFilter])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  // Refund & Additional Charge modals
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [showChargeModal, setShowChargeModal] = useState(false)
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [chargeAmount, setChargeAmount] = useState("")
  const [chargeReason, setChargeReason] = useState("")
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [shipdayStatus, setShipdayStatus] = useState<Record<string, any>>({})
  const [activeView, setActiveView] = useState<"current" | "future" | "history" | "whatsapp">("current")
  const [whatsappUnreadCount, setWhatsappUnreadCount] = useState(0)
  // Start with Pendientes collapsed, Completados collapsed
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(["pending", "completed"])
  )
  const [currentTime, setCurrentTime] = useState(new Date())
  const [openChatOrderId, setOpenChatOrderId] = useState<string | null>(null)
  const [ordersWithUnreadMessages, setOrdersWithUnreadMessages] = useState<Set<string>>(new Set())
  // Edit order modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editForm, setEditForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    delivery_address: "",
    apt_suite: "",
    delivery_city: "",
    delivery_zip: "",
    special_instructions: "",
    tip: 0,
  })
  const [editItems, setEditItems] = useState<Array<{
    id: string
    item_name: string
    quantity: number
    unit_price: number
    total_price: number
    isNew?: boolean
    isDeleted?: boolean
  }>>([])
  const [restaurantMenuItems, setRestaurantMenuItems] = useState<Array<{
    id: string
    name: string
    price: number
  }>>([])
  const [showAddItemDropdown, setShowAddItemDropdown] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  
  // Fetch catering data when a restaurant is selected
  useEffect(() => {
    if (!selectedCateringRestaurant) {
      // Reset all catering form state when deselecting
      setCateringBranches([])
      setCateringServicePackages([])
      setCateringCategories([])
      setCateringMenuItems([])
      setCateringSelectedBranch(null)
      setCateringEventDate("")
      setCateringEventTime("")
      setCateringDateTimeError(null)
      setCateringCustomerName("")
      setCateringCustomerPhone("")
      setCateringCustomerEmail("")
      setCateringDeliveryAddress("")
      setCateringSelectedPackage(null)
      setCateringItemQuantities({})
      setCateringDeliveryFee("")
      setCateringSpecialInstructions("")
      setCateringSubmitError(null)
      setCateringDataError(null)
      return
    }

    const fetchCateringData = async () => {
      setCateringDataLoading(true)
      setCateringDataError(null)

      const response = await fetch(`/api/csr/catering-data?restaurantId=${selectedCateringRestaurant.id}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        if (!errorData.error) {
          throw new Error("Catering data API returned error response with no error message")
        }
        setCateringDataError(errorData.error)
        setCateringDataLoading(false)
        return
      }

      const data = await response.json()
      setCateringBranches(data.branches)
      setCateringServicePackages(data.servicePackages.map((pkg: { base_price: string; [key: string]: unknown }) => ({
        ...pkg,
        base_price: parseFloat(pkg.base_price)
      })))
      setCateringCategories(data.categories)
      setCateringMenuItems(data.menuItems.map((item: { price: string; [key: string]: unknown }) => ({
        ...item,
        price: parseFloat(item.price)
      })))
      setCateringDataLoading(false)
    }

    fetchCateringData()
  }, [selectedCateringRestaurant])

  // Validate catering event date/time against lead time
  useEffect(() => {
    if (!selectedCateringRestaurant || !cateringEventDate || !cateringEventTime) {
      setCateringDateTimeError(null)
      return
    }

    const eventDateTime = new Date(`${cateringEventDate}T${cateringEventTime}:00`)
    const now = new Date()
    const leadTimeMs = selectedCateringRestaurant.default_lead_time_hours * 60 * 60 * 1000
    const minDateTime = new Date(now.getTime() + leadTimeMs)

    if (eventDateTime < minDateTime) {
      setCateringDateTimeError(
        `La fecha y hora del evento debe ser al menos ${selectedCateringRestaurant.default_lead_time_hours} horas en el futuro`
      )
    } else {
      setCateringDateTimeError(null)
    }
  }, [selectedCateringRestaurant, cateringEventDate, cateringEventTime])

  // Stable callbacks for chat open/close
  const handleChatOpen = useCallback((orderId: string) => {
    setOpenChatOrderId(orderId)
    // Clear unread indicator when opening chat
    setOrdersWithUnreadMessages(prev => {
      const newSet = new Set(prev)
      newSet.delete(orderId)
      return newSet
    })
  }, [])
  
  const handleChatClose = useCallback(() => {
    setOpenChatOrderId(null)
  }, [])

  // Calculate catering order totals
  const cateringCalculations = useMemo(() => {
    if (!selectedCateringRestaurant) {
      return { subtotal: 0, packagePrice: 0, taxAmount: 0, total: 0 }
    }

    // Tax rate is required - stored as percentage (e.g., 11.5), convert to decimal
    if (!selectedCateringRestaurant.tax_rate) {
      throw new Error("Tax rate not configured for this catering restaurant")
    }
    const taxRate = selectedCateringRestaurant.tax_rate / 100

    // Sum of menu items
    let itemsSubtotal = 0
    for (const item of cateringMenuItems) {
      const qty = cateringItemQuantities[item.id] || 0
      if (qty > 0) {
        itemsSubtotal += item.price * qty
      }
    }

    // Package price - explicit handling, no fallback
    let packagePrice = 0
    if (cateringSelectedPackage) {
      const selectedPkg = cateringServicePackages.find(p => p.id === cateringSelectedPackage)
      if (!selectedPkg) {
        throw new Error("Selected package not found in loaded packages")
      }
      packagePrice = selectedPkg.base_price
    }

    const subtotal = itemsSubtotal + packagePrice
    const taxAmount = subtotal * taxRate
    const deliveryFeeNum = cateringDeliveryFee ? parseFloat(cateringDeliveryFee) : 0
    const total = subtotal + taxAmount + deliveryFeeNum

    return { subtotal, packagePrice, taxAmount, taxRate, total, deliveryFeeNum }
  }, [selectedCateringRestaurant, cateringMenuItems, cateringItemQuantities, cateringSelectedPackage, cateringServicePackages, cateringDeliveryFee])

  // Check if catering form is valid
  const cateringFormValid = useMemo(() => {
    if (!selectedCateringRestaurant) return false
    
    // Chain restaurants require branch selection
    if (selectedCateringRestaurant.is_chain && !cateringSelectedBranch) return false
    
    // Date/time required and no error
    if (!cateringEventDate || !cateringEventTime || cateringDateTimeError) return false
    
    // Customer details required
    if (!cateringCustomerName.trim()) return false
    if (!cateringCustomerPhone.trim()) return false
    if (!cateringCustomerEmail.trim()) return false
    if (!cateringDeliveryAddress.trim()) return false
    
    // At least one menu item required
    const hasItems = Object.values(cateringItemQuantities).some(qty => qty > 0)
    if (!hasItems) return false
    
    return true
  }, [selectedCateringRestaurant, cateringSelectedBranch, cateringEventDate, cateringEventTime, cateringDateTimeError, cateringCustomerName, cateringCustomerPhone, cateringCustomerEmail, cateringDeliveryAddress, cateringItemQuantities])

  // Submit catering order
  const handleCateringSubmit = async () => {
    if (!selectedCateringRestaurant || !cateringFormValid) return

    setCateringSubmitting(true)
    setCateringSubmitError(null)

    // Handle service package - explicit checks, no fallbacks
    let servicePackageName: string | null = null
    let servicePackagePrice: number = 0
    
    if (cateringSelectedPackage) {
      // Package was selected - must find it in loaded packages
      const selectedPkg = cateringServicePackages.find(p => p.id === cateringSelectedPackage)
      if (!selectedPkg) {
        throw new Error("Selected service package not found in loaded packages")
      }
      servicePackageName = selectedPkg.name
      servicePackagePrice = selectedPkg.base_price
    }
    // If cateringSelectedPackage is null/empty, servicePackageName stays null and servicePackagePrice stays 0

    const items = cateringMenuItems
      .filter(item => (cateringItemQuantities[item.id] || 0) > 0)
      .map(item => ({
        menuItemId: item.id,
        name: item.name,
        quantity: cateringItemQuantities[item.id],
        unitPrice: item.price,
        sellingUnit: item.selling_unit,
        totalPrice: item.price * cateringItemQuantities[item.id],
      }))

    const payload = {
      cateringRestaurantId: selectedCateringRestaurant.id,
      branchId: cateringSelectedBranch,
      customerName: cateringCustomerName.trim(),
      customerPhone: cateringCustomerPhone.trim(),
      customerEmail: cateringCustomerEmail.trim(),
      deliveryAddress: cateringDeliveryAddress.trim(),
      eventDate: cateringEventDate,
      eventTime: cateringEventTime,
      servicePackageId: cateringSelectedPackage,
      servicePackageName,
      servicePackagePrice,
      items,
      subtotal: cateringCalculations.subtotal,
      taxAmount: cateringCalculations.taxAmount,
      taxRate: cateringCalculations.taxRate,
      deliveryFee: cateringCalculations.deliveryFeeNum,
      total: cateringCalculations.total,
      specialInstructions: cateringSpecialInstructions.trim(),
    }

    const response = await fetch("/api/csr/create-catering-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json()
      if (!errorData.error) {
        throw new Error("API returned error response with no error message")
      }
      setCateringSubmitError(errorData.error)
      setCateringSubmitting(false)
      return
    }

    const result = await response.json()
    
    // Success - reset form and go back to restaurant selector
    alert(`Orden de catering creada: ${result.orderNumber}`)
    setSelectedCateringRestaurant(null)
    setCateringSubmitting(false)
  }
  
  const prevPendingCountRef = useRef(0)
  const channelRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Play notification sound for new orders
  const playNotificationSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
      
      // Create an oscillator for a beep
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(800, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.4, ctx.currentTime)
      
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.2)
      
      // Second beep
      setTimeout(() => {
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.type = 'square'
        osc2.frequency.setValueAtTime(1000, ctx.currentTime)
        gain2.gain.setValueAtTime(0.4, ctx.currentTime)
        osc2.start(ctx.currentTime)
        osc2.stop(ctx.currentTime + 0.2)
      }, 250)
    } catch (e) {
      console.error('[v0] Error playing notification:', e)
    }
  }, [])

  // Update time every minute for order age display
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // WhatsApp unread poller — counts open conversations whose last message is
  // inbound (i.e. customer is waiting on a reply). Lightweight: one GET every
  // 20s. When the WhatsApp panel is open, it has its own 15s polling loop,
  // so this acts as a global indicator even while the operator is on another tab.
  useEffect(() => {
    let cancelled = false
    const computeUnread = async () => {
      try {
        const res = await fetch("/api/whatsapp/conversations", { cache: "no-store" })
        if (!res.ok) return
        const j = await res.json()
        if (cancelled) return
        const count = (j?.conversations ?? []).filter(
          (c: any) => c?.status === "open" && c?.last_message?.direction === "inbound",
        ).length
        setWhatsappUnreadCount(count)
      } catch {
        /* silent — UI just won't flash */
      }
    }
    computeUnread()
    const iv = setInterval(computeUnread, 20_000)
    return () => {
      cancelled = true
      clearInterval(iv)
    }
  }, [])

  // Real-time subscription for order updates
  useEffect(() => {
    // Build filter based on restaurant selection
    const filter = restaurantFilter !== "all" 
      ? `restaurant_id=eq.${restaurantFilter}`
      : undefined

    channelRef.current = supabase
      .channel("csr_dispatch_orders_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            // Fetch the order with basic relations (using anon key)
            const { data: newOrder } = await supabase
              .from("orders")
              .select(`
                *,
                order_items (id, item_name, quantity, unit_price, total_price, selected_options),
                restaurants (id, name, slug, logo_url)
              `)
              .eq("id", payload.new.id)
              .single()
            
            if (newOrder) {
              // Enrich with full restaurant data from the restaurants prop (has all fields from server)
              const fullRestaurant = restaurants.find(r => r.id === newOrder.restaurant_id)
              const enrichedOrder = {
                ...newOrder,
                restaurants: fullRestaurant || newOrder.restaurants
              } as Order
              
              setOrders(prev => {
                // Check if order already exists
                if (prev.some(o => o.id === enrichedOrder.id)) return prev
                // Play notification sound for new order
                playNotificationSound()
                return [{ ...enrichedOrder, tent: "online_ordering" as const }, ...prev]
              })
            }
          } else if (payload.eventType === "UPDATE") {
            // OPTIMISTIC UPDATE: Immediately merge payload data with existing order
            // This provides instant feedback while we fetch full data in background
            const updatedFields = payload.new
            
            setOrders(prev => prev.map(order => {
              if (order.id !== payload.new.id) return order
              // Merge the updated fields with existing order
              // IMPORTANT: Preserve order_items and restaurants from local state
              // since they are managed separately and not in the payload
              return { 
                ...order, 
                ...updatedFields,
                order_items: order.order_items, // Preserve local order_items
                restaurants: order.restaurants  // Preserve restaurant relation
              }
            }))
            
            // Update selected order immediately too
            if (selectedOrder?.id === payload.new.id) {
              setSelectedOrder(prev => prev ? { 
                ...prev, 
                ...updatedFields,
                order_items: prev.order_items,
                restaurants: prev.restaurants
              } : prev)
            }
            
            // If restaurant_id changed, update the restaurant relation from our restaurants prop
            if (updatedFields.restaurant_id !== undefined) {
              const fullRestaurant = restaurants.find(r => r.id === updatedFields.restaurant_id)
              if (fullRestaurant) {
                setOrders(prev => prev.map(order => 
                  order.id === payload.new.id 
                    ? { ...order, restaurants: fullRestaurant } 
                    : order
                ))
                if (selectedOrder?.id === payload.new.id) {
                  setSelectedOrder(prev => prev ? { ...prev, restaurants: fullRestaurant } : prev)
                }
              }
            }
          } else if (payload.eventType === "DELETE") {
            setOrders(prev => prev.filter(order => order.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
}, [supabase, restaurantFilter, selectedOrder?.id, playNotificationSound])
  
  // Real-time subscription for order messages (to show unread indicator from KDS)
  useEffect(() => {
    const messagesChannel = supabase
      .channel("csr_messages_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_messages",
        },
        (payload) => {
          const newMessage = payload.new as { order_id: string; sender_type: string }
          // Only show unread indicator for messages from KDS (not from CSR itself)
          if (newMessage.sender_type === "kds") {
            // Don't mark as unread if that chat is currently open
            if (newMessage.order_id !== openChatOrderId) {
              setOrdersWithUnreadMessages(prev => {
                const newSet = new Set(prev)
                newSet.add(newMessage.order_id)
                return newSet
              })
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(messagesChannel) }
  }, [supabase, openChatOrderId])
  
  // Fallback polling every 5 seconds for faster updates
  useEffect(() => {
    const pollInterval = setInterval(() => {
      refreshOrders(true) // Silent refresh
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [])

  // Refresh orders
  const refreshOrders = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true)
    try {
      const { data: freshOrders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (id, item_name, quantity, unit_price, total_price, selected_options),
          restaurants (id, name, slug, logo_url, shipday_api_key, eatabit_enabled, eatabit_printer_id, payment_type, order_notification_method)
        `)
        .order("created_at", { ascending: false })
        .limit(200)
      if (ordersError) console.error("[dispatch] orders error:", ordersError)

      const { data: freshCateringOrders, error: cateringError } = await supabase
        .from("catering_orders")
        .select(`*, catering_restaurants (id, name, slug, logo_url)`)
        .order("created_at", { ascending: false })
        .limit(100)
      if (cateringError) console.error("[dispatch] catering error:", cateringError)

      const normalized = [
        ...(freshOrders || []).map(o => ({ ...o, tent: "online_ordering" as const })),
        ...(freshCateringOrders || []).map(normalizeCateringOrder),
      ]
      setOrders(normalized)
    } catch (error) {
      console.error("Error refreshing orders:", error)
    } finally {
      if (!silent) setIsRefreshing(false)
    }
  }, [supabase, restaurantFilter, restaurants])

// Update order status
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId)
    
    // IMMEDIATE optimistic update before DB call
    const updatedAt = new Date().toISOString()
    setOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, status: newStatus, updated_at: updatedAt } : order
    ))
    // Also update selectedOrder immediately
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus, updated_at: updatedAt } : prev)
    }
    
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus, updated_at: updatedAt })
        .eq("id", orderId)
      
      if (error) throw error
    } catch (error) {
      console.error("Error updating order status:", error)
      // Revert optimistic update on error
      refreshOrders(true)
      alert("Error al actualizar el estado de la orden")
    } finally {
      setUpdatingOrderId(null)
    }
  }

  // Cancel order with reason
  const cancelOrder = async () => {
    if (!selectedOrder || !cancelReason.trim()) return

    setUpdatingOrderId(selectedOrder.id)
    try {
      const { error } = await supabase
        .from("orders")
        .update({ 
          status: "cancelled", 
          special_instructions: `${selectedOrder.special_instructions || ""}\n[CANCELADO: ${cancelReason}]`.trim(),
          updated_at: new Date().toISOString() 
        })
        .eq("id", selectedOrder.id)

      if (error) throw error

      setOrders(prev => prev.map(order =>
        order.id === selectedOrder.id ? { ...order, status: "cancelled" } : order
      ))
      setShowCancelModal(false)
      setShowOrderModal(false)
      setCancelReason("")
      setSelectedOrder(null)
    } catch (error) {
      console.error("Error cancelling order:", error)
      alert("Error al cancelar la orden")
    } finally {
      setUpdatingOrderId(null)
    }
  }

  // Process refund - handles both Stripe and ATH Móvil
  const processRefund = async () => {
    if (!selectedOrder || !refundAmount || !refundReason.trim()) return
    
    const amountCents = Math.round(parseFloat(refundAmount) * 100)
    if (isNaN(amountCents) || amountCents <= 0) {
      alert("Por favor ingrese un monto válido")
      return
    }

    // Determine which payment method was used
    const isStripe = !!selectedOrder.stripe_payment_intent_id
    const isATH = !!selectedOrder.athmovil_reference_number
    
    if (!isStripe && !isATH) {
      alert("Esta orden no tiene un método de pago válido para reembolso")
      return
    }

    setIsProcessingPayment(true)
    try {
      // Use the appropriate refund API based on payment method
      const endpoint = isStripe ? "/api/stripe/refund" : "/api/athmovil/refund"
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          amountCents,
          reason: refundReason,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert(`Reembolso de $${refundAmount} procesado exitosamente v����a ${isStripe ? "Stripe" : "ATH Móvil"}`)
        setShowRefundModal(false)
        setRefundAmount("")
        setRefundReason("")
        refreshOrders()
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error("Error processing refund:", error)
      alert("Error al procesar el reembolso")
    } finally {
      setIsProcessingPayment(false)
    }
  }

  // Process additional charge
  const processAdditionalCharge = async () => {
    if (!selectedOrder || !chargeAmount || !chargeReason.trim()) return
    
    const amountCents = Math.round(parseFloat(chargeAmount) * 100)
    if (isNaN(amountCents) || amountCents <= 0) {
      alert("Por favor ingrese un monto válido")
      return
    }

    setIsProcessingPayment(true)
    try {
      const response = await fetch("/api/stripe/additional-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          amountCents,
          reason: chargeReason,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert(`Cargo adicional de $${chargeAmount} procesado exitosamente`)
        setShowChargeModal(false)
        setChargeAmount("")
        setChargeReason("")
        refreshOrders()
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error("Error processing additional charge:", error)
      alert("Error al procesar el cargo adicional")
    } finally {
      setIsProcessingPayment(false)
    }
  }

  // Send order to Shipday
  const sendToShipday = async (order: Order) => {
    setUpdatingOrderId(order.id)
    try {
      const response = await fetch("/api/shipday/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          restaurantId: order.restaurant_id,
          branchId: order.branch_id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        const shipdayId = result.shipdayOrderId
        setOrders(prev => prev.map(o =>
          o.id === order.id ? { ...o, shipday_order_id: shipdayId } : o
        ))
      } else {
        throw new Error(result.error || "Error sending to Shipday")
      }
    } catch (error) {
      console.error("Error sending to Shipday:", error)
      alert(`Error al enviar a Shipday: ${(error as Error).message}`)
    } finally {
setUpdatingOrderId(null)
    }
  }

  // Send order to Eatabit cloud printer
  const sendToEatabit = async (order: Order & { tent?: "online_ordering" | "catering"; catering_restaurant_id?: string }) => {
    setUpdatingOrderId(order.id)
    try {
      // Determine order type based on tent property
      const isCatering = order.tent === "catering"
      const response = await fetch("/api/eatabit/print-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isCatering
            ? { cateringOrderId: order.id, orderType: "catering" }
            : { orderId: order.id, orderType: "delivery" }
        ),
      })

      const result = await response.json()

      if (result.success) {
        // Optimistically update order with printed status
        setOrders(prev => prev.map(o =>
          o.id === order.id 
            ? { ...o, eatabit_job_id: result.jobId, eatabit_status: "queued", printed_at: new Date().toISOString() } 
            : o
        ))
        // Show success feedback
        alert("Orden enviada a la impresora")
      } else {
        throw new Error(result.error || "Error sending to Eatabit")
      }
    } catch (error) {
      console.error("Error sending to Eatabit:", error)
      alert(`Error al enviar a impresora: ${(error as Error).message}`)
    } finally {
      setUpdatingOrderId(null)
    }
  }
  
  // Send order to Restaurant/KDS
  const sendToRestaurant = async (order: Order) => {
    setUpdatingOrderId(order.id)
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          sent_to_restaurant: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", order.id)

      if (error) throw error

      setOrders(prev => prev.map(o =>
        o.id === order.id ? { ...o, sent_to_restaurant: true } : o
      ))
      
      if (selectedOrder?.id === order.id) {
        setSelectedOrder({ ...selectedOrder, sent_to_restaurant: true })
      }
    } catch (error) {
      console.error("Error sending to restaurant:", error)
    } finally {
      setUpdatingOrderId(null)
    }
  }

// Send to Restaurant - keeps confirmed status so it appears in KDS "Nuevos" section
  // Restaurant staff will click "Preparar" on KDS to move to "Preparando"
  const sendToRestaurantAndPrepare = async (order: Order) => {
    setUpdatingOrderId(order.id)
    const updatedAt = new Date().toISOString()
    
    // IMMEDIATE optimistic update before DB call
    setOrders(prev => prev.map(o =>
      o.id === order.id ? { ...o, sent_to_restaurant: true, updated_at: updatedAt } : o
    ))
    if (selectedOrder?.id === order.id) {
      setSelectedOrder({ ...selectedOrder, sent_to_restaurant: true, updated_at: updatedAt })
    }
    
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          sent_to_restaurant: true,
          updated_at: updatedAt
        })
        .eq("id", order.id)
      
      if (error) throw error
    } catch (error) {
      console.error("Error sending to restaurant:", error)
      // Revert on error
      refreshOrders(true)
    } finally {
      setUpdatingOrderId(null)
    }
  }

  // Get Shipday tracking info
  const getShipdayStatus = async (orderId: string, shipdayOrderId: string) => {
    try {
      const response = await fetch(`/api/shipday/track?orderId=${shipdayOrderId}`)
      const result = await response.json()
      
      if (result.success) {
        setShipdayStatus(prev => ({
          ...prev,
          [orderId]: result.tracking
        }))
      }
    } catch (error) {
      console.error("Error fetching Shipday status:", error)
    }
  }

  // Helper to check if order is current vs future
  const isCurrentOrder = (order: Order) => {
    const PREP_WINDOW_MINUTES = 60
    const now = new Date()
    const nowPR = new Date(now.toLocaleString("en-US", { timeZone: "America/Puerto_Rico" }))
    const orderDateStr = order.delivery_date
    
    if (order.delivery_time) {
      const [hours, minutes] = order.delivery_time.split(":").map(Number)
      const orderDateTime = new Date(`${orderDateStr}T00:00:00`)
      orderDateTime.setHours(hours, minutes, 0, 0)
      const showAtTime = new Date(orderDateTime.getTime() - PREP_WINDOW_MINUTES * 60 * 1000)
      return nowPR >= showAtTime
    } else {
      const orderDate = new Date(orderDateStr)
      const todayPR = new Date(nowPR)
      orderDate.setHours(0, 0, 0, 0)
      todayPR.setHours(0, 0, 0, 0)
      return orderDate <= todayPR
    }
  }

// Filter orders based on view and search
  const filteredOrders = orders.filter(order => {
  // Restaurant filter - handles tent-prefixed IDs
  if (restaurantFilter !== "all") {
    const orderTent = (order as any).tent
    if (restaurantFilter.startsWith("delivery_")) {
      const restaurantId = restaurantFilter.replace("delivery_", "")
      if (orderTent !== "online_ordering" || order.restaurant_id !== restaurantId) return false
    } else if (restaurantFilter.startsWith("catering_")) {
      const restaurantId = restaurantFilter.replace("catering_", "")
      // Catering orders use catering_restaurant_id field
      if (orderTent !== "catering" || (order as any).catering_restaurant_id !== restaurantId) return false
    }
  }
    
    // View filter
    if (activeView === "current") {
      if (!isCurrentOrder(order)) return false
      if (order.status === "completed" || order.status === "cancelled") return false
    } else if (activeView === "future") {
      if (isCurrentOrder(order)) return false
      if (order.status === "completed" || order.status === "cancelled") return false
    } else if (activeView === "history") {
      if (order.status !== "completed" && order.status !== "cancelled") return false
    }
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        order.order_number?.toLowerCase().includes(search) ||
        order.customer_name?.toLowerCase().includes(search) ||
        order.customer_phone?.includes(search) ||
        order.restaurants?.name?.toLowerCase().includes(search)
      )
    }
    
    return true
  })

  const sortedFilteredOrders = activeView === "future"
    ? [...filteredOrders].sort((a, b) => {
        const dateA = new Date(`${a.delivery_date}${a.delivery_time ? 'T' + a.delivery_time : ''}`).getTime()
        const dateB = new Date(`${b.delivery_date}${b.delivery_time ? 'T' + b.delivery_time : ''}`).getTime()
        return dateA - dateB
      })
    : filteredOrders

// Group orders by status for Kanban
  const getOrdersByColumn = (columnStatuses: string[]) => {
    return sortedFilteredOrders.filter(order => {
      const statusMatch = columnStatuses.includes(order.status)
      const tentMatch = tentFilter === "all" || (order as any).tent === tentFilter
      return statusMatch && tentMatch
    })
  }

  // Count orders
  const currentCount = orders.filter(o => 
    isCurrentOrder(o) && o.status !== "completed" && o.status !== "cancelled"
  ).length
  const futureCount = orders.filter(o => 
    !isCurrentOrder(o) && o.status !== "completed" && o.status !== "cancelled"
  ).length
  const historyCount = orders.filter(o => 
    o.status === "completed" || o.status === "cancelled"
  ).length

  // Count pending orders (pending + confirmed not yet sent to restaurant)
  const pendingOrders = orders.filter(o => 
    isCurrentOrder(o) && (o.status === "pending" || (o.status === "confirmed" && !o.sent_to_restaurant))
  )
  const pendingCount = pendingOrders.length

  // Auto-expand "Pendientes" when new orders arrive, auto-collapse when empty
  useEffect(() => {
    const prevCount = prevPendingCountRef.current
    
    // New orders arrived - expand the section
    if (pendingCount > prevCount && pendingCount > 0) {
      setCollapsedSections(prev => {
        const next = new Set(prev)
        next.delete("pending")
        return next
      })
    }
    
    // All pending orders processed - collapse the section
    if (pendingCount === 0 && prevCount > 0) {
      setCollapsedSections(prev => {
        const next = new Set(prev)
        next.add("pending")
        return next
      })
    }
    
    prevPendingCountRef.current = pendingCount
  }, [pendingCount])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/auth/login"
  }

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order)
    setShowOrderModal(true)
    if (order.shipday_order_id) {
      getShipdayStatus(order.id, order.shipday_order_id)
    }
  }

  // Open edit modal
  const openEditOrder = async (order: Order) => {
    setEditingOrder(order)
    setEditForm({
      customer_name: order.customer_name || "",
      customer_phone: order.customer_phone || "",
      customer_email: order.customer_email || "",
      delivery_address: order.delivery_address || "",
      apt_suite: order.apt_suite || "",
      delivery_city: order.delivery_city || "",
      delivery_zip: order.delivery_zip || "",
      special_instructions: order.special_instructions || "",
      tip: order.tip || 0,
    })
    // Initialize items for editing
    setEditItems(
      (order.order_items || []).map(item => ({
        id: item.id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price || (item.total_price / item.quantity),
        total_price: item.total_price,
        isNew: false,
        isDeleted: false,
      }))
    )
    setShowEditModal(true)
    setShowAddItemDropdown(false)
    
    // Fetch restaurant menu items for adding new items
    if (order.restaurant_id) {
      const { data: menuItems, error: menuError } = await supabase
        .from("menu_items")
        .select("id, name, price")
        .eq("restaurant_id", order.restaurant_id)
        .order("name")
      
      if (menuError) {
        console.error("[v0] Error fetching menu items:", menuError)
      }
      setRestaurantMenuItems(menuItems || [])
    }
  }

  // Save order edits
  const saveOrderEdits = async () => {
    if (!editingOrder) return
    
    setIsSavingEdit(true)
    try {
      const IVU_RATE = 0.115
      
      // Calculate new subtotal from items
      const activeItems = editItems.filter(item => !item.isDeleted)
      const newSubtotal = activeItems.reduce((sum, item) => sum + item.total_price, 0)
      const newTax = newSubtotal * IVU_RATE
      const deliveryFee = editingOrder.delivery_fee || 0
      const dispatchFee = editingOrder.dispatch_fee || 0
      const newTotal = newSubtotal + newTax + deliveryFee + dispatchFee + editForm.tip

      // Update order
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          customer_name: editForm.customer_name.trim(),
          customer_phone: editForm.customer_phone.trim(),
          customer_email: editForm.customer_email.trim() || null,
          delivery_address: editForm.delivery_address.trim() || null,
          apt_suite: editForm.apt_suite.trim() || null,
          delivery_city: editForm.delivery_city.trim() || null,
          delivery_zip: editForm.delivery_zip.trim() || null,
          special_instructions: editForm.special_instructions.trim() || null,
          subtotal: newSubtotal,
          tax: newTax,
          tip: editForm.tip,
          total: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingOrder.id)

      if (orderError) throw orderError

      // Handle deleted items
      const deletedItems = editItems.filter(item => item.isDeleted && !item.isNew)
      for (const item of deletedItems) {
        await supabase.from("order_items").delete().eq("id", item.id)
      }

      // Handle updated items (quantity changes)
      const updatedItems = editItems.filter(item => !item.isDeleted && !item.isNew)
      for (const item of updatedItems) {
        const originalItem = editingOrder.order_items?.find(oi => oi.id === item.id)
        if (originalItem && (originalItem.quantity !== item.quantity)) {
          await supabase
            .from("order_items")
            .update({
              quantity: item.quantity,
              total_price: item.total_price,
            })
            .eq("id", item.id)
        }
      }

      // Handle new items
      const newItems = editItems.filter(item => item.isNew && !item.isDeleted)
      for (const item of newItems) {
        await supabase.from("order_items").insert({
          order_id: editingOrder.id,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        })
      }

      // Update local state with new order data
      setOrders(prev => prev.map(order =>
        order.id === editingOrder.id 
          ? { 
              ...order, 
              customer_name: editForm.customer_name.trim(),
              customer_phone: editForm.customer_phone.trim(),
              customer_email: editForm.customer_email.trim() || null,
              delivery_address: editForm.delivery_address.trim() || null,
              apt_suite: editForm.apt_suite.trim() || null,
              delivery_city: editForm.delivery_city.trim() || null,
              delivery_zip: editForm.delivery_zip.trim() || null,
              special_instructions: editForm.special_instructions.trim() || null,
              subtotal: newSubtotal,
              tax: newTax,
              tip: editForm.tip,
              total: newTotal,
              order_items: activeItems.map(item => ({
                id: item.id,
                item_name: item.item_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
              })),
            } 
          : order
      ))

      setShowEditModal(false)
      setEditingOrder(null)
      alert("Orden actualizada correctamente")
    } catch (error) {
      console.error("Error saving order edits:", error)
      alert("Error al guardar los cambios")
    } finally {
      setIsSavingEdit(false)
    }
  }
  
  // Helper functions for editing items
  const updateItemQuantity = (itemId: string, delta: number) => {
    setEditItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(1, item.quantity + delta)
        return {
          ...item,
          quantity: newQty,
          total_price: item.unit_price * newQty,
        }
      }
      return item
    }))
  }
  
  const deleteItem = (itemId: string) => {
    setEditItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, isDeleted: true } : item
    ))
  }
  
  const restoreItem = (itemId: string) => {
    setEditItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, isDeleted: false } : item
    ))
  }
  
  const addNewItem = (menuItem: { id: string; name: string; price: number }) => {
    const newItem = {
      id: `new-${Date.now()}`,
      item_name: menuItem.name,
      quantity: 1,
      unit_price: menuItem.price,
      total_price: menuItem.price,
      isNew: true,
      isDeleted: false,
    }
    setEditItems(prev => [...prev, newItem])
    setShowAddItemDropdown(false)
  }
  
  // Calculate totals for edit preview
  const calculateEditTotals = () => {
    const IVU_RATE = 0.115
    const activeItems = editItems.filter(item => !item.isDeleted)
    const subtotal = activeItems.reduce((sum, item) => sum + item.total_price, 0)
    const tax = subtotal * IVU_RATE
    const deliveryFee = editingOrder?.delivery_fee || 0
    const dispatchFee = editingOrder?.dispatch_fee || 0
    const total = subtotal + tax + deliveryFee + dispatchFee + editForm.tip
    return { subtotal, tax, deliveryFee, dispatchFee, total }
  }

// Horizontal Order Row component
  const OrderRow = ({ order }: { order: Order }) => {
    const [showItems, setShowItems] = useState(false)
    const isSentToShipday = !!order.shipday_order_id
    const isUpdating = updatingOrderId === order.id
    
    // Calculate exact order age in H:MM format
    const ageMs = currentTime.getTime() - new Date(order.created_at).getTime()
    const ageMinutes = Math.floor(ageMs / 60000)
    const hours = Math.floor(ageMinutes / 60)
    const mins = ageMinutes % 60
    const orderAge = hours > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${mins}m`
    const isUrgent = ageMinutes > 45
    
    // Determine row background - ready orders get green pulsing background
    const isReady = order.status === "ready"
    const urgencyBg = isReady 
      ? "bg-green-100 border-green-400 ring-2 ring-green-400/50" 
      : isUrgent 
        ? "bg-red-50 border-red-200" 
        : ageMinutes > 20 
          ? "bg-orange-50 border-orange-200" 
          : "bg-white border-gray-200"

    // Get the action button based on status
    const getActionButton = () => {
      if (order.status === "pending") {
        return (
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 h-8 text-xs whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, "confirmed") }}
          >
            <CheckCircle className="h-3 w-3 mr-1" /> Confirmar
          </Button>
        )
      }
      if (order.status === "confirmed" && !order.sent_to_restaurant) {
        return (
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 h-8 text-xs whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); sendToRestaurantAndPrepare(order) }}
          >
            <Send className="h-3 w-3 mr-1" /> Enviar
          </Button>
        )
      }
      if (order.status === "confirmed" && order.sent_to_restaurant) {
        return (
          <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded whitespace-nowrap">
            <Clock className="h-3 w-3 inline mr-1" />
            Esperando...
          </span>
        )
      }
      if (order.status === "preparing") {
        if (order.delivery_type === "delivery") {
          // Not sent to Shipday yet - show "Enviar a Shipday"
          if (!isSentToShipday) {
            return (
              <Button
                size="sm"
                className="bg-purple-500 hover:bg-purple-600 h-8 text-xs whitespace-nowrap"
                onClick={(e) => { e.stopPropagation(); sendToShipday(order) }}
              >
                <Truck className="h-3 w-3 mr-1" /> Enviar a Shipday
              </Button>
            )
          }
          // Sent to Shipday - show "En Shipday" badge
          return (
            <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded whitespace-nowrap">
              <Truck className="h-3 w-3 inline mr-1" />
              En Shipday
            </span>
          )
        }
        return (
          <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded whitespace-nowrap">
            <ChefHat className="h-3 w-3 inline mr-1" />
            Preparando
          </span>
        )
      }
      if (order.status === "ready") {
        // For delivery orders
        if (order.delivery_type === "delivery") {
          // Not sent to Shipday yet - show "Enviar a Shipday" with emphasis
          if (!isSentToShipday) {
            return (
              <Button
                size="sm"
                className="bg-purple-500 hover:bg-purple-600 h-8 text-xs whitespace-nowrap animate-pulse"
                onClick={(e) => { e.stopPropagation(); sendToShipday(order) }}
              >
                <Truck className="h-3 w-3 mr-1" /> Enviar a Shipday
              </Button>
            )
          }
          // Sent to Shipday and ready - show "Driver Salió" button
          return (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 h-8 text-xs whitespace-nowrap animate-pulse"
              onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, "out_for_delivery") }}
            >
              <Truck className="h-3 w-3 mr-1" /> Driver Salió
            </Button>
          )
        }
        // For pickup: customer picked up → completed
        return (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 h-8 text-xs whitespace-nowrap animate-pulse"
            onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, "completed") }}
          >
            <CheckCircle className="h-3 w-3 mr-1" /> Recogido
          </Button>
        )
      }
      if (order.status === "out_for_delivery") {
        return (
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 h-8 text-xs whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, "completed") }}
          >
            <CheckCircle className="h-3 w-3 mr-1" /> Entregado
          </Button>
        )
      }
      if (order.status === "completed") {
        return (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded whitespace-nowrap">
            Completado
          </span>
        )
      }
      return null
    }

    return (
      <div className={`${urgencyBg} border rounded-lg overflow-hidden ${isUpdating ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Main horizontal row */}
        <div 
          className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50/50"
          onClick={() => openOrderDetail(order)}
        >
          {/* Restaurant */}
          <div className="w-40 flex-shrink-0">
            <span className="text-xs font-semibold text-slate-700 truncate block">
              {order.restaurants?.name || "Restaurante"}
            </span>
            {order.restaurants?.payment_type && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[9px] px-1 py-0 mt-0.5 font-semibold uppercase",
                  order.restaurants.payment_type === "pop" && "border-orange-500 text-orange-600 bg-orange-50",
                  order.restaurants.payment_type === "ach" && "border-blue-500 text-blue-600 bg-blue-50",
                  order.restaurants.payment_type === "ath" && "border-purple-500 text-purple-600 bg-purple-50",
                  order.restaurants.payment_type === "pbp" && "border-green-500 text-green-600 bg-green-50",
  order.restaurants.payment_type === "poo" && "border-cyan-500 text-cyan-600 bg-cyan-50",
  order.restaurants.payment_type === "pgc" && "border-pink-500 text-pink-600 bg-pink-50"
                )}
              >
                {order.restaurants.payment_type}
              </Badge>
            )}
          </div>
          
{/* Tent Badge */}
{(order as any).tent === "catering" && (
  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500 text-white uppercase tracking-wide shrink-0">
    Catering
  </span>
)}
{(order as any).tent === "online_ordering" && (
  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600 text-white uppercase tracking-wide shrink-0">
    Online
  </span>
)}
{(order as any).tent === "subscriptions" && (
  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-600 text-white uppercase tracking-wide shrink-0">
    Suscripción
  </span>
)}

{/* Order # + Timer */}
<div className="flex items-center gap-2 w-48 flex-shrink-0">
  <span className="font-bold text-sm">#{order.order_number?.slice(-4) || order.id.slice(0, 4)}</span>
  {isCurrentOrder(order) ? (
    <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${
    isUrgent ? "bg-red-500 text-white" : ageMinutes > 20 ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-700"
    }`}>
    {orderAge}
    </span>
  ) : (
    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded whitespace-nowrap">
      {new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", month: "short", day: "numeric" }).format(new Date(order.delivery_date + 'T00:00:00'))}
      {order.delivery_time ? ` · ${order.delivery_time.slice(0, 5)}` : ""}
    </span>
  )}
  </div>
          
{/* Delivery/Pickup Badge */}
          <Badge
          variant={order.delivery_type === "delivery" ? "default" : "secondary"}
          className="text-[9px] px-1.5 py-0.5 flex-shrink-0 tracking-tight"
          >
          {order.delivery_type === "delivery" ? "Delivery" : "Pickup"}
          </Badge>
          
          {/* LISTO! Alert Badge for ready orders */}
          {isReady && (
            <Badge className="bg-green-600 text-white text-[10px] px-2 py-0.5 flex-shrink-0 animate-pulse font-bold">
              LISTO!
            </Badge>
          )}
          
          {/* Customer Info - Name, Phone, Address */}
          <div className="flex-1 min-w-0 flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{order.customer_name}</span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {order.customer_phone}
              </span>
            </div>
            {order.delivery_type === "delivery" && order.delivery_address && (
              <span className="text-xs text-gray-500 truncate max-w-[200px] flex items-center gap-1">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                {order.delivery_address}
              </span>
            )}
          </div>
          
          {/* Items dropdown */}
          <button
            type="button"
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors flex-shrink-0 ${
              showItems ? "bg-slate-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-600"
            }`}
            onClick={(e) => { e.stopPropagation(); setShowItems(!showItems) }}
          >
            <Package className="h-3 w-3" />
            {order.order_items?.length || 0}
            <ChevronDown className={`h-3 w-3 transition-transform ${showItems ? "rotate-180" : ""}`} />
          </button>
          
          {/* Chat Button - just a button that opens the modal */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleChatOpen(order.id) }}
            className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              ordersWithUnreadMessages.has(order.id)
                ? "bg-red-100 hover:bg-red-200 text-red-600"
                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
            }`}
            title="Chat con restaurante"
          >
            <MessageCircle className="h-4 w-4" />
            {ordersWithUnreadMessages.has(order.id) && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
          
          {/* Edit Order Button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openEditOrder(order) }}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-600 transition-colors"
            title="Editar orden"
          >
            <Pencil className="h-4 w-4" />
          </button>
          
{/* Print Button - Shows Eatabit or Tablet based on restaurant config */}
  {(order.restaurants?.eatabit_enabled || order.restaurants?.order_notification_method === "eatabit") ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); sendToEatabit(order) }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                order.eatabit_job_id
                  ? "bg-green-100 hover:bg-green-200 text-green-700"
                  : "bg-blue-100 hover:bg-blue-200 text-blue-700"
              }`}
              title={order.eatabit_job_id ? "Re-imprimir (Eatabit)" : "Enviar a Eatabit"}
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{order.eatabit_job_id ? "Re-imprimir" : "Eatabit"}</span>
            </button>
          ) : !order.sent_to_restaurant && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); sendToRestaurant(order) }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors bg-purple-100 hover:bg-purple-200 text-purple-700"
              title="Enviar a Tablet/KDS"
            >
              <MonitorPlay className="h-3.5 w-3.5" />
              <span>Tablet</span>
            </button>
          )}
          
          {/* Status Phase Buttons */}
          <div className="flex items-center rounded-md overflow-hidden border border-gray-200" onClick={(e) => e.stopPropagation()}>
            {[
              { value: "pending", label: "Nuevo", color: "bg-orange-500", hoverColor: "hover:bg-orange-100" },
              { value: "preparing", label: "Prep", color: "bg-blue-500", hoverColor: "hover:bg-blue-100" },
              { value: "ready", label: "Listo", color: "bg-green-500", hoverColor: "hover:bg-green-100" },
              { value: "delivered", label: "Recog", color: "bg-gray-500", hoverColor: "hover:bg-gray-100" },
            ].map((phase, idx) => {
              const isActive = order.status === phase.value || (phase.value === "pending" && order.status === "confirmed")
              return (
                <button
                  key={phase.value}
                  type="button"
                  onClick={() => {
                    if (!isActive) updateOrderStatus(order.id, phase.value)
                  }}
                  className={`px-1.5 py-1 text-[9px] font-bold tracking-tight transition-colors ${
                    isActive 
                      ? `${phase.color} text-white` 
                      : `bg-white text-gray-400 ${phase.hoverColor}`
                  } ${idx > 0 ? "border-l border-gray-200" : ""}`}
                  title={phase.label}
                >
                  {phase.label}
                </button>
              )
            })}
          </div>
          
          {/* Order Summary Button */}
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); openOrderDetail(order) }}
            title="Ver resumen de orden"
          >
            <FileText className="h-3 w-3" />
          </button>
          
          {/* Total */}
          <span className="font-bold text-sm w-20 text-right flex-shrink-0">${order.total?.toFixed(2)}</span>
          
          {/* Action Button */}
          <div className="flex-shrink-0 w-36 flex justify-end">
            {getActionButton()}
          </div>
        </div>
        
        {/* Expandable items with options/choices */}
        {showItems && order.order_items && order.order_items.length > 0 && (
          <div className="bg-gray-50 border-t px-4 py-2">
            <div className="space-y-1.5">
              {order.order_items.map((item, idx) => (
                <div key={idx} className="text-xs bg-white rounded px-3 py-2 border">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">{item.quantity}x</span>
                    <span className="text-gray-800 font-medium">{item.item_name}</span>
                  </div>
                  {/* Show selected options/choices */}
                  {item.selected_options && Object.keys(item.selected_options).length > 0 && (
                    <div className="ml-6 mt-1 text-[11px] text-gray-600">
                      {Object.entries(item.selected_options).map(([optionName, choices]) => (
                        <div key={optionName} className="flex gap-1">
                          <span className="text-gray-400">{optionName}:</span>
                          <span className="font-medium text-gray-700">
                            {Array.isArray(choices) ? choices.join(", ") : String(choices)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Collapsible Section component
  const Section = ({ section }: { section: typeof SECTIONS[0] }) => {
    const sectionOrders = section.id === "completed" 
      ? orders.filter(o => o.status === "completed" && new Date(o.updated_at).toDateString() === new Date().toDateString())
      : getOrdersByColumn(section.statuses)
    const Icon = section.icon
    const isCollapsed = collapsedSections.has(section.id)
    
    // Apply search and restaurant filter
    const filteredSectionOrders = sectionOrders.filter(order => {
      const matchesSearch = !searchTerm || 
        order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_phone?.includes(searchTerm)
      // Restaurant filter - handles tent-prefixed IDs
  let matchesRestaurant = restaurantFilter === "all"
  if (!matchesRestaurant) {
    const orderTent = (order as any).tent
    if (restaurantFilter.startsWith("delivery_")) {
      const restaurantId = restaurantFilter.replace("delivery_", "")
      matchesRestaurant = orderTent === "online_ordering" && order.restaurant_id === restaurantId
    } else if (restaurantFilter.startsWith("catering_")) {
      const restaurantId = restaurantFilter.replace("catering_", "")
      matchesRestaurant = orderTent === "catering" && (order as any).catering_restaurant_id === restaurantId
    }
  }
      return matchesSearch && matchesRestaurant
    })

    return (
      <div className="mb-3">
        {/* Section Header */}
        <button
          type="button"
          onClick={() => toggleSection(section.id)}
          className={`w-full ${section.color} ${section.textColor} px-4 py-2.5 rounded-lg flex items-center justify-between transition-all hover:opacity-90 active:scale-[0.995]`}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" />
            <span className="font-bold text-sm uppercase tracking-wide">{section.label}</span>
            <Badge className="bg-white/20 text-white border-0 text-xs px-2">
              {filteredSectionOrders.length}
            </Badge>
          </div>
          <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`} />
        </button>
        
        {/* Section Content */}
        {!isCollapsed && (
          <div className="mt-2 space-y-1">
            {filteredSectionOrders.length === 0 ? (
              <div className="text-center py-6 text-gray-400 bg-gray-100 rounded-lg border border-dashed border-gray-300">
                <Icon className="h-6 w-6 mx-auto mb-1 opacity-50" />
                <p className="text-sm">Sin ordenes</p>
              </div>
            ) : (
              filteredSectionOrders.map(order => (
                <OrderRow key={order.id} order={order} />
              ))
            )}
          </div>
        )}
      </div>
    )
  }
  
  // Toggle section collapsed state
  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  // Render Kanban Column
  const KanbanColumn = ({ column }: { column: typeof COLUMNS[0] }) => {
    const columnOrders = getOrdersByColumn(column.statuses)
    const Icon = column.icon

    return (
      <div className={`flex-shrink-0 w-72 h-full flex flex-col ${column.bgColor} rounded-lg border ${column.borderColor}`}>
        {/* Column Header */}
        <div className={`${column.color} text-white px-3 py-2 rounded-t-lg flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="font-semibold text-sm">{column.label}</span>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white text-xs">
            {columnOrders.length}
          </Badge>
        </div>

        {/* Column Content - Scrollable */}
        <div className="p-2 space-y-2 flex-1 overflow-y-auto">
          {columnOrders.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Sin órdenes
            </div>
          ) : (
            columnOrders.map(order => (
              <OrderCard key={order.id} order={order} />
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
<header className="bg-slate-800 text-white px-4 py-3 sticky top-0 z-50">
  <div className="flex items-center justify-between">
  <div className="flex items-center gap-4">
  <Link href="https://www.prdelivery.com/super-admin/delivery" className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors" title="Volver a Super Admin">
    <ArrowLeft className="h-5 w-5 text-slate-300" />
  </Link>
  <div className="flex items-center gap-2">
  <Phone className="h-5 w-5 text-teal-400" />
  <span className="font-semibold text-lg">Main Dispatch</span>
  </div>
  
  <div className="flex items-center gap-1 ml-2">
    {[
      { key: "all", label: "Todos" },
      { key: "online_ordering", label: "Online Order" },
      { key: "catering", label: "Catering" },
      { key: "subscriptions", label: "Suscripción" },
    ].map((t) => (
      <button
        key={t.key}
        onClick={() => setTentFilter(t.key as any)}
        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
          tentFilter === t.key
            ? "bg-white text-slate-900"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        {t.label}
      </button>
    ))}
  </div>
  </div>
  
  <div className="flex items-center gap-4">
  <Link href="/csr/order">
  <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                <Phone className="h-4 w-4" />
                CSR Tomar Orden por Teléfono
              </Button>
            </Link>
            <Link href="/csr/menus" className="px-3 py-1.5 text-sm font-medium bg-slate-600 hover:bg-slate-500 text-white rounded">
              Menús
            </Link>
            <span className="text-slate-500 mx-1">|</span>
            <Link href="/admin" className="px-3 py-1.5 text-sm font-medium border border-slate-500 text-slate-300 hover:bg-slate-700 hover:text-white rounded">
              Admin
            </Link>
            <Link href="/super-admin" className="px-3 py-1.5 text-sm font-medium border border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-white rounded">
              Super Admin
            </Link>
          </div>
        </div>
      </header>

      {/* CATERING MODE */}
      {csrMode === "catering" && (
        <div className="p-4 overflow-y-auto h-[calc(100vh-60px)]">
          {!selectedCateringRestaurant ? (
            // Catering restaurant selector
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <UtensilsCrossed className="h-6 w-6 text-amber-500" />
                  Crear Orden de Catering
                </h2>
                <p className="text-slate-600 mt-1">Selecciona un restaurante de catering para comenzar</p>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cateringRestaurants.map((restaurant) => (
                  <button
                    key={restaurant.id}
                    type="button"
                    onClick={() => setSelectedCateringRestaurant(restaurant)}
                    className="bg-white rounded-lg border p-4 text-left hover:border-amber-500 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      {restaurant.logo_url ? (
                        <img
                          src={restaurant.logo_url}
                          alt={restaurant.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                          <UtensilsCrossed className="h-6 w-6 text-amber-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 group-hover:text-amber-600 transition-colors">
                          {restaurant.name}
                        </h3>
                        {restaurant.cuisine_type && (
                          <p className="text-sm text-slate-500">{restaurant.cuisine_type}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          Min. {restaurant.default_lead_time_hours}h anticipacion
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Catering order form
            <div className="max-w-4xl mx-auto">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCateringRestaurant(null)}
                    className="text-slate-600"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Volver
                  </Button>
                  <div className="flex items-center gap-2">
                    {selectedCateringRestaurant.logo_url ? (
                      <img
                        src={selectedCateringRestaurant.logo_url}
                        alt={selectedCateringRestaurant.name}
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <UtensilsCrossed className="h-4 w-4 text-amber-600" />
                      </div>
                    )}
                    <h2 className="text-xl font-bold text-slate-800">
                      {selectedCateringRestaurant.name}
                    </h2>
                  </div>
                </div>
                <Badge className="bg-amber-500 text-white">
                  Min. {selectedCateringRestaurant.default_lead_time_hours}h anticipacion
                </Badge>
              </div>

              {/* Loading state */}
              {cateringDataLoading && (
                <div className="bg-white rounded-lg border p-8 text-center">
                  <RefreshCw className="h-8 w-8 mx-auto mb-4 text-amber-500 animate-spin" />
                  <p className="text-slate-600">Cargando datos del restaurante...</p>
                </div>
              )}

              {/* Error state */}
              {cateringDataError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Error: {cateringDataError}</span>
                  </div>
                </div>
              )}

              {/* Form */}
              {!cateringDataLoading && !cateringDataError && (
                <div className="space-y-6">
                  {/* 1. Branch Selector (only for chain restaurants) */}
                  {selectedCateringRestaurant.is_chain && (
                    <div className="bg-white rounded-lg border p-4">
                      <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-amber-500" />
                        Seleccionar Sucursal
                      </h3>
                      <div className="grid gap-3 md:grid-cols-2">
                        {cateringBranches.map((branch) => (
                          <button
                            key={branch.id}
                            type="button"
                            onClick={() => setCateringSelectedBranch(branch.id)}
                            className={cn(
                              "p-3 rounded-lg border text-left transition-all",
                              cateringSelectedBranch === branch.id
                                ? "border-amber-500 bg-amber-50"
                                : "border-slate-200 hover:border-amber-300"
                            )}
                          >
                            <p className="font-medium text-slate-800">{branch.name}</p>
                            <p className="text-sm text-slate-500">{branch.address}</p>
                            <p className="text-sm text-slate-500">{branch.city}, {branch.state}</p>
                          </button>
                        ))}
                      </div>
                      {!cateringSelectedBranch && (
                        <p className="text-sm text-red-600 mt-2">* Selecciona una sucursal</p>
                      )}
                    </div>
                  )}

                  {/* 2. Event Date and Time */}
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-amber-500" />
                      Fecha y Hora del Evento
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fecha *</label>
                        <Input
                          type="date"
                          value={cateringEventDate}
                          onChange={(e) => setCateringEventDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Hora *</label>
                        <Input
                          type="time"
                          value={cateringEventTime}
                          onChange={(e) => setCateringEventTime(e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                    {cateringDateTimeError && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          {cateringDateTimeError}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 3. Customer Details */}
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <User className="h-5 w-5 text-amber-500" />
                      Datos del Cliente
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                        <Input
                          type="text"
                          value={cateringCustomerName}
                          onChange={(e) => setCateringCustomerName(e.target.value)}
                          placeholder="Nombre completo"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Telefono *</label>
                        <Input
                          type="tel"
                          value={cateringCustomerPhone}
                          onChange={(e) => setCateringCustomerPhone(e.target.value)}
                          placeholder="787-000-0000"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                        <Input
                          type="email"
                          value={cateringCustomerEmail}
                          onChange={(e) => setCateringCustomerEmail(e.target.value)}
                          placeholder="cliente@email.com"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Direccion de Entrega *</label>
                        <Input
                          type="text"
                          value={cateringDeliveryAddress}
                          onChange={(e) => setCateringDeliveryAddress(e.target.value)}
                          placeholder="Direccion completa"
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Service Package Selector (optional) */}
                  {cateringServicePackages.length > 0 && (
                    <div className="bg-white rounded-lg border p-4">
                      <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                        <Package className="h-5 w-5 text-amber-500" />
                        Paquete de Servicio (Opcional)
                      </h3>
                      <div className="grid gap-3 md:grid-cols-2">
                        {cateringServicePackages.map((pkg) => (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => setCateringSelectedPackage(
                              cateringSelectedPackage === pkg.id ? null : pkg.id
                            )}
                            className={cn(
                              "p-3 rounded-lg border text-left transition-all",
                              cateringSelectedPackage === pkg.id
                                ? "border-amber-500 bg-amber-50"
                                : "border-slate-200 hover:border-amber-300"
                            )}
                          >
                            <div className="flex justify-between items-start">
                              <p className="font-medium text-slate-800">{pkg.name}</p>
                              <p className="font-semibold text-amber-600">${pkg.base_price.toFixed(2)}</p>
                            </div>
                            {pkg.description && (
                              <p className="text-sm text-slate-500 mt-1">{pkg.description}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5. Menu Items */}
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-amber-500" />
                      Items del Menu *
                    </h3>
                    {cateringCategories.map((category) => {
                      const categoryItems = cateringMenuItems.filter(
                        (item) => item.catering_category_id === category.id
                      )
                      if (categoryItems.length === 0) return null
                      return (
                        <div key={category.id} className="mb-6 last:mb-0">
                          <h4 className="font-medium text-slate-700 mb-2 pb-1 border-b">
                            {category.name}
                          </h4>
                          <div className="space-y-2">
                            {categoryItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-2 rounded hover:bg-slate-50"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-slate-800">{item.name}</p>
                                  <p className="text-sm text-slate-500">
                                    ${item.price.toFixed(2)} / {item.selling_unit}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const current = cateringItemQuantities[item.id] || 0
                                      if (current > 0) {
                                        setCateringItemQuantities({
                                          ...cateringItemQuantities,
                                          [item.id]: current - 1,
                                        })
                                      }
                                    }}
                                    disabled={(cateringItemQuantities[item.id] || 0) === 0}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="w-8 text-center font-medium">
                                    {cateringItemQuantities[item.id] || 0}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const current = cateringItemQuantities[item.id] || 0
                                      setCateringItemQuantities({
                                        ...cateringItemQuantities,
                                        [item.id]: current + 1,
                                      })
                                    }}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                    {!Object.values(cateringItemQuantities).some(qty => qty > 0) && (
                      <p className="text-sm text-red-600 mt-2">* Selecciona al menos un item</p>
                    )}
                  </div>

                  {/* 6. Order Total */}
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-amber-500" />
                      Resumen de Orden
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span>${cateringCalculations.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>IVU ({((selectedCateringRestaurant.tax_rate || 0.115) * 100).toFixed(1)}%)</span>
                        <span>${cateringCalculations.taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Cargo de Entrega</span>
                        <div className="flex items-center gap-2">
                          <span>$</span>
                          <Input
                            type="number"
                            value={cateringDeliveryFee}
                            onChange={(e) => setCateringDeliveryFee(e.target.value)}
                            placeholder="0.00"
                            className="w-24 text-right"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between text-lg font-bold text-slate-800">
                          <span>Total</span>
                          <span>${cateringCalculations.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Special Instructions */}
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-amber-500" />
                      Instrucciones Especiales
                    </h3>
                    <textarea
                      value={cateringSpecialInstructions}
                      onChange={(e) => setCateringSpecialInstructions(e.target.value)}
                      placeholder="Instrucciones adicionales para la orden..."
                      className="w-full p-3 border rounded-lg resize-none h-24"
                    />
                  </div>

                  {/* Submit Error */}
                  {cateringSubmitError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">Error: {cateringSubmitError}</span>
                      </div>
                    </div>
                  )}

                  {/* 7. Submit Button */}
                  <div className="sticky bottom-4">
                    <Button
                      type="button"
                      onClick={handleCateringSubmit}
                      disabled={!cateringFormValid || cateringSubmitting}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white py-6 text-lg font-semibold"
                    >
                      {cateringSubmitting ? (
                        <>
                          <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                          Creando Orden...
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5 mr-2" />
                          Crear Orden de Catering - ${cateringCalculations.total.toFixed(2)}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* DELIVERY MODE - Filters & View Tabs */}
      {csrMode === "delivery" && (
      <>
      <div className="bg-white border-b px-4 py-3 sticky top-[52px] z-40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Search & Restaurant Filter */}
          <div className="flex items-center gap-3 flex-1">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar orden, cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>

            <select
              value={restaurantFilter}
              onChange={(e) => setRestaurantFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
              disabled={tentFilter === "subscriptions"}
            >
              {tentFilter === "online_ordering" && (
                <>
                  <option value="all">Todos los Restaurantes ({restaurants.length})</option>
                  {restaurants.map(r => (
                    <option key={r.id} value={`delivery_${r.id}`}>{r.name}</option>
                  ))}
                </>
              )}
              {tentFilter === "catering" && (
                <>
                  <option value="all">Todos los Restaurantes Catering ({cateringRestaurants.length})</option>
                  {cateringRestaurants.map(r => (
                    <option key={r.id} value={`catering_${r.id}`}>{r.name}</option>
                  ))}
                </>
              )}
              {tentFilter === "all" && (
                <>
                  <option value="all">Todos los Restaurantes ({restaurants.length + cateringRestaurants.length})</option>
                  <optgroup label="Online Ordering">
                    {restaurants.map(r => (
                      <option key={`delivery_${r.id}`} value={`delivery_${r.id}`}>{r.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Catering">
                    {cateringRestaurants.map(r => (
                      <option key={`catering_${r.id}`} value={`catering_${r.id}`}>{r.name}</option>
                    ))}
                  </optgroup>
                </>
              )}
              {tentFilter === "subscriptions" && (
                <option value="all">Próximamente</option>
              )}
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshOrders()}
              disabled={isRefreshing}
              className="h-9"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>

            {/* WhatsApp inbox — prominent button with unread indicator */}
            <Button
              variant={activeView === "whatsapp" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveView(activeView === "whatsapp" ? "current" : "whatsapp")}
              className={cn(
                "h-9 gap-1.5 relative",
                activeView === "whatsapp" && "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600",
                whatsappUnreadCount > 0 && activeView !== "whatsapp" && "border-emerald-500 text-emerald-700 animate-pulse",
              )}
              title={whatsappUnreadCount > 0 ? `${whatsappUnreadCount} mensaje(s) sin responder` : "Inbox de WhatsApp"}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
              {whatsappUnreadCount > 0 && (
                <Badge
                  className="ml-1 h-5 min-w-5 px-1.5 text-xs bg-red-500 hover:bg-red-500 text-white border-0"
                >
                  {whatsappUnreadCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Right: View Tabs */}
          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
            <TabsList>
              <TabsTrigger value="current" className="gap-1">
                <Clock className="h-3 w-3" />
                Actuales
                <Badge variant="secondary" className="ml-1 text-xs">{currentCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="future" className="gap-1">
                <Calendar className="h-3 w-3" />
                Futuras
                <Badge variant="secondary" className="ml-1 text-xs">{futureCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Historial
                <Badge variant="secondary" className="ml-1 text-xs">{historyCount}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Horizontal Sections View */}
      {activeView === "current" && (
        <div className="p-4 overflow-y-auto h-[calc(100vh-180px)]">
          {SECTIONS.map(section => (
            <Section key={section.id} section={section} />
          ))}
        </div>
      )}

      {/* Future Orders - Horizontal rows */}
      {activeView === "future" && (
        <div className="p-4 overflow-y-auto h-[calc(100vh-180px)]">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay órdenes futuras</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredOrders.map(order => (
                <OrderRow key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* History - Horizontal rows */}
      {activeView === "history" && (
        <div className="p-4 overflow-y-auto h-[calc(100vh-180px)]">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay órdenes en el historial</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredOrders.map(order => (
                <OrderRow key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* WhatsApp customer support inbox */}
      {activeView === "whatsapp" && <WhatsAppInboxPanel />}
      </>
      )}

      {/* Order Detail Modal */}
      <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Orden #{selectedOrder.order_number?.slice(-6) || selectedOrder.id.slice(0, 6)}</span>
                  <Badge className={`${STATUS_CONFIG[selectedOrder.status]?.color || "bg-gray-500"} text-white`}>
                    {STATUS_CONFIG[selectedOrder.status]?.label || selectedOrder.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {selectedOrder.restaurants?.name} • {format(new Date(selectedOrder.created_at), "d MMM yyyy, h:mm a", { locale: es })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Cliente</h4>
                    <p className="text-sm">{selectedOrder.customer_name}</p>
                    <p className="text-sm text-slate-600">{selectedOrder.customer_phone}</p>
                    <p className="text-sm text-slate-600">{selectedOrder.customer_email}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-2">
                      {selectedOrder.delivery_type === "delivery" ? "Dirección de Entrega" : "Pickup"}
                    </h4>
                    {selectedOrder.delivery_type === "delivery" ? (
                      <p className="text-sm text-slate-600">
                        {selectedOrder.delivery_address}<br />
                        {selectedOrder.delivery_city}, {selectedOrder.delivery_state} {selectedOrder.delivery_zip}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-600">Recoger en el restaurante</p>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Items ({selectedOrder.order_items?.length || 0})</h4>
                  <div className="space-y-2 bg-slate-50 rounded p-3">
                    {selectedOrder.order_items?.map(item => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>
                          <span className="font-medium text-blue-600">{item.quantity}x</span> {item.item_name}
                        </span>
                        <span className="text-slate-600">${item.total_price?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Special Instructions */}
                {selectedOrder.special_instructions && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Instrucciones Especiales</h4>
                    <p className="text-sm bg-yellow-50 p-3 rounded">{selectedOrder.special_instructions}</p>
                  </div>
                )}

                {/* Totals */}
                <div className="border-t pt-3">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>${selectedOrder.subtotal?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>IVU</span>
                    <span>${selectedOrder.tax?.toFixed(2)}</span>
                  </div>
                  {selectedOrder.delivery_type === "delivery" && (
                    <div className="flex justify-between text-sm">
                      <span>Delivery</span>
                      <span>${selectedOrder.delivery_fee?.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.tip > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Propina</span>
                      <span>${selectedOrder.tip?.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t">
                    <span>Total</span>
                    <span>${selectedOrder.total?.toFixed(2)}</span>
                  </div>
                </div>

                {/* Transmission Status */}
                <div className="border-t pt-3">
                  <h4 className="font-semibold text-sm mb-2">Estado de Transmisión</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`p-3 rounded text-center ${
                      selectedOrder.sent_to_restaurant
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      <Store className="h-5 w-5 mx-auto mb-1" />
                      <p className="text-xs font-medium">
                        {selectedOrder.sent_to_restaurant
                          ? "Enviado a Restaurante"
                          : "Pendiente de Envío"}
                      </p>
                    </div>
                    {selectedOrder.delivery_type === "delivery" && (
                      <div className={`p-3 rounded text-center ${
                        selectedOrder.shipday_order_id
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        <Truck className="h-5 w-5 mx-auto mb-1" />
                        <p className="text-xs font-medium">
                          {selectedOrder.shipday_order_id
                            ? `Shipday: ${selectedOrder.shipday_order_id}`
                            : "No enviado a Shipday"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shipday Tracking */}
                {shipdayStatus[selectedOrder.id] && (
                  <div className="bg-purple-50 p-4 rounded">
                    <h4 className="font-semibold text-sm mb-2 text-purple-800">Tracking Shipday</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-purple-600">Driver:</span>
                        <p className="font-medium">{shipdayStatus[selectedOrder.id].driverName || "Asignando..."}</p>
                      </div>
                      <div>
                        <span className="text-purple-600">Estado:</span>
                        <p className="font-medium">{shipdayStatus[selectedOrder.id].status || "Pendiente"}</p>
                      </div>
                      {shipdayStatus[selectedOrder.id].eta && (
                        <div>
                          <span className="text-purple-600">ETA:</span>
                          <p className="font-medium">{shipdayStatus[selectedOrder.id].eta}</p>
                        </div>
                      )}
                      {shipdayStatus[selectedOrder.id].driverPhone && (
                        <div>
                          <span className="text-purple-600">Tel. Driver:</span>
                          <p className="font-medium">{shipdayStatus[selectedOrder.id].driverPhone}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <DialogFooter className="flex-col sm:flex-row gap-2">
                {!selectedOrder.sent_to_restaurant && (
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={() => sendToRestaurant(selectedOrder)}
                    disabled={updatingOrderId === selectedOrder.id}
                  >
                    <Store className="h-4 w-4 mr-2" /> Enviar a Restaurante
                  </Button>
                )}
                {selectedOrder.delivery_type === "delivery" && !selectedOrder.shipday_order_id && (
                  <Button
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={() => sendToShipday(selectedOrder)}
                    disabled={updatingOrderId === selectedOrder.id}
                  >
                    <Send className="h-4 w-4 mr-2" /> Enviar a Shipday
                  </Button>
                )}
                {/* Payment Actions - for Stripe or ATH Móvil payments */}
                {(selectedOrder.stripe_payment_intent_id || selectedOrder.athmovil_reference_number) && selectedOrder.status !== "cancelled" && (
                  <>
                    <Button
                      variant="outline"
                      className="border-orange-300 text-orange-600 hover:bg-orange-50"
                      onClick={() => setShowRefundModal(true)}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" /> Reembolso
                    </Button>
                    {/* Additional charge only available for Stripe (has saved payment method) */}
                    {selectedOrder.stripe_payment_intent_id && (
                      <Button
                        variant="outline"
                        className="border-green-300 text-green-600 hover:bg-green-50"
                        onClick={() => setShowChargeModal(true)}
                      >
                        <CreditCard className="h-4 w-4 mr-2" /> Cargo Adicional
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelModal(true)}
                  disabled={selectedOrder.status === "cancelled" || selectedOrder.status === "completed"}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Cancelar Orden
                </Button>
                <Button variant="outline" onClick={() => setShowOrderModal(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Orden</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Por favor indica la razón de la cancelación.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Razón de cancelación..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              onClick={cancelOrder}
              disabled={!cancelReason.trim() || updatingOrderId === selectedOrder?.id}
            >
              Confirmar Cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Modal */}
      <Dialog open={showRefundModal} onOpenChange={setShowRefundModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-500" />
              Procesar Reembolso
            </DialogTitle>
            <DialogDescription>
              Orden #{selectedOrder?.order_number?.slice(-6)} - Total original: ${selectedOrder?.total?.toFixed(2)}
              <br />
              <span className="text-xs">
                Método de pago: {selectedOrder?.stripe_payment_intent_id ? "Stripe" : selectedOrder?.athmovil_reference_number ? "ATH Móvil" : "Desconocido"}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Monto a Reembolsar ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedOrder?.total || 0}
                placeholder="0.00"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">
                Máximo: ${selectedOrder?.total?.toFixed(2)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Razón del Reembolso</label>
              <Input
                placeholder="Ej: Cliente insatisfecho, item faltante..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRefundModal(false); setRefundAmount(""); setRefundReason(""); }}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={processRefund}
              disabled={!refundAmount || !refundReason.trim() || isProcessingPayment}
            >
              {isProcessingPayment ? "Procesando..." : `Reembolsar $${refundAmount || "0.00"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Additional Charge Modal */}
      <Dialog open={showChargeModal} onOpenChange={setShowChargeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-500" />
              Cargo Adicional
            </DialogTitle>
            <DialogDescription>
              Orden #{selectedOrder?.order_number?.slice(-6)} - Se cargará a la tarjeta del cliente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Monto a Cargar ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Razón del Cargo</label>
              <Input
                placeholder="Ej: Item adicional, upgrade, propina..."
                value={chargeReason}
                onChange={(e) => setChargeReason(e.target.value)}
              />
            </div>
            <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              Este cargo se procesará inmediatamente a la tarjeta guardada del cliente.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowChargeModal(false); setChargeAmount(""); setChargeReason(""); }}>
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={processAdditionalCharge}
              disabled={!chargeAmount || !chargeReason.trim() || isProcessingPayment}
            >
              {isProcessingPayment ? "Procesando..." : `Cargar $${chargeAmount || "0.00"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Order Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {editingOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-amber-500" />
                  Editar Orden #{editingOrder.order_number?.slice(-6) || editingOrder.id.slice(0, 6)}
                </DialogTitle>
                <DialogDescription>
                  {editingOrder.restaurants?.name} • Modifica los campos necesarios y guarda los cambios
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Customer Info Section */}
                <div>
                  <h4 className="font-semibold text-sm mb-3 text-slate-700 border-b pb-1">Información del Cliente</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Nombre</label>
                      <Input
                        value={editForm.customer_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, customer_name: e.target.value }))}
                        placeholder="Nombre del cliente"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Teléfono</label>
                      <Input
                        value={editForm.customer_phone}
                        onChange={(e) => setEditForm(prev => ({ ...prev, customer_phone: e.target.value }))}
                        placeholder="+1..."
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
                      <Input
                        type="email"
                        value={editForm.customer_email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, customer_email: e.target.value }))}
                        placeholder="email@ejemplo.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Address Section - only for delivery orders */}
                {editingOrder.delivery_type === "delivery" && (
                  <div>
                    <h4 className="font-semibold text-sm mb-3 text-slate-700 border-b pb-1">Dirección de Entrega</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Dirección</label>
                        <Input
                          value={editForm.delivery_address}
                          onChange={(e) => setEditForm(prev => ({ ...prev, delivery_address: e.target.value }))}
                          placeholder="Calle, número..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Apt/Suite/Urb</label>
                        <Input
                          value={editForm.apt_suite}
                          onChange={(e) => setEditForm(prev => ({ ...prev, apt_suite: e.target.value }))}
                          placeholder="Apt 2B, Urb. Villa Sol..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Ciudad</label>
                        <Input
                          value={editForm.delivery_city}
                          onChange={(e) => setEditForm(prev => ({ ...prev, delivery_city: e.target.value }))}
                          placeholder="San Juan"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Código Postal</label>
                        <Input
                          value={editForm.delivery_zip}
                          onChange={(e) => setEditForm(prev => ({ ...prev, delivery_zip: e.target.value }))}
                          placeholder="00920"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Order Items - Editable */}
                <div>
                  <div className="flex items-center justify-between mb-3 border-b pb-1">
                    <h4 className="font-semibold text-sm text-slate-700">
                      Items ({editItems.filter(i => !i.isDeleted).length})
                    </h4>
                    <div className="relative">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1"
                        onClick={() => setShowAddItemDropdown(!showAddItemDropdown)}
                      >
                        <Plus className="h-3 w-3" />
                        Agregar Item
                      </Button>
                      {showAddItemDropdown && (
                        <div className="absolute right-0 top-8 z-50 bg-white border rounded-lg shadow-lg w-64 max-h-60 overflow-y-auto">
                          <div className="p-2 border-b sticky top-0 bg-white">
                            <span className="text-xs text-slate-500">Selecciona un item del menú</span>
                          </div>
                          {restaurantMenuItems.length === 0 ? (
                            <div className="p-3 text-xs text-slate-400 text-center">Cargando menú...</div>
                          ) : (
                            restaurantMenuItems.map(menuItem => (
                              <button
                                key={menuItem.id}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm flex justify-between items-center"
                                onClick={() => addNewItem(menuItem)}
                              >
                                <span className="truncate">{menuItem.name}</span>
                                <span className="text-slate-500 text-xs ml-2">${menuItem.price.toFixed(2)}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {editItems.map(item => (
                      <div 
                        key={item.id} 
                        className={`flex items-center justify-between p-2 rounded ${
                          item.isDeleted 
                            ? "bg-red-50 opacity-50" 
                            : item.isNew 
                              ? "bg-green-50 border border-green-200" 
                              : "bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {item.isDeleted ? (
                            <button
                              type="button"
                              onClick={() => restoreItem(item.id)}
                              className="p-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-600"
                              title="Restaurar"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => deleteItem(item.id)}
                              className="p-1 rounded bg-red-100 hover:bg-red-200 text-red-600"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                          <span className={`text-sm ${item.isDeleted ? "line-through" : ""}`}>
                            {item.item_name}
                            {item.isNew && <span className="text-green-600 text-xs ml-1">(nuevo)</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {!item.isDeleted && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.id, -1)}
                                disabled={item.quantity <= 1}
                                className="p-1 rounded bg-slate-200 hover:bg-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.id, 1)}
                                className="p-1 rounded bg-slate-200 hover:bg-slate-300"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          <span className={`text-sm font-medium w-16 text-right ${item.isDeleted ? "line-through text-slate-400" : "text-slate-700"}`}>
                            ${item.total_price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Special Instructions */}
                <div>
                  <h4 className="font-semibold text-sm mb-3 text-slate-700 border-b pb-1">Instrucciones Especiales</h4>
                  <textarea
                    className="w-full p-3 border rounded-md text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={editForm.special_instructions}
                    onChange={(e) => setEditForm(prev => ({ ...prev, special_instructions: e.target.value }))}
                    placeholder="Instrucciones de entrega, alergias, etc..."
                  />
                </div>

                {/* Tip Adjustment */}
                <div>
                  <h4 className="font-semibold text-sm mb-3 text-slate-700 border-b pb-1">Propina</h4>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.tip}
                      onChange={(e) => setEditForm(prev => ({ ...prev, tip: parseFloat(e.target.value) || 0 }))}
                      className="w-32"
                    />
                    <span className="text-sm text-slate-500">
                      Original: ${editingOrder.tip?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                </div>

                {/* Order Totals Summary */}
                {(() => {
                  const totals = calculateEditTotals()
                  const originalTotal = editingOrder.total || 0
                  const hasChanges = Math.abs(totals.total - originalTotal) > 0.01
                  
                  return (
                    <div className={`p-3 rounded text-sm ${hasChanges ? "bg-amber-50 border border-amber-200" : "bg-slate-50"}`}>
                      <h4 className="font-semibold text-sm mb-2 text-slate-700">Resumen de Totales</h4>
                      <div className="space-y-1 text-slate-600">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>${totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>IVU (11.5%):</span>
                          <span>${totals.tax.toFixed(2)}</span>
                        </div>
                        {totals.deliveryFee > 0 && (
                          <div className="flex justify-between">
                            <span>Delivery:</span>
                            <span>${totals.deliveryFee.toFixed(2)}</span>
                          </div>
                        )}
                        {totals.dispatchFee > 0 && (
                          <div className="flex justify-between">
                            <span>Dispatch:</span>
                            <span>${totals.dispatchFee.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Propina:</span>
                          <span>${editForm.tip.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-800 pt-1 border-t mt-1">
                          <span>Total:</span>
                          <span>${totals.total.toFixed(2)}</span>
                        </div>
                        {hasChanges && (
                          <div className="flex items-center gap-1 text-amber-700 mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <span>
                              {totals.total > originalTotal 
                                ? `+$${(totals.total - originalTotal).toFixed(2)} del original`
                                : `-$${(originalTotal - totals.total).toFixed(2)} del original`
                              }
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-amber-500 hover:bg-amber-600"
                  onClick={saveOrderEdits}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Chat Modal - rendered at root level with memoized wrapper */}
      {openChatOrderId && <MemoizedChatModal 
        openChatOrderId={openChatOrderId}
        orders={orders}
        onClose={handleChatClose}
      />}
    </div>
  )
}
