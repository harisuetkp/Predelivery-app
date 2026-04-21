"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { createPopup, updatePopup, deletePopup, togglePopupActive, type PopupPayload } from "@/app/actions/popups"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  Gift,
  Calendar,
  Clock,
  Mail,
  Download,
  Lock,
  Info,
} from "lucide-react"
import { ImageUpload } from "@/components/image-upload"

interface PromotionalPopup {
  id: string
  operator_id: string
  title: string
  body: string
  image_url: string | null
  cta_text: string | null
  cta_url: string | null
  show_on_delivery: boolean
  show_on_catering: boolean
  show_on_restaurant_portal: boolean
  show_on_catering_portal: boolean
  restaurant_id: string | null
  catering_restaurant_id: string | null
  catering_branch_id: string | null
  delay_seconds: number
  frequency: "once_per_session" | "every_visit"
  start_date: string | null
  end_date: string | null
  is_active: boolean
  created_at: string
  collect_email: boolean
  email_capture_label: string | null
  email_button_text: string | null
}

interface PopupLead {
  id: string
  email: string
  is_existing_customer: boolean
  created_at: string
}

interface Restaurant {
  id: string
  name: string
}

interface CateringRestaurant {
  id: string
  name: string
  is_chain: boolean
}

interface CateringBranch {
  id: string
  catering_restaurant_id: string
  name: string
  city: string | null
}

const EMPTY_FORM = {
  title: "",
  body: "",
  image_url: "",
  cta_text: "",
  cta_url: "",
  show_on_delivery: true,
  show_on_catering: false,
  show_on_restaurant_portal: false,
  show_on_catering_portal: false,
  applies_to: "platform" as "platform" | "restaurant",
  restaurant_id: "",
  catering_restaurant_id: "",
  catering_branch_id: "",
  delay_seconds: 3,
  frequency: "once_per_session" as "once_per_session" | "every_visit",
  start_date: "",
  end_date: "",
  is_active: true,
  collect_email: false,
  email_capture_label: "Ingresa tu email para desbloquear la oferta",
  email_button_text: "Desbloquear oferta",
}

