import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { CheckCircle, Clock, MapPin, Phone, ArrowLeft } from "lucide-react"

// Safe number formatting helper
function formatMoney(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  return (num ?? 0).toFixed(2)
}

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ orderId?: string }>
}) {
  const { slug } = await params
  const { orderId } = await searchParams
  const supabase = await createClient()

  // Get restaurant
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, slug, logo_url, phone, address, city, state, zip")
    .eq("slug", slug)
    .single()

  if (!restaurant) {
    redirect("/")
  }

  // If we have an orderId, fetch the order details
  let order = null
  if (orderId) {
    const { data } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (
          id,
          item_name,
          quantity,
          unit_price,
          total_price,
          selected_options
        )
      `)
      .eq("id", orderId)
      .eq("restaurant_id", restaurant.id)
      .single()
    order = data
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href={`/${slug}`}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Menu
          </Link>
          {restaurant.logo_url && (
            <Image
              src={restaurant.logo_url}
              alt={restaurant.name}
              width={40}
              height={40}
              className="h-10 w-auto object-contain"
            />
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Success Message */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Pedido Confirmado
          </h1>
          <p className="text-slate-600">
            Gracias por tu orden. Hemos recibido tu pedido y lo estamos procesando.
          </p>
          {order?.order_number && (
            <p className="mt-4 text-lg font-semibold text-slate-900">
              Orden #{order.order_number}
            </p>
          )}
        </div>

        {/* Order Details */}
        {order && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h2 className="font-semibold text-slate-900 mb-4">Detalles del Pedido</h2>
            
            {/* Order Type & Time */}
            <div className="flex items-center gap-3 mb-4 text-sm text-slate-600">
              <Clock className="w-4 h-4" />
              <span>
                {order.order_type === "delivery" ? "Delivery" : "Pickup"} - {" "}
                {order.scheduled_for 
                  ? new Date(order.scheduled_for).toLocaleString("es-PR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "Lo antes posible"
                }
              </span>
            </div>

            {/* Delivery Address */}
            {order.order_type === "delivery" && order.delivery_address && (
              <div className="mb-4">
                {/* Static map preview (Task #54) — non-interactive image.
                    Only renders when a rooftop pin was captured at checkout.
                    Postgres `numeric` columns come back as strings from
                    supabase-js, so coerce with Number() + Number.isFinite guard. */}
                {(() => {
                  const latNum = Number(order.delivery_latitude)
                  const lngNum = Number(order.delivery_longitude)
                  const hasPin = order.delivery_latitude != null
                    && order.delivery_longitude != null
                    && Number.isFinite(latNum)
                    && Number.isFinite(lngNum)
                  return hasPin && (
                    <div className="mb-3 overflow-hidden rounded-lg border border-slate-200">
                      <img
                        src={`/api/maps/static?lat=${latNum}&lng=${lngNum}&zoom=16&size=600x240`}
                        alt="Mapa de la direccion de entrega"
                        width={600}
                        height={240}
                        className="w-full h-auto block"
                        loading="lazy"
                      />
                    </div>
                  )
                })()}
                <div className="flex items-start gap-3 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 mt-0.5" />
                  <div>
                    <p>{order.delivery_address}</p>
                    {order.delivery_city && (
                      <p>{order.delivery_city}, {order.delivery_state} {order.delivery_zip}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Items */}
            <div className="border-t border-slate-100 pt-4 mt-4">
              <h3 className="font-medium text-slate-900 mb-3">Items</h3>
              <div className="space-y-2">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      {item.quantity}x {item.item_name}
                    </span>
                    <span className="text-slate-900">${formatMoney(item.total_price)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-slate-100 pt-4 mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="text-slate-900">${formatMoney(order.subtotal)}</span>
              </div>
              {order.delivery_fee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Delivery</span>
                  <span className="text-slate-900">${formatMoney(order.delivery_fee)}</span>
                </div>
              )}
              {order.dispatch_fee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Dispatch</span>
                  <span className="text-slate-900">${formatMoney(order.dispatch_fee)}</span>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">IVU</span>
                  <span className="text-slate-900">${formatMoney(order.tax)}</span>
                </div>
              )}
              {order.tip > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Propina</span>
                  <span className="text-slate-900">${formatMoney(order.tip)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg pt-2 border-t border-slate-100">
                <span>Total</span>
                <span>${formatMoney(order.total)}</span>
              </div>
            </div>

            {/* Payment Status */}
            <div className="border-t border-slate-100 pt-4 mt-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Metodo de Pago</span>
                <span className="text-slate-900 capitalize">
                  {order.payment_method === "cash" ? "Efectivo" : 
                   order.payment_method === "card" ? "Tarjeta" : 
                   order.payment_method === "athmovil" ? "ATH Movil" : 
                   order.payment_method}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Restaurant Contact */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Contacto del Restaurante</h2>
          <p className="font-medium text-slate-900">{restaurant.name}</p>
          {restaurant.address && (
            <p className="text-sm text-slate-600 mt-1">
              {restaurant.address}, {restaurant.city}, {restaurant.state} {restaurant.zip}
            </p>
          )}
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              className="flex items-center gap-2 text-sm text-cyan-600 hover:text-cyan-700 mt-2"
            >
              <Phone className="w-4 h-4" />
              {restaurant.phone}
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/${slug}`}
            className="w-full py-3 px-4 bg-cyan-500 text-white font-medium rounded-lg text-center hover:bg-cyan-600 transition-colors"
          >
            Hacer Otro Pedido
          </Link>
          <Link
            href="/account"
            className="w-full py-3 px-4 bg-slate-100 text-slate-700 font-medium rounded-lg text-center hover:bg-slate-200 transition-colors"
          >
            Ver Mis Ordenes
          </Link>
        </div>
      </main>
    </div>
  )
}
