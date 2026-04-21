"use client"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertTriangle, Clock, Power, PowerOff, Calendar,
  Save, X, Building2, Loader2, Plus, Trash2,
  DollarSign, Package, History,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CateringPortal {
  id: string
  name: string
  slug: string
  is_active: boolean
  is_manually_blocked: boolean
}

interface PlatformSettings {
  id: string
  is_platform_open: boolean
  operating_hours_start: string
  operating_hours_end: string
  operating_days: Record<string, boolean>
  emergency_block_active: boolean
  emergency_block_reason: string | null
  blocked_zip_codes: string[]
  delivery_fee_subsidy: string
  is_internal_shop_open: boolean
  internal_shop_delivery_fee: string
  internal_shop_min_order: string
  internal_shop_standalone_enabled: boolean
  default_lead_time_hours: number
  blackout_dates: string[]
  max_events_per_day: number | null
}

interface ScheduledBlock {
  id: string
  restaurant_id: string | null
  block_type: string
  starts_at: string
  ends_at: string
  reason: string | null
  is_active: boolean
}

interface Props {
  portals: CateringPortal[]
  platformSettings: PlatformSettings
  scheduledBlocks: ScheduledBlock[]
  operatorName: string
}

const DAYS_OF_WEEK = [
  { key: "sunday", label: "D", fullLabel: "Domingo" },
  { key: "monday", label: "L", fullLabel: "Lunes" },
  { key: "tuesday", label: "M", fullLabel: "Martes" },
  { key: "wednesday", label: "X", fullLabel: "Miércoles" },
  { key: "thursday", label: "J", fullLabel: "Jueves" },
  { key: "friday", label: "V", fullLabel: "Viernes" },
  { key: "saturday", label: "S", fullLabel: "Sábado" },
]

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const min = i % 2 === 0 ? "00" : "30"
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const ampm = hour < 12 ? "AM" : "PM"
  const value = `${String(hour).padStart(2, "0")}:${min}:00`
  return { label: `${h12}:${min} ${ampm}`, value }
})

const PR_ZIP_CODES = [
  { zip: "00901", label: "Viejo San Juan" },
  { zip: "00907", label: "Condado" },
  { zip: "00909", label: "Santurce" },
  { zip: "00917", label: "Hato Rey" },
  { zip: "00918", label: "Hato Rey Norte" },
  { zip: "00921", label: "Río Piedras" },
  { zip: "00926", label: "Cupey" },
  { zip: "00927", label: "Río Piedras Norte" },
  { zip: "00949", label: "Toa Baja" },
  { zip: "00956", label: "Bayamón" },
  { zip: "00966", label: "Guaynabo" },
  { zip: "00979", label: "Carolina" },
  { zip: "00983", label: "Isla Verde" },
]

const DEFAULT_SETTINGS: PlatformSettings = {
  id: "",
  is_platform_open: true,
  operating_hours_start: "09:00:00",
  operating_hours_end: "21:00:00",
  operating_days: {
    sunday: true, monday: true, tuesday: true, wednesday: true,
    thursday: true, friday: true, saturday: true,
  },
  emergency_block_active: false,
  emergency_block_reason: null,
  blocked_zip_codes: [],
  delivery_fee_subsidy: "0.00",
  is_internal_shop_open: false,
  internal_shop_delivery_fee: "0",
  internal_shop_min_order: "0",
  internal_shop_standalone_enabled: false,
  default_lead_time_hours: 48,
  blackout_dates: [],
  max_events_per_day: null,
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-PR", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  })
}

