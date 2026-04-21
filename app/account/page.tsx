import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AccountDashboard } from "@/components/account-dashboard"

export default async function AccountPage() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError) {
    console.error("[Account] Auth error:", authError)
    throw new Error(`Authentication failed: ${authError.message}`)
  }
  
  if (!user) {
    redirect("/auth/customer/login?redirect=/account")
  }

  // Get customer record
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("auth_user_id", user.id)
    .single()

  if (customerError) {
    console.error("[Account] Customer fetch error:", customerError)
    throw new Error(`Customer lookup failed: ${customerError.message}`)
  }

  if (!customer) {
    console.error("[Account] No customer record found for auth_user_id:", user.id)
    throw new Error("No customer record found for this user")
  }

  // Get customer addresses
  const { data: addresses, error: addressError } = await supabase
    .from("customer_addresses")
    .select("*")
    .eq("customer_id", customer.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  if (addressError) {
    console.error("[Account] Address fetch error:", addressError)
    throw new Error(`Address fetch failed: ${addressError.message}`)
  }

  // Get customer payment methods
  const { data: paymentMethods, error: paymentError } = await supabase
    .from("customer_payment_methods")
    .select("*")
    .eq("customer_id", customer.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  if (paymentError) {
    console.error("[Account] Payment methods fetch error:", paymentError)
    throw new Error(`Payment methods fetch failed: ${paymentError.message}`)
  }

  // Get customer orders (across all restaurants)
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(`
      *,
      restaurants (
        id,
        name,
        slug,
        logo_url
      )
    `)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (ordersError) {
    console.error("[Account] Orders fetch error:", ordersError)
    throw new Error(`Orders fetch failed: ${ordersError.message}`)
  }

  // Get favorite restaurants
  const { data: favorites, error: favoritesError } = await supabase
    .from("customer_favorites")
    .select(`
      *,
      restaurants (
        id,
        name,
        slug,
        logo_url,
        cuisine_type,
        marketplace_image_url
      )
    `)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })

  if (favoritesError) {
    console.error("[Account] Favorites fetch error:", favoritesError)
    throw new Error(`Favorites fetch failed: ${favoritesError.message}`)
  }

  return (
    <AccountDashboard
      user={user}
      customer={customer}
      addresses={addresses || []}
      paymentMethods={paymentMethods || []}
      orders={orders || []}
      favorites={favorites || []}
    />
  )
}
