"use client"

import { useState, useEffect, useRef, useCallback, memo } from "react"
import { createClient } from "@/lib/supabase/client"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  MessageCircle, Send, X, AlertTriangle, Clock, 
  Ban, Zap, CheckCircle
} from "lucide-react"

interface OrderMessage {
  id: string
  order_id: string
  restaurant_id: string
  sender_type: "kds" | "csr"
  message: string
  message_type: string
  related_item_id?: string
  read_at?: string
  created_at: string
}

interface OrderChatProps {
  orderId: string
  restaurantId: string
  senderType: "kds" | "csr"
  orderNumber?: string
  orderItems?: Array<{ id: string; item_name: string }>
  onUnreadCountChange?: (count: number) => void
  compact?: boolean
  // Controlled open state (optional - for parent to manage)
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

// Message type
interface Message {
  id: string
  order_id: string
  restaurant_id: string
  sender_type: "kds" | "csr"
  message: string
  message_type?: string
  related_item_id?: string
  read_at?: string
  created_at: string
}

// Quick messages for KDS (kitchen-focused)
const KDS_QUICK_MESSAGES = [
  { type: "item_unavailable", label: "Plato agotado", icon: Ban },
  { type: "delay", label: "Demora +15 min", icon: Clock },
  { type: "order_issue", label: "Confirmar orden", icon: AlertTriangle },
]

// Quick messages for CSR
const CSR_QUICK_MESSAGES = [
  { type: "item_removed", label: "Item removido", icon: CheckCircle },
  { type: "order_cancelled", label: "Orden cancelada", icon: Ban },
  { type: "priority", label: "Prioridad alta", icon: Zap },
  { type: "timing", label: "Cliente en camino", icon: Clock },
]

export const OrderChat = memo(function OrderChat({ 
  orderId, 
  restaurantId, 
  senderType, 
  orderNumber,
  orderItems = [],
  onUnreadCountChange,
  compact = false,
  isOpen: controlledIsOpen,
  onOpenChange
}: OrderChatProps) {
  const supabase = createClient()
  // Use controlled state if provided, otherwise use internal state
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
  
  const setIsOpen = useCallback((open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open)
    } else {
      setInternalIsOpen(open)
    }
  }, [onOpenChange])
  const [messages, setMessages] = useState<OrderMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [mounted, setMounted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const quickMessages = senderType === "kds" ? KDS_QUICK_MESSAGES : CSR_QUICK_MESSAGES

  // Track mount state for portal
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Use refs for callback dependencies to avoid re-renders
  const senderTypeRef = useRef(senderType)
  const onUnreadCountChangeRef = useRef(onUnreadCountChange)
  
  useEffect(() => {
    senderTypeRef.current = senderType
    onUnreadCountChangeRef.current = onUnreadCountChange
  }, [senderType, onUnreadCountChange])

  // Fetch messages - stable callback
  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("order_messages")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })

    if (!error && data) {
      setMessages(data)
      const unread = data.filter(m => m.sender_type !== senderTypeRef.current && !m.read_at).length
      setUnreadCount(unread)
      onUnreadCountChangeRef.current?.(unread)
    }
  }, [orderId, supabase])

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    const unreadIds = messages
      .filter(m => m.sender_type !== senderType && !m.read_at)
      .map(m => m.id)

    if (unreadIds.length > 0) {
      await supabase
        .from("order_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds)
      
      setUnreadCount(0)
      onUnreadCountChange?.(0)
    }
  }, [messages, senderType, onUnreadCountChange, supabase])

  // Send message
  const sendMessage = async (messageText: string, messageType: string = "custom") => {
    if (!messageText.trim()) return
    
    setIsSending(true)
    try {
      const { error } = await supabase
        .from("order_messages")
        .insert({
          order_id: orderId,
          restaurant_id: restaurantId,
          sender_type: senderType,
          message: messageText,
          message_type: messageType,
          related_item_id: selectedItem || null
        })

      if (!error) {
        setNewMessage("")
        setSelectedItem(null)
        fetchMessages()
      }
    } finally {
      setIsSending(false)
    }
  }

  // Send quick message
  const sendQuickMessage = (type: string, label: string) => {
    const itemName = selectedItem 
      ? orderItems.find(i => i.id === selectedItem)?.item_name 
      : null
    const message = itemName ? `${label}: ${itemName}` : label
    sendMessage(message, type)
  }

  // Refs for stable values
  const prevMessageCountRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const isInputFocusedRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastScrollTopRef = useRef(0)

  // Save scroll position before any update
  const saveScrollPosition = useCallback(() => {
    if (scrollContainerRef.current) {
      lastScrollTopRef.current = scrollContainerRef.current.scrollTop
    }
  }, [])

  // Restore scroll position after update
  const restoreScrollPosition = useCallback(() => {
    if (scrollContainerRef.current && !isInputFocusedRef.current) {
      // Only restore if we're not at the bottom already
      const container = scrollContainerRef.current
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      if (!isNearBottom) {
        container.scrollTop = lastScrollTopRef.current
      }
    }
  }, [])

  // Initial fetch only (not on every change)
  useEffect(() => {
    if (isOpen) {
      fetchMessages()
    }
  }, [isOpen, orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscription for new messages - refetch on any change for reliability
  useEffect(() => {
    if (!isOpen) return
    
    const channel = supabase
      .channel(`order-messages-${orderId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        () => {
          // Refetch all messages on any change for reliability
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId, isOpen, supabase, fetchMessages])

  // Mark as read when opening (only once)
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markAsRead()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Scroll to bottom only when NEW messages arrive (count increases)
  useEffect(() => {
    const currentCount = messages.length
    if (isOpen && currentCount > prevMessageCountRef.current && currentCount > 0) {
      // New message arrived - scroll to bottom after a small delay
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 50)
    }
    prevMessageCountRef.current = currentCount
  }, [messages.length, isOpen])

  // Format timestamp
  const formatTime = (dateStr: string) => {
    return new Intl.DateTimeFormat("es-PR", {
      timeZone: "America/Puerto_Rico",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(dateStr))
  }

  // Chat button (shared between compact and full)
  const ChatButton = ({ isCompact }: { isCompact: boolean }) => (
    <button
      type="button"
      onClick={(e) => { 
        e.stopPropagation()
        e.preventDefault()
        setIsOpen(true) 
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={isCompact 
        ? `relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
            unreadCount > 0 
              ? "bg-red-500 text-white animate-pulse" 
              : "bg-gray-100 hover:bg-gray-200 text-gray-600"
          }`
        : `relative flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
            unreadCount > 0 
              ? "bg-red-500 text-white animate-pulse" 
              : "bg-gray-100 hover:bg-gray-200 text-gray-600"
          }`
      }
      title="Chat"
    >
      <MessageCircle className={isCompact ? "h-4 w-4" : "h-3 w-3"} />
      {!isCompact && "Chat"}
      {unreadCount > 0 && (
        <span className={isCompact 
          ? "absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
          : "bg-white text-red-600 text-[9px] px-1 py-0 rounded"
        }>
          {unreadCount}
        </span>
      )}
    </button>
  )

  // Modal JSX - rendered directly, not as a function component
  const modalJSX = isOpen && mounted ? createPortal(
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
      onClick={(e) => { e.stopPropagation(); setIsOpen(false) }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
        <div 
          className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-slate-800 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span className="font-semibold">
                Chat - Orden #{orderNumber?.slice(-4) || orderId.slice(0, 4)}
              </span>
            </div>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsOpen(false) }} 
              className="hover:bg-slate-700 rounded p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[300px] bg-gray-50"
          >
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay mensajes</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === senderType ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      msg.sender_type === senderType
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-gray-200 text-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant="secondary" 
                        className={`text-[9px] ${
                          msg.sender_type === "kds" 
                            ? "bg-orange-100 text-orange-700" 
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {msg.sender_type === "kds" ? "Cocina" : "CSR"}
                      </Badge>
                      <span className={`text-[10px] ${msg.sender_type === senderType ? "text-blue-200" : "text-gray-400"}`}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Item Selector (for KDS - on top for intuitive flow) */}
          {senderType === "kds" && orderItems.length > 0 && (
            <div className="px-4 py-2 border-t bg-gray-50">
              <p className="text-xs text-gray-500 mb-2">Seleccionar item (opcional):</p>
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                {orderItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedItem(selectedItem === item.id ? null : item.id) }}
                    className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors shadow-sm ${
                      selectedItem === item.id
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    <span>{item.item_name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Messages */}
          <div className="px-4 py-2 border-t bg-gray-50">
            <p className="text-xs text-gray-500 mb-2">Mensajes rápidos:</p>
            <div className="flex flex-wrap gap-1.5">
              {quickMessages.map((qm) => {
                const IconComponent = qm.icon
                return (
                  <button
                    key={qm.type}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); sendQuickMessage(qm.type, qm.label) }}
                    disabled={isSending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:border-gray-400 disabled:opacity-50 text-gray-700 shadow-sm"
                  >
                    <IconComponent className="h-3.5 w-3.5 text-gray-600" />
                    <span>{qm.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Input */}
          <div className="p-3 border-t flex gap-2 bg-white">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(newMessage) } }}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => { e.stopPropagation(); isInputFocusedRef.current = true }}
              onBlur={() => { isInputFocusedRef.current = false }}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Escribir mensaje..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSending}
              autoComplete="off"
              enterKeyHint="send"
            />
            <Button
              size="sm"
              onClick={(e) => { e.stopPropagation(); sendMessage(newMessage) }}
              disabled={isSending || !newMessage.trim()}
              className="px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>,
    document.body
  ) : null

  // If not compact, just render the modal (for root-level rendering)
  if (!compact) {
    return modalJSX
  }

  // Compact mode: render button + modal
  return (
    <>
      <ChatButton isCompact={true} />
      {modalJSX}
    </>
  )
})
