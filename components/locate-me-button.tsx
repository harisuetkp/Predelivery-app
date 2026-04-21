"use client"

import { useCallback, useState } from "react"
import { reverseGeocode, type ResolvedAddress } from "@/lib/places/client-geocode"

/**
 * "Ubicarme" button — browser geolocation + client-side reverse-geocode,
 * with platform-specific help when permission is blocked.
 *
 * KEY INSIGHT: on iOS Chrome, if the user denied Location Services to the
 * Chrome app itself (iOS Settings → Privacy → Location Services → Chrome
 * = Never), getCurrentPosition returns PERMISSION_DENIED without ever
 * showing a browser prompt — because the OS already answered. Generic
 * "enable in browser settings" copy is useless; customers need the
 * exact OS path. UA-sniffing below branches help text per platform.
 */

type Platform =
  | "ios-chrome"
  | "ios-safari"
  | "ios-other"
  | "android-chrome"
  | "android-other"
  | "desktop-chrome"
  | "desktop-safari"
  | "desktop-firefox"
  | "desktop-other"
  | "unknown"

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent || ""
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  if (isIOS) {
    if (/CriOS\//.test(ua)) return "ios-chrome"
    if (/FxiOS\//.test(ua)) return "ios-other"
    if (/EdgiOS\//.test(ua)) return "ios-other"
    if (/Safari\//.test(ua)) return "ios-safari"
    return "ios-other"
  }
  if (isAndroid) {
    if (/Chrome\//.test(ua) && !/SamsungBrowser/i.test(ua)) return "android-chrome"
    return "android-other"
  }
  if (/Firefox\//.test(ua)) return "desktop-firefox"
  if (/Edg\//.test(ua)) return "desktop-chrome" // Edge is Chromium
  if (/Chrome\//.test(ua)) return "desktop-chrome"
  if (/Safari\//.test(ua)) return "desktop-safari"
  return "desktop-other"
}

function instructionsFor(platform: Platform): string[] {
  switch (platform) {
    case "ios-chrome":
      return [
        "Ajustes (del iPhone) → Privacidad y seguridad",
        "Servicios de ubicacion → activalo si esta apagado",
        "Busca Chrome en la lista → 'Mientras se usa la app'",
        "Activa tambien 'Ubicacion precisa'",
        "Vuelve aqui y presiona Ubicarme otra vez",
      ]
    case "ios-safari":
      return [
        "Ajustes (del iPhone) → Safari → Ubicacion",
        "Cambialo a 'Preguntar' o 'Permitir'",
        "Recarga la pagina",
      ]
    case "ios-other":
      return [
        "Ajustes (del iPhone) → Privacidad y seguridad",
        "Servicios de ubicacion → activalo",
        "Busca el navegador que usas → 'Mientras se usa la app'",
      ]
    case "android-chrome":
      return [
        "Chrome → menu (tres puntos) → Configuracion",
        "Configuracion del sitio → Ubicacion",
        "Busca prdelivery.com → cambia a 'Permitir'",
      ]
    case "android-other":
      return [
        "Configuracion del navegador → Permisos del sitio",
        "Ubicacion → Permitir para prdelivery.com",
      ]
    case "desktop-chrome":
      return [
        "Haz clic en el candado junto a la URL",
        "Ubicacion → Permitir",
        "Recarga la pagina",
      ]
    case "desktop-safari":
      return [
        "Safari (menu) → Ajustes para prdelivery.com",
        "Ubicacion → Permitir",
      ]
    case "desktop-firefox":
      return [
        "Haz clic en el candado junto a la URL",
        "Permisos → Acceder a tu ubicacion → Permitir",
        "Recarga la pagina",
      ]
    default:
      return ["Permite el acceso a tu ubicacion en los ajustes del navegador"]
  }
}

interface LocateMeButtonProps {
  onLocated: (lat: number, lng: number) => void
  onAddressResolved?: (addr: ResolvedAddress) => void
  label?: string
  className?: string
}

type ErrState = "" | "denied" | "timeout" | "unsupported" | "other"

export function LocateMeButton({
  onLocated,
  onAddressResolved,
  label = "Ubicarme",
  className = "",
}: LocateMeButtonProps) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<ErrState>("")
  const [showSteps, setShowSteps] = useState(false)

  const handleClick = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErr("unsupported")
      return
    }
    setBusy(true)
    setErr("")
    setShowSteps(false)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false)
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        try { onLocated(lat, lng) } catch {}
        if (onAddressResolved) {
          reverseGeocode(lat, lng)
            .then((r) => { if (r) onAddressResolved(r) })
            .catch(() => {})
        }
      },
      (e) => {
        setBusy(false)
        if (e && e.code === e.PERMISSION_DENIED) {
          setErr("denied")
          // Auto-open the steps the first time we hit denied, so the
          // customer isn't left staring at an error they can't act on.
          setShowSteps(true)
        } else if (e && e.code === e.TIMEOUT) {
          setErr("timeout")
        } else {
          setErr("other")
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  }, [onLocated, onAddressResolved])

  const platform = detectPlatform()
  const steps = instructionsFor(platform)

  const errorSummary = (() => {
    switch (err) {
      case "denied": return "Permiso de ubicacion bloqueado."
      case "timeout": return "No pudimos obtener tu ubicacion a tiempo. Intenta de nuevo."
      case "unsupported": return "Tu navegador no permite geolocalizacion."
      case "other": return "No pudimos obtener tu ubicacion. Intenta de nuevo."
      default: return ""
    }
  })()

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="group inline-flex items-center gap-2 pl-1 pr-3.5 py-1 rounded-full text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 shadow-sm hover:shadow disabled:opacity-60 transition-all"
        aria-label="Usar mi ubicacion actual"
        title="Usar mi ubicacion actual"
      >
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white shadow-inner ring-1 ring-slate-900/10 group-hover:bg-slate-950 transition-colors">
          {busy ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            // Navigation pointer — bold outline + fill, tilted like a compass arrow
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 11 22 2l-9 19-2-8-8-2Z" />
            </svg>
          )}
        </span>
        <span className="tracking-tight">{label}</span>
      </button>

      {err && (
        <div className="mt-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5">
          <div className="flex items-start gap-1.5">
            <p className="text-[11px] leading-snug text-amber-800 flex-1">
              {errorSummary}
            </p>
            {err === "denied" && (
              <button
                type="button"
                onClick={() => setShowSteps((s) => !s)}
                className="text-[11px] font-semibold text-slate-800 hover:text-slate-950 underline shrink-0"
              >
                {showSteps ? "Ocultar" : "Como activar"}
              </button>
            )}
          </div>
          {err === "denied" && showSteps && (
            <ol className="mt-1.5 pl-4 text-[11px] leading-snug text-slate-700 space-y-0.5 list-decimal">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
