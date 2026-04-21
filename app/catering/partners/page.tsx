"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Store, 
  Truck, 
  Calendar, 
  CreditCard, 
  Smartphone, 
  LayoutDashboard,
  Phone,
  Bell,
  ShoppingCart,
  Utensils,
  Package,
  CheckCircle2,
  ChevronRight,
  Menu,
  X
} from "lucide-react"
import { submitPartnerLead } from "./actions"

// JunteReady brand colors
const JUNTE_ORANGE = "#F2901C"
const READY_NAVY = "#1E3A5F"

export default function CateringPartnersPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [formData, setFormData] = useState({
    fullName: "",
    restaurantName: "",
    address: "",
    email: "",
    phone: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await submitPartnerLead(formData)
      setSubmitSuccess(true)
      setFormData({
        fullName: "",
        restaurantName: "",
        address: "",
        email: "",
        phone: "",
      })
    } catch (error: any) {
      setSubmitError(error.message || "Error al enviar la solicitud")
    } finally {
      setIsSubmitting(false)
    }
  }

  const features = [
    { icon: Store, title: "Portal Personalizado", desc: "Tu marca, tu logo, tus colores" },
    { icon: Utensils, title: "Menú Digital Completo", desc: "Categorías, tamaños, opciones" },
    { icon: Package, title: "Paquetes de Servicio", desc: "Combos y servicios adicionales" },
    { icon: Truck, title: "Delivery y Pick-Up", desc: "Zonas, tarifas y seguimiento" },
    { icon: ShoppingCart, title: "Carrito con Upsells", desc: "Aumenta ticket promedio" },
    { icon: CreditCard, title: "Múltiples Métodos de Pago", desc: "ATH, Stripe, Apple Pay" },
    { icon: LayoutDashboard, title: "Panel de Órdenes", desc: "Gestión en tiempo real" },
    { icon: Phone, title: "Órdenes por Teléfono", desc: "CSR integrado" },
    { icon: Bell, title: "Notificaciones Automáticas", desc: "Email y SMS a clientes" },
  ]

  const benefits = [
    "Aumenta el ticket promedio con upsells inteligentes",
    "Reduce errores con órdenes digitales estructuradas",
    "Ahorra tiempo con notificaciones automáticas",
    "Proyecta imagen profesional con tu portal de marca",
    "Llega a nuevos clientes a través del marketplace",
    "Gestiona todo desde un solo panel centralizado",
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/catering" className="flex items-center">
              <Image
                src="/junteready-logo.jpg"
                alt="JunteReady"
                width={140}
                height={36}
                className="h-9 w-auto"
              />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6">
              <a href="#funcionalidades" className="text-sm text-slate-600 hover:text-slate-900">
                Funcionalidades
              </a>
              <a href="#contacto" className="text-sm text-slate-600 hover:text-slate-900">
                Contacto
              </a>
              <Link href="/catering">
                <Button variant="outline" size="sm">Ver Marketplace</Button>
              </Link>
            </nav>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile nav */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-slate-100">
              <div className="flex flex-col gap-4">
                <a 
                  href="#funcionalidades" 
                  className="text-slate-600"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Funcionalidades
                </a>
                <a 
                  href="#contacto" 
                  className="text-slate-600"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contacto
                </a>
                <Link href="/catering">
                  <Button variant="outline" size="sm" className="w-full">Ver Marketplace</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative min-h-[500px] md:min-h-[600px] flex items-center">
          {/* Background image */}
          <div className="absolute inset-0 z-0">
            <Image
              src="https://images.unsplash.com/photo-1555244162-803834f70033?w=1920&q=80"
              alt="Catering setup"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 py-16 md:py-24">
            <div className="max-w-2xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                Digitaliza tu negocio de catering
              </h1>
              <p className="text-lg md:text-xl text-white/90 mb-8">
                Portal personalizado, menú digital, órdenes online, pagos integrados 
                y todo lo que necesitas para crecer.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="#contacto">
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto text-white font-semibold px-8"
                    style={{ backgroundColor: JUNTE_ORANGE }}
                  >
                    Comienza Ahora
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                </a>
                <a href="#funcionalidades">
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="w-full sm:w-auto border-white text-white hover:bg-white/10"
                  >
                    Ver Funcionalidades
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Three Feature Highlights */}
        <section className="py-16 md:py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: `${JUNTE_ORANGE}15` }}
                >
                  <Store className="w-7 h-7" style={{ color: JUNTE_ORANGE }} />
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ color: READY_NAVY }}>
                  Tu Portal, Tu Marca
                </h3>
                <p className="text-slate-600">
                  Portal personalizado con tu logo, colores y hasta dominio propio. 
                  Tu negocio, tu identidad.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: `${JUNTE_ORANGE}15` }}
                >
                  <Truck className="w-7 h-7" style={{ color: JUNTE_ORANGE }} />
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ color: READY_NAVY }}>
                  Delivery y Pick-Up
                </h3>
                <p className="text-slate-600">
                  Configura zonas de delivery, tarifas por distancia y ofrece 
                  pick-up con seguimiento en tiempo real.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: `${JUNTE_ORANGE}15` }}
                >
                  <Calendar className="w-7 h-7" style={{ color: JUNTE_ORANGE }} />
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ color: READY_NAVY }}>
                  Eventos sin Límites
                </h3>
                <p className="text-slate-600">
                  Paquetes de servicio, menús personalizados y gestión completa 
                  de eventos de cualquier tamaño.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ATH Móvil Payment Section */}
        <section className="py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <Smartphone className="w-8 h-8" style={{ color: JUNTE_ORANGE }} />
                  <h2 className="text-3xl md:text-4xl font-bold" style={{ color: READY_NAVY }}>
                    Acepta pagos con ATH Móvil
                  </h2>
                </div>
                <p className="text-lg text-slate-600 mb-8">
                  El método de pago preferido en Puerto Rico. Integración nativa 
                  para que tus clientes paguen como prefieren.
                </p>

                <div className="flex flex-wrap gap-3 mb-8">
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Pagos instantáneos
                  </span>
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Sin comisiones adicionales
                  </span>
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Fácil de configurar
                  </span>
                </div>

                <p className="text-slate-500">
                  También aceptamos <strong>Stripe</strong> (Visa, Mastercard, Amex) 
                  y <strong>Apple Pay</strong> para máxima flexibilidad.
                </p>
              </div>

              <div className="flex-1 flex justify-center">
                <div className="relative">
                  <div 
                    className="w-64 h-64 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${JUNTE_ORANGE}10` }}
                  >
                    <div 
                      className="w-48 h-48 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${JUNTE_ORANGE}20` }}
                    >
                      <CreditCard className="w-20 h-20" style={{ color: JUNTE_ORANGE }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="funcionalidades" className="py-16 md:py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: READY_NAVY }}>
                Todo lo que necesitas para tu negocio
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Herramientas profesionales diseñadas para negocios de catering en Puerto Rico
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, i) => (
                <div 
                  key={i}
                  className="bg-white rounded-xl p-6 border border-slate-100 hover:shadow-md transition-shadow"
                >
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${READY_NAVY}10` }}
                  >
                    <feature.icon className="w-6 h-6" style={{ color: READY_NAVY }} />
                  </div>
                  <h3 className="font-semibold text-lg mb-2" style={{ color: READY_NAVY }}>
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: READY_NAVY }}>
                Comienza en 3 simples pasos
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white"
                  style={{ backgroundColor: JUNTE_ORANGE }}
                >
                  01
                </div>
                <h3 className="text-xl font-semibold mb-3" style={{ color: READY_NAVY }}>
                  Registra tu Restaurante
                </h3>
                <p className="text-slate-600">
                  Completa el formulario y te contactamos para configurar tu cuenta
                </p>
              </div>

              <div className="text-center">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white"
                  style={{ backgroundColor: JUNTE_ORANGE }}
                >
                  02
                </div>
                <h3 className="text-xl font-semibold mb-3" style={{ color: READY_NAVY }}>
                  Configura tu Menú
                </h3>
                <p className="text-slate-600">
                  Sube tus platos, precios, opciones y paquetes desde el panel admin
                </p>
              </div>

              <div className="text-center">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white"
                  style={{ backgroundColor: JUNTE_ORANGE }}
                >
                  03
                </div>
                <h3 className="text-xl font-semibold mb-3" style={{ color: READY_NAVY }}>
                  Recibe Órdenes
                </h3>
                <p className="text-slate-600">
                  Tu portal está listo. Empieza a recibir órdenes online y por teléfono
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits List */}
        <section className="py-16 md:py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center" style={{ color: READY_NAVY }}>
                Haz crecer tu negocio de catering
              </h2>

              <div className="space-y-4">
                {benefits.map((benefit, i) => (
                  <div 
                    key={i}
                    className="flex items-start gap-4 bg-white rounded-xl p-5 border border-slate-100"
                  >
                    <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: JUNTE_ORANGE }} />
                    <span className="text-lg text-slate-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <section id="contacto" className="py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4">
            <div className="max-w-xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: READY_NAVY }}>
                  Comienza con JunteReady
                </h2>
                <p className="text-slate-600">
                  Completa el formulario y nos pondremos en contacto contigo 
                  para una demo personalizada.
                </p>
              </div>

              {submitSuccess ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
                  <h3 className="text-xl font-semibold text-green-800 mb-2">
                    Solicitud Enviada
                  </h3>
                  <p className="text-green-700">
                    Te contactaremos en menos de 24 horas para coordinar tu demo.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <Label htmlFor="fullName">Nombre Completo *</Label>
                    <Input
                      id="fullName"
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                      className="mt-1.5"
                      placeholder="Tu nombre completo"
                    />
                  </div>

                  <div>
                    <Label htmlFor="restaurantName">Nombre del Restaurante *</Label>
                    <Input
                      id="restaurantName"
                      type="text"
                      required
                      value={formData.restaurantName}
                      onChange={(e) => setFormData(prev => ({ ...prev, restaurantName: e.target.value }))}
                      className="mt-1.5"
                      placeholder="Nombre de tu negocio"
                    />
                  </div>

                  <div>
                    <Label htmlFor="address">Dirección</Label>
                    <Input
                      id="address"
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="mt-1.5"
                      placeholder="Dirección de tu local (opcional)"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="mt-1.5"
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Teléfono *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="mt-1.5"
                      placeholder="787-XXX-XXXX"
                    />
                  </div>

                  {submitError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                      {submitError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full text-white font-semibold"
                    style={{ backgroundColor: JUNTE_ORANGE }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Enviando..." : "Enviar Solicitud"}
                  </Button>

                  <p className="text-center text-sm text-slate-500">
                    Te contactaremos en menos de 24 horas.
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image
                src="/junteready-logo.jpg"
                alt="JunteReady"
                width={120}
                height={32}
                className="h-8 w-auto"
              />
              <span className="text-sm text-slate-500">by PR Delivery</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link href="/catering/partners" className="hover:text-slate-700 font-medium" style={{ color: JUNTE_ORANGE }}>
                Para Restaurantes
              </Link>
              <Link href="/terms" className="hover:text-slate-700">Términos</Link>
              <Link href="/privacy" className="hover:text-slate-700">Privacidad</Link>
              <Link href="/" className="hover:text-slate-700">PR Delivery</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
