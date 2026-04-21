"use client"

import { useState, Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { CreditCard, Shield, BarChart3, Clock, CheckCircle2, AlertCircle, Loader2, User, Building2, Landmark, Check, Lock, Globe, Star } from "lucide-react"
import { submitStripeConnect } from "./actions"

const NAVY = "#1E3A5F"
const ORANGE = "#F2901C"
const STRIPE_PURPLE = "#635BFF"

// Wrap the main content in a component that uses useSearchParams
function StripeConnectContent() {
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null)
  
  // Form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [email, setEmail] = useState("")

  // Handle URL params for refresh and success states
  const isRefresh = searchParams.get("refresh") === "true"
  const isSuccess = searchParams.get("success") === "true"

  // Don't clear form on success - keep it visible but disabled
  // in case user needs to reference what they entered

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)
    setOnboardingUrl(null)

    try {
      const result = await submitStripeConnect({
        first_name: firstName,
        last_name: lastName,
        business_name: businessName,
        email,
        tent: "multiple",
      })

      if (result.success && result.onboardingUrl) {
        setOnboardingUrl(result.onboardingUrl)
        setSubmitSuccess(true)
        // Immediately open Stripe in new tab
        window.open(result.onboardingUrl, "_blank")
      }
    } catch (error) {
      setSubmitError((error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 py-3">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-3">
          <img src="/foodnet-logo.png" alt="FoodNet" className="h-8 w-8 rounded" />
          <span className="text-slate-400">+</span>
          <Image src="/junteready-logo.jpg" alt="JunteReady" width={32} height={32} className="h-8 w-8 rounded" />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-white py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          {/* Platform logos */}
          <div className="flex items-center justify-center gap-10 md:gap-16 mb-10">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-white shadow-md flex items-center justify-center overflow-hidden">
                <img
                  src="/foodnet-logo.png"
                  alt="FoodNet Delivery"
                  className="w-16 h-16 md:w-20 md:h-20 object-contain"
                />
              </div>
              <span className="mt-2 text-xs md:text-sm font-medium text-slate-600">FoodNet Delivery</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-white shadow-md flex items-center justify-center overflow-hidden">
                <Image
                  src="/junteready-logo.jpg"
                  alt="JunteReady"
                  width={80}
                  height={80}
                  className="w-16 h-16 md:w-20 md:h-20 object-contain"
                />
              </div>
              <span className="mt-2 text-xs md:text-sm font-medium text-slate-600">JunteReady</span>
            </div>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: NAVY }}>
            Acepta pagos directamente en tu cuenta
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Conecta tu cuenta de Stripe y recibe el dinero de tus órdenes directamente, sin intermediarios.
          </p>
          <Button
            size="lg"
            className="text-lg px-8 py-6"
            style={{ backgroundColor: NAVY }}
            onClick={() => document.getElementById("form")?.scrollIntoView({ behavior: "smooth" })}
          >
            Comenzar Ahora
          </Button>
        </div>
      </section>

      {/* Trust Bar - Security Signals */}
      <section className="py-4" style={{ backgroundColor: NAVY }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 text-white text-sm">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>Encriptación SSL 256-bit</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Certificado PCI DSS Level 1</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span>Stripe opera en 46+ países</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              <span>Usado por Amazon, Google y Shopify</span>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 md:py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12" style={{ color: NAVY }}>
            ¿Por qué conectar tu cuenta de Stripe?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <BenefitCard
              icon={<CreditCard className="w-8 h-8" />}
              title="Pagos Directos"
              description="El dinero va directo a tu cuenta bancaria sin pasar por nosotros"
              color={ORANGE}
            />
            <BenefitCard
              icon={<Shield className="w-8 h-8" />}
              title="Seguridad Total"
              description="Stripe maneja toda la seguridad y cumplimiento PCI de tus transacciones"
              color={STRIPE_PURPLE}
            />
            <BenefitCard
              icon={<BarChart3 className="w-8 h-8" />}
              title="Dashboard Propio"
              description="Accede a tu propio dashboard de Stripe para ver reportes y transacciones"
              color={NAVY}
            />
            <BenefitCard
              icon={<Clock className="w-8 h-8" />}
              title="Setup en Minutos"
              description="Completa el proceso de verificación de Stripe en menos de 7 minutos"
              color={ORANGE}
            />
          </div>
        </div>
      </section>

      {/* Stripe Credibility Section */}
      <section className="py-16 md:py-20 bg-slate-100">
        <div className="max-w-4xl mx-auto px-4 text-center">
          {/* Stripe Logo */}
          <div className="mb-6">
            <span className="text-4xl font-bold" style={{ color: STRIPE_PURPLE }}>Stripe</span>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-bold mb-8" style={{ color: NAVY }}>
            Tus pagos protegidos por Stripe
          </h2>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2" style={{ color: STRIPE_PURPLE }}>$1T+</div>
              <p className="text-slate-600">Procesado anualmente</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2" style={{ color: STRIPE_PURPLE }}>135+</div>
              <p className="text-slate-600">Monedas soportadas</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2" style={{ color: STRIPE_PURPLE }}>99.999%</div>
              <p className="text-slate-600">Uptime garantizado</p>
            </div>
          </div>

          {/* Trust Paragraphs */}
          <div className="max-w-2xl mx-auto space-y-4 text-slate-600">
            <p>
              Stripe es la infraestructura de pagos más avanzada del mundo. Empresas como Amazon, Google, Shopify, Lyft y miles de negocios en Puerto Rico confían en Stripe para procesar sus pagos de forma segura.
            </p>
            <p className="font-medium text-slate-700">
              Tu información bancaria y personal nunca pasa por nuestros servidores — va directamente y de forma encriptada a Stripe.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12" style={{ color: NAVY }}>
            ¿Cómo funciona?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              step="01"
              title="Completa el formulario"
              description="Ingresa tu información básica de negocio"
            />
            <StepCard
              step="02"
              title="Verifica con Stripe"
              description="Stripe te enviará un link para completar la verificación de tu cuenta"
            />
            <StepCard
              step="03"
              title="Empieza a cobrar"
              description="Una vez verificado, todos tus pagos van directo a tu cuenta"
            />
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section id="form" className="py-16 md:py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4">
          {/* URL param messages */}
          {isRefresh && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800">
                El link expiró. Por favor completa el formulario nuevamente.
              </p>
            </div>
          )}
          
          {isSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-green-800">
                ¡Tu cuenta de Stripe ha sido verificada exitosamente! Ya puedes recibir pagos.
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Column - Info Panel */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 md:p-8 h-fit md:sticky md:top-8">
              <h3 className="text-xl font-bold mb-2" style={{ color: NAVY }}>
                Ten esto a mano antes de comenzar
              </h3>
              <p className="text-slate-600 text-sm mb-6">
                Stripe te pedirá esta información durante el proceso. Tenerla lista hace el proceso más rápido.
              </p>

              {/* Section 1 - Personal Info */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-amber-700" />
                  </div>
                  <span className="font-semibold text-slate-800">Información Personal</span>
                </div>
                <ul className="space-y-2 pl-10">
                  <li className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-amber-600 shrink-0" />
                    Nombre legal completo
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-amber-600 shrink-0" />
                    Fecha de nacimiento
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-amber-600 shrink-0" />
                    Últimos 4 dígitos del SSN (o ID equivalente)
                  </li>
                </ul>
              </div>

              <div className="border-t border-amber-200 my-4" />

              {/* Section 2 - Business Info */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-amber-700" />
                  </div>
                  <span className="font-semibold text-slate-800">Información del Negocio</span>
                </div>
                <ul className="space-y-2 pl-10">
                  <li className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-amber-600 shrink-0" />
                    Nombre legal del negocio
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-amber-600 shrink-0" />
                    Dirección del negocio
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-amber-600 shrink-0" />
                    Teléfono del negocio
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-amber-600 shrink-0" />
                    EIN / Tax ID (si está incorporado)
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-amber-600 shrink-0" />
                    Sitio web (opcional)
                  </li>
                </ul>
              </div>

              <div className="border-t border-amber-200 my-4" />

              {/* Section 3 - Banking Info */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center">
                    <Landmark className="w-4 h-4 text-amber-700" />
                  </div>
                  <span className="font-semibold text-slate-800">Información Bancaria</span>
                </div>
                <ul className="space-y-2 pl-10">
                  <li className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-amber-600 shrink-0" />
                    Número de cuenta bancaria
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-amber-600 shrink-0" />
                    Número de ruta (routing number)
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-amber-600 shrink-0" />
                    Nombre del titular de la cuenta
                  </li>
                </ul>
              </div>

              <div className="border-t border-amber-200 my-4" />

              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4 text-amber-600" />
                El proceso toma aproximadamente 7 minutos.
              </div>
            </div>

            {/* Right Column - Form */}
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: NAVY }}>
                  Conecta tu cuenta
                </h2>
                <p className="text-slate-600 mb-4">
                  Completa el formulario para iniciar el proceso de verificación con Stripe.
                </p>
                {/* Security Badges */}
                <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded">
                    <span className="font-bold text-xs" style={{ color: STRIPE_PURPLE }}>Stripe</span>
                    <span>Powered</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded">
                    <Lock className="w-3 h-3" />
                    <span>Conexión segura</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded">
                    <Shield className="w-3 h-3" />
                    <span>PCI DSS Compliant</span>
                  </div>
                </div>
              </div>

              <Card className="shadow-lg">
                <CardContent className="p-6 md:p-8">
                  {submitSuccess && onboardingUrl ? (
                    <div className="text-center py-6">
                      <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
                      <h3 className="text-xl font-bold mb-3" style={{ color: NAVY }}>
                        ¡Stripe se ha abierto en una nueva pestaña!
                      </h3>
                      <p className="text-slate-600 mb-6">
                        Completa tu verificación ahora para empezar a recibir pagos.
                      </p>
                      <p className="text-slate-500 text-sm mb-3">
                        Si la pestaña no abrió automáticamente, haz clic aquí:
                      </p>
                      <a
                        href={onboardingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-colors hover:opacity-90"
                        style={{ backgroundColor: "#635BFF" }}
                      >
                        Abrir Stripe
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </a>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                      {submitError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                          <p className="text-red-800 text-sm">{submitError}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">Nombre *</Label>
                          <Input
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                            placeholder="Juan"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Apellido *</Label>
                          <Input
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                            placeholder="Pérez"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="businessName">Nombre del Restaurante, Comercio o Localidad *</Label>
                        <Input
                          id="businessName"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          required
                          placeholder="Mi Restaurante"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="juan@mirestaurante.com"
                        />
                      </div>

                      {/* Security Reassurance */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
                        <Shield className="w-5 h-5 shrink-0 mt-0.5" style={{ color: STRIPE_PURPLE }} />
                        <div className="text-slate-700 text-sm">
                          <p className="mb-1">
                            <strong>Tu información está protegida.</strong> Al hacer clic, Stripe abrirá en una nueva pestaña donde completarás tu verificación.
                          </p>
                          <p className="text-slate-500">
                            Nosotros nunca tenemos acceso a tu información bancaria ni datos sensibles.
                          </p>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full py-6 text-lg"
                        style={{ backgroundColor: NAVY }}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            Completar con Stripe
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <img src="/foodnet-logo.png" alt="FoodNet" className="h-5 w-5 rounded" />
              <span className="text-slate-300">|</span>
              <Image src="/junteready-logo.jpg" alt="JunteReady" width={20} height={20} className="h-5 w-5 rounded" />
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link href="/terms" className="hover:text-slate-700">
                Términos
              </Link>
              <Link href="/privacy" className="hover:text-slate-700">
                Privacidad
              </Link>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>Powered by</span>
              <svg width="49" height="20" viewBox="0 0 49 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.32 4.15C21.28 4.15 20.56 4.43 20.16 4.99L20.08 4.27H17.92V16H20.32V11.67C20.72 12.11 21.4 12.33 22.32 12.33C24.56 12.33 26.32 10.43 26.32 8.23C26.32 6.03 24.56 4.15 22.32 4.15ZM21.84 10.19C20.88 10.19 20.24 9.39 20.24 8.27C20.24 7.15 20.88 6.31 21.84 6.31C22.8 6.31 23.44 7.11 23.44 8.23C23.44 9.35 22.8 10.19 21.84 10.19ZM30.16 4.15C28.24 4.15 26.88 5.19 26.88 6.79C26.88 8.11 27.68 8.95 29.44 9.39L30.56 9.67C31.28 9.87 31.6 10.11 31.6 10.55C31.6 11.07 31.12 11.43 30.32 11.43C29.44 11.43 28.72 11.03 28.56 10.27L26.24 10.71C26.56 12.19 28.08 13.11 30.32 13.11C32.4 13.11 33.92 11.99 33.92 10.31C33.92 8.99 33.12 8.23 31.36 7.79L30.24 7.51C29.44 7.31 29.2 7.07 29.2 6.67C29.2 6.19 29.64 5.87 30.32 5.87C31.04 5.87 31.6 6.23 31.76 6.83L34 6.43C33.68 5.07 32.24 4.15 30.16 4.15ZM43.12 4.27L40.96 10.19L38.8 4.27H36.16L39.68 12.15L37.6 16.99H40.24L45.76 4.27H43.12ZM11.52 7.43C11.52 6.75 12.08 6.47 12.88 6.47C13.92 6.47 14.72 6.95 15.12 7.79L17.12 6.67C16.4 5.19 14.88 4.15 12.88 4.15C10.72 4.15 9.04 5.35 9.04 7.19C9.04 9.87 12.72 10.11 12.72 11.27C12.72 11.83 12.16 12.15 11.28 12.15C10.08 12.15 9.2 11.55 8.8 10.55L6.72 11.71C7.44 13.31 9.2 14.27 11.28 14.27C13.52 14.27 15.28 13.15 15.28 11.19C15.28 8.35 11.52 8.19 11.52 7.43ZM5.84 4.27H3.44V2.15L1.04 2.67V4.27H0V6.47H1.04V10.47C1.04 12.71 2.24 13.51 5.84 13.03V10.91C4.4 11.03 3.44 11.07 3.44 10.23V6.47H5.84V4.27ZM48.24 8.23C48.24 5.95 46.48 4.15 44.16 4.15C41.68 4.15 39.84 6.03 39.84 8.23C39.84 10.51 41.84 12.31 44.32 12.31C45.84 12.31 47.12 11.63 47.76 10.59L45.84 9.51C45.52 9.95 44.96 10.23 44.32 10.23C43.36 10.23 42.56 9.67 42.32 8.79H48.16C48.24 8.59 48.24 8.39 48.24 8.23ZM42.32 7.35C42.56 6.55 43.2 6.07 44.08 6.07C44.96 6.07 45.6 6.55 45.84 7.35H42.32Z" fill="#635BFF"/>
              </svg>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Default export wraps with Suspense to handle useSearchParams
export default function StripeConnectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <StripeConnectContent />
    </Suspense>
  )
}

function BenefitCard({ icon, title, description, color }: { icon: React.ReactNode; title: string; description: string; color: string }) {
  return (
    <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
      <CardContent className="p-6 text-center">
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        <h3 className="font-bold text-lg mb-2" style={{ color: NAVY }}>{title}</h3>
        <p className="text-slate-600 text-sm">{description}</p>
      </CardContent>
    </Card>
  )
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-bold" style={{ backgroundColor: ORANGE }}>
        {step}
      </div>
      <h3 className="font-bold text-lg mb-2" style={{ color: NAVY }}>{title}</h3>
      <p className="text-slate-600 text-sm">{description}</p>
    </div>
  )
}
