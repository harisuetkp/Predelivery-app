import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// This endpoint merges two user accounts:
// - Transfers all orders from source user to target user
// - Updates customer record
// - Deletes the source user account
// Only accessible by admin users

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
      return NextResponse.json({ error: "Solo administradores pueden fusionar cuentas" }, { status: 403 })
    }

    const { sourceUserId, targetUserId, targetEmail } = await request.json()

    if (!sourceUserId || !targetUserId) {
      return NextResponse.json({ error: "Se requieren ambos IDs de usuario" }, { status: 400 })
    }

    // Create admin client
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get both users
    const { data: sourceUser } = await supabaseAdmin.auth.admin.getUserById(sourceUserId)
    const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId)

    if (!sourceUser?.user || !targetUser?.user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    // Transfer all orders from source to target
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .update({ customer_id: targetUserId })
      .eq("customer_id", sourceUserId)
      .select("id")

    if (ordersError) {
      console.error("Error transferring orders:", ordersError)
      return NextResponse.json({ error: "Error al transferir pedidos" }, { status: 500 })
    }

    // Transfer addresses
    await supabaseAdmin
      .from("customer_addresses")
      .update({ customer_id: targetUserId })
      .eq("customer_id", sourceUserId)

    // Transfer favorites
    await supabaseAdmin
      .from("customer_favorites")
      .update({ customer_id: targetUserId })
      .eq("customer_id", sourceUserId)

    // Update target customer record with source's phone if target doesn't have one
    const { data: sourceCustomer } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("id", sourceUserId)
      .single()

    const { data: targetCustomer } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("id", targetUserId)
      .single()

    if (sourceCustomer) {
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
      
      // Copy phone if target doesn't have one
      if (sourceCustomer.phone && !targetCustomer?.phone) {
        updateData.phone = sourceCustomer.phone
      }
      // Copy name if target doesn't have one
      if (sourceCustomer.first_name && !targetCustomer?.first_name) {
        updateData.first_name = sourceCustomer.first_name
      }
      if (sourceCustomer.last_name && !targetCustomer?.last_name) {
        updateData.last_name = sourceCustomer.last_name
      }

      if (Object.keys(updateData).length > 1) {
        await supabaseAdmin
          .from("customers")
          .update(updateData)
          .eq("id", targetUserId)
      }

      // Delete source customer record
      await supabaseAdmin
        .from("customers")
        .delete()
        .eq("id", sourceUserId)
    }

    // Update target auth user with phone from source if needed
    if (sourceUser.user.phone && !targetUser.user.phone) {
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        phone: sourceUser.user.phone,
        phone_confirm: true,
      })
    }

    // Delete source auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(sourceUserId)
    
    if (deleteError) {
      console.error("Error deleting source user:", deleteError)
      // Don't fail - orders were already transferred
    }

    return NextResponse.json({
      success: true,
      message: `Cuentas fusionadas. ${orders?.length || 0} pedidos transferidos.`,
      ordersTransferred: orders?.length || 0,
    })

  } catch (error) {
    console.error("Merge users error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
