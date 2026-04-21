"use server"

import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"
import { resolveOperatorSlugFromHostname } from "@/lib/operators"

interface PartnerLeadData {
  fullName: string
  restaurantName: string
  address: string
  email: string
  phone: string
}

interface SubmitResult {
  success: boolean
  error?: string
}

export async function submitDeliveryPartnerLead(data: PartnerLeadData): Promise<SubmitResult> {
  // Validate required fields - no fallbacks
  if (!data.fullName || data.fullName.trim() === "") {
    return { success: false, error: "El nombre completo es requerido" }
  }
  if (!data.restaurantName || data.restaurantName.trim() === "") {
    return { success: false, error: "El nombre del restaurante es requerido" }
  }
  if (!data.email || data.email.trim() === "") {
    return { success: false, error: "El correo electrónico es requerido" }
  }
  if (!data.phone || data.phone.trim() === "") {
    return { success: false, error: "El teléfono es requerido" }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(data.email.trim())) {
    return { success: false, error: "El formato del correo electrónico no es válido" }
  }

  // Resolve operator from hostname
  const headersList = await headers()
  const hostname = headersList.get("host") || "localhost"
  
  let operatorSlug: string
  try {
    operatorSlug = await resolveOperatorSlugFromHostname(hostname)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error resolviendo operador"
    return { success: false, error: errorMessage }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("delivery_partner_leads")
    .insert({
      full_name: data.fullName.trim(),
      restaurant_name: data.restaurantName.trim(),
      address: data.address?.trim() || null,
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      operator_id: operatorSlug,
    })

  if (error) {
    console.error("Error inserting delivery partner lead:", error)
    return { success: false, error: `Error al enviar solicitud: ${error.message}` }
  }

  return { success: true }
}
