import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const ATH_MOVIL_REFUND_URL = "https://payments.athmovil.com/api/business-transaction/ecommerce/refund"

// Default ATH Móvil credentials for FoodNetPR (used when restaurant doesn't have their own)
// These MUST be set as environment variables in Vercel - no fallbacks allowed
const DEFAULT_ATHMOVIL_PUBLIC_TOKEN = process.env.ATHMOVIL_PUBLIC_TOKEN
const DEFAULT_ATHMOVIL_PRIVATE_TOKEN = process.env.ATHMOVIL_PRIVATE_TOKEN

const getAdminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, amountCents, reason } = body

    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: "Order ID is required" 
      }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Get the order with ATH Móvil reference number
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id, 
        order_number, 
        restaurant_id,
        branch_id,
        athmovil_reference_number, 
        total, 
        payment_provider
      `)
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ 
        success: false, 
        error: "Order not found" 
      }, { status: 404 })
    }

    if (order.payment_provider !== "athmovil") {
      return NextResponse.json({ 
        success: false, 
        error: "This order was not paid with ATH Móvil" 
      }, { status: 400 })
    }

    if (!order.athmovil_reference_number) {
      return NextResponse.json({ 
        success: false, 
        error: "No ATH Móvil reference number found for this order" 
      }, { status: 400 })
    }

    // Get ATH Móvil credentials (need both public and private token for refunds)
    let publicToken: string | null = null
    let privateToken: string | null = null

    // Try branch first
    if (order.branch_id) {
      const { data: branch } = await supabase
        .from("branches")
        .select("athmovil_public_token, athmovil_private_token")
        .eq("id", order.branch_id)
        .single()

      if (branch?.athmovil_public_token) {
        publicToken = branch.athmovil_public_token
        privateToken = branch.athmovil_private_token
      }
    }

    // Fall back to restaurant
    if (!publicToken && order.restaurant_id) {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("athmovil_public_token, athmovil_private_token")
        .eq("id", order.restaurant_id)
        .single()

      if (restaurant?.athmovil_public_token) {
        publicToken = restaurant.athmovil_public_token
        privateToken = restaurant.athmovil_private_token
      }
    }

    // Fall back to default FoodNetPR ATH Móvil account
    if (!publicToken || !privateToken) {
      if (!DEFAULT_ATHMOVIL_PUBLIC_TOKEN || !DEFAULT_ATHMOVIL_PRIVATE_TOKEN) {
        return NextResponse.json({ 
          success: false, 
          error: "ATH Móvil credentials not configured. Restaurant has no ATH Móvil token and ATHMOVIL_PUBLIC_TOKEN/ATHMOVIL_PRIVATE_TOKEN environment variables are not set." 
        }, { status: 500 })
      }
      publicToken = DEFAULT_ATHMOVIL_PUBLIC_TOKEN
      privateToken = DEFAULT_ATHMOVIL_PRIVATE_TOKEN
      console.log("[ATH Móvil Refund] Using default FoodNetPR account")
    }

    // Calculate refund amount (ATH Móvil uses dollars with 2 decimal places)
    const refundAmount = amountCents 
      ? (amountCents / 100).toFixed(2)
      : order.total.toFixed(2)

    // Make the refund request to ATH Móvil
    const refundRequest = {
      publicToken: publicToken,
      privateToken: privateToken,
      referenceNumber: order.athmovil_reference_number,
      amount: refundAmount,
      message: reason || "Refund requested"
    }

    console.log("[ATH Móvil Refund] Request:", JSON.stringify({
      ...refundRequest,
      privateToken: "***hidden***"
    }))

    const response = await fetch(ATH_MOVIL_REFUND_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(refundRequest),
    })

    const responseText = await response.text()
    console.log("[ATH Móvil Refund] Response:", response.status, responseText)

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      return NextResponse.json({ 
        success: false, 
        error: `Invalid response from ATH Móvil: ${responseText}` 
      }, { status: 500 })
    }

    if (result.status !== "success") {
      return NextResponse.json({ 
        success: false, 
        error: result.message || "ATH Móvil refund failed" 
      }, { status: 400 })
    }

    // Log the refund in the database
    await supabase.from("order_payment_adjustments").insert({
      order_id: orderId,
      restaurant_id: order.restaurant_id,
      adjustment_type: "refund",
      amount_cents: amountCents || Math.round(order.total * 100),
      reason: reason || "ATH Móvil refund",
      status: "completed",
      completed_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      refund: {
        amount: parseFloat(refundAmount),
        referenceNumber: result.data?.refund?.referenceNumber,
        status: result.data?.refund?.status || "COMPLETED"
      }
    })

  } catch (error: any) {
    console.error("[ATH Móvil Refund] Error:", error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Error processing ATH Móvil refund" 
    }, { status: 500 })
  }
}
