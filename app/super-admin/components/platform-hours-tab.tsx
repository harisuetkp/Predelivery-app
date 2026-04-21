"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { saveOperatorHours } from "@/app/super-admin/actions"

export type OperatorHourEntry = {
  day_of_week: number
  breakfast_open: string | null
  breakfast_close: string | null
  lunch_open: string | null
  lunch_close: string | null
  dinner_open: string | null
  dinner_close: string | null
}

const DAY_NAMES: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
}

const DEFAULT_OPERATOR_HOURS: OperatorHourEntry[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  breakfast_open: null,
  breakfast_close: null,
  lunch_open: null,
  lunch_close: null,
  dinner_open: null,
  dinner_close: null,
}))

const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) => [
  `${h.toString().padStart(2, "0")}:00:00`,
  `${h.toString().padStart(2, "0")}:30:00`,
]).flat()

function coerceHours(rows: any[]): OperatorHourEntry[] {
  if (!rows || rows.length === 0) return DEFAULT_OPERATOR_HOURS
  const byDay = new Map<number, OperatorHourEntry>()
  for (const r of rows) {
    byDay.set(Number(r.day_of_week), {
      day_of_week: Number(r.day_of_week),
      breakfast_open: r.breakfast_open ?? null,
      breakfast_close: r.breakfast_close ?? null,
      lunch_open: r.lunch_open ?? null,
      lunch_close: r.lunch_close ?? null,
      dinner_open: r.dinner_open ?? null,
      dinner_close: r.dinner_close ?? null,
    })
  }
  return DEFAULT_OPERATOR_HOURS.map((d) => byDay.get(d.day_of_week) ?? d)
}

