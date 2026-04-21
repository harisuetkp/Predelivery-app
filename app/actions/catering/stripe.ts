"use server"

import Stripe from "stripe"
import { resolveCateringRouting } from "@/lib/catering/branch-settings"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
})

export interface CateringCheckoutItem {
  name: string
  price: number
  quantity: number
  type?: "item" | "package" | "delivery_fee" | "tax" | "tip"
  menu_item_id?: string
  catering_item_option_id?: string
  selected_options?: Record<string, any>
  size_name?: string
  serves?: string
}

export interface CateringCheckoutData {
  restaurantId: string
  branchId: string
  cart: CateringCheckoutItem[]
  subtotal: number
  tax: number
  deliveryFee: number
  dispatchFee?: number
  tip: number
  total: number
  orderType: "delivery" | "pickup"
  customerEmail?: string
  customerPhone?: string
  customerId?: string
  userId?: string
  order_source?: string
  eventDetails?: {
    name?: string
    email?: string
    phone?: string
    eventDate?: string
    eventTime?: string
    guestCount?: number
    address?: string
    city?: string
    state?: string
    zip?: string
    /** Second line of street address (optional). */
    addressLine2?: string
    specialInstructions?: string
  }
  servicePackageTotal?: number
  stripeAccountId?: string | null
}

export async function createCateringCheckoutSession(orderData: CateringCheckoutData) {
  try {
    // ============================================================
    // Main Dispatch routing — resolve BEFORE building the Stripe session.
    // If the intake branch redirects to a hub (see catering_branches.
    // dispatch_hub_branch_id), reassign branchId + stripeAccountId to the
    // producing branch so the charge lands in the right merchant account.
    // Policy: catering payment always credits the branch that makes the food.
    // ============================================================
    const intakeBranchId = orderData.branchId
    const routing = await resolveCateringRouting(intakeBranchId)
    let wasRedirected = false
    let outOfBandOnly = false
    if (routing) {
      wasRedirected = routing.wasRedirected
      outOfBandOnly = routing.outOfBandOnly
      if (routing.wasRedirected) {
        orderData = {
          ...orderData,
          branchId: routing.producingBranchId,
          stripeAccountId: routing.resolvedSettings.stripeAccountId,
        }
      }
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []

    // Add cart items as line items
    for (const item of orderData.cart) {
      if (item.type === "delivery_fee" || item.type === "tax" || item.type === "tip") continue
      if (item.price <= 0) continue

      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity || 1,
      })
    }

    // Add tax as line item if present
    if (orderData.tax > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "IVU (Tax)" },
          unit_amount: Math.round(orderData.tax * 100),
        },
        quantity: 1,
      })
    }

    // Add delivery fee if present
    if (orderData.deliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Cargo de Entrega" },
          unit_amount: Math.round(orderData.deliveryFee * 100),
        },
        quantity: 1,
      })
    }

    // Add dispatch fee if present
    if (orderData.dispatchFee && orderData.dispatchFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Dispatch Fee" },
          unit_amount: Math.round(orderData.dispatchFee * 100),
        },
        quantity: 1,
      })
    }

    // Add tip if present
    if (orderData.tip > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Propina" },
          unit_amount: Math.round(orderData.tip * 100),
        },
        quantity: 1,
      })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://prdelivery.com"

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      mode: "payment",
      ui_mode: "embedded",
      return_url: `${baseUrl}/catering/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      line_items: lineItems,
      customer_email: orderData.customerEmail || undefined,
      metadata: {
        module: "catering",
        restaurantId: orderData.restaurantId,
        branchId: orderData.branchId,
        customerId: orderData.customerId || "",
        userId: orderData.userId || "",
        customerEmail: orderData.eventDetails?.email || orderData.customerEmail || "",
        customerPhone: orderData.eventDetails?.phone || orderData.customerPhone || "",
        customerName: orderData.eventDetails?.name || "",
        orderType: orderData.orderType,
        eventDate: orderData.eventDetails?.eventDate || "",
        eventTime: orderData.eventDetails?.eventTime || "",
        guestCount: String(orderData.eventDetails?.guestCount || ""),
        address: orderData.eventDetails?.address || "",
        addressLine2: orderData.eventDetails?.addressLine2 || "",
        city: orderData.eventDetails?.city || "",
        state: orderData.eventDetails?.state || "",
        zip: orderData.eventDetails?.zip || "",
        deliveryLatitude: typeof (orderData.eventDetails as any)?.deliveryLatitude === "number" ? String((orderData.eventDetails as any).deliveryLatitude) : "",
        deliveryLongitude: typeof (orderData.eventDetails as any)?.deliveryLongitude === "number" ? String((orderData.eventDetails as any).deliveryLongitude) : "",
        specialInstructions: orderData.eventDetails?.specialInstructions || "",
        subtotal: String(orderData.subtotal),
        tax: String(orderData.tax),
        deliveryFee: String(orderData.deliveryFee),
        dispatchFee: String(orderData.dispatchFee || 0),
        tip: String(orderData.tip),
        total: String(orderData.total),
        servicePackageTotal: String(orderData.servicePackageTotal || 0),
        order_source: orderData.order_source || "online",
        cart: JSON.stringify(orderData.cart),
        stripeAccountId: orderData.stripeAccountId || "",
        // Routing audit — lets the order creation path know if this was redirected
        intakeBranchId: intakeBranchId,
        wasRedirected: wasRedirected ? "1" : "0",
        outOfBandOnly: outOfBandOnly ? "1" : "0",
      },
    }

    // Add Stripe Connect if restaurant has connected account
    if (orderData.stripeAccountId) {
      sessionParams.payment_intent_data = {
        application_fee_amount: Math.round(orderData.total * 100 * 0.047),
        transfer_data: {
          destination: orderData.stripeAccountId,
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return {
      clientSecret: session.client_secret,
      sessionId: session.id,
    }

  } catch (error: any) {
    console.error("[catering/stripe] Error creating checkout session:", error)
    throw new Error(`Failed to create catering checkout session: ${error.message}`)
  }
}
