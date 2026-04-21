import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Helper to verify super admin
async function verifySuperAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: adminUser } = await supabase
    .from("admin_users")
    .select("role")
    .eq("auth_user_id", user.id)
    .single()

  return adminUser?.role === "super_admin"
}

// GET - Fetch single internal shop item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("internal_shop_items")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ item: data })
}

// PUT - Update internal shop item (super admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  if (!(await verifySuperAdmin(supabase))) {
    return NextResponse.json({ error: "Forbidden - Super admin only" }, { status: 403 })
  }

  const body = await request.json()
  const { name, description, price, image_url, category, is_active, display_order, sku } = body

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) updateData.name = name
  if (description !== undefined) updateData.description = description
  if (price !== undefined) updateData.price = Number(price)
  if (image_url !== undefined) updateData.image_url = image_url
  if (category !== undefined) updateData.category = category
  if (is_active !== undefined) updateData.is_active = is_active
  if (display_order !== undefined) updateData.display_order = display_order
  if (sku !== undefined) updateData.sku = sku

  const { data, error } = await supabase
    .from("internal_shop_items")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}

// DELETE - Delete internal shop item (super admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  if (!(await verifySuperAdmin(supabase))) {
    return NextResponse.json({ error: "Forbidden - Super admin only" }, { status: 403 })
  }

  const { error } = await supabase
    .from("internal_shop_items")
    .delete()
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
