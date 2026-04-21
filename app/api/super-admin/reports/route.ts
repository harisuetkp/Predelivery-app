import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const restaurantId = searchParams.get("restaurant_id")
  const startDate = searchParams.get("start_date")
  const endDate = searchParams.get("end_date")
  const paymentMethod = searchParams.get("payment_method")
  const deliveryType = searchParams.get("delivery_type")
  const paidFilter = searchParams.get("paid")
  const tentParam = searchParams.get("tent") || "all"
  const selectedTents = tentParam === "all" 
    ? ["online_ordering", "catering", "subscriptions"]
    : tentParam.split(",")

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 })
  }

  const supabase = createServiceClient()
  const restaurantMap: Record<string, any> = {}

  // ============================================================
  // ONLINE ORDERING
  // ============================================================
  if (selectedTents.includes("online_ordering")) {
    let query = supabase
      .from("orders")
      .select(`
        id, order_number, created_at, delivery_date, delivery_type, status,
        subtotal, restaurant_subtotal, tax, tip, delivery_fee, total,
        stripe_payment_intent_id, order_source, restaurant_id,
        restaurants!inner(
          id, name, slug, tax_rate,
          restaurant_discount_percent,
          delivery_discount_percent,
          pickup_discount_percent
        )
      `)
      .gte("created_at", `${startDate}T00:00:00`)
      .lte("created_at", `${endDate}T23:59:59`)
      .order("created_at", { ascending: true })

    if (restaurantId && restaurantId !== "all") query = query.eq("restaurant_id", restaurantId)
    if (deliveryType && deliveryType !== "all") query = query.eq("delivery_type", deliveryType)
    if (paidFilter === "paid") query = query.not("stripe_payment_intent_id", "is", null)
    else if (paidFilter === "unpaid") query = query.is("stripe_payment_intent_id", null)
    if (paymentMethod === "CREDIT") query = query.not("stripe_payment_intent_id", "is", null)
    else if (paymentMethod === "ATHMOVIL") query = query.ilike("order_source", "%athmovil%")
    else if (paymentMethod === "CASH") query = query.ilike("order_source", "%cash%")

    const { data: orders, error } = await query
    if (error) {
      console.error("[reports] Online ordering error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    for (const order of orders ?? []) {
      const restaurant = order.restaurants as any
      const key = `delivery_${restaurant.id}`

      if (!restaurantMap[key]) {
        restaurantMap[key] = {
          tent: "online_ordering",
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          restaurantSlug: restaurant.slug,
          commissionGeneral: restaurant.restaurant_discount_percent ?? 0,
          commissionDelivery: restaurant.delivery_discount_percent ?? 0,
          commissionPickup: restaurant.pickup_discount_percent ?? 0,
          orders: [],
          totalOrders: 0,
          totalSubtotal: 0,
          totalTax: 0,
          totalTips: 0,
          totalDeliveryFees: 0,
          totalCharged: 0,
          totalCommission: 0,
          totalEarned: 0,
        }
      }

      const r = restaurantMap[key]
      const isDelivery = order.delivery_type === "delivery"
      const commissionRate = isDelivery
        ? (r.commissionDelivery || r.commissionGeneral)
        : (r.commissionPickup || r.commissionGeneral)

      const subtotal = Number(order.subtotal) || 0
      const tax = Number(order.tax) || 0
      const tip = Number(order.tip) || 0
      const deliveryFee = Number(order.delivery_fee) || 0
      const total = Number(order.total) || 0
      const commission = subtotal * (commissionRate / 100)
      const totalEarned = subtotal - commission + tip + deliveryFee

      const hour = new Date(order.created_at).getHours()
      const daypart = hour < 11 ? "Breakfast" : hour < 16 ? "Lunch" : "Dinner"

      let pmMethod = "UNKNOWN"
      if (order.stripe_payment_intent_id) pmMethod = "CREDIT"
      else if (order.order_source?.toLowerCase().includes("athmovil")) pmMethod = "ATHMOVIL"
      else if (order.order_source?.toLowerCase().includes("cash")) pmMethod = "CASH"

      r.orders.push({
        id: order.id,
        orderNumber: order.order_number || order.id.slice(0, 8),
        createdAt: order.created_at,
        deliveryType: order.delivery_type || "delivery",
        status: order.status,
        paymentMethod: pmMethod,
        isPaid: !!order.stripe_payment_intent_id,
        daypart,
        subtotal,
        tax,
        tip,
        deliveryFee,
        total,
        commission,
        totalEarned,
      })

      r.totalOrders++
      r.totalSubtotal += subtotal
      r.totalTax += tax
      r.totalTips += tip
      r.totalDeliveryFees += deliveryFee
      r.totalCharged += total
      r.totalCommission += commission
      r.totalEarned += totalEarned
    }
  }

  // ============================================================
  // CATERING
  // ============================================================
  if (selectedTents.includes("catering")) {
    let cateringQuery = supabase
      .from("catering_orders")
      .select(`
        id, order_number, created_at, event_date, delivery_type, status,
        subtotal, tax, tip, delivery_fee, total, service_revenue,
        restaurant_payout, payment_method, payment_status,
        stripe_payment_intent_id, payment_provider,
        catering_restaurant_id,
        catering_restaurants!inner(id, name, slug)
      `)
      .gte("created_at", `${startDate}T00:00:00`)
      .lte("created_at", `${endDate}T23:59:59`)
      .order("created_at", { ascending: true })

    if (restaurantId && restaurantId !== "all") {
      cateringQuery = cateringQuery.eq("catering_restaurant_id", restaurantId)
    }
    if (paidFilter === "paid") cateringQuery = cateringQuery.eq("payment_status", "paid")
    else if (paidFilter === "unpaid") cateringQuery = cateringQuery.neq("payment_status", "paid")

    const { data: cateringOrders, error: cateringError } = await cateringQuery
    if (cateringError) {
      console.error("[reports] Catering error:", cateringError)
      return NextResponse.json({ error: cateringError.message }, { status: 500 })
    }

    for (const order of cateringOrders ?? []) {
      const restaurant = order.catering_restaurants as any
      const key = `catering_${restaurant.id}`

      if (!restaurantMap[key]) {
        restaurantMap[key] = {
          tent: "catering",
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          restaurantSlug: restaurant.slug,
          commissionGeneral: 0,
          commissionDelivery: 0,
          commissionPickup: 0,
          orders: [],
          totalOrders: 0,
          totalSubtotal: 0,
          totalTax: 0,
          totalTips: 0,
          totalDeliveryFees: 0,
          totalCharged: 0,
          totalCommission: 0,
          totalEarned: 0,
        }
      }

      const r = restaurantMap[key]
      const subtotal = Number(order.subtotal) || 0
      const tax = Number(order.tax) || 0
      const tip = Number(order.tip) || 0
      const deliveryFee = Number(order.delivery_fee) || 0
      const total = Number(order.total) || 0
      const serviceRevenue = Number(order.service_revenue) || 0
      const restaurantPayout = Number(order.restaurant_payout) || 0
      const commission = serviceRevenue
      const totalEarned = restaurantPayout

      const isPaid = order.payment_status === "paid" ||
        !!order.stripe_payment_intent_id

      let pmMethod = "UNKNOWN"
      if (order.payment_provider === "stripe" || order.stripe_payment_intent_id) pmMethod = "CREDIT"
      else if (order.payment_provider === "athmovil") pmMethod = "ATHMOVIL"
      else if (order.payment_method === "cash") pmMethod = "CASH"

      r.orders.push({
        id: order.id,
        orderNumber: order.order_number || order.id.slice(0, 8),
        createdAt: order.created_at,
        eventDate: order.event_date,
        deliveryType: order.delivery_type || "pickup",
        status: order.status,
        paymentMethod: pmMethod,
        isPaid,
        daypart: "Event",
        subtotal,
        tax,
        tip,
        deliveryFee,
        total,
        commission,
        totalEarned,
      })

      r.totalOrders++
      r.totalSubtotal += subtotal
      r.totalTax += tax
      r.totalTips += tip
      r.totalDeliveryFees += deliveryFee
      r.totalCharged += total
      r.totalCommission += commission
      r.totalEarned += totalEarned
    }
  }

  const totalOrders = Object.values(restaurantMap).reduce(
    (sum, r) => sum + r.totalOrders, 0
  )

  return NextResponse.json({
    restaurants: Object.values(restaurantMap),
    meta: { startDate, endDate, totalOrders, tent }
  })
}
