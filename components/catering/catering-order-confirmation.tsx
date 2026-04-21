"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function CateringOrderConfirmation() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  // Guard so Purchase only fires once per session_id (React Strict Mode + remounts)
  const purchaseFiredRef = useRef(false)

  useEffect(() => {
    if (!sessionId) {
      setStatus("error")
      return
    }

    const checkStatus = async () => {
      try {
        const response = await fetch(
          `/api/catering/check-payment-status?session_id=${sessionId}`
        )
        const data = await response.json()

        if (data.paid) {
          setOrderNumber(data.orderNumber)
          setStatus("success")
          // Facebook Pixel: Track Purchase (catering) — fire once per session_id
          if (!purchaseFiredRef.current && typeof (globalThis as any).fbq !== "undefined") {
            purchaseFiredRef.current = true
            ;(globalThis as any).fbq("track", "Purchase", {
              value: Number(data.total) || 0,
              currency: "USD",
            })
          }
        } else {
          setStatus("error")
        }
      } catch (error) {
        console.error("[order-confirmation] Error:", error)
        setStatus("error")
      }
    }

    checkStatus()
  }, [sessionId])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Verificando tu pago...</p>
          <p className="text-gray-400 text-sm mt-2">Por favor espera un momento</p>
        </div>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error al verificar el pago</h1>
          <p className="text-gray-500 mb-6">
            No pudimos verificar tu pago. Si fuiste cobrado, por favor contáctanos.
          </p>
          <Link
            href="/catering"
            className="block w-full py-3 rounded-xl bg-gray-900 text-white font-bold text-center"
          >
            Volver al Catering
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Pedido Confirmado!</h1>
        {orderNumber && (
          <p className="text-gray-500 mb-2">
            Número de orden: <span className="font-bold text-gray-900">{orderNumber}</span>
          </p>
        )}
        <p className="text-gray-500 mb-8">
          Tu pedido de catering ha sido recibido. Te enviaremos una confirmación por correo electrónico con todos los detalles.
        </p>
        <Link
          href="/catering"
          className="block w-full py-3 rounded-xl bg-gray-900 text-white font-bold text-center"
        >
          Volver al Catering
        </Link>
      </div>
    </div>
  )
}
