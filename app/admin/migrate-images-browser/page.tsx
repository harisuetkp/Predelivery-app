"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

const BUCKET = "images"

export default function BrowserMigrationPage() {
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [stats, setStats] = useState({ success: 0, failed: 0, total: 0 })

  function addLog(msg: string) {
    setLog(prev => [...prev, msg])
  }

  async function migrateImage(
    supabase: ReturnType<typeof createClient>,
    sourceUrl: string,
    storagePath: string
  ): Promise<string | null> {
    try {
      const response = await fetch(sourceUrl, { mode: "cors" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const blob = await response.blob()
      const contentType = blob.type || "image/jpeg"

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, blob, { contentType, upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath)

      return publicUrl

    } catch (err: any) {
      addLog(`FAILED: ${sourceUrl} — ${err.message}`)
      return null
    }
  }

  async function runMigration() {
    setRunning(true)
    setLog([])
    setStats({ success: 0, failed: 0, total: 0 })

    const supabase = createClient()
    let success = 0
    let failed = 0
    let total = 0

    // ── Restaurants ──
    addLog("Starting restaurant images...")

    const { data: restaurants } = await supabase
      .from("restaurants")
      .select("id, name, slug, logo_url, hero_image_url")
      .or("logo_url.ilike.%deliverlogic%,hero_image_url.ilike.%deliverlogic%")

    for (const r of restaurants || []) {
      const updates: Record<string, string> = {}

      if (r.logo_url?.includes("deliverlogic")) {
        const ext = r.logo_url.split(".").pop()?.split("?")[0] || "jpg"
        const url = await migrateImage(supabase, r.logo_url, `restaurants/${r.slug}/logo.${ext}`)
        if (url) { updates.logo_url = url; success++ }
        else failed++
        total++
      }

      if (r.hero_image_url?.includes("deliverlogic")) {
        const ext = r.hero_image_url.split(".").pop()?.split("?")[0] || "jpg"
        const url = await migrateImage(supabase, r.hero_image_url, `restaurants/${r.slug}/hero.${ext}`)
        if (url) { updates.hero_image_url = url; success++ }
        else failed++
        total++
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("restaurants").update(updates).eq("id", r.id)
        addLog(`✓ ${r.name}`)
      }

      setStats({ success, failed, total })
    }

    // ── Menu Items ──
    addLog("Starting menu item images...")
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
          supabase,
          item.image_url,
          `menu-items/${item.restaurant_id}/${safe}.${ext}`
        )
        if (url) {
          await supabase.from("menu_items").update({ image_url: url }).eq("id", item.id)
          success++
        } else {
          failed++
        }
        total++
        setStats({ success, failed, total })
        if (total % 50 === 0) addLog(`Progress: ${total} images processed`)
      }

      offset += 50
      if (items.length < 50) break
    }

    // ── Catering Menu Items ──
    addLog("Starting catering menu item images...")
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
          supabase,
          item.image_url,
          `catering-menu-items/${item.catering_restaurant_id}/${item.id}.${ext}`
        )
        if (url) {
          await supabase.from("catering_menu_items").update({ image_url: url }).eq("id", item.id)
          success++
        } else {
          failed++
        }
        total++
        setStats({ success, failed, total })
      }

      offset += 50
      if (items.length < 50) break
    }

    addLog("═══════════════════════════════")
    addLog(`COMPLETE — Success: ${success} | Failed: ${failed} | Total: ${total}`)
    setDone(true)
    setRunning(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Image Migration Tool</h1>
        <p className="text-slate-400 mb-8">
          Migrates all DeliverLogic S3 images to Supabase Storage. 
          Keep this tab open until complete (~30-45 min).
        </p>

        {!running && !done && (
          <button
            onClick={runMigration}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-4 rounded-xl text-lg"
          >
            Start Migration
          </button>
        )}

        {(running || done) && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-400">{stats.success}</div>
                <div className="text-slate-400 text-sm mt-1">Success</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-red-400">{stats.failed}</div>
                <div className="text-slate-400 text-sm mt-1">Failed</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-slate-300">{stats.total}</div>
                <div className="text-slate-400 text-sm mt-1">Total</div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 h-96 overflow-y-auto font-mono text-sm">
              {log.map((line, i) => (
                <div key={i} className={`py-0.5 ${
                  line.startsWith("FAILED") ? "text-red-400" :
                  line.startsWith("✓") ? "text-green-400" :
                  line.startsWith("COMPLETE") ? "text-amber-400 font-bold" :
                  "text-slate-400"
                }`}>
                  {line}
                </div>
              ))}
              {running && (
                <div className="text-amber-400 animate-pulse">Running...</div>
              )}
            </div>
          </>
        )}

        {done && (
          <div className="mt-6 p-4 bg-green-900 rounded-xl">
            <p className="text-green-300 font-medium">
              Migration complete. Delete this page before going live:
              app/admin/migrate-images-browser/page.tsx
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
