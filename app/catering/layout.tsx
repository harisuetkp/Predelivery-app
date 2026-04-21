import type React from "react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getOperator, resolveOperatorSlugFromHostname } from "@/lib/operators"
import { validateOperatorForCatering } from "@/lib/catering"

export const metadata: Metadata = {
  title: "Catering | FoodNetPR",
  description: "Ordena catering para tus eventos y celebraciones",
}

export default async function CateringLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Resolve operator from hostname
  const headersList = await headers()
  const hostname = headersList.get("host") || headersList.get("x-forwarded-host")

  if (!hostname) {
    throw new Error("Cannot resolve operator: no hostname found in request headers")
  }

  const operatorSlug = await resolveOperatorSlugFromHostname(hostname)
  const operator = await getOperator(operatorSlug)

  // Validate catering is enabled for this operator
  try {
    validateOperatorForCatering(operator)
  } catch (error: any) {
    if (error.code === "CATERING_DISABLED" || error.code === "CATERING_LANDING_DISABLED") {
      notFound()
    }
    throw error
  }

  return <>{children}</>
}
