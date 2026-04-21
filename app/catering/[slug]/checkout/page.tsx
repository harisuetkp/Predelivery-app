import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCateringRestaurantBySlug } from "@/lib/catering"
import CateringCheckoutClient from "@/components/catering/catering-checkout-client"

export default async function CateringCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ branch?: string }>
}) {
  const { slug } = await params
  const { branch: branchFromQuery } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(
      `/catering/${slug}/customer-auth?mode=login&redirect=catering-checkout&slug=${slug}`,
    )
  }

  const restaurant = await getCateringRestaurantBySlug(slug)
  if (!restaurant) {
    notFound()
  }

  const { data: branches } = await supabase
    .from("catering_branches")
    .select("id, name, stripe_account_id, catering_restaurant_id, is_active, latitude, longitude")
    .eq("catering_restaurant_id", restaurant.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })

  // Operating hours for this catering restaurant: includes both restaurant-level rows
  // (catering_branch_id IS NULL) and any per-branch overrides.
  const { data: operatingHours } = await supabase
    .from("catering_operating_hours")
    .select("catering_branch_id, day_of_week, is_open, open_time, close_time")
    .eq("catering_restaurant_id", restaurant.id)

  const { data: customerRow } = await supabase
    .from("customers")
    .select("id, full_name, phone, first_name, last_name")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  const profileName =
    customerRow?.full_name?.trim() ||
    [customerRow?.first_name, customerRow?.last_name].filter(Boolean).join(" ").trim() ||
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") ||
    ""

  return (
    <CateringCheckoutClient
      slug={slug}
      restaurant={restaurant}
      branches={branches ?? []}
      operatingHours={operatingHours ?? []}
      initialBranchId={branchFromQuery ?? null}
      authUserId={user.id}
      authEmail={user.email ?? ""}
      initialFullName={profileName}
      initialPhone={customerRow?.phone ?? ""}
      customerId={customerRow?.id ?? null}
    />
  )
}
