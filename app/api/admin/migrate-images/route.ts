import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const BUCKET = "images"
const SECRET = process.env.MIGRATION_SECRET

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  if (searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dryRun = searchParams.get("dry") === "true"

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const results = { success: 0, failed: 0, errors: [] as string[] }

  async function migrateImage(sourceUrl: string, storagePath: string) {
    if (!sourceUrl?.includes("deliverlogic")) return null

    try {
      const response = await fetch(sourceUrl)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const contentType = response.headers.get("content-type") || "image/jpeg"
      const buffer = await response.arrayBuffer()

      if (dryRun) {
        return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, new Uint8Array(buffer), { contentType, upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath)

      results.success++
      return publicUrl

    } catch (err: any) {
      results.failed++
      results.errors.push(`${sourceUrl}: ${err.message}`)
      return null
    }
  }

  // Restaurants
  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id, name, slug, logo_url, hero_image_url")
    .or("logo_url.ilike.%deliverlogic%,hero_image_url.ilike.%deliverlogic%")

  for (const r of restaurants || []) {
    const updates: any = {}

    if (r.logo_url?.includes("deliverlogic")) {
      const ext = r.logo_url.split(".").pop()?.split("?")[0] || "jpg"
      const url = await migrateImage(r.logo_url, `restaurants/${r.slug}/logo.${ext}`)
      if (url) updates.logo_url = url
    }

    if (r.hero_image_url?.includes("deliverlogic")) {
      const ext = r.hero_image_url.split(".").pop()?.split("?")[0] || "jpg"
      const url = await migrateImage(r.hero_image_url, `restaurants/${r.slug}/hero.${ext}`)
      if (url) updates.hero_image_url = url
    }

    if (Object.keys(updates).length > 0 && !dryRun) {
      await supabase.from("restaurants").update(updates).eq("id", r.id)
    }
  }

  // Menu items - process in batches
  let offset = 0
  while (true) {
    const { data: items } = await supabase
      .from("menu_items")
      .select("id, slug, image_url, restaurant_id")
      .ilike("image_url", "%deliverlogic%")
      .range(offset, offset + 49)

    if (!items?.length) break

    for (const item of items) {
      const ext = item.image_url.split(".").pop()?.split("?")[0] || "jpg"
      const safe = (item.slug || item.id).replace(/[^a-z0-9-]/g, "-")
      const url = await migrateImage(
        item.image_url,
        `menu-items/${item.restaurant_id}/${safe}.${ext}`
      )
      if (url && !dryRun) {
        await supabase.from("menu_items").update({ image_url: url }).eq("id", item.id)
      }
    }

    offset += 50
    if (items.length < 50) break
  }

  // Catering menu items
  offset = 0
  while (true) {
    const { data: items } = await supabase
      .from("catering_menu_items")
      .select("id, image_url, catering_restaurant_id")
      .ilike("image_url", "%deliverlogic%")
      .range(offset, offset + 49)

    if (!items?.length) break

    for (const item of items) {
      const ext = item.image_url.split(".").pop()?.split("?")[0] || "jpg"
      const url = await migrateImage(
        item.image_url,
        `catering-menu-items/${item.catering_restaurant_id}/${item.id}.${ext}`
      )
      if (url && !dryRun) {
        await supabase.from("catering_menu_items").update({ image_url: url }).eq("id", item.id)
      }
    }

    offset += 50
    if (items.length < 50) break
  }

  return NextResponse.json({
    mode: dryRun ? "DRY RUN" : "LIVE",
    success: results.success,
    failed: results.failed,
    errors: results.errors
  })
}
