import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/csr/catering-data?restaurantId=xxx
 * Fetches branches, service packages, categories, and menu items for a catering restaurant.
 * Called client-side after restaurant selection in CSR catering mode.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const restaurantId = searchParams.get("restaurantId")

  if (!restaurantId) {
    return NextResponse.json(
      { error: "restaurantId is required" },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Fetch branches
  const { data: branches, error: branchesError } = await supabase
    .from("catering_branches")
    .select("id, catering_restaurant_id, name, address, city, state, zip_code, phone, is_active")
    .eq("catering_restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("name")

  if (branchesError) {
    return NextResponse.json(
      { error: `Failed to fetch branches: ${branchesError.message}` },
      { status: 500 }
    )
  }

  if (!branches) {
    return NextResponse.json(
      { error: "Failed to fetch branches: no data returned" },
      { status: 500 }
    )
  }

  // Fetch service packages
  const { data: servicePackages, error: packagesError } = await supabase
    .from("catering_service_packages")
    .select("id, catering_restaurant_id, name, description, base_price, image_url, is_active, display_order")
    .eq("catering_restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("display_order")

  if (packagesError) {
    return NextResponse.json(
      { error: `Failed to fetch service packages: ${packagesError.message}` },
      { status: 500 }
    )
  }

  if (!servicePackages) {
    return NextResponse.json(
      { error: "Failed to fetch service packages: no data returned" },
      { status: 500 }
    )
  }

  // Fetch categories (note: catering_categories does not have a description column)
  const { data: categories, error: categoriesError } = await supabase
    .from("catering_categories")
    .select("id, catering_restaurant_id, name, display_order, is_active")
    .eq("catering_restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("display_order")

  if (categoriesError) {
    return NextResponse.json(
      { error: `Failed to fetch categories: ${categoriesError.message}` },
      { status: 500 }
    )
  }

  if (!categories) {
    return NextResponse.json(
      { error: "Failed to fetch categories: no data returned" },
      { status: 500 }
    )
  }

  // Fetch menu items
  const { data: menuItems, error: menuItemsError } = await supabase
    .from("catering_menu_items")
    .select("id, catering_restaurant_id, catering_category_id, name, description, price, selling_unit, image_url, is_active, display_order")
    .eq("catering_restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("display_order")

  if (menuItemsError) {
    return NextResponse.json(
      { error: `Failed to fetch menu items: ${menuItemsError.message}` },
      { status: 500 }
    )
  }

  if (!menuItems) {
    return NextResponse.json(
      { error: "Failed to fetch menu items: no data returned" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    branches,
    servicePackages,
    categories,
    menuItems,
  })
}
