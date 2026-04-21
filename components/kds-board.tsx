"use client"

import { useEffect, useState, useCallback, useRef, memo, useMemo } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Bell, BellOff, Check, Clock, Printer, X, ChefHat, 
  Maximize, Minimize, Settings, Bluetooth,
  RefreshCw, Timer, Calendar, Truck, AlertCircle, AlertTriangle, FlaskConical, Plus, Trash2,
  ChevronDown, ChevronUp, Eye, Package, MessageCircle, UtensilsCrossed, User
} from "lucide-react"
import { OrderChat } from "@/components/order-chat"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format, formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

type Order = {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  delivery_type: string
  delivery_address: string
  delivery_city: string
  delivery_state: string
  delivery_zip: string
  delivery_date: string
  delivery_time?: string | null
  special_instructions: string
  status: string
  total: number
  created_at: string
  shipday_order_id?: string | null
  sent_to_restaurant?: boolean
  order_type?: string | null
  event_date?: string | null
  event_time?: string | null
  guest_count?: number | null
  order_items: Array<{
    id: string
    item_name: string
    quantity: number
    selected_options: any
  }>
  // Tent identifier for unified display
  tent?: "online" | "catering"
}

// Catering order from catering_orders table
type CateringOrder = {
  id: string
  order_number?: string | null
  customer_name: string
  customer_phone: string
  customer_email?: string | null
  delivery_type: string
  delivery_address?: string | null
  delivery_city?: string | null
  delivery_state?: string | null
  delivery_zip?: string | null
  scheduled_for: string
  prep_by?: string | null
  status: string
  total: number
  subtotal: number
  tax: number
  delivery_fee: number
  service_package_fee?: number
  container_fees?: number
  notes?: string | null
  guest_count?: number | null
  created_at: string
  catering_restaurant_id: string
  catering_branch_id?: string | null
  operator_id?: string | null
  catering_order_items?: Array<{
    id: string
    name: string
    quantity: number
    unit_price: number
    subtotal: number
    size_name?: string | null
    serves?: string | null
    selling_unit?: string | null
    options?: any
  }>
}

// Tent filter type
type TentFilter = "todos" | "online" | "catering"

// Normalize catering order to unified Order format for display
function normalizeCateringOrder(co: CateringOrder): Order {
  const scheduledDate = new Date(co.scheduled_for)
  return {
    id: co.id,
    order_number: co.order_number || co.id.slice(0, 6).toUpperCase(),
    customer_name: co.customer_name,
    customer_phone: co.customer_phone,
    delivery_type: co.delivery_type,
    delivery_address: co.delivery_address || "",
    delivery_city: co.delivery_city || "",
    delivery_state: co.delivery_state || "PR",
    delivery_zip: co.delivery_zip || "",
    delivery_date: scheduledDate.toISOString().split("T")[0],
    delivery_time: scheduledDate.toTimeString().slice(0, 5),
    special_instructions: co.notes || "",
    status: co.status,
    total: co.total,
    created_at: co.created_at,
    order_type: "catering",
    event_date: scheduledDate.toISOString().split("T")[0],
    event_time: scheduledDate.toTimeString().slice(0, 5),
    guest_count: co.guest_count,
    order_items: (co.catering_order_items || []).map(item => ({
      id: item.id,
      item_name: item.name,
      quantity: item.quantity,
      selected_options: item.options || {},
    })),
    tent: "catering",
  }
}

type Restaurant = {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  kds_admin_pin?: string | null
}

