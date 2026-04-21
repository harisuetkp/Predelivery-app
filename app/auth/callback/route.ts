import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { sendWelcomeEmail } from "@/lib/email/send-welcome-email"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const cookieStore = await cookies()
    
    // Create a Supabase client with proper cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore errors when called from Server Component
            }
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      // After exchanging the code, check if we need to create/link a customer record.
      const user = data.session.user

      if (user) {
        // Check if a customer record already exists for this auth user.
        const { data: existingByAuthId } = await supabase
          .from("customers")
          .select("id")
          .eq("auth_user_id", user.id)
          .single()

        if (!existingByAuthId) {
          // No customer row yet linked to this auth user. 
          // Check if a customer exists with the same email (imported or legacy).
          const { data: existingByEmail } = await supabase
            .from("customers")
            .select("id, auth_user_id")
            .eq("email", user.email!)
            .single()

          if (existingByEmail) {
            // Customer exists with this email - link to current auth user
            await supabase
              .from("customers")
              .update({ auth_user_id: user.id })
              .eq("id", existingByEmail.id)
            
            // Also update the profiles table if exists
            await supabase
              .from("profiles")
              .update({ auth_user_id: user.id })
              .eq("email", user.email!)
          } else {
            // No existing customer - create a fresh customer record.
            await supabase.from("customers").insert({
              auth_user_id: user.id,
              email: user.email!,
              first_name: user.user_metadata?.full_name?.split(" ")[0] || user.user_metadata?.name?.split(" ")[0] || "",
              last_name: user.user_metadata?.full_name?.split(" ").slice(1).join(" ") || "",
            })
            const platformOperatorId = process.env.PLATFORM_OPERATOR_ID
            if (!platformOperatorId) {
              console.error("[email:welcome] PLATFORM_OPERATOR_ID is not set; welcome email skipped for", user.email)
            } else {
              sendWelcomeEmail(
                user.email!,
                user.user_metadata?.full_name || user.user_metadata?.name || "",
                platformOperatorId
              ).catch((err) => {
                console.error("[email:welcome] SEND FAILED for", user.email, err)
              })
            }
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
