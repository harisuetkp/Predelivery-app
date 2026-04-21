import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Eatabit sends status callbacks when print job status changes
// Statuses: queued -> downloaded -> printed -> (accepted | rejected)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log("[Eatabit Webhook] Received:", JSON.stringify(body))
    
    const jobId = body.job_id || body.id
    const status = body.status
    
    if (!jobId || !status) {
      return NextResponse.json({ error: "Missing job_id or status" }, { status: 400 })
    }
    
    const supabase = await createClient()
    
    // Find order by eatabit_job_id
    const { data: order, error: findError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("eatabit_job_id", jobId)
      .single()
    
    if (findError || !order) {
      console.error("[Eatabit Webhook] Order not found for job:", jobId)
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    
    // Update order with new eatabit status
    const updateData: any = { eatabit_status: status }
    
    // Optionally update order status based on printer action
    if (status === "accepted") {
      // Restaurant accepted the order via printer
      updateData.status = "accepted"
    } else if (status === "rejected") {
      // Restaurant rejected the order via printer
      updateData.status = "cancelled"
      updateData.cancellation_reason = "Rejected by restaurant"
    }
    
    const { error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", order.id)
    
    if (updateError) {
      console.error("[Eatabit Webhook] Error updating order:", updateError)
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
    }
    
    console.log(`[Eatabit Webhook] Order ${order.id} updated to status: ${status}`)
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error("[Eatabit Webhook] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Also support GET for webhook verification if needed
export async function GET() {
  return NextResponse.json({ status: "ok", service: "eatabit-webhook" })
}
