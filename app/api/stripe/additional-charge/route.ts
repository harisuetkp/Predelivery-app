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

    if (!orderId || !amountCents || amountCents <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Order ID and positive amount are required" 
      }, { status: 400 })
    }
    
    const amount = amountCents / 100
    const description = reason

    const supabase = getAdminClient()

    // Get the order with payment intent
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, restaurant_id, stripe_payment_intent_id, stripe_account_id, total, customer_email, customer_name, special_instructions")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    }

    if (!order.stripe_payment_intent_id) {
      return NextResponse.json({ 
        success: false, 
        error: "This order was not paid with Stripe - cannot charge additional amount" 
      }, { status: 400 })
    }

    // Use default FoodNetPR account if none specified
    const accountId = order.stripe_account_id ?? null
    if (!accountId && order.payment_track === 'connected') {
      throw new Error(`Order ${order.id} is connected track but has no stripe_account_id`)
    }
    const stripeOptions = accountId ? { stripeAccount: accountId } : {}

    // Get the original payment method from the payment intent
    let paymentIntentId: string | null = null
    let customerId: string | null = null
    let paymentMethodId: string | null = null

    if (order.stripe_payment_intent_id.startsWith("cs_")) {
      // It's a checkout session
      const session = await stripe.checkout.sessions.retrieve(
        order.stripe_payment_intent_id,
        stripeOptions
      )
      paymentIntentId = session.payment_intent as string
      customerId = session.customer as string
    } else if (order.stripe_payment_intent_id.startsWith("pi_")) {
      paymentIntentId = order.stripe_payment_intent_id
    }

    if (!paymentIntentId) {
      return NextResponse.json({ 
        success: false, 
        error: "Could not find original payment" 
      }, { status: 400 })
    }

    // Get the payment intent to find the payment method
    const originalPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, stripeOptions)
    paymentMethodId = originalPaymentIntent.payment_method as string
    customerId = customerId || originalPaymentIntent.customer as string

    if (!paymentMethodId) {
      return NextResponse.json({ 
        success: false, 
        error: "Could not find payment method for additional charge. Customer may need to pay manually." 
      }, { status: 400 })
    }

    // Create a new payment intent for the additional charge
    const paymentIntentParams: any = {
      amount: amountCents,
      currency: "usd",
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      description: description || `Additional charge for Order #${order.order_number}`,
      metadata: {
        order_id: orderId,
        order_number: order.order_number,
        type: "additional_charge",
        original_payment_intent: paymentIntentId
      }
    }

    if (customerId) {
      paymentIntentParams.customer = customerId
    }

    const newPaymentIntent = await stripe.paymentIntents.create(paymentIntentParams, stripeOptions)

    // Log the additional charge in the database
    await supabase.from("order_payment_adjustments").insert({
      order_id: orderId,
      restaurant_id: order.restaurant_id,
      adjustment_type: "charge",
      amount_cents: amountCents,
      stripe_payment_intent_id: newPaymentIntent.id,
      reason: description || "Additional charge",
      status: "completed",
      completed_at: new Date().toISOString()
    })

    // Update order total
    const newTotal = Number(order.total) + amount
    await supabase
      .from("orders")
      .update({ 
        total: newTotal,
        special_instructions: `${order.special_instructions || ""}\n[CARGO ADICIONAL: $${amount.toFixed(2)} - ${description || "Additional charge"}]`.trim()
      })
      .eq("id", orderId)

    return NextResponse.json({
      success: true,
      charge: {
        id: newPaymentIntent.id,
        amount: newPaymentIntent.amount / 100,
        status: newPaymentIntent.status,
        currency: newPaymentIntent.currency
      },
      newTotal
    })

  } catch (error: any) {
    console.error("Additional charge error:", error)
    
    // Handle specific Stripe errors
    if (error.code === "authentication_required") {
      return NextResponse.json({ 
        success: false, 
        error: "Customer authentication required. Cannot charge off-session." 
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Failed to process additional charge" 
    }, { status: 500 })
  }
}