export function PlatformHoursTab({
  operatorId,
  operatorHours,
}: {
  operatorId: string
  operatorHours: any[]
}) {
  const router = useRouter()
  const [hours, setHours] = useState<OperatorHourEntry[]>(DEFAULT_OPERATOR_HOURS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setHours(coerceHours(operatorHours))
  }, [operatorHours])

  const copyToAll = (sourceDayIndex: number) => {
    const sourceDay = hours[sourceDayIndex]
    const updated = hours.map((day) => ({
      ...day,
      breakfast_open: sourceDay.breakfast_open,
      breakfast_close: sourceDay.breakfast_close,
      lunch_open: sourceDay.lunch_open,
      lunch_close: sourceDay.lunch_close,
      dinner_open: sourceDay.dinner_open,
      dinner_close: sourceDay.dinner_close,
    }))
    setHours(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveOperatorHours(operatorId, hours)
      if (!result?.success) {
        toast.error(result?.error || "Error guardando horario")
      } else {
        toast.success("Horario guardado exitosamente")
        router.refresh()
      }
    } catch (e: any) {
      toast.error(e?.message || "Error guardando horario")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Horario de Operacion
        </CardTitle>
        <CardDescription>
          Define los horarios de Desayuno, Almuerzo y Cena para cada dia. Use "Cerrado" para indicar que el periodo no esta disponible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <>
          {/* Warning banner */}
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-sm text-cyan-800">
            Los horarios de cada periodo no pueden superponerse. Si ve un error, verifique que los horarios no se solapen.
          </div>

          {/* Table header */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 w-24"></th>
                  <th className="text-center py-2 px-2" colSpan={2}>Desayuno</th>
                  <th className="text-center py-2 px-2" colSpan={2}>Almuerzo</th>
                  <th className="text-center py-2 px-2" colSpan={2}>Cena</th>
                  <th className="py-2 px-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {hours.map((day, idx) => (
                  <tr key={day.day_of_week} className="border-b hover:bg-muted/30">
                    <td className="py-3 px-2 font-medium">{DAY_NAMES[day.day_of_week]}</td>

                    {/* Breakfast */}
                    <td className="py-3 px-1">
                      <Select
                        value={day.breakfast_open || "closed"}
                        onValueChange={(val) => {
                          const updated = [...hours]
                          updated[idx] = { ...updated[idx], breakfast_open: val === "closed" ? null : val }
                          setHours(updated)
                        }}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="closed">Cerrado</SelectItem>
                          {TIME_OPTIONS.map((t) => {
                            const hour = parseInt(t.split(":")[0])
                            const min = t.split(":")[1]
                            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                            const ampm = hour < 12 ? "AM" : "PM"
                            return (
                              <SelectItem key={`bo-${t}`} value={t}>
                                {displayHour}:{min} {ampm}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-1">
                      <Select
                        value={day.breakfast_close || "closed"}
                        onValueChange={(val) => {
                          const updated = [...hours]
                          updated[idx] = { ...updated[idx], breakfast_close: val === "closed" ? null : val }
                          setHours(updated)
                        }}
                        disabled={!day.breakfast_open}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="closed">Cerrado</SelectItem>
                          {TIME_OPTIONS.map((t) => {
                            const hour = parseInt(t.split(":")[0])
                            const min = t.split(":")[1]
                            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                            const ampm = hour < 12 ? "AM" : "PM"
                            return (
                              <SelectItem key={`bc-${t}`} value={t}>
                                {displayHour}:{min} {ampm}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Lunch */}
                    <td className="py-3 px-1">
                      <Select
                        value={day.lunch_open || "closed"}
                        onValueChange={(val) => {
                          const updated = [...hours]
                          updated[idx] = { ...updated[idx], lunch_open: val === "closed" ? null : val }
                          setHours(updated)
                        }}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="closed">Cerrado</SelectItem>
                          {TIME_OPTIONS.map((t) => {
                            const hour = parseInt(t.split(":")[0])
                            const min = t.split(":")[1]
                            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                            const ampm = hour < 12 ? "AM" : "PM"
                            return (
                              <SelectItem key={`lo-${t}`} value={t}>
                                {displayHour}:{min} {ampm}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-1">
                      <Select
                        value={day.lunch_close || "closed"}
                        onValueChange={(val) => {
                          const updated = [...hours]
                          updated[idx] = { ...updated[idx], lunch_close: val === "closed" ? null : val }
                          setHours(updated)
                        }}
                        disabled={!day.lunch_open}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="closed">Cerrado</SelectItem>
                          {TIME_OPTIONS.map((t) => {
                            const hour = parseInt(t.split(":")[0])
                            const min = t.split(":")[1]
                            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                            const ampm = hour < 12 ? "AM" : "PM"
                            return (
                              <SelectItem key={`lc-${t}`} value={t}>
                                {displayHour}:{min} {ampm}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Dinner */}
                    <td className="py-3 px-1">
                      <Select
                        value={day.dinner_open || "closed"}
                        onValueChange={(val) => {
                          const updated = [...hours]
                          updated[idx] = { ...updated[idx], dinner_open: val === "closed" ? null : val }
                          setHours(updated)
                        }}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="closed">Cerrado</SelectItem>
                          {TIME_OPTIONS.map((t) => {
                            const hour = parseInt(t.split(":")[0])
                            const min = t.split(":")[1]
                            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                            const ampm = hour < 12 ? "AM" : "PM"
                            return (
                              <SelectItem key={`do-${t}`} value={t}>
                                {displayHour}:{min} {ampm}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-1">
                      <Select
                        value={day.dinner_close || "closed"}
                        onValueChange={(val) => {
                          const updated = [...hours]
                          updated[idx] = { ...updated[idx], dinner_close: val === "closed" ? null : val }
                          setHours(updated)
                        }}
                        disabled={!day.dinner_open}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="closed">Cerrado</SelectItem>
                          {TIME_OPTIONS.map((t) => {
                            const hour = parseInt(t.split(":")[0])
                            const min = t.split(":")[1]
                            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                            const ampm = hour < 12 ? "AM" : "PM"
                            return (
                              <SelectItem key={`dc-${t}`} value={t}>
                                {displayHour}:{min} {ampm}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Copy To All button */}
                    <td className="py-3 px-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs bg-cyan-500 text-white hover:bg-cyan-600 border-0"
                        onClick={() => copyToAll(idx)}
                      >
                        Copy To All
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#5d1f1f] hover:bg-[#4a1818]"
          >
            {saving ? "Guardando..." : "Guardar Horario"}
          </Button>
        </>
      </CardContent>
    </Card>
  )
}

