import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { createClient } from "@supabase/supabase-js"

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID

// Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { phone, code } = await request.json()

    if (!phone || !code) {
      return NextResponse.json({ error: "Phone and code are required" }, { status: 400 })
    }

    if (!accountSid || !authToken || !verifyServiceSid) {
      return NextResponse.json({ error: "SMS service not configured" }, { status: 500 })
    }

    // Format phone number
    const phoneDigitsOnly = phone.replace(/\D/g, "")
    // Get just the 10 digit number
    const phone10Digits = phoneDigitsOnly.slice(-10)
    // Format WITH + for Twilio API calls
    const twilioPhone = `+1${phone10Digits}`
    // Format WITHOUT + for Supabase DB storage (to match existing data)
    const dbPhone = `1${phone10Digits}`

    const client = twilio(accountSid, authToken)

    // Verify the code with Twilio (needs + prefix)
    const verificationCheck = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({
        to: twilioPhone,
        code: code,
      })

    console.log("Twilio Verify check:", verificationCheck.status)

    if (verificationCheck.status !== "approved") {
      return NextResponse.json(
        { error: "Codigo invalido o expirado" },
        { status: 400 }
      )
    }

    // Code verified! Now create or get user in Supabase
    // Query auth.users table directly using SQL for reliable lookup
    const phoneLast10 = phone10Digits
    
    console.log("[v0] Searching for user with phone - DB format:", dbPhone, "Last10:", phoneLast10)
    
    // Query directly - search for phone ending with our 10 digits
    // This handles all formats: 17873661140, +17873661140, etc.
    const { data: existingUserRows, error: queryError } = await supabaseAdmin
      .rpc('get_user_by_phone_suffix', { phone_suffix: phoneLast10 })
    
    let existingUser = null
    
    // If RPC doesn't exist, fall back to direct query
    if (queryError) {
      console.log("[v0] RPC not available, using direct auth.users query")
      // Try multiple phone formats
      const phoneFormats = [dbPhone, `+${dbPhone}`, twilioPhone, phone10Digits]
      
      for (const phoneFormat of phoneFormats) {
        const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.listUsers()
        if (!getUserError && userData?.users) {
          const found = userData.users.find(u => {
            if (!u.phone) return false
            const userDigits = u.phone.replace(/\D/g, "")
            return userDigits.slice(-10) === phoneLast10
          })
          if (found) {
            existingUser = found
            console.log("[v0] Found user via listUsers:", found.id, found.phone)
            break
          }
        }
      }
    } else if (existingUserRows && existingUserRows.length > 0) {
      // Get full user data using the ID from our query
      const { data: fullUser } = await supabaseAdmin.auth.admin.getUserById(existingUserRows[0].id)
      existingUser = fullUser?.user
      console.log("[v0] Found user via RPC:", existingUser?.id, existingUser?.phone)
    }
    
    console.log("[v0] Search result - Found:", existingUser?.id || "none")

    let user
    let isNewUser = false

    if (existingUser) {
      user = existingUser
    } else {
      // Create new user with phone (WITHOUT + prefix to match existing DB format)
      console.log("[v0] Creating new user with phone:", dbPhone)
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone: dbPhone,
        phone_confirm: true,
        email_confirm: true,
      })

      if (createError) {
        console.error("[v0] Error creating user:", createError.message)
        // If user already exists, search ALL users to find them
        if (createError.message?.includes("already") || createError.message?.includes("exists") || createError.message?.includes("registered")) {
          console.log("[v0] User already exists error - searching all users...")
          
          // Fetch ALL users to find the one with matching phone
          const { data: allUsersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 10000 })
          const foundUser = allUsersData?.users?.find(u => {
            if (!u.phone) return false
            return u.phone.replace(/\D/g, "").slice(-10) === phoneLast10
          })
          
          if (foundUser) {
            user = foundUser
            console.log("[v0] Found existing user:", user.id, user.phone)
          } else {
            console.error("[v0] Could not find user despite 'already exists' error. Phone:", dbPhone)
            return NextResponse.json({ error: "Error al crear cuenta. Por favor intenta de nuevo." }, { status: 500 })
          }
        } else {
          return NextResponse.json({ error: "Error creating account: " + createError.message }, { status: 500 })
        }
      } else {
        user = newUser.user
        isNewUser = true
      }

      // Also create customer record if we have a user
      if (user) {
        const { error: customerError } = await supabaseAdmin.from("customers").upsert({
          id: user.id,
          phone: dbPhone,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" })
        
        if (customerError) {
          console.error("Error creating customer record:", customerError)
          // Don't fail the whole flow for this
        }
      }
    }

    // Verify we have a valid user
    if (!user || !user.id) {
      console.error("[v0] No user found or created for phone:", dbPhone)
      return NextResponse.json({ error: "Error al crear cuenta. Por favor intenta de nuevo." }, { status: 500 })
    }

    console.log("[v0] Successfully verified phone for user:", user.id, "phone:", dbPhone)

    // Return success - client will handle the session
    return NextResponse.json({
      success: true,
      verified: true,
      userId: user.id,
      isNewUser,
      phone: dbPhone,
      message: "Telefono verificado",
    })
  } catch (error: any) {
    console.error("Verify OTP error:", error)
    return NextResponse.json(
      { error: error.message || "Error al verificar codigo" },
      { status: 500 }
    )
  }
}
