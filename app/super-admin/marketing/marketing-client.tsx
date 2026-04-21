"use client"

import { useState, useTransition, useEffect } from "react"
import {
  saveMarketingCampaign,
  deleteMarketingCampaign,
  sendTestMarketingEmail,
  launchMarketingCampaign,
  cancelMarketingCampaign,
  getCampaignProgress,
} from "./actions"
import { Megaphone, Send, TestTube2, Rocket, Trash2, Plus, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { DEFAULT_LAUNCH_ANNOUNCEMENT_HTML } from "./launch-announcement-template"

type Campaign = {
  id: string
  operator_id: string
  name: string
  subject: string
  body_html: string
  body_text: string | null
  from_address: string
  audience_filter: Record<string, unknown>
  status: "draft" | "sending" | "sent" | "failed" | "cancelled"
  scheduled_for: string | null
  started_at: string | null
  sent_at: string | null
  total_recipients: number | null
  total_sent: number
  total_failed: number
  created_by: string | null
  created_at: string
  updated_at: string
}

type DraftCampaign = {
  id?: string
  name: string
  subject: string
  body_html: string
  body_text: string
  from_address: string
}

const DEFAULT_FROM = "PR Delivery <noreply@prdelivery.com>"

function emptyDraft(): DraftCampaign {
  return {
    name: "",
    subject: "",
    body_html: DEFAULT_LAUNCH_ANNOUNCEMENT_HTML,
    body_text: "",
    from_address: DEFAULT_FROM,
  }
}

function statusBadge(status: Campaign["status"]) {
  const base = "text-xs font-semibold px-2 py-1 rounded-full"
  switch (status) {
    case "draft":
      return <span className={`${base} bg-slate-100 text-slate-700`}>Borrador</span>
    case "sending":
      return (
        <span className={`${base} bg-blue-100 text-blue-700 inline-flex items-center gap-1`}>
          <Loader2 className="w-3 h-3 animate-spin" /> Enviando
        </span>
      )
    case "sent":
      return (
        <span className={`${base} bg-emerald-100 text-emerald-700 inline-flex items-center gap-1`}>
          <CheckCircle2 className="w-3 h-3" /> Enviado
        </span>
      )
    case "failed":
      return (
        <span className={`${base} bg-rose-100 text-rose-700 inline-flex items-center gap-1`}>
          <XCircle className="w-3 h-3" /> Falló
        </span>
      )
    case "cancelled":
      return <span className={`${base} bg-amber-100 text-amber-700`}>Cancelado</span>
  }
}

export function MarketingClient({
  operatorId,
  initialCampaigns,
  currentUserId,
}: {
  operatorId: string
  initialCampaigns: Campaign[]
  currentUserId: string
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCampaigns.length > 0 ? initialCampaigns[0].id : null
  )
  const [draft, setDraft] = useState<DraftCampaign>(emptyDraft())
  const [isCreating, setIsCreating] = useState(initialCampaigns.length === 0)
  const [testEmail, setTestEmail] = useState("")
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null)

  const selected = selectedId ? campaigns.find((c) => c.id === selectedId) : null

  // Hydrate draft when switching between campaigns
  useEffect(() => {
    if (isCreating) {
      setDraft(emptyDraft())
      return
    }
    if (selected) {
      setDraft({
        id: selected.id,
        name: selected.name,
        subject: selected.subject,
        body_html: selected.body_html,
        body_text: selected.body_text ?? "",
        from_address: selected.from_address,
      })
    }
  }, [selectedId, isCreating, selected])

  // Poll progress while selected campaign is sending
  useEffect(() => {
    if (!selected || selected.status !== "sending") return
    let cancelled = false
    const tick = async () => {
      const progress = await getCampaignProgress(selected.id)
      if (cancelled) return
      if (!progress.ok) return // transient — next tick will retry
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? {
                ...c,
                status: progress.data.campaign.status as Campaign["status"],
                total_recipients: progress.data.campaign.total_recipients,
                total_sent: progress.data.campaign.total_sent,
                total_failed: progress.data.campaign.total_failed,
                sent_at: progress.data.campaign.sent_at,
              }
            : c
        )
      )
    }
    const interval = setInterval(tick, 3000)
    tick()
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [selected?.id, selected?.status])

  const isReadOnly = !isCreating && selected && selected.status !== "draft"

  const handleSave = () => {
    setMessage(null)
    // Client-side pre-validation so we don't even hit the server with an empty
    // form (and so the user never sees the scary "server error" banner).
    if (!draft.name.trim()) {
      setMessage({ tone: "err", text: "El nombre de la campaña es requerido" })
      return
    }
    if (!draft.subject.trim()) {
      setMessage({ tone: "err", text: "El asunto es requerido" })
      return
    }
    if (!draft.body_html.trim()) {
      setMessage({ tone: "err", text: "El cuerpo HTML es requerido" })
      return
    }
    if (!draft.from_address.trim()) {
      setMessage({ tone: "err", text: "El remitente (From) es requerido" })
      return
    }
    startTransition(async () => {
      const result = await saveMarketingCampaign({
        id: draft.id,
        operator_id: operatorId,
        name: draft.name,
        subject: draft.subject,
        body_html: draft.body_html,
        body_text: draft.body_text || null,
        from_address: draft.from_address,
        audience_filter: { kind: "all_opted_in_customers" },
        created_by: currentUserId,
      })
      if (!result.ok) {
        setMessage({ tone: "err", text: result.error })
        return
      }
      const newCampaign = result.data as unknown as Campaign
      setCampaigns((prev) => {
        const idx = prev.findIndex((c) => c.id === newCampaign.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = newCampaign
          return next
        }
        return [newCampaign, ...prev]
      })
      setSelectedId(newCampaign.id)
      setIsCreating(false)
      setMessage({ tone: "ok", text: "Campaña guardada" })
    })
  }

  const handleDelete = () => {
    if (!selected) return
    if (!confirm(`¿Eliminar campaña "${selected.name}"?`)) return
    setMessage(null)
    startTransition(async () => {
      const result = await deleteMarketingCampaign(selected.id)
      if (!result.ok) {
        setMessage({ tone: "err", text: result.error })
        return
      }
      setCampaigns((prev) => prev.filter((c) => c.id !== selected.id))
      setSelectedId(null)
      setIsCreating(true)
      setMessage({ tone: "ok", text: "Campaña eliminada" })
    })
  }

  const handleTestSend = () => {
    if (!selected) {
      setMessage({ tone: "err", text: "Guarda la campaña primero" })
      return
    }
    if (!testEmail.trim()) {
      setMessage({ tone: "err", text: "Ingresa un email de prueba" })
      return
    }
    setMessage(null)
    startTransition(async () => {
      const result = await sendTestMarketingEmail(selected.id, testEmail.trim())
      if (!result.ok) {
        setMessage({ tone: "err", text: result.error })
        return
      }
      setMessage({ tone: "ok", text: `Email de prueba enviado a ${testEmail.trim()}` })
    })
  }

  const handleLaunch = () => {
    if (!selected) return
    const confirmMsg =
      `Vas a lanzar "${selected.name}" a TODOS los clientes opt-in del operador.\n\n` +
      `El cron comenzará a enviar correos en la próxima ejecución (~1 min).\n\n` +
      `¿Continuar?`
    if (!confirm(confirmMsg)) return
    setMessage(null)
    startTransition(async () => {
      const result = await launchMarketingCampaign(selected.id)
      if (!result.ok) {
        setMessage({ tone: "err", text: result.error })
        return
      }
      const recipientCount = result.data.recipientCount
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? {
                ...c,
                status: "sending",
                total_recipients: recipientCount,
                started_at: new Date().toISOString(),
              }
            : c
        )
      )
      setMessage({
        tone: "ok",
        text: `Campaña lanzada a ${recipientCount.toLocaleString()} destinatarios`,
      })
    })
  }

  const handleCancel = () => {
    if (!selected) return
    if (!confirm(`¿Cancelar el envío de "${selected.name}"? Los correos pendientes no se enviarán.`))
      return
    setMessage(null)
    startTransition(async () => {
      const result = await cancelMarketingCampaign(selected.id)
      if (!result.ok) {
        setMessage({ tone: "err", text: result.error })
        return
      }
      setCampaigns((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, status: "cancelled" } : c))
      )
      setMessage({ tone: "ok", text: "Campaña cancelada" })
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Left: campaign list */}
      <aside className="bg-white rounded-xl border border-slate-200 p-4 h-fit">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-purple-600" /> Campañas
          </h3>
          <button
            onClick={() => {
              setIsCreating(true)
              setSelectedId(null)
              setDraft(emptyDraft())
              setMessage(null)
            }}
            className="text-xs font-semibold text-purple-600 hover:text-purple-700 inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Nueva
          </button>
        </div>

        {campaigns.length === 0 ? (
          <p className="text-xs text-slate-400">
            No hay campañas aún. Crea la primera a la derecha.
          </p>
        ) : (
          <ul className="space-y-1">
            {campaigns.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setSelectedId(c.id)
                    setIsCreating(false)
                    setMessage(null)
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                    selectedId === c.id && !isCreating
                      ? "border-purple-300 bg-purple-50"
                      : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {c.name}
                    </span>
                    {statusBadge(c.status)}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{c.subject}</p>
                  {c.status !== "draft" && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      {c.total_sent}/{c.total_recipients ?? "?"} enviados
                      {c.total_failed > 0 && ` · ${c.total_failed} fallidos`}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Right: compose + preview */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        {message && (
          <div
            className={`p-3 rounded-lg text-sm inline-flex items-center gap-2 ${
              message.tone === "ok"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {message.tone === "ok" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {message.text}
          </div>
        )}

        {selected && selected.status !== "draft" && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Progreso
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {selected.total_sent}
                  <span className="text-slate-400 text-lg">
                    {" / "}
                    {selected.total_recipients ?? "?"}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {selected.total_failed > 0 && (
                    <span className="text-rose-600">
                      {selected.total_failed} fallidos ·{" "}
                    </span>
                  )}
                  {selected.started_at &&
                    `iniciado ${new Date(selected.started_at).toLocaleString("es-PR")}`}
                  {selected.sent_at &&
                    ` · completado ${new Date(selected.sent_at).toLocaleString("es-PR")}`}
                </p>
              </div>
              {selected.status === "sending" && (
                <button
                  onClick={handleCancel}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 disabled:opacity-50"
                >
                  Cancelar envío
                </button>
              )}
            </div>
            {selected.total_recipients && selected.total_recipients > 0 && (
              <div className="mt-3 h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      ((selected.total_sent + selected.total_failed) /
                        selected.total_recipients) *
                        100
                    )}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">
              Nombre interno de campaña
            </label>
            <input
              type="text"
              value={draft.name}
              disabled={isReadOnly || isPending}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Ej: Lanzamiento PR Delivery 2026"
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">From</label>
            <input
              type="text"
              value={draft.from_address}
              disabled={isReadOnly || isPending}
              onChange={(e) => setDraft((d) => ({ ...d, from_address: e.target.value }))}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Asunto (Subject)</label>
          <input
            type="text"
            value={draft.subject}
            disabled={isReadOnly || isPending}
            onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            placeholder="✨ ¡PR Delivery ya está aquí!"
            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">HTML Body</label>
            <textarea
              value={draft.body_html}
              disabled={isReadOnly || isPending}
              onChange={(e) => setDraft((d) => ({ ...d, body_html: e.target.value }))}
              className="mt-1 w-full h-96 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Vista previa</label>
            <iframe
              srcDoc={draft.body_html}
              title="Preview"
              className="mt-1 w-full h-96 border border-slate-200 rounded-lg bg-white"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">
            Texto plano (opcional — fallback para clientes sin HTML)
          </label>
          <textarea
            value={draft.body_text}
            disabled={isReadOnly || isPending}
            onChange={(e) => setDraft((d) => ({ ...d, body_text: e.target.value }))}
            rows={3}
            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200">
          {!isReadOnly && (
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Guardar
            </button>
          )}

          {selected && selected.status === "draft" && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">
                <TestTube2 className="w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  placeholder="email@prueba.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="text-sm bg-transparent outline-none w-56"
                />
                <button
                  onClick={handleTestSend}
                  disabled={isPending || !testEmail.trim()}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  Enviar prueba
                </button>
              </div>

              <button
                onClick={handleLaunch}
                disabled={isPending}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Rocket className="w-4 h-4" />
                Lanzar a todos los clientes
              </button>

              <button
                onClick={handleDelete}
                disabled={isPending}
                className="ml-auto px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </>
          )}

          {selected && (selected.status === "sent" || selected.status === "cancelled" || selected.status === "failed") && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="ml-auto px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" /> Archivar
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
