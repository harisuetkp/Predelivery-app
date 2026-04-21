import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { join } from "path"

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Read JSON from data/ folder (accessible to Next.js server)
  let raw: any
  try {
    const jsonPath = join(process.cwd(), "data/foodnet_import_complete.json")
    raw = JSON.parse(readFileSync(jsonPath, "utf-8"))
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to read JSON: " + err.message }, { status: 500 })
  }

  // 2. Build external_id → prompt map
  // JSON structure: [ { restaurant, categories: [ { items: [ { options: [...] } ] } ] } ]
  const entries: any[] = Array.isArray(raw) ? raw : raw.restaurants ?? Object.values(raw)

  const promptMap = new Map<string, string>()

  for (const entry of entries) {
    // Support both flat items list and categories-based nesting
    const categories: any[] = entry.categories ?? []
    const flatItems: any[] = entry.menu_items ?? entry.items ?? []

    const allItems: any[] = [
      ...flatItems,
      ...categories.flatMap((cat: any) => cat.items ?? cat.menu_items ?? []),
    ]

    for (const item of allItems) {
      const options: any[] = item.options ?? item.item_options ?? []
      for (const option of options) {
        const extId = String(option.id ?? option.external_id ?? "").trim()
        // Prefer the customer-facing prompt; fall back to group_name (internal name)
        const label = String(option.prompt ?? option.group_name ?? "").trim()
        if (extId && label) {
          promptMap.set(extId, label)
        }
      }
    }
  }

  // Log first 3 map entries for verification
  const sampleEntries = Array.from(promptMap.entries()).slice(0, 3)
  console.log("[v0] backfill-prompts map sample:", JSON.stringify(sampleEntries))

  if (promptMap.size === 0) {
    return NextResponse.json({ error: "No prompts found in JSON — check options[].prompt field" }, { status: 400 })
  }

  // 3. Fetch all item_options that have an external_id
  const { data: allOptions, error: fetchErr } = await supabase
    .from("item_options")
    .select("id, external_id, prompt")
    .not("external_id", "is", null)

  if (fetchErr || !allOptions) {
    return NextResponse.json({ error: "Failed to fetch item_options: " + fetchErr?.message }, { status: 500 })
  }

  // 4. Build updates: only rows where JSON has a prompt and it differs from the current value
  const updates: { id: string; prompt: string }[] = []
  let skipped = 0

  for (const row of allOptions) {
    const extId = String(row.external_id).trim()
    const newPrompt = promptMap.get(extId)
    if (newPrompt && newPrompt !== row.prompt) {
      updates.push({ id: row.id, prompt: newPrompt })
    } else {
      skipped++
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({
      message: "Nothing to update — all prompts already set or no matches found",
      promptMapSize: promptMap.size,
      totalRows: allOptions.length,
      skipped,
    })
  }

  // 5. Upsert in batches of 200
  const BATCH_SIZE = 200
  let updated = 0
  const errors: string[] = []

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE)
    const { error: upsertErr } = await supabase
      .from("item_options")
      .upsert(batch, { onConflict: "id" })

    if (upsertErr) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${upsertErr.message}`)
    } else {
      updated += batch.length
    }
  }

  return NextResponse.json({
    message: "Backfill complete",
    promptMapSize: promptMap.size,
    totalRows: allOptions.length,
    updated,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  })
}
