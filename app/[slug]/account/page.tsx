import { redirect } from "next/navigation"

// Mi Cuenta is always platform-wide so customers see orders from every restaurant
// in one place. The old per-restaurant /{slug}/account page showed a scoped history
// that was always near-empty and confused customers. Any surviving link or bookmark
// just forwards to the main /account page, which handles its own auth redirect.
export default async function AccountPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  // Consume the param so Next doesn't warn about an unused dynamic segment.
  await params
  redirect("/account")
}
