import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CustomerAuthForm } from "@/components/customer-auth-form"

export default async function CustomerAuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ mode?: string; redirect?: string }>
}) {
  const { slug } = await params
  const { mode, redirect: redirectPath } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If already logged in, redirect
  if (user) {
    if (redirectPath === "checkout") {
      // Phase 2: send authed users straight to checkout (Uber/DoorDash style),
      // not back to the menu. Cart is preserved in localStorage by slug/id.
      redirect(`/${slug}/checkout`)
    } else {
      redirect(`/${slug}/${redirectPath || ""}`)
    }
  }

  // Get restaurant details for branding
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name, logo_url, primary_color")
    .eq("slug", slug)
    .single()

  if (!restaurant) {
    redirect("/")
  }

  return <CustomerAuthForm restaurant={restaurant} slug={slug} initialMode={mode} redirectPath={redirectPath} />
}
