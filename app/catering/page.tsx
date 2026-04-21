import { getCateringRestaurants } from "@/lib/catering"
import { JunteReadyHome } from "@/components/junteready-home"

export const metadata = {
  title: "JunteReady | Catering para Tu Evento",
  description: "Encuentra el catering perfecto para tu boda, fiesta, evento corporativo o cualquier celebración en Puerto Rico.",
}

export default async function CateringMarketplacePage() {
  // Fetch all active catering restaurants
  let restaurants = []
  try {
    restaurants = await getCateringRestaurants()
  } catch (error) {
    // If no restaurants found, show empty state
    console.error("Error fetching catering restaurants:", error)
  }

  return <JunteReadyHome restaurants={restaurants} />
}
