import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  // Accept either shipdayOrderId or orderNumber
  const shipdayOrderId = searchParams.get("orderId")
  const orderNumber = searchParams.get("orderNumber")

  // Use orderNumber for API call (Shipday API uses order reference number, not internal ID)
  const lookupValue = orderNumber || shipdayOrderId

  if (!lookupValue) {
    return NextResponse.json({ success: false, error: "Missing orderId or orderNumber" }, { status: 400 })
  }

  const apiKey = process.env.SHIPDAY_API_KEY

  if (!apiKey) {
    return NextResponse.json({ 
      success: false, 
      error: "Shipday API key not configured" 
    }, { status: 400 })
  }

  try {
    // Fetch order details from Shipday using order number
    console.log("[v0] Fetching Shipday order with lookup value:", lookupValue)
    
    const response = await fetch(`https://api.shipday.com/orders/${lookupValue}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
    })

    console.log("[v0] Shipday response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.log("[v0] Shipday error response:", errorText)
      return NextResponse.json({
        success: false,
        error: "Failed to fetch Shipday order",
        details: errorText,
      }, { status: response.status })
    }

    const orderDataArray = await response.json()
    
    // Shipday returns an array of orders matching the order number
    console.log("[v0] Shipday response:", JSON.stringify(orderDataArray, null, 2))
    
    // Get the first/most recent order
    const orderData = Array.isArray(orderDataArray) ? orderDataArray[0] : orderDataArray
    
    if (!orderData) {
      return NextResponse.json({
        success: false,
        error: "No order found in Shipday",
      }, { status: 404 })
    }

    // Extract tracking info from assignedCarrier object
    const tracking = {
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      status: orderData.orderStatus?.orderState || "Unknown",
      driverName: orderData.assignedCarrier?.name || null,
      driverPhone: orderData.assignedCarrier?.phoneNumber || null,
      driverPhoto: orderData.assignedCarrier?.carrierPhoto || null,
      driverId: orderData.assignedCarrierId,
      eta: orderData.etaTime || null,
      trackingLink: orderData.trackingLink || null,
    }
    
    console.log("[v0] Extracted tracking info:", tracking)

    return NextResponse.json({
      success: true,
      tracking,
    })
  } catch (error) {
    console.error("[v0] Error fetching Shipday tracking:", error)
    return NextResponse.json({
      success: false,
      error: "Error fetching tracking info",
      details: (error as Error).message,
    }, { status: 500 })
  }
}
