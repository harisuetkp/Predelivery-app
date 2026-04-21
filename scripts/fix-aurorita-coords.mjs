import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !GOOGLE_KEY) {
  console.error("Missing env vars:", {
    SUPABASE_URL: !!SUPABASE_URL,
    SUPABASE_KEY: !!SUPABASE_KEY,
    GOOGLE_KEY: !!GOOGLE_KEY,
  })
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const address = "303 Ave De Diego, Puerto Nuevo, San Juan, PR 00920"
const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_KEY}`

console.log("Geocoding:", address)
const res = await fetch(geocodeUrl)
const data = await res.json()

if (data.status !== "OK" || !data.results.length) {
  console.error("Geocoding failed:", data.status, data.error_message)
  process.exit(1)
}

const { lat, lng } = data.results[0].geometry.location
console.log(`Got coords: lat=${lat}, lng=${lng}`)

const { data: updated, error } = await supabase
  .from("restaurants")
  .update({
    latitude: lat,
    longitude: lng,
    delivery_fee: 5.89,
  })
  .eq("slug", "aurorita")
  .select("id, name, latitude, longitude, delivery_fee")

if (error) {
  console.error("DB update failed:", error.message)
  process.exit(1)
}

console.log("Updated successfully:", updated)
