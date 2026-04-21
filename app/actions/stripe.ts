"use server"

import { stripe } from "@/lib/stripe"
import { restaurantConfig } from "@/config/restaurant-config"

// Default Stripe Connect account for FoodNetPR (used when restaurant doesn't have their own)
// Set to empty string to process payments directly to the platform account
// Only set this if you have a verified Stripe Connect account linked to your platform
const DEFAULT_STRIPE_ACCOUNT_ID = ""

export async function createCheckoutSession(orderData: {
  cart: any[]
  subtotal: number
  tax: number
  deliveryFee: number // "Costo de Entrega" - customer-facing delivery fee
  dispatchFee?: number // Platform dispatch fee (separate line item)
  tip: number
  total: number
  orderType: string
  eventDetails: any
  includeUtensils: boolean
  servicePackage?: string | null
  stripeAccountId?: string | null // Stripe Connect account ID for the branch
  customerId?: string | null // Platform customer ID
}) {
  console.log("[v0] createCheckoutSession called with total:", orderData.total)
  console.log("[v0] STRIPE_SECRET_KEY exists:", !!process.env.STRIPE_SECRET_KEY)
  console.log("[v0] STRIPE_SECRET_KEY prefix:", process.env.STRIPE_SECRET_KEY?.substring(0, 8) || "NOT SET")
  try {
    if (!stripe) {
      console.error("[v0] Stripe is not configured - STRIPE_SECRET_KEY is missing or invalid")
      console.error("[v0] Environment check - STRIPE_SECRET_KEY:", process.env.STRIPE_SECRET_KEY ? "SET" : "NOT SET")
      throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.")
    }
    console.log("[v0] Stripe client initialized successfully")
    // Helper to safely convert to cents (integer)
    const toCents = (amount: any): number => {
      const num = Number(amount)
      if (isNaN(num)) return 0
      return Math.round(num * 100)
    }

    // Create line items for Stripe
    const lineItems = orderData.cart.map((item) => {
      // Get the correct price - cart items may use totalPrice, finalPrice, or price
      const itemPrice = item.totalPrice ?? item.finalPrice ?? item.price ?? 0
      
      // Build description - Stripe doesn't accept empty strings, so use undefined instead
      let description: string | undefined = undefined
      if (item.selections && Object.keys(item.selections).length > 0) {
        description = `Options: ${Object.entries(item.selections)
          .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
          .join("; ")}`
      } else if (item.selectedSizeName) {
        description = `Size: ${item.selectedSizeName}${item.servesTotal ? ` (Serves ${item.servesTotal})` : ""}`
      } else if (item.description) {
        description = item.description
      }
      
      // totalPrice/finalPrice already includes quantity, so set Stripe quantity to 1
      // to avoid double-counting
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${item.name || "Item"}${item.quantity > 1 ? ` (x${item.quantity})` : ""}`,
            ...(description && { description }),
          },
          unit_amount: toCents(itemPrice),
        },
        quantity: 1,
      }
    })

    if (orderData.servicePackage && restaurantConfig?.servicePackages) {
      const selectedPackage = restaurantConfig.servicePackages.find((pkg) => pkg.id === orderData.servicePackage)
      if (selectedPackage) {
        lineItems.push({
          price_data: {
            currency: "usd",
            product_data: {
              name: `${selectedPackage.icon || ""} ${selectedPackage.name}`.trim(),
              description: selectedPackage.description || "",
            },
            unit_amount: toCents(selectedPackage.price),
          },
          quantity: 1,
        })
      }
    }

    // Add tax line item (IVU - Puerto Rico sales tax)
    if (Number(orderData.tax) > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "IVU",
          },
          unit_amount: toCents(orderData.tax),
        },
        quantity: 1,
      })
    }

    // Add delivery fee if applicable
    if (Number(orderData.deliveryFee) > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Delivery",
          },
          unit_amount: toCents(orderData.deliveryFee),
        },
        quantity: 1,
      })
    }

    // Add dispatch fee if applicable (platform fee)
    if (Number(orderData.dispatchFee) > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Dispatch",
          },
          unit_amount: toCents(orderData.dispatchFee),
        },
        quantity: 1,
      })
    }

    // Add tip if applicable
    if (Number(orderData.tip) > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Tip",
          },
          unit_amount: toCents(orderData.tip),
        },
        quantity: 1,
      })
    }

    // Create checkout session with optional Stripe Connect account
    // Stripe metadata values have a 500 character limit per value
    // Store essential fields separately, and cart as truncated JSON if needed
    const restaurantId = (orderData as any).restaurantId || orderData.eventDetails?.restaurantId || ""
    const branchId = (orderData as any).branchId || orderData.eventDetails?.branchId || ""
    
    // Create a minimal cart representation for metadata (just names, prices, and type)
    const cartSummary = orderData.cart.map(item => ({
      n: item.name,
      q: item.quantity,
      p: item.totalPrice || item.price,
      t: item.type || "menu", // Track item type: "menu", "internal_shop", "package", "delivery_fee"
      iid: item.internalShopItemId || null, // Internal shop item ID if applicable
    }))
    const cartJson = JSON.stringify(cartSummary)
    // Truncate cart if too long (500 char limit)
    const cartMetadata = cartJson.length > 490 ? cartJson.substring(0, 490) + "..." : cartJson
    
    const sessionOptions: any = {
      ui_mode: "embedded",
      line_items: lineItems,
      mode: "payment",
      redirect_on_completion: "never",
      metadata: {
        order_source: (orderData as any).order_source || "online",
        restaurantId,
        branchId,
        customerId: orderData.customerId || "",
        userId: (orderData as any).userId || "",
        orderType: orderData.orderType || "",
        customerEmail: orderData.eventDetails?.email || orderData.customerEmail || "",
        customerPhone: orderData.eventDetails?.phone || "",
        customerName: orderData.eventDetails?.name || "",
        eventDate: orderData.eventDetails?.eventDate || "",
        eventTime: orderData.eventDetails?.eventTime || "",
        address: orderData.eventDetails?.address || "",
        city: orderData.eventDetails?.city || "",
        zip: orderData.eventDetails?.zip || "",
        deliveryLatitude: typeof (orderData.eventDetails as any)?.deliveryLatitude === "number" ? String((orderData.eventDetails as any).deliveryLatitude) : "",
        deliveryLongitude: typeof (orderData.eventDetails as any)?.deliveryLongitude === "number" ? String((orderData.eventDetails as any).deliveryLongitude) : "",
        subtotal: String(orderData.subtotal || 0),
        tax: String(orderData.tax || 0),
        taxRate: String((orderData as any).taxRate || 0),
        deliveryFee: String(orderData.deliveryFee || 0),
        dispatchFee: String(orderData.dispatchFee || 0),
        tip: String(orderData.tip || 0),
        total: String(orderData.total || 0),
        cart: cartMetadata,
        includeUtensils: String(orderData.includeUtensils || false),
      },
    }
    
    // Use connected account if specified, otherwise process directly to platform account
    const accountId = orderData.stripeAccountId || DEFAULT_STRIPE_ACCOUNT_ID
    
    // Only pass stripeAccount option if we have a connected account ID
    const session = accountId 
      ? await stripe.checkout.sessions.create(sessionOptions, { stripeAccount: accountId })
      : await stripe.checkout.sessions.create(sessionOptions)

    return { clientSecret: session.client_secret, sessionId: session.id }
} catch (error: any) {
  console.error("[v0] Error creating checkout session:", error?.message || error)
  console.error("[v0] Stripe error details:", JSON.stringify({
    type: error?.type,
    code: error?.code,
    decline_code: error?.decline_code,
    param: error?.param,
    raw: error?.raw?.message
  }))
  throw new Error(error?.message || "Failed to create checkout session")
  }
}

// Creates a Stripe Checkout session in redirect mode for phone orders.
// Returns a payment URL that can be sent to the customer via text/email.
export async function createPaymentLink(orderData: {
  cart: any[]
  subtotal: number
  tax: number
  deliveryFee: number
  tip: number
  total: number
  orderType: string
  eventDetails: any
  includeUtensils: boolean
  servicePackage?: string | null
  restaurantId: string
  branchId?: string
  stripeAccountId?: string | null // Stripe Connect account ID for the branch
}) {
  try {
    if (!stripe) {
      throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.")
    }
    // Helper to safely convert to cents
    const toCents = (amount: any): number => {
      const num = Number(amount)
      if (isNaN(num)) return 0
      return Math.round(num * 100)
    }

    const lineItems = orderData.cart.map((item) => {
      // Get the correct price - cart items may use totalPrice, finalPrice, or price
      const itemPrice = item.totalPrice ?? item.finalPrice ?? item.price ?? 0
      
      // Build description - Stripe doesn't accept empty strings
      let description: string | undefined = undefined
      if (item.selections && Object.keys(item.selections).length > 0) {
        description = `Options: ${Object.entries(item.selections)
          .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
          .join("; ")}`
      } else if (item.selectedSizeName) {
        description = `Size: ${item.selectedSizeName}${item.servesTotal ? ` (Serves ${item.servesTotal})` : ""}`
      } else if (item.description) {
        description = item.description
      }
      
      // totalPrice/finalPrice already includes quantity, so set Stripe quantity to 1
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${item.name || "Item"}${item.quantity > 1 ? ` (x${item.quantity})` : ""}`,
            ...(description && { description }),
          },
          unit_amount: toCents(itemPrice),
        },
        quantity: 1,
      }
    })

    if (orderData.tax > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Tax",
            description: "Sales tax",
          },
          unit_amount: Math.round(orderData.tax * 100),
        },
        quantity: 1,
      })
    }

    if (orderData.deliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Delivery Fee",
            description: `Delivery to ${orderData.eventDetails?.zip || "selected location"}`,
          },
          unit_amount: Math.round(orderData.deliveryFee * 100),
        },
        quantity: 1,
      })
    }

    if (orderData.tip > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Tip",
            description: "Gratuity for our team",
          },
          unit_amount: Math.round(orderData.tip * 100),
        },
        quantity: 1,
      })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"

