/**
 * Per-branch catering settings resolver.
 *
 * Phase-1 architecture:
 *   - `catering_branches` has a set of nullable override columns (added 2026-04 migration).
 *   - `catering_restaurants` has the same columns as parent/defaults.
 *   - Resolver rule: branch override wins when non-null, otherwise fall back to the parent restaurant.
 *
 * IMPORTANT: This module is catering-only. It does NOT read or write to any of the
 * `restaurants` / `branches` (delivery-side) tables. The Online Ordering product is live and
 * must remain untouched by catering code paths.
 *
 * When the cross-tent linkage is eventually populated (`catering_restaurants.restaurant_id`
 * and `restaurant_locations.catering_branch_id`), a future phase can layer a second resolver
 * on top of this one to fall through to delivery-side config. That is NOT implemented here.
 */

import { createClient } from "@/lib/supabase/server"

/** Subset of catering_branches columns relevant for settings resolution. */
export interface CateringBranchRow {
  id: string
  catering_restaurant_id: string
  name?: string | null
  // Delivery / pickup toggles (nullable on branch — NULL means inherit)
  enable_delivery?: boolean | null
  enable_pickup?: boolean | null
  delivery_radius_miles?: number | null
  delivery_fee?: number | null
  min_delivery_order?: number | null
  min_pickup_order?: number | null
  // Lead times
  default_lead_time_hours?: number | null
  delivery_turnaround_hours?: number | null
  pickup_turnaround_hours?: number | null
  // Notifications
  notification_email?: string | null
  notification_method?: string | null
  // Printer / KDS
  eatabit_restaurant_key?: string | null
  printer_tier?: string | null
  // Payments
  athmovil_enabled?: boolean | null
  athmovil_public_token?: string | null
  athmovil_private_token?: string | null
  cash_payment_enabled?: boolean | null
  stripe_enabled?: boolean | null
  stripe_account_id?: string | null
  tax_rate?: number | null
  // Main Dispatch routing (tri-state on the branch, null = inherit)
  route_to_main_dispatch?: boolean | null
  dispatch_hub_branch_id?: string | null
}

/** Subset of catering_restaurants columns relevant for settings resolution. */
export interface CateringRestaurantRow {
  id: string
  // Parent defaults — always present (most NOT NULL, a few NULLable)
  enable_delivery: boolean
  enable_pickup: boolean
  delivery_radius_miles?: number | null
  delivery_fee?: number | null
  min_delivery_order?: number | null
  min_pickup_order?: number | null
  default_lead_time_hours: number
  delivery_turnaround_hours?: number | null
  pickup_turnaround_hours?: number | null
  notification_email?: string | null
  notification_method?: string | null
  eatabit_restaurant_key?: string | null
  printer_tier?: string | null
  athmovil_enabled?: boolean | null
  athmovil_public_token?: string | null
  athmovil_private_token?: string | null
  cash_payment_enabled?: boolean | null
  stripe_enabled?: boolean | null
  stripe_account_id?: string | null
  tax_rate?: number | null
  // Main Dispatch routing default (restaurant-level). NOT NULL at DB level, default true.
  route_to_main_dispatch_default?: boolean | null
}

/** The fully resolved settings object used by catering read paths. */
export interface ResolvedCateringSettings {
  branchId: string
  restaurantId: string
  // Service
  enableDelivery: boolean
  enablePickup: boolean
  deliveryRadiusMiles: number | null
  deliveryFee: number | null
  minDeliveryOrder: number | null
  minPickupOrder: number | null
  // Lead times
  defaultLeadTimeHours: number
  deliveryTurnaroundHours: number | null
  pickupTurnaroundHours: number | null
  // Notifications
  notificationEmail: string | null
  notificationMethod: string | null
  // Printer / KDS
  eatabitRestaurantKey: string | null
  printerTier: string | null
  // Payments
  athmovilEnabled: boolean
  athmovilPublicToken: string | null
  athmovilPrivateToken: string | null
  cashPaymentEnabled: boolean
  stripeEnabled: boolean
  stripeAccountId: string | null
  taxRate: number | null
  // Main Dispatch routing (resolved)
  routeToMainDispatch: boolean
  dispatchHubBranchId: string | null
  // Debug: which source provided each value ("branch" or "restaurant")
  _sources: Record<string, "branch" | "restaurant">
}

/**
 * Given a raw branch and its parent restaurant, return the resolved settings object.
 * Branch override wins whenever the branch field is non-null; otherwise fall back to restaurant.
 */
