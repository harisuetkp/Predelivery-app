"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"
import { Phone, ArrowLeft } from "lucide-react"

interface CustomerAuthFormProps {
  restaurant: {
    name: string
    logo_url: string | null
    primary_color: string | null
  }
  slug: string
  initialMode?: string
  redirectPath?: string
}

export function CustomerAuthForm({ restaurant, slug, initialMode, redirectPath }: CustomerAuthFormProps) {
  const primaryTint = restaurant.primary_color ? { color: restaurant.primary_color } : undefined
  const primaryFill = restaurant.primary_color ? { backgroundColor: restaurant.primary_color } : undefined

  const [mode, setMode] = useState(initialMode === "signup" ? "signup" : "login")
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const router = useRouter()
  const supabase = createBrowserClient()

  const handleSocialLogin = async (provider: "google" | "facebook" | "apple") => {
    setSocialLoading(provider)
    setError("")

    try {
      // Phase 2: send checkout flows directly to /<slug>/checkout after auth,
      // not back to the menu. Cart survives via localStorage[`cart_${id}`].
      const redirectTo =
        redirectPath === "checkout"
          ? `/${slug}/checkout`
          : redirectPath === "catering-checkout"
            ? `/catering/${slug}/customer-auth?redirect=catering-checkout`
            : `/${slug}`

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          ...(provider === "apple" ? { scopes: "name email" } : {}),
        },
      })

      if (error) throw error
    } catch (err: any) {
      setError(err.message || `Error al iniciar sesion con ${provider}`)
      setSocialLoading(null)
    }
  }

  // Phone OTP handlers - Using Twilio Verify API
  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      setError("Por favor ingresa un numero de telefono valido")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Format phone number with country code if not present
      const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`

      // Use Twilio Verify API instead of Supabase phone auth
      const response = await fetch("/api/auth/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al enviar codigo")
      }

      setOtpSent(true)
      setMessage(`Codigo enviado a ${formattedPhone}`)
    } catch (err: any) {
      setError(err.message || "Error al enviar el codigo")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      setError("Por favor ingresa el codigo de 6 digitos")
      return
    }

    setLoading(true)
    setError("")

    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`

      // Verify code with Twilio Verify API (this creates/gets user on server)
      const response = await fetch("/api/auth/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone, code: otp }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Codigo invalido")
      }

      // Code verified and user created/found on server!
      // Now sign in using anonymous sign in and link to the phone user
      // Or redirect to a special callback that establishes the session

      // Use the sign-in callback to establish session server-side
      const callbackResponse = await fetch("/api/auth/phone/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.userId, phone: formattedPhone }),
      })

      if (callbackResponse.ok) {
        // Session established, refresh to pick it up.
        // Phase 2: checkout flow lands on /<slug>/checkout directly.
        if (redirectPath === "checkout") {
          window.location.href = `/${slug}/checkout`
        } else if (redirectPath === "catering-checkout") {
          window.location.href = `/catering/${slug}?redirect=catering-checkout`
        } else {
          window.location.href = `/${slug}/${redirectPath || ""}`
        }
      } else {
        // Fallback: still redirect, the cookie might be set
        if (redirectPath === "checkout") {
          window.location.href = `/${slug}/checkout`
        } else if (redirectPath === "catering-checkout") {
          window.location.href = `/catering/${slug}?redirect=catering-checkout`
        } else {
          window.location.href = `/${slug}/${redirectPath || ""}`
        }
      }
    } catch (err: any) {
      setError(err.message || "Codigo invalido")
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")
    setLoading(true)

    try {
      if (mode === "signup") {
        // Phase 2: email-confirm link lands on /<slug>/checkout directly for OO checkout flow.
        const confirmRedirect =
          redirectPath === "checkout"
            ? `${window.location.origin}/${slug}/checkout`
            : redirectPath === "catering-checkout"
              ? `${window.location.origin}/catering/${slug}?redirect=catering-checkout`
              : `${window.location.origin}/${slug}/${redirectPath || ""}`

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: confirmRedirect,
          },
        })

        if (error) throw error

        // Detect repeated signup: when email is already registered and confirmed,
        // Supabase returns a user object with an empty identities array and no session.
        // Tell the user to log in instead of showing the misleading "check your email" message.
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError("Este correo ya está registrado. Por favor inicia sesión.")
          return
        }

        // If user is auto-confirmed (no email verification required), redirect immediately.
        // Phase 2: checkout flow goes straight to /<slug>/checkout.
        if (data.session) {
          window.location.href =
            redirectPath === "checkout"
              ? `/${slug}/checkout`
              : redirectPath === "catering-checkout"
                ? `/catering/${slug}?redirect=catering-checkout`
                : `/${slug}/${redirectPath || ""}`
          return
        }

        setMessage("Cuenta creada. Por favor revisa tu correo para verificar tu cuenta.")
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        // Phase 2: checkout login lands directly on /<slug>/checkout (cart is in
        // localStorage by restaurant.id and survives the auth round-trip).
        if (redirectPath === "checkout") {
          window.location.href = `/${slug}/checkout`
        } else if (redirectPath === "catering-checkout") {
          window.location.href = `/catering/${slug}?redirect=catering-checkout`
        } else {
          router.push(`/${slug}/${redirectPath || ""}`)
          router.refresh()
        }
      }
    } catch (err: any) {
      setError(err.message || "Error de autenticacion")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header with back to menu link */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={`/${slug}?cart=open`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Volver al Menu</span>
          </Link>
          <Image
            src="/foodnetpr-logo.png"
            alt="FoodNetPR"
            width={100}
            height={30}
            className="h-6 w-auto"
          />
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          {restaurant.logo_url && (
            <div className="flex justify-center">
              <Image
                src={restaurant.logo_url || "/placeholder.svg"}
                alt={restaurant.name}
                width={200}
                height={80}
                className="h-14 w-auto object-contain"
              />
            </div>
          )}
          <div>
            <CardTitle className="text-2xl">{mode === "login" ? "Bienvenido" : "Crear Cuenta"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? `Inicia sesion en tu cuenta de ${restaurant.name}`
                : `Unete a ${restaurant.name} para rastrear pedidos y guardar favoritos`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 mb-4">
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-3 h-11"
              disabled={socialLoading !== null}
              onClick={() => handleSocialLogin("google")}
            >
              {socialLoading === "google" ? (
                <span className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Continuar con Google
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-3 h-11"
              disabled={socialLoading !== null}
              onClick={() => handleSocialLogin("apple")}
            >
              {socialLoading === "apple" ? (
                <span className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              )}
              Continuar con Apple
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-3 h-11"
              disabled={socialLoading !== null}
              onClick={() => setAuthMethod("phone")}
            >
              <Phone className="h-5 w-5" />
              Continuar con Telefono
            </Button>
          </div>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {authMethod === "phone" ? "o con otro metodo" : "o con email"}
              </span>
            </div>
          </div>

          {authMethod === "phone" ? (
            /* Phone OTP Form */
            <div className="space-y-4">
              {!otpSent ? (
                <>
                  <div>
                    <Label htmlFor="phone">Numero de Telefono</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="787-000-0000"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Te enviaremos un codigo de verificacion</p>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
                  )}

                  <Button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="w-full"
                    style={primaryFill}
                  >
                    {loading ? "Enviando..." : "Enviar Codigo"}
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="otp">Codigo de Verificacion</Label>
                    <Input
                      id="otp"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="mt-1 text-center text-2xl tracking-widest"
                      maxLength={6}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Ingresa el codigo de 6 digitos enviado a {phone}</p>
                  </div>

                  {message && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
                      {message}
                    </div>
                  )}
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
                  )}

                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={loading}
                    className="w-full"
                    style={primaryFill}
                  >
                    {loading ? "Verificando..." : "Verificar Codigo"}
                  </Button>

                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtp(""); setError(""); setMessage(""); }}
                    className="w-full text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cambiar numero o reenviar codigo
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => { setAuthMethod("email"); setOtpSent(false); setOtp(""); setError(""); setMessage(""); }}
                className="w-full text-sm font-medium hover:underline"
                style={primaryTint}
              >
                Usar email en su lugar
              </button>
            </div>
          ) : (
            /* Email Form */
            <form onSubmit={handleAuth} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="email">Correo Electronico</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="password">Contrasena</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1"
                />
                {mode === "signup" && <p className="text-xs text-muted-foreground mt-1">Minimo 6 caracteres</p>}
              </div>

              {message && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
                  {message}
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                style={primaryFill}
              >
                {loading ? "Por favor espera..." : mode === "login" ? "Iniciar Sesion" : "Crear Cuenta"}
              </Button>
            </form>
          )}

          {authMethod === "email" && (
            <div className="mt-4 text-center text-sm">
              {mode === "login" ? (
                <p>
                  No tienes cuenta?{" "}
                  <button
                    onClick={() => setMode("signup")}
                    className="font-medium hover:underline"
                    style={primaryTint}
                  >
                    Registrate
                  </button>
                </p>
              ) : (
                <p>
                  Ya tienes cuenta?{" "}
                  <button
                    onClick={() => setMode("login")}
                    className="font-medium hover:underline"
                    style={primaryTint}
                  >
                    Inicia sesion
                  </button>
                </p>
              )}
            </div>
          )}

        </CardContent>
      </Card>
      </div>
    </div>
  )
}
