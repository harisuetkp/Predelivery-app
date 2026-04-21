"use client"

import { useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowRight, Search, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface UserInfo {
  id: string
  email: string | null
  phone: string | null
  created_at: string
  customer?: {
    first_name: string | null
    last_name: string | null
  }
  orderCount: number
}

export default function MergeUsersPage() {
  const [searchEmail, setSearchEmail] = useState("")
  const [searchPhone, setSearchPhone] = useState("")
  const [users, setUsers] = useState<UserInfo[]>([])
  const [sourceUser, setSourceUser] = useState<UserInfo | null>(null)
  const [targetUser, setTargetUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const supabase = createBrowserClient()

  const searchUsers = async () => {
    if (!searchEmail && !searchPhone) return

    setSearching(true)
    setMessage(null)

    try {
      // Search by email or phone
      const response = await fetch("/api/admin/search-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: searchEmail, phone: searchPhone }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setUsers(data.users || [])
        if (data.users?.length === 0) {
          setMessage({ type: "error", text: "No se encontraron usuarios" })
        }
      } else {
        setMessage({ type: "error", text: data.error || "Error buscando usuarios" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error de conexion" })
    }

    setSearching(false)
  }

  const mergeUsers = async () => {
    if (!sourceUser || !targetUser) return

    if (!confirm(`¿Estas seguro? Esto transferira ${sourceUser.orderCount} pedidos de "${sourceUser.email || sourceUser.phone}" a "${targetUser.email || targetUser.phone}" y eliminara la cuenta de origen.`)) {
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch("/api/admin/merge-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUserId: sourceUser.id,
          targetUserId: targetUser.id,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: "success", text: data.message })
        setSourceUser(null)
        setTargetUser(null)
        setUsers([])
      } else {
        setMessage({ type: "error", text: data.error || "Error al fusionar cuentas" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error de conexion" })
    }

    setLoading(false)
  }

  const formatPhone = (phone: string | null) => {
    if (!phone) return "Sin telefono"
    const digits = phone.replace(/\D/g, "").slice(-10)
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    }
    return phone
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/admin" className="text-teal-600 hover:underline flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Volver al Admin
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Fusionar Cuentas de Usuario</CardTitle>
            <CardDescription>
              Busca usuarios por email o telefono para fusionar cuentas duplicadas.
              Los pedidos se transferiran de la cuenta de origen a la cuenta de destino.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search Section */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Buscar por Email</Label>
                <Input
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="usuario@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Buscar por Telefono</Label>
                <Input
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  placeholder="787-366-1140"
                />
              </div>
            </div>
            
            <Button onClick={searchUsers} disabled={searching} className="bg-teal-600 hover:bg-teal-700">
              <Search className="h-4 w-4 mr-2" />
              {searching ? "Buscando..." : "Buscar Usuarios"}
            </Button>

            {/* Results */}
            {users.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Usuarios Encontrados ({users.length})</h3>
                <div className="grid gap-3">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        sourceUser?.id === user.id
                          ? "border-red-500 bg-red-50"
                          : targetUser?.id === user.id
                          ? "border-green-500 bg-green-50"
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                      onClick={() => {
                        if (!sourceUser) {
                          setSourceUser(user)
                        } else if (!targetUser && user.id !== sourceUser.id) {
                          setTargetUser(user)
                        } else if (sourceUser.id === user.id) {
                          setSourceUser(null)
                        } else if (targetUser?.id === user.id) {
                          setTargetUser(null)
                        }
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            {user.customer?.first_name} {user.customer?.last_name || "Sin nombre"}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.email || "Sin email"}</p>
                          <p className="text-sm text-muted-foreground">{formatPhone(user.phone)}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Creado: {new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", month: "short", day: "numeric", year: "numeric" }).format(new Date(user.created_at))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{user.orderCount} pedidos</p>
                          {sourceUser?.id === user.id && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">ORIGEN</span>
                          )}
                          {targetUser?.id === user.id && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">DESTINO</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-muted-foreground">
                  Haz clic para seleccionar: primero la cuenta de ORIGEN (se eliminara), luego la de DESTINO (se mantendra).
                </p>
              </div>
            )}

            {/* Merge Preview */}
            {sourceUser && targetUser && (
              <Alert className="border-amber-500 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex-1 p-3 bg-red-100 rounded">
                      <p className="font-medium text-red-800">Cuenta a Eliminar</p>
                      <p className="text-sm">{sourceUser.email || formatPhone(sourceUser.phone)}</p>
                      <p className="text-sm">{sourceUser.orderCount} pedidos</p>
                    </div>
                    <ArrowRight className="h-6 w-6 text-amber-600" />
                    <div className="flex-1 p-3 bg-green-100 rounded">
                      <p className="font-medium text-green-800">Cuenta a Mantener</p>
                      <p className="text-sm">{targetUser.email || formatPhone(targetUser.phone)}</p>
                      <p className="text-sm">{targetUser.orderCount} pedidos</p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            {sourceUser && targetUser && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSourceUser(null)
                    setTargetUser(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={mergeUsers}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {loading ? "Fusionando..." : "Fusionar Cuentas"}
                </Button>
              </div>
            )}

            {/* Messages */}
            {message && (
              <Alert className={message.type === "success" ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}>
                {message.type === "success" ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className={message.type === "success" ? "text-green-800" : "text-red-800"}>
                  {message.text}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
