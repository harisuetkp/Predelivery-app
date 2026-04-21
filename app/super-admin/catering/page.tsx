import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import {
  UtensilsCrossed, Plus, ArrowLeft, ChevronRight,
  MapPin, ShoppingBag, Building2, Calendar,
  Globe, BarChart2, Settings
} from "lucide-react"
import { NewCateringPortalButton } from "./new-catering-portal-button"
import { CateringOperationsTab } from "./components/catering-operations-tab"

export const dynamic = "force-dynamic"

export default async function SuperAdminCateringPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: operator } = await supabase
    .from("operators")
    .select("*")
    .eq("slug", "foodnetpr")
    .single()

  if (!operator) redirect("/auth/login")
  if (!operator.catering_enabled) redirect("/super-admin")

  const resolvedSearchParams = await searchParams
  const activeTab = resolvedSearchParams?.tab || "portales"

  const { data: cateringRestaurants, error } = await supabase
    .from("catering_restaurants")
    .select("id, name, slug, is_active, is_manually_blocked, logo_url, hero_image_url, primary_color")
    .eq("operator_id", operator.id)
    .order("name", { ascending: true })

  if (error) throw new Error(`Failed to load catering portals: ${error.message}`)

  const { data: branchCounts } = await supabase
    .from("catering_branches")
    .select("catering_restaurant_id")

  const { data: orderCounts } = await supabase
    .from("catering_orders")
    .select("catering_restaurant_id, total")
    .eq("operator_id", operator.id)

  const branchCountMap: Record<string, number> = {}
  branchCounts?.forEach((b) => {
    branchCountMap[b.catering_restaurant_id] =
      (branchCountMap[b.catering_restaurant_id] || 0) + 1
  })

  const orderCountMap: Record<string, number> = {}
  const revenueMap: Record<string, number> = {}
  orderCounts?.forEach((o) => {
    orderCountMap[o.catering_restaurant_id] =
      (orderCountMap[o.catering_restaurant_id] || 0) + 1
    revenueMap[o.catering_restaurant_id] =
      (revenueMap[o.catering_restaurant_id] || 0) + (Number(o.total) || 0)
  })

  const portals = (cateringRestaurants || []).map((r) => ({
    ...r,
    branch_count: branchCountMap[r.id] || 0,
    order_count: orderCountMap[r.id] || 0,
    revenue: revenueMap[r.id] || 0,
  }))

  const { data: cateringSettings } = await supabase
    .from("platform_settings")
    .select("*")
    .eq("tent", "catering")
    .eq("operator_id", operator.id)
    .single()

  const { data: cateringBlocks } = await supabase
    .from("scheduled_blocks")
    .select("*")
    .eq("tent", "catering")
    .eq("is_active", true)
    .order("starts_at", { ascending: true })

  const tabs = [
    { key: "portales", label: "Portales", icon: <Building2 className="w-4 h-4" /> },
    { key: "ordenes", label: "Órdenes", icon: <ShoppingBag className="w-4 h-4" /> },
    { key: "operations", label: "Operations", icon: <Settings className="w-4 h-4" /> },
    { key: "marketplace", label: "Marketplace", icon: <Globe className="w-4 h-4" /> },
    { key: "zonas", label: "Zonas de Entrega", icon: <MapPin className="w-4 h-4" /> },
    { key: "calendario", label: "Calendario", icon: <Calendar className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/super-admin"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="p-2 bg-orange-500 rounded-lg">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Catering</h1>
              <p className="text-xs text-gray-500">{operator.name}</p>
            </div>
          </div>
          <Link
            href="/catering"
            target="_blank"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Ver Marketplace →
          </Link>
        </div>

        {/* Top nav tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1 border-t border-gray-100">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={`/super-admin/catering?tab=${tab.key}`}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </Link>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* PORTALES TAB */}
        {activeTab === "portales" && (
          <div className="space-y-8">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Portales", value: portals.length, icon: <Building2 className="w-5 h-5 text-orange-500" /> },
                { label: "Sucursales", value: portals.reduce((s, p) => s + p.branch_count, 0), icon: <MapPin className="w-5 h-5 text-orange-500" /> },
                { label: "Órdenes Totales", value: portals.reduce((s, p) => s + p.order_count, 0), icon: <ShoppingBag className="w-5 h-5 text-orange-500" /> },
                {
                  label: "Revenue Total",
                  value: `$${portals.reduce((s, p) => s + p.revenue, 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  icon: <BarChart2 className="w-5 h-5 text-orange-500" />
                },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                  <div className="p-2 bg-orange-50 rounded-lg">{stat.icon}</div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Portal grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Portales de Catering ({portals.length})
                </h2>
                <NewCateringPortalButton />
              </div>

              {portals.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                  <UtensilsCrossed className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">No hay portales de catering</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {portals.map((portal) => (
                    <div
                      key={portal.id}
                      className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-orange-300 hover:shadow-md transition-all"
                    >
                      {portal.hero_image_url ? (
                        <div className="h-32 overflow-hidden">
                          <img src={portal.hero_image_url} alt={portal.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-32 flex items-center justify-center" style={{ backgroundColor: portal.primary_color || "#f97316" }}>
                          <UtensilsCrossed className="w-10 h-10 text-white opacity-50" />
                        </div>
                      )}
                      <div className="p-5">
                        <div className="flex items-center gap-3 mb-4">
                          {portal.logo_url ? (
                            <img src={portal.logo_url} alt={portal.name} className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: portal.primary_color || "#f97316" }}>
                              {portal.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <h3 className="font-bold text-gray-900">{portal.name}</h3>
                            <p className="text-xs text-gray-400">/{portal.slug}</p>
                          </div>
                          <div className="ml-auto">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${portal.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                              {portal.is_active ? "Activo" : "Inactivo"}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-5">
                          {[
                            { label: "Sucursales", value: portal.branch_count },
                            { label: "Órdenes", value: portal.order_count },
                            { label: "Revenue", value: `$${portal.revenue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
                          ].map((stat) => (
                            <div key={stat.label} className="text-center p-2 bg-gray-50 rounded-lg">
                              <p className="text-sm font-bold text-gray-900">{stat.value}</p>
                              <p className="text-[10px] text-gray-400">{stat.label}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Link
                            href={`/catering/${portal.slug}/admin`}
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors"
                          >
                            Administrar <ChevronRight className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/catering/${portal.slug}`}
                            target="_blank"
                            className="py-2 px-3 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:border-gray-300 transition-colors"
                          >
                            Ver →
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ORDENES TAB */}
        {activeTab === "ordenes" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Vista de órdenes de catering</p>
            <p className="text-sm text-gray-400 mt-1">Próximamente — todas las órdenes de todos los portales en una vista unificada.</p>
          </div>
        )}

        {/* OPERATIONS TAB */}
        {activeTab === "operations" && cateringSettings && (
          <CateringOperationsTab
            portals={portals}
            platformSettings={cateringSettings}
            scheduledBlocks={cateringBlocks || []}
            operatorName={operator.name}
          />
        )}

        {/* MARKETPLACE TAB */}
        {activeTab === "marketplace" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Configuración del Marketplace</p>
            <p className="text-sm text-gray-400 mt-1">Próximamente — visibilidad, orden y destacados en el marketplace de catering.</p>
          </div>
        )}

        {/* ZONAS TAB */}
        {activeTab === "zonas" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Zonas de Entrega</p>
            <p className="text-sm text-gray-400 mt-1">Próximamente — configuración de zonas de entrega para catering.</p>
          </div>
        )}

        {/* CALENDARIO TAB */}
        {activeTab === "calendario" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Calendario de Eventos</p>
            <p className="text-sm text-gray-400 mt-1">Próximamente — vista de calendario con todos los eventos de catering programados.</p>
          </div>
        )}

      </main>
    </div>
  )
}
