"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  User,
  MapPin,
  CreditCard,
  ShoppingBag,
  Heart,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Store,
} from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { AddressAutocomplete, type AddressComponents } from "./address-autocomplete"
import { DeliveryPinConfirm } from "./delivery-pin-confirm"

interface Customer {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  default_address_id: string | null
  default_payment_method_id: string | null
}

interface Address {
  id: string
  label: string | null
  address_line_1: string
  address_line_2: string | null
  city: string
  state: string | null
  postal_code: string | null
  delivery_instructions: string | null
  is_default: boolean
}

interface PaymentMethod {
  id: string
  provider: string
  card_brand: string | null
  card_last_four: string | null
  card_exp_month: number | null
  card_exp_year: number | null
  is_default: boolean
}

interface Order {
  id: string
  order_number: string
  status: string
  order_type: string
  total: number
  created_at: string
  items: any[]
  restaurants: {
    id: string
    name: string
    slug: string
    logo_url: string | null
  } | null
}

interface Favorite {
  id: string
  restaurants: {
    id: string
    name: string
    slug: string
    logo_url: string | null
    cuisine_type: string | null
    marketplace_image_url: string | null
  } | null
}

interface AccountDashboardProps {
  user: SupabaseUser
  customer: Customer | null
  addresses: Address[]
  paymentMethods: PaymentMethod[]
  orders: Order[]
  favorites: Favorite[]
}

