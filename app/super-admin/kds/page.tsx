import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Monitor } from "lucide-react"
import { KDSTab } from "../components/kds-tab"

export const dynamic = "force-dynamic"

export default async function KDSPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: adminRecord } = await supabase
    .from("admin_users")
    .select("role")
    .eq("auth_user_id", user.id)
    .single()

  if (!adminRecord || !["super_admin", "manager"].includes(adminRecord.role)) {
    redirect("/super-admin")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            href="/super-admin"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-2 bg-slate-900 rounded-lg">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">KDS (Cocina)</h1>
            <p className="text-xs text-gray-500">Kitchen Display System</p>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <KDSTab />
      </div>
    </div>
  )
}
