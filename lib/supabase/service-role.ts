import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client. Bypasses RLS.
 *
 * ONLY use inside trusted server contexts (API routes that have already
 * authenticated the caller, webhooks whose signature you've verified, cron
 * jobs, etc.) — never ship this to the browser or to unauthenticated edges.
 *
 * Rationale: whatsapp_* tables (and several future operator-owned tables)
 * have RLS policies scoped to `service_role` only. The cookie-bound
 * `@/lib/supabase/server` client runs as `anon` or an authenticated end
 * user and cannot write to those tables. Webhook handlers have no user
 * session at all, so they MUST use this client.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set")
  }
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