// Memoized chat modal to prevent re-renders from parent timer
const MemoizedChatModal = memo(function MemoizedChatModal({
  openChatOrderId,
  orders,
  restaurantId,
  onClose
}: {
  openChatOrderId: string
  orders: Order[]
  restaurantId: string
  onClose: () => void
}) {
  // Memoize the order data to prevent re-renders
  const chatOrderData = useMemo(() => {
    const order = orders.find(o => o.id === openChatOrderId)
    if (!order) return null
    return {
      id: order.id,
      orderNumber: order.order_number,
      items: order.order_items?.map(i => ({ id: i.id, item_name: i.item_name })) || []
    }
  }, [openChatOrderId, orders])

  if (!chatOrderData) return null

  return (
    <OrderChat
      orderId={chatOrderData.id}
      restaurantId={restaurantId}
      senderType="kds"
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
         prevProps.restaurantId === nextProps.restaurantId &&
         prevProps.onClose === nextProps.onClose
})

interface KDSBoardProps {
  restaurant: Restaurant
  branchId?: string | null
  branchName?: string | null
  initialOrders: Order[]
  initialCateringOrders?: CateringOrder[]
  onPrintOrder?: (order: Order) => void
  autoPrintEnabled?: boolean
  onAutoPrintChange?: (enabled: boolean) => void
  onNewOrder?: (order: Order) => void
  cateringLeadTimeHours?: number | null
  operatorId?: string | null
  cateringRestaurantId?: string | null
}

export function KDSBoard({ restaurant, branchId, branchName, initialOrders, initialCateringOrders = [], onPrintOrder, autoPrintEnabled = false, onAutoPrintChange, onNewOrder, cateringLeadTimeHours, operatorId, cateringRestaurantId }: KDSBoardProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders.map(o => ({ ...o, tent: "online" as const })))
  const [cateringOrders, setCateringOrders] = useState<CateringOrder[]>(initialCateringOrders)
  const [tentFilter, setTentFilter] = useState<TentFilter>("todos")
  const [pendingAlertOrders, setPendingAlertOrders] = useState<Set<string>>(new Set()) // Orders with active alerts
  const alertIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false) // Requires user interaction on mobile/tablet
  const audioEnabledRef = useRef(false) // Ref to track current value for callbacks
  // Use prop directly — no local copy that can diverge from parent state
  const autoPrint = autoPrintEnabled
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeView, setActiveView] = useState<"current" | "future">("current")
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set())
  const [testModeOpen, setTestModeOpen] = useState(false)
  const [creatingTestOrder, setCreatingTestOrder] = useState(false)
  // Admin exit gesture state
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [pinError, setPinError] = useState(false)
  const [adminExitEnabled, setAdminExitEnabled] = useState(false)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [openChatOrderId, setOpenChatOrderId] = useState<string | null>(null)
  const [ordersWithUnreadMessages, setOrdersWithUnreadMessages] = useState<Set<string>>(new Set())
  
  // Stable callback for chat open/close - single function, not curried
  const handleChatOpen = useCallback((orderId: string) => {
    setOpenChatOrderId(orderId)
    // Mark messages as read when opening chat
    setOrdersWithUnreadMessages(prev => {
      const newSet = new Set(prev)
      newSet.delete(orderId)
      return newSet
    })
  }, [])
  
  const handleChatClose = useCallback(() => {
    setOpenChatOrderId(null)
  }, [])
  
  const tapCountRef = useRef(0)
  const lastTapTimeRef = useRef(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const supabase = createBrowserClient()
  
  // Keep ref in sync with state for use in callbacks/subscriptions
  useEffect(() => {
    audioEnabledRef.current = audioEnabled
  }, [audioEnabled])

  // Check if running as installed PWA
  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
      
      // Show install prompt if not in standalone mode (after 5 seconds)
      if (!isStandaloneMode) {
        const timer = setTimeout(() => {
          // Only show if not dismissed before
          const dismissed = localStorage.getItem('kds-install-dismissed');
          if (!dismissed) {
            setShowInstallPrompt(true);
          }
        }, 5000);
        return () => clearTimeout(timer);
      }
    };
    checkStandalone();
  }, []);

  // Test order templates
  const testOrderTemplates: Array<{ name: string; type: string; items: number; future?: boolean }> = [
    { name: "Orden Delivery Simple", type: "delivery", items: 2 },
    { name: "Orden Pickup Simple", type: "pickup", items: 1 },
    { name: "Orden Grande (5+ items)", type: "delivery", items: 6 },
    { name: "Orden para Manana", type: "delivery", items: 3, future: true },
  ]

  // Create a test order
  const createTestOrder = async (template: { name: string; type: string; items: number; future?: boolean }) => {
    setCreatingTestOrder(true)
    try {
      const deliveryDate = template.future 
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
      
      const testItems = [
        { name: "Mofongo con Pollo", price: 18.99 },
        { name: "Arroz con Gandules", price: 12.99 },
        { name: "Pernil Asado", price: 22.99 },
        { name: "Tostones", price: 6.99 },
        { name: "Ensalada Verde", price: 8.99 },
        { name: "Flan de Queso", price: 7.99 },
      ]

      const selectedItems = testItems.slice(0, template.items)
      const subtotal = selectedItems.reduce((sum, item) => sum + item.price, 0)

      // Generate a test order number (TEST-XXXXX format)
      const testOrderNumber = `TEST-${Math.floor(10000 + Math.random() * 90000)}`
      
      const orderData = {
        restaurant_id: restaurant.id,
        branch_id: branchId || null,
        order_number: testOrderNumber,
        customer_name: `Test Customer ${Math.floor(Math.random() * 1000)}`,
        customer_email: "test@example.com",
        customer_phone: "787-555-0123",
        delivery_type: template.type,
        delivery_date: deliveryDate,
        delivery_address: template.type === "delivery" ? "123 Test Street, San Juan, PR 00901" : null,
        delivery_city: template.type === "delivery" ? "San Juan" : null,
        delivery_state: template.type === "delivery" ? "PR" : null,
        delivery_zip: template.type === "delivery" ? "00901" : null,
        subtotal: subtotal,
        tax: subtotal * 0.115,
        delivery_fee: template.type === "delivery" ? 5.99 : 0,
        total: subtotal + (subtotal * 0.115) + (template.type === "delivery" ? 5.99 : 0),
        status: "pending",
        special_instructions: "[TEST ORDER] Para pruebas de KDS/impresora",
      }
      
      // Create the order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const orderItems = selectedItems.map(item => ({
        order_id: order.id,
        item_name: item.name,
        quantity: Math.floor(Math.random() * 3) + 1,
        unit_price: item.price,
        total_price: item.price * (Math.floor(Math.random() * 3) + 1),
        selected_options: {},
      }))

      const { data: createdItems, error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems)
        .select()

      if (itemsError) throw itemsError

      // Manually add the order to local state (in case real-time doesn't pick it up)
      const completeOrder = {
        ...order,
        order_items: orderItems.map((item, idx) => ({
          ...item,
          id: createdItems?.[idx]?.id || `temp-${idx}`,
        })),
      }
