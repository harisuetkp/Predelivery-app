"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { sendWelcomeEmail } from "@/lib/email/send-welcome-email"

export async function customerSignUp(formData: FormData) {
  const supabase = await createClient()
  
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const phone = formData.get("phone") as string | null
  const redirectTo = formData.get("redirectTo") as string | null

  if (!email || !password || !firstName || !lastName) {
    return { error: "Todos los campos son requeridos" }
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: "customer",
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || ""}/auth/callback?next=${redirectTo || "/"}`,
    },
  })

  if (authError) {
    return { error: authError.message }
  }

  if (!authData.user) {
    return { error: "Error al crear la cuenta" }
  }

  // Detect repeated signup: when email is already registered and confirmed,
  // Supabase returns a user object with an empty identities array and no session.
  // In that case we must tell the user to log in instead of showing the "check your email" success message.
  if (authData.user.identities && authData.user.identities.length === 0) {
    return {
      error: "Este correo ya está registrado. Por favor inicia sesión."
    }
  }

  const { data: existingCustomerByAuth } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle()

  // Create customer record in customers table
  // The trigger will handle this automatically, but we can also do it here for extra data
  const { error: customerError } = await supabase
    .from("customers")
    .upsert({
      auth_user_id: authData.user.id,
      email: email,
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
    }, {
      onConflict: "auth_user_id"
    })

  if (customerError) {
    console.error("Error creating customer record:", customerError)
    // Don't fail the signup, the trigger should handle it
  } else if (!existingCustomerByAuth) {
    const platformOperatorId = process.env.PLATFORM_OPERATOR_ID
    if (!platformOperatorId) {
      // Do not block signup — but surface the misconfig loudly so ops notices.
      console.error("[email:welcome] PLATFORM_OPERATOR_ID is not set; welcome email skipped for", email)
    } else {
      sendWelcomeEmail(email, `${firstName} ${lastName}`.trim(), platformOperatorId).catch((err) => {
        console.error("[email:welcome] SEND FAILED for", email, err)
      })
    }
  }

  // If email confirmation is required, show message
  if (!authData.session) {
    return { 
      success: true, 
      message: "Cuenta creada. Por favor revisa tu correo para verificar tu cuenta." 
    }
  }

  // If auto-confirmed, redirect
  return { success: true, redirectTo: redirectTo || "/" }
}

export async function customerSignIn(formData: FormData) {
  const supabase = await createClient()
  
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const redirectTo = formData.get("redirectTo") as string | null

  if (!email || !password) {
    return { error: "Email y contraseña son requeridos" }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Ensure customer record exists and is linked
  if (data.user) {
    const { data: customerByAuth } = await supabase
      .from("customers")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .single()

    if (!customerByAuth) {
      // Check if customer exists by email (imported or legacy)
      const { data: customerByEmail } = await supabase
        .from("customers")
        .select("id")
        .eq("email", data.user.email!)
        .single()

      if (customerByEmail) {
        // Link existing customer to this auth user
        await supabase
          .from("customers")
          .update({ auth_user_id: data.user.id })
          .eq("id", customerByEmail.id)
        
        // Also update profiles table if exists
        await supabase
          .from("profiles")
          .update({ auth_user_id: data.user.id })
          .eq("email", data.user.email!)
      } else {
        // Create customer record if it doesn't exist
        await supabase.from("customers").insert({
          auth_user_id: data.user.id,
          email: data.user.email!,
          first_name: data.user.user_metadata?.first_name || "",
          last_name: data.user.user_metadata?.last_name || "",
        })
      }
    }
  }

  return { success: true, redirectTo: redirectTo || "/" }
}

export async function customerSignOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}

export async function getCustomerSession() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  // Get customer record
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("auth_user_id", user.id)
    .single()

  return {
    user,
    customer,
  }
}

export async function updateCustomerProfile(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "No autenticado" }
  }

  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const phone = formData.get("phone") as string | null

  const { error } = await supabase
    .from("customers")
    .update({
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq("auth_user_id", user.id)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
