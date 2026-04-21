import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = createServiceClient()
  const { is_manually_blocked } = await req.json()

  const { error } = await supabase
    .from("catering_restaurants")
    .update({ is_manually_blocked, blocked_until: null })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