export default function PopupsManagementPage() {
  const [popups, setPopups] = useState<PromotionalPopup[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [cateringRestaurants, setCateringRestaurants] = useState<CateringRestaurant[]>([])
  const [cateringBranches, setCateringBranches] = useState<CateringBranch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPopup, setEditingPopup] = useState<PromotionalPopup | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Leads modal state
  const [leadsModalOpen, setLeadsModalOpen] = useState(false)
  const [leadsPopupId, setLeadsPopupId] = useState<string | null>(null)
  const [leadsPopupTitle, setLeadsPopupTitle] = useState<string>("")
  const [leads, setLeads] = useState<PopupLead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)

  // Fetch popups and restaurants
  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      
      // Fetch popups
      const { data: popupsData, error: popupsError } = await supabase
        .from("promotional_popups")
        .select("id, operator_id, title, body, image_url, cta_text, cta_url, show_on_delivery, show_on_catering, show_on_restaurant_portal, show_on_catering_portal, restaurant_id, catering_restaurant_id, catering_branch_id, delay_seconds, frequency, start_date, end_date, is_active, created_at, collect_email, email_capture_label, email_button_text")
        .order("created_at", { ascending: false })
      
      if (popupsError) throw new Error(popupsError.message)
      setPopups(popupsData || [])

      // Fetch delivery restaurants
      const { data: restaurantsData } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("is_active", true)
        .order("name")
      setRestaurants(restaurantsData || [])

      // Fetch catering restaurants with is_chain flag
      const { data: cateringData } = await supabase
        .from("catering_restaurants")
        .select("id, name, is_chain")
        .eq("is_active", true)
        .order("name")
      setCateringRestaurants(cateringData || [])

      // Fetch catering branches for chain restaurants
      const { data: branchesData } = await supabase
        .from("catering_branches")
        .select("id, catering_restaurant_id, name, city")
        .eq("is_active", true)
        .order("name")
      setCateringBranches(branchesData || [])

    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Dialog helpers
  const openCreate = () => {
    setEditingPopup(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (popup: PromotionalPopup) => {
    setEditingPopup(popup)
    setForm({
      title: popup.title,
      body: popup.body,
      image_url: popup.image_url || "",
      cta_text: popup.cta_text || "",
      cta_url: popup.cta_url || "",
      show_on_delivery: popup.show_on_delivery,
      show_on_catering: popup.show_on_catering,
      show_on_restaurant_portal: popup.show_on_restaurant_portal,
      show_on_catering_portal: popup.show_on_catering_portal,
      applies_to: popup.restaurant_id || popup.catering_restaurant_id ? "restaurant" : "platform",
      restaurant_id: popup.restaurant_id || "",
      catering_restaurant_id: popup.catering_restaurant_id || "",
      catering_branch_id: popup.catering_branch_id || "",
      delay_seconds: popup.delay_seconds,
      frequency: popup.frequency,
      start_date: popup.start_date || "",
      end_date: popup.end_date || "",
      is_active: popup.is_active,
      collect_email: popup.collect_email || false,
      email_capture_label: popup.email_capture_label || "Ingresa tu email para desbloquear la oferta",
      email_button_text: popup.email_button_text || "Desbloquear oferta",
    })
    setDialogOpen(true)
  }

  // Validate form - at least one platform must be selected
  const validateForm = (): string | null => {
    if (!form.title.trim()) return "El título es requerido"
    if (!form.body.trim()) return "El mensaje es requerido"
    
    const hasAnyPlatform = form.show_on_delivery || 
      form.show_on_catering || 
      form.show_on_restaurant_portal || 
      form.show_on_catering_portal
    
    if (!hasAnyPlatform) return "Debes seleccionar al menos una plataforma"
    
    if (form.applies_to === "restaurant") {
      const needsDeliveryRestaurant = form.show_on_delivery || form.show_on_restaurant_portal
      const needsCateringRestaurant = form.show_on_catering || form.show_on_catering_portal
      
      if (needsDeliveryRestaurant && !form.restaurant_id) {
        return "Selecciona un restaurante de delivery"
      }
      if (needsCateringRestaurant && !form.catering_restaurant_id) {
        return "Selecciona un restaurante de catering"
      }
    }
    
    return null
  }

  // Save popup
  const handleSave = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)
    setError(null)
    
    try {
      const payload: PopupPayload = {
        title: form.title.trim(),
        body: form.body.trim(),
        image_url: form.image_url || null,
        cta_text: form.cta_text.trim() || null,
        cta_url: form.cta_url.trim() || null,
        show_on_delivery: form.show_on_delivery,
        show_on_catering: form.show_on_catering,
        show_on_restaurant_portal: form.show_on_restaurant_portal,
        show_on_catering_portal: form.show_on_catering_portal,
        restaurant_id: form.applies_to === "restaurant" && form.restaurant_id ? form.restaurant_id : null,
        catering_restaurant_id: form.applies_to === "restaurant" && form.catering_restaurant_id ? form.catering_restaurant_id : null,
        catering_branch_id: form.applies_to === "restaurant" && form.catering_branch_id ? form.catering_branch_id : null,
        delay_seconds: form.delay_seconds,
        frequency: form.frequency,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        is_active: form.is_active,
        collect_email: form.collect_email,
        email_capture_label: form.collect_email ? form.email_capture_label.trim() || null : null,
        email_button_text: form.collect_email ? form.email_button_text.trim() || null : null,
      }

      if (editingPopup) {
        // Server action handles authentication and updates without operator_id changes
        await updatePopup(editingPopup.id, payload)
      } else {
        // Server action handles getting operator_id from authenticated admin session
        const created = await createPopup(payload)
        if ("error" in created) {
          setError(created.error)
          return
        }
      }

      setDialogOpen(false)
      await fetchData()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete popup
  const handleDelete = async (id: string) => {
    setIsSaving(true)
    try {
      await deletePopup(id)
      setDeleteConfirm(null)
      await fetchData()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle active status
  const toggleActive = async (popup: PromotionalPopup) => {
    try {
      await togglePopupActive(popup.id, !popup.is_active)
      await fetchData()
    } catch {}
  }

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Intl.DateTimeFormat("es-PR", {
      timeZone: "America/Puerto_Rico",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr))
  }

  // Get platform badges
  const getPlatformBadges = (popup: PromotionalPopup) => {
    const badges = []
    if (popup.show_on_delivery) badges.push({ label: "Marketplace Delivery", color: "bg-blue-500" })
    if (popup.show_on_catering) badges.push({ label: "Marketplace Catering", color: "bg-orange-500" })
    if (popup.show_on_restaurant_portal) badges.push({ label: "Portales Delivery", color: "bg-cyan-500" })
    if (popup.show_on_catering_portal) badges.push({ label: "Portales Catering", color: "bg-amber-500" })
    return badges
  }

  // Get branches for selected catering restaurant
  const getSelectedCateringBranches = () => {
    if (!form.catering_restaurant_id) return []
    return cateringBranches.filter(b => b.catering_restaurant_id === form.catering_restaurant_id)
  }

  // Check if selected catering restaurant is a chain
  const selectedCateringIsChain = () => {
    if (!form.catering_restaurant_id) return false
    const restaurant = cateringRestaurants.find(r => r.id === form.catering_restaurant_id)
    return restaurant?.is_chain === true
  }

  // Fetch leads for a popup
  const openLeadsModal = async (popup: PromotionalPopup) => {
    setLeadsPopupId(popup.id)
    setLeadsPopupTitle(popup.title)
    setLeadsModalOpen(true)
    setLoadingLeads(true)
    setLeads([])

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("promotional_popup_leads")
        .select("id, email, is_existing_customer, created_at")
        .eq("popup_id", popup.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setLeads(data || [])
    } catch (e: any) {
      setError(`Error cargando leads: ${e.message}`)
    } finally {
      setLoadingLeads(false)
    }
  }

  // Export leads to CSV
  const exportLeadsCSV = () => {
    if (leads.length === 0) return

    const headers = ["Email", "Cliente Existente", "Fecha"]
    const rows = leads.map((lead) => [
      lead.email,
      lead.is_existing_customer ? "Sí" : "No",
      new Date(lead.created_at).toLocaleString("es-PR"),
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `leads-${leadsPopupTitle.replace(/[^a-z0-9]/gi, "_")}-${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/super-admin"
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Módulos
            </Link>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-600" />
              <h1 className="text-lg font-bold text-gray-900">Pop-up Promocionales</h1>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Pop-up
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Description */}
        <p className="text-sm text-gray-500">
          Configura ofertas y promociones que aparecen automáticamente a tus clientes.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {/* Popup list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : popups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <Gift className="h-12 w-12" />
              <p className="text-sm">No hay pop-ups promocionales.</p>
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Crear tu primer pop-up
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {popups.map((popup) => (
              <Card
                key={popup.id}
                className={`transition-opacity ${popup.is_active ? "" : "opacity-50"}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="w-24 h-16 rounded-md overflow-hidden bg-gray-100 shrink-0">
                      {popup.image_url ? (
                        <img src={popup.image_url} alt={popup.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Gift className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 truncate">{popup.title}</h3>
                          <p className="text-sm text-gray-500 line-clamp-1">{popup.body}</p>
                        </div>
                        <Badge variant={popup.is_active ? "default" : "secondary"}>
                          {popup.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>

                      {/* Platform badges */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {getPlatformBadges(popup).map((badge, i) => (
                          <span
                            key={i}
                            className={`${badge.color} text-white text-[10px] font-medium px-1.5 py-0.5 rounded`}
                          >
                            {badge.label}
                          </span>
                        ))}
                        {popup.collect_email && (
                          <span className="bg-purple-500 text-white text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Mail className="w-2.5 h-2.5" />
                            Captura Email
                          </span>
                        )}
                      </div>

                      {/* Date range */}
                      {(popup.start_date || popup.end_date) && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {formatDate(popup.start_date) || "Siempre"} - {formatDate(popup.end_date) || "Siempre"}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {popup.collect_email && (
                        <button
                          onClick={() => openLeadsModal(popup)}
                          className="p-1.5 rounded hover:bg-purple-50 text-purple-600 transition-colors"
                          title="Ver Leads"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleActive(popup)}
                        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
                          popup.is_active ? "text-emerald-600" : "text-gray-400"
                        }`}
                        title={popup.is_active ? "Desactivar" : "Activar"}
                      >
                        {popup.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => openEdit(popup)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(popup.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPopup ? "Editar Pop-up" : "Nuevo Pop-up"}</DialogTitle>
            <DialogDescription>
              Configura el contenido y dónde se mostrará este pop-up promocional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="popup-title">Título *</Label>
              <Input
                id="popup-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="ej. ¡Oferta Especial!"
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label htmlFor="popup-body">Mensaje *</Label>
              <Textarea
                id="popup-body"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="ej. Aprovecha 20% de descuento en tu primera orden"
                rows={3}
              />
            </div>

            {/* Image */}
            <div className="space-y-1.5">
              <Label>Imagen (opcional)</Label>
              <ImageUpload
                value={form.image_url}
                onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
                onRemove={() => setForm((f) => ({ ...f, image_url: "" }))}
                label=""
                bucket="public-assets"
                folder="popups"
              />
              <p className="text-xs text-gray-400">Recomendado: 600 × 300 px. Max 5 MB.</p>
            </div>

            {/* CTA Button */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="popup-cta-text">Texto del botón{form.collect_email ? " (opcional)" : ""}</Label>
                <Input
                  id="popup-cta-text"
                  value={form.cta_text}
                  onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))}
                  placeholder="ej. Ver ofertas"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="popup-cta-url">URL del botón{form.collect_email ? " (opcional)" : ""}</Label>
                <Input
                  id="popup-cta-url"
                  value={form.cta_url}
                  onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
                  placeholder="ej. /ofertas"
                />
                <p className="text-xs text-gray-400">
                  Para links externos incluye https:// (ej: https://prdelivery.com). Para páginas internas usa / (ej:
                  /restaurantes)
                </p>
              </div>
            </div>

            {/* Email Capture Section */}
            <div className="space-y-3 border border-purple-200 rounded-lg p-4 bg-purple-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-purple-600" />
                  <Label className="text-sm font-medium text-purple-900">Captura de Email</Label>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.collect_email}
                  onClick={() => setForm((f) => ({ ...f, collect_email: !f.collect_email }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    form.collect_email ? "bg-purple-500" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      form.collect_email ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-purple-600">
                Recopila el email del cliente antes de mostrar la oferta.
              </p>

              {form.collect_email && (
                <div className="space-y-3 pt-2 border-t border-purple-200">
                  <div className="space-y-1.5">
                    <Label htmlFor="email-capture-label" className="text-sm">Texto del campo de email</Label>
                    <Input
                      id="email-capture-label"
                      value={form.email_capture_label}
                      onChange={(e) => setForm((f) => ({ ...f, email_capture_label: e.target.value }))}
                      placeholder="ej. Ingresa tu email para desbloquear la oferta"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email-button-text" className="text-sm">Texto del botón</Label>
                    <Input
                      id="email-button-text"
                      value={form.email_button_text}
                      onChange={(e) => setForm((f) => ({ ...f, email_button_text: e.target.value }))}
                      placeholder="ej. Desbloquear oferta"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Platforms */}
            <div className="space-y-2">
              <Label>Mostrar en: *</Label>
              <TooltipProvider delayDuration={200}>
                <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="delivery-marketplace"
                      checked={form.show_on_delivery}
                      onCheckedChange={(checked) => 
                        setForm((f) => ({ ...f, show_on_delivery: checked === true }))
                      }
                    />
                    <label htmlFor="delivery-marketplace" className="text-sm">
                      Marketplace Delivery (prdelivery.com)
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[260px]">
                        <p>Aparece en la página principal del marketplace de delivery donde los clientes buscan restaurantes. Visible para todos los visitantes antes de entrar a un restaurante.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="catering-marketplace"
                      checked={form.show_on_catering}
                      onCheckedChange={(checked) => 
                        setForm((f) => ({ ...f, show_on_catering: checked === true }))
                      }
                    />
                    <label htmlFor="catering-marketplace" className="text-sm">
                      Marketplace Catering (prdelivery.com/catering)
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[260px]">
                        <p>Aparece en la página principal del marketplace de catering. Visible para todos los visitantes que buscan opciones de catering.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="restaurant-portal"
                      checked={form.show_on_restaurant_portal}
                      onCheckedChange={(checked) => 
                        setForm((f) => ({ ...f, show_on_restaurant_portal: checked === true }))
                      }
                    />
                    <label htmlFor="restaurant-portal" className="text-sm">
                      Portales de Restaurantes — Delivery
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[260px]">
                        <p>Aparece dentro del menú de un restaurante de delivery específico. Si seleccionas Restaurante específico abajo, solo aparece en ese restaurante. Si seleccionas Toda la plataforma aparece en todos los restaurantes de delivery.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="catering-portal"
                      checked={form.show_on_catering_portal}
                      onCheckedChange={(checked) => 
                        setForm((f) => ({ ...f, show_on_catering_portal: checked === true }))
                      }
                    />
                    <label htmlFor="catering-portal" className="text-sm">
                      Portales de Restaurantes — Catering
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[260px]">
                        <p>Aparece dentro del portal de catering de un restaurante. Puedes dirigirlo a toda la plataforma, a un restaurante específico, o a una sucursal específica de una cadena.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </TooltipProvider>
            </div>

            {/* Applies to */}
            <div className="space-y-2">
              <Label>Aplica a:</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="applies-to"
                    value="platform"
                    checked={form.applies_to === "platform"}
                    onChange={() => setForm((f) => ({ ...f, applies_to: "platform", restaurant_id: "", catering_restaurant_id: "" }))}
                    className="text-amber-600"
                  />
                  <span className="text-sm">Toda la plataforma</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="applies-to"
                    value="restaurant"
                    checked={form.applies_to === "restaurant"}
                    onChange={() => setForm((f) => ({ ...f, applies_to: "restaurant" }))}
                    className="text-amber-600"
                  />
                  <span className="text-sm">Restaurante específico</span>
                </label>
              </div>

              {form.applies_to === "restaurant" && (
                <div className="space-y-4 mt-3">
                  <div className="grid grid-cols-2 gap-4">
                    {(form.show_on_delivery || form.show_on_restaurant_portal) && (
                      <div className="space-y-1.5">
                        <Label>Restaurante Delivery</Label>
                        <Select
                          value={form.restaurant_id}
                          onValueChange={(v) => setForm((f) => ({ ...f, restaurant_id: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {restaurants.map((r) => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {(form.show_on_catering || form.show_on_catering_portal) && (
                      <div className="space-y-1.5">
                        <Label>Restaurante Catering</Label>
                        <Select
                          value={form.catering_restaurant_id}
                          onValueChange={(v) => setForm((f) => ({ ...f, catering_restaurant_id: v, catering_branch_id: "" }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {cateringRestaurants.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}{r.is_chain ? " (cadena)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Branch selector for chain catering restaurants */}
                  {selectedCateringIsChain() && (form.show_on_catering || form.show_on_catering_portal) && (
                    <div className="space-y-1.5">
                      <Label>Sucursal (opcional)</Label>
                      <Select
                        value={form.catering_branch_id || "all"}
                        onValueChange={(v) => setForm((f) => ({ ...f, catering_branch_id: v === "all" ? "" : v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todas las sucursales" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas las sucursales</SelectItem>
                          {getSelectedCateringBranches().map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}{b.city ? ` - ${b.city}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-400">
                        Deja en &quot;Todas las sucursales&quot; para mostrar en todas las sucursales de esta cadena.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delay */}
            <div className="space-y-1.5">
              <Label>Delay antes de mostrar</Label>
              <Select
                value={String(form.delay_seconds)}
                onValueChange={(v) => setForm((f) => ({ ...f, delay_seconds: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Inmediatamente</SelectItem>
                  <SelectItem value="2">2 segundos</SelectItem>
                  <SelectItem value="3">3 segundos</SelectItem>
                  <SelectItem value="5">5 segundos</SelectItem>
                  <SelectItem value="10">10 segundos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Frequency */}
            <div className="space-y-1.5">
              <Label>Frecuencia</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="frequency"
                    value="once_per_session"
                    checked={form.frequency === "once_per_session"}
                    onChange={() => setForm((f) => ({ ...f, frequency: "once_per_session" }))}
                    className="text-amber-600"
                  />
                  <span className="text-sm">Una vez por sesión</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="frequency"
                    value="every_visit"
                    checked={form.frequency === "every_visit"}
                    onChange={() => setForm((f) => ({ ...f, frequency: "every_visit" }))}
                    className="text-amber-600"
                  />
                  <span className="text-sm">Cada visita</span>
                </label>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="popup-start-date">Fecha de inicio</Label>
                <Input
                  id="popup-start-date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
                <p className="text-xs text-gray-400">Vacío = siempre</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="popup-end-date">Fecha de fin</Label>
                <Input
                  id="popup-end-date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
                <p className="text-xs text-gray-400">Vacío = siempre</p>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Activo</p>
                <p className="text-xs text-gray-400">Los pop-ups inactivos no se mostrarán.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.is_active}
                onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  form.is_active ? "bg-amber-500" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    form.is_active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-amber-500 hover:bg-amber-600">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPopup ? "Guardar cambios" : "Crear Pop-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar Pop-up</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este pop-up? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leads Modal */}
      <Dialog open={leadsModalOpen} onOpenChange={setLeadsModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-purple-600" />
              Leads: {leadsPopupTitle}
            </DialogTitle>
            <DialogDescription>
              Emails capturados a través de este pop-up promocional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Stats */}
            <div className="bg-purple-50 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-purple-900">{leads.length}</p>
                <p className="text-sm text-purple-600">Total de leads</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={exportLeadsCSV}
                disabled={leads.length === 0}
                className="gap-1"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>

            {/* Leads Table */}
            {loadingLeads ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Mail className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay leads capturados aún.</p>
              </div>
            ) : (
              <div className="max-h-[40vh] overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
                      <th className="text-center px-4 py-2 font-medium text-gray-600">Cliente</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-gray-900">{lead.email}</td>
                        <td className="px-4 py-2.5 text-center">
                          {lead.is_existing_customer ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Sí</Badge>
                          ) : (
                            <Badge variant="secondary">No</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-500">
                          {new Intl.DateTimeFormat("es-PR", {
                            timeZone: "America/Puerto_Rico",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(lead.created_at))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLeadsModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
