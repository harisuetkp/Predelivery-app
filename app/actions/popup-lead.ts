"use server"

import { createClient } from "@supabase/supabase-js"

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error("Database configuration missing")
  }
  
  return createClient(url, key)
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

interface SubmitPopupLeadData {
  popupId: string
  email: string
  operatorId: string
  restaurantId?: string
  cateringRestaurantId?: string
  cateringBranchId?: string
  pageUrl?: string
}

export async function submitPopupLead(data: SubmitPopupLeadData): Promise<{
  success: boolean
  isExistingCustomer: boolean
  error?: string
}> {
  // 1. Validate email is present and valid format
  if (!data.email) {
    throw new Error("Email es requerido")
  }
  
  const email = data.email.trim().toLowerCase()
  
  if (!isValidEmail(email)) {
    throw new Error("Formato de email inválido")
  }
  
  if (!data.popupId) {
    throw new Error("Popup ID es requerido")
  }
  
  if (!data.operatorId) {
    throw new Error("Operator ID es requerido")
  }

  let supabase
  try {
    supabase = getSupabaseClient()
  } catch (error) {
    throw new Error("Error de configuración del servidor")
  }

  // 2. Look up customer by email
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("email", email)
    .limit(1)
    .single()

  const customerId = existingCustomer?.id || null
  const isExistingCustomer = !!customerId

  // 3. Insert into promotional_popup_leads
  const { error: insertError } = await supabase
    .from("promotional_popup_leads")
    .insert({
      popup_id: data.popupId,
      operator_id: data.operatorId,
      email: email,
      customer_id: customerId,
      is_existing_customer: isExistingCustomer,
      restaurant_id: data.restaurantId || null,
      catering_restaurant_id: data.cateringRestaurantId || null,
      catering_branch_id: data.cateringBranchId || null,
      page_url: data.pageUrl || null,
    })

  if (insertError) {
    throw new Error(`Error al guardar lead: ${insertError.message}`)
  }

  // 4. Return success
  return {
    success: true,
    isExistingCustomer,
  }
}
