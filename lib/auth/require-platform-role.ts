import { createClient } from "@/lib/supabase/server"

/**
 * Gate a handler on the caller being a platform-level admin
 * (super_admin, manager, or csr) in public.admin_users.
 *
 * Returns the caller's userId and role on success; throws with a
 * 401-ish or 403-ish message on failure. Callers should translate
 * thrown errors into NextResponse status codes.
 *
 * IMPORTANT: uses the cookie-scoped supabase client (not service-role),
 * so the identity check itself is still subject to RLS. Once this
 * function returns, callers are free to use the service-role client
 * for the actual data work.
 */
const PLATFORM_ROLES = new Set(["super_admin", "manager", "csr"])

export async function requirePlatformRole(): Promise<{
  userId: string
  role: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    const err = new Error("Unauthorized")
    ;(err as any).status = 401
    throw err
  }

  const { data: adminRow, error: adminError } = await supabase
    .from("admin_users")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (adminError || !adminRow) {
    const err = new Error("Forbidden")
    ;(err as any).status = 403
    throw err
  }

  if (!PLATFORM_ROLES.has(adminRow.role)) {
    const err = new Error("Forbidden")
    ;(err as any).status = 403
    throw err
  }

  return { userId: user.id, role: adminRow.role }
}
