"use client"

import { useState, useEffect, useCallback, useMemo } from "react"

const STORAGE_KEY = "foodnet_internal_shop_cart"
const EXPIRY_HOURS = 24

export interface ShopCartItem {
  id: string
  name: string
  price: number
  quantity: number
  image_url?: string | null
  category?: string | null
  description?: string | null
}

interface StoredCart {
  items: Record<string, ShopCartItem>
  expiresAt: number
}

function getStoredCart(): Record<string, ShopCartItem> {
  if (typeof window === "undefined") return {}
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    
    const parsed: StoredCart = JSON.parse(stored)
    
    // Check expiry
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY)
      return {}
    }
    
    return parsed.items || {}
  } catch {
    return {}
  }
}

function saveCart(items: Record<string, ShopCartItem>) {
  if (typeof window === "undefined") return
  
  const data: StoredCart = {
    items,
    expiresAt: Date.now() + EXPIRY_HOURS * 60 * 60 * 1000,
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function useInternalShopCart() {
  const [cart, setCart] = useState<Record<string, ShopCartItem>>({})
  const [isLoaded, setIsLoaded] = useState(false)

  // Load cart from localStorage on mount
  useEffect(() => {
    const stored = getStoredCart()
    setCart(stored)
    setIsLoaded(true)
  }, [])

  // Save to localStorage whenever cart changes
  useEffect(() => {
    if (isLoaded) {
      saveCart(cart)
    }
  }, [cart, isLoaded])

  // Add or update an item
  const addItem = useCallback((item: Omit<ShopCartItem, "quantity">, quantity: number = 1) => {
    setCart((prev) => {
      const existing = prev[item.id]
      const newQty = (existing?.quantity || 0) + quantity
      
      if (newQty <= 0) {
        const { [item.id]: _, ...rest } = prev
        return rest
      }
      
      return {
        ...prev,
        [item.id]: {
          ...item,
          quantity: newQty,
        },
      }
    })
  }, [])

  // Update quantity for an item
  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[itemId]
      if (!existing) return prev
      
      const newQty = existing.quantity + delta
      
      if (newQty <= 0) {
        const { [itemId]: _, ...rest } = prev
        return rest
      }
      
      return {
        ...prev,
        [itemId]: {
          ...existing,
          quantity: newQty,
        },
      }
    })
  }, [])

  // Set exact quantity for an item
  const setQuantity = useCallback((itemId: string, quantity: number) => {
    setCart((prev) => {
      const existing = prev[itemId]
      if (!existing) return prev
      
      if (quantity <= 0) {
        const { [itemId]: _, ...rest } = prev
        return rest
      }
      
      return {
        ...prev,
        [itemId]: {
          ...existing,
          quantity,
        },
      }
    })
  }, [])

  // Remove an item entirely
  const removeItem = useCallback((itemId: string) => {
    setCart((prev) => {
      const { [itemId]: _, ...rest } = prev
      return rest
    })
  }, [])

  // Clear the entire cart
  const clearCart = useCallback(() => {
    setCart({})
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Get quantity for a specific item
  const getQuantity = useCallback((itemId: string): number => {
    return cart[itemId]?.quantity || 0
  }, [cart])

  // Computed values
  const items = useMemo(() => Object.values(cart), [cart])
  
  const totalItems = useMemo(() => 
    items.reduce((sum, item) => sum + item.quantity, 0), 
    [items]
  )
  
  const subtotal = useMemo(() => 
    items.reduce((sum, item) => sum + item.price * item.quantity, 0), 
    [items]
  )

  // Calculate tax (separate from restaurant tax)
  const taxRate = 0.115 // 11.5% Puerto Rico sales tax
  const tax = useMemo(() => subtotal * taxRate, [subtotal])
  const total = useMemo(() => subtotal + tax, [subtotal, tax])

  return {
    cart,
    items,
    totalItems,
    subtotal,
    tax,
    total,
    isLoaded,
    addItem,
    updateQuantity,
    setQuantity,
    removeItem,
    clearCart,
    getQuantity,
  }
}
