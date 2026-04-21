import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const { token } = await request.json()

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { success: false, error: "Código de acceso requerido" },
        { status: 400 }
      )
    }

    const cleanCode = token.trim().toUpperCase()

    if (cleanCode.length < 5 || cleanCode.length > 6) {
      return NextResponse.json(
        { success: false, error: "El código debe tener 5-6 caracteres" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // First, check if code matches a restaurant's KDS setup code
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, name, slug, kds_access_token, kds_setup_code")
      .eq("kds_setup_code", cleanCode)
      .single()

    if (restaurant && !restaurantError) {
      // Found restaurant with this setup code - redirect using the full access token
      const accessToken = restaurant.kds_access_token || ""
      const redirectUrl = `/${restaurant.slug}/kds${accessToken ? `?token=${accessToken}` : ""}`
      
      return NextResponse.json({
        success: true,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        slug: restaurant.slug,
        redirectUrl,
        deviceType: "kds",
      })
    }

    // If not found in restaurants, check branches table
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select(`
        id,
        name,
        kds_access_token,
        kds_setup_code,
        restaurant_id,
        restaurants!inner (
          id,
          name,
          slug
        )
      `)
      .eq("kds_setup_code", cleanCode)
      .single()

    if (branch && !branchError && branch.restaurants) {
      // Found branch with this setup code - redirect using the full access token
      const restaurantData = branch.restaurants as { id: string; name: string; slug: string }
      const accessToken = branch.kds_access_token || ""
      const redirectUrl = `/${restaurantData.slug}/kds${accessToken ? `?token=${accessToken}` : ""}&branch=${branch.id}`
      
      return NextResponse.json({
        success: true,
        restaurantId: restaurantData.id,
        restaurantName: `${restaurantData.name} - ${branch.name}`,
        slug: restaurantData.slug,
        branchId: branch.id,
        branchName: branch.name,
        redirectUrl,
        deviceType: "kds",
      })
    }

    // Token not found
    return NextResponse.json(
      { success: false, error: "Código no encontrado. Verifica e intenta de nuevo." },
      { status: 404 }
    )

  } catch (error) {
    console.error("[v0] Error validating setup token:", error)
    return NextResponse.json(
      { success: false, error: "Error del servidor. Intenta de nuevo." },
      { status: 500 }
    )
  }
}
