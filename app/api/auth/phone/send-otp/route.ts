import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }

    if (!accountSid || !authToken || !verifyServiceSid) {
      console.error("Missing Twilio credentials")
      return NextResponse.json({ error: "SMS service not configured" }, { status: 500 })
    }

    // Format phone number - always use last 10 digits with +1 prefix
    const phoneDigitsOnly = phone.replace(/\D/g, "")
    const phone10Digits = phoneDigitsOnly.slice(-10)
    const formattedPhone = `+1${phone10Digits}`
    
    console.log("[v0] Sending OTP to:", formattedPhone, "(input was:", phone, ")")

    const client = twilio(accountSid, authToken)

    // Send verification code via Twilio Verify
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({
        to: formattedPhone,
        channel: "sms",
      })

    console.log("Twilio Verify sent:", verification.status)

    return NextResponse.json({ 
      success: true, 
      status: verification.status,
      message: "Codigo enviado" 
    })
  } catch (error: any) {
    console.error("Twilio Verify error:", error)
    return NextResponse.json(
      { error: error.message || "Error al enviar codigo" },
      { status: 500 }
    )
  }
}
