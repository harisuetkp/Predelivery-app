import { notFound } from "next/navigation"
import { headers } from "next/headers"
import {
  getCateringRestaurantBySlug,
  getCateringRestaurantById,
  getCateringRestaurantFullData,
} from "@/lib/catering"
import { createClient } from "@/lib/supabase/server"
import CateringBranchSelectorPage from "@/components/catering-branch-selector-page"
import CateringMenu from "@/components/catering/catering-menu"
import { FBViewContent } from "@/components/fb-view-content"

export default async function CateringRestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ branch?: string }>
}) {
  const { slug } = await params
  const { branch: branchParam } = await searchParams
  const headersList = await headers()
  
  // Check if request is coming from custom domain (set by middleware)
  const cateringRestaurantId = headersList.get("x-catering-restaurant-id")
  const customDomain = headersList.get("x-custom-domain")
  const isCustomDomain = !!customDomain

  // Fetch restaurant - use ID if provided by middleware, otherwise lookup by slug
  let restaurant
  if (cateringRestaurantId) {
    restaurant = await getCateringRestaurantById(cateringRestaurantId)
  } else {
    restaurant = await getCateringRestaurantBySlug(slug)
  }

  if (!restaurant) {
    notFound()
  }

  // Fetch all restaurant data
  const { categories, menuItems, branches, servicePackages, deliveryZones } =
    await getCateringRestaurantFullData(restaurant.id)

  // Fetch operating hours for catering restaurant
  const supabase = await createClient()
  const { data: operatingHours } = await supabase
    .from("catering_operating_hours")
    .select("*")
    .eq("catering_restaurant_id", restaurant.id)

  // Fetch container rates for catering delivery fee calculation
  const { data: containerRates } = await supabase
    .from("catering_container_fees")
    .select("*")
    .eq("catering_restaurant_id", restaurant.id)

  if (restaurant.is_chain) {
    if (!branchParam) {
      return (
        <CateringBranchSelectorPage
          restaurant={restaurant}
          branches={branches}
          slug={slug}
        />
      )
    }
    const selectedBranch = branches.find((b) => b.id === branchParam)
    if (!selectedBranch) {
      throw new Error(`Branch not found: ${branchParam}`)
    }
  }

  return (
    <>
      {/* Facebook Pixel: ViewContent fires on every catering storefront view */}
      <FBViewContent />
      <CateringMenu
        restaurant={restaurant}
        categories={categories}
        menuItems={menuItems}
        branches={branches}
        servicePackages={servicePackages}
        selectedBranchId={branchParam || null}
        isCustomDomain={isCustomDomain}
      />
    </>
  )
}
