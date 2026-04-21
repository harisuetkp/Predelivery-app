"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Monitor, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import Image from "next/image"

export function SetupClient() {
  const router = useRouter()
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ restaurantName: string; url: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const cleanCode = token.trim().toUpperCase()
    
    if (!cleanCode) {
      setError("Por favor ingresa el código de acceso")
      return
    }

    if (cleanCode.length < 5 || cleanCode.length > 6) {
      setError("El código debe tener 5-6 caracteres")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/setup/validate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cleanCode }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || "Código no válido. Verifica e intenta de nuevo.")
        setLoading(false)
        return
      }

      // Show success state briefly before redirecting
      setSuccess({
        restaurantName: data.restaurantName,
        url: data.redirectUrl,
      })

      // Redirect after a brief delay to show success
      setTimeout(() => {
        router.push(data.redirectUrl)
      }, 1500)

    } catch (err) {
      setError("Error de conexión. Verifica tu internet e intenta de nuevo.")
      setLoading(false)
    }
  }

  // Format code as user types (uppercase, no spaces, max 6 chars)
  const handleCodeChange = (value: string) => {
    // Remove any non-alphanumeric characters and convert to uppercase
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6)
    setToken(cleaned)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <Image
              src="/foodnetpr-logo.png"
              alt="PR Delivery"
              width={160}
              height={48}
              className="h-10 w-auto mx-auto"
            />
          </div>
          <div>
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <Monitor className="h-6 w-6" />
              Configurar Dispositivo
            </CardTitle>
            <CardDescription className="mt-2">
              Ingresa el código de acceso para conectar esta tablet al KDS del restaurante
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <p className="text-lg font-semibold text-green-700">Conectado</p>
                <p className="text-slate-600">{success.restaurantName}</p>
              </div>
              <p className="text-sm text-slate-500">Redirigiendo al KDS...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="token" className="text-sm font-medium text-slate-700">
                  Código de Acceso
                </label>
                <Input
                  id="token"
                  type="text"
                  value={token}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  onInput={(e) => {
                    // Android Chrome fix: also handle onInput event
                    const input = e.target as HTMLInputElement
                    handleCodeChange(input.value)
                  }}
                  placeholder="Ej: ABC123"
                  className="text-center text-2xl font-mono tracking-[0.3em] h-16 uppercase"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  disabled={loading}
                  maxLength={6}
                />
                <p className="text-xs text-slate-500 text-center">
                  Solicita el código al administrador del restaurante
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-lg"
                disabled={loading || token.trim().length < 5}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Conectar"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-slate-400 text-center">
        Para soporte técnico contacta al equipo de PR Delivery
      </p>
    </div>
  )
}
