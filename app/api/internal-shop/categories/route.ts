import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET - Fetch all unique categories from internal shop items
export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("internal_shop_items")
    .select("category")
    .eq("is_active", true)
    .not("category", "is", null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get unique categories
  const categories = [...new Set(data.map(item => item.category).filter(Boolean))]
  
  return NextResponse.json({ categories })
}
