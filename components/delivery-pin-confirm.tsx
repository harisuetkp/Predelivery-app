"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { reverseGeocode, type ResolvedAddress } from "@/lib/places/client-geocode"

/**
 * Draggable pin confirmation - v5: explicit Confirmar in both tiers.
 *
 * v5 policy change
 *   - Every pin pick now requires an explicit "Confirmar ubicacion"
 *     click, regardless of geocoder confidence. Dragging no longer
 *     auto-confirms. Reason: commitment from the customer - if a driver
 *     shows up at the wrong door later, "I confirmed the pin" is a much
 *     stronger signal than "I dragged by accident".
 *   - High-confidence tier: neutral slate map + Confirmar button.
 *   - Low-confidence tier: amber alarm panel + Street View + Confirmar.
 *   - Both tiers collapse to the same green "Ubicacion confirmada" pill
 *     with a Cambiar escape hatch.
 *
 * v4 carryover
 *   - "Ubicarme" button lives outside this component (LocateMeButton).
 *   - Fixed center crosshair (no draggable marker -> no iOS Save-image).
 *   - gestureHandling: "greedy" for single-finger pan on mobile.
 *
 * PARENT CONTRACT
 *   <DeliveryPinConfirm
 *      latitude={...} longitude={...}
 *      confidence="high" | "low"
 *      onChange={(lat,lng) => setCoords(...)}
 *      onConfirm={() => setPinConfirmed(true)}
 *      onUnconfirm={() => setPinConfirmed(false)}
 *      confirmed={pinConfirmed}
 *      onAddressResolved={(addr) => { ... }}
 *   />
 */

interface DeliveryPinConfirmProps {
  latitude: number | null
  longitude: number | null
  onChange: (lat: number, lng: number) => void
  confidence?: "high" | "low"
  onConfirm?: () => void
  confirmed?: boolean
  heightPx?: number
  onAddressResolved?: (addr: ResolvedAddress) => void
  // Called when the customer clicks 'Cambiar' on the confirmed pill.
  // Parent should reset pinConfirmed to false so the map re-opens for
  // further pin adjustment.
  onUnconfirm?: () => void
}

let mapsScriptPromise: Promise<void> | null = null

function loadMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("not browser"))
  const w = window as any
  if (w.google && w.google.maps) return Promise.resolve()
  if (mapsScriptPromise) return mapsScriptPromise
  mapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      "script[data-google-maps-js]"
    ) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("maps script load failed")))
      return
    }
    const script = document.createElement("script")
    script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(apiKey) + "&v=weekly"
    script.async = true
    script.defer = true
    script.setAttribute("data-google-maps-js", "1")
    script.addEventListener("load", () => resolve())
    script.addEventListener("error", () => reject(new Error("maps script load failed")))
    document.head.appendChild(script)
  })
  return mapsScriptPromise
}

// Fixed pin overlay - anchors its tip at the map's exact center.
function CenterPin({ isLow }: { isLow: boolean }) {
  const color = isLow ? "#D97706" : "#0F172A" // amber-600 for low, slate-900 for high
  return (
    <div
      aria-hidden="true"
      className="absolute left-1/2 top-1/2 pointer-events-none z-10"
      style={{ transform: "translate(-50%, -100%)" }}
    >
      <svg width="42" height="54" viewBox="0 0 42 54" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="pinShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.35" />
          </filter>
        </defs>
        <g filter="url(#pinShadow)">
          <path
            d="M21 2 C10.5 2 2 10.5 2 21 c0 14 19 31 19 31 s19-17 19-31 C40 10.5 31.5 2 21 2 z"
            fill={color}
            stroke="#FFFFFF"
            strokeWidth="2.5"
          />
          <circle cx="21" cy="21" r="6.5" fill="#FFFFFF" />
        </g>
      </svg>
    </div>
  )
}

