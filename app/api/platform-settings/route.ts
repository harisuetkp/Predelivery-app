import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Helper to get operator_id for "foodnetpr"
async function getOperatorId(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("operators")
    .select("id")
    .eq("slug", "foodnetpr")
    .single()
  return data?.id || null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tent = searchParams.get("tent") || "online_ordering"
  
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("platform_settings")
    .select("*")
    .eq("tent", tent)
    .single()
  
  if (error) throw new Error(`platform_settings query failed: ${error.message}`)
  if (!data) throw new Error("platform_settings not found")
  
  return NextResponse.json(data)
}

// PATCH for partial updates (e.g., hero settings only)
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const tent = body.tent || "online_ordering"
    
    const operatorId = await getOperatorId(supabase)
    if (!operatorId) {
      throw new Error("Operator 'foodnetpr' not found")
    }
    
    // Get existing settings for this operator + tent
    const { data: existing, error: fetchError } = await supabase
      .from("platform_settings")
      .select("id")
      .eq("operator_id", operatorId)
      .eq("tent", tent)
      .single()
    
    if (fetchError || !existing) {
      throw new Error(`platform_settings not found for tent '${tent}': ${fetchError?.message || "No data"}`)
    }
    
    // Remove tent from body before spreading (it's used for filtering, not updating)
    const { tent: _tent, ...updateFields } = body
    
    // Update only the fields provided
    const { data, error } = await supabase
      .from("platform_settings")
      .update({
        ...updateFields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to update platform_settings: ${error.message}`)
    }
    
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error patching platform settings:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const tent = body.tent || "online_ordering"
    
    const operatorId = await getOperatorId(supabase)
    if (!operatorId) {
      throw new Error("Operator 'foodnetpr' not found")
    }
    
    // Check if settings exist for this operator + tent
    const { data: existing } = await supabase
      .from("platform_settings")
      .select("id")
      .eq("operator_id", operatorId)
      .eq("tent", tent)
      .single()
    
    let result
    
    if (existing) {
      // Update existing settings
      const { data, error } = await supabase
        .from("platform_settings")
        .update({
          is_platform_open: body.is_platform_open,
          is_pop_blocked: body.is_pop_blocked,
          operating_hours_start: body.operating_hours_start,
          operating_hours_end: body.operating_hours_end,
          operating_days: body.operating_days,
          emergency_block_active: body.emergency_block_active,
          emergency_block_reason: body.emergency_block_reason,
          pop_reopen_at: body.pop_reopen_at,
          pop_block_message: body.pop_block_message,
          blocked_zip_codes: body.blocked_zip_codes ?? [],
          delivery_fee_subsidy: body.delivery_fee_subsidy ?? 3.0,
          // Internal shop fields
          is_internal_shop_open: body.is_internal_shop_open,
          internal_shop_reopen_at: body.internal_shop_reopen_at,
          internal_shop_link_to_pop: body.internal_shop_link_to_pop,
          internal_shop_standalone_enabled: body.internal_shop_standalone_enabled,
          internal_shop_delivery_fee: body.internal_shop_delivery_fee,
          internal_shop_min_order: body.internal_shop_min_order,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single()
      
      if (error) throw error
      result = data
    } else {
      // Insert new settings with operator_id and tent
      const { data, error } = await supabase
        .from("platform_settings")
        .insert({
          operator_id: operatorId,
          tent: tent,
          is_platform_open: body.is_platform_open ?? true,
          is_pop_blocked: body.is_pop_blocked ?? false,
          operating_hours_start: body.operating_hours_start ?? "11:00",
          operating_hours_end: body.operating_hours_end ?? "20:30",
          operating_days: body.operating_days ?? {
            sunday: true,
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: true,
          },
          emergency_block_active: body.emergency_block_active ?? false,
          emergency_block_reason: body.emergency_block_reason,
          pop_reopen_at: body.pop_reopen_at,
          pop_block_message: body.pop_block_message,
          blocked_zip_codes: body.blocked_zip_codes ?? [],
          delivery_fee_subsidy: body.delivery_fee_subsidy ?? 3.0,
          // Internal shop fields
          is_internal_shop_open: body.is_internal_shop_open ?? true,
          internal_shop_reopen_at: body.internal_shop_reopen_at,
          internal_shop_link_to_pop: body.internal_shop_link_to_pop ?? false,
          internal_shop_standalone_enabled: body.internal_shop_standalone_enabled ?? false,
          internal_shop_delivery_fee: body.internal_shop_delivery_fee ?? 3.00,
          internal_shop_min_order: body.internal_shop_min_order ?? 0,
        })
        .select()
        .single()
      
      if (error) throw error
      result = data
    }
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error updating platform settings:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