setOrders(prev => [completeOrder as Order, ...prev])
  
  // Start looping alert for new order
  if (completeOrder.status === "pending") {
    startAlertForOrder(completeOrder.id)
  }

      // Notify parent of new test order — auto-print handled in kds-client
      onNewOrder?.(completeOrder as Order)
      
      // Close dialog after successful creation
      setTestModeOpen(false)
    } catch (error) {
      console.error("[v0] Error creating test order:", error)
      alert("Error creando orden de prueba: " + (error as Error).message)
    } finally {
      setCreatingTestOrder(false)
    }
  }

  // Delete all test orders
  const deleteTestOrders = async () => {
    try {
      // Find test orders by the special_instructions field
      const { data: testOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("restaurant_id", restaurant.id)
        .like("special_instructions", "%[TEST ORDER]%")

      if (testOrders && testOrders.length > 0) {
        const orderIds = testOrders.map(o => o.id)
        
        // Delete order items first
        await supabase
          .from("order_items")
          .delete()
          .in("order_id", orderIds)
        
        // Delete orders
        await supabase
          .from("orders")
          .delete()
          .in("id", orderIds)
      }
    } catch (error) {
      console.error("Error deleting test orders:", error)
    }
  }

  // Helper to check if order is for today or in the past (current) vs future
  // Orders move to "Actuales" 60 minutes before their scheduled delivery time
  // Catering orders use event_date/event_time instead of delivery_date/delivery_time
  // Catering prep window comes from catering_restaurants.default_lead_time_hours
  const isCurrentOrder = (order: Order): boolean => {
    const DELIVERY_PREP_WINDOW_MINUTES = 60 // How early before delivery time to show in current orders
    
    // Get current time in Puerto Rico timezone
    const now = new Date()
    const nowPR = new Date(now.toLocaleString("en-US", { timeZone: "America/Puerto_Rico" }))
    
    // For catering orders, use event_date/event_time
    const isCatering = order.order_type === "catering"
    
    // Determine prep window based on order type
    let prepWindowMinutes: number
    if (isCatering) {
      // Catering orders MUST have a configured lead time from catering_restaurants table
      // If cateringLeadTimeHours is null, this restaurant is not enrolled in catering
      if (cateringLeadTimeHours === null || cateringLeadTimeHours === undefined) {
        throw new Error(
          "Catering order received but no catering lead time configured for this restaurant. " +
          "Check catering_restaurants table."
        )
      }
      prepWindowMinutes = cateringLeadTimeHours * 60
    } else {
      prepWindowMinutes = DELIVERY_PREP_WINDOW_MINUTES
    }
    
    const orderDateStr = isCatering && order.event_date ? order.event_date : order.delivery_date
    const orderTimeStr = isCatering ? order.event_time : order.delivery_time
    
    // If order has a specific time, use it
    if (orderTimeStr) {
      // Parse time (format: HH:MM or HH:MM:SS)
      const [hours, minutes] = orderTimeStr.split(":").map(Number)
      const orderDateTime = new Date(`${orderDateStr}T00:00:00`)
      orderDateTime.setHours(hours, minutes, 0, 0)
      
      // Order becomes "current" prepWindowMinutes before its scheduled time
      const showAtTime = new Date(orderDateTime.getTime() - prepWindowMinutes * 60 * 1000)
      
      return nowPR >= showAtTime
    } else {
      // No specific time - fall back to date-only comparison (show on the day)
      const orderDate = new Date(orderDateStr)
      const todayPR = new Date(nowPR)
      // Set both to midnight for date-only comparison
      orderDate.setHours(0, 0, 0, 0)
      todayPR.setHours(0, 0, 0, 0)
      return orderDate <= todayPR
    }
  }



  // Update time every second for order age display
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

// Track which orders we've already alerted for (to avoid re-alerting on every render)
  const alertedOrdersRef = useRef<Set<string>>(new Set())
  
  // Start alerts for any new pending/confirmed orders
  useEffect(() => {
    const pendingOrders = orders.filter(o => 
      (o.status === "pending" || o.status === "confirmed") && 
      o.sent_to_restaurant === true
    )
    
    // Find orders we haven't alerted for yet
    const newPendingOrders = pendingOrders.filter(o => !alertedOrdersRef.current.has(o.id))
    
    if (newPendingOrders.length > 0) {
      
      // Add to alerted set so we don't alert again
      newPendingOrders.forEach(o => alertedOrdersRef.current.add(o.id))
      
      // Add to pending alert orders for blinking
      setPendingAlertOrders(prev => {
        const newSet = new Set(prev)
        newPendingOrders.forEach(o => newSet.add(o.id))
        return newSet
      })
      
      // Play sound if audio is enabled
      if (audioEnabledRef.current) {
        playNotificationSound()
      }
    }
  }, [orders])

  // Fallback: Poll for new orders every 30 seconds in case realtime fails
  useEffect(() => {
    const fetchOrders = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]
      
      let query = supabase
        .from("orders")
.select(`*, order_items (id, item_name, quantity, unit_price, total_price, selected_options)`)
    .eq("restaurant_id", restaurant.id)
    .eq("sent_to_restaurant", true) // Only show orders manually sent to KDS
    .in("status", ["pending", "preparing", "ready", "completed", "confirmed"])
    .gte("delivery_date", todayStr)
    .order("created_at", { ascending: false })
    // Note: order_type, event_date, event_time are included via * selector

      // If branch filter is specified, only get orders for that branch
      if (branchId) {
        query = query.eq("branch_id", branchId)
      }

      const { data } = await query
      if (data) {
        // Merge fetched data with current state to preserve any optimistic updates in progress
        setOrders(prev => {
          // Create a map of fetched orders by ID
          const fetchedMap = new Map(data.map((o: Order) => [o.id, o]))
          // Create a map of current orders to check which ones are being updated
          const currentIds = new Set(prev.map(o => o.id))
          
          // For orders that exist in both, prefer the fetched version (database is source of truth)
          // For orders only in current state (new optimistic inserts), keep them
          // For orders only in fetched data (new from other sources), add them
          const merged = data.map((fetchedOrder: Order) => {
            // Always use the fetched order from database - this is the source of truth
            return fetchedOrder
          })
          
          // Add any orders in current state that aren't in fetched data (shouldn't happen normally)
          prev.forEach(currentOrder => {
            if (!fetchedMap.has(currentOrder.id)) {
              merged.push(currentOrder)
            }
          })
          
          return merged
        })
      }
    }

    const pollInterval = setInterval(fetchOrders, 10000) // Poll every 10 seconds
    return () => clearInterval(pollInterval)
  }, [restaurant.id, branchId, supabase])

  // Real-time order subscription
  useEffect(() => {
    // Build filter - filter by branch if specified
    const filter = branchId 
      ? `branch_id=eq.${branchId}`
      : `restaurant_id=eq.${restaurant.id}`
    
    const channel = supabase
      .channel(`kds_orders_${branchId || restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: filter,
        },
        async (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            // Only show orders that have been manually sent to restaurant
            if (!payload.new.sent_to_restaurant) return
            // If filtering by branch, only accept orders for this specific branch
            if (branchId && payload.new.branch_id !== branchId) return
            
            const { data: newOrder } = await supabase
              .from("orders")
              .select(`*, order_items (id, item_name, quantity, unit_price, total_price, selected_options)`)
              .eq("id", payload.new.id)
              .single()

            if (newOrder) {
              // Check if order already exists (UPDATE) or is new (INSERT)
              setOrders((prev) => {
                const existingIndex = prev.findIndex(o => o.id === newOrder.id)
                if (existingIndex >= 0) {
                  // Update existing order - but check if it just became sent_to_restaurant
                  const existingOrder = prev[existingIndex]
                  const updated = [...prev]
                  updated[existingIndex] = newOrder
                  
// If order just got sent to restaurant (pending or confirmed), trigger alert
              if (!existingOrder.sent_to_restaurant && newOrder.sent_to_restaurant && (newOrder.status === "pending" || newOrder.status === "confirmed")) {
                startAlertForOrder(newOrder.id)
                onNewOrder?.(newOrder)
              }
                  
                  return updated
} else {
                // Add new order (just appeared in KDS)
                if (newOrder.status === "pending" || newOrder.status === "confirmed") {
                  startAlertForOrder(newOrder.id)
                }
                onNewOrder?.(newOrder)
                return [newOrder, ...prev]
              }
              })
            }
          } else if (payload.eventType === "DELETE") {
            setOrders((prev) => prev.filter((order) => order.id !== payload.old.id))
          }
        }
      )
      .subscribe()

return () => { supabase.removeChannel(channel) }
  // onNewOrder is intentionally omitted from deps — it's a stable ref-backed callback
  // that always reads the latest autoPrintEnabled value without causing re-subscriptions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id, branchId, supabase])

  // Real-time subscription for catering_orders (when catering is enabled)
  useEffect(() => {
    // Only subscribe if we have an operator_id or catering_restaurant_id
    if (!operatorId && !cateringRestaurantId) return

    const filter = cateringRestaurantId
      ? `catering_restaurant_id=eq.${cateringRestaurantId}`
      : `operator_id=eq.${operatorId}`

    const cateringChannel = supabase
      .channel(`kds_catering_orders_${cateringRestaurantId || operatorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "catering_orders",
          filter: filter,
        },
        async (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const { data: newCateringOrder } = await supabase
              .from("catering_orders")
              .select(`*, catering_order_items (id, name, quantity, unit_price, subtotal, size_name, serves, selling_unit, options)`)
              .eq("id", payload.new.id)
              .single()

            if (newCateringOrder) {
              setCateringOrders((prev) => {
                const existingIndex = prev.findIndex(o => o.id === newCateringOrder.id)
                if (existingIndex >= 0) {
                  // Update existing order
                  const updated = [...prev]
                  updated[existingIndex] = newCateringOrder
                  return updated
                } else {
                  // Add new catering order
                  if (newCateringOrder.status === "pending" || newCateringOrder.status === "confirmed") {
                    startAlertForOrder(newCateringOrder.id)
                  }
                  // Notify parent of new order (for auto-print)
                  const normalized = normalizeCateringOrder(newCateringOrder)
                  onNewOrder?.(normalized)
                  return [newCateringOrder, ...prev]
                }
              })
            }
          } else if (payload.eventType === "DELETE") {
            setCateringOrders((prev) => prev.filter((order) => order.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(cateringChannel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorId, cateringRestaurantId, supabase])
  
  // TODO: Track 3 - wire subscription_orders here
  
  // Real-time subscription for order messages (to show unread indicator)
  useEffect(() => {
    const messagesChannel = supabase
      .channel(`kds_messages_${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_messages",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        (payload) => {
          const newMessage = payload.new as { order_id: string; sender_type: string }
          // Only show unread indicator for messages from CSR (not from KDS itself)
          if (newMessage.sender_type === "csr") {
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
  }, [restaurant.id, supabase, openChatOrderId])
  
  // Hidden admin exit gesture - tap logo 3 times rapidly to show PIN dialog
  const handleLogoTap = useCallback(() => {
    const now = Date.now()
    const timeSinceLastTap = now - lastTapTimeRef.current
    
    // Reset counter if more than 500ms between taps
    if (timeSinceLastTap > 500) {
      tapCountRef.current = 1
    } else {
      tapCountRef.current++
    }
    lastTapTimeRef.current = now
    
    // After 3 rapid taps, show PIN dialog
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0
      // Only show dialog if restaurant has a PIN configured
      if (restaurant.kds_admin_pin) {
        setShowPinDialog(true)
        setPinInput("")
        setPinError(false)
      } else {
        // No PIN configured - just enable exit mode
        setAdminExitEnabled(true)
      }
    }
  }, [restaurant.kds_admin_pin])

  // Verify PIN and enable admin exit
  const handlePinSubmit = useCallback(() => {
    if (pinInput === restaurant.kds_admin_pin) {
      setShowPinDialog(false)
      setAdminExitEnabled(true)
      setPinInput("")
      setPinError(false)
    } else {
      setPinError(true)
      setPinInput("")
    }
  }, [pinInput, restaurant.kds_admin_pin])

  // Disable admin exit after 30 seconds
  useEffect(() => {
    if (adminExitEnabled) {
      const timer = setTimeout(() => {
        setAdminExitEnabled(false)
      }, 30000) // 30 seconds to navigate away
      return () => clearTimeout(timer)
    }
  }, [adminExitEnabled])

  const playNotificationSound = () => {
    if (!audioEnabledRef.current) {
      return // Don't play until user has enabled audio
    }
    
    try {
      // Create or reuse AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      
      // Resume if suspended (required for mobile/tablet after user interaction)
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
      
      // Pleasant chime sound - attention-grabbing but not harsh
      // Uses sine waves for smoother tone, with a "ding-dong-ding" pattern
      const playChime = (frequency: number, startTime: number, duration: number, volume: number) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, startTime)
        
        // Attack and decay envelope for bell-like sound
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02) // Quick attack
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration) // Natural decay
        
        oscillator.start(startTime)
        oscillator.stop(startTime + duration)
      }
      
      const now = ctx.currentTime
      
      // Three-note chime pattern: high-low-high (like a doorbell)
      // Frequencies based on musical notes for pleasant sound
      playChime(880, now, 0.4, 0.6)           // A5 - first ding
      playChime(659, now + 0.15, 0.4, 0.5)    // E5 - dong (lower)
      playChime(880, now + 0.35, 0.5, 0.65)   // A5 - final ding (slightly louder)
      
      // Add a subtle harmonic overtone for richness
      playChime(1760, now, 0.3, 0.15)         // A6 - soft overtone
      playChime(1760, now + 0.35, 0.4, 0.2)   // A6 - final overtone
      
    } catch (e) {
      console.error('[v0] Error playing notification sound:', e)
    }
  }

  // Enable audio on user interaction (required by browsers)
  const enableAudio = () => {
    // Create AudioContext on first user interaction
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    // Resume if suspended
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume()
    }
    setAudioEnabled(true)
    // Play a test beep to confirm
    setTimeout(() => {
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        const osc = audioContextRef.current.createOscillator()
        const gain = audioContextRef.current.createGain()
        osc.connect(gain)
        gain.connect(audioContextRef.current.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(440, audioContextRef.current.currentTime)
        gain.gain.setValueAtTime(0.3, audioContextRef.current.currentTime)
        osc.start(audioContextRef.current.currentTime)
        osc.stop(audioContextRef.current.currentTime + 0.15)
      }
    }, 100)
  }

  // Start looping alert for an order until it's accepted
  const startAlertForOrder = (orderId: string) => {
    // Add to alerted ref so the useEffect doesn't double-alert
    alertedOrdersRef.current.add(orderId)
    setPendingAlertOrders(prev => {
      const newSet = new Set(prev)
      newSet.add(orderId)
      return newSet
    })
    
    // Play immediately
    playNotificationSound()
  }

  // Stop alert for a specific order (when accepted)
  const stopAlertForOrder = (orderId: string) => {
    setPendingAlertOrders(prev => {
      const newSet = new Set(prev)
      newSet.delete(orderId)
      return newSet
    })
  }

  // Effect to manage the looping alert sound
  useEffect(() => {
    // Clear any existing interval
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current)
      alertIntervalRef.current = null
    }

    // If there are pending orders, start looping alert sound
    if (pendingAlertOrders.size > 0) {
      // Play every 5 seconds until all orders are accepted
      alertIntervalRef.current = setInterval(() => {
        playNotificationSound()
      }, 5000) // Repeat every 5 seconds
    }

    return () => {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current)
      }
    }
  }, [pendingAlertOrders.size])

  // Mark order as printed in database (for deduplication across devices)
  const markOrderAsPrinted = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ printed_at: new Date().toISOString() })
        .eq("id", orderId)
        .is("printed_at", null) // Only update if not already printed
      
      if (error) {
        console.error("[v0] Error marking order as printed:", error)
      }
    } catch (error) {
      console.error("[v0] Error marking order as printed:", error)
    }
  }

  const updateOrderStatus = async (orderId: string, status: string, notifyShipday: boolean = false, isCateringOrder: boolean = false) => {
    setUpdatingOrders(prev => new Set(prev).add(orderId))
    
    // Stop the alert when order is accepted (status changes from pending/confirmed to preparing)
    if (status === "preparing" || status === "ready" || status === "completed") {
      stopAlertForOrder(orderId)
    }
    
    // Determine if this is a catering order based on tent field or explicit flag
    const allOrdersFlat = [...orders, ...normalizedCateringOrders]
    const order = allOrdersFlat.find(o => o.id === orderId)
    const isFromCateringTable = isCateringOrder || order?.tent === "catering"
    const hasShipdayOrder = order?.shipday_order_id
    
    // Optimistic UI update - move order immediately
    if (isFromCateringTable) {
      setCateringOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status } : o
      ))
    } else {
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status } : o
      ))
    }
    
    try {
      if (isFromCateringTable) {
        // Update catering_orders table
        const { data, error } = await supabase
          .from("catering_orders")
          .update({ status })
          .eq("id", orderId)
          .select()
        
        if (error) {
          // Revert on error
          setCateringOrders(prev => prev.map(o => 
            o.id === orderId ? { ...o, status: "pending" } : o
          ))
          alert("Error actualizando orden de catering: " + error.message)
        } else if (!data || data.length === 0) {
          setCateringOrders(prev => prev.map(o => 
            o.id === orderId ? { ...o, status: "pending" } : o
          ))
          alert("Error: No se pudo actualizar la orden de catering. Verifica los permisos.")
        }
      } else {
        // If marking as ready and has a Shipday order, notify Shipday
        if (status === "ready" && notifyShipday && hasShipdayOrder) {
          const response = await fetch("/api/shipday/mark-ready", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              restaurantId: restaurant.id,
              branchId: branchId || null,
            }),
          })
          const result = await response.json()
          if (!result.success) {
            // Don't revert - order is still ready, just log the Shipday error
            console.error("Shipday notification failed:", result.error)
          }
          // Also update the database status
          await supabase.from("orders").update({ status }).eq("id", orderId)
        } else {
          // Direct database update for other status changes
          const { data, error } = await supabase
            .from("orders")
            .update({ status })
            .eq("id", orderId)
            .select()
          
          if (error) {
            // Revert on error
            setOrders(prev => prev.map(order => 
              order.id === orderId ? { ...order, status: "pending" } : order
            ))
            alert("Error actualizando orden: " + error.message)
          } else if (!data || data.length === 0) {
            // No rows updated - likely RLS policy blocking or order not found
            setOrders(prev => prev.map(order => 
              order.id === orderId ? { ...order, status: "pending" } : order
            ))
            alert("Error: No se pudo actualizar la orden. Verifica los permisos.")
          }
        }
      }
    } catch (error) {
      // Revert on error
      if (isFromCateringTable) {
        setCateringOrders(prev => prev.map(o => 
          o.id === orderId ? { ...o, status: "pending" } : o
        ))
      } else {
        setOrders(prev => prev.map(order => 
          order.id === orderId ? { ...order, status: "pending" } : order
        ))
      }
      alert("Error: " + (error as Error).message)
    } finally {
      setUpdatingOrders(prev => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  // Get order age in minutes for color coding
  const getOrderAge = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = new Date()
    return Math.floor((now.getTime() - created.getTime()) / 60000)
  }

  // Color code based on order age
  const getAgeColor = (minutes: number, status: string) => {
    if (status === "completed" || status === "cancelled") return "border-gray-300"
    if (minutes > 30) return "border-red-500 bg-red-50"
    if (minutes > 20) return "border-orange-500 bg-orange-50"
    if (minutes > 10) return "border-yellow-500 bg-yellow-50"
    return "border-green-500 bg-green-50"
  }

  // Combine online and catering orders based on tent filter
  const normalizedCateringOrders = cateringOrders.map(normalizeCateringOrder)
  
  const allOrders = useMemo(() => {
    let combined: Order[] = []
    
    if (tentFilter === "online") {
      combined = orders
    } else if (tentFilter === "catering") {
      combined = normalizedCateringOrders
    } else {
      // "todos" - combine both, sorted by created_at descending
      combined = [...orders, ...normalizedCateringOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }
    
    return combined
  }, [orders, normalizedCateringOrders, tentFilter])

  // Separate current vs future orders
  const currentOrders = allOrders.filter(o => isCurrentOrder(o))
  const futureOrders = allOrders.filter(o => !isCurrentOrder(o))

  // Group current orders by status
  const newOrders = currentOrders.filter((o) => o.status === "pending" || o.status === "confirmed")
  const preparingOrders = currentOrders.filter((o) => o.status === "preparing")
  const readyOrders = currentOrders.filter((o) => o.status === "ready")
  const completedOrders = currentOrders.filter((o) => o.status === "completed")

  // Group future orders by date
  const futureOrdersByDate = futureOrders.reduce((acc, order) => {
    const dateKey = format(new Date(order.delivery_date), "yyyy-MM-dd")
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(order)
    return acc
  }, {} as Record<string, Order[]>)

  // Sort future dates
  const sortedFutureDates = Object.keys(futureOrdersByDate).sort()

  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  const OrderCard = ({ order, compact = false }: { order: Order; compact?: boolean }) => {
    const isUpdating = updatingOrders.has(order.id)
    const ageMinutes = getOrderAge(order.created_at)
    const isExpanded = expandedOrders.has(order.id)
    const itemCount = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0
    
    // Color based on age for urgency
    const urgencyBg = ageMinutes > 20 ? "bg-red-50 border-red-300" : ageMinutes > 10 ? "bg-orange-50 border-orange-300" : "bg-white border-gray-200"

    return (
      <div className={`${urgencyBg} border rounded-lg overflow-hidden`}>
        {/* Horizontal row layout */}
        <div className="flex items-center gap-3 px-3 py-2">
          {/* Order Number + Timer */}
          <div className="flex items-center gap-2 min-w-[100px]">
            <span className="font-bold text-base text-gray-900">#{order.order_number?.slice(-4) || order.id.slice(0, 4)}</span>
            <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${ageMinutes > 20 ? "bg-red-500 text-white" : ageMinutes > 10 ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-700"}`}>
              {ageMinutes}m
            </span>
          </div>
          
{/* Tent Badge - Only show in "Todos" mode */}
              {tentFilter === "todos" && order.tent && (
                <span className={`px-2 py-1 rounded text-xs font-bold shrink-0 uppercase ${
                  order.tent === "catering" ? "bg-orange-500 text-white" : "bg-blue-500 text-white"
                }`}>
                  {order.tent === "catering" ? "CATERING" : "ONLINE"}
                </span>
              )}

              {/* Order Type Badge */}
              {order.tent === "catering" || order.order_type === "catering" ? (
                <>
                  <span className={`px-2 py-1 rounded text-xs font-semibold shrink-0 ${order.delivery_type === "delivery" ? "bg-amber-600 text-white" : "bg-amber-500 text-white"} flex items-center gap-1`}>
                    {order.delivery_type === "delivery" ? (
                      <>
                        <Truck className="h-3 w-3" />
                        ENTREGA
                      </>
                    ) : (
                      <>
                        <Package className="h-3 w-3" />
                        RECOGIDO
                      </>
                    )}
                  </span>
                  {/* Error: Catering order on non-catering restaurant */}
                  {(cateringLeadTimeHours === null || cateringLeadTimeHours === undefined) && !order.tent && (
                    <span className="px-2 py-1 rounded text-xs font-semibold shrink-0 bg-red-600 text-white flex items-center gap-1" title="Error: Este restaurante no está inscrito en catering">
                      <AlertTriangle className="h-3 w-3" />
                      ERROR CONFIG
                    </span>
                  )}
                </>
              ) : (
                <span className={`px-2 py-1 rounded text-xs font-semibold shrink-0 ${order.delivery_type === "delivery" ? "bg-blue-500 text-white" : "bg-purple-500 text-white"}`}>
                  {order.delivery_type === "delivery" ? "DELIVERY" : "PICKUP"}
                </span>
              )}

              {/* Catering Event Date/Time + Guest Count */}
              {(order.tent === "catering" || order.order_type === "catering") && order.event_date && (
                <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(order.event_date + "T12:00:00"), "d MMM", { locale: es })}
                  {order.event_time && ` ${order.event_time.slice(0, 5)}`}
                </span>
              )}
              
              {/* Guest Count for Catering */}
              {(order.tent === "catering" || order.order_type === "catering") && order.guest_count && (
                <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                  <User className="h-3 w-3" />
                  {order.guest_count} personas
                </span>
              )}

              {/* Items Dropdown Toggle */}
              <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleOrderExpanded(order.id) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${isExpanded ? "bg-gray-800 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
              >
              <Package className="h-4 w-4" />
              {itemCount} items
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
          
          {/* Chat with CSR - just a button that opens the modal */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleChatOpen(order.id) }}
            className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              ordersWithUnreadMessages.has(order.id) 
                ? "bg-red-100 hover:bg-red-200 text-red-600" 
                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
            }`}
            title="Chat con CSR"
          >
            <MessageCircle className="h-4 w-4" />
            {ordersWithUnreadMessages.has(order.id) && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Next Stage Action Button - Preparar also prints if printer connected */}
          {(order.status === "pending" || order.status === "confirmed") && (
            <button
              type="button"
              className={`text-white text-sm py-2 px-4 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95 ${
                pendingAlertOrders.has(order.id) 
                  ? "bg-red-600 hover:bg-red-700 animate-pulse shadow-lg shadow-red-500/30" 
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
              onClick={(e) => { 
                e.stopPropagation(); 
                e.preventDefault(); 
                // Auto-print when accepting order (if printer available)
                if (onPrintOrder) {
                  markOrderAsPrinted(order.id)
                  onPrintOrder(order)
                }
                updateOrderStatus(order.id, "preparing") 
              }}
              disabled={isUpdating}
            >
              {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ChefHat className="h-4 w-4" />}
              Preparar
            </button>
          )}
          {order.status === "preparing" && (
            <button
              type="button"
              className="bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-4 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
              onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, "ready", order.delivery_type === "delivery") }}
              disabled={isUpdating}
            >
              {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Listo
            </button>
          )}
          {order.status === "ready" && (
            <button
              type="button"
              className="bg-gray-700 hover:bg-gray-800 text-white text-sm py-2 px-4 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
              onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, "completed") }}
              disabled={isUpdating}
            >
              {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              {order.delivery_type === "delivery" ? "Entregado" : "Recogido"}
            </button>
          )}
          
          {/* Print Button */}
          {onPrintOrder && (
            <button
              type="button"
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-lg transition-colors"
              onClick={(e) => { 
                e.stopPropagation()
                e.preventDefault()
                markOrderAsPrinted(order.id)
                onPrintOrder(order) 
              }}
              title="Imprimir"
            >
              <Printer className="h-5 w-5" />
            </button>
          )}
        </div>
        
        {/* Expanded Items List */}
        {isExpanded && (
          <div className="bg-gray-50 border-t px-4 py-3">
            <div className="space-y-2">
              {order.order_items?.map((item) => (
                <div key={item.id} className="text-sm bg-white rounded px-3 py-2 border">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600 min-w-[24px]">{item.quantity}x</span>
                    <span className="text-gray-800 font-medium">{item.item_name}</span>
                  </div>
                  {/* Show selected options/choices */}
                  {item.selected_options && Object.keys(item.selected_options).length > 0 && (
                    <div className="ml-8 mt-1 text-xs text-gray-600">
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
            {order.special_instructions && !order.special_instructions.includes("[TEST ORDER]") && (
              <div className="mt-2 text-sm text-orange-700 bg-orange-50 p-2 rounded border border-orange-200">
                <strong>Nota:</strong> {order.special_instructions}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // State for collapsed sections - Nuevos, Listos and Recogidos collapsed by default
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['new', 'ready', 'completed']))
  const prevNewOrdersCountRef = useRef(newOrders.length)
  
  // Auto-expand "Nuevos" when new orders arrive, auto-collapse when empty
  useEffect(() => {
    const prevCount = prevNewOrdersCountRef.current
    const currentCount = newOrders.length
    
    // New orders arrived - expand the section
    if (currentCount > prevCount && currentCount > 0) {
      setCollapsedSections(prev => {
        const next = new Set(prev)
        next.delete('new')
        return next
      })
    }
    
    // All new orders processed - collapse the section
    if (currentCount === 0 && prevCount > 0) {
      setCollapsedSections(prev => {
        const next = new Set(prev)
        next.add('new')
        return next
      })
    }
    
    prevNewOrdersCountRef.current = currentCount
  }, [newOrders.length])
  
  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  // Horizontal collapsible section component
  const Section = ({ title, orders, color, textColor, icon: Icon, sectionKey }: { 
    title: string; 
    orders: Order[]; 
    color: string; 
    textColor: string;
    icon: any;
    sectionKey: string;
  }) => {
    const isCollapsed = collapsedSections.has(sectionKey)
    
    return (
      <div className="mb-3">
        {/* Collapsible Header */}
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className={`w-full ${color} ${textColor} px-4 py-3 rounded-lg flex items-center justify-between transition-all hover:opacity-90 active:scale-[0.99]`}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" />
            <span className="font-bold text-lg uppercase tracking-wide">{title}</span>
            <Badge className="bg-white/20 text-white border-0 text-sm px-2">
              {orders.length}
            </Badge>
          </div>
          <div className={`transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}>
            <ChevronDown className="h-6 w-6" />
          </div>
        </button>
        
        {/* Expandable Content - Stacked horizontal rows */}
        {!isCollapsed && (
          <div className="mt-2 space-y-2">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
            {orders.length === 0 && (
              <div className="text-center py-6 text-gray-400 bg-gray-800/20 rounded-lg border border-dashed border-gray-600">
                <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay ordenes en esta seccion</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Keep old Column component for backwards compatibility if needed
  const Column = ({ title, orders, color, icon: Icon }: { title: string; orders: Order[]; color: string; icon: any }) => (
    <div className={`w-[24%] min-w-[180px] ${color} rounded-lg p-2 flex flex-col h-full flex-shrink-0`}>
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-1">
          <Icon className="h-4 w-4" />
          <h2 className="text-sm font-bold truncate">{title}</h2>
        </div>
        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
          {orders.length}
        </Badge>
      </div>
      <div className="space-y-1.5 flex-1 overflow-y-auto" data-scrollable>
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
        {orders.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            <p className="text-xs">No hay ordenes</p>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* Audio Enable Overlay - Required for mobile/tablet browsers */}
      {!audioEnabled && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center cursor-pointer"
          onClick={enableAudio}
        >
          <div className="text-center p-8">
            <Bell className="h-16 w-16 text-orange-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-white mb-2">Toca para Activar Sonido</h2>
            <p className="text-gray-400">Las notificaciones de nuevas órdenes requieren activación manual</p>
          </div>
        </div>
      )}

      {/* Install as App Prompt - Shows when running in browser instead of PWA */}
      {showInstallPrompt && !isStandalone && audioEnabled && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-gray-900 relative">
            {/* Close X button */}
            <button
              onClick={() => setShowInstallPrompt(false)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-500 rounded-full p-2">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold">KDS No Esta Instalado</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              El KDS se puede mover y cerrar porque no esta instalado como aplicacion. 
              Para que funcione correctamente:
            </p>
            
            {/* iPad / Safari */}
            <div className="bg-blue-50 rounded-lg p-3 mb-2">
              <p className="text-xs font-semibold text-blue-600 mb-2">iPad / Safari:</p>
              <div className="space-y-1 text-sm">
                <p>1. Toca <span className="inline-flex items-center justify-center w-5 h-5 bg-white rounded border text-xs">↑</span> (icono Compartir abajo)</p>
                <p>2. Selecciona <strong className="text-orange-600">"Agregar a Inicio"</strong></p>
              </div>
            </div>
            
            {/* Android / Chrome */}
            <div className="bg-green-50 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-green-600 mb-2">Android / Chrome:</p>
              <div className="space-y-1 text-sm">
                <p>1. Toca <span className="inline-flex items-center justify-center w-5 h-5 bg-white rounded border text-xs font-bold">⋮</span> (3 puntos arriba derecha)</p>
                <p>2. Selecciona <strong className="text-orange-600">"Agregar a pantalla de inicio"</strong></p>
              </div>
            </div>
            
            <div className="bg-gray-100 rounded-lg p-3 mb-4 text-sm text-center">
              <strong>Luego abre KDS desde el nuevo icono</strong> en tu pantalla de inicio
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  localStorage.setItem('kds-install-dismissed', 'true');
                  setShowInstallPrompt(false);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Continuar Igual
              </button>
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
<div className="flex items-center gap-2">
            {/* Tappable logo area for hidden admin exit gesture */}
            <button
              type="button"
              onClick={handleLogoTap}
              className="flex items-center gap-2 focus:outline-none select-none"
              aria-label="Restaurant logo"
            >
              {restaurant.logo_url ? (
                <img 
                  src={restaurant.logo_url} 
                  alt={restaurant.name}
                  className="h-8 w-8 rounded object-cover flex-shrink-0"
                />
              ) : (
                <ChefHat className="h-6 w-6 text-orange-500 flex-shrink-0" />
              )}
            </button>
            <div>
              <h1 className="text-xl font-bold">
                {restaurant.name}
                {branchName && <span className="text-orange-400 ml-2">- {branchName}</span>}
                {adminExitEnabled && (
                  <span className="ml-2 text-xs bg-red-600 text-white px-2 py-0.5 rounded animate-pulse">
                    EXIT MODE (30s)
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-400">Kitchen Display System</p>
            </div>
          </div>

        {/* Tent Toggle - Only show if catering is available */}
        {(operatorId || cateringRestaurantId) && (
          <div className="flex items-center bg-gray-700 rounded-lg p-0.5">
            <button
              onClick={() => setTentFilter("todos")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tentFilter === "todos" 
                  ? "bg-white text-gray-900" 
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setTentFilter("online")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                tentFilter === "online" 
                  ? "bg-blue-500 text-white" 
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              Online
            </button>
            <button
              onClick={() => setTentFilter("catering")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                tentFilter === "catering" 
                  ? "bg-orange-500 text-white" 
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />
              Catering
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Order counts summary */}
          <div className="hidden md:flex items-center gap-3 mr-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              {newOrders.length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {preparingOrders.length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {readyOrders.length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              {completedOrders.length}
            </span>
          </div>

          {/* Controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onAutoPrintChange?.(!autoPrint)
            }}
            className={autoPrint ? "text-green-400" : "text-gray-500"}
            title={autoPrint ? "Auto-print ON" : "Auto-print OFF"}
          >
            <Printer className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-gray-300 hover:text-white"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
            className="text-gray-300 hover:text-white"
          >
            <RefreshCw className="h-5 w-5" />
          </Button>

          {/* Test Mode Button */}
          <Dialog open={testModeOpen} onOpenChange={setTestModeOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/30"
                title="Modo de Prueba"
              >
                <FlaskConical className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-700 text-white">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-purple-400" />
                  Modo de Prueba - KDS
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  Crea ordenes de prueba para verificar el funcionamiento del KDS, impresora y configuracion del tablet.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  {testOrderTemplates.map((template, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-start gap-1 border-gray-700 hover:bg-gray-800 hover:border-purple-500"
                      onClick={() => createTestOrder(template)}
                      disabled={creatingTestOrder}
                    >
                      <span className="font-medium">{template.name}</span>
                      <span className="text-xs text-gray-400">
                        {template.type === "delivery" ? "Delivery" : "Pickup"} - {template.items} items
                        {template.future && " (Manana)"}
                      </span>
                    </Button>
                  ))}
                </div>

                <div className="border-t border-gray-700 pt-4">
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-red-800 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                    onClick={deleteTestOrders}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar Todas las Ordenes de Prueba
                  </Button>
                </div>

                {branchId && branchName && (
                  <div className="text-sm text-green-400 bg-green-900/20 p-3 rounded border border-green-800">
                    Las ordenes de prueba se crearan para: <strong>{branchName}</strong>
                  </div>
                )}

                <div className="text-xs text-gray-500 bg-gray-800/50 p-3 rounded">
                  <p className="font-medium text-gray-400 mb-1">Notas:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Las ordenes de prueba aparecen con la nota "[TEST ORDER]"</li>
                    <li>Puedes usar estas ordenes para probar la impresora y flujo de trabajo</li>
                    <li>Elimina las ordenes de prueba cuando termines la instalacion</li>
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Current time */}
          <div className="text-lg font-mono ml-4">
            {format(currentTime, "HH:mm:ss")}
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "current" | "future")} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2 border-b border-gray-700">
          <TabsList className="bg-gray-800">
            <TabsTrigger value="current" className="data-[state=active]:bg-gray-700 gap-2">
              <Clock className="h-4 w-4" />
              Ordenes Actuales
              <Badge variant="secondary" className="ml-1">{currentOrders.filter(o => o.status !== "completed" && o.status !== "cancelled").length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="future" className="data-[state=active]:bg-gray-700 gap-2">
              <Calendar className="h-4 w-4" />
              Ordenes Futuras
              {futureOrders.length > 0 && (
                <Badge variant="outline" className="ml-1 border-orange-500 text-orange-400">{futureOrders.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Current Orders - Horizontal Collapsible Sections */}
        <TabsContent value="current" className="m-0 p-4 flex-1 overflow-y-auto">
          <div className="space-y-1">
            <Section
              title="Nuevos"
              orders={newOrders}
              color="bg-amber-500"
              textColor="text-white"
              icon={Bell}
              sectionKey="new"
            />
            <Section
              title="Preparando"
              orders={preparingOrders}
              color="bg-blue-600"
              textColor="text-white"
              icon={ChefHat}
              sectionKey="preparing"
            />
            <Section
              title="Listos"
              orders={readyOrders}
              color="bg-green-600"
              textColor="text-white"
              icon={Check}
              sectionKey="ready"
            />
            <Section
              title="Recogidos"
              orders={completedOrders}
              color="bg-gray-600"
              textColor="text-white"
              icon={Package}
              sectionKey="completed"
            />
          </div>
        </TabsContent>

        {/* Future Orders - Grouped by Date */}
        <TabsContent value="future" className="m-0 p-4">
          {futureOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl">No hay ordenes programadas para fechas futuras</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedFutureDates.map(dateKey => {
                const ordersForDate = futureOrdersByDate[dateKey]
                const dateObj = new Date(dateKey + "T12:00:00")
                return (
                  <div key={dateKey} className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-700">
                      <Calendar className="h-6 w-6 text-orange-400" />
                      <h3 className="text-xl font-bold">
                        {format(dateObj, "EEEE, d 'de' MMMM", { locale: es })}
                      </h3>
                      <Badge variant="secondary">{ordersForDate.length} ordenes</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {ordersForDate.map(order => (
                        <OrderCard key={order.id} order={order} compact />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
</TabsContent>
      </Tabs>

      {/* Admin Exit PIN Dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="sm:max-w-md bg-gray-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Admin Exit</DialogTitle>
            <DialogDescription className="text-gray-400">
              Ingrese el PIN de administrador para habilitar la navegación
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((digit) => (
                <span key={digit} className="w-3 h-3 rounded-full bg-gray-600" />
              ))}
            </div>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pinInput}
              onChange={(e) => {
                setPinError(false)
                setPinInput(e.target.value.replace(/\D/g, ''))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePinSubmit()
              }}
              placeholder="Ingrese PIN"
              className={`w-full px-4 py-3 text-center text-2xl tracking-widest bg-gray-700 border rounded-lg focus:outline-none focus:ring-2 ${
                pinError 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-600 focus:ring-orange-500'
              }`}
              autoFocus
            />
            {pinError && (
              <p className="text-red-400 text-sm text-center">PIN incorrecto. Intente de nuevo.</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => {
                    setPinError(false)
                    setPinInput(prev => prev + digit)
                  }}
                  className="p-4 text-xl font-bold bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPinInput(prev => prev.slice(0, -1))}
                className="p-4 text-xl bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => {
                  setPinError(false)
                  setPinInput(prev => prev + '0')
                }}
                className="p-4 text-xl font-bold bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                0
              </button>
              <button
                type="button"
                onClick={handlePinSubmit}
                className="p-4 text-xl bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors"
              >
                OK
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowPinDialog(false)}
              className="w-full py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Chat Modal - rendered at root level with memoized wrapper */}
      {openChatOrderId && <MemoizedChatModal 
        openChatOrderId={openChatOrderId}
        orders={orders}
        restaurantId={restaurant.id}
        onClose={handleChatClose}
      />}
    </div>
  )
}
