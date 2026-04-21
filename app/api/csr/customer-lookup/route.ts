import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const phone = searchParams.get("phone")
  const email = searchParams.get("email")
  const restaurantId = searchParams.get("restaurantId")

  if (!phone && !email) {
    return NextResponse.json({ error: "Phone or email required" }, { status: 400 })
  }

  try {
    // Build query to find customer
    let customerQuery = supabase
      .from("customers")
      .select(`
        id,
        name,
        email,
        phone,
        default_address_id,
        default_payment_method_id,
        created_at
      `)

    if (phone) {
      // Normalize phone number for search (remove non-digits)
      const normalizedPhone = phone.replace(/\D/g, "")
      customerQuery = customerQuery.or(`phone.ilike.%${normalizedPhone}%,phone.ilike.%${phone}%`)
    } else if (email) {
      customerQuery = customerQuery.ilike("email", `%${email}%`)
    }

    const { data: customers, error: customerError } = await customerQuery.limit(10)

    if (customerError) {
      console.error("Customer lookup error:", customerError)
      return NextResponse.json({ error: "Failed to lookup customer" }, { status: 500 })
    }

    if (!customers || customers.length === 0) {
      return NextResponse.json({ customers: [], addresses: [], paymentMethods: [], recentOrders: [] })
    }

    // Get the first matching customer's full data
    const customer = customers[0]

    // Fetch customer's saved addresses
    const { data: addresses } = await supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_id", customer.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })

    // Fetch customer's saved payment methods
    const { data: paymentMethods } = await supabase
      .from("customer_payment_methods")
      .select("*")
      .eq("customer_id", customer.id)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })

    // Fetch recent orders - optionally filter by restaurant
    let ordersQuery = supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        total,
        order_type,
        created_at,
        items,
        restaurant_id,
        restaurants (
          id,
          name,
          slug
        )
      `)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(10)

    if (restaurantId) {
      ordersQuery = ordersQuery.eq("restaurant_id", restaurantId)
    }

    const { data: recentOrders } = await ordersQuery

    return NextResponse.json({
      customers,
      customer,
      addresses: addresses || [],
      paymentMethods: paymentMethods || [],
      recentOrders: recentOrders || [],
    })
  } catch (error: any) {
    console.error("Customer lookup error:", error)
    return NextResponse.json({ error: error.message || "Failed to lookup customer" }, { status: 500 })
  }
}

// Create or update customer
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { name, email, phone, address, saveAddress, savePaymentMethod, paymentMethodData } = body

  if (!phone) {
    return NextResponse.json({ error: "Phone required" }, { status: 400 })
  }

  try {
    // Normalize phone
    const normalizedPhone = phone.replace(/\D/g, "")

    // Check if customer exists
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .or(`phone.ilike.%${normalizedPhone}%,phone.ilike.%${phone}%`)
      .single()

    let customerId: string

    if (existingCustomer) {
      // Update existing customer
      customerId = existingCustomer.id
      await supabase
        .from("customers")
        .update({ name, email, updated_at: new Date().toISOString() })
        .eq("id", customerId)
    } else {
      // Create new customer
      const { data: newCustomer, error: createError } = await supabase
        .from("customers")
        .insert({ name, email, phone: normalizedPhone })
        .select("id")
        .single()

      if (createError || !newCustomer) {
        throw new Error("Failed to create customer")
      }
      customerId = newCustomer.id
    }

    // Save address if requested
    let addressId: string | null = null
    if (saveAddress && address) {
      // Check if address already exists
      const { data: existingAddress } = await supabase
        .from("customer_addresses")
        .select("id")
        .eq("customer_id", customerId)
        .eq("street_address", address.streetAddress)
        .eq("city", address.city)
        .eq("zip", address.zip)
        .single()

      if (existingAddress) {
        addressId = existingAddress.id
      } else {
        const { data: newAddress, error: addressError } = await supabase
          .from("customer_addresses")
          .insert({
            customer_id: customerId,
            label: address.label || "Home",
            street_address: address.streetAddress,
            street_address_2: address.streetAddress2 || null,
            city: address.city,
            state: address.state || "PR",
            zip: address.zip,
            delivery_instructions: address.deliveryInstructions || null,
            is_default: true,
          })
          .select("id")
          .single()

        if (!addressError && newAddress) {
          addressId = newAddress.id
          // Update customer's default address
          await supabase
            .from("customers")
            .update({ default_address_id: addressId })
            .eq("id", customerId)
        }
      }
    }

    // Save payment method if requested (Stripe customer/payment method IDs)
    let paymentMethodId: string | null = null
    if (savePaymentMethod && paymentMethodData) {
      const { data: newPaymentMethod, error: pmError } = await supabase
        .from("customer_payment_methods")
        .insert({
          customer_id: customerId,
          provider: "stripe",
          provider_customer_id: paymentMethodData.stripeCustomerId,
          provider_payment_method_id: paymentMethodData.stripePaymentMethodId,
          card_brand: paymentMethodData.cardBrand,
          card_last_four: paymentMethodData.cardLastFour,
          card_exp_month: paymentMethodData.cardExpMonth,
          card_exp_year: paymentMethodData.cardExpYear,
          is_default: true,
          is_active: true,
        })
        .select("id")
        .single()

      if (!pmError && newPaymentMethod) {
        paymentMethodId = newPaymentMethod.id
        // Update customer's default payment method
        await supabase
          .from("customers")
          .update({ default_payment_method_id: paymentMethodId })
          .eq("id", customerId)
      }
    }

    return NextResponse.json({
      success: true,
      customerId,
      addressId,
      paymentMethodId,
    })
  } catch (error: any) {
    console.error("Customer save error:", error)
    return NextResponse.json({ error: error.message || "Failed to save customer" }, { status: 500 })
  }
}