// Session options for payment link
    // Stripe metadata values have a 500 character limit, so we split essential data into separate keys
    const sessionOptions: any = {
      line_items: lineItems,
      mode: "payment",
      success_url: `${baseUrl}/phone-order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/phone-order-cancelled`,
      expires_after: 86400, // 24 hours
      metadata: {
        order_source: "phone",
        restaurantId: orderData.restaurantId || "",
        branchId: orderData.branchId || "",
        orderType: orderData.orderType || "",
        customerEmail: orderData.eventDetails?.email || "",
        customerPhone: orderData.eventDetails?.phone || "",
        customerName: orderData.eventDetails?.name || "",
        eventDate: orderData.eventDetails?.eventDate || "",
        eventTime: orderData.eventDetails?.eventTime || "",
        subtotal: String(orderData.subtotal || 0),
        tax: String(orderData.tax || 0),
        deliveryFee: String(orderData.deliveryFee || 0),
        tip: String(orderData.tip || 0),
        total: String(orderData.total || 0),
        itemCount: String(orderData.cart?.length || 0),
        includeUtensils: String(orderData.includeUtensils || false),
      },
    }
    
    // Use connected account if specified, otherwise process directly to platform account
    const accountId = orderData.stripeAccountId || DEFAULT_STRIPE_ACCOUNT_ID
    
    // Only pass stripeAccount option if we have a connected account ID
    const session = accountId 
      ? await stripe.checkout.sessions.create(sessionOptions, { stripeAccount: accountId })
      : await stripe.checkout.sessions.create(sessionOptions)

    return { paymentUrl: session.url, sessionId: session.id }
} catch (error: any) {
  console.error("[v0] Error creating payment link:", error?.message || error)
  console.error("[v0] Stripe error details:", JSON.stringify({
    type: error?.type,
    code: error?.code,
    decline_code: error?.decline_code,
    param: error?.param,
    raw: error?.raw?.message
  }))
  throw new Error(error?.message || "Failed to create payment link")
  }
}
