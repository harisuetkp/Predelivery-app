"use client"

import { useEffect } from "react"
import { SplashScreen } from "@capacitor/splash-screen"

export function SplashScreenHandler() {
  useEffect(() => {
    // Hide the splash screen on mount after hydration
    const hideSplash = async () => {
      try {
        const isNative = typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.()
        if (isNative) {
          await SplashScreen.hide()
        }
      } catch (err) {
        // Ignored
      }
    }
    
    hideSplash()
  }, [])
  
  return null
}