export function resolveCateringSettings(
  branch: CateringBranchRow,
  restaurant: CateringRestaurantRow,
): ResolvedCateringSettings {
  const sources: Record<string, "branch" | "restaurant"> = {}

  function pick<T>(key: keyof ResolvedCateringSettings, branchVal: T | null | undefined, restaurantVal: T): T {
    if (branchVal !== null && branchVal !== undefined) {
      sources[key as string] = "branch"
      return branchVal
    }
    sources[key as string] = "restaurant"
    return restaurantVal
  }

  return {
    branchId: branch.id,
    restaurantId: restaurant.id,

    enableDelivery: pick("enableDelivery", branch.enable_delivery, restaurant.enable_delivery),
    enablePickup: pick("enablePickup", branch.enable_pickup, restaurant.enable_pickup),
    deliveryRadiusMiles: pick("deliveryRadiusMiles", branch.delivery_radius_miles, restaurant.delivery_radius_miles ?? null),
    deliveryFee: pick("deliveryFee", branch.delivery_fee, restaurant.delivery_fee ?? null),
    minDeliveryOrder: pick("minDeliveryOrder", branch.min_delivery_order, restaurant.min_delivery_order ?? null),
    minPickupOrder: pick("minPickupOrder", branch.min_pickup_order, restaurant.min_pickup_order ?? null),

    defaultLeadTimeHours: pick("defaultLeadTimeHours", branch.default_lead_time_hours, restaurant.default_lead_time_hours),
    deliveryTurnaroundHours: pick("deliveryTurnaroundHours", branch.delivery_turnaround_hours, restaurant.delivery_turnaround_hours ?? null),
    pickupTurnaroundHours: pick("pickupTurnaroundHours", branch.pickup_turnaround_hours, restaurant.pickup_turnaround_hours ?? null),

    notificationEmail: pick("notificationEmail", branch.notification_email, restaurant.notification_email ?? null),
    notificationMethod: pick("notificationMethod", branch.notification_method, restaurant.notification_method ?? null),

    eatabitRestaurantKey: pick("eatabitRestaurantKey", branch.eatabit_restaurant_key, restaurant.eatabit_restaurant_key ?? null),
    printerTier: pick("printerTier", branch.printer_tier, restaurant.printer_tier ?? null),

    athmovilEnabled: pick("athmovilEnabled", branch.athmovil_enabled, restaurant.athmovil_enabled ?? false),
    athmovilPublicToken: pick("athmovilPublicToken", branch.athmovil_public_token, restaurant.athmovil_public_token ?? null),
    athmovilPrivateToken: pick("athmovilPrivateToken", branch.athmovil_private_token, restaurant.athmovil_private_token ?? null),

    cashPaymentEnabled: pick("cashPaymentEnabled", branch.cash_payment_enabled, restaurant.cash_payment_enabled ?? false),
    stripeEnabled: pick("stripeEnabled", branch.stripe_enabled, restaurant.stripe_enabled ?? false),
    stripeAccountId: pick("stripeAccountId", branch.stripe_account_id, restaurant.stripe_account_id ?? null),
    taxRate: pick("taxRate", branch.tax_rate, restaurant.tax_rate ?? null),

    // Main Dispatch routing: branch override wins; restaurant default is true at the DB level.
    routeToMainDispatch: pick(
      "routeToMainDispatch",
      branch.route_to_main_dispatch,
      restaurant.route_to_main_dispatch_default ?? true,
    ),
    // Hub branch is branch-only (no restaurant-level default). Null means "stay on this branch".
    dispatchHubBranchId: (() => {
      if (branch.dispatch_hub_branch_id) {
        sources["dispatchHubBranchId"] = "branch"
        return branch.dispatch_hub_branch_id
      }
      sources["dispatchHubBranchId"] = "restaurant"
      return null
    })(),

    _sources: sources,
  }
}

/**
 * Fetch a catering branch + its parent and return the resolved settings.
 * Server-side only (uses the server supabase client).
 *
 * Does NOT touch the delivery-side `branches` / `restaurants` tables. Catering-only.
 */
export async function getResolvedCateringSettings(branchId: string): Promise<ResolvedCateringSettings | null> {
  const supabase = await createClient()

  // Step 1 — branch
  const { data: branch, error: branchErr } = await supabase
    .from("catering_branches")
    .select("*")
    .eq("id", branchId)
    .maybeSingle()

  if (branchErr) throw new Error(`resolver: failed to load catering branch ${branchId}: ${branchErr.message}`)
  if (!branch) return null

  // Step 2 — parent restaurant
  const { data: restaurant, error: restErr } = await supabase
    .from("catering_restaurants")
    .select("*")
    .eq("id", branch.catering_restaurant_id)
    .maybeSingle()

  if (restErr) throw new Error(`resolver: failed to load catering restaurant ${branch.catering_restaurant_id}: ${restErr.message}`)
  if (!restaurant) throw new Error(`resolver: branch ${branchId} references missing catering restaurant ${branch.catering_restaurant_id}`)

  return resolveCateringSettings(branch as CateringBranchRow, restaurant as CateringRestaurantRow)
}

