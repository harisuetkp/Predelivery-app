"use client"

import { useMemo, useState, useTransition } from "react"
import { Check, Clock, AlertCircle } from "lucide-react"
import { saveOperatorTimezone } from "./actions"

type Preset = {
  value: string
  label: string
  description: string
}

const PRESETS: Preset[] = [
  {
    value: "America/Puerto_Rico",
    label: "Puerto Rico (AST)",
    description: "UTC-4, sin horario de verano. Default para FoodNetPR.",
  },
  {
    value: "America/Santo_Domingo",
    label: "República Dominicana (AST)",
    description: "UTC-4, sin horario de verano.",
  },
  {
    value: "America/New_York",
    label: "US Este (ET)",
    description: "UTC-5 / UTC-4 con horario de verano.",
  },
  {
    value: "America/Chicago",
    label: "US Centro (CT)",
    description: "UTC-6 / UTC-5 con horario de verano.",
  },
  {
    value: "America/Los_Angeles",
    label: "US Pacífico (PT)",
    description: "UTC-8 / UTC-7 con horario de verano.",
  },
]

function formatSample(tz: string): string {
  try {
    return new Intl.DateTimeFormat("es-PR", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date())
  } catch {
    return "Zona horaria inválida"
  }
}

interface Props {
  operatorId: string
  operatorName: string
  initialTimezone: string
}

export function TimezoneClient({ operatorId, operatorName, initialTimezone }: Props) {
  const [selected, setSelected] = useState<string>(initialTimezone)
  const [custom, setCustom] = useState<string>("")
  const [mode, setMode] = useState<"preset" | "custom">(
    PRESETS.some((p) => p.value === initialTimezone) ? "preset" : "custom",
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const effectiveTimezone = mode === "custom" ? custom.trim() : selected
  const sample = useMemo(() => formatSample(effectiveTimezone || initialTimezone), [effectiveTimezone, initialTimezone])
  const isDirty = effectiveTimezone !== "" && effectiveTimezone !== initialTimezone

  const handleSave = () => {
    setError(null)
    setSavedMsg(null)
    if (!effectiveTimezone) {
      setError("Selecciona o escribe una zona horaria.")
      return
    }
    startTransition(async () => {
      const res = await saveOperatorTimezone(operatorId, effectiveTimezone)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSavedMsg(`Zona horaria guardada: ${res.data.timezone}`)
    })
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-lg bg-slate-900 text-white">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Zona Horaria del Sistema</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Operador: <span className="font-medium text-slate-700">{operatorName}</span>
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 mb-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Hora actual en la zona seleccionada
          </div>
          <div className="text-base font-medium text-slate-900">{sample}</div>
          <div className="text-xs text-slate-500 mt-1">
            IANA: <code className="font-mono">{effectiveTimezone || initialTimezone}</code>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Seleccionar zona</label>
          <div className="space-y-2">
            {PRESETS.map((p) => (
              <label
                key={p.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                  mode === "preset" && selected === p.value
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="timezone"
                  className="mt-1"
                  checked={mode === "preset" && selected === p.value}
                  onChange={() => {
                    setMode("preset")
                    setSelected(p.value)
                  }}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{p.label}</div>
                  <div className="text-xs text-slate-500">{p.description}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{p.value}</div>
                </div>
                {mode === "preset" && selected === p.value && (
                  <Check className="w-5 h-5 text-slate-900 shrink-0" />
                )}
              </label>
            ))}

            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                mode === "custom"
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="timezone"
                className="mt-1"
                checked={mode === "custom"}
                onChange={() => setMode("custom")}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">Otra (IANA personalizada)</div>
                <div className="text-xs text-slate-500">
                  Ej. America/Caracas, Europe/Madrid. Debe ser un identificador IANA válido.
                </div>
                <input
                  type="text"
                  disabled={mode !== "custom"}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="Area/City"
                  className="mt-2 w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <div className="text-sm text-rose-700">{error}</div>
          </div>
        )}

        {savedMsg && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-sm text-emerald-700">{savedMsg}</div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <div className="text-xs text-slate-500 mr-auto">
            {isDirty ? "Cambios sin guardar" : "Sin cambios"}
          </div>
          <button
            type="button"
            disabled={!isDirty || isPending}
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isPending ? "Guardando..." : "Guardar zona"}
          </button>
        </div>
      </div>

      <div className="text-xs text-slate-500 leading-relaxed">
        Esta configuración controla cómo se muestran fechas y horas en los paneles
        administrativos para este operador. El cambio es inmediato pero algunas
        vistas pueden requerir recargar la página. Puerto Rico usa AST todo el año
        (UTC-4, sin horario de verano) — no usar America/New_York para PR.
      </div>
    </div>
  )
}
