/**
 * Dispatch fee calculation utility for catering orders.
 * Used by both CSR phone orders and customer-facing portal.
 */

export type DispatchFeeType = "none" | "fixed" | "percentage" | "per_order"
export type DispatchFeeAppliesTo = "entrega" | "recogido" | "both"

export interface DispatchFeeConfig {
  dispatch_fee_type: DispatchFeeType | null
  dispatch_fee_value: number | null
  dispatch_fee_applies_to: DispatchFeeAppliesTo | null
}

/**
 * Calculate the dispatch fee based on restaurant configuration and order details.
 * 
 * @param restaurant - The restaurant's dispatch fee configuration
 * @param orderType - "entrega" (delivery) or "recogido" (pickup)
 * @param subtotal - The order subtotal (only used for percentage calculations)
 * @returns The dispatch fee amount as a number
 */
export function calculateDispatchFee(
  restaurant: DispatchFeeConfig,
  orderType: "entrega" | "recogido",
  subtotal: number
): number {
  const { dispatch_fee_type, dispatch_fee_value, dispatch_fee_applies_to } = restaurant

  // If no dispatch fee type is set or it's "none", return 0
  if (!dispatch_fee_type || dispatch_fee_type === "none") {
    return 0
  }

  // If no value is set, return 0
  if (dispatch_fee_value === null || dispatch_fee_value === undefined) {
    return 0
  }

  // Check if the fee applies to this order type
  const appliesTo = dispatch_fee_applies_to || "both"
  
  if (appliesTo === "entrega" && orderType === "recogido") {
    return 0
  }
  
  if (appliesTo === "recogido" && orderType === "entrega") {
    return 0
  }

  // Calculate based on fee type
  switch (dispatch_fee_type) {
    case "fixed":
    case "per_order":
      return dispatch_fee_value
    
    case "percentage":
      return (subtotal * dispatch_fee_value) / 100
    
    default:
      return 0
  }
}

/**
 * Format dispatch fee type for display in admin UI
 */
export function formatDispatchFeeTypeLabel(type: DispatchFeeType | null): string {
  switch (type) {
    case "none":
      return "Sin tarifa"
    case "fixed":
      return "Monto fijo"
    case "percentage":
      return "Porcentaje de la orden"
    case "per_order":
      return "Tarifa por orden"
    default:
      return "Sin tarifa"
  }
}

/**
 * Format dispatch fee applies_to for display
 */
export function formatDispatchFeeAppliesToLabel(appliesTo: DispatchFeeAppliesTo | null): string {
  switch (appliesTo) {
    case "entrega":
      return "Entrega"
    case "recogido":
      return "Recogido"
    case "both":
      return "Ambos"
    default:
      return "Ambos"
  }
}
