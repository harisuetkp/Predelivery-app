import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET - Fetch all internal shop items (public for customer checkout)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get("active") !== "false"
  const category = searchParams.get("category")

  let query = supabase
    .from("internal_shop_items")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true })

  if (activeOnly) {
    query = query.eq("is_active", true)
  }

  if (category) {
    query = query.eq("category", category)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data })
}

// POST - Create new internal shop item (super admin only)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // Verify super admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: adminUser } = await supabase
    .from("admin_users")
    .select("role")
    .eq("auth_user_id", user.id)
    .single()

  if (!adminUser || adminUser.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden - Super admin only" }, { status: 403 })
  }

  const body = await request.json()
  const { name, description, price, image_url, category, is_active, display_order, sku } = body

  if (!name || price === undefined) {
    return NextResponse.json({ error: "Name and price are required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("internal_shop_items")
    .insert({
      name,
      description: description || null,
      price: Number(price),
      image_url: image_url || null,
      category: category || null,
      is_active: is_active !== false,
      display_order: display_order || 0,
      sku: sku || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data }, { status: 201 })
}
