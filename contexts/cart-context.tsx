"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"

export interface CartItem {
  id: string
  type?: string
  name: string
  price: number
  quantity: number
  image?: string
  modifiers?: Array<{
    name: string
    price: number
  }>
  specialInstructions?: string
  // Additional fields from customer-portal cart format
  totalPrice?: number
  finalPrice?: number
  basePrice?: number
  selectedOptions?: Record<string, string>
}

interface CartContextType {
  items: CartItem[]
  restaurantId: string | null
  restaurantName: string | null
  restaurantSlug: string | null
  addItem: (item: CartItem, restaurantId: string, restaurantName: string) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  syncFromSessionStorage: (slug: string) => void
  subtotal: number
  itemCount: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = "foodnetpr_cart"

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState<string | null>(null)
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  // Sync cart from sessionStorage (used by customer-portal)
  const syncFromSessionStorage = useCallback((slug: string) => {
    if (typeof window === "undefined") return
    try {
      const sessionCart = sessionStorage.getItem(`cart_${slug}`)
      if (sessionCart) {
        const parsed = JSON.parse(sessionCart)
        if (Array.isArray(parsed)) {
          // Convert customer-portal format to cart-context format
          const convertedItems: CartItem[] = parsed.map((item: any) => ({
            id: item.id || `${Date.now()}-${Math.random()}`,
            type: item.type || "menu_item",
            name: item.name || item.item?.name || "Item",
            price: item.basePrice || item.totalPrice / (item.quantity || 1) || 0,
            quantity: item.quantity || 1,
            totalPrice: item.totalPrice,
            finalPrice: item.finalPrice,
            basePrice: item.basePrice,
            selectedOptions: item.selectedOptions,
          }))
          setItems(convertedItems)
          setRestaurantSlug(slug)
        }
      }
    } catch (e) {
      console.error("Error syncing cart from sessionStorage:", e)
    }
  }, [])

  // Listen for sessionStorage changes (when customer-portal updates cart)
  useEffect(() => {
    if (typeof window === "undefined") return

    const handleStorageChange = () => {
      // Check if we're on a restaurant page
      const pathname = window.location.pathname
      const slug = pathname.split("/")[1]
      if (slug && slug !== "account" && slug !== "auth" && slug !== "admin") {
        syncFromSessionStorage(slug)
      }
    }

    // Set up interval to check for sessionStorage changes (sessionStorage doesn't fire events)
    const interval = setInterval(handleStorageChange, 500)
    
    // Initial sync
    handleStorageChange()

    return () => clearInterval(interval)
  }, [syncFromSessionStorage])

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(CART_STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          setItems(parsed.items || [])
          setRestaurantId(parsed.restaurantId || null)
          setRestaurantName(parsed.restaurantName || null)
          setRestaurantSlug(parsed.restaurantSlug || null)
        }
      } catch (e) {
        console.error("Error loading cart:", e)
      }
      setIsHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (isHydrated && typeof window !== "undefined") {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({ items, restaurantId, restaurantName, restaurantSlug })
      )
    }
  }, [items, restaurantId, restaurantName, restaurantSlug, isHydrated])

  const addItem = useCallback(
    (item: CartItem, newRestaurantId: string, newRestaurantName: string) => {
      if (restaurantId && restaurantId !== newRestaurantId) {
        if (
          !window.confirm(
            `Tu carrito tiene items de ${restaurantName}. ¿Deseas vaciarlo y agregar items de ${newRestaurantName}?`
          )
        ) {
          return
        }
        setItems([item])
        setRestaurantId(newRestaurantId)
        setRestaurantName(newRestaurantName)
        return
      }

      setItems((prev) => {
        const existingIndex = prev.findIndex((i) => i.id === item.id)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + item.quantity,
          }
          return updated
        }
        return [...prev, item]
      })

      if (!restaurantId) {
        setRestaurantId(newRestaurantId)
        setRestaurantName(newRestaurantName)
      }
    },
    [restaurantId, restaurantName]
  )

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const filtered = prev.filter((i) => i.id !== itemId)
      if (filtered.length === 0) {
        setRestaurantId(null)
        setRestaurantName(null)
      }
      return filtered
    })
  }, [])

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId)
      return
    }
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity } : i))
    )
  }, [removeItem])

  const clearCart = useCallback(() => {
    setItems([])
    setRestaurantId(null)
    setRestaurantName(null)
  }, [])

  const subtotal = items.reduce((sum, item) => {
    const modifiersTotal =
      item.modifiers?.reduce((m, mod) => m + mod.price, 0) || 0
    return sum + (item.price + modifiersTotal) * item.quantity
  }, 0)

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  const value: CartContextType = {
    items,
    restaurantId,
    restaurantName,
    restaurantSlug,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    syncFromSessionStorage,
    subtotal,
    itemCount,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
