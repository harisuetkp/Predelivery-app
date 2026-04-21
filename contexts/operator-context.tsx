"use client"

import React, { createContext, useContext } from "react"

export interface Operator {
  id: string
  slug: string
  name: string | null
  delivery_enabled: boolean
  catering_enabled: boolean
  subscription_enabled: boolean
  default_language: string
  bilingual: boolean
  tax_rate: number
  show_unified_landing: boolean
  show_delivery_landing: boolean
  show_catering_landing: boolean
  show_subscription_landing: boolean
  created_at: string
}

interface OperatorContextType {
  operator: Operator | null
  isLoading: boolean
}

const OperatorContext = createContext<OperatorContextType | undefined>(undefined)

interface OperatorProviderProps {
  children: React.ReactNode
  operator: Operator | null
}

export function OperatorProvider({ children, operator }: OperatorProviderProps) {
  const value: OperatorContextType = {
    operator,
    isLoading: false,
  }

  return (
    <OperatorContext.Provider value={value}>
      {children}
    </OperatorContext.Provider>
  )
}

export function useOperator() {
  const context = useContext(OperatorContext)
  if (context === undefined) {
    throw new Error("useOperator must be used within an OperatorProvider")
  }
  return context
}

// Helper hook for getting tax rate with default
export function useOperatorTaxRate(defaultRate = 11.5) {
  const { operator } = useOperator()
  return operator?.tax_rate ?? defaultRate
}

// Helper hook for checking feature flags
export function useOperatorFeatures() {
  const { operator } = useOperator()
  return {
    deliveryEnabled: operator?.delivery_enabled ?? true,
    cateringEnabled: operator?.catering_enabled ?? true,
    subscriptionEnabled: operator?.subscription_enabled ?? false,
    showUnifiedLanding: operator?.show_unified_landing ?? true,
    showDeliveryLanding: operator?.show_delivery_landing ?? true,
    showCateringLanding: operator?.show_catering_landing ?? true,
    showSubscriptionLanding: operator?.show_subscription_landing ?? false,
    isBilingual: operator?.bilingual ?? false,
    defaultLanguage: operator?.default_language ?? "es",
  }
}
