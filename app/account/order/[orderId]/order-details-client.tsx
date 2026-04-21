"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Store,
  MapPin,
  Phone,
  Receipt,
  ShoppingCart,
} from "lucide-react"


interface OrderItem {
  id: string
  menu_item_id: string
  item_name: string
  quantity: number
  unit_price: number
  total_price: number
  special_instructions: string | null
  selected_options: Record<string, string> | null
}

interface Order {
  id: string
  order_number: string
  status: string
  order_type: string
  subtotal: number
  tax_amount: number
  delivery_fee: number
  dispatch_fee: number
  tip_amount: number
  total: number
  created_at: string
  scheduled_time: string | null
  delivery_address: string | null
  delivery_instructions: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  notes: string | null
  restaurants: {
    id: string
    name: string
    slug: string
    logo_url: string | null
    phone: string | null
    address: string | null
    restaurant_address: string | null
  } | null
  order_items: OrderItem[]
}

interface Customer {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
}

interface OrderDetailsClientProps {
  order: Order
  customer: Customer | null
}

export function OrderDetailsClient({ order, customer }: OrderDetailsClientProps) {
  const router = useRouter()

  // Safe number formatting
  const formatMoney = (value: number | null | undefined) => {
    return (value ?? 0).toFixed(2)
  }

  const handleReorder = () => {
    if (!order.restaurants) return
    
    // Build cart items matching the customer-portal format
    const cartItems = order.order_items.map((item) => ({
      type: "item",
      id: item.menu_item_id,
      name: item.item_name,
      item: null, // Will be populated by customer-portal from menu
      quantity: item.quantity,
      totalPrice: item.unit_price * item.quantity,
      finalPrice: item.unit_price * item.quantity,
      basePrice: item.unit_price,
      image_url: null,
      customizations: {},
      selectedOptions: item.selected_options || {},
    }))

    // Save to sessionStorage with the restaurant-specific key that customer-portal uses
    const cartStorageKey = `cart_${order.restaurants.slug}`
    sessionStorage.setItem(cartStorageKey, JSON.stringify(cartItems))

    // Navigate to the restaurant page with cart open
    router.push(`/${order.restaurants.slug}?cart=open`)
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("es-PR", {
      timeZone: "America/Puerto_Rico",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString))
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; color: string }> = {
      pending: { label: "Pendiente", variant: "secondary", icon: <Clock className="h-4 w-4" />, color: "bg-yellow-100 text-yellow-800" },
      confirmed: { label: "Confirmado", variant: "default", icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-blue-100 text-blue-800" },
      preparing: { label: "Preparando", variant: "default", icon: <Clock className="h-4 w-4" />, color: "bg-orange-100 text-orange-800" },
      ready: { label: "Listo para recoger", variant: "default", icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-green-100 text-green-800" },
      out_for_delivery: { label: "En camino", variant: "default", icon: <Truck className="h-4 w-4" />, color: "bg-purple-100 text-purple-800" },
      delivered: { label: "Entregado", variant: "outline", icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-green-100 text-green-800" },
      completed: { label: "Completado", variant: "outline", icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-green-100 text-green-800" },
      cancelled: { label: "Cancelado", variant: "destructive", icon: <XCircle className="h-4 w-4" />, color: "bg-red-100 text-red-800" },
    }
    const config = statusConfig[status] || statusConfig.pending
    return (
      <Badge className={`flex items-center gap-1 ${config.color}`}>
        {config.icon}
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/account" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">Volver a Mi Cuenta</span>
          </Link>
          <div className="flex-1" />
          <Image
            src="/foodnetpr-logo.png"
            alt="FoodNetPR"
            width={120}
            height={40}
            className="h-8 w-auto"
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Order Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Pedido #{order.order_number}</h1>
              <p className="text-muted-foreground">{formatDate(order.created_at)}</p>
            </div>
            {getStatusBadge(order.status)}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Order Items */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
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
                <div>
                  <CardTitle>{order.restaurants?.name || "Restaurante"}</CardTitle>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    {order.order_type === "delivery" ? (
                      <>
                        <Truck className="h-4 w-4" />
                        <span>Delivery</span>
                      </>
                    ) : (
                      <>
                        <Store className="h-4 w-4" />
                        <span>Pick-up</span>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="font-medium mb-4">Items del Pedido</h3>
                <div className="space-y-4">
                  {(order.order_items || []).map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-medium text-sm">
                        {item.quantity}x
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{item.item_name}</p>
                        {item.selected_options && Object.keys(item.selected_options).length > 0 && (
                          <div className="flex flex-col gap-0.5 mt-1">
                            {Object.entries(item.selected_options).map(([key, value]) => (
                              <span key={key} className="text-sm text-muted-foreground">
                                {String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.special_instructions && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Nota: {item.special_instructions}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${formatMoney(item.total_price)}</p>
                        {item.quantity > 1 && (
                          <p className="text-sm text-muted-foreground">
                            ${formatMoney(item.unit_price)} c/u
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Notas del pedido</h4>
                      <p className="text-sm">{order.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Delivery Info */}
            {order.order_type === "delivery" && order.delivery_address && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Direccion de Entrega
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{order.delivery_address}</p>
                  {order.delivery_instructions && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Instrucciones: {order.delivery_instructions}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pickup Info */}
            {order.order_type === "pickup" && order.restaurants && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    Direccion de Recogido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{order.restaurants.restaurant_address || order.restaurants.address}</p>
                  {order.restaurants.phone && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                      <Phone className="h-4 w-4" />
                      {order.restaurants.phone}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Resumen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${formatMoney(order.subtotal)}</span>
                </div>
                {(order.delivery_fee ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Delivery</span>
                    <span>${formatMoney(order.delivery_fee)}</span>
                  </div>
                )}
                {(order.dispatch_fee ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Despacho</span>
                    <span>${formatMoney(order.dispatch_fee)}</span>
                  </div>
                )}
                {(order.tax_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>IVU</span>
                    <span>${formatMoney(order.tax_amount)}</span>
                  </div>
                )}
                {(order.tip_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Propina</span>
                    <span>${formatMoney(order.tip_amount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>${formatMoney(order.total)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Scheduled Time */}
            {order.scheduled_time && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Hora Programada
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{formatDate(order.scheduled_time)}</p>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="space-y-3">
              {order.restaurants?.slug && (
                <Button 
                  onClick={handleReorder}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Ordenar de nuevo
                </Button>
              )}
              <Button asChild variant="outline" className="w-full">
                <Link href="/account">
                  Volver a Mi Cuenta
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
