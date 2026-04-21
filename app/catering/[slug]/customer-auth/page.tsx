import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CustomerAuthForm } from "@/components/customer-auth-form"

export default async function CateringCustomerAuthPage({
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

  if (user) {
    if (redirectPath === "catering-checkout") {
      redirect(`/catering/${slug}?redirect=catering-checkout`)
    }
    redirect(`/catering/${slug}`)
  }

  const { data: restaurant } = await supabase
    .from("catering_restaurants")
    .select("name, logo_url, primary_color")
    .eq("slug", slug)
    .single()

  if (!restaurant) {
    redirect("/")
  }

  return <CustomerAuthForm restaurant={restaurant} slug={slug} initialMode={mode} redirectPath={redirectPath} />
}
