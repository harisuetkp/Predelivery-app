import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Check if current user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Check admin status
    const { data: adminCheck } = await supabase
      .from("restaurant_staff")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    }

    const { email, phone } = await request.json()

    if (!email && !phone) {
      return NextResponse.json({ error: "Se requiere email o telefono" }, { status: 400 })
    }

    // Create admin client
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // List all users
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    })

    if (listError) {
      return NextResponse.json({ error: "Error listando usuarios" }, { status: 500 })
    }

    // Filter users by email or phone
    const phoneLast10 = phone?.replace(/\D/g, "").slice(-10)
    
    const matchingUsers = usersData.users.filter(u => {
      // Match by email (partial match)
      if (email && u.email?.toLowerCase().includes(email.toLowerCase())) {
        return true
      }
      // Match by phone (last 10 digits)
      if (phoneLast10 && u.phone) {
        const userPhoneLast10 = u.phone.replace(/\D/g, "").slice(-10)
        if (userPhoneLast10 === phoneLast10) {
          return true
        }
      }
      return false
    })

    // Get order counts and customer info for each user
    const usersWithInfo = await Promise.all(
      matchingUsers.map(async (u) => {
        // Get order count
        const { count: orderCount } = await supabaseAdmin
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", u.id)

        // Get customer record
        const { data: customer } = await supabaseAdmin
          .from("customers")
          .select("first_name, last_name")
          .eq("id", u.id)
          .single()

        return {
          id: u.id,
          email: u.email,
          phone: u.phone,
          created_at: u.created_at,
          customer: customer || null,
          orderCount: orderCount || 0,
        }
      })
    )

    return NextResponse.json({ users: usersWithInfo })

  } catch (error) {
    console.error("Search users error:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
