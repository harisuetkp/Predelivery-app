"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GlobalNavbar } from "@/components/global-navbar"
import { 
  Store, Truck, CreditCard, Printer, Monitor, Clock, 
  Settings, Users, Globe, Bell, Building2, Tag, Phone, 
  Languages, CheckCircle2, ChevronRight, Smartphone,
  Utensils, MapPin, Zap
} from "lucide-react"
import { submitDeliveryPartnerLead } from "./actions"

// FoodNetPR brand colors
const PINK = "#E91E8C"
const NAVY = "#1a1a2e"

export default function PartnersPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    restaurantName: "",
    address: "",
    email: "",
    phone: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; error?: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitResult(null)

    const result = await submitDeliveryPartnerLead(formData)
    setSubmitResult(result)
    setIsSubmitting(false)

    if (result.success) {
      setFormData({
        fullName: "",
        restaurantName: "",
        address: "",
        email: "",
        phone: "",
      })
    }
  }

  const features = [
    { icon: Store, title: "Marketplace", desc: "Tu restaurante visible ante miles de clientes buscando delivery en Puerto Rico" },
    { icon: Utensils, title: "Menú Digital", desc: "Categorías, items, opciones, fotos, precios y descripciones. Fácil de actualizar" },
    { icon: Truck, title: "Delivery y Pick-Up", desc: "Ambos modos con zonas configurables, tarifas por distancia y horarios de servicio" },
    { icon: Clock, title: "Pre-Órdenes", desc: "Clientes pueden programar sus órdenes con fecha y hora de entrega futura" },
    { icon: Zap, title: "Carrito Inteligente", desc: "Experiencia fluida de compra con opciones, modificadores y notas especiales" },
    { icon: CreditCard, title: "Métodos de Pago", desc: "Stripe, ATH Móvil, Square y Apple Pay integrados nativamente" },
    { icon: Printer, title: "Impresión en Cocina", desc: "Integración con EataBit para impresión automática de tickets en tu impresora térmica" },
    { icon: Monitor, title: "Pantalla de Cocina", desc: "Sistema de display en tablet. Gestiona y confirma órdenes desde la cocina sin papel" },
    { icon: MapPin, title: "Dispatch en Tiempo Real", desc: "Panel unificado con seguimiento de órdenes activas, futuras e historial" },
    { icon: Settings, title: "Panel de Administración", desc: "Gestión completa de menú, horarios, sucursales, zonas y configuración" },
    { icon: Users, title: "Autenticación Múltiple", desc: "Tus clientes se registran con Google, Apple, Facebook o número de teléfono" },
    { icon: Bell, title: "Notificaciones Automáticas", desc: "Emails de confirmación y actualizaciones de estado de orden" },
    { icon: Building2, title: "Multi-Sucursal", desc: "Gestiona múltiples ubicaciones con menús y configuraciones independientes" },
    { icon: Tag, title: "White-Label", desc: "Opera completamente bajo tu marca sin branding externo" },
    { icon: Phone, title: "Órdenes por Teléfono", desc: "Formulario dedicado para registrar órdenes recibidas por teléfono" },
    { icon: Languages, title: "Bilingüe EN/ES", desc: "Plataforma completamente bilingüe en inglés y español" },
  ]

  const steps = [
    { num: "01", title: "Registra tu Restaurante", desc: "Crea tu perfil con logo, colores, menú y datos de contacto" },
    { num: "02", title: "Configura tu Operación", desc: "Define zonas de delivery, horarios, métodos de pago y conecta tu impresora" },
    { num: "03", title: "Recibe Órdenes", desc: "Aparece en el marketplace y comienza a recibir órdenes online desde el primer día" },
  ]

  const benefits = [
    "Llega a nuevos clientes a través del marketplace",
    "Recibe pagos directamente en tu cuenta",
    "Elimina errores con órdenes digitales estructuradas",
    "Ahorra tiempo con impresión automática en cocina",
    "Gestiona todo desde un panel centralizado",
    "Ofrece múltiples métodos de pago a tus clientes",
    "Proyecta imagen profesional con portal de marca propia",
    "Escala sin límites — agrega sucursales cuando crezcas",
  ]

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Nav - Use existing FoodNetPR delivery nav */}
      <GlobalNavbar showLocationBar={false} showModeToggle={false} />

      {/* Hero Section */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1526367790999-0150786686a2?w=1920&q=80"
            alt="Food delivery"
            fill
            className="object-cover"
            priority
          />
          <div 
            className="absolute inset-0" 
            style={{ background: `linear-gradient(to right, ${NAVY}f2, ${NAVY}d9, ${NAVY}b3)` }}
          />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Digitaliza tu negocio de delivery
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-3xl mx-auto mb-10 leading-relaxed">
            Marketplace propio, menú digital, órdenes online, pagos integrados y todo lo que necesitas para crecer en Puerto Rico.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#contacto">
              <Button 
                size="lg" 
                className="text-white px-8 py-6 text-lg font-semibold rounded-full shadow-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: PINK }}
              >
                Comienza Ahora
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </a>
            <a href="#funcionalidades">
              <Button 
                size="lg" 
                variant="outline"
                className="px-8 py-6 text-lg font-semibold rounded-full border-2 border-white text-white bg-transparent hover:bg-white/10"
              >
                Ver Funcionalidades
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Three Feature Highlights */}
      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: `${PINK}15` }}>
                <Store className="w-7 h-7" style={{ color: PINK }} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Tu Restaurante en el Marketplace</h3>
              <p className="text-slate-600 leading-relaxed">
                Aparece frente a miles de clientes en Puerto Rico buscando delivery y recogido
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: `${PINK}15` }}>
                <Truck className="w-7 h-7" style={{ color: PINK }} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Delivery y Pick-Up</h3>
              <p className="text-slate-600 leading-relaxed">
                Zonas de entrega configurables, tarifas por distancia y seguimiento de órdenes en tiempo real
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: `${PINK}15` }}>
                <CreditCard className="w-7 h-7" style={{ color: PINK }} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Pagos Integrados</h3>
              <p className="text-slate-600 leading-relaxed">
                Stripe, ATH Móvil, Square y Apple Pay. El dinero va directo a tu cuenta.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Methods Section */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: NAVY }}>
            Acepta todos los métodos de pago
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-12">
            El método de pago preferido en Puerto Rico y las tarjetas más usadas en el mundo, todas integradas.
          </p>

          <div className="grid sm:grid-cols-3 gap-6">
            {/* ATH Móvil */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <div className="w-full h-16 mx-auto mb-4 flex items-center justify-center">
                <img 
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-cmGNrEnEEYLt5XvwtCgNWur441yFx8.png" 
                  alt="ATH Móvil" 
                  className="h-12 object-contain"
                />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">ATH Móvil</h3>
              <p className="text-sm text-slate-600">Pagos instantáneos, el preferido en Puerto Rico</p>
            </div>

            {/* Stripe */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[#635BFF] flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Stripe</h3>
              <p className="text-sm text-slate-600">Visa, Mastercard, Amex, Apple Pay</p>
            </div>

            {/* Square */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-black flex items-center justify-center">
                <div className="w-6 h-6 bg-white rounded-sm" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Square</h3>
              <p className="text-sm text-slate-600">Ideal si ya usas Square en tu restaurante</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="funcionalidades" className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4" style={{ color: NAVY }}>
            Todo lo que necesitas para tu negocio
          </h2>
          <p className="text-lg text-slate-600 text-center max-w-2xl mx-auto mb-12">
            Una plataforma completa diseñada para restaurantes en Puerto Rico
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, idx) => (
              <div 
                key={idx} 
                className="bg-white rounded-xl p-5 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${PINK}10` }}
                  >
                    <feature.icon className="w-5 h-5" style={{ color: PINK }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">{feature.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12" style={{ color: NAVY }}>
            Comienza en 3 simples pasos
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className="text-center">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 text-2xl font-bold text-white"
                  style={{ backgroundColor: PINK }}
                >
                  {step.num}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                <p className="text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits List */}
      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12" style={{ color: NAVY }}>
            Haz crecer tu negocio de delivery
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-start gap-3 bg-white rounded-xl p-4 border border-slate-100">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: PINK }} />
                <span className="text-slate-700">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contacto" className="py-16 sm:py-20 bg-white">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4" style={{ color: NAVY }}>
            Únete a FoodNetPR
          </h2>
          <p className="text-lg text-slate-600 text-center mb-10">
            Completa el formulario y nos pondremos en contacto contigo para una demo personalizada.
          </p>

          {submitResult?.success ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-green-800 mb-2">Solicitud Enviada</h3>
              <p className="text-green-700">
                Gracias por tu interés. Te contactaremos en menos de 24 horas.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="fullName" className="text-sm font-medium text-slate-700">
                  Nombre Completo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="mt-1.5"
                  placeholder="Juan Del Pueblo"
                  required
                />
              </div>

              <div>
                <Label htmlFor="restaurantName" className="text-sm font-medium text-slate-700">
                  Nombre del Restaurante <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="restaurantName"
                  type="text"
                  value={formData.restaurantName}
                  onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                  className="mt-1.5"
                  placeholder="Mi Restaurante"
                  required
                />
              </div>

              <div>
                <Label htmlFor="address" className="text-sm font-medium text-slate-700">
                  Dirección
                </Label>
                <Input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1.5"
                  placeholder="Calle Principal #123, San Juan"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Correo Electrónico <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1.5"
                  placeholder="correo@ejemplo.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
                  Teléfono <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1.5"
                  placeholder="787-123-4567"
                  required
                />
              </div>

              {submitResult?.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                  {submitResult.error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-6 text-lg font-semibold rounded-xl text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: PINK }}
              >
                {isSubmitting ? "Enviando..." : "Enviar Solicitud"}
              </Button>

              <p className="text-center text-sm text-slate-500">
                Te contactaremos en menos de 24 horas.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Footer - Use existing FoodNetPR delivery footer */}
      <footer className="border-t border-slate-200 bg-white py-6 sm:py-8 mt-auto">
        <div className="px-4 flex flex-col items-center justify-between gap-3 sm:gap-4 sm:flex-row max-w-6xl mx-auto">
          <Image
            src="/foodnetpr-logo.png"
            alt="FoodNetPR"
            width={100}
            height={28}
            className="h-6 w-auto"
          />
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 text-[10px] sm:text-xs text-slate-500 text-center">
            <Link href="/partners" className="hover:text-slate-900 transition-colors font-medium" style={{ color: PINK }}>
              Para Restaurantes
            </Link>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">
              Privacidad
            </Link>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">
              Términos de Servicio
            </Link>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span suppressHydrationWarning>
              {new Date().getFullYear()} FoodNetPR
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