export function DeliveryPinConfirm({
  latitude,
  longitude,
  onChange,
  confidence = "high",
  onConfirm,
  confirmed = false,
  heightPx,
  onAddressResolved,
  onUnconfirm,
}: DeliveryPinConfirmProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  // lastAppliedRef: lat/lng we last programmatically set - so we don't echo
  // it back to the parent as if the user moved the map.
  const lastAppliedRef = useRef<{ lat: number; lng: number } | null>(null)
  // Stash the latest onAddressResolved callback so the dragend listener
  // (attached once) can always see the current one.
  const onAddressResolvedRef = useRef<typeof onAddressResolved>(onAddressResolved)
  useEffect(() => { onAddressResolvedRef.current = onAddressResolved }, [onAddressResolved])
  // ResizeObserver ref — attached by the init effect so we can disconnect
  // on teardown (unmount + re-init on address change).
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  // dragend listener handle — stored so we can detach on re-init.
  const dragendListenerRef = useRef<any>(null)

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string>("")

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const isLow = confidence === "low"
  const resolvedHeight = heightPx || (isLow ? 480 : 340)

  // Init map. Re-runs on confirmed flip OR external lat/lng change.
  //
  // BLANK-TILE BUG (v3) — earlier attempts (v1: kickTiles at init; v2:
  // ResizeObserver + post-panTo kicks) both failed in production for the
  // address-change case. Symptom: gray rectangle with only the center pin
  // showing, status=ready but no tiles, no zoom controls. Even with
  // gm.event.trigger + setCenter + ResizeObserver re-kicks, Maps never
  // reliably refetched tiles after a parent layout reshuffle.
  //
  // v3 strategy: blow it away and rebuild. Adding latitude/longitude to
  // the dep list means any externally-initiated coord change tears down
  // the existing map instance and constructs a fresh one against the
  // (now-laid-out) container. The drag-echo guard below prevents this
  // from firing when the new coords are just our own dragend bouncing
  // back through the parent — in that case the map is already centered
  // correctly by the user's drag and a re-init would erase their pan.
  useEffect(() => {
    // Skip while the pill is rendered - containerRef.current is null.
    if (confirmed) return
    if (typeof latitude !== "number" || typeof longitude !== "number") return
    if (!apiKey) {
      setStatus("error")
      setErrorMsg("Maps key no configurado")
      return
    }
    if (!containerRef.current) return

    // Drag-echo guard: if the new coords match what we just applied
    // (within a few cm of float precision), the user dragged the pin and
    // the parent is echoing it back. Map already shows the correct view —
    // skip to avoid clobbering their pan with a fresh construction.
    const last = lastAppliedRef.current
    const isDragEcho =
      mapRef.current != null &&
      last != null &&
      Math.abs(last.lat - latitude) < 1e-7 &&
      Math.abs(last.lng - longitude) < 1e-7
    if (isDragEcho) return

    // Tear down prior instance: detach dragend listener, disconnect
    // ResizeObserver, drop the gm.Map reference. Lets GC release the
    // old DOM-bound handlers before we attach new ones.
    if (dragendListenerRef.current) {
      try {
        const w = window as any
        if (w.google && w.google.maps && w.google.maps.event) {
          w.google.maps.event.removeListener(dragendListenerRef.current)
        }
      } catch {}
      dragendListenerRef.current = null
    }
    if (resizeObserverRef.current) {
      try { resizeObserverRef.current.disconnect() } catch {}
      resizeObserverRef.current = null
    }
    mapRef.current = null

    setStatus("loading")
    loadMapsScript(apiKey)
      .then(() => {
        const w = window as any
        if (!w.google || !w.google.maps || !containerRef.current) {
          setStatus("error")
          setErrorMsg("Maps no inicializo")
          return
        }
        const gm = w.google.maps
        mapRef.current = new gm.Map(containerRef.current, {
          center: { lat: latitude, lng: longitude },
          zoom: isLow ? 18 : 17,
          // High-confidence: "roadmap" gives the familiar graphic street map
          // with POIs and labels - what customers expect when their address
          // resolved cleanly. Low-confidence: "hybrid" gives satellite
          // imagery WITH street labels so the customer can visually identify
          // their building/entrance before confirming the pin.
          mapTypeId: isLow ? "hybrid" : "roadmap",
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          // "greedy" allows single-finger pan on mobile (instead of requiring
          // two fingers). The map lives inside a deliberately-focused checkout
          // step, so hijacking page scroll is acceptable here.
          gestureHandling: "greedy",
          // Visible backdrop while tiles stream in - prevents the white
          // rectangle look from screenshot 1 (task-44) when tiles lag.
          backgroundColor: "#e5e7eb",
        })
        lastAppliedRef.current = { lat: latitude, lng: longitude }

        // First-paint kicker. Maps constructed inside a just-rendered
        // conditional block sometimes compute a 0x0 bounding box during
        // construction and never request tiles. Three layered kicks
        // (rAF + 150ms + 600ms) cover both fast and slow paint cycles.
        const kickTiles = () => {
          if (!mapRef.current) return
          try {
            gm.event.trigger(mapRef.current, "resize")
            const lastCoord = lastAppliedRef.current
            if (lastCoord) mapRef.current.setCenter({ lat: lastCoord.lat, lng: lastCoord.lng })
            else mapRef.current.setCenter({ lat: latitude, lng: longitude })
          } catch {}
        }
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => requestAnimationFrame(kickTiles))
        }
        setTimeout(kickTiles, 150)
        setTimeout(kickTiles, 600)

        // ResizeObserver: also kick on any container size change so we
        // catch layout settles that happen AFTER the 600ms window closed.
        if (typeof ResizeObserver !== "undefined" && containerRef.current) {
          let raf = 0
          const ro = new ResizeObserver(() => {
            if (raf) cancelAnimationFrame(raf)
            raf = requestAnimationFrame(() => {
              raf = 0
              kickTiles()
            })
          })
          ro.observe(containerRef.current)
          resizeObserverRef.current = ro
        }

        // Fire onChange whenever the user finishes panning the map. dragend
        // only fires on USER drags, not programmatic setCenter - so no loop.
        // NOTE: dragging no longer auto-confirms in either tier. The
        // explicit "Confirmar ubicacion" button is the ONLY path that
        // flips `confirmed` to true. This is a deliberate commitment
        // gesture - see v5 header.
        dragendListenerRef.current = mapRef.current.addListener("dragend", () => {
          const c = mapRef.current && mapRef.current.getCenter()
          if (!c) return
          const newLat = c.lat()
          const newLng = c.lng()
          lastAppliedRef.current = { lat: newLat, lng: newLng }
          try {
            onChange(newLat, newLng)
          } catch {}
          // Reverse-geocode to keep the address text in sync with the pin.
          const cb = onAddressResolvedRef.current
          if (cb) {
            reverseGeocode(newLat, newLng).then((r) => { if (r) cb(r) }).catch(() => {})
          }
        })
        setStatus("ready")
      })
      .catch((err: any) => {
        setStatus("error")
        setErrorMsg((err && err.message) || "Error cargando el mapa")
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed, latitude, longitude])

  // Cleanup on unmount: disconnect ResizeObserver, detach dragend listener.
  useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        try { resizeObserverRef.current.disconnect() } catch {}
        resizeObserverRef.current = null
      }
      if (dragendListenerRef.current) {
        try {
          const w = window as any
          if (w.google && w.google.maps && w.google.maps.event) {
            w.google.maps.event.removeListener(dragendListenerRef.current)
          }
        } catch {}
        dragendListenerRef.current = null
      }
    }
  }, [])

  const handleExplicitConfirm = useCallback(() => {
    if (onConfirm) onConfirm()
  }, [onConfirm])

  if (typeof latitude !== "number" || typeof longitude !== "number") return null

  // -------- Confirmed pill (BOTH tiers) --------
  if (confirmed) {
    return (
      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm font-medium text-emerald-800">Ubicacion confirmada</span>
        <button
          type="button"
          onClick={() => {
            // Prefer explicit unconfirm - parent flips pinConfirmed back
            // to false and the map re-renders. Legacy onChange round-trip
            // retained for callers that haven't wired onUnconfirm yet.
            if (onUnconfirm) onUnconfirm()
            else onChange(latitude, longitude)
          }}
          className="ml-auto text-xs text-emerald-700 hover:text-emerald-900 underline"
          aria-label="Editar ubicacion"
          title="Editar ubicacion"
        >
          Cambiar
        </button>
      </div>
    )
  }

  // -------- HIGH confidence: neutral advisory map + Confirmar --------
  // v5.1: Confirmar button now rides at the TOP of the map - customers
  // kept missing the bottom-anchored button on mobile and wound up
  // staring at grayed-out payment buttons (task #38).
  if (!isLow) {
    return (
      <div className="mt-3 rounded-lg border border-slate-200 overflow-hidden bg-white">
        <div className="px-3 py-3 bg-slate-50 border-b border-slate-200 space-y-2">
          <p className="text-xs text-slate-600">
            Verifica el pin de tu entrega y confirma haciendo click.
          </p>
          {/* Same green palette as the "Pagar en Efectivo" button so the
              two affordances visually rhyme - the customer mentally groups
              "confirm pin" with "pay" as adjacent commit gestures. */}
          <button
            type="button"
            onClick={handleExplicitConfirm}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold tracking-wide text-white bg-green-600 hover:bg-green-700 active:bg-green-800 rounded-md shadow-md hover:shadow-lg ring-1 ring-green-700/40 transition-all"
          >
            {/* Pointer cue reinforces "click me" */}
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 11V5a2 2 0 1 1 4 0v6" />
              <path d="M13 7a2 2 0 1 1 4 0v4" />
              <path d="M17 9a2 2 0 1 1 4 0v5a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7v-2l-2-4a2 2 0 0 1 3.5-2L9 11" />
            </svg>
            <span>Verifica el PIN y Haz Click Aqui para continuar</span>
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        <div className="relative w-full bg-slate-100">
          <div ref={containerRef} className="w-full" style={{ height: resolvedHeight, minHeight: resolvedHeight }} />
          {status === "ready" && <CenterPin isLow={false} />}
        </div>
        {status === "error" && (
          <p className="text-xs text-red-500 px-3 py-1">{errorMsg || "No se pudo cargar el mapa"}</p>
        )}
      </div>
    )
  }

  // -------- LOW confidence: amber alarm + satellite + Street View --------
  // v5.1: Confirmar button promoted above the map/Street-View grid for
  // parity with the high-confidence tier.
  return (
    <div className="mt-3 rounded-lg border-2 border-amber-300 bg-amber-50 overflow-hidden">
      <div className="px-3 py-2 bg-amber-100 border-b border-amber-200 flex items-start gap-2">
        <svg className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-900">Confirma tu ubicacion exacta</p>
          <p className="text-xs text-amber-800 mt-0.5">
            No pudimos localizar un numero de calle preciso. Mueve el mapa para centrar el pin en tu entrada de entrega.
          </p>
        </div>
      </div>

      <div className="px-3 py-3 bg-amber-100 border-b border-amber-200 space-y-2">
        <p className="text-xs text-amber-900">
          Verifica el pin de tu entrega y confirma haciendo click.
        </p>
        <button
          type="button"
          onClick={handleExplicitConfirm}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold tracking-wide text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-md shadow-md hover:shadow-lg ring-1 ring-amber-700/40 transition-all"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 11V5a2 2 0 1 1 4 0v6" />
            <path d="M13 7a2 2 0 1 1 4 0v4" />
            <path d="M17 9a2 2 0 1 1 4 0v5a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7v-2l-2-4a2 2 0 0 1 3.5-2L9 11" />
          </svg>
          <span>Verifica el PIN y Haz Click Aqui para continuar</span>
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {/* Satellite map, full width. Street View static-image panel was removed
          because the static image can't be panned/walked and confused more
          customers than it helped. Satellite imagery alone gives enough visual
          reference to identify the building and place the pin correctly. */}
      <div className="relative w-full bg-slate-100" style={{ height: resolvedHeight, minHeight: resolvedHeight }}>
        <div ref={containerRef} className="w-full h-full" />
        {status === "ready" && <CenterPin isLow={true} />}
      </div>

      {status === "error" && (
        <p className="text-xs text-red-600 px-3 py-1">{errorMsg || "No se pudo cargar el mapa"}</p>
      )}
    </div>
  )
}
