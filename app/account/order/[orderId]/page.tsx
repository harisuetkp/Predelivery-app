import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { OrderDetailsClient } from "./order-details-client"

interface Props {
  params: Promise<{ orderId: string }>
}

// Admin client to bypass RLS
const getAdminClient = () =>
  createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export default async function CustomerOrderDetailsPage({ params }: Props) {
  const { orderId } = await params
  const supabase = await createClient()
  const adminClient = getAdminClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/customer/login?redirect=/account/order/${orderId}`)
  }

  // Get customer record using admin client to bypass RLS
  const { data: customer } = await adminClient
    .from("customers")
    .select("*")
    .eq("auth_user_id", user.id)
    .single()

  // Fetch order with restaurant and items using admin client
  const { data: order, error: orderError } = await adminClient
    .from("orders")
    .select(`
      *,
      restaurants (
        id,
        name,
        slug,
        logo_url,
        phone,
        address,
        restaurant_address
      ),
      order_items (
        id,
        menu_item_id,
        item_name,
        quantity,
        unit_price,
        total_price,
        selected_options,
        special_instructions
      )
    `)
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    redirect("/account")
  }

  return (
    <OrderDetailsClient
      order={order}
      customer={customer}
    />
  )
}
