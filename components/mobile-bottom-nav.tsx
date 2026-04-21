"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, ShoppingCart, User } from "lucide-react"
import { useEffect, useState, useCallback } from "react"

export function MobileBottomNav() {
  const pathname = usePathname()
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null)
  
  const getCurrentSlug = useCallback(() => {
    const slug = pathname?.split("/")[1]
    if (slug && slug !== "account" && slug !== "auth" && slug !== "admin" && slug !== "checkout") {
      return slug
    }
    return null
  }, [pathname])

  useEffect(() => {
    const slug = getCurrentSlug()
    
    if (slug) {
       setRestaurantSlug(slug)
    } else {
       if (typeof sessionStorage !== 'undefined') {
         // try to find from sessionStorage
         for (let i = 0; i < sessionStorage.length; i++) {
           const key = sessionStorage.key(i)
           if (key?.startsWith('cart_')) {
             const storedSlug = key.split('_')[1]
             setRestaurantSlug(storedSlug)
             break;
           }
         }
       }
    }
  }, [getCurrentSlug])

  // Don't show bottom nav if we are clearly on the login/signup screens
  if (pathname?.includes('/auth/customer')) {
    return null
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-slate-200">
      <div className="flex justify-around items-center h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <Link 
          href="/" 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname === '/' ? 'text-black' : 'text-slate-500'}`}
        >
          <Home className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        
        <Link 
          href={restaurantSlug ? `/${restaurantSlug}?checkout=true` : "/"}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname?.includes('checkout') ? 'text-black' : 'text-slate-500'}`}
        >
          <ShoppingCart className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-medium">Cart</span>
        </Link>
        
        <Link 
          href="/account" 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname?.includes('/account') ? 'text-black' : 'text-slate-500'}`}
        >
          <User className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </div>
    </div>
  )
}
