"use server"

import { createClient } from "@/lib/supabase/server"

// Helper to get operator_id from current admin session
async function getOperatorId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("Not authenticated")

  console.log("[getOperatorId] Looking up admin_users for auth user_id:", user.id)

  const { data: adminUser, error } = await supabase
    .from("admin_users")
    .select("operator_id")
    .eq("auth_user_id", user.id)
    .single()

  if (error || !adminUser) throw new Error("Admin user not found")
  return adminUser.operator_id
}

export interface PopupPayload {
  title: string
  body: string
  image_url: string | null
  cta_text: string | null
  cta_url: string | null
  show_on_delivery: boolean
  show_on_catering: boolean
  show_on_restaurant_portal: boolean
  show_on_catering_portal: boolean
  restaurant_id: string | null
  catering_restaurant_id: string | null
  catering_branch_id: string | null
  delay_seconds: number
  frequency: "once_per_session" | "every_visit"
  start_date: string | null
  end_date: string | null
  is_active: boolean
  collect_email: boolean
  email_capture_label: string | null
  email_button_text: string | null
}

export async function createPopup(
  payload: PopupPayload
): Promise<{ data: Record<string, unknown> } | { error: string }> {
  try {
    const supabase = await createClient()
    const operatorId = await getOperatorId()

    const insertRow = {
      operator_id: operatorId,
      restaurant_id: payload.restaurant_id,
      catering_restaurant_id: payload.catering_restaurant_id,
      catering_branch_id: payload.catering_branch_id,
      title: payload.title,
      body: payload.body,
      image_url: payload.image_url,
      cta_text: payload.cta_text,
      cta_url: payload.cta_url,
      show_on_delivery: payload.show_on_delivery,
      show_on_catering: payload.show_on_catering,
      show_on_restaurant_portal: payload.show_on_restaurant_portal,
      show_on_catering_portal: payload.show_on_catering_portal,
      delay_seconds: payload.delay_seconds,
      frequency: payload.frequency,
      is_active: payload.is_active,
      start_date: payload.start_date,
      end_date: payload.end_date,
      collect_email: payload.collect_email,
      email_capture_label: payload.email_capture_label,
      email_button_text: payload.email_button_text,
    }

    const { data, error } = await supabase
      .from("promotional_popups")
      .insert(insertRow)
      .select()
      .single()

    if (error) {
      console.error("[createPopup] Supabase insert error (full):", error)
      return { error: error.message }
    }

    return { data: data as Record<string, unknown> }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[createPopup] Unexpected error (full):", err)
    return { error: message }
  }
}

export async function updatePopup(id: string, payload: PopupPayload) {
  const supabase = await createClient()
  // Verify admin is authenticated (even for updates)
  await getOperatorId()

  const { data, error } = await supabase
    .from("promotional_popups")
    .update(payload as any)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update popup: ${error.message}`)
  return data
}

export async function deletePopup(id: string) {
  const supabase = await createClient()
  // Verify admin is authenticated
  await getOperatorId()

  const { error } = await supabase
    .from("promotional_popups")
    .delete()
    .eq("id", id)

  if (error) throw new Error(`Failed to delete popup: ${error.message}`)
}

export async function togglePopupActive(id: string, isActive: boolean) {
  const supabase = await createClient()
  // Verify admin is authenticated
  await getOperatorId()

  const { error } = await supabase
    .from("promotional_popups")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) throw new Error(`Failed to toggle popup: ${error.message}`)
}
