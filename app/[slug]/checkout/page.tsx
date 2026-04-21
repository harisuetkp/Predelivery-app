import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CheckoutClient } from "@/components/checkout-client"

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = await createClient()

  // ------------------------------------------------------------
  // Phase 2 auth gate (Uber/DoorDash pattern):
  // No guest checkout. Unauthenticated users are bounced to the
  // per-restaurant /customer-auth page, which knows how to send
  // them straight back to /<slug>/checkout after sign-in.
  // Cart survives via localStorage[`cart_${restaurant.id}`]
  // (written by customer-portal handleProceedToCheckout).
  // ------------------------------------------------------------
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${slug}/customer-auth?mode=login&redirect=checkout`)
  }

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .single()

  if (!restaurant) {
    redirect(`/${slug}`)
  }

  return <CheckoutClient restaurant={restaurant} />
}
