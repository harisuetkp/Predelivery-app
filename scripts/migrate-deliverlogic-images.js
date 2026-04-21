import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'images'
const DRY_RUN = true // set to false when ready to run live

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const results = { success: [], failed: [], skipped: [] }

async function migrateImage(sourceUrl, storagePath) {
  if (!sourceUrl?.includes('deliverlogic')) {
    results.skipped.push({ sourceUrl, reason: 'not a deliverlogic URL' })
    return null
  }

  try {
    const response = await fetch(sourceUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = await response.arrayBuffer()

    if (DRY_RUN) {
      console.log(`[DRY RUN] ${sourceUrl} → ${storagePath}`)
      return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, new Uint8Array(buffer), { contentType, upsert: true })

    if (uploadError) throw new Error(uploadError.message)

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath)

    results.success.push({ sourceUrl, publicUrl })
    return publicUrl

  } catch (err) {
    results.failed.push({ sourceUrl, storagePath, error: err.message })
    console.error(`FAILED: ${sourceUrl} — ${err.message}`)
    return null
  }
}

async function migrateRestaurantImages() {
  console.log('\n── Restaurants ──')

  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, slug, logo_url, hero_image_url')
    .or('logo_url.ilike.%deliverlogic%,hero_image_url.ilike.%deliverlogic%')

  if (error) throw new Error(error.message)
  if (!data?.length) { console.log('None found'); return }

  console.log(`Found ${data.length} restaurants`)

  for (const r of data) {
    const updates = {}

    if (r.logo_url?.includes('deliverlogic')) {
      const ext = r.logo_url.split('.').pop().split('?')[0] || 'jpg'
      const url = await migrateImage(r.logo_url, `restaurants/${r.slug}/logo.${ext}`)
      if (url) updates.logo_url = url
    }

    if (r.hero_image_url?.includes('deliverlogic')) {
      const ext = r.hero_image_url.split('.').pop().split('?')[0] || 'jpg'
      const url = await migrateImage(r.hero_image_url, `restaurants/${r.slug}/hero.${ext}`)
      if (url) updates.hero_image_url = url
    }

    if (Object.keys(updates).length > 0 && !DRY_RUN) {
      const { error: updateError } = await supabase
        .from('restaurants')
        .update(updates)
        .eq('id', r.id)

      if (updateError) {
        console.error(`Failed to update restaurant ${r.name}: ${updateError.message}`)
      } else {
        console.log(`Updated restaurant: ${r.name}`)
      }
    }
  }
}

async function migrateMenuItemImages() {
  console.log('\n── Menu Items ──')

  const { data, error } = await supabase
    .from('menu_items')
    .select('id, name, restaurant_id, restaurants!inner(slug), image_url')
    .ilike('image_url', '%deliverlogic%')

  if (error) throw new Error(error.message)
  if (!data?.length) { console.log('None found'); return }

  console.log(`Found ${data.length} menu items`)

  for (const item of data) {
    const restaurantSlug = item.restaurants?.slug || 'unknown'
    const safeItemName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50)
    const ext = item.image_url.split('.').pop().split('?')[0] || 'jpg'
    const storagePath = `restaurants/${restaurantSlug}/menu/${item.id}-${safeItemName}.${ext}`

    const url = await migrateImage(item.image_url, storagePath)

    if (url && !DRY_RUN) {
      const { error: updateError } = await supabase
        .from('menu_items')
        .update({ image_url: url })
        .eq('id', item.id)

      if (updateError) {
        console.error(`Failed to update menu item ${item.name}: ${updateError.message}`)
      } else {
        console.log(`Updated menu item: ${item.name}`)
      }
    }
  }
}

async function migrateCateringRestaurantImages() {
  console.log('\n── Catering Restaurants ──')

  const { data, error } = await supabase
    .from('catering_restaurants')
    .select('id, name, slug, logo_url, hero_image_url')
    .or('logo_url.ilike.%deliverlogic%,hero_image_url.ilike.%deliverlogic%')

  if (error) throw new Error(error.message)
  if (!data?.length) { console.log('None found'); return }

  console.log(`Found ${data.length} catering restaurants`)

  for (const r of data) {
    const updates = {}

    if (r.logo_url?.includes('deliverlogic')) {
      const ext = r.logo_url.split('.').pop().split('?')[0] || 'jpg'
      const url = await migrateImage(r.logo_url, `catering/${r.slug}/logo.${ext}`)
      if (url) updates.logo_url = url
    }

    if (r.hero_image_url?.includes('deliverlogic')) {
      const ext = r.hero_image_url.split('.').pop().split('?')[0] || 'jpg'
      const url = await migrateImage(r.hero_image_url, `catering/${r.slug}/hero.${ext}`)
      if (url) updates.hero_image_url = url
    }

    if (Object.keys(updates).length > 0 && !DRY_RUN) {
      const { error: updateError } = await supabase
        .from('catering_restaurants')
        .update(updates)
        .eq('id', r.id)

      if (updateError) {
        console.error(`Failed to update catering restaurant ${r.name}: ${updateError.message}`)
      } else {
        console.log(`Updated catering restaurant: ${r.name}`)
      }
    }
  }
}

async function migrateCateringMenuItemImages() {
  console.log('\n── Catering Menu Items ──')

  const { data, error } = await supabase
    .from('catering_menu_items')
    .select('id, name, catering_restaurant_id, catering_restaurants!inner(slug), image_url')
    .ilike('image_url', '%deliverlogic%')

  if (error) throw new Error(error.message)
  if (!data?.length) { console.log('None found'); return }

  console.log(`Found ${data.length} catering menu items`)

  for (const item of data) {
    const restaurantSlug = item.catering_restaurants?.slug || 'unknown'
    const safeItemName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50)
    const ext = item.image_url.split('.').pop().split('?')[0] || 'jpg'
    const storagePath = `catering/${restaurantSlug}/menu/${item.id}-${safeItemName}.${ext}`

    const url = await migrateImage(item.image_url, storagePath)

    if (url && !DRY_RUN) {
      const { error: updateError } = await supabase
        .from('catering_menu_items')
        .update({ image_url: url })
        .eq('id', item.id)

      if (updateError) {
        console.error(`Failed to update catering menu item ${item.name}: ${updateError.message}`)
      } else {
        console.log(`Updated catering menu item: ${item.name}`)
      }
    }
  }
}

async function main() {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`DeliverLogic → Supabase Storage Migration`)
  console.log(`DRY_RUN: ${DRY_RUN}`)
  console.log(`${'='.repeat(50)}`)

  await migrateRestaurantImages()
  await migrateMenuItemImages()
  await migrateCateringRestaurantImages()
  await migrateCateringMenuItemImages()

  console.log(`\n${'='.repeat(50)}`)
  console.log('RESULTS:')
  console.log(`  Success: ${results.success.length}`)
  console.log(`  Failed:  ${results.failed.length}`)
  console.log(`  Skipped: ${results.skipped.length}`)
  console.log(`${'='.repeat(50)}\n`)

  if (results.failed.length > 0) {
    console.log('Failed items:')
    results.failed.forEach(f => console.log(`  - ${f.sourceUrl}: ${f.error}`))
  }
}

main().catch(console.error)
