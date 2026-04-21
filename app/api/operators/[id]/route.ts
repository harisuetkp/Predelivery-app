import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = createServiceClient()
  const body = await req.json()

  const { error } = await supabase
    .from("operators")
    .update({
      name: body.name,
      domain: body.domain || null,
      contact_name: body.contact_name || null,
      contact_email: body.contact_email || null,
      contact_phone: body.contact_phone || null,
      primary_color: body.primary_color || null,
      notes: body.notes || null,
    })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
