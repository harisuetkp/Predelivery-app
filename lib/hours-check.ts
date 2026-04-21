import { PR_TIMEZONE } from "@/lib/timezone"

/** HH:MM → HH:MM:SS; leaves HH:MM:SS unchanged */
export function normalizeTime(t: string): string {
  const s = String(t).trim()
  if (s.length === 5 && s[2] === ":") return `${s}:00`
  return s
}

export type OperatorHourRow = {
  day_of_week: number
  breakfast_open: string | null
  breakfast_close: string | null
  lunch_open: string | null
  lunch_close: string | null
  dinner_open: string | null
  dinner_close: string | null
}

export type RestaurantHourRow = {
  day_of_week: number
  breakfast_open: string | null
  breakfast_close: string | null
  lunch_open: string | null
  lunch_close: string | null
  dinner_open: string | null
  dinner_close: string | null
}

export type RestaurantForOrdering = {
  extended_hours_type?: string | null
  extended_open?: string | null
  extended_close?: string | null
  extended_hours_type_2?: string | null
  extended_open_2?: string | null
  extended_close_2?: string | null
}

function hmsToComparable(hms: string): string {
  const [h, m, sec = "00"] = normalizeTime(hms).split(":")
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${String(sec).padStart(2, "0").slice(0, 2).padStart(2, "0")}`
}

/** Inclusive start, exclusive end: current >= open && current < close */
function isNowInShift(currentHms: string, open: string | null, close: string | null): boolean {
  if (!open || !close) return false
  const c = hmsToComparable(currentHms)
  const o = hmsToComparable(open)
  const cl = hmsToComparable(close)
  if (o < cl) {
    return c >= o && c < cl
  }
  if (o > cl) {
    return c >= o || c < cl
  }
  return false
}

export function getPRTimeContext(now: Date = new Date()): {
  dayOfWeek: number
  currentHms: string
} {
  const prWall = new Date(now.toLocaleString("en-US", { timeZone: PR_TIMEZONE }))
  const dayOfWeek = prWall.getDay()
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: PR_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = f.formatToParts(now)
  const h = parts.find((p) => p.type === "hour")?.value ?? "00"
  const m = parts.find((p) => p.type === "minute")?.value ?? "00"
  const s = parts.find((p) => p.type === "second")?.value ?? "00"
  const currentHms = `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`
  return { dayOfWeek, currentHms }
}

export function isPlatformOpen(operatorHours: OperatorHourRow[], now: Date = new Date()): boolean {
  const { dayOfWeek, currentHms } = getPRTimeContext(now)
  const row = operatorHours.find((h) => Number(h.day_of_week) === dayOfWeek)
  if (!row) return false
  const shifts: [string | null, string | null][] = [
    [row.breakfast_open, row.breakfast_close],
    [row.lunch_open, row.lunch_close],
    [row.dinner_open, row.dinner_close],
  ]
  return shifts.some(([o, c]) => isNowInShift(currentHms, o, c))
}

export function isRestaurantOpen(restaurantHours: RestaurantHourRow[], now: Date = new Date()): boolean {
  const { dayOfWeek, currentHms } = getPRTimeContext(now)
  const row = restaurantHours.find((h) => Number(h.day_of_week) === dayOfWeek)
  if (!row) return false
  const shifts: [string | null, string | null][] = [
    [row.breakfast_open, row.breakfast_close],
    [row.lunch_open, row.lunch_close],
    [row.dinner_open, row.dinner_close],
  ]
  return shifts.some(([o, c]) => isNowInShift(currentHms, o, c))
}

export function isInExtendedWindow(restaurant: RestaurantForOrdering, now: Date = new Date()): boolean {
  const { currentHms } = getPRTimeContext(now)
  const t1 = restaurant.extended_hours_type
  if (t1 && t1 !== "none" && restaurant.extended_open && restaurant.extended_close) {
    if (isNowInShift(currentHms, restaurant.extended_open, restaurant.extended_close)) return true
  }
  const t2 = restaurant.extended_hours_type_2
  if (t2 && t2 !== "none" && restaurant.extended_open_2 && restaurant.extended_close_2) {
    if (isNowInShift(currentHms, restaurant.extended_open_2, restaurant.extended_close_2)) return true
  }
  return false
}

export type OrderingReason = "open" | "restaurant_closed" | "platform_closed" | "extended_open"

export function isOrderingAllowed(
  operatorHours: OperatorHourRow[],
  restaurantHours: RestaurantHourRow[],
  restaurant: RestaurantForOrdering,
  now: Date = new Date(),
): { allowed: boolean; reason: OrderingReason } {
  if (isInExtendedWindow(restaurant, now)) {
    return { allowed: true, reason: "extended_open" }
  }
  if (isPlatformOpen(operatorHours, now)) {
    if (isRestaurantOpen(restaurantHours, now)) {
      return { allowed: true, reason: "open" }
    }
    return { allowed: true, reason: "restaurant_closed" }
  }
  return { allowed: false, reason: "platform_closed" }
}

function formatHmsToAmPm(hms: string): string {
  const n = normalizeTime(hms)
  const [hs, ms] = n.split(":")
  const hour = parseInt(hs, 10)
  const min = ms
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const ampm = hour < 12 ? "AM" : "PM"
  return `${displayHour}:${min} ${ampm}`
}

/** e.g. "Almuerzo: 11:00 AM – 4:00 PM • Cena: 4:00 PM – 8:30 PM" for today's operator row */
export function formatPlatformHoursSummary(operatorHours: OperatorHourRow[], now: Date = new Date()): string {
  const { dayOfWeek } = getPRTimeContext(now)
  const row = operatorHours.find((h) => Number(h.day_of_week) === dayOfWeek)
  if (!row) return ""
  const parts: string[] = []
  const add = (label: string, open: string | null, close: string | null) => {
    if (!open || !close) return
    parts.push(`${label}: ${formatHmsToAmPm(open)} – ${formatHmsToAmPm(close)}`)
  }
  add("Desayuno", row.breakfast_open, row.breakfast_close)
  add("Almuerzo", row.lunch_open, row.lunch_close)
  add("Cena", row.dinner_open, row.dinner_close)
  return parts.join(" • ")
}
