import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import {
  Truck, UtensilsCrossed, Package, Settings,
  Monitor, Phone, FileText, ChevronRight,
  Building2, TrendingUp, Users, Megaphone, Gift, Mail, LayoutTemplate, Clock
} from "lucide-react"

export const dynamic = "force-dynamic"

export default async function SuperAdminLandingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Get operator data
  const { data: operator } = await supabase
    .from("operators")
    .select("*")
    .eq("slug", "foodnetpr")
    .single()

  if (!operator) redirect("/auth/login")

  // Get counts for each tent
  const [
    { count: restaurantCount },
    { count: orderCount },
    { count: cateringCount },
    { count: cateringOrderCount },
  ] = await Promise.all([
    supabase.from("restaurants").select("*", { count: "exact", head: true })
      .eq("operator_id", operator.id),
    supabase.from("orders").select("*", { count: "exact", head: true })
      .eq("operator_id", operator.id),
    supabase.from("catering_restaurants").select("*", { count: "exact", head: true })
      .eq("operator_id", operator.id),
    supabase.from("catering_orders").select("*", { count: "exact", head: true })
      .eq("operator_id", operator.id),
  ])

  const tents = [
    {
      id: "delivery",
      label: "Online Ordering",
      icon: <Truck className="w-8 h-8" />,
      color: "bg-blue-600",
      lightColor: "bg-blue-50 border-blue-200",
      textColor: "text-blue-600",
      href: "/super-admin/delivery",
      enabled: operator.delivery_enabled,
      stats: [
        { label: "Restaurantes", value: restaurantCount ?? 0 },
        { label: "Órdenes", value: orderCount ?? 0 },
      ],
      description: "Gestiona restaurantes, menús, zonas de entrega y órdenes de delivery.",
    },
    {
      id: "catering",
      label: "Catering",
      icon: <UtensilsCrossed className="w-8 h-8" />,
      color: "bg-orange-500",
      lightColor: "bg-orange-50 border-orange-200",
      textColor: "text-orange-500",
      href: "/super-admin/catering",
      enabled: operator.catering_enabled,
      stats: [
        { label: "Portales", value: cateringCount ?? 0 },
        { label: "Órdenes", value: cateringOrderCount ?? 0 },
      ],
      description: "Gestiona portales de catering, menús, sucursales y órdenes de eventos.",
    },
    {
      id: "subscriptions",
      label: "Subscriptions",
      icon: <Package className="w-8 h-8" />,
      color: "bg-purple-600",
      lightColor: "bg-purple-50 border-purple-200",
      textColor: "text-purple-600",
      href: "/super-admin/subscriptions",
      enabled: operator.subscription_enabled,
      stats: [
        { label: "Planes", value: 0 },
        { label: "Suscriptores", value: 0 },
      ],
      description: "Gestiona planes de suscripción, comidas y entregas recurrentes.",
    },
  ]

  const sharedTools = [
    { label: "KDS (Cocina)", icon: <Monitor className="w-5 h-5" />, href: "/super-admin/kds", color: "text-slate-700" },
    { label: "CSR Portal", icon: <Phone className="w-5 h-5" />, href: "/csr", color: "text-rose-600" },
    { label: "Reports", icon: <TrendingUp className="w-5 h-5" />, href: "/super-admin/reports", color: "text-slate-700" },
    { label: "Admin Users", icon: <Users className="w-5 h-5" />, href: "/super-admin/admin-users", color: "text-slate-700" },
    { label: "Tipos de Cocina", icon: <UtensilsCrossed className="w-5 h-5" />, href: "/super-admin/cuisine-types", color: "text-slate-700" },
    { label: "Marketing & Sales", icon: <Megaphone className="w-5 h-5" />, href: "/super-admin/marketing", color: "text-purple-600" },
    { label: "Diseños de Landing", icon: <LayoutTemplate className="w-5 h-5" />, href: "/super-admin/landing-design", color: "text-indigo-600" },
    { label: "Pop-up Promocionales", icon: <Gift className="w-5 h-5" />, href: "/super-admin/popups", color: "text-amber-600" },
    { label: "Comunicaciones", icon: <Mail className="w-5 h-5" />, href: "/super-admin/communications", color: "text-slate-700" },
    { label: "Zona Horaria", icon: <Clock className="w-5 h-5" />, href: "/super-admin/timezone", color: "text-slate-700" },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-lg">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{operator.name ?? "FoodNetPR"}</h1>
              <p className="text-xs text-gray-500">Panel de Administración</p>
            </div>
          </div>
          <a
            href="/auth/logout"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cerrar sesión
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">

        {/* Tent Cards */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Módulos Activos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tents.map((tent) => (
              <div
                key={tent.id}
                className={`relative rounded-2xl border-2 bg-white overflow-hidden transition-all ${
                  tent.enabled
                    ? "border-gray-200 hover:border-gray-300 hover:shadow-md"
                    : "border-gray-100 opacity-50"
                }`}
              >
                {/* Top color bar */}
                <div className={`h-1.5 w-full ${tent.color}`} />

                <div className="p-6">
                  {/* Icon + label */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${tent.lightColor} border`}>
                      <span className={tent.textColor}>{tent.icon}</span>
                    </div>
                    {!tent.enabled && (
                      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                        No contratado
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-1">{tent.label}</h3>
                  <p className="text-sm text-gray-500 mb-5">{tent.description}</p>

                  {/* Stats */}
                  <div className="flex gap-4 mb-6">
                    {tent.stats.map((stat) => (
                      <div key={stat.label}>
                        <p className={`text-2xl font-bold ${tent.textColor}`}>{stat.value}</p>
                        <p className="text-xs text-gray-400">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  {tent.enabled ? (
                    <Link
                      href={tent.href}
                      className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 ${tent.color}`}
                    >
                      Entrar
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gray-100 text-gray-400 text-sm font-semibold cursor-not-allowed"
                    >
                      No disponible
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Shared Tools */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Herramientas Compartidas
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {sharedTools.map((tool) => (
              <Link
                key={tool.label}
                href={tool.href}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <span className={tool.color}>{tool.icon}</span>
                <span className="text-sm font-medium text-gray-700">{tool.label}</span>
                <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
              </Link>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}
