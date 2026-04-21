import { redirect } from "next/navigation"

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { redirect?: string }
}) {
  const redirectTo = searchParams.redirect
  const targetUrl = redirectTo 
    ? `/auth/customer/signup?redirect=${encodeURIComponent(redirectTo)}`
    : "/auth/customer/signup"
  
  redirect(targetUrl)
}