/**
 * Resolve settings for all branches of a catering restaurant in one shot.
 * Useful for admin views that show all branches side-by-side with their effective config.
 */
export async function getResolvedCateringSettingsForRestaurant(
  catering_restaurant_id: string,
): Promise<ResolvedCateringSettings[]> {
  const supabase = await createClient()

  const { data: restaurant, error: restErr } = await supabase
    .from("catering_restaurants")
    .select("*")
    .eq("id", catering_restaurant_id)
    .maybeSingle()

  if (restErr) throw new Error(`resolver: failed to load catering restaurant ${catering_restaurant_id}: ${restErr.message}`)
  if (!restaurant) return []

  const { data: branches, error: branchErr } = await supabase
    .from("catering_branches")
    .select("*")
    .eq("catering_restaurant_id", catering_restaurant_id)
    .order("display_order", { ascending: true })

  if (branchErr) throw new Error(`resolver: failed to load branches for ${catering_restaurant_id}: ${branchErr.message}`)

  return (branches ?? []).map((branch) =>
    resolveCateringSettings(branch as CateringBranchRow, restaurant as CateringRestaurantRow),
  )
}

// ============================================================
// MAIN DISPATCH ROUTING RESOLVER
// ============================================================

/**
 * Shape returned by `resolveCateringRouting`. This tells the caller which branch
 * should actually own the order (after any hub redirection) and provides the
 * resolved settings for that producing branch — including its payment
 * credentials, which is what's used to capture the charge.
 */
export interface CateringRoutingResolution {
  /** Branch id that will appear on the final catering_orders row. */
  producingBranchId: string
  /** Was the original branch overridden by a hub redirect? */
  wasRedirected: boolean
  /** Original branch id the customer selected (before redirect, if any). */
  intakeBranchId: string
  /** Effective settings for the producing branch — use these for payment. */
  resolvedSettings: ResolvedCateringSettings
  /** True if this branch is opted out of Main Dispatch and has no hub — the
   *  order should be created in `pending` state and NOT appear in the CSR Portal. */
  outOfBandOnly: boolean
}

/**
 * Resolves Main Dispatch routing for a catering order at creation time.
 *
 * Behavior:
 *  - Loads the selected branch's resolved settings.
 *  - If the branch's `routeToMainDispatch` is `false` AND `dispatchHubBranchId`
 *    is set, swaps to the hub branch and re-resolves against it.
 *  - Never follows more than one hop (hub chains are not supported in v1).
 *  - If the hub is missing or inactive, falls back to the original branch and
 *    flags `outOfBandOnly: true` so the caller can decide how to handle it.
 *
 * IMPORTANT: The producing branch's `resolvedSettings` is what the charge
 * capture step must use (stripe_account_id, athmovil tokens, tax_rate, etc.).
 * Per the "catering payment always credits the producing branch" rule, this
 * is load-bearing — do NOT read those values off the intake branch.
 */
export async function resolveCateringRouting(
  intakeBranchId: string,
): Promise<CateringRoutingResolution | null> {
  const intakeSettings = await getResolvedCateringSettings(intakeBranchId)
  if (!intakeSettings) return null

  // Case 1: branch routes to main dispatch — no redirect.
  if (intakeSettings.routeToMainDispatch) {
    return {
      producingBranchId: intakeBranchId,
      intakeBranchId,
      wasRedirected: false,
      resolvedSettings: intakeSettings,
      outOfBandOnly: false,
    }
  }

  // Case 2: branch opted out, no hub → stays as pending, out-of-band only.
  if (!intakeSettings.dispatchHubBranchId) {
    return {
      producingBranchId: intakeBranchId,
      intakeBranchId,
      wasRedirected: false,
      resolvedSettings: intakeSettings,
      outOfBandOnly: true,
    }
  }

  // Case 3: branch redirects to a hub → re-resolve against the hub.
  const hubSettings = await getResolvedCateringSettings(intakeSettings.dispatchHubBranchId)
  if (!hubSettings) {
    // Hub branch missing/deleted — degrade gracefully, stay on intake branch.
    return {
      producingBranchId: intakeBranchId,
      intakeBranchId,
      wasRedirected: false,
      resolvedSettings: intakeSettings,
      outOfBandOnly: true,
    }
  }

  return {
    producingBranchId: hubSettings.branchId,
    intakeBranchId,
    wasRedirected: true,
    resolvedSettings: hubSettings,
    outOfBandOnly: !hubSettings.routeToMainDispatch, // guards against hub that also opted out
  }
}

