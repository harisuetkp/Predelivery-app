import type React from "react"
import { notFound } from "next/navigation"
import { getCateringRestaurantBySlug } from "@/lib/catering"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const restaurant = await getCateringRestaurantBySlug(slug)

  if (!restaurant) {
    return { title: "Restaurante No Encontrado" }
  }

  return {
    title: `${restaurant.name} | Catering`,
    description: restaurant.description || `Ordena catering de ${restaurant.name}`,
    icons: restaurant.logo_url ? [{ rel: "icon", url: restaurant.logo_url }] : undefined,
    openGraph: {
      title: `${restaurant.name} | Catering`,
      description: restaurant.description || `Ordena catering de ${restaurant.name}`,
      ...(restaurant.hero_image_url ? { images: [{ url: restaurant.hero_image_url }] } : {}),
    },
  }
}

export default async function CateringRestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Validate restaurant exists and is active for catering
  const restaurant = await getCateringRestaurantBySlug(slug)

  if (!restaurant) {
    notFound()
  }

  return <>{children}</>
}
