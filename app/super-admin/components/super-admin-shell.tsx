"use client"

import { useRouter } from "next/navigation"
import { SuperAdminSidebar } from "./super-admin-sidebar"

export function SuperAdminShell({
  title,
  activeTab,
  children,
}: {
  title: string
  activeTab: string
  children: React.ReactNode
}) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <SuperAdminSidebar
        activeTab={activeTab}
        onTabChange={() => {
          // Tabs without href only work inside /super-admin/delivery; route there.
          router.push("/super-admin/delivery")
        }}
      />

      <div className="md:ml-64 min-h-screen transition-all duration-300">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="md:hidden w-10" />
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <div />
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-8">{children}</main>
      </div>
    </div>
  )
}

