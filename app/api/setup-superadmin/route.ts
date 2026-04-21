import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET() {
  return setupSuperadmin()
}

export async function POST() {
  return setupSuperadmin()
}

// Version 3 - Try create first, then update if exists
async function setupSuperadmin() {
  const email = "fnpr@foodnetdelivery.com"
  const password = "admin123"
  
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    let userId: string
    let action: string

    // Try to create the user first
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) {
      // If user already exists, we need to find them and update password
      if (createError.message.includes("already been registered") || 
          createError.message.includes("already exists") ||
          createError.message.includes("duplicate")) {
        
        // Get user ID from admin_users table (which we control)
        const { data: adminUser } = await supabaseAdmin
          .from("admin_users")
          .select("auth_user_id")
          .eq("email", email)
          .single()
        
        if (adminUser?.auth_user_id) {
          // Update password for existing user
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            adminUser.auth_user_id,
            { password }
          )
          
          if (updateError) {
            return NextResponse.json({ 
              error: "Failed to update password: " + updateError.message, 
              version: 3 
            }, { status: 500 })
          }
          
          userId = adminUser.auth_user_id
          action = "updated_password"
        } else {
          // User exists in auth but not in admin_users - we can't easily get their ID
          // Return a message asking to delete the user from Supabase dashboard
          return NextResponse.json({ 
            error: "User exists in Supabase Auth but not linked in admin_users. Please delete the user with email '" + email + "' from Supabase Auth dashboard, then try again.",
            version: 3
          }, { status: 400 })
        }
      } else {
        return NextResponse.json({ error: createError.message, version: 3 }, { status: 500 })
      }
    } else {
      userId = newUser.user.id
      action = "created"
    }
    
    // Update admin_users record
    const { error: adminError } = await supabaseAdmin
      .from("admin_users")
      .upsert({
        email,
        username: "fnpr",
        role: "super_admin",
        auth_user_id: userId,
      }, {
        onConflict: "email",
      })

    if (adminError) {
      return NextResponse.json({ error: adminError.message, version: 3 }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      version: 3,
      action,
      message: "Superadmin account setup complete! Login with username: fnpr, password: admin123",
      user: { email, username: "fnpr", role: "super_admin", auth_user_id: userId }
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message, version: 3 }, { status: 500 })
  }
}
