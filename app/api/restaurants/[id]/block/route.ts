import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const body = await request.json()

    // Accept both payload shapes:
    //   Column-shaped (what the frontend sends today): { is_manually_blocked, blocked_until }
    //   Legacy shape:                                  { blocked, duration, reason }
    const hasColumnShape =
      typeof body.is_manually_blocked === "boolean" ||
      body.blocked_until !== undefined

    const blocked: boolean =
      typeof body.is_manually_blocked === "boolean"
        ? body.is_manually_blocked
        : typeof body.blocked === "boolean"
          ? body.blocked
          : false

    const duration: number | undefined =
      typeof body.duration === "number" ? body.duration : undefined

    const reason: string | undefined =
      typeof body.reason === "string" ? body.reason : undefined

    const updateData: any = {
      is_manually_blocked: blocked,
    }

    if (hasColumnShape) {
      // Trust the explicit blocked_until the client sent (may be ISO string or null)
      updateData.blocked_until = body.blocked_until ?? null
    } else if (blocked && duration) {
      const blockedUntil = new Date()
      blockedUntil.setMinutes(blockedUntil.getMinutes() + duration)
      updateData.blocked_until = blockedUntil.toISOString()
    } else if (!blocked) {
      updateData.blocked_until = null
    }

    const { data, error } = await supabase
      .from("restaurants")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log the block action
    await supabase.from("block_log").insert({
      restaurant_id: id,
      action: blocked ? "block" : "unblock",
      reason: reason || (blocked ? (duration ? `Temp block for ${duration} minutes` : "Manual block") : "Manual unblock"),
      duration_minutes: duration || null
    })

    return NextResponse.json({ success: true, restaurant: data })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
