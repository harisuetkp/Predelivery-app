"use client"

import Link from "next/link"
import Image from "next/image"
import { LocationBar, type UserLocation, type OrderMode } from "./location-bar"
import { CartPopover } from "./cart-popover"
import { useState, useEffect, useMemo } from "react"
import { Menu, X, User, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

// Dynamic greeting function - DoorDash style
function getGreeting(name: string): string {
  const now = new Date()
  const hour = now.getHours()
  const dayOfWeek = now.getDay()
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
  
  // Time-based greetings
  const morningGreetings = [
    `Buenos días, ${name}`,
    `Buen día, ${name}`,
    `Good morning, ${name}`,
  ]
  
  const afternoonGreetings = [
    `Buenas tardes, ${name}`,
    `Hey ${name}`,
    `Hola, ${name}`,
  ]
  
  const eveningGreetings = [
    `Buenas noches, ${name}`,
    `Hey ${name}`,
    `Hola, ${name}`,
  ]
  
  // Special day greetings (Spanglish Puerto Rico style)
  const dayGreetings = [
    `¡Feliz ${dayNames[dayOfWeek]}, ${name}!`,
    `Happy ${dayNames[dayOfWeek]}, ${name}!`,
  ]
  
  // Weekend specials
  const weekendGreetings = [
    `¡Feliz weekend, ${name}!`,
    `¡Disfruta el fin de semana, ${name}!`,
  ]
  
  // General fun greetings
  const funGreetings = [
    `¿Qué hay, ${name}?`,
    `¡Wepa, ${name}!`,
    `Hey there, ${name}`,
    `Welcome back, ${name}`,
    `¡Qué bueno verte, ${name}!`,
  ]
  
  // Build pool based on time and day
  let pool: string[] = []
  
  if (hour >= 5 && hour < 12) {
    pool = [...morningGreetings, ...funGreetings]
  } else if (hour >= 12 && hour < 18) {
    pool = [...afternoonGreetings, ...funGreetings]
  } else {
    pool = [...eveningGreetings, ...funGreetings]
  }
  
  // Add day-specific greetings
  if (dayOfWeek === 5) { // Friday
    pool.push(`¡TGIF, ${name}!`)
    pool.push(`¡Feliz Viernes, ${name}!`)
  }
  
  if (dayOfWeek === 0 || dayOfWeek === 6) { // Weekend
    pool = [...pool, ...weekendGreetings]
  } else {
    pool = [...pool, ...dayGreetings.slice(0, 1)]
  }
  
  // Pick random greeting from pool
  return pool[Math.floor(Math.random() * pool.length)]
}

interface GlobalNavbarProps {
  showLocationBar?: boolean
  showModeToggle?: boolean
  onLocationChange?: (location: UserLocation | null) => void
  onModeChange?: (mode: OrderMode) => void
}

export function GlobalNavbar({
  showLocationBar = true,
  showModeToggle = true,
  onLocationChange,
  onModeChange,
}: GlobalNavbarProps) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [orderMode, setOrderMode] = useState<OrderMode>("delivery")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [userName, setUserName] = useState<string>("")
  const [greeting, setGreeting] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  // Check auth state
  useEffect(() => {
    const supabase = createClient()
    
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        // Try to get user name from metadata or profile
        const displayName = user.user_metadata?.full_name || 
                           user.user_metadata?.name ||
                           user.email?.split("@")[0] || 
                           "Usuario"
        const firstName = displayName.split(" ")[0]
        setUserName(firstName)
        setGreeting(getGreeting(firstName))
      }
      setIsLoading(false)
    }
    
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      if (session?.user) {
        const displayName = session.user.user_metadata?.full_name || 
                           session.user.user_metadata?.name ||
                           session.user.email?.split("@")[0] || 
                           "Usuario"
        const firstName = displayName.split(" ")[0]
        setUserName(firstName)
        setGreeting(getGreeting(firstName))
      } else {
        setUserName("")
        setGreeting("")
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setUserName("")
    window.location.href = "/"
  }

  // Load from localStorage
  useEffect(() => {
    const storedLocation = localStorage.getItem("foodnetpr_user_location")
    const storedMode = localStorage.getItem("foodnetpr_order_mode")
    
    if (storedLocation) {
      try {
        setUserLocation(JSON.parse(storedLocation))
      } catch (e) {
        console.error("Error loading location:", e)
      }
    }
    
    if (storedMode === "pickup" || storedMode === "delivery") {
      setOrderMode(storedMode)
    }
  }, [])

  const handleLocationChange = (location: UserLocation | null) => {
    setUserLocation(location)
    if (location) {
      localStorage.setItem("foodnetpr_user_location", JSON.stringify(location))
    } else {
      localStorage.removeItem("foodnetpr_user_location")
    }
    onLocationChange?.(location)
  }

  const handleModeChange = (mode: OrderMode) => {
    setOrderMode(mode)
    localStorage.setItem("foodnetpr_order_mode", mode)
    onModeChange?.(mode)
  }

  return (
    <div>
      {/* Thin spacer bar for breathing room - hidden on mobile */}
      <div className="h-2 bg-slate-100 hidden sm:block" />
      
      {/* Main navigation bar */}
      <nav id="global-navbar-inner" className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        {/* Desktop Layout */}
        <div className="hidden md:flex mx-auto max-w-7xl items-center px-4 py-2 gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center flex-shrink-0">
            <Image
              src="/foodnetpr-logo.png"
              alt="PR Delivery"
              width={120}
              height={32}
              className="h-7 w-auto"
            />
          </Link>

          {/* Location Bar - only show if enabled */}
          {showLocationBar && (
            <LocationBar 
              onLocationChange={handleLocationChange}
              onModeChange={handleModeChange}
              initialLocation={userLocation}
              initialMode={orderMode}
              showModeToggle={showModeToggle}
            />
          )}

          {/* Right side: Cart, Auth */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Cart with Popover */}
            <CartPopover />

            {/* Auth Section */}
            {!isLoading && (
              user ? (
                /* Logged in state */
                <div className="flex items-center gap-1">
                  <div className="text-right">
                    <p className="text-base font-bold text-slate-900">{greeting}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <Link
                        href="/account"
                        className="text-slate-500 hover:text-slate-700 hover:underline transition-colors"
                      >
                        Mi Cuenta
                      </Link>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={handleLogout}
                        className="text-slate-500 hover:text-slate-700 hover:underline transition-colors"
                      >
                        Log Out
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Logged out state */
                <div className="flex items-center gap-2">
                  <Link
                    href="/auth/customer/login"
                    className="px-4 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/register"
                    className="px-4 py-1.5 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-colors"
                  >
                    Sign up
                  </Link>
                </div>
              )
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden">
          {/* Top row: Logo, Cart, Menu */}
          <div className="flex items-center justify-between px-3 py-2">
            <Link href="/" className="flex items-center">
              <Image
                src="/foodnetpr-logo.png"
                alt="PR Delivery"
                width={100}
                height={28}
                className="h-6 w-auto"
              />
            </Link>
            
            <div className="flex items-center gap-2">
              <CartPopover />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Location Bar - Simplified */}
          {showLocationBar && (
            <div className="px-3 pb-2">
              <LocationBar 
                onLocationChange={handleLocationChange}
                onModeChange={handleModeChange}
                initialLocation={userLocation}
                initialMode={orderMode}
                showModeToggle={showModeToggle}
                isMobile={true}
              />
            </div>
          )}

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="border-t border-slate-200 bg-white px-3 py-3 space-y-2">
              {user ? (
                /* Logged in mobile menu */
                <>
                  <div className="px-3 py-2 border-b border-slate-100 mb-2">
                    <p className="text-base font-bold text-slate-900">{greeting}</p>
                  </div>
                  <Link
                    href="/account"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="w-4 h-4" />
                    Mi Cuenta
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleLogout()
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </>
              ) : (
                /* Logged out mobile menu */
                <>
                  <Link
                    href="/auth/customer/login"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="w-4 h-4" />
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/auth/register"
                    className="block px-3 py-2.5 text-sm font-medium text-center bg-black text-white rounded-lg hover:bg-slate-800 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Crear cuenta
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </nav>
    </div>
  )
}
