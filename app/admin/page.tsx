import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function AdminRedirectPage() {
  const supabase = await createClient()
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    // Not logged in - redirect to main login
    redirect("/login")
  }
  
  // Check user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin, restaurant_id")
    .eq("id", user.id)
    .single()
  
  if (profile?.is_super_admin) {
    // Super admin - go to super admin dashboard
    redirect("/super-admin")
  }
  
  if (profile?.restaurant_id) {
    // Regular admin - get the restaurant slug and redirect
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("id", profile.restaurant_id)
      .single()
    
    if (restaurant?.slug) {
      redirect(`/${restaurant.slug}/admin`)
    }
  }
  
  // Fallback - redirect to home
  redirect("/")
}
