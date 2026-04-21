import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"

// Default Stripe Connect account for FoodNetPR
const DEFAULT_STRIPE_ACCOUNT_ID = "acct_1ByNFdHCR853Cy3n"

const getAdminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ success: false, error: "Stripe not configured" }, { status: 500 })
    }

    const body = await request.json()
    const { orderId, amountCents, reason } = body

    if (!orderId) {
      return NextResponse.json({ success: false, error: "Order ID is required" }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Get the order with payment intent
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, restaurant_id, stripe_payment_intent_id, stripe_account_id, total, special_instructions")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    }

    if (!order.stripe_payment_intent_id) {
      return NextResponse.json({ 
        success: false, 
        error: "This order was not paid with Stripe (no payment intent found)" 
      }, { status: 400 })
    }

    // Get the payment intent to find the charge - use default account if none specified
    const accountId = order.stripe_account_id ?? null
    if (!accountId && order.payment_track === 'connected') {
      throw new Error(`Order ${order.id} is connected track but has no stripe_account_id`)
    }
    const stripeOptions = accountId ? { stripeAccount: accountId } : {}

    // First, we need to get the charge from the payment intent or session
    // The stripe_payment_intent_id might be a checkout session ID or payment intent ID
    let chargeId: string | null = null
    let paymentIntentId: string | null = null

    if (order.stripe_payment_intent_id.startsWith("cs_")) {
      // It's a checkout session - retrieve the session to get the payment intent
      const session = await stripe.checkout.sessions.retrieve(
        order.stripe_payment_intent_id,
        stripeOptions
      )
      paymentIntentId = session.payment_intent as string
    } else if (order.stripe_payment_intent_id.startsWith("pi_")) {
      paymentIntentId = order.stripe_payment_intent_id
    }

    if (!paymentIntentId) {
      return NextResponse.json({ 
        success: false, 
        error: "Could not find payment intent for this order" 
      }, { status: 400 })
    }

    // Get the payment intent to find the latest charge
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, stripeOptions)
    
    if (paymentIntent.latest_charge) {
      chargeId = paymentIntent.latest_charge as string
    }

    if (!chargeId) {
      return NextResponse.json({ 
        success: false, 
        error: "No charge found for this payment" 
      }, { status: 400 })
    }

    // Use the amount in cents directly
    const refundAmountCents = amountCents || undefined // undefined = full refund

    // Create the refund
    const refundParams: any = {
      charge: chargeId,
      reason: reason === "duplicate" ? "duplicate" 
            : reason === "fraudulent" ? "fraudulent" 
            : "requested_by_customer",
      metadata: {
        order_id: orderId,
        order_number: order.order_number,
        refund_reason: reason || "Customer requested refund"
      }
    }

    if (refundAmountCents) {
      refundParams.amount = refundAmountCents
    }

    const refund = await stripe.refunds.create(refundParams, stripeOptions)

    // Log the refund in the database
    await supabase.from("order_payment_adjustments").insert({
      order_id: orderId,
      restaurant_id: order.restaurant_id,
      adjustment_type: "refund",
      amount_cents: refundAmountCents || Math.round(order.total * 100),
      stripe_refund_id: refund.id,
      reason: reason || "Customer requested refund",
      status: "completed",
      completed_at: new Date().toISOString()
    })

    // Update order with refund status if fully refunded
    if (!refundAmountCents || refundAmountCents >= Math.round(order.total * 100)) {
      await supabase
        .from("orders")
        .update({ 
          status: "cancelled",
          special_instructions: `${order.special_instructions || ""}\n[REFUND: ${reason || "Full refund processed"}]`.trim()
        })
        .eq("id", orderId)
    }

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        currency: refund.currency
      }
    })

  } catch (error: any) {
    console.error("Refund error:", error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Failed to process refund" 
    }, { status: 500 })
  }
}
