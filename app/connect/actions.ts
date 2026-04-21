"use server"

import { createServerClient } from "@/lib/supabase/server"

interface StripeConnectFormData {
  first_name: string
  last_name: string
  business_name: string
  email: string
  tent: string
}

interface StripeConnectResult {
  success: boolean
  onboardingUrl?: string
  error?: string
}

export async function submitStripeConnect(formData: StripeConnectFormData): Promise<StripeConnectResult> {
  // Validate all required fields
  if (!formData.first_name?.trim()) {
    throw new Error("El nombre es requerido")
  }
  if (!formData.last_name?.trim()) {
    throw new Error("El apellido es requerido")
  }
  if (!formData.business_name?.trim()) {
    throw new Error("El nombre del negocio es requerido")
  }
  if (!formData.email?.trim()) {
    throw new Error("El email es requerido")
  }
  if (!formData.tent?.trim()) {
    throw new Error("La plataforma es requerida")
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://prdelivery.com"

  // Step 1: Create Stripe Connect Express account
  const createAccountResponse = await fetch("https://api.stripe.com/v1/accounts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "type": "express",
      "email": formData.email.trim(),
      "business_profile[name]": formData.business_name.trim(),
      "capabilities[card_payments][requested]": "true",
      "capabilities[transfers][requested]": "true",
    }).toString(),
  })

  if (!createAccountResponse.ok) {
    const errorData = await createAccountResponse.json()
    throw new Error(`Error creando cuenta de Stripe: ${errorData.error?.message || "Unknown error"}`)
  }

  const stripeAccount = await createAccountResponse.json()

  // Step 2: Create account link for onboarding
  const createLinkResponse = await fetch("https://api.stripe.com/v1/account_links", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "account": stripeAccount.id,
      "refresh_url": `${baseUrl}/connect?refresh=true`,
      "return_url": `${baseUrl}/connect?success=true`,
      "type": "account_onboarding",
    }).toString(),
  })

  if (!createLinkResponse.ok) {
    const errorData = await createLinkResponse.json()
    throw new Error(`Error creando link de onboarding: ${errorData.error?.message || "Unknown error"}`)
  }

  const accountLink = await createLinkResponse.json()

  // Step 3: Save to stripe_connect_leads table
  const supabase = await createServerClient()
  
  const { error: dbError } = await supabase
    .from("stripe_connect_leads")
    .insert({
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      business_name: formData.business_name.trim(),
      email: formData.email.trim(),
      tent: formData.tent.trim(),
      stripe_account_id: stripeAccount.id,
      stripe_onboarding_url: accountLink.url,
      stripe_onboarding_status: "invited",
      operator_id: null, // Public page, no auth
    })

  if (dbError) {
    throw new Error(`Error guardando datos: ${dbError.message}`)
  }

  // TODO: Send onboarding email via Resend
  // Will be wired once new Resend account is configured
  // Email should contain accountLink.url
  // Send from: hello@foodnetpr.com (pending setup)

  return {
    success: true,
    onboardingUrl: accountLink.url,
  }
}
