"use server"

import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"
import { resolveOperatorSlugFromHostname, getOperator } from "@/lib/operators"

interface PartnerLeadFormData {
  fullName: string
  restaurantName: string
  address?: string
  email: string
  phone: string
}

export async function submitPartnerLead(data: PartnerLeadFormData) {
  const supabase = await createClient()

  // Validate required fields
  if (!data.fullName?.trim()) {
    throw new Error("Nombre completo es requerido")
  }
  if (!data.restaurantName?.trim()) {
    throw new Error("Nombre del restaurante es requerido")
  }
  if (!data.email?.trim()) {
    throw new Error("Email es requerido")
  }
  if (!data.phone?.trim()) {
    throw new Error("Teléfono es requerido")
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(data.email)) {
    throw new Error("Email inválido")
  }

  // Get operator from hostname
  const headersList = await headers()
  const hostname = headersList.get("host") || headersList.get("x-forwarded-host")

  if (!hostname) {
    throw new Error("Cannot resolve operator: no hostname found in request headers")
  }

  const operatorSlug = await resolveOperatorSlugFromHostname(hostname)
  const operator = await getOperator(operatorSlug)

  if (!operator) {
    throw new Error("Operator not found")
  }

  // Insert lead into database
  const { data: lead, error } = await supabase
    .from("catering_partner_leads")
    .insert({
      full_name: data.fullName.trim(),
      restaurant_name: data.restaurantName.trim(),
      address: data.address?.trim() || null,
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      operator_id: operator.id,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Error al enviar solicitud: ${error.message}`)
  }

  return { success: true, leadId: lead.id }
}
