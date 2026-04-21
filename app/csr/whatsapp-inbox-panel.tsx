"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatDistanceToNow, format } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Send,
  User,
} from "lucide-react"

type ConversationRow = {
  id: string
  customer_phone: string
  customer_id: string | null
  status: string | null
  assigned_to: string | null
  last_message_at: string | null
  created_at: string | null
  customer: { id: string; name: string | null; email: string | null } | null
  assigned_operator: { id: string; name: string | null } | null
  last_message: {
    direction: string
    content: string | null
    media_type: string | null
    created_at: string
  } | null
}

type MessageRow = {
  id: string
  conversation_id: string
  direction: string
  message_id: string | null
  content: string | null
  media_url: string | null
  media_type: string | null
  status: string | null
  created_at: string
}

type Filter = "open" | "resolved" | "all"

const POLL_INTERVAL_MS = 15_000

function conversationDisplayName(c: ConversationRow): string {
  return c.customer?.name?.trim() || c.customer_phone || "Unknown"
}

function previewText(c: ConversationRow): string {
  if (!c.last_message) return "Sin mensajes"
  if (c.last_message.content) return c.last_message.content
  if (c.last_message.media_type) return `[${c.last_message.media_type}]`
  return "—"
}

export function WhatsAppInboxPanel() {
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("open")
  const [query, setQuery] = useState("")
  const [loadingList, setLoadingList] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [sendingReply, setSendingReply] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const threadBottomRef = useRef<HTMLDivElement | null>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/conversations", { cache: "no-store" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `Request failed (${res.status})`)
      }
      const j = (await res.json()) as { conversations: ConversationRow[] }
      setConversations(j.conversations ?? [])
      setError(null)
    } catch (err: any) {
      console.error("[WhatsApp Inbox] fetchConversations failed:", err)
      setError(err?.message ?? "Failed to load conversations")
    } finally {
      setLoadingList(false)
    }
  }, [])

  const fetchMessages = useCallback(async (conversationId: string) => {
    setLoadingThread(true)
    try {
      const res = await fetch(`/api/whatsapp/conversations/${conversationId}/messages`, {
        cache: "no-store",
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `Request failed (${res.status})`)
      }
      const j = (await res.json()) as { messages: MessageRow[] }
      setMessages(j.messages ?? [])
      setError(null)
    } catch (err: any) {
      console.error("[WhatsApp Inbox] fetchMessages failed:", err)
      setError(err?.message ?? "Failed to load messages")
    } finally {
      setLoadingThread(false)
    }
  }, [])

  const toggleStatus = useCallback(
    async (conversationId: string, next: "open" | "resolved") => {
      setStatusBusy(true)
      try {
        const res = await fetch(`/api/whatsapp/conversations/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j?.error || `Request failed (${res.status})`)
        }
        // Optimistic local update
        setConversations(prev =>
          prev.map(c => (c.id === conversationId ? { ...c, status: next } : c)),
        )
      } catch (err: any) {
        console.error("[WhatsApp Inbox] toggleStatus failed:", err)
        setError(err?.message ?? "Failed to update conversation")
      } finally {
        setStatusBusy(false)
      }
    },
    [],
  )

  const sendReply = useCallback(
    async (conversationId: string, text: string): Promise<boolean> => {
      const trimmed = text.trim()
      if (!trimmed) return false
      setSendingReply(true)
      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, message: trimmed }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j?.error || `Request failed (${res.status})`)
        }
        // Server persists the outbound message and updates last_message_at.
        // Re-pull the thread + list so both sides stay in sync.
        await fetchMessages(conversationId)
        await fetchConversations()
        setError(null)
        return true
      } catch (err: any) {
        console.error("[WhatsApp Inbox] sendReply failed:", err)
        setError(err?.message ?? "Failed to send message")
        return false
      } finally {
        setSendingReply(false)
      }
    },
    [fetchMessages, fetchConversations],
  )

  // Initial load + polling
  useEffect(() => {
    fetchConversations()
    const iv = setInterval(fetchConversations, POLL_INTERVAL_MS)
    return () => clearInterval(iv)
  }, [fetchConversations])

  // Re-fetch thread when selection changes
  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    fetchMessages(selectedId)
  }, [selectedId, fetchMessages])

  // Poll thread for selected conversation
  useEffect(() => {
    if (!selectedId) return
    const iv = setInterval(() => fetchMessages(selectedId), POLL_INTERVAL_MS)
    return () => clearInterval(iv)
  }, [selectedId, fetchMessages])

  // Autoscroll thread to bottom when messages change
  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
  }, [messages, selectedId])

  const selectedConversation = useMemo(
    () => conversations.find(c => c.id === selectedId) ?? null,
    [conversations, selectedId],
  )

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations.filter(c => {
      if (filter === "open" && c.status !== "open") return false
      if (filter === "resolved" && c.status !== "resolved") return false
      if (!q) return true
      const haystack = [
        c.customer_phone,
        c.customer?.name,
        c.customer?.email,
        c.last_message?.content,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [conversations, filter, query])

  const openCount = useMemo(
    () => conversations.filter(c => c.status === "open").length,
    [conversations],
  )
  const resolvedCount = useMemo(
    () => conversations.filter(c => c.status === "resolved").length,
    [conversations],
  )

  return (
    <div className="p-4 h-[calc(100vh-180px)] overflow-hidden">
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-4 h-full">
        {/* Left: conversation list */}
        <div className="flex flex-col border rounded-lg bg-white overflow-hidden">
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageCircle className="h-4 w-4 text-emerald-600" />
                WhatsApp
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchConversations}
                disabled={loadingList}
                className="h-7 px-2"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loadingList && "animate-spin")} />
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar nombre o teléfono"
                className="pl-7 h-8 text-sm"
              />
            </div>

            <div className="flex gap-1">
              <FilterPill
                label="Abiertas"
                count={openCount}
                active={filter === "open"}
                onClick={() => setFilter("open")}
              />
              <FilterPill
                label="Resueltas"
                count={resolvedCount}
                active={filter === "resolved"}
                onClick={() => setFilter("resolved")}
              />
              <FilterPill
                label="Todas"
                count={conversations.length}
                active={filter === "all"}
                onClick={() => setFilter("all")}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingList && conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">Cargando…</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                {filter === "open"
                  ? "No hay conversaciones abiertas"
                  : filter === "resolved"
                    ? "No hay conversaciones resueltas"
                    : "No hay conversaciones"}
              </div>
            ) : (
              <ul className="divide-y">
                {filteredConversations.map(c => (
                  <ConversationListItem
                    key={c.id}
                    conversation={c}
                    selected={c.id === selectedId}
                    onSelect={() => setSelectedId(c.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: thread */}
        <div className="flex flex-col border rounded-lg bg-white overflow-hidden">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              <div className="text-center">
                <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Selecciona una conversación</p>
              </div>
            </div>
          ) : (
            <>
              <ThreadHeader
                conversation={selectedConversation}
                busy={statusBusy}
                onToggle={next => toggleStatus(selectedConversation.id, next)}
                onRefresh={() => fetchMessages(selectedConversation.id)}
                loading={loadingThread}
              />

              <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-2">
                {loadingThread && messages.length === 0 ? (
                  <div className="text-center text-sm text-slate-500 py-6">Cargando…</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-sm text-slate-500 py-6">
                    Sin mensajes todavía
                  </div>
                ) : (
                  messages.map(m => <MessageBubble key={m.id} message={m} />)
                )}
                <div ref={threadBottomRef} />
              </div>

              {selectedConversation.status === "resolved" ? (
                <div className="border-t px-4 py-3 bg-slate-50 text-xs text-slate-500">
                  Conversación resuelta. Reábrela para responder.
                </div>
              ) : (
                <ReplyComposer
                  sending={sendingReply}
                  onSend={text => sendReply(selectedConversation.id, text)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 text-xs rounded-md px-2 py-1 border transition-colors",
        active
          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
      )}
    >
      {label}
      <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
        {count}
      </Badge>
    </button>
  )
}

function ConversationListItem({
  conversation,
  selected,
  onSelect,
}: {
  conversation: ConversationRow
  selected: boolean
  onSelect: () => void
}) {
  const tsSource = conversation.last_message_at ?? conversation.created_at
  const ts = tsSource
    ? formatDistanceToNow(new Date(tsSource), { addSuffix: true, locale: es })
    : ""
  const isInbound = conversation.last_message?.direction === "inbound"

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full text-left px-3 py-2.5 transition-colors",
          selected ? "bg-emerald-50" : "hover:bg-slate-50",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-medium truncate">
              {conversation.customer?.name ? (
                <User className="h-3 w-3 text-slate-400 shrink-0" />
              ) : (
                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
              )}
              <span className="truncate">{conversationDisplayName(conversation)}</span>
            </div>
            <p
              className={cn(
                "text-xs truncate mt-0.5",
                isInbound ? "text-slate-700 font-medium" : "text-slate-500",
              )}
            >
              {!isInbound && conversation.last_message?.direction === "outbound" ? "Tú: " : ""}
              {previewText(conversation)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[10px] text-slate-400 whitespace-nowrap">{ts}</span>
            {conversation.status === "resolved" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-amber-500" />
            )}
          </div>
        </div>
      </button>
    </li>
  )
}

function ThreadHeader({
  conversation,
  busy,
  onToggle,
  onRefresh,
  loading,
}: {
  conversation: ConversationRow
  busy: boolean
  onToggle: (next: "open" | "resolved") => void
  onRefresh: () => void
  loading: boolean
}) {
  const isResolved = conversation.status === "resolved"
  return (
    <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">
          {conversationDisplayName(conversation)}
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-2 truncate">
          <Phone className="h-3 w-3" />
          {conversation.customer_phone}
          {conversation.customer?.email && (
            <>
              <span>•</span>
              <span className="truncate">{conversation.customer.email}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-8 w-8 p-0"
          aria-label="Refresh"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
        <Button
          variant={isResolved ? "outline" : "default"}
          size="sm"
          disabled={busy}
          onClick={() => onToggle(isResolved ? "open" : "resolved")}
          className={cn(
            "h-8 text-xs gap-1",
            !isResolved && "bg-emerald-600 hover:bg-emerald-700",
          )}
        >
          {isResolved ? (
            <>
              <Circle className="h-3 w-3" />
              Reabrir
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Marcar resuelta
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: MessageRow }) {
  const isInbound = message.direction === "inbound"
  return (
    <div className={cn("flex", isInbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm",
          isInbound ? "bg-white border border-slate-200" : "bg-emerald-600 text-white",
        )}
      >
        {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
        {!message.content && message.media_type && (
          <div className="flex items-center gap-1 text-xs italic opacity-80">
            <ImageIcon className="h-3 w-3" />
            [{message.media_type}]
          </div>
        )}
        <div
          className={cn(
            "text-[10px] mt-1 text-right",
            isInbound ? "text-slate-400" : "text-emerald-100",
          )}
          title={format(new Date(message.created_at), "d MMM yyyy, h:mm a", { locale: es })}
        >
          {format(new Date(message.created_at), "h:mm a", { locale: es })}
        </div>
      </div>
    </div>
  )
}

function ReplyComposer({
  sending,
  onSend,
}: {
  sending: boolean
  onSend: (text: string) => Promise<boolean>
}) {
  const [text, setText] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const submit = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const ok = await onSend(trimmed)
    if (ok) {
      setText("")
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  const disabled = sending || !text.trim()

  return (
    <form
      className="border-t bg-white px-3 py-2"
      onSubmit={e => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje…"
          rows={2}
          maxLength={4096}
          disabled={sending}
          className="flex-1 resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60"
        />
        <Button
          type="submit"
          size="sm"
          disabled={disabled}
          className="bg-emerald-600 hover:bg-emerald-700 gap-1 h-9"
        >
          <Send className="h-3.5 w-3.5" />
          {sending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
      <p className="text-[10px] text-slate-400 mt-1">
        Enter envía · Shift+Enter hace un salto de línea
      </p>
    </form>
  )
}