export function CateringOperationsTab({ portals, platformSettings: incoming, scheduledBlocks: initialBlocks, operatorName }: Props) {
  const [settings, setSettings] = useState<PlatformSettings>({ ...DEFAULT_SETTINGS, ...incoming })
  const [localPortals, setLocalPortals] = useState(portals)
  const [scheduledBlocks, setScheduledBlocks] = useState(initialBlocks)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Scheduled block modal
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockPortalId, setBlockPortalId] = useState<string>("system")
  const [blockStartDate, setBlockStartDate] = useState("")
  const [blockStartTime, setBlockStartTime] = useState("09:00:00")
  const [blockEndDate, setBlockEndDate] = useState("")
  const [blockEndTime, setBlockEndTime] = useState("21:00:00")
  const [blockReason, setBlockReason] = useState("")

  // Blackout date modal
  const [showBlackoutModal, setShowBlackoutModal] = useState(false)
  const [newBlackoutDate, setNewBlackoutDate] = useState("")

  // Lead time state
  const [leadTimeInput, setLeadTimeInput] = useState(String(settings.default_lead_time_hours))
  const [maxEventsInput, setMaxEventsInput] = useState(String(settings.max_events_per_day ?? ""))

  async function saveSettings(patch: Partial<PlatformSettings>) {
    setIsSaving(true)
    try {
      const res = await fetch("/api/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, tent: "catering" }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setSettings(prev => ({ ...prev, ...patch }))
    } catch (err) {
      alert("Error guardando configuración")
    } finally {
      setIsSaving(false)
    }
  }

  async function togglePlatform() {
    await saveSettings({ is_platform_open: !settings.is_platform_open })
  }

  async function toggleEmergencyBlock() {
    const reason = !settings.emergency_block_active
      ? prompt("Razón del bloqueo de emergencia:") || "Emergencia"
      : null
    await saveSettings({
      emergency_block_active: !settings.emergency_block_active,
      emergency_block_reason: reason,
    })
  }

  async function toggleDay(day: string) {
    const updated = { ...settings.operating_days, [day]: !settings.operating_days[day] }
    await saveSettings({ operating_days: updated })
  }

  async function toggleZip(zip: string, checked: boolean) {
    const updated = checked
      ? [...settings.blocked_zip_codes, zip]
      : settings.blocked_zip_codes.filter(z => z !== zip)
    await saveSettings({ blocked_zip_codes: updated })
  }

  async function togglePortalBlock(portalId: string, currentlyBlocked: boolean) {
    try {
      const res = await fetch(`/api/catering/portals/${portalId}/toggle-block`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_manually_blocked: !currentlyBlocked }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to toggle portal")
      setLocalPortals(prev =>
        prev.map(p => p.id === portalId ? { ...p, is_manually_blocked: !currentlyBlocked } : p)
      )
    } catch (err: any) {
      alert("Error: " + err.message)
    }
  }

  async function createScheduledBlock() {
    if (!blockStartDate || !blockEndDate) return
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: blockPortalId === "system" ? null : blockPortalId,
          block_type: blockPortalId === "system" ? "system" : "restaurant",
          starts_at: `${blockStartDate}T${blockStartTime}`,
          ends_at: `${blockEndDate}T${blockEndTime}`,
          reason: blockReason || null,
          tent: "catering",
        }),
      })
      if (!res.ok) throw new Error("Failed to create block")
      const block = await res.json()
      setScheduledBlocks(prev => [...prev, block])
      setShowBlockModal(false)
      setBlockPortalId("system")
      setBlockStartDate("")
      setBlockEndDate("")
      setBlockReason("")
    } catch {
      alert("Error creando bloqueo")
    }
  }

  async function deleteScheduledBlock(id: string) {
    try {
      await fetch(`/api/blocks/${id}`, { method: "DELETE" })
      setScheduledBlocks(prev => prev.filter(b => b.id !== id))
    } catch {
      alert("Error eliminando bloqueo")
    }
  }

  async function addBlackoutDate() {
    if (!newBlackoutDate) return
    const updated = [...settings.blackout_dates, newBlackoutDate].sort()
    await saveSettings({ blackout_dates: updated })
    setNewBlackoutDate("")
    setShowBlackoutModal(false)
  }

  async function removeBlackoutDate(date: string) {
    const updated = settings.blackout_dates.filter(d => d !== date)
    await saveSettings({ blackout_dates: updated })
  }

  const filteredPortals = localPortals.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!settings) return <div className="p-8 text-red-600">Error loading catering operations settings.</div>

  const statusColor = settings.emergency_block_active
    ? "border-red-500 bg-red-50"
    : settings.is_platform_open
      ? "border-green-500 bg-green-50"
      : "border-amber-500 bg-amber-50"

  return (
    <div className="space-y-6">

      {/* Platform Status */}
      <Card className={cn("border-2", statusColor)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.emergency_block_active ? (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              ) : settings.is_platform_open ? (
                <Power className="w-6 h-6 text-green-600" />
              ) : (
                <PowerOff className="w-6 h-6 text-amber-600" />
              )}
              <div>
                <CardTitle className="text-lg">Estado de Catering</CardTitle>
                <CardDescription>
                  {settings.emergency_block_active
                    ? `Emergencia activa: ${settings.emergency_block_reason || "Sin razón"}`
                    : settings.is_platform_open
                      ? "Catering abierto y aceptando eventos"
                      : "Catering cerrado — no se aceptan nuevas órdenes"}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={settings.is_platform_open ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                {settings.is_platform_open ? "ABIERTO" : "CERRADO"}
              </Badge>
              <Switch
                checked={settings.is_platform_open}
                onCheckedChange={togglePlatform}
                disabled={isSaving}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hours */}
          <div className="flex items-center gap-4 flex-wrap">
            <Clock className="w-4 h-4 text-gray-500" />
            <div className="flex items-center gap-2">
              <Label className="text-sm">Apertura</Label>
              <Select
                value={settings.operating_hours_start}
                onValueChange={(v) => saveSettings({ operating_hours_start: v })}
              >
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Cierre</Label>
              <Select
                value={settings.operating_hours_end}
                onValueChange={(v) => saveSettings({ operating_hours_end: v })}
              >
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Days */}
          <div className="flex items-center gap-2 flex-wrap">
            {DAYS_OF_WEEK.map(day => (
              <button
                key={day.key}
                onClick={() => toggleDay(day.key)}
                className={cn(
                  "w-9 h-9 rounded-full text-sm font-semibold transition-colors",
                  settings.operating_days[day.key]
                    ? "bg-orange-500 text-white"
                    : "bg-gray-200 text-gray-400"
                )}
                title={day.fullLabel}
              >
                {day.label}
              </button>
            ))}
          </div>

          {/* Emergency block */}
          <Button
            variant={settings.emergency_block_active ? "default" : "destructive"}
            size="sm"
            onClick={toggleEmergencyBlock}
            disabled={isSaving}
            className={settings.emergency_block_active ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            {settings.emergency_block_active ? "Desactivar Emergencia" : "Bloqueo de Emergencia"}
          </Button>
        </CardContent>
      </Card>

      {/* Lead Time & Capacity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Lead Time & Capacidad
          </CardTitle>
          <CardDescription>Configuración global de tiempos y capacidad de catering</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lead Time Mínimo (horas)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={leadTimeInput}
                  onChange={(e) => setLeadTimeInput(e.target.value)}
                  className="w-32"
                  min={1}
                />
                <Button
                  size="sm"
                  onClick={() => saveSettings({ default_lead_time_hours: parseInt(leadTimeInput) })}
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 mr-1" /> Guardar
                </Button>
              </div>
              <p className="text-xs text-gray-500">Tiempo mínimo de anticipación para nuevos eventos</p>
            </div>
            <div className="space-y-2">
              <Label>Máximo de Eventos por Día</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={maxEventsInput}
                  onChange={(e) => setMaxEventsInput(e.target.value)}
                  placeholder="Sin límite"
                  className="w-32"
                  min={1}
                />
                <Button
                  size="sm"
                  onClick={() => saveSettings({ max_events_per_day: maxEventsInput ? parseInt(maxEventsInput) : null })}
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 mr-1" /> Guardar
                </Button>
              </div>
              <p className="text-xs text-gray-500">Deja vacío para no tener límite</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Blackout Dates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                Fechas Bloqueadas
              </CardTitle>
              <CardDescription>Fechas en que no se aceptan eventos de catering</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowBlackoutModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> Agregar Fecha
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {settings.blackout_dates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No hay fechas bloqueadas</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {settings.blackout_dates.map(date => (
                <div key={date} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-sm text-red-700 font-medium">{date}</span>
                  <button onClick={() => removeBlackoutDate(date)} className="text-red-400 hover:text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blocked Zip Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zonas Bloqueadas</CardTitle>
          <CardDescription>Códigos postales donde no se ofrece entrega de catering</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {PR_ZIP_CODES.map(({ zip, label }) => (
              <div key={zip} className="flex items-center gap-2">
                <Checkbox
                  id={`zip-${zip}`}
                  checked={settings.blocked_zip_codes.includes(zip)}
                  onCheckedChange={(checked) => toggleZip(zip, !!checked)}
                />
                <label htmlFor={`zip-${zip}`} className="text-sm cursor-pointer">
                  <span className="font-medium">{zip}</span>
                  <span className="text-gray-500 ml-1">{label}</span>
                </label>
              </div>
            ))}
          </div>
          <Button size="sm" className="mt-4" onClick={() => saveSettings({ blocked_zip_codes: settings.blocked_zip_codes })} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            Guardar ({settings.blocked_zip_codes.length} zonas bloqueadas)
          </Button>
        </CardContent>
      </Card>

      {/* Delivery Tier Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-orange-500" />
            Tarifas de Entrega por Distancia
          </CardTitle>
          <CardDescription>Tabla de precios base por milla para eventos de catering</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Tier</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Distancia</th>
                  <th className="text-left py-2 font-medium text-gray-600">Tarifa Base</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }, (_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium text-orange-600">T{i + 1}</td>
                    <td className="py-2 pr-4 text-gray-600">{i}–{i + 1} mi</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">$</span>
                        <Input type="number" className="h-7 w-24 text-sm" placeholder="0.00" step="0.50" min="0" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button size="sm" className="mt-4 bg-orange-500 hover:bg-orange-600 text-white">
            <Save className="w-4 h-4 mr-2" />
            Aplicar a Todos los Portales
          </Button>
        </CardContent>
      </Card>

      {/* Delivery Fee Subsidy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subsidio de Tarifa de Entrega</CardTitle>
          <CardDescription>
            El cliente ve: tarifa completa − subsidio (mínimo $0.00 mostrado).
            Valor actual: ${settings.delivery_fee_subsidy}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="text-gray-500">$</span>
            <Input
              type="number"
              value={settings.delivery_fee_subsidy}
              onChange={(e) => setSettings(prev => ({ ...prev, delivery_fee_subsidy: e.target.value }))}
              className="w-32"
              step="0.50"
              min="0"
            />
            <Button size="sm" onClick={() => saveSettings({ delivery_fee_subsidy: settings.delivery_fee_subsidy })} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" /> Guardar Subsidio
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Catering Shop */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" />
                {operatorName} Catering Shop
              </CardTitle>
              <CardDescription>Shop interno de catering del operador</CardDescription>
            </div>
            <Switch
              checked={settings.is_internal_shop_open}
              onCheckedChange={(v) => saveSettings({ is_internal_shop_open: v })}
              disabled={isSaving}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="catering-shop-standalone"
              checked={settings.internal_shop_standalone_enabled}
              onCheckedChange={(v) => saveSettings({ internal_shop_standalone_enabled: !!v })}
            />
            <label htmlFor="catering-shop-standalone" className="text-sm cursor-pointer">
              Órdenes independientes (sin requerir catering de un portal)
            </label>
          </div>
          {settings.internal_shop_standalone_enabled && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <Label className="text-sm">Tarifa de Entrega</Label>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">$</span>
                  <Input
                    type="number"
                    value={settings.internal_shop_delivery_fee}
                    onChange={(e) => setSettings(prev => ({ ...prev, internal_shop_delivery_fee: e.target.value }))}
                    className="w-28"
                    step="0.50"
                    min="0"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Orden Mínima</Label>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">$</span>
                  <Input
                    type="number"
                    value={settings.internal_shop_min_order}
                    onChange={(e) => setSettings(prev => ({ ...prev, internal_shop_min_order: e.target.value }))}
                    className="w-28"
                    step="1"
                    min="0"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="col-span-2"
                onClick={() => saveSettings({
                  internal_shop_delivery_fee: settings.internal_shop_delivery_fee,
                  internal_shop_min_order: settings.internal_shop_min_order,
                })}
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-2" /> Guardar Shop Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block Portals */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Bloquear Portales</CardTitle>
              <CardDescription>Bloquea o desbloquea portales de catering individualmente</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowBlockModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> Agregar Bloqueo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Buscar portal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-4"
          />
          <div className="space-y-2">
            {filteredPortals.map(portal => (
              <div key={portal.id} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-sm font-medium">{portal.name}</span>
                <div className="flex items-center gap-2">
<Badge className={!portal.is_manually_blocked ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                  {!portal.is_manually_blocked ? "Activo" : "Bloqueado"}
                </Badge>
                <Button
                  size="sm"
                  variant={!portal.is_manually_blocked ? "destructive" : "outline"}
                  onClick={() => togglePortalBlock(portal.id, portal.is_manually_blocked)}
                >
                  {!portal.is_manually_blocked ? "Bloquear" : "Desbloquear"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Blocks Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-5 h-5 text-orange-500" />
            Bloqueos Programados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scheduledBlocks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No hay bloqueos programados</p>
          ) : (
            <div className="space-y-2">
              {scheduledBlocks.map(block => {
                const portal = portals.find(p => p.id === block.restaurant_id)
                return (
                  <div key={block.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{portal?.name || "Sistema completo"}</p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(block.starts_at)} → {formatDateTime(block.ends_at)}
                      </p>
                      {block.reason && <p className="text-xs text-gray-400 mt-0.5">{block.reason}</p>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => deleteScheduledBlock(block.id)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Block Modal */}
      <Dialog open={showBlockModal} onOpenChange={setShowBlockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Bloqueo Programado</DialogTitle>
            <DialogDescription>Bloquea un portal o todo el sistema por un período específico</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Portal</Label>
              <Select value={blockPortalId} onValueChange={setBlockPortalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar portal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Sistema completo (todos los portales)</SelectItem>
                  {portals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fecha inicio</Label>
                <Input type="date" value={blockStartDate} onChange={e => setBlockStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Hora inicio</Label>
                <Select value={blockStartTime} onValueChange={setBlockStartTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fecha fin</Label>
                <Input type="date" value={blockEndDate} onChange={e => setBlockEndDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Hora fin</Label>
                <Select value={blockEndTime} onValueChange={setBlockEndTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Razón (opcional)</Label>
              <Textarea
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
                placeholder="Ej: Mantenimiento, día feriado..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockModal(false)}>Cancelar</Button>
            <Button onClick={createScheduledBlock} disabled={!blockStartDate || !blockEndDate}>
              Crear Bloqueo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blackout Date Modal */}
      <Dialog open={showBlackoutModal} onOpenChange={setShowBlackoutModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Fecha Bloqueada</DialogTitle>
            <DialogDescription>Esta fecha no aceptará nuevos eventos de catering</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input type="date" value={newBlackoutDate} onChange={e => setNewBlackoutDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlackoutModal(false)}>Cancelar</Button>
            <Button onClick={addBlackoutDate} disabled={!newBlackoutDate}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
