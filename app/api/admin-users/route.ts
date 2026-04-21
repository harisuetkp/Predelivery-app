import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { Resend } from "resend"

// Admin client with service role
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function getResend() {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
}

// Role display names for email
const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  csr: "Customer Service Representative (CSR)",
  restaurant_admin: "Restaurant Admin"
}

// GET - Fetch all admin users
export async function GET() {
  try {
    const supabase = getAdminClient()
    
    const { data, error } = await supabase
      .from("admin_users")
      .select("*, restaurants(name, slug)")
      .order("created_at", { ascending: false })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create new admin user
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, email, password, role, restaurant_id, restaurant_tent, operator_id, tent_permissions } = body
    
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Username, email, and password are required" },
        { status: 400 }
      )
    }
    
    if (role === "restaurant_admin" && !restaurant_id) {
      return NextResponse.json(
        { error: "Restaurant is required for restaurant admin" },
        { status: 400 }
      )
    }
    
    const supabase = getAdminClient()
    
    // Check if username already exists
    const { data: existingUser } = await supabase
      .from("admin_users")
      .select("id")
      .eq("username", username)
      .single()
    
    if (existingUser) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 400 }
      )
    }
    
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Auto-confirm email
    })
    
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }
    
    // Create admin_users record
    const { data: adminUser, error: insertError } = await supabase
      .from("admin_users")
      .insert({
        id: authData.user.id, // Use auth user id
        auth_user_id: authData.user.id,
        username,
        email,
        role,
        restaurant_id: role === "restaurant_admin" ? restaurant_id : null,
        restaurant_tent: role === "restaurant_admin" && restaurant_tent ? restaurant_tent : null,
        operator_id: operator_id || null,
        tent_permissions: tent_permissions || {},
      } as any)
      .select("*, restaurants(name, slug)")
      .single()
    
    if (insertError) {
      // Rollback: delete auth user if admin_users insert fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
    
    // Send welcome email with credentials
    const resend = getResend()
    if (resend) {
      try {
        const restaurantName = adminUser.restaurants?.name || ""
        const roleLabel = roleLabels[role] || role
        
        await resend.emails.send({
          from: "FoodNet PR <noreply@prdelivery.com>",
          to: email,
          subject: "Bienvenido al Panel de Administracion - FoodNet PR",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #0f172a; margin: 0;">FoodNet PR</h1>
                <p style="color: #64748b; margin-top: 5px;">Panel de Administracion</p>
              </div>
              
              <h2 style="color: #0f172a;">Bienvenido, ${username}!</h2>
              
              <p style="color: #334155; line-height: 1.6;">
                Se ha creado tu cuenta de administrador en FoodNet PR. A continuacion encontraras tus credenciales de acceso:
              </p>
              
              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Usuario:</strong> ${username}</p>
                <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 0 0 10px 0;"><strong>Contrasena:</strong> ${password}</p>
                <p style="margin: 0 0 10px 0;"><strong>Rol:</strong> ${roleLabel}</p>
                ${restaurantName ? `<p style="margin: 0;"><strong>Restaurante:</strong> ${restaurantName}</p>` : ""}
              </div>
              
              <p style="color: #334155; line-height: 1.6;">
                <strong>Importante:</strong> Te recomendamos cambiar tu contrasena despues de iniciar sesion por primera vez.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://prdelivery.com/admin" 
                   style="display: inline-block; background-color: #0f172a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Iniciar Sesion
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
              
              <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                Este es un correo automatico. Si no solicitaste esta cuenta, por favor contacta al administrador.
              </p>
            </div>
          `,
        })
        console.log(`[Admin Users] Welcome email sent to ${email}`)
      } catch (emailError) {
        console.error("[Admin Users] Failed to send welcome email:", emailError)
        // Don't fail the request if email fails - user was still created
      }
    }
    
    return NextResponse.json(adminUser, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
