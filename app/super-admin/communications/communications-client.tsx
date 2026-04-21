"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  Star,
  ArrowLeft,
  Mail,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import {
  deleteEmailTemplate,
  EmailTemplateKey,
  seedDefaultTemplates,
  saveEmailTemplate,
  sendTestEmail,
  setDefaultTemplate,
} from "./actions"

type EmailTemplate = {
  id: string
  operator_id: string
  template_key: EmailTemplateKey
  template_name: string
  subject: string
  html_body: string
  from_name: string | null
  reply_to: string | null
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

const GROUPS: Array<{
  key: EmailTemplateKey
  title: string
  description: string
}> = [
  {
    key: "delivery_confirmation",
    title: "Confirmación Delivery",
    description: "Email enviado cuando una orden de delivery es confirmada.",
  },
  {
    key: "catering_confirmation",
    title: "Confirmación Catering",
    description: "Email enviado cuando una orden de catering es confirmada.",
  },
  {
    key: "welcome",
    title: "Bienvenida",
    description: "Email enviado cuando un cliente se registra por primera vez.",
  },
]

function emptyTemplate(operatorId: string, templateKey: EmailTemplateKey): Omit<EmailTemplate, "id" | "created_at" | "updated_at"> {
  return {
    operator_id: operatorId,
    template_key: templateKey,
    template_name: "Nueva plantilla",
    subject: "",
    html_body: "",
    from_name: "PR Delivery",
    reply_to: null,
    is_active: true,
    is_default: false,
  }
}

export function CommunicationsClient({
  operatorId,
  initialTemplates,
  embedded = false,
}: {
  operatorId: string
  initialTemplates: EmailTemplate[]
  embedded?: boolean
}) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates)
  const [isSeeding, setIsSeeding] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<EmailTemplateKey | null>(null)
  const [draft, setDraft] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const [testOpen, setTestOpen] = useState(false)
  const [testTemplateId, setTestTemplateId] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState("")
  const [sendingTest, setSendingTest] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null)

  const templatesByKey = useMemo(() => {
    const m: Record<EmailTemplateKey, EmailTemplate[]> = {
      delivery_confirmation: [],
      catering_confirmation: [],
      welcome: [],
    }
    for (const t of templates) m[t.template_key].push(t)
    return m
  }, [templates])

  const openNew = (key: EmailTemplateKey) => {
    setEditingId(null)
    setEditingKey(key)
    setDraft(emptyTemplate(operatorId, key))
    setEditorOpen(true)
  }

  const openEdit = (t: EmailTemplate) => {
    setEditingId(t.id)
    setEditingKey(t.template_key)
    setDraft({
      id: t.id,
      operator_id: t.operator_id,
      template_key: t.template_key,
      template_name: t.template_name,
      subject: t.subject,
      html_body: t.html_body,
      from_name: t.from_name,
      reply_to: t.reply_to,
      is_active: t.is_active,
      is_default: t.is_default,
    })
    setEditorOpen(true)
  }

  const onSave = async () => {
    if (!draft?.template_key) return
    setSaving(true)
    try {
      const saved = await saveEmailTemplate(draft)
      setTemplates((prev) => {
        const idx = prev.findIndex((x) => x.id === saved.id)
        if (idx === -1) return [saved, ...prev]
        const next = [...prev]
        next[idx] = saved
        return next
      })
      toast({ title: "Plantilla guardada" })
      setEditorOpen(false)
    } catch (e: any) {
      toast({
        title: "Error guardando plantilla",
        description: e?.message || "Intenta nuevamente.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const onToggleActive = async (t: EmailTemplate, checked: boolean) => {
    const nextDraft = {
      id: t.id,
      operator_id: t.operator_id,
      template_key: t.template_key,
      template_name: t.template_name,
      subject: t.subject,
      html_body: t.html_body,
      from_name: t.from_name,
      reply_to: t.reply_to,
      is_active: checked,
      is_default: t.is_default,
    }
    setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_active: checked } : x)))
    try {
      await saveEmailTemplate(nextDraft)
    } catch (e: any) {
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_active: t.is_active } : x)))
      toast({
        title: "Error actualizando estado",
        description: e?.message || "Intenta nuevamente.",
        variant: "destructive",
      })
    }
  }

  const onSetDefault = async (t: EmailTemplate) => {
    try {
      const updated = await setDefaultTemplate(t.id, operatorId, t.template_key)
      setTemplates((prev) =>
        prev.map((x) => {
          if (x.template_key !== t.template_key) return x
          if (x.id === updated.id) return { ...x, is_default: true }
          return { ...x, is_default: false }
        })
      )
      toast({ title: "Plantilla por defecto actualizada" })
    } catch (e: any) {
      toast({
        title: "Error cambiando plantilla por defecto",
        description: e?.message || "Intenta nuevamente.",
        variant: "destructive",
      })
    }
  }

  const openTest = (t: EmailTemplate) => {
    setTestTemplateId(t.id)
    setTestEmail("")
    setTestOpen(true)
  }

  const onSendTest = async () => {
    if (!testTemplateId) return
    setSendingTest(true)
    try {
      await sendTestEmail(testTemplateId, testEmail, operatorId)
      toast({ title: "Email de prueba enviado" })
      setTestOpen(false)
    } catch (e: any) {
      toast({
        title: "No se pudo enviar",
        description: e?.message || "Verifica el email e intenta nuevamente.",
        variant: "destructive",
      })
    } finally {
      setSendingTest(false)
    }
  }

  const confirmDelete = (t: EmailTemplate) => {
    setDeleteTarget(t)
    setDeleteOpen(true)
  }

  const onDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteEmailTemplate(deleteTarget.id, operatorId)
      setTemplates((prev) => prev.filter((x) => x.id !== deleteTarget.id))
      toast({ title: "Plantilla eliminada" })
    } catch (e: any) {
      toast({
        title: "Error eliminando plantilla",
        description: e?.message || "Intenta nuevamente.",
        variant: "destructive",
      })
    } finally {
      setDeleteOpen(false)
      setDeleteTarget(null)
    }
  }

  const pageContent = (
    <Fragment>
      {!embedded && (
        <div className="border-b bg-white">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/super-admin"
                className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-900 rounded-lg">
                  <Mail className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900 leading-tight">
                    Comunicaciones
                  </div>
                  <div className="text-xs text-slate-500">
                    Administra plantillas de email por operador
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={embedded ? "max-w-7xl mx-auto space-y-6" : "max-w-7xl mx-auto p-4 space-y-6"}>
        {templates.length === 0 && (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Plantillas base
              </div>
              <div className="text-sm text-slate-500">
                No hay plantillas. Puedes cargar las plantillas base para comenzar.
              </div>
            </div>
            <Button
              onClick={async () => {
                try {
                  setIsSeeding(true)
                  const inserted = await seedDefaultTemplates(operatorId)
                  if (Array.isArray(inserted) && inserted.length > 0) {
                    setTemplates(inserted as any)
                    toast({ title: "Plantillas base cargadas" })
                  }
                } catch (e: any) {
                  toast({
                    title: "No se pudieron cargar",
                    description: e?.message || "Intenta nuevamente.",
                    variant: "destructive",
                  })
                } finally {
                  setIsSeeding(false)
                }
              }}
              disabled={isSeeding}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {isSeeding ? "Cargando..." : "Cargar Plantillas Base"}
            </Button>
          </div>
        )}
        {GROUPS.map((group) => (
          <Card key={group.key} className="bg-white">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-slate-900">{group.title}</CardTitle>
                <div className="text-sm text-slate-500 mt-1">{group.description}</div>
              </div>
              <Button
                onClick={() => openNew(group.key)}
                className="bg-slate-900 hover:bg-slate-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Plantilla
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {templatesByKey[group.key].length === 0 ? (
                <div className="text-sm text-slate-500">
                  No hay plantillas todavía. Crea una nueva plantilla.
                </div>
              ) : (
                templatesByKey[group.key].map((t) => (
                  <Card key={t.id} className="border border-slate-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {t.template_name}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {t.subject}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {t.is_default && (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                              <Star className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          )}
                          <Switch
                            checked={t.is_active}
                            onCheckedChange={(checked) => onToggleActive(t, checked)}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSetDefault(t)}
                        >
                          <Star className="h-4 w-4 mr-2" />
                          Set Default
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTest(t)}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Test Send
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => confirmDelete(t)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          className="max-w-7xl w-[95vw] max-h-[90vh] overflow-y-auto"
          style={{ maxWidth: "95vw", width: "95vw" }}
        >
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Plantilla" : "Nueva Plantilla"}
            </DialogTitle>
            <DialogDescription>
              Edita el HTML y previsualiza el resultado en vivo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    value={draft?.template_name || ""}
                    onChange={(e) => setDraft((p: any) => ({ ...p, template_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={draft?.subject || ""}
                    onChange={(e) => setDraft((p: any) => ({ ...p, subject: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    value={draft?.from_name || ""}
                    onChange={(e) => setDraft((p: any) => ({ ...p, from_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reply-to (opcional)</Label>
                  <Input
                    value={draft?.reply_to || ""}
                    onChange={(e) =>
                      setDraft((p: any) => ({
                        ...p,
                        reply_to: e.target.value ? e.target.value : null,
                      }))
                    }
                    placeholder="support@tu-dominio.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>HTML</Label>
                <Textarea
                  value={draft?.html_body || ""}
                  onChange={(e) => setDraft((p: any) => ({ ...p, html_body: e.target.value }))}
                  className="min-h-[380px] font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">Preview</div>
              <div className="border rounded-md overflow-hidden bg-white">
                <iframe
                  title="template-preview"
                  width="100%"
                  height="600px"
                  scrolling="yes"
                  style={{ border: "none" }}
                  srcDoc={
                    draft?.html_body || "<div style='padding:16px;color:#666'>Sin contenido</div>"
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={onSave}
              className="bg-slate-900 hover:bg-slate-800"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar Email de Prueba</DialogTitle>
            <DialogDescription>
              Envia esta plantilla a un correo para verificar el formato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="tuemail@dominio.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={onSendTest}
              className="bg-slate-900 hover:bg-slate-800"
              disabled={sendingTest || !testEmail}
            >
              {sendingTest ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar plantilla</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. ¿Deseas eliminar{" "}
              <span className="font-semibold">{deleteTarget?.template_name}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Fragment>
  )

  if (embedded) return pageContent

  return <div className="min-h-screen bg-slate-50">{pageContent}</div>
}

