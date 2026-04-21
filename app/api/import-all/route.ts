import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Helper to create slug from name
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Parse optional batch range from query params: ?startId=1&endId=20
    const url = new URL(request.url)
    const startId = parseInt(url.searchParams.get("startId") || "1")
    const endId = parseInt(url.searchParams.get("endId") || "999999")

    // Read the JSON file from the data directory
    const jsonPath = path.join(process.cwd(), "data/foodnet_import_complete.json")
    
    let jsonData: any[]
    try {
      const fileContent = fs.readFileSync(jsonPath, "utf-8")
      jsonData = JSON.parse(fileContent)
    } catch (fileError) {
      // If file not found, try to get from request body
      const body = await request.json()
      jsonData = body.data || body
    }

    if (!Array.isArray(jsonData)) {
      return NextResponse.json({ error: "Invalid data format - expected array" }, { status: 400 })
    }

    // Apply batch filter if startId/endId were provided
    const batch = jsonData.filter((entry: any) => {
      const id = Number(entry?.restaurant?.id ?? 0)
      return id >= startId && id <= endId
    })

    const errors: string[] = []

    // ── PHASE 1: Upsert restaurants (need IDs for children) ──────────────────
    const restaurantRows = batch
      .map((entry: any) => {
        const r = entry?.restaurant
        if (!r?.name) return null
        return {
          name: r.name,
          slug: createSlug(r.name),
          external_id: String(r.id),
          phone: r.phone || null,
          address: r.address || null,
          restaurant_address: r.address || null,
          logo_url: r.logo_url || null,
          hero_image_url: r.featured_url || null,
          marketplace_image_url: r.featured_url || r.logo_url || null,
          cuisine_type: r.cuisine || null,
          delivery_fee: r.delivery_fee != null ? Number(r.delivery_fee) : null,
          min_delivery_order: r.min_order != null ? Number(r.min_order) : null,
          delivery_lead_time: r.delivery_time_minutes != null ? Number(r.delivery_time_minutes) : null,
          tax_rate: r.tax_rate != null ? Number(r.tax_rate) / 100 : 0.115,
          primary_color: "#d00169",
          is_active: true,
          pickup_enabled: true,
          delivery_enabled: true,
          show_in_marketplace: true,
        }
      })
      .filter(Boolean)

    const { data: insertedRestaurants, error: restErr } = await supabase
      .from("restaurants")
      .upsert(restaurantRows, { onConflict: "slug" })
      .select("id, slug, external_id")

    if (restErr) {
      return NextResponse.json({ error: "Restaurant upsert failed", message: restErr.message }, { status: 500 })
    }

    // Map external_id → DB id for fast lookup
    const restaurantIdMap = new Map<string, string>()
    for (const r of insertedRestaurants ?? []) {
      restaurantIdMap.set(r.external_id, r.id)
    }

    // ── PHASE 2: Bulk upsert categories ──────────────────────────────────────
    const categoryRows: any[] = []
    // Track source data needed for item building
    type CatMeta = { extId: string; restaurantExtId: string; items: any[] }
    const catMetas: CatMeta[] = []

    for (const entry of batch) {
      const r = entry?.restaurant
      if (!r?.name) continue
      const restaurantExtId = String(r.id)
      for (let ci = 0; ci < (entry.categories ?? []).length; ci++) {
        const cat = entry.categories[ci]
        const extId = String(cat.external_id || cat.id || `${restaurantExtId}-cat-${ci}`)
        categoryRows.push({
          restaurant_id: restaurantIdMap.get(restaurantExtId),
          name: cat.name,
          description: cat.description || null,
          external_id: extId,
          display_order: ci,
          is_active: true,
        })
        catMetas.push({ extId, restaurantExtId, items: cat.items || [] })
      }
    }

    const { data: insertedCats, error: catErr } = await supabase
      .from("categories")
      .upsert(categoryRows.filter(r => r.restaurant_id), { onConflict: "restaurant_id,name" })
      .select("id, external_id")

    if (catErr) errors.push(`categories: ${catErr.message}`)

    const categoryIdMap = new Map<string, string>()
    for (const c of insertedCats ?? []) categoryIdMap.set(c.external_id, c.id)

    // ── PHASE 3: Bulk upsert menu_items ──────────────────────────────────────
    const itemRows: any[] = []
    type ItemMeta = { extId: string; catExtId: string; restaurantExtId: string; options: any[] }
    const itemMetas: ItemMeta[] = []

    for (const meta of catMetas) {
      const categoryId = categoryIdMap.get(meta.extId)
      const restaurantId = restaurantIdMap.get(meta.restaurantExtId)
      if (!categoryId || !restaurantId) continue
      for (let ii = 0; ii < meta.items.length; ii++) {
        const item = meta.items[ii]
        const extId = String(item.external_id || item.id || `${meta.extId}-item-${ii}`)
        itemRows.push({
          restaurant_id: restaurantId,
          category_id: categoryId,
          name: item.name,
          description: item.description || null,
          price: item.price || 0,
          image_url: item.image_url || null,
          external_id: extId,
          display_order: ii,
          is_active: true,
        })
        itemMetas.push({ extId, catExtId: meta.extId, restaurantExtId: meta.restaurantExtId, options: item.options || item.option_groups || [] })
      }
    }

    const { data: insertedItems, error: itemErr } = await supabase
      .from("menu_items")
      .upsert(itemRows, { onConflict: "category_id,name" })
      .select("id, external_id")

    if (itemErr) errors.push(`menu_items: ${itemErr.message}`)

    const itemIdMap = new Map<string, string>()
    for (const i of insertedItems ?? []) itemIdMap.set(i.external_id, i.id)

    // ── PHASE 4: Bulk upsert item_options ────────────────────────────────────
    const optionRows: any[] = []
    type OptMeta = { extId: string; itemExtId: string; choices: any[] }
    const optMetas: OptMeta[] = []

    for (const meta of itemMetas) {
      const itemId = itemIdMap.get(meta.extId)
      if (!itemId) continue
      for (let oi = 0; oi < meta.options.length; oi++) {
        const opt = meta.options[oi]
        const extId = String(opt.id || `${meta.extId}-opt-${oi}`)
        optionRows.push({
          menu_item_id: itemId,
          category: opt.group_name || opt.name,
          prompt: opt.prompt || null,
          is_required: opt.required || false,
          min_selection: opt.min_select || 0,
          max_selection: opt.max_select || 10,
          external_id: extId,
          display_order: oi,
        })
        optMetas.push({ extId, itemExtId: meta.extId, choices: opt.choices || [] })
      }
    }

    const { data: insertedOpts, error: optErr } = await supabase
      .from("item_options")
      .upsert(optionRows, { onConflict: "menu_item_id,category" })
      .select("id, external_id")

    if (optErr) errors.push(`item_options: ${optErr.message}`)

    const optionIdMap = new Map<string, string>()
    for (const o of insertedOpts ?? []) optionIdMap.set(o.external_id, o.id)

    // ── PHASE 5: Bulk upsert item_option_choices ──────────────────────────────
    const choiceRows: any[] = []

    for (const meta of optMetas) {
      const optionId = optionIdMap.get(meta.extId)
      if (!optionId) continue
      for (let ci = 0; ci < meta.choices.length; ci++) {
        const choice = meta.choices[ci]
        choiceRows.push({
          item_option_id: optionId,
          name: choice.name,
          price_modifier: choice.price_delta || 0,
          external_id: String(choice.id || `${meta.extId}-choice-${ci}`),
          display_order: ci,
        })
      }
    }

    const { error: choiceErr } = await supabase
      .from("item_option_choices")
      .upsert(choiceRows, { onConflict: "item_option_id,name" })

    if (choiceErr) errors.push(`item_option_choices: ${choiceErr.message}`)

    return NextResponse.json({
      success: true,
      message: "Import completed",
      results: {
        batchRange: `${startId}–${endId}`,
        totalInBatch: batch.length,
        restaurants: insertedRestaurants?.length ?? 0,
        categories: insertedCats?.length ?? 0,
        items: insertedItems?.length ?? 0,
        options: insertedOpts?.length ?? 0,
        choices: choiceRows.length,
        errorCount: errors.length,
        errors: errors.slice(0, 20),
      },
    })

  } catch (error: any) {
    console.error("[v0] Import error:", error)
    return NextResponse.json({
      error: "Import failed",
      message: error.message
    }, { status: 500 })
  }
}

export async function GET(request: Request) {
  // Allow triggering import via GET for convenience
  return POST(request)
}
