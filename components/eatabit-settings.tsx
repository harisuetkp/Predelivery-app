"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { 
  Printer, Cloud, CheckCircle, AlertCircle, Loader2, ExternalLink, 
  Bluetooth, Info
} from "lucide-react"

interface EatabitSettingsProps {
  entityType: "restaurant" | "branch"
  settings: {
    eatabit_enabled: boolean
    eatabit_printer_id: string
  }
  onChange: (settings: Partial<EatabitSettingsProps["settings"]>) => void
  onSave?: () => Promise<void>
}

export function EatabitSettings({ 
  entityType,
  settings, 
  onChange,
  onSave,
}: EatabitSettingsProps) {
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [testMessage, setTestMessage] = useState("")
  const [saving, setSaving] = useState(false)

  const handleTestPrint = async () => {
    if (!settings.eatabit_printer_id) {
      setTestStatus("error")
      setTestMessage("Por favor ingresa un Printer ID")
      return
    }

    setTestStatus("testing")
    setTestMessage("Enviando prueba...")

    try {
      const res = await fetch("/api/eatabit/print-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          testPrint: true,
          printerId: settings.eatabit_printer_id 
        }),
      })
      const data = await res.json()
      
      if (data.success) {
        setTestStatus("success")
        setTestMessage("Prueba enviada - revisa tu impresora")
      } else {
        setTestStatus("error")
        setTestMessage(data.error || "Error al enviar prueba")
      }
    } catch (error: any) {
      setTestStatus("error")
      setTestMessage(error.message || "Error de conexion")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Impresion en la Nube (Eatabit)
        </CardTitle>
        <CardDescription>
          Imprime automaticamente los pedidos en tu impresora termica via WiFi usando Eatabit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Method Selection Info */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-900">Opciones de Impresion</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li className="flex items-center gap-2">
                  <Bluetooth className="h-4 w-4" />
                  <span><strong>Bluetooth:</strong> Conecta desde el tablet/KDS directamente a la impresora</span>
                </li>
                <li className="flex items-center gap-2">
                  <Cloud className="h-4 w-4" />
                  <span><strong>Eatabit:</strong> Imprime automaticamente cuando llega un pedido (WiFi)</span>
                </li>
              </ul>
              <p className="text-xs text-blue-600">
                Ambos metodos pueden estar activos simultaneamente.
              </p>
            </div>
          </div>
        </div>

        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-gray-600" />
              <span className="font-medium">Impresion Automatica Eatabit</span>
            </div>
            <p className="text-sm text-gray-500">
              Imprimir pedidos automaticamente al completar el pago
            </p>
          </div>
          <Switch
            checked={settings.eatabit_enabled}
            onCheckedChange={(checked) => onChange({ eatabit_enabled: checked })}
          />
        </div>

        {/* Printer ID Input */}
        {settings.eatabit_enabled && (
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="eatabit_printer_id">Printer ID</Label>
              <Input
                id="eatabit_printer_id"
                placeholder="ej: abc123def456"
                value={settings.eatabit_printer_id || ""}
                onChange={(e) => onChange({ eatabit_printer_id: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Encuentra tu Printer ID en el dashboard de Eatabit despues de registrar tu impresora.
              </p>
              {onSave && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await onSave()
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar Printer ID"
                  )}
                </Button>
              )}
            </div>

            {/* Test Print Button */}
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={handleTestPrint}
                disabled={testStatus === "testing" || !settings.eatabit_printer_id}
              >
                {testStatus === "testing" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 h-4 w-4" />
                    Prueba de Impresion
                  </>
                )}
              </Button>
              {testStatus === "success" && (
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  {testMessage}
                </div>
              )}
              {testStatus === "error" && (
                <div className="flex items-center gap-1 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {testMessage}
                </div>
              )}
            </div>

            {/* Status Badges */}
            {settings.eatabit_printer_id && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Configurado
                </Badge>
                <Badge variant="secondary">
                  {entityType === "branch" ? "Sucursal" : "Restaurante"}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Setup Instructions */}
        <div className="p-4 bg-gray-50 rounded-lg text-sm">
          <p className="font-medium mb-2">Como configurar Eatabit:</p>
          <ol className="space-y-1 list-decimal list-inside text-gray-600">
            <li>Compra una impresora Eatabit o registra una compatible</li>
            <li>Conecta la impresora a tu red WiFi</li>
            <li>Registra la impresora en <a href="https://eatabit.io/user" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">eatabit.io/user</a></li>
            <li>Copia el Printer ID del dashboard</li>
            <li>Pega el Printer ID aqui y haz una prueba</li>
          </ol>
        </div>

        {/* External Link */}
        <Button variant="outline" className="w-full gap-2" asChild>
          <a href="https://eatabit.io/user" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Ir a Eatabit Dashboard
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
