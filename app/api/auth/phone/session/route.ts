import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { userId, phone, redirectTo } = await request.json()

    if (!userId || !phone) {
      return NextResponse.json({ error: "User ID and phone required" }, { status: 400 })
    }

    // Verify the user exists
    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    
    if (getUserError || !user) {
      console.error("User not found:", getUserError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify the phone matches (be lenient with format differences)
    const normalizedUserPhone = user.phone?.replace(/\D/g, "") || ""
    const normalizedInputPhone = phone.replace(/\D/g, "")
    
// Get last 10 digits (US/PR phone numbers)
    const userLast10 = normalizedUserPhone.slice(-10)
    const inputLast10 = normalizedInputPhone.slice(-10)
    
    console.log("[v0] Session: User ID:", userId)
    console.log("[v0] Session: User phone from DB:", user.phone, "->", userLast10)
    console.log("[v0] Session: Input phone:", phone, "->", inputLast10)
    
    // If user has no phone set, update it
    if (!normalizedUserPhone) {
      console.log("[v0] Session: User has no phone, updating...")
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        phone: phone,
        phone_confirm: true,
      })
    } else if (userLast10 !== inputLast10) {
      console.error("[v0] Session: Phone MISMATCH - user:", userLast10, "input:", inputLast10)
      return NextResponse.json({ error: "Phone mismatch" }, { status: 403 })
    } else {
      console.log("[v0] Session: Phone MATCH confirmed")
    }

    // Since we verified via Twilio and have the user, we need to create a session
    // The approach: re-enable Supabase phone OTP flow but skip the SMS since we already verified
    
    // We'll use the Supabase client to do a "fake" OTP verification
    // by generating an OTP server-side and immediately verifying it
    
    // Alternative approach: Use the recovery flow
    // Generate a recovery token and immediately use it
    
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://prdelivery.com"
    const finalRedirect = redirectTo || "/"
    
    // Ensure user has an email for the recovery flow
    let userEmail = user.email
    if (!userEmail) {
      const placeholderEmail = `phone.${normalizedInputPhone.slice(-10)}@prdelivery.com`
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: placeholderEmail,
        email_confirm: true,
      })
      userEmail = placeholderEmail
    }

    // Generate a recovery link (more reliable than magiclink for phone users)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: userEmail,
      options: {
        redirectTo: `${origin}/auth/callback?redirect_to=${encodeURIComponent(finalRedirect)}`,
      },
    })

    if (linkError) {
      console.error("Error generating link:", linkError)
      return NextResponse.json({ 
        error: "Error creating session" 
      }, { status: 500 })
    }

    // Extract the token from the link and use it server-side to get session
    const actionLink = linkData?.properties?.action_link
    const tokenHash = linkData?.properties?.hashed_token
    
    if (!tokenHash) {
      console.error("No token hash in link data")
      // Fallback to redirecting through the action link
      if (actionLink) {
        return NextResponse.json({ 
          success: true, 
          magicLink: actionLink,
          userId,
        })
      }
      return NextResponse.json({ error: "No token generated" }, { status: 500 })
    }

    // Verify the token server-side to get session tokens
    const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    })

    if (verifyError || !sessionData.session) {
      console.error("Error verifying token:", verifyError)
      // Fallback to action link
      if (actionLink) {
        return NextResponse.json({ 
          success: true, 
          magicLink: actionLink,
          userId,
        })
      }
      return NextResponse.json({ error: "Error creating session" }, { status: 500 })
    }

    // We have a session! Set the cookies
    const cookieStore = await cookies()
    const { access_token, refresh_token, expires_in } = sessionData.session
    
    const maxAge = expires_in || 3600
    const cookieOptions = {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge,
    }

    // Set the session cookies in the format Supabase expects
    cookieStore.set("sb-access-token", access_token, cookieOptions)
    cookieStore.set("sb-refresh-token", refresh_token, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 7, // 7 days for refresh token
    })
    
    // Also set the combined auth cookie that @supabase/ssr uses
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1] || "supabase"
    const authCookieName = `sb-${projectRef}-auth-token`
    
    cookieStore.set(authCookieName, JSON.stringify({
      access_token,
      refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + maxAge,
      expires_in: maxAge,
      token_type: "bearer",
      user: sessionData.user,
    }), {
      ...cookieOptions,
      httpOnly: false, // This cookie needs to be readable by client
    })

    return NextResponse.json({ 
      success: true, 
      hasSession: true,
      redirectTo: finalRedirect,
      userId: sessionData.user?.id,
    })

  } catch (error: any) {
    console.error("Session creation error:", error)
    return NextResponse.json(
      { error: error.message || "Error creating session" },
      { status: 500 }
    )
  }
}
