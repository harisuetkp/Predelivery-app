// Backfill item_options.prompt from foodnet_import_complete.json
// Matches item_options.external_id to options[].id in the JSON and sets prompt.

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("[v0] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// 1. Parse JSON — use the known absolute project path
const jsonPath = "/vercel/share/v0-project/data/foodnet_import_complete.json"
const raw = JSON.parse(readFileSync(jsonPath, "utf-8"))

const restaurants = Array.isArray(raw) ? raw : raw.restaurants ? raw.restaurants : Object.values(raw)

const promptMap = new Map()

for (const restaurant of restaurants) {
  const items = restaurant.menu_items || restaurant.items || []
  for (const item of items) {
    const options = item.options || item.item_options || []
    for (const option of options) {
      const extId = String(option.id != null ? option.id : (option.external_id != null ? option.external_id : "")).trim()
      const prompt = String(option.prompt || "").trim()
      if (extId && prompt) {
        promptMap.set(extId, prompt)
      }
    }
  }
}

console.log("[v0] Built prompt map with " + promptMap.size + " entries from JSON")

// 2. Fetch all item_options that have an external_id
const { data: allOptions, error: fetchErr } = await supabase
  .from("item_options")
  .select("id, external_id, prompt")
  .not("external_id", "is", null)

if (fetchErr || !allOptions) {
  console.error("[v0] Failed to fetch item_options:", fetchErr ? fetchErr.message : "no data")
  process.exit(1)
}

console.log("[v0] Fetched " + allOptions.length + " item_options rows with external_id")

// 3. Build update batch
const updates = []
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

console.log("[v0] " + updates.length + " rows to update, " + skipped + " skipped (no match or already set)")

if (updates.length === 0) {
  console.log("[v0] Nothing to update — done.")
  process.exit(0)
}

// 4. Upsert in batches of 200
const BATCH_SIZE = 200
let updated = 0
let failed = 0

for (let i = 0; i < updates.length; i += BATCH_SIZE) {
  const batch = updates.slice(i, i + BATCH_SIZE)
  const { error: upsertErr } = await supabase
    .from("item_options")
    .upsert(batch, { onConflict: "id" })

  if (upsertErr) {
    console.error("[v0] Batch " + (Math.floor(i / BATCH_SIZE) + 1) + " failed:", upsertErr.message)
    failed += batch.length
  } else {
    updated += batch.length
    console.log("[v0] Batch " + (Math.floor(i / BATCH_SIZE) + 1) + ": updated " + batch.length + " rows (total " + updated + ")")
  }
}

console.log("[v0] Done. Updated: " + updated + ", Failed: " + failed)
