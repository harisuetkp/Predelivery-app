"use client"

import { useCallback, useState, useEffect, useMemo } from "react"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { createCheckoutSession } from "@/app/actions/stripe"
import { X } from "lucide-react"

// Default Stripe Connect account for FoodNetPR
// Set to empty string to process payments directly to the platform account
const DEFAULT_STRIPE_ACCOUNT_ID = ""

interface StripeCheckoutProps {
  orderData: {
    cart: any[]
    subtotal: number
    tax: number
    deliveryFee: number
    tip: number
    total: number
    orderType: string
    eventDetails: any
    includeUtensils?: boolean
    customerEmail: string
    customerPhone?: string
    smsConsent?: boolean
    servicePackage?: string | null
    stripeAccountId?: string | null
    customerId?: string | null
  }
  onSuccess: () => void
  onCancel: () => void
  restaurantName?: string
  primaryColor?: string
}

export default function StripeCheckout({ orderData, onSuccess, onCancel, restaurantName, primaryColor }: StripeCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Load Stripe - with connected account if specified, otherwise direct to platform
  const stripePromise = useMemo(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!publishableKey) {
      console.error("[v0] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set")
      setError("Stripe no está configurado correctamente. Contacte al administrador.")
      return null
    }
    const accountId = orderData.stripeAccountId || DEFAULT_STRIPE_ACCOUNT_ID
    // Only pass stripeAccount option if we have a connected account ID
    return accountId 
      ? loadStripe(publishableKey, { stripeAccount: accountId })
      : loadStripe(publishableKey)
  }, [orderData.stripeAccountId])

const fetchClientSecret = useCallback(async () => {
  try {
    const result = await createCheckoutSession(orderData)
    if (!result || !result.clientSecret) {
      throw new Error("No se pudo crear la sesión de pago. Por favor intenta de nuevo.")
    }
    setClientSecret(result.clientSecret)
    setSessionId(result.sessionId)
    return result.clientSecret
  } catch (err: any) {
    console.error("[v0] Stripe checkout error:", err)
    const errorMessage = err?.message || "Error al procesar el pago. Por favor intenta de nuevo."
    setError(errorMessage)
    throw err
  }
}, [orderData])

  // Poll for payment completion
  useEffect(() => {
    if (!sessionId) return

    const interval = setInterval(async () => {
      try {
        // Include stripe_account_id in the polling URL only if we have a connected account
        const accountId = orderData.stripeAccountId || DEFAULT_STRIPE_ACCOUNT_ID
        const url = accountId 
          ? `/api/check-payment-status?session_id=${sessionId}&stripe_account_id=${accountId}`
          : `/api/check-payment-status?session_id=${sessionId}`
        const response = await fetch(url)
        const data = await response.json()

        if (data.status === "complete") {
          clearInterval(interval)
          onSuccess()
        }
      } catch (err) {
        console.error("Error checking payment status:", err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [sessionId, onSuccess, orderData.stripeAccountId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-lg font-bold">Completar Pago</h3>
            {restaurantName && <p className="text-sm text-gray-500">{restaurantName}</p>}
          </div>
          <button 
            onClick={onCancel} 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {error ? (
            <>
              <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <button onClick={onCancel} className="w-full bg-gray-900 text-white py-3 rounded font-bold hover:bg-gray-800">
                Volver
              </button>
            </>
          ) : !stripePromise ? (
            <>
              <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
                <p className="text-sm text-red-800">Stripe no está configurado correctamente. Por favor contacte al administrador.</p>
              </div>
              <button onClick={onCancel} className="w-full bg-gray-900 text-white py-3 rounded font-bold hover:bg-gray-800">
                Volver
              </button>
            </>
          ) : (
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </div>
      </div>
    </div>
  )
}
