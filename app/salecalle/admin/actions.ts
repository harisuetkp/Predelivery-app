"use server"

import { createClient } from "@/lib/supabase/server"

export async function fetchAllOperators() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("operators")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) throw new Error(`Failed to fetch operators: ${error.message}`)
  return data || []
}

export async function createOperator(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get("name") as string
  const slug = formData.get("slug") as string
  const domain = formData.get("domain") as string
  const contact_name = formData.get("contact_name") as string
  const contact_email = formData.get("contact_email") as string
  const contact_phone = formData.get("contact_phone") as string
  const delivery_enabled = formData.get("delivery_enabled") === "true"
  const catering_enabled = formData.get("catering_enabled") === "true"
  const subscription_enabled = formData.get("subscription_enabled") === "true"
  const default_language = formData.get("default_language") as string || "es"
  const bilingual = formData.get("bilingual") === "true"
  const primary_color = formData.get("primary_color") as string || "#000000"
  const notes = formData.get("notes") as string

  if (!name?.trim()) throw new Error("Nombre es requerido")
  if (!slug?.trim()) throw new Error("Slug es requerido")

  const { data: existing } = await supabase
    .from("operators")
    .select("id")
    .eq("slug", slug)
    .single()

  if (existing) throw new Error(`El slug "${slug}" ya está en uso`)

  const { data, error } = await supabase
    .from("operators")
    .insert({
      name: name.trim(),
      slug: slug.trim(),
      domain: domain || null,
      contact_name: contact_name || null,
      contact_email: contact_email || null,
      contact_phone: contact_phone || null,
      delivery_enabled,
      catering_enabled,
      subscription_enabled,
      default_language,
      bilingual,
      primary_color,
      notes: notes || null,
      is_active: true,
      onboarded_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`Error creando operador: ${error.message}`)
  return data
}

export async function updateOperatorTents(
  operatorId: string,
  tents: {
    delivery_enabled: boolean
    catering_enabled: boolean
    subscription_enabled: boolean
  }
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("operators")
    .update(tents)
    .eq("id", operatorId)
  if (error) throw new Error(`Failed to update operator tents: ${error.message}`)
}

export async function updateOperatorStatus(operatorId: string, is_active: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("operators")
    .update({ is_active })
    .eq("id", operatorId)
  if (error) throw new Error(`Failed to update operator status: ${error.message}`)
}
