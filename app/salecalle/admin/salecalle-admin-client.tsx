"use client"

import { useState, useTransition } from "react"
import {
  Plus, X, Loader2, Building2, Truck,
  UtensilsCrossed, Package, Globe, Phone,
  Mail, CheckCircle, XCircle, ChevronRight, ShieldCheck
} from "lucide-react"
import { createOperator, updateOperatorTents, updateOperatorStatus } from "./actions"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

interface OperatorWithStats {
  id: string
  name: string | null
  slug: string
  domain: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  delivery_enabled: boolean
  catering_enabled: boolean
  subscription_enabled: boolean
  is_active: boolean
  primary_color: string | null
  onboarded_at: string | null
  bilingual: boolean
  default_language: string
  notes: string | null
  stats: {
    restaurants: number
    cateringPortals: number
    orders: number
    cateringOrders: number
    deliveryRevenue: number
    cateringRevenue: number
  }
}

interface Props {
  operators: OperatorWithStats[]
}

export function SaleCalleAdminClient({ operators: initialOperators }: Props) {
  const [operators, setOperators] = useState(initialOperators)
  const [showNewModal, setShowNewModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)

  const [editingOperator, setEditingOperator] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [editPending, startEditTransition] = useTransition()
  const [editError, setEditError] = useState<string | null>(null)

  function handleNameChange(val: string) {
    setName(val)
    if (!slugEdited) setSlug(slugify(val))
  }

  function handleCloseNew() {
    setShowNewModal(false)
    setError(null)
    setName("")
    setSlug("")
    setSlugEdited(false)
  }

  function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        const newOp = await createOperator(formData)
        setOperators((prev) => [...prev, {
          ...newOp,
          stats: { restaurants: 0, cateringPortals: 0, orders: 0, cateringOrders: 0, deliveryRevenue: 0, cateringRevenue: 0 }
        }])
        handleCloseNew()
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  async function handleTentToggle(
    operatorId: string,
    tent: "delivery_enabled" | "catering_enabled" | "subscription_enabled",
    value: boolean
  ) {
    const op = operators.find((o) => o.id === operatorId)
    if (!op) return
    const updated = {
      delivery_enabled: op.delivery_enabled,
      catering_enabled: op.catering_enabled,
      subscription_enabled: op.subscription_enabled,
      [tent]: value,
    }
    setOperators((prev) => prev.map((o) => o.id === operatorId ? { ...o, [tent]: value } : o))
    try {
      await updateOperatorTents(operatorId, updated)
    } catch (err: any) {
      setOperators((prev) => prev.map((o) => o.id === operatorId ? { ...o, [tent]: !value } : o))
      alert(err.message)
    }
  }

  async function handleStatusToggle(operatorId: string, is_active: boolean) {
    setOperators((prev) => prev.map((o) => o.id === operatorId ? { ...o, is_active } : o))
    try {
      await updateOperatorStatus(operatorId, is_active)
    } catch (err: any) {
      setOperators((prev) => prev.map((o) => o.id === operatorId ? { ...o, is_active: !is_active } : o))
      alert(err.message)
    }
  }

  const tents = [
    { key: "delivery_enabled" as const, label: "Delivery", icon: <Truck className="w-3.5 h-3.5" />, color: "bg-blue-500" },
    { key: "catering_enabled" as const, label: "Catering", icon: <UtensilsCrossed className="w-3.5 h-3.5" />, color: "bg-orange-500" },
    { key: "subscription_enabled" as const, label: "Subs", icon: <Package className="w-3.5 h-3.5" />, color: "bg-purple-500" },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg">
              <ShieldCheck className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">SaleCalle</h1>
              <p className="text-xs text-slate-400">Master Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-400">Operadores activos</p>
              <p className="text-lg font-bold text-white">{operators.filter((o) => o.is_active).length}</p>
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo Operador
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Operadores */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{operators.length}</p>
            <p className="text-xs text-slate-400 mt-1">Operadores</p>
          </div>
          {/* Total Restaurants - delivery + catering */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">
              {operators.reduce((s, o) => s + o.stats.restaurants + o.stats.cateringPortals, 0)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Restaurantes
              <span className="block text-slate-500">
                {operators.reduce((s, o) => s + o.stats.restaurants, 0)} delivery · {operators.reduce((s, o) => s + o.stats.cateringPortals, 0)} catering
              </span>
            </p>
          </div>
          {/* Total Orders - delivery + catering */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">
              {operators.reduce((s, o) => s + o.stats.orders + o.stats.cateringOrders, 0)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Ordenes Totales
              <span className="block text-slate-500">
                {operators.reduce((s, o) => s + o.stats.orders, 0)} delivery · {operators.reduce((s, o) => s + o.stats.cateringOrders, 0)} catering
              </span>
            </p>
          </div>
          {/* Total Revenue - delivery + catering */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">
              ${operators.reduce((s, o) => s + o.stats.deliveryRevenue + o.stats.cateringRevenue, 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Revenue Total
              <span className="block text-slate-500">
                ${operators.reduce((s, o) => s + o.stats.deliveryRevenue, 0).toLocaleString()} del. · ${operators.reduce((s, o) => s + o.stats.cateringRevenue, 0).toLocaleString()} cat.
              </span>
            </p>
          </div>
          {/* Subscriptions placeholder */}
          {/* TODO: Track 3 - wire subscription stats */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-slate-500">0</p>
            <p className="text-xs text-slate-400 mt-1">Suscripciones</p>
          </div>
          {/* Active percentage */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">
              {operators.length > 0 ? Math.round((operators.filter(o => o.is_active).length / operators.length) * 100) : 0}%
            </p>
            <p className="text-xs text-slate-400 mt-1">Operadores Activos</p>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Operadores ({operators.length})
          </h2>
          <div className="space-y-3">
            {operators.map((op) => (
              <div
                key={op.id}
                className={`bg-slate-900 border rounded-2xl p-5 transition-all ${
                  op.is_active ? "border-slate-700" : "border-slate-800 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: op.primary_color || "#6366f1" }}
                    >
                      {(op.name || op.slug).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white">{op.name || op.slug}</h3>
                        <span className="text-xs text-slate-500">/{op.slug}</span>
                        {!op.is_active && (
                          <span className="text-xs px-2 py-0.5 bg-red-900/50 text-red-400 rounded-full">Suspendido</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {op.domain && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Globe className="w-3 h-3" />{op.domain}
                          </span>
                        )}
                        {op.contact_email && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Mail className="w-3 h-3" />{op.contact_email}
                          </span>
                        )}
                        {op.contact_phone && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Phone className="w-3 h-3" />{op.contact_phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditingOperator(op)
                        setEditForm({
                          name: op.name || "",
                          domain: op.domain || "",
                          contact_name: op.contact_name || "",
                          contact_email: op.contact_email || "",
                          contact_phone: op.contact_phone || "",
                          primary_color: op.primary_color || "#6366f1",
                          notes: op.notes || "",
                        })
                        setEditError(null)
                      }}
                      className="text-xs px-3 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg font-medium transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleStatusToggle(op.id, !op.is_active)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        op.is_active
                          ? "bg-slate-800 text-slate-300 hover:bg-red-900/40 hover:text-red-400"
                          : "bg-slate-800 text-slate-400 hover:bg-green-900/40 hover:text-green-400"
                      }`}
                    >
                      {op.is_active ? "Suspender" : "Activar"}
                    </button>
                    <a
                      href={`/super-admin`}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg font-medium transition-colors"
                    >
                      Entrar <ChevronRight className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-slate-500">Modulos:</span>
                  {tents.map((tent) => {
                    const enabled = op[tent.key]
                    return (
                      <button
                        key={tent.key}
                        onClick={() => handleTentToggle(op.id, tent.key, !enabled)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          enabled
                            ? `${tent.color} text-white`
                            : "bg-slate-800 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {tent.icon}
                        {tent.label}
                        {enabled
                          ? <CheckCircle className="w-3 h-3 ml-0.5" />
                          : <XCircle className="w-3 h-3 ml-0.5" />
                        }
                      </button>
                    )
                  })}
                  <div className="ml-auto flex items-center gap-4">
                    {op.delivery_enabled && (
                      <span className="text-xs text-slate-400">
                        <span className="text-white font-semibold">{op.stats.restaurants}</span> rest.
                      </span>
                    )}
                    {op.catering_enabled && (
                      <span className="text-xs text-slate-400">
                        <span className="text-white font-semibold">{op.stats.cateringPortals}</span> portales
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      <span className="text-white font-semibold">{op.stats.orders + op.stats.cateringOrders}</span> ordenes
                    </span>
                    <span className="text-xs text-slate-400">
                      <span className="text-green-400 font-semibold">${(op.stats.deliveryRevenue + op.stats.cateringRevenue).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </span>
                  </div>
                </div>

                {op.notes && (
                  <p className="mt-3 text-xs text-slate-500 border-t border-slate-800 pt-3">{op.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-bold text-white">Nuevo Operador</h2>
              <button onClick={handleCloseNew} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-5">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Identidad</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
                    <input
                      name="name"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Ej: BigBite Orlando"
                      required
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Slug *</label>
                    <input
                      name="slug"
                      value={slug}
                      onChange={(e) => { setSlugEdited(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")) }}
                      placeholder="bigbite-orlando"
                      required
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                    <p className="text-xs text-slate-500 mt-1">Admin URL: /super-admin (shared per deployment)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Dominio</label>
                      <input name="domain" placeholder="bigbite.com" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Color de Marca</label>
                      <input type="color" name="primary_color" defaultValue="#6366f1" className="h-9 w-full rounded border border-slate-600 cursor-pointer bg-slate-800" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contacto</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nombre del Contacto</label>
                    <input name="contact_name" placeholder="Nombre completo" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                      <input name="contact_email" type="email" placeholder="admin@operador.com" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Telefono</label>
                      <input name="contact_phone" placeholder="787-000-0000" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Modulos Contratados</p>
                <div className="space-y-2">
                  {[
                    { key: "delivery_enabled", label: "Online Ordering", desc: "$149/mo + $0.45/orden", icon: <Truck className="w-4 h-4" />, color: "text-blue-400" },
                    { key: "catering_enabled", label: "Catering", desc: "$99/mo + 4.7% por transaccion", icon: <UtensilsCrossed className="w-4 h-4" />, color: "text-orange-400" },
                    { key: "subscription_enabled", label: "Subscriptions", desc: "$149/mo + $0.35/comida", icon: <Package className="w-4 h-4" />, color: "text-purple-400" },
                  ].map((tent) => (
                    <label key={tent.key} className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl cursor-pointer transition-colors">
                      <input type="checkbox" name={tent.key} value="true" className="h-4 w-4 rounded" />
                      <span className={tent.color}>{tent.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{tent.label}</p>
                        <p className="text-xs text-slate-400">{tent.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Configuracion</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Idioma Principal</label>
                    <select name="default_language" defaultValue="es" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20">
                      <option value="es">Espanol</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl cursor-pointer">
                    <input type="checkbox" name="bilingual" value="true" className="h-4 w-4 rounded" />
                    <div>
                      <p className="text-sm font-medium text-white">Bilingue (ES/EN)</p>
                      <p className="text-xs text-slate-400">Portal disponible en espanol e ingles</p>
                    </div>
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Notas Internas</label>
                    <textarea name="notes" rows={2} placeholder="Notas sobre este operador..." className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20" />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseNew} className="flex-1 py-2.5 border border-slate-600 text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name || !slug}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-sm font-semibold rounded-xl transition-colors"
                >
                  {isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Creando...</> : "Crear Operador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingOperator && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-bold text-white">Editar Operador</h2>
              <button onClick={() => setEditingOperator(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Identidad</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nombre</label>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Dominio</label>
                      <input
                        value={editForm.domain}
                        onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                        placeholder="prdelivery.com"
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Color de Marca</label>
                      <input
                        type="color"
                        value={editForm.primary_color}
                        onChange={(e) => setEditForm({ ...editForm, primary_color: e.target.value })}
                        className="h-9 w-full rounded border border-slate-600 cursor-pointer bg-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contacto</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nombre del Contacto</label>
                    <input
                      value={editForm.contact_name}
                      onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.contact_email}
                        onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Telefono</label>
                      <input
                        value={editForm.contact_phone}
                        onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                        placeholder="787-000-0000"
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notas Internas</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
              {editError && (
                <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg">
                  <p className="text-sm text-red-400">{editError}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingOperator(null)}
                  className="flex-1 py-2.5 border border-slate-600 text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    startEditTransition(async () => {
                      try {
                        const res = await fetch(`/api/operators/${editingOperator.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(editForm),
                        })
                        if (!res.ok) throw new Error("Error guardando")
                        setOperators(prev => prev.map(o =>
                          o.id === editingOperator.id ? { ...o, ...editForm } : o
                        ))
                        setEditingOperator(null)
                      } catch (err: any) {
                        setEditError(err.message)
                      }
                    })
                  }}
                  disabled={editPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-900 text-sm font-semibold rounded-xl transition-colors"
                >
                  {editPending ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
