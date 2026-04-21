"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  ArrowLeft, Plus, X, Loader2, Users,
  Eye, EyeOff, Copy, RefreshCw, Pencil,
  Truck, UtensilsCrossed, Package, Shield
} from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"

const ROLES = [
  { value: "manager", label: "Manager", desc: "Full operator access" },
  { value: "dispatcher", label: "Dispatcher", desc: "Orders + menus" },
  { value: "menu_entry", label: "Menu Entry", desc: "Menus only" },
  { value: "restaurant_admin", label: "Restaurant Admin", desc: "Single restaurant" },
]

const TENT_ROLES = [
  { value: "manager", label: "Manager" },
  { value: "dispatcher", label: "Dispatcher" },
  { value: "menu_entry", label: "Menu Entry" },
]

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%"
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

interface Props {
  operator: any
  adminUsers: any[]
  restaurants: any[]
  cateringRestaurants: any[]
  currentUserRole: string
}

export function AdminUsersClient({ operator, adminUsers: initialUsers, restaurants, cateringRestaurants, currentUserRole }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const supabase = createBrowserClient()

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: generatePassword(),
    role: "dispatcher",
    restaurant_id: "",
    restaurant_tent: "" as "" | "delivery" | "catering",
    tent_permissions: {} as Record<string, string>,
  })

  const tents = [
    { key: "delivery", label: "Online Ordering", icon: <Truck className="w-4 h-4" />, color: "text-blue-600", enabled: operator.delivery_enabled },
    { key: "catering", label: "Catering", icon: <UtensilsCrossed className="w-4 h-4" />, color: "text-orange-500", enabled: operator.catering_enabled },
    { key: "subscriptions", label: "Subscriptions", icon: <Package className="w-4 h-4" />, color: "text-purple-500", enabled: operator.subscription_enabled },
  ]

  function handleOpen(user?: any) {
    if (user) {
      setEditingUser(user)
      setForm({
        username: user.username || "",
        email: user.email || "",
        password: "",
        role: user.role || "dispatcher",
        restaurant_id: user.restaurant_id || "",
        restaurant_tent: user.restaurant_tent || "",
        tent_permissions: user.tent_permissions || {},
      })
    } else {
      setEditingUser(null)
      setForm({
        username: "",
        email: "",
        password: generatePassword(),
        role: "dispatcher",
        restaurant_id: "",
        restaurant_tent: "",
        tent_permissions: {},
      })
    }
    setError(null)
    setShowModal(true)
  }

  function handleClose() {
    setShowModal(false)
    setEditingUser(null)
    setError(null)
  }

  function toggleTent(tentKey: string, checked: boolean) {
    const updated = { ...form.tent_permissions }
    if (checked) {
      updated[tentKey] = "dispatcher"
    } else {
      delete updated[tentKey]
    }
    setForm({ ...form, tent_permissions: updated })
  }

  function setTentRole(tentKey: string, role: string) {
    setForm({
      ...form,
      tent_permissions: { ...form.tent_permissions, [tentKey]: role }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        if (editingUser) {
          // Update existing user
          const updateData: any = {
            role: form.role,
            tent_permissions: form.tent_permissions,
            updated_at: new Date().toISOString(),
          }
          if (form.restaurant_id) {
            updateData.restaurant_id = form.restaurant_id
            updateData.restaurant_tent = form.restaurant_tent || null
          } else {
            updateData.restaurant_id = null
            updateData.restaurant_tent = null
          }

          const { error } = await supabase
            .from("admin_users")
            .update(updateData)
            .eq("id", editingUser.id)

          if (error) throw new Error(error.message)

          setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updateData } : u))
        } else {
          // Create new user via API
          const res = await fetch("/api/admin-users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: form.username,
              email: form.email,
              password: form.password,
              role: form.role,
              restaurant_id: form.restaurant_id || null,
              restaurant_tent: form.restaurant_tent || null,
              operator_id: operator.id,
              tent_permissions: form.tent_permissions,
            }),
          })

          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || "Error creating user")
          }

          const newUser = await res.json()
          setUsers(prev => [newUser, ...prev])
        }

        handleClose()
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  async function handleResetPassword(userId: string, newPassword: string) {
    try {
      const res = await fetch(`/api/admin-users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      })
      if (!res.ok) throw new Error("Failed to reset password")
      alert("Contrasena actualizada")
    } catch (err: any) {
      alert("Error: " + err.message)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin": return "bg-red-100 text-red-700"
      case "manager": return "bg-blue-100 text-blue-700"
      case "dispatcher": return "bg-green-100 text-green-700"
      case "menu_entry": return "bg-yellow-100 text-yellow-700"
      case "restaurant_admin": return "bg-purple-100 text-purple-700"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/super-admin" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="p-2 bg-slate-900 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Admin Users</h1>
              <p className="text-xs text-gray-500">{operator.name}</p>
            </div>
          </div>
          <button
            onClick={() => handleOpen()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo Usuario
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {users.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No hay usuarios administradores</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm">
                      {(u.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{u.username}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleBadgeColor(u.role)}`}>
                          {u.role}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {currentUserRole === "super_admin" && u.role !== "super_admin" && (
                      <button
                        onClick={() => handleOpen(u)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        Editar
                      </button>
                    )}
                  </div>
                </div>

                {/* Tent permissions */}
                {u.tent_permissions && Object.keys(u.tent_permissions).length > 0 && (
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400">Acceso:</span>
                    {tents.map((tent) => {
                      const tentRole = u.tent_permissions?.[tent.key]
                      if (!tentRole) return null
                      return (
                        <span key={tent.key} className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-gray-100 rounded-lg font-medium text-gray-700">
                          <span className={tent.color}>{tent.icon}</span>
                          {tent.label}
                          <span className="text-gray-400">·</span>
                          {tentRole}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
              </h2>
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* Identity — only for new users */}
              {!editingUser && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identidad</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                      <input
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        placeholder="john.smith"
                        required={!editingUser}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="john@example.com"
                        required={!editingUser}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            required={!editingUser}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-gray-400"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(form.password)}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                          title="Copiar"
                        >
                          <Copy className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, password: generatePassword() })}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                          title="Generar"
                        >
                          <RefreshCw className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Role */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Rol Global</p>
                <div className="space-y-2">
                  {ROLES.map((r) => (
                    <label key={r.value} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="role"
                        value={r.value}
                        checked={form.role === r.value}
                        onChange={() => setForm({ ...form, role: r.value })}
                        className="h-4 w-4"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{r.label}</p>
                        <p className="text-xs text-gray-500">{r.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Restaurant — only for restaurant_admin */}
              {form.role === "restaurant_admin" && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Restaurante</p>
                  <select
                    value={form.restaurant_id ? `${form.restaurant_tent}:${form.restaurant_id}` : ""}
                    onChange={(e) => {
                      const val = e.target.value
                      if (!val) {
                        setForm({ ...form, restaurant_id: "", restaurant_tent: "" })
                      } else {
                        const [tent, id] = val.split(":")
                        setForm({ ...form, restaurant_id: id, restaurant_tent: tent as "delivery" | "catering" })
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    <option value="">Seleccionar restaurante...</option>
                    {restaurants.length > 0 && (
                      <optgroup label="── Online Ordering ──">
                        {restaurants.map((r) => (
                          <option key={r.id} value={`delivery:${r.id}`}>{r.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {cateringRestaurants.length > 0 && (
                      <optgroup label="── Catering ──">
                        {cateringRestaurants.map((r) => (
                          <option key={r.id} value={`catering:${r.id}`}>{r.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              {/* Tent permissions */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Acceso por Modulo</p>
                <div className="space-y-3">
                  {tents.map((tent) => {
                    const hasAccess = !!form.tent_permissions[tent.key]
                    return (
                      <div key={tent.key} className={`border rounded-xl p-3 ${!tent.enabled ? "opacity-40" : ""}`}>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hasAccess}
                              disabled={!tent.enabled}
                              onChange={(e) => toggleTent(tent.key, e.target.checked)}
                              className="h-4 w-4 rounded"
                            />
                            <span className={tent.color}>{tent.icon}</span>
                            <span className="text-sm font-medium text-gray-800">{tent.label}</span>
                            {!tent.enabled && <span className="text-xs text-gray-400">(No contratado)</span>}
                          </label>
                          {hasAccess && (
                            <select
                              value={form.tent_permissions[tent.key] || "dispatcher"}
                              onChange={(e) => setTentRole(tent.key, e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                            >
                              {TENT_ROLES.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</> : editingUser ? "Guardar Cambios" : "Crear Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
