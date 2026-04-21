import type React from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Mi Cuenta | FoodNetDelivery",
  description: "Administra tu cuenta, pedidos, direcciones y metodos de pago",
}

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/customer/login?redirect=/account")
  }

  return <>{children}</>
}
