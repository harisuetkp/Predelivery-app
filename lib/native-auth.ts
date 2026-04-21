/**
 * native-auth.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Bridges native Capacitor plugins (Apple Sign In, Google Sign In) with the
 * Supabase auth client.  On web / non-native platforms both functions fall
 * back gracefully to the standard OAuth web-redirect flow.
 *
 * Plugins are imported dynamically so that webpack / Next.js never statically
 * bundles them (they must only run inside the native WebView).
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import { SignInWithApple } from "@capacitor-community/apple-sign-in"
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth"

// ─── Platform detection ────────────────────────────────────────────────────────

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false
  return Boolean((window as any).Capacitor?.isNativePlatform?.())
}

export function getNativePlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web"
  const platform = (window as any).Capacitor?.getPlatform?.()
  if (platform === "ios") return "ios"
  if (platform === "android") return "android"
  return "web"
}

// ─── Apple Sign In ─────────────────────────────────────────────────────────────

export interface AppleSignInResult {
  success: boolean
  error?: string
  cancelled?: boolean
}

/**
 * Sign in with Apple.
 * • On native iOS  → uses @capacitor-community/apple-sign-in plugin then
 *   exchanges the identity token with Supabase via signInWithIdToken.
 * • On web / Android → falls back to Supabase OAuth redirect.
 */
export async function signInWithAppleNative(
  supabase: SupabaseClient,
  redirectTo: string,
  origin: string
): Promise<AppleSignInResult> {
  const platform = getNativePlatform()

  if (platform === "ios") {
    try {
      const rawNonce = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      const encoder = new TextEncoder()
      const encodedData = encoder.encode(rawNonce)
      const hashBuffer = await crypto.subtle.digest("SHA-256", encodedData)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

      const state = Math.random().toString(36).substring(2)

      const result = await SignInWithApple.authorize({
        clientId: "ca.salecalle.marketplace.app",
        redirectURI: "https://auth.prdelivery.com/auth/v1/callback",
        scopes: "email name",
        state,
        nonce: hashedNonce,
      })

      // Exchange Apple identity token with Supabase using the RAW nonce
      // (Supabase will hash it natively and compare it to the token's claim)
      const { data, error: supaError } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: result.response.identityToken,
        nonce: rawNonce,
      })

      if (supaError) throw supaError

      // Ensure a customer record exists for this user
      if (data?.user) {
        await ensureCustomerRecord(supabase, {
          userId: data.user.id,
          email: data.user.email || result.response.email || "",
          firstName:
            result.response.givenName ||
            data.user.user_metadata?.full_name?.split(" ")[0] ||
            "",
          lastName:
            result.response.familyName ||
            data.user.user_metadata?.full_name?.split(" ").slice(1).join(" ") ||
            "",
        })
      }

      return { success: true }
    } catch (err: any) {
      // Error code 1001 = user cancelled
      if (err?.code === "1001" || err?.message?.toLowerCase().includes("cancel")) {
        return { success: false, cancelled: true }
      }
      return { success: false, error: err?.message || "Apple Sign In failed" }
    }
  }

  // Web / Android → OAuth redirect
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        scopes: "name email",
      },
    })
    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || "Apple Sign In failed" }
  }
}

// ─── Google Sign In ────────────────────────────────────────────────────────────

export interface GoogleSignInResult {
  success: boolean
  error?: string
  cancelled?: boolean
}

/**
 * Sign in with Google.
 * • On native iOS / Android → uses @codetrix-studio/capacitor-google-auth plugin
 *   then exchanges the id_token with Supabase via signInWithIdToken.
 * • On web → falls back to Supabase OAuth redirect.
 */
export async function signInWithGoogleNative(
  supabase: SupabaseClient,
  redirectTo: string,
  origin: string
): Promise<GoogleSignInResult> {
  const platform = getNativePlatform()

  if (platform === "ios" || platform === "android") {
    try {

      // Initialize the plugin natively (using configs from capacitor.config.ts)
      await GoogleAuth.initialize({
        scopes: ["profile", "email"],
        grantOfflineAccess: true,
      })

      const googleUser = await GoogleAuth.signIn()

      // googleUser.authentication.idToken is what we need for Supabase
      const idToken = googleUser?.authentication?.idToken
      const accessToken = googleUser?.authentication?.accessToken

      if (!idToken) throw new Error("No ID token returned from Google")

      const { data, error: supaError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
        access_token: accessToken,
      })

      if (supaError) throw supaError

      // Ensure a customer record exists
      if (data?.user) {
        const nameParts = (googleUser.name || "").split(" ")
        await ensureCustomerRecord(supabase, {
          userId: data.user.id,
          email: data.user.email || googleUser.email || "",
          firstName:
            googleUser.givenName ||
            data.user.user_metadata?.full_name?.split(" ")[0] ||
            nameParts[0] ||
            "",
          lastName:
            googleUser.familyName ||
            data.user.user_metadata?.full_name?.split(" ").slice(1).join(" ") ||
            nameParts.slice(1).join(" ") ||
            "",
        })
      }

      return { success: true }
    } catch (err: any) {
      const msg = err?.message || ""
      if (
        msg.toLowerCase().includes("cancel") ||
        msg.toLowerCase().includes("dismissed") ||
        msg.toLowerCase().includes("12501") // Google sign-in cancelled code
      ) {
        return { success: false, cancelled: true }
      }
      return { success: false, error: msg || "Google Sign In failed" }
    }
  }

  // Web → OAuth redirect
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })
    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || "Google Sign In failed" }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

interface CustomerPayload {
  userId: string
  email: string
  firstName: string
  lastName: string
}

/**
 * Upsert a customer record after a successful social login.
 * Matches the same logic used in /auth/callback/route.ts.
 */
async function ensureCustomerRecord(
  supabase: SupabaseClient,
  { userId, email, firstName, lastName }: CustomerPayload
): Promise<void> {
  try {
    // Check if linked by auth_user_id already
    const { data: existingByAuth } = await supabase
      .from("customers")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle()

    if (existingByAuth) return // All good

    // Check by email (imported / legacy customers)
    const { data: existingByEmail } = await supabase
      .from("customers")
      .select("id, auth_user_id")
      .eq("email", email)
      .maybeSingle()

    if (existingByEmail) {
      await supabase
        .from("customers")
        .update({ auth_user_id: userId })
        .eq("id", existingByEmail.id)
      return
    }

    // Create fresh record
    await supabase.from("customers").insert({
      auth_user_id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
    })
  } catch (err) {
    // Non-fatal — don't block the auth flow
    console.error("[native-auth] ensureCustomerRecord error:", err)
  }
}
