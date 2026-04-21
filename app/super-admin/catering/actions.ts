"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function createCateringPortal(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get("name") as string
  const slug = formData.get("slug") as string
  const cuisine_type = formData.get("cuisine_type") as string
  const primary_color = formData.get("primary_color") as string
  const is_chain = formData.get("is_chain") === "true"
  const tax_rate = parseFloat(formData.get("tax_rate") as string) || 11.5
  const branch_name = formData.get("branch_name") as string
  const branch_address = formData.get("branch_address") as string
  const branch_city = formData.get("branch_city") as string
  const branch_phone = formData.get("branch_phone") as string

  if (!name?.trim()) throw new Error("Nombre es requerido")
  if (!slug?.trim()) throw new Error("Slug es requerido")
  if (!branch_name?.trim()) throw new Error("Nombre de sucursal es requerido")

  // Get operator
  const { data: operator, error: opError } = await supabase
    .from("operators")
    .select("id")
    .eq("slug", "foodnetpr")
    .single()

  if (opError || !operator) throw new Error("Operator not found")

  // Check slug is unique
  const { data: existing } = await supabase
    .from("catering_restaurants")
    .select("id")
    .eq("slug", slug)
    .single()

  if (existing) throw new Error(`El slug "${slug}" ya está en uso`)

  // Create catering restaurant
  const { data: portal, error: portalError } = await supabase
    .from("catering_restaurants")
    .insert({
      name: name.trim(),
      slug: slug.trim(),
      cuisine_type: cuisine_type || null,
      primary_color: primary_color || "#000000",
      is_chain,
      tax_rate,
      is_active: true,
      show_in_marketplace: true,
      default_lead_time_hours: 48,
      max_advance_days: 21,
      operator_id: operator.id,
    })
    .select()
    .single()

  if (portalError || !portal) throw new Error(`Error creando portal: ${portalError?.message}`)

  // Create first branch
  const { error: branchError } = await supabase
    .from("catering_branches")
    .insert({
      catering_restaurant_id: portal.id,
      name: branch_name.trim(),
      address: branch_address || null,
      city: branch_city || null,
      phone: branch_phone || null,
      is_active: true,
    })

  if (branchError) throw new Error(`Error creando sucursal: ${branchError.message}`)

  redirect(`/catering/${slug}/admin`)
}

export async function generateSlug(name: string): Promise<string> {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") + "-catering"
}
