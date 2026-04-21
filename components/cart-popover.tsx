"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { ShoppingCart, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface CartItem {
  id: string
  type?: string
  name: string
  item?: { name?: string }
  quantity: number
  totalPrice: number
  finalPrice?: number
  basePrice?: number
  selectedOptions?: Record<string, string>
  image_url?: string
}

export function CartPopover() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState<string | null>(null)

  // Get current restaurant slug from URL
  const getCurrentSlug = useCallback(() => {
    const slug = pathname?.split("/")[1]
    if (slug && slug !== "account" && slug !== "auth" && slug !== "admin" && slug !== "checkout") {
      return slug
    }
    return null
  }, [pathname])

  // Read cart from sessionStorage
  const syncCart = useCallback(() => {
    if (typeof window === "undefined") return
    
    const slug = getCurrentSlug()
    if (!slug) {
      setCartItems([])
      setRestaurantSlug(null)
      return
    }

    try {
      const sessionCart = sessionStorage.getItem(`cart_${slug}`)
      if (sessionCart) {
        const parsed = JSON.parse(sessionCart)
        if (Array.isArray(parsed)) {
          setCartItems(parsed)
          setRestaurantSlug(slug)
          // Get restaurant name from the page if available
          const nameEl = document.querySelector('[data-restaurant-name]')
          if (nameEl) {
            setRestaurantName(nameEl.getAttribute('data-restaurant-name'))
          }
        }
      } else {
        setCartItems([])
      }
    } catch (e) {
      console.error("Error reading cart:", e)
      setCartItems([])
    }
  }, [getCurrentSlug])

  // Sync cart on mount and when pathname changes
  useEffect(() => {
    syncCart()
    // Poll for changes since sessionStorage doesn't fire events in same tab
    const interval = setInterval(syncCart, 300)
    return () => clearInterval(interval)
  }, [syncCart])

  const itemCount = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0)

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Cart Button */}
      <button className="relative p-2 hover:bg-slate-100 rounded-full transition-colors">
        <ShoppingCart className="w-5 h-5 text-slate-700" />
        {itemCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {itemCount > 9 ? "9+" : itemCount}
          </span>
        )}
      </button>

      {/* Popover */}
      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-2xl border border-slate-200 z-50"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          {/* Header with Close + Restaurant Name */}
          <div className="p-4">
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-100 rounded-full"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
            
            {restaurantName && cartItems.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-slate-500">Tu orden de</p>
                <h3 className="text-lg font-bold">{restaurantName}</h3>
              </div>
            )}
          </div>

          {/* Continue Button - Top CTA */}
          {cartItems.length > 0 && (
            <div className="px-4 pb-3">
              <Link
                href={restaurantSlug ? `/${restaurantSlug}?checkout=true` : "/"}
                className="block"
              >
                <Button className="w-full bg-red-500 hover:bg-red-600 text-white rounded-lg py-3 font-semibold">
                  Continue
                </Button>
              </Link>
            </div>
          )}

          {/* Cart Items */}
          <div className="max-h-80 overflow-y-auto px-4">
            {cartItems.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">Tu carrito está vacío</p>
                <p className="text-sm mt-1">Agrega items de un restaurante para comenzar</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cartItems.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="py-4 flex items-start gap-3">
                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm text-slate-900">{item.name}</h4>
                          
                          {/* Options from selectedOptions */}
                          {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {Object.values(item.selectedOptions).join(", ")}
                            </p>
                          )}
                        </div>

                        {/* Quantity display */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-medium px-2 py-1 bg-slate-100 rounded">{item.quantity}x</span>
                        </div>
                      </div>

                      {/* Price */}
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        ${(item.totalPrice || item.basePrice || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer - Checkout + Add More */}
          {cartItems.length > 0 && (
            <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2">
              <Link
                href={restaurantSlug ? `/${restaurantSlug}?checkout=true` : "/"}
                className="block"
              >
                <Button className="w-full bg-black hover:bg-slate-800 text-white rounded-lg py-3 font-semibold">
                  Checkout
                </Button>
              </Link>

              <Link
                href={restaurantSlug ? `/${restaurantSlug}` : "/"}
                className="block text-center py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Add more items
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