export function AccountDashboard({
  user,
  customer,
  addresses,
  paymentMethods,
  orders,
  favorites,
}: AccountDashboardProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [activeTab, setActiveTab] = useState("orders")
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("es-PR", {
      timeZone: "America/Puerto_Rico",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString))
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      pending: { label: "Pendiente", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
      confirmed: { label: "Confirmado", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
      preparing: { label: "Preparando", variant: "default", icon: <Clock className="h-3 w-3" /> },
      ready: { label: "Listo", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
      delivered: { label: "Entregado", variant: "outline", icon: <CheckCircle2 className="h-3 w-3" /> },
      completed: { label: "Completado", variant: "outline", icon: <CheckCircle2 className="h-3 w-3" /> },
      cancelled: { label: "Cancelado", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    }
    const config = statusConfig[status] || statusConfig.pending
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    )
  }

  const handleDeleteAddress = async (addressId: string) => {
    setLoading(true)
    const { error } = await supabase.from("customer_addresses").delete().eq("id", addressId)
    if (error) {
      console.error("[AccountDashboard] Delete address error:", error)
      alert(`Error al eliminar la dirección: ${error.message}`)
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
  }

  const handleSetDefaultAddress = async (addressId: string) => {
    if (!customer) {
      console.error("[AccountDashboard] No customer for setDefaultAddress")
      alert("Error: No se pudo identificar el cliente.")
      return
    }
    setLoading(true)
    // First, unset all defaults
    const { error: unsetError } = await supabase
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("customer_id", customer.id)
    if (unsetError) {
      console.error("[AccountDashboard] Unset default error:", unsetError)
      alert(`Error al actualizar direcciones: ${unsetError.message}`)
      setLoading(false)
      return
    }
    // Then set the new default
    const { error: setError } = await supabase
      .from("customer_addresses")
      .update({ is_default: true })
      .eq("id", addressId)
    if (setError) {
      console.error("[AccountDashboard] Set default error:", setError)
      alert(`Error al establecer dirección predeterminada: ${setError.message}`)
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
  }

  const handleRemoveFavorite = async (favoriteId: string) => {
    setLoading(true)
    await supabase.from("customer_favorites").delete().eq("id", favoriteId)
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/foodnetpr-logo.png"
              alt="FoodNetPR"
              width={150}
              height={50}
              className="h-10 w-auto"
            />
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {customer?.first_name} {customer?.last_name}
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Mi Cuenta</h1>
        <p className="text-muted-foreground mb-8">
          Administra tus pedidos, direcciones y metodos de pago
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid mb-6">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Direcciones</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Pagos</span>
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              <span className="hidden sm:inline">Favoritos</span>
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Pedidos</CardTitle>
                <CardDescription>
                  Tus pedidos de todos los restaurantes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No tienes pedidos aun</p>
                    <Button asChild className="mt-4 bg-teal-600 hover:bg-teal-700">
                      <Link href="/">Explorar Restaurantes</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        {order.restaurants?.logo_url ? (
                          <Image
                            src={order.restaurants.logo_url}
                            alt={order.restaurants.name}
                            width={60}
                            height={60}
                            className="h-14 w-14 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Store className="h-6 w-6 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">
                              {order.restaurants?.name || "Restaurante"}
                            </span>
                            {getStatusBadge(order.status)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>#{order.order_number}</span>
                            <span>•</span>
                            <span>{formatDate(order.created_at)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              {order.order_type === "delivery" ? (
                                <Truck className="h-3 w-3" />
                              ) : (
                                <Store className="h-3 w-3" />
                              )}
                              {order.order_type === "delivery" ? "Delivery" : "Pick-up"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${order.total.toFixed(2)}</p>
                          <Link
                            href={`/account/order/${order.id}`}
                            className="text-sm text-teal-600 hover:underline flex items-center gap-1"
                          >
                            Ver detalles
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Direcciones Guardadas</CardTitle>
                  <CardDescription>
                    Direcciones para entregas rapidas
                  </CardDescription>
                </div>
                <AddAddressDialog
                  customerId={customer?.id || ""}
                  onSuccess={() => router.refresh()}
                />
              </CardHeader>
              <CardContent>
                {addresses.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No tienes direcciones guardadas</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {addresses.map((address) => (
                      <div
                        key={address.id}
                        className="flex items-start gap-4 p-4 border rounded-lg"
                      >
                        <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <MapPin className="h-5 w-5 text-teal-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {address.label || "Direccion"}
                            </span>
                            {address.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                Principal
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {address.address_line_1}
                            {address.address_line_2 && `, ${address.address_line_2}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {address.city}
                            {address.state && `, ${address.state}`}
                            {address.postal_code && ` ${address.postal_code}`}
                          </p>
                          {address.delivery_instructions && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Instrucciones: {address.delivery_instructions}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!address.is_default && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetDefaultAddress(address.id)}
                              disabled={loading}
                            >
                              Hacer principal
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar direccion?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta accion no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteAddress(address.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Methods Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Metodos de Pago</CardTitle>
                <CardDescription>
                  Tarjetas guardadas para pagos rapidos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {paymentMethods.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No tienes metodos de pago guardados</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Se guardaran automaticamente cuando hagas un pedido
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <CreditCard className="h-5 w-5 text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium capitalize">
                              {method.card_brand || method.provider}
                            </span>
                            {method.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                Principal
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            **** **** **** {method.card_last_four}
                            {method.card_exp_month && method.card_exp_year && (
                              <span className="ml-2">
                                Exp: {method.card_exp_month}/{method.card_exp_year}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Favorites Tab */}
          <TabsContent value="favorites" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Restaurantes Favoritos</CardTitle>
                <CardDescription>
                  Tus restaurantes guardados para acceso rapido
                </CardDescription>
              </CardHeader>
              <CardContent>
                {favorites.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No tienes restaurantes favoritos</p>
                    <Button asChild className="mt-4 bg-teal-600 hover:bg-teal-700">
                      <Link href="/">Explorar Restaurantes</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {favorites.map((favorite) => (
                      <div
                        key={favorite.id}
                        className="relative group border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <Link href={`/${favorite.restaurants?.slug}`}>
                          <div className="aspect-video relative bg-slate-100">
                            {favorite.restaurants?.marketplace_image_url ? (
                              <Image
                                src={favorite.restaurants.marketplace_image_url}
                                alt={favorite.restaurants.name}
                                fill
                                className="object-cover"
                              />
                            ) : favorite.restaurants?.logo_url ? (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Image
                                  src={favorite.restaurants.logo_url}
                                  alt={favorite.restaurants.name}
                                  width={120}
                                  height={60}
                                  className="object-contain"
                                />
                              </div>
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Store className="h-12 w-12 text-slate-300" />
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <h3 className="font-medium">{favorite.restaurants?.name}</h3>
                            {favorite.restaurants?.cuisine_type && (
                              <p className="text-sm text-muted-foreground">
                                {favorite.restaurants.cuisine_type}
                              </p>
                            )}
                          </div>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                          onClick={() => handleRemoveFavorite(favorite.id)}
                        >
                          <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Profile Section */}
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil
            </CardTitle>
            <EditProfileDialog
              customer={customer}
              userEmail={user.email || ""}
              onSuccess={() => router.refresh()}
            />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Nombre</Label>
                <p className="font-medium">
                  {customer?.first_name} {customer?.last_name}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium">{customer?.email || user.email}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Telefono</Label>
                <p className="font-medium">{customer?.phone || "No especificado"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

// Add Address Dialog Component
// Task #49 (2026-04-20): upgraded to match OO checkout UX — AddressAutocomplete
// on Line 1 + Line 2 (secondary, suppressed when Line 1 populated), pin
// confirmation gate with drag-to-adjust, and lat/lng persisted to
// customer_addresses so saved addresses load at high-confidence tier in the
// checkout map instead of low-confidence pin-confirm fallback.
function AddAddressDialog({
  customerId,
  onSuccess,
}: {
  customerId: string
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [label, setLabel] = useState("")
  const [addressLine1, setAddressLine1] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [instructions, setInstructions] = useState("")
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<"high" | "low">("high")
  const [pinConfirmed, setPinConfirmed] = useState(false)
  const supabase = createBrowserClient()

  const resetForm = () => {
    setLabel("")
    setAddressLine1("")
    setAddressLine2("")
    setCity("")
    setState("")
    setPostalCode("")
    setInstructions("")
    setLatitude(null)
    setLongitude(null)
    setConfidence("high")
    setPinConfirmed(false)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) resetForm()
  }

  const applyAutocompletePick = (components: AddressComponents) => {
    // Always overwrite with the new place so stale coords from a previous
    // pick can never get saved alongside the new street address.
    setAddressLine1(components.streetAddress || "")
    setAddressLine2("") // Line 2 is intentionally cleared on every pick
    setCity(components.city || "")
    setState(components.state || "PR")
    setPostalCode(components.zip || "")
    setLatitude(typeof components.latitude === "number" ? components.latitude : null)
    setLongitude(typeof components.longitude === "number" ? components.longitude : null)
    setConfidence(components.confidence === "low" ? "low" : "high")
    setPinConfirmed(false)
  }

  const hasCoords = typeof latitude === "number" && typeof longitude === "number"
  const canSubmit =
    !loading &&
    !!addressLine1 &&
    !!city &&
    hasCoords &&
    pinConfirmed

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerId) {
      console.error("[AddAddressDialog] No customerId provided")
      alert("Error: No se pudo identificar el cliente. Por favor, recarga la página.")
      return
    }
    if (!hasCoords || !pinConfirmed) {
      alert("Por favor confirma la ubicación en el mapa antes de guardar.")
      return
    }

    setLoading(true)
    const { error } = await supabase.from("customer_addresses").insert({
      customer_id: customerId,
      label: label || null,
      address_line_1: addressLine1,
      address_line_2: addressLine2 || null,
      city,
      state: state || "PR",
      postal_code: postalCode || null,
      delivery_instructions: instructions || null,
      latitude,
      longitude,
    })

    if (error) {
      console.error("[AddAddressDialog] Insert error:", error)
      alert(`Error al guardar la dirección: ${error.message}`)
      setLoading(false)
      return
    }

    setOpen(false)
    resetForm()
    onSuccess()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-teal-600 hover:bg-teal-700">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Direccion
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar Nueva Direccion</DialogTitle>
          <DialogDescription>
            Busca tu dirección y confirma el PIN en el mapa para guardarla.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Etiqueta (opcional)</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej: Casa, Trabajo, etc."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address1">Direccion</Label>
            <AddressAutocomplete
              value={addressLine1}
              onChange={(val) => {
                setAddressLine1(val)
                // Typing invalidates any previously-selected coords so the user
                // must re-pick from the dropdown to re-enable save.
                if (latitude !== null || longitude !== null) {
                  setLatitude(null)
                  setLongitude(null)
                  setPinConfirmed(false)
                }
              }}
              onAddressSelected={applyAutocompletePick}
              placeholder="Número de Casa o Edificio, Calle"
              className="mt-1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address2">Apt, Suite, Urb, Edificio, Piso, etc. (opcional)</Label>
            <AddressAutocomplete
              value={addressLine2}
              onChange={(val) => setAddressLine2(val)}
              onAddressSelected={applyAutocompletePick}
              placeholder="Apartamento, suite, unidad"
              className="mt-1"
              secondarySearch
              suppressPredictions={!!addressLine1}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                placeholder="San Juan"
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <div className="mt-0 px-3 py-2 border rounded-md bg-slate-50 text-sm">PR</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal">ZIP</Label>
              <Input
                id="postal"
                value={postalCode}
                onChange={(e) => {
                  const nextZip = e.target.value.replace(/\D/g, "").slice(0, 5)
                  setPostalCode(nextZip)
                }}
                placeholder="00000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions">Instrucciones de entrega (opcional)</Label>
            <Input
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Ej: Portón verde, tocar timbre"
            />
          </div>
          {hasCoords && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-white mt-2 bg-teal-600">
                <span className="w-6 h-6 rounded-full text-sm flex items-center justify-center bg-white text-teal-700">
                  PIN
                </span>
                <h2 className="text-sm font-bold">Confirma tu Ubicación</h2>
              </div>
              <DeliveryPinConfirm
                latitude={latitude as number}
                longitude={longitude as number}
                onChange={(lat, lng) => {
                  setLatitude(lat)
                  setLongitude(lng)
                }}
                confidence={confidence}
                onConfirm={() => setPinConfirmed(true)}
                onUnconfirm={() => setPinConfirmed(false)}
                confirmed={pinConfirmed}
                onAddressResolved={(addr) => {
                  // Keep the text in sync with the pin when the customer drags
                  // in low-confidence mode so the saved label never drifts away
                  // from where the pin ends up (mirrors checkout behavior).
                  const c = addr.components || {}
                  const nextStreet =
                    c.streetNumber && c.route
                      ? `${c.streetNumber} ${c.route}`
                      : c.route || (addr.formattedAddress || "").split(",")[0]
                  if (nextStreet) setAddressLine1(nextStreet)
                  if (c.city) setCity(c.city)
                  if (c.postalCode) setPostalCode(c.postalCode)
                  if (c.streetNumber && c.route) setConfidence("high")
                }}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading
                ? "Guardando..."
                : !hasCoords
                  ? "Selecciona una dirección"
                  : !pinConfirmed
                    ? "Confirma el PIN"
                    : "Guardar Direccion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Edit Profile Dialog Component
function EditProfileDialog({
  customer,
  userEmail,
  onSuccess,
}: {
  customer: Customer | null
  userEmail: string
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [firstName, setFirstName] = useState(customer?.first_name || "")
  const [lastName, setLastName] = useState(customer?.last_name || "")
  const [email, setEmail] = useState(customer?.email || userEmail || "")
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const supabase = createBrowserClient()

  const currentEmail = customer?.email || userEmail || ""

  // Format phone for display (convert +17873661140 or 17873661140 to 787-366-1140)
  const formatPhoneForDisplay = (rawPhone: string | null | undefined): string => {
    if (!rawPhone) return ""
    const digits = rawPhone.replace(/\D/g, "")
    const last10 = digits.slice(-10)
    if (last10.length === 10) {
      return `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6)}`
    }
    return rawPhone
  }

  // Format phone for storage (convert 787-366-1140 to 17873661140)
  const formatPhoneForStorage = (displayPhone: string): string => {
    const digits = displayPhone.replace(/\D/g, "")
    const last10 = digits.slice(-10)
    if (last10.length === 10) {
      return `1${last10}`
    }
    return digits
  }

  const [phone, setPhone] = useState(formatPhoneForDisplay(customer?.phone))

  // Reset form when customer data changes
  useEffect(() => {
    setFirstName(customer?.first_name || "")
    setLastName(customer?.last_name || "")
    setPhone(formatPhoneForDisplay(customer?.phone))
    setEmail(customer?.email || userEmail || "")
    setEmailMessage(null)
  }, [customer, userEmail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer?.id) return

    setLoading(true)
    setEmailMessage(null)

    // Update customer record in database
    const phoneForStorage = phone ? formatPhoneForStorage(phone) : null
    
    const { error } = await supabase
      .from("customers")
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phoneForStorage,
        email: email || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customer.id)

    // If email changed, also update auth email (requires confirmation)
    if (email && email !== currentEmail) {
      const { error: authError } = await supabase.auth.updateUser({
        email: email,
      })
      
      if (authError) {
        // Check if it's a "user already exists" error
        if (authError.message?.includes("already") || authError.message?.includes("registered")) {
          setEmailMessage("MERGE_NEEDED")
        } else {
          setEmailMessage("Error al cambiar email: " + authError.message)
        }
        setLoading(false)
        return
      } else {
        setEmailMessage("Se ha enviado un correo de confirmacion a " + email + ". Revisa tu bandeja de entrada para confirmar el cambio.")
        // Don't close dialog - let user see the message
        setLoading(false)
        onSuccess()
        return
      }
    }

    if (!error) {
      setOpen(false)
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>
            Actualiza tu informacion personal
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Tu apellido"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
            {email !== currentEmail && (
              <p className="text-xs text-amber-600">
                Se enviara un correo de confirmacion al nuevo email
              </p>
            )}
            {emailMessage === "MERGE_NEEDED" ? (
              <div className="text-xs bg-amber-50 border border-amber-200 p-3 rounded space-y-2">
                <p className="font-medium text-amber-800">
                  Ya existe una cuenta con este email.
                </p>
                <p className="text-amber-700">
                  Si deseas unificar tus cuentas, contacta a nuestro equipo de soporte:
                </p>
                <p className="text-amber-900 font-medium">
                  foodnetpr.mail@gmail.com
                </p>
                <p className="text-amber-600 text-[11px]">
                  Incluye tu numero de telefono actual y el email que deseas vincular.
                </p>
              </div>
            ) : emailMessage && (
              <p className="text-xs text-teal-600 bg-teal-50 p-2 rounded">
                {emailMessage}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefono</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => {
                // Auto-format as user types: 787-366-1140
                const digits = e.target.value.replace(/\D/g, "").slice(0, 10)
                if (digits.length <= 3) {
                  setPhone(digits)
                } else if (digits.length <= 6) {
                  setPhone(`${digits.slice(0, 3)}-${digits.slice(3)}`)
                } else {
                  setPhone(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`)
                }
              }}
              placeholder="787-366-1140"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700">
              {loading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
