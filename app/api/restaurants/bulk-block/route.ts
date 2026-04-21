import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { action, reopenAt, message, excludeRestaurantIds = [] } = body

    if (action === "block") {
      // Update platform settings to block all POP
      const { error: settingsError } = await supabase
        .from("platform_settings")
        .update({
          is_pop_blocked: true,
          pop_reopen_at: reopenAt || null,
          pop_block_message: message || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", (await supabase.from("platform_settings").select("id").eq("tent", "online_ordering").single()).data?.id)

      if (settingsError) {
        return NextResponse.json({ error: settingsError.message }, { status: 500 })
      }

      // Reset all block overrides except excluded restaurants
      const { error: resetError } = await supabase
        .from("restaurants")
        .update({ block_override: false })
        .eq("payment_type", "pop")
        .not("id", "in", `(${excludeRestaurantIds.join(",")})`)

      // Set override for excluded restaurants (they stay open)
      if (excludeRestaurantIds.length > 0) {
        const { error: overrideError } = await supabase
          .from("restaurants")
          .update({ block_override: true })
          .in("id", excludeRestaurantIds)

        if (overrideError) {
          console.error("Error setting overrides:", overrideError)
        }
      }

      return NextResponse.json({ success: true, action: "blocked" })

    } else if (action === "unblock") {
      // Update platform settings to unblock all POP
      const { error: settingsError } = await supabase
        .from("platform_settings")
        .update({
          is_pop_blocked: false,
          pop_reopen_at: null,
          pop_block_message: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", (await supabase.from("platform_settings").select("id").eq("tent", "online_ordering").single()).data?.id)

      if (settingsError) {
        return NextResponse.json({ error: settingsError.message }, { status: 500 })
      }

      // Reset all block overrides
      await supabase
        .from("restaurants")
        .update({ block_override: false })
        .eq("payment_type", "pop")

      return NextResponse.json({ success: true, action: "unblocked" })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
