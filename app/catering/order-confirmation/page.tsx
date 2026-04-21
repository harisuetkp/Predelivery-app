import { Suspense } from "react"
import CateringOrderConfirmation from "@/components/catering/catering-order-confirmation"

export default function CateringOrderConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Verificando tu pago...</p>
        </div>
      </div>
    }>
      <CateringOrderConfirmation />
    </Suspense>
  )
}
