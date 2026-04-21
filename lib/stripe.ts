import "server-only"

import Stripe from "stripe"

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

// Log at initialization time so we can see in server logs
if (!stripeSecretKey) {
  console.error("[v0] STRIPE_SECRET_KEY is not set - Stripe payments will fail")
} else {
  // Log first 10 chars to verify it's loaded (safe to log partial key prefix)
  console.log("[v0] STRIPE_SECRET_KEY loaded, starts with:", stripeSecretKey.substring(0, 10) + "...")
}

export const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey)
  : null as unknown as Stripe
