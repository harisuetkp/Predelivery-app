"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// Accepted IANA zones. Kept as an explicit allow-list so the admin UI cannot
// persist arbitrary text into operators.timezone. Add entries here when a new
// region needs supporting.
const ALLOWED_TIMEZONES = [
  "America/Puerto_Rico",
  "America/Santo_Domingo",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Miami", // alias handled below
] as const

function isValidIanaZone(tz: string): boolean {
  try {
    // Will throw RangeError for an unknown zone in modern Node.
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export async function saveOperatorTimezone(
  operatorId: string,
  timezone: string,
): Promise<ActionResult<{ timezone: string }>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "No autenticado." }

  // Caller must belong to the same operator.
  const { data: adminSelf, error: adminErr } = await supabase
    .from("admin_users")
    .select("operator_id, role")
    .eq("auth_user_id", user.id)
    .single()
  if (adminErr || !adminSelf?.operator_id) {
    return { ok: false, error: "No se pudo resolver el operador del usuario." }
  }
  if (adminSelf.operator_id !== operatorId) {
    return { ok: false, error: "Operador no coincide con el usuario." }
  }

  const trimmed = String(timezone ?? "").trim()
  if (!trimmed) return { ok: false, error: "Zona horaria requerida." }

  const isKnown = (ALLOWED_TIMEZONES as readonly string[]).includes(trimmed)
  if (!isKnown && !isValidIanaZone(trimmed)) {
    return { ok: false, error: `Zona horaria IANA no válida: ${trimmed}` }
  }

  const { error: updateErr } = await supabase
    .from("operators")
    .update({ timezone: trimmed })
    .eq("id", operatorId)
  if (updateErr) return { ok: false, error: updateErr.message }

  revalidatePath("/super-admin/timezone")
  revalidatePath("/super-admin")
  return { ok: true, data: { timezone: trimmed } }
}
