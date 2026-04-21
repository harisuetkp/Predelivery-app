"use client"

import { useState, useRef, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import {
  Pencil, Trash2, Plus, Settings, ArrowLeft, ChevronUp, ChevronDown,
  Upload, X, Package, ShoppingBag, ClipboardList, LayoutDashboard,
  Clock, MapPin, Printer, CreditCard, ChevronsUpDown, Check, ArrowRightLeft, GripVertical
} from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { createClient } from "@/lib/supabase/client"
import { CateringTemplatePreview, CATERING_TEMPLATE_INFO, type CateringDesignTemplate } from "@/components/catering/catering-design-templates"
import { OrderNotificationSettings } from "@/components/order-notification-settings"
import {
  fetchCateringCategories, createCateringCategory, updateCateringCategory, deleteCateringCategory,
  fetchCateringMenuItems, createCateringMenuItem, updateCateringMenuItem, deleteCateringMenuItem,
  getCateringItemSizes, createCateringItemSize, updateCateringItemSize, deleteCateringItemSize,
  getCateringSizesFromOtherItems, copyCateringSizeToMenuItem,
  getCateringItemOptions, createCateringItemOption, updateCateringItemOption, deleteCateringItemOption,
  getCateringOptionsFromOtherItems, copyCateringOptionToMenuItem,
  getCateringItemOptionChoices, createCateringItemOptionChoice, updateCateringItemOptionChoice, deleteCateringItemOptionChoice,
  fetchCateringOrders, updateCateringOrderStatus,
  fetchCateringBranchesForAdmin, updateCateringRestaurantSettings,
  createCateringBranch, updateCateringBranch, deleteCateringBranch, reorderCateringBranches,
  fetchCateringOperatingHours, saveCateringOperatingHours,
  fetchCateringBranchOperatingHours, saveCateringBranchOperatingHours,
  fetchCateringDeliveryZones, createCateringDeliveryZone, updateCateringDeliveryZone, deleteCateringDeliveryZone,
  fetchCateringContainerRates, upsertCateringContainerBaseRate, upsertCateringContainerRateTier, deleteCateringContainerRateTier,
  fetchCuisineTypes,
} from "./actions"

const SELLING_UNITS = [
  { key: "each", label: "Each (standard item)" },
  { key: "tray", label: "Tray / Bandeja (serves multiple people)" },
  { key: "half_tray", label: "Half Tray / Bandejita" },
  { key: "bowl", label: "Bowl" },
  { key: "bowl_8oz", label: "Bowl 8oz" },
  { key: "bowl_16oz", label: "Bowl 16oz" },
  { key: "bowl_32oz", label: "Bowl 32oz" },
  { key: "bowl_64oz", label: "Bowl 64oz" },
  { key: "bottle_750ml", label: "Botella 750ml" },
  { key: "gallon", label: "Gallon / Galon" },
  { key: "half_gallon", label: "Half Gallon / Medio Galon" },
  { key: "liter", label: "Liter / Litro" },
  { key: "per_pound", label: "Per Pound / Por Libra (sold by weight)" },
  { key: "per_person", label: "Per Person / Por Persona (priced per guest)" },
  { key: "cena_completa", label: "Cena Completa (combo / full dinner)" },
  { key: "box", label: "Box (boxed portions)" },
  { key: "boxed_lunch", label: "Boxed Lunch (individual meals)" },
  { key: "paquete", label: "Paquete" },
  { key: "bolsa", label: "Bolsa" },
  { key: "orden", label: "Orden" },
]

const CONTAINER_TYPES = [
  { key: "none", label: "Ninguno (no cuenta para delivery)" },
  { key: "heavy_tray", label: "Bandeja Pesada (Heavy Tray)" },
  { key: "light_tray", label: "Bandeja Liviana (Light Tray)" },
  { key: "full_tray", label: "Full Tray" },
  { key: "half_tray", label: "Half Tray" },
  { key: "bowl", label: "Bowl" },
  { key: "bowl_8oz", label: "Bowl 8oz" },
  { key: "bowl_16oz", label: "Bowl 16oz" },
  { key: "bowl_32oz", label: "Bowl 32oz" },
  { key: "bowl_64oz", label: "Bowl 64oz" },
  { key: "bag", label: "Bolsa (Bag)" },
  { key: "box", label: "Caja (Box)" },
  { key: "package", label: "Paquete (Package)" },
]

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

/**
 * TriStateToggle — lets the admin explicitly choose Hereda (null), Sí (true), or No (false)
 * for a boolean per-branch override. NULL means "inherit from parent catering_restaurant."
 */
function TriStateToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean | null) => void
}) {
  const options: { key: string; v: boolean | null; label: string }[] = [
    { key: "inherit", v: null, label: "Hereda" },
    { key: "yes", v: true, label: "Sí" },
    { key: "no", v: false, label: "No" },
  ]
  return (
    <div>
      {label && <Label className="text-xs">{label}</Label>}
      <div className="mt-1 inline-flex rounded-lg border border-gray-200 overflow-hidden">
        {options.map((opt) => {
          const active = value === opt.v
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * NumberOverrideField — numeric input where empty-string means NULL (inherit).
 */
function NumberOverrideField({
  label,
  value,
  onChange,
  placeholder,
  step = "1",
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  step?: string
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
        placeholder={placeholder}
        className="mt-1"
      />
    </div>
  )
}

interface CateringAdminClientProps {
  restaurant: any
  initialCategories: any[]
  initialMenuItems: any[]
  initialBranches: any[]
  initialOrders: any[]
  isSuperAdmin: boolean
  userRole: string
}

export default function CateringAdminClient({
  restaurant,
  initialCategories,
  initialMenuItems,
  initialBranches,
  initialOrders,
  isSuperAdmin,
  userRole,
}: CateringAdminClientProps) {
const primaryColor = restaurant.primary_color || "#0f172a"
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")

  // Restaurant switcher state (for super admins)
  const [operatorRestaurants, setOperatorRestaurants] = useState<{ id: string; name: string; slug: string }[]>([])

  const [categories, setCategories] = useState(initialCategories)
  const [menuItems, setMenuItems] = useState(initialMenuItems)
  const [branches, setBranches] = useState(initialBranches)
  const [orders, setOrders] = useState(initialOrders)
  
  // Default to settings tab when coming from restaurant switcher
  const getInitialTab = () => {
    if (tabParam && ["overview", "orders", "menu", "branches", "settings"].includes(tabParam)) {
      return tabParam
    }
    return "overview"
  }
  const [activeTab, setActiveTab] = useState(getInitialTab())
  const [loading, setLoading] = useState(false)

  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", is_active: true })

  const [showMenuItemModal, setShowMenuItemModal] = useState(false)
  const [editingMenuItem, setEditingMenuItem] = useState<any>(null)
  const [menuItemForm, setMenuItemForm] = useState({
    name: "", description: "", price: "", category_id: "",
    image_url: "", selling_unit: "tray", is_active: true,
    min_quantity: "1", serves: "",
    container_type: "none", lead_time_hours: "", is_cart_upsell: false,
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [showSizesModal, setShowSizesModal] = useState(false)
  const [sizesMenuItem, setSizesMenuItem] = useState<any>(null)
  const [sizes, setSizes] = useState<any[]>([])
  const [editingSizeId, setEditingSizeId] = useState<string | null>(null)
  const [sizeForm, setSizeForm] = useState({ catering_name: "", catering_price: "", catering_serves: "", catering_is_default: false })
  const [showBrowseSizes, setShowBrowseSizes] = useState(false)
  const [availableSizes, setAvailableSizes] = useState<any[]>([])
  const [loadingAvailableSizes, setLoadingAvailableSizes] = useState(false)

  const [showOptionsModal, setShowOptionsModal] = useState(false)
  const [optionsMenuItem, setOptionsMenuItem] = useState<any>(null)
  const [itemOptions, setItemOptions] = useState<any[]>([])
  const [showOptionForm, setShowOptionForm] = useState(false)
  const [editingOption, setEditingOption] = useState<any>(null)
  const [optionForm, setOptionForm] = useState({
    catering_name: "", catering_prompt: "", catering_display_type: "pills",
    catering_is_required: false, catering_min_selections: "0", catering_max_selections: "1",
    choices: [] as { id?: string; catering_name: string; catering_price_modifier: string }[],
  })
  const [showBrowseOptions, setShowBrowseOptions] = useState(false)
  const [availableOptions, setAvailableOptions] = useState<any[]>([])
  const [loadingAvailableOptions, setLoadingAvailableOptions] = useState(false)

const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [orderFilter, setOrderFilter] = useState<"all" | "delivery" | "pickup">("all")

  // Branch management state
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [editingBranch, setEditingBranch] = useState<any>(null)
  // Empty override defaults — NULL on every field means "inherit from parent catering_restaurant"
  const EMPTY_BRANCH_FORM = {
    name: "", address: "", city: "", state: "PR",
    zip_code: "", phone: "", email: "",
    latitude: null as number | null,
    longitude: null as number | null,
    // ---- per-branch overrides (NULL = inherit) ----
    enable_delivery: null as boolean | null,
    enable_pickup: null as boolean | null,
    delivery_radius_miles: null as number | null,
    delivery_fee: null as number | null,
    min_delivery_order: null as number | null,
    min_pickup_order: null as number | null,
    default_lead_time_hours: null as number | null,
    delivery_turnaround_hours: null as number | null,
    pickup_turnaround_hours: null as number | null,
    notification_email: null as string | null,
    notification_method: null as string | null,
    eatabit_restaurant_key: null as string | null,
    printer_tier: null as string | null,
    athmovil_enabled: null as boolean | null,
    athmovil_public_token: null as string | null,
    athmovil_private_token: null as string | null,
    cash_payment_enabled: null as boolean | null,
    stripe_enabled: null as boolean | null,
    tax_rate: null as number | null,
    // Main Dispatch routing
    route_to_main_dispatch: null as boolean | null,
    dispatch_hub_branch_id: null as string | null,
  }
  const [branchForm, setBranchForm] = useState(EMPTY_BRANCH_FORM)
  const [branchEditTab, setBranchEditTab] = useState<"info" | "service" | "payments" | "dispatch" | "notifications" | "hours">("info")
  const [branchSaving, setBranchSaving] = useState(false)
  const [branchError, setBranchError] = useState<string | null>(null)

  const [operatingHours, setOperatingHours] = useState<any[]>([])
  const [hoursLoaded, setHoursLoaded] = useState(false)
  const [savingHours, setSavingHours] = useState(false)

  // Per-branch operating hours (overrides catering_operating_hours). Each row
  // carries an `inherit` flag - when true, we delete the branch row on save so
  // the day falls back to the chain default.
  const [branchHours, setBranchHours] = useState<
    Array<{
      day_of_week: number
      is_open: boolean
      open_time: string
      close_time: string
      inherit: boolean
    }>
  >([])
  const [branchHoursLoaded, setBranchHoursLoaded] = useState(false)

  const [deliveryZones, setDeliveryZones] = useState<any[]>([])
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [editingZone, setEditingZone] = useState<any>(null)
  const [zoneForm, setZoneForm] = useState({ name: "", min_miles: "0", max_miles: "", delivery_fee: "" })

const [containerBaseRate, setContainerBaseRate] = useState<any>(null)
  const [containerTiers, setContainerTiers] = useState<any[]>([])
  const [containerBaseForm, setContainerBaseForm] = useState({ base_fee: "0", containers_included: "4" })
  const [containerTierForm, setContainerTierForm] = useState({ container_type: "", label: "", extra_fee_per_unit: "" })
  const [editingContainerTier, setEditingContainerTier] = useState<any>(null)

  const [cuisineTypes, setCuisineTypes] = useState<{ id: string; name: string }[]>([])
  const [cuisineTypesError, setCuisineTypesError] = useState<string | null>(null)
  const [cuisineTypesLoaded, setCuisineTypesLoaded] = useState(false)

const [settingsForm, setSettingsForm] = useState({
    name: restaurant.name || "",
    description: restaurant.description || "",
    logo_url: restaurant.logo_url || "",
    banner_logo_url: restaurant.banner_logo_url || "",
    hero_image_url: restaurant.hero_image_url || "",
    default_item_image_url: (restaurant as any).default_item_image_url || "",
    hide_branch_title: restaurant.hide_branch_title || false,
    primary_color: restaurant.primary_color || "#000000",
    cuisine_type: restaurant.cuisine_type || "",
    design_template: restaurant.design_template || "modern",
    show_in_marketplace: !!restaurant.show_in_marketplace,
    custom_domain: restaurant.custom_domain || "",
notification_email: restaurant.notification_email || "",
    notification_method: restaurant.notification_method || "email",
    email_fallback_enabled: !!restaurant.email_fallback_enabled,
    eatabit_restaurant_key: restaurant.eatabit_restaurant_key || "",
    multi_email: !!restaurant.multi_email,
    multi_kds: !!restaurant.multi_kds,
    multi_eatabit: !!restaurant.multi_eatabit,
    multi_chowly: !!restaurant.multi_chowly,
    multi_square_kds: !!restaurant.multi_square_kds,
    restaurant_address: restaurant.restaurant_address || "",
    tax_rate: restaurant.tax_rate ? String(Math.round(restaurant.tax_rate * 100)) : "10.5",
    delivery_fee: String(restaurant.delivery_fee || 0),
    minimum_order: String(restaurant.minimum_order || 0),
    default_lead_time_hours: String(restaurant.default_lead_time_hours || 24),
    max_advance_days: String(restaurant.max_advance_days || 21),
    delivery_turnaround_hours: restaurant.delivery_turnaround_hours ? String(restaurant.delivery_turnaround_hours) : "",
    pickup_turnaround_hours: restaurant.pickup_turnaround_hours ? String(restaurant.pickup_turnaround_hours) : "",
    min_delivery_order: restaurant.min_delivery_order ? String(restaurant.min_delivery_order) : "",
    min_pickup_order: restaurant.min_pickup_order ? String(restaurant.min_pickup_order) : "",
    delivery_radius_miles: String(restaurant.delivery_radius_miles || 7),
tip_option_1: restaurant.tip_option_1 != null ? String(restaurant.tip_option_1) : "",
    tip_option_2: restaurant.tip_option_2 != null ? String(restaurant.tip_option_2) : "",
    tip_option_3: restaurant.tip_option_3 != null ? String(restaurant.tip_option_3) : "",
    tip_option_4: restaurant.tip_option_4 != null ? String(restaurant.tip_option_4) : "",
    default_tip_option: restaurant.default_tip_option != null ? String(restaurant.default_tip_option) : "",
    enable_delivery: restaurant.enable_delivery !== false,
    enable_pickup: restaurant.enable_pickup !== false,
stripe_enabled: restaurant.stripe_enabled !== false,
    stripe_account_id: restaurant.stripe_account_id || "",
    square_enabled: !!restaurant.square_enabled,
    square_access_token: restaurant.square_access_token || "",
    square_location_id: restaurant.square_location_id || "",
    square_environment: restaurant.square_environment || "production",
    athmovil_enabled: !!restaurant.athmovil_enabled,
    athmovil_public_token: restaurant.athmovil_public_token || "",
    athmovil_private_token: restaurant.athmovil_private_token || "",
    cash_payment_enabled: !!restaurant.cash_payment_enabled,
    shipday_api_key: restaurant.shipday_api_key || "",
kds_access_token: restaurant.kds_access_token || "",
    kds_setup_code: restaurant.kds_setup_code || "",
    kds_admin_pin: restaurant.kds_admin_pin || "",
    printer_tier: restaurant.printer_tier || "none",
    // Order notification settings
    order_notification_method: restaurant.order_notification_method || "email",
    email_fallback_enabled: !!restaurant.email_fallback_enabled,
    chowly_api_key: restaurant.chowly_api_key || "",
    chowly_location_id: restaurant.chowly_location_id || "",
    chowly_enabled: !!restaurant.chowly_enabled,
    square_kds_enabled: !!restaurant.square_kds_enabled,
    eatabit_enabled: !!restaurant.eatabit_enabled,
    eatabit_restaurant_key: restaurant.eatabit_restaurant_key || "",
    show_service_packages: restaurant.show_service_packages !== false,
    packages_section_title: restaurant.packages_section_title || "Servicios",
    is_chain: !!restaurant.is_chain,
footer_description: restaurant.footer_description || "",
    footer_phone: restaurant.footer_phone || "",
    footer_email: restaurant.footer_email || "",
    // Dispatch fee configuration
    dispatch_fee_type: restaurant.dispatch_fee_type || "none",
    dispatch_fee_value: restaurant.dispatch_fee_value ? String(restaurant.dispatch_fee_value) : "",
    dispatch_fee_applies_to: restaurant.dispatch_fee_applies_to || "both",
    // Chain-level Main Dispatch default (branch override = NULL means inherit this)
    route_to_main_dispatch_default: restaurant.route_to_main_dispatch_default !== false,
  })

  const logoInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const heroInputRef = useRef<HTMLInputElement>(null)
  const defaultItemInputRef = useRef<HTMLInputElement>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)
  const [uploadingDefaultItem, setUploadingDefaultItem] = useState(false)

// Load all catering restaurants for this operator (for restaurant switcher when super admin)
  useEffect(() => {
    if (isSuperAdmin && restaurant.operator_id) {
      supabase
        .from("catering_restaurants")
        .select("id, name, slug")
        .eq("operator_id", restaurant.operator_id)
        .order("name")
        .then(({ data, error }) => {
          if (error) {
            console.error("Error fetching operator restaurants:", error)
            return
          }
          setOperatorRestaurants(data || [])
        })
    }
  }, [isSuperAdmin, restaurant.operator_id])

  useEffect(() => {
    if (activeTab === "settings" && !hoursLoaded) {
      fetchCateringOperatingHours(restaurant.id).then((hours) => {
        setOperatingHours(hours)
        setHoursLoaded(true)
      }).catch(() => {})
      fetchCateringDeliveryZones(restaurant.id).then(setDeliveryZones).catch(() => {})
      fetchCateringContainerRates(restaurant.id).then(({ baseRate, tiers }) => {
        if (baseRate) {
          setContainerBaseRate(baseRate)
          setContainerBaseForm({ base_fee: String(baseRate.base_fee), containers_included: String(baseRate.containers_included) })
        }
        setContainerTiers(tiers)
      }).catch(() => {})
    }
    if (activeTab === "settings" && !cuisineTypesLoaded) {
      fetchCuisineTypes().then((types) => {
        setCuisineTypes(types)
        setCuisineTypesLoaded(true)
      }).catch((err) => {
        setCuisineTypesError(err.message)
        setCuisineTypesLoaded(true)
      })
    }
  }, [activeTab])

  // Load per-branch operating hours when the branch editor opens for an existing
  // branch. Merge branch override rows with chain defaults so every day (0-6) has
  // an entry - days without a branch row show as "Hereda del restaurante".
  useEffect(() => {
    if (!editingBranch) {
      setBranchHours([])
      setBranchHoursLoaded(false)
      return
    }
    setBranchHoursLoaded(false)
    Promise.all([
      fetchCateringBranchOperatingHours(editingBranch.id),
      hoursLoaded ? Promise.resolve(operatingHours) : fetchCateringOperatingHours(restaurant.id),
    ])
      .then(([branchRows, chainRowsRaw]) => {
        const chainRows = (chainRowsRaw as any[]) || []
        if (!hoursLoaded) {
          setOperatingHours(chainRows)
          setHoursLoaded(true)
        }
        const merged = Array.from({ length: 7 }, (_, day) => {
          const branchRow = (branchRows as any[]).find((r) => r.day_of_week === day)
          const chainRow = chainRows.find((r: any) => r.day_of_week === day)
          if (branchRow) {
            return {
              day_of_week: day,
              is_open: Boolean(branchRow.is_open),
              open_time: branchRow.open_time ?? chainRow?.open_time ?? "09:00",
              close_time: branchRow.close_time ?? chainRow?.close_time ?? "17:00",
              inherit: false,
            }
          }
          return {
            day_of_week: day,
            is_open: chainRow ? Boolean(chainRow.is_open) : false,
            open_time: chainRow?.open_time ?? "09:00",
            close_time: chainRow?.close_time ?? "17:00",
            inherit: true,
          }
        })
        setBranchHours(merged)
        setBranchHoursLoaded(true)
      })
      .catch(() => {
        setBranchHoursLoaded(true)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingBranch?.id])

  async function uploadToStorage(file: File, folder: string): Promise<string> {
    const ext = file.name.split(".").pop()
    const filename = `catering/${restaurant.id}/${folder}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("catering-images").upload(filename, file, { upsert: true })
    if (error) throw new Error(error.message)
    const { data: urlData } = supabase.storage.from("catering-images").getPublicUrl(filename)
    return urlData.publicUrl
  }

  async function uploadToStorageExactPath(file: File, path: string): Promise<string> {
    const { error } = await supabase.storage.from("catering-images").upload(path, file, { upsert: true })
    if (error) throw new Error(error.message)
    const { data: urlData } = supabase.storage.from("catering-images").getPublicUrl(path)
    return urlData.publicUrl
  }

  async function handleImageUpload(file: File): Promise<string> {
    setUploadingImage(true)
    try { return await uploadToStorage(file, "menu-items") }
    finally { setUploadingImage(false) }
  }

  async function handleSettingsImageUpload(file: File, field: "logo_url" | "banner_logo_url" | "hero_image_url", setUploading: (v: boolean) => void) {
    setUploading(true)
    try {
      const url = await uploadToStorage(file, field.replace("_url", ""))
      setSettingsForm((f) => ({ ...f, [field]: url }))
    } catch (error: any) {
      toast({ title: "Error subiendo imagen", description: error.message, variant: "destructive" })
    } finally { setUploading(false) }
  }

  async function handleDefaultItemImageUpload(file: File) {
    setUploadingDefaultItem(true)
    try {
      const url = await uploadToStorageExactPath(file, `${restaurant.slug}/default-item.jpg`)
      setSettingsForm((f) => ({ ...f, default_item_image_url: url }))
    } catch (error: any) {
      toast({ title: "Error subiendo imagen", description: error.message, variant: "destructive" })
    } finally {
      setUploadingDefaultItem(false)
    }
  }

  async function handleSaveCategory() {
    if (!categoryForm.name.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      if (editingCategory) {
        await updateCateringCategory(editingCategory.id, categoryForm)
        setCategories((prev) => prev.map((c) => c.id === editingCategory.id ? { ...c, ...categoryForm } : c))
        toast({ title: "Categoría actualizada" })
      } else {
        const newCat = await createCateringCategory({ catering_restaurant_id: restaurant.id, ...categoryForm, display_order: categories.length })
        setCategories((prev) => [...prev, newCat])
        toast({ title: "Categoría creada" })
      }
      setShowCategoryModal(false)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm("¿Eliminar esta categoría?")) return
    setLoading(true)
    try {
      await deleteCateringCategory(id)
      setCategories((prev) => prev.filter((c) => c.id !== id))
      toast({ title: "Categoría eliminada" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function handleSaveMenuItem() {
    if (!menuItemForm.name.trim() || !menuItemForm.price || !menuItemForm.category_id) {
      toast({ title: "Error", description: "Nombre, precio y categor��a son requeridos", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const data = {
        name: menuItemForm.name,
        description: menuItemForm.description || undefined,
        price: parseFloat(menuItemForm.price),
        catering_category_id: menuItemForm.category_id,
        image_url: menuItemForm.image_url || undefined,
        selling_unit: menuItemForm.selling_unit,
        is_active: menuItemForm.is_active,
        min_quantity: parseInt(menuItemForm.min_quantity) || 1,
        serves: menuItemForm.serves || undefined,
        container_type: menuItemForm.container_type !== "none" ? menuItemForm.container_type : undefined,
        lead_time_hours: menuItemForm.lead_time_hours ? parseInt(menuItemForm.lead_time_hours) : undefined,
        is_cart_upsell: menuItemForm.is_cart_upsell,
      }
      if (editingMenuItem) {
        await updateCateringMenuItem(editingMenuItem.id, {
          ...data,
          selling_unit: menuItemForm.selling_unit || null,
          min_quantity: menuItemForm.min_quantity ? Number(menuItemForm.min_quantity) : null,
        })
        setMenuItems((prev) => prev.map((m) => m.id === editingMenuItem.id ? { ...m, ...data, catering_category_id: menuItemForm.category_id } : m))
        toast({ title: "Item actualizado" })
      } else {
        const newItem = await createCateringMenuItem({ catering_restaurant_id: restaurant.id, ...data, display_order: menuItems.length })
        setMenuItems((prev) => [...prev, newItem])
        toast({ title: "Item creado" })
      }
      setShowMenuItemModal(false)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function handleDeleteMenuItem(id: string) {
    if (!confirm("¿Eliminar este item?")) return
    setLoading(true)
    try {
      await deleteCateringMenuItem(id)
      setMenuItems((prev) => prev.filter((m) => m.id !== id))
      toast({ title: "Item eliminado" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function openSizesModal(item: any) {
    setSizesMenuItem(item)
    setSizes(await getCateringItemSizes(item.id))
    setEditingSizeId(null)
    setSizeForm({ catering_name: "", catering_price: "", catering_serves: "", catering_is_default: false })
    setShowSizesModal(true)
  }

  async function handleSaveSize() {
    if (!sizeForm.catering_name || !sizeForm.catering_price) {
      toast({ title: "Error", description: "Nombre y precio son requeridos", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      if (editingSizeId) {
        await updateCateringItemSize(editingSizeId, {
          catering_name: sizeForm.catering_name, catering_price: parseFloat(sizeForm.catering_price),
          catering_serves: sizeForm.catering_serves || undefined, catering_is_default: sizeForm.catering_is_default,
        })
        setEditingSizeId(null)
        toast({ title: "Tamaño actualizado" })
      } else {
        await createCateringItemSize({
          catering_menu_item_id: sizesMenuItem.id, catering_name: sizeForm.catering_name,
          catering_price: parseFloat(sizeForm.catering_price), catering_serves: sizeForm.catering_serves || undefined,
          catering_is_default: sizeForm.catering_is_default, catering_display_order: sizes.length,
        })
        toast({ title: "Tamaño agregado" })
      }
      setSizes(await getCateringItemSizes(sizesMenuItem.id))
      setSizeForm({ catering_name: "", catering_price: "", catering_serves: "", catering_is_default: false })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function handleDeleteSize(id: string) {
    setLoading(true)
    try {
      await deleteCateringItemSize(id)
      setSizes((prev) => prev.filter((s) => s.id !== id))
      toast({ title: "Tamaño eliminado" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function loadAvailableSizes() {
    setLoadingAvailableSizes(true)
    try { setAvailableSizes(await getCateringSizesFromOtherItems(restaurant.id, sizesMenuItem.id)) }
    catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }) }
    finally { setLoadingAvailableSizes(false) }
  }

  async function handleCopySize(sourceSize: any) {
    setLoading(true)
    try {
      await copyCateringSizeToMenuItem(sourceSize, sizesMenuItem.id)
      setSizes(await getCateringItemSizes(sizesMenuItem.id))
      toast({ title: "Tamaño copiado" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function openOptionsModal(item: any) {
    setOptionsMenuItem(item)
    const opts = await getCateringItemOptions(item.id)
    setItemOptions(await Promise.all(opts.map(async (opt: any) => ({ ...opt, choices: await getCateringItemOptionChoices(opt.id) }))))
    setShowOptionForm(false)
    setEditingOption(null)
    setOptionForm({ catering_name: "", catering_prompt: "", catering_display_type: "pills", catering_is_required: false, catering_min_selections: "0", catering_max_selections: "1", choices: [] })
    setShowOptionsModal(true)
  }

  async function handleSaveOption() {
    if (!optionForm.catering_name.trim()) {
      toast({ title: "Error", description: "Nombre de opción requerido", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      let optionId: string
      let existingChoices: any[] = []
      if (editingOption) {
        await updateCateringItemOption(editingOption.id, {
          catering_name: optionForm.catering_name, catering_prompt: optionForm.catering_prompt || undefined,
          catering_display_type: optionForm.catering_display_type, catering_is_required: optionForm.catering_is_required,
          catering_min_selections: parseInt(optionForm.catering_min_selections),
          catering_max_selections: parseInt(optionForm.catering_max_selections),
        })
        optionId = editingOption.id
        existingChoices = await getCateringItemOptionChoices(optionId)
        toast({ title: "Opción actualizada" })
      } else {
        const newOption = await createCateringItemOption({
          catering_menu_item_id: optionsMenuItem.id, catering_name: optionForm.catering_name,
          catering_prompt: optionForm.catering_prompt || undefined, catering_display_type: optionForm.catering_display_type,
          catering_is_required: optionForm.catering_is_required,
          catering_min_selections: parseInt(optionForm.catering_min_selections),
          catering_max_selections: parseInt(optionForm.catering_max_selections),
          catering_display_order: itemOptions.length,
        })
        optionId = newOption.id
        toast({ title: "Opción creada" })
      }
      // Upsert-diff: UPDATE existing choices by id, INSERT new ones, DELETE orphans last.
      // Prevents silent data loss if inserts fail mid-flight (the Bistec pattern).
      const existingIds = new Set<string>(existingChoices.map((c: any) => c.id))
      const incomingIds = new Set<string>(optionForm.choices.map((c: any) => c.id).filter(Boolean))
      for (let i = 0; i < optionForm.choices.length; i++) {
        const choice = optionForm.choices[i]
        if (choice.id && existingIds.has(choice.id)) {
          await updateCateringItemOptionChoice(choice.id, {
            catering_name: choice.catering_name,
            catering_price_modifier: parseFloat(choice.catering_price_modifier) || 0,
            catering_display_order: i,
            catering_is_active: true,
          })
        } else {
          await createCateringItemOptionChoice({
            catering_item_option_id: optionId, catering_name: choice.catering_name,
            catering_price_modifier: parseFloat(choice.catering_price_modifier) || 0,
            catering_display_order: i, catering_is_active: true,
          })
        }
      }
      for (const existing of existingChoices) {
        if (!incomingIds.has(existing.id)) {
          await deleteCateringItemOptionChoice(existing.id)
        }
      }
      const opts = await getCateringItemOptions(optionsMenuItem.id)
      setItemOptions(await Promise.all(opts.map(async (opt: any) => ({ ...opt, choices: await getCateringItemOptionChoices(opt.id) }))))
      setShowOptionForm(false)
      setEditingOption(null)
      setOptionForm({ catering_name: "", catering_prompt: "", catering_display_type: "pills", catering_is_required: false, catering_min_selections: "0", catering_max_selections: "1", choices: [] })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function handleDeleteOption(id: string) {
    setLoading(true)
    try {
      await deleteCateringItemOption(id)
      setItemOptions((prev) => prev.filter((o) => o.id !== id))
      toast({ title: "Opción eliminada" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function loadAvailableOptions() {
    setLoadingAvailableOptions(true)
    try { setAvailableOptions(await getCateringOptionsFromOtherItems(restaurant.id, optionsMenuItem.id)) }
    catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }) }
    finally { setLoadingAvailableOptions(false) }
  }

  async function handleCopyOption(sourceOption: any) {
    setLoading(true)
    try {
      await copyCateringOptionToMenuItem(sourceOption, optionsMenuItem.id, itemOptions.length)
      const opts = await getCateringItemOptions(optionsMenuItem.id)
      setItemOptions(await Promise.all(opts.map(async (opt: any) => ({ ...opt, choices: await getCateringItemOptionChoices(opt.id) }))))
      toast({ title: "Opción copiada" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function handleUpdateOrderStatus(orderId: string, status: string) {
    setLoading(true)
    try {
      await updateCateringOrderStatus(orderId, status)
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o))
      if (selectedOrder?.id === orderId) setSelectedOrder((prev: any) => ({ ...prev, status }))
      toast({ title: "Estado actualizado" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function handleSaveSettings() {
    setLoading(true)
    try {
await updateCateringRestaurantSettings(restaurant.id, {
        name: settingsForm.name,
        description: settingsForm.description,
        logo_url: settingsForm.logo_url || null,
        banner_logo_url: settingsForm.banner_logo_url || null,
        hero_image_url: settingsForm.hero_image_url || null,
        default_item_image_url: settingsForm.default_item_image_url || null,
        hide_branch_title: settingsForm.hide_branch_title,
        primary_color: settingsForm.primary_color,
        cuisine_type: settingsForm.cuisine_type || null,
        design_template: settingsForm.design_template,
        show_in_marketplace: settingsForm.show_in_marketplace,
        custom_domain: settingsForm.custom_domain ? settingsForm.custom_domain.trim().toLowerCase() : null,
        notification_email: settingsForm.notification_email || null,
        notification_method: settingsForm.notification_method,
        restaurant_address: settingsForm.restaurant_address || null,
        tax_rate: parseFloat(settingsForm.tax_rate) / 100,
        delivery_fee: parseFloat(settingsForm.delivery_fee),
        minimum_order: parseFloat(settingsForm.minimum_order),
        default_lead_time_hours: parseInt(settingsForm.default_lead_time_hours),
        max_advance_days: parseInt(settingsForm.max_advance_days),
        delivery_turnaround_hours: settingsForm.delivery_turnaround_hours ? parseInt(settingsForm.delivery_turnaround_hours) : null,
        pickup_turnaround_hours: settingsForm.pickup_turnaround_hours ? parseInt(settingsForm.pickup_turnaround_hours) : null,
        min_delivery_order: settingsForm.min_delivery_order ? parseFloat(settingsForm.min_delivery_order) : null,
        min_pickup_order: settingsForm.min_pickup_order ? parseFloat(settingsForm.min_pickup_order) : null,
        delivery_radius_miles: parseFloat(settingsForm.delivery_radius_miles),
tip_option_1: settingsForm.tip_option_1 ? parseInt(settingsForm.tip_option_1) : null,
        tip_option_2: settingsForm.tip_option_2 ? parseInt(settingsForm.tip_option_2) : null,
        tip_option_3: settingsForm.tip_option_3 ? parseInt(settingsForm.tip_option_3) : null,
        tip_option_4: settingsForm.tip_option_4 ? parseInt(settingsForm.tip_option_4) : null,
        default_tip_option: settingsForm.default_tip_option ? parseInt(settingsForm.default_tip_option) : null,
        enable_delivery: settingsForm.enable_delivery,
        enable_pickup: settingsForm.enable_pickup,
        stripe_enabled: settingsForm.stripe_enabled,
        stripe_account_id: settingsForm.stripe_account_id || null,
        athmovil_enabled: settingsForm.athmovil_enabled,
        athmovil_public_token: settingsForm.athmovil_public_token || null,
        athmovil_private_token: settingsForm.athmovil_private_token || null,
        cash_payment_enabled: settingsForm.cash_payment_enabled,
        shipday_api_key: settingsForm.shipday_api_key || null,
        kds_access_token: settingsForm.kds_access_token || null,
        kds_setup_code: settingsForm.kds_setup_code || null,
        kds_admin_pin: settingsForm.kds_admin_pin || null,
printer_tier: settingsForm.printer_tier !== "none" ? settingsForm.printer_tier : null,
        eatabit_restaurant_key: settingsForm.eatabit_restaurant_key || null,
        show_service_packages: settingsForm.show_service_packages,
        packages_section_title: settingsForm.packages_section_title,
        is_chain: settingsForm.is_chain,
footer_description: settingsForm.footer_description || null,
        footer_phone: settingsForm.footer_phone || null,
        footer_email: settingsForm.footer_email || null,
        // Dispatch fee configuration
        dispatch_fee_type: settingsForm.dispatch_fee_type || "none",
        dispatch_fee_value: settingsForm.dispatch_fee_value ? parseFloat(settingsForm.dispatch_fee_value) : null,
        dispatch_fee_applies_to: settingsForm.dispatch_fee_applies_to || "both",
        // Chain-level Main Dispatch default
        route_to_main_dispatch_default: settingsForm.route_to_main_dispatch_default,
      })
      toast({ title: "Configuración guardada" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function handleSaveOperatingHours() {
    setSavingHours(true)
    try {
      await saveCateringOperatingHours(restaurant.id, operatingHours)
      toast({ title: "Horario guardado" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setSavingHours(false) }
  }

  async function handleSaveZone() {
    if (!zoneForm.name || !zoneForm.max_miles || !zoneForm.delivery_fee) {
      toast({ title: "Error", description: "Nombre, distancia máxima y tarifa son requeridos", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      if (editingZone) {
        const updated = await updateCateringDeliveryZone(editingZone.id, {
          name: zoneForm.name, min_miles: parseFloat(zoneForm.min_miles),
          max_miles: parseFloat(zoneForm.max_miles), delivery_fee: parseFloat(zoneForm.delivery_fee),
        })
        setDeliveryZones((prev) => prev.map((z) => z.id === editingZone.id ? updated : z))
        toast({ title: "Zona actualizada" })
      } else {
        const newZone = await createCateringDeliveryZone({
          catering_restaurant_id: restaurant.id, name: zoneForm.name,
          min_miles: parseFloat(zoneForm.min_miles), max_miles: parseFloat(zoneForm.max_miles),
          delivery_fee: parseFloat(zoneForm.delivery_fee), display_order: deliveryZones.length,
        })
        setDeliveryZones((prev) => [...prev, newZone])
        toast({ title: "Zona creada" })
      }
      setShowZoneModal(false)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function handleSaveContainerBaseRate() {
    setLoading(true)
    try {
      const result = await upsertCateringContainerBaseRate({
        catering_restaurant_id: restaurant.id,
        base_fee: parseFloat(containerBaseForm.base_fee),
        containers_included: parseInt(containerBaseForm.containers_included),
      })
      setContainerBaseRate(result)
      toast({ title: "Tarifa base guardada" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  async function handleSaveContainerTier() {
    if (!containerTierForm.container_type || !containerTierForm.label || !containerTierForm.extra_fee_per_unit) {
      toast({ title: "Error", description: "Completa todos los campos", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const result = await upsertCateringContainerRateTier({
        id: editingContainerTier?.id,
        catering_restaurant_id: restaurant.id,
        container_type: containerTierForm.container_type,
        label: containerTierForm.label,
        extra_fee_per_unit: parseFloat(containerTierForm.extra_fee_per_unit),
        display_order: editingContainerTier ? editingContainerTier.display_order : containerTiers.length,
      })
      if (editingContainerTier) {
        setContainerTiers((prev) => prev.map((t) => t.id === result.id ? result : t))
      } else {
        setContainerTiers((prev) => [...prev, result])
      }
      setEditingContainerTier(null)
      setContainerTierForm({ container_type: "", label: "", extra_fee_per_unit: "" })
      toast({ title: editingContainerTier ? "Tarifa actualizada" : "Tarifa agregada" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    preparing: "bg-orange-100 text-orange-800",
    ready: "bg-green-100 text-green-800",
    delivered: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  }

  const filteredOrders = orders.filter((o: any) => {
    if (orderFilter === "delivery") return o.delivery_type === "delivery"
    if (orderFilter === "pickup") return o.delivery_type === "pickup"
    return true
  })

  const totalRevenue = orders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
<div className="flex items-center gap-3">
            <Link href="https://www.prdelivery.com/super-admin/catering" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
            {restaurant.logo_url && <img src={restaurant.logo_url} alt={restaurant.name} className="h-8 w-auto object-contain" />}
            <div>
              <h1 className="font-bold text-gray-900">{restaurant.name}</h1>
              <p className="text-xs text-gray-500">Panel de Catering</p>
              {/* Restaurant Switcher - Only visible to super admins */}
              {isSuperAdmin && operatorRestaurants.length > 1 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="mt-1 gap-2 text-xs h-7">
                      <ArrowRightLeft className="h-3 w-3" />
                      Cambiar restaurante
                      <ChevronsUpDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar restaurante..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron restaurantes.</CommandEmpty>
                        <CommandGroup>
                          {operatorRestaurants.map((r) => (
                            <CommandItem
                              key={r.id}
                              value={r.name}
                              onSelect={() => {
                                if (r.slug !== restaurant.slug) {
                                  router.push(`/catering/${r.slug}/admin?superadmin=true&tab=settings`)
                                }
                              }}
                              className={r.id === restaurant.id ? "bg-accent" : ""}
                            >
                              <Check className={`mr-2 h-4 w-4 ${r.id === restaurant.id ? "opacity-100" : "opacity-0"}`} />
                              {r.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
          <Link href={`/catering/${restaurant.slug}`} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1" target="_blank">Ver portal →</Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview"><LayoutDashboard className="w-4 h-4 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="orders"><ClipboardList className="w-4 h-4 mr-1" />Órdenes</TabsTrigger>
            <TabsTrigger value="menu"><ShoppingBag className="w-4 h-4 mr-1" />Menú</TabsTrigger>
            <TabsTrigger value="branches"><Package className="w-4 h-4 mr-1" />Sucursales</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1" />Configuración</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Categorías", value: categories.length },
                { label: "Items del Menú", value: menuItems.length },
                { label: "Sucursales", value: branches.length },
                { label: "Total Órdenes", value: orders.length },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1" style={{ color: primaryColor }}>{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Revenue Total</p><p className="text-2xl font-bold mt-1">${totalRevenue.toFixed(2)}</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Órdenes Pendientes</p><p className="text-2xl font-bold mt-1 text-yellow-600">{orders.filter((o: any) => o.status === "pending").length}</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Órdenes Confirmadas</p><p className="text-2xl font-bold mt-1 text-blue-600">{orders.filter((o: any) => o.status === "confirmed").length}</p></CardContent></Card>
            </div>
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card><CardContent className="pt-4">
                <p className="text-sm font-medium text-gray-500">Todos los Pedidos</p>
                <p className="text-2xl font-bold mt-1">{orders.length}</p>
                <div className="text-sm text-gray-500 mt-2 space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>${orders.reduce((s: number, o: any) => s + (Number(o.subtotal) || 0), 0).toFixed(2)}</span></div>
                  <div className="flex justify-between font-medium"><span>Total</span><span>${totalRevenue.toFixed(2)}</span></div>
                </div>
              </CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-sm font-medium text-blue-600">Delivery</p><p className="text-2xl font-bold mt-1 text-blue-600">{orders.filter((o: any) => o.delivery_type === "delivery").length}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-sm font-medium text-orange-600">Pick-Up</p><p className="text-2xl font-bold mt-1 text-orange-600">{orders.filter((o: any) => o.delivery_type === "pickup").length}</p></CardContent></Card>
            </div>
            <div className="flex gap-2 mb-4">
              {(["all", "delivery", "pickup"] as const).map((f) => (
                <button key={f} onClick={() => setOrderFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${orderFilter === f ? "text-white" : "bg-white border border-gray-200 text-gray-600"}`}
                  style={orderFilter === f ? { backgroundColor: primaryColor } : {}}>
                  {f === "all" ? `Todos (${orders.length})` : f === "delivery" ? `Delivery (${orders.filter((o: any) => o.delivery_type === "delivery").length})` : `Pick-Up (${orders.filter((o: any) => o.delivery_type === "pickup").length})`}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader><CardTitle>Órdenes de Catering</CardTitle></CardHeader>
                  <CardContent>
                    {filteredOrders.length === 0 ? <p className="text-center text-gray-400 py-8">No hay órdenes</p> : (
                      <div className="space-y-3">
                        {filteredOrders.map((order: any) => (
                          <div key={order.id} onClick={() => setSelectedOrder(order)}
                            className={`p-4 rounded-xl border cursor-pointer transition-colors ${selectedOrder?.id === order.id ? "bg-gray-50" : "border-gray-100 hover:border-gray-200"}`}
                            style={selectedOrder?.id === order.id ? { borderColor: primaryColor } : {}}>
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-sm">{order.order_number || order.id.substring(0, 8)}</p>
                                  {order.delivery_type && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.delivery_type === "delivery" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>{order.delivery_type}</span>}
                                </div>
                                <p className="text-sm text-gray-600">{order.customer_name}</p>
                                <p className="text-xs text-gray-400">{order.event_date} {order.event_time}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold">${Number(order.total).toFixed(2)}</p>
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[order.status] || "bg-gray-100 text-gray-800"}`}>{order.status}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              <div>
                {selectedOrder ? (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Detalle de Orden</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Cliente</p>
                        <p className="font-medium">{selectedOrder.customer_name}</p>
                        <p className="text-sm text-gray-500">{selectedOrder.customer_email}</p>
                        <p className="text-sm text-gray-500">{selectedOrder.customer_phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Evento</p>
                        <p className="text-sm">{selectedOrder.event_date} a las {selectedOrder.event_time}</p>
                        {selectedOrder.guest_count && <p className="text-sm text-gray-500">{selectedOrder.guest_count} personas</p>}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Entrega</p>
                        <p className="text-sm capitalize">{selectedOrder.delivery_type}</p>
                        {selectedOrder.delivery_address && <p className="text-sm text-gray-500">{selectedOrder.delivery_address}, {selectedOrder.delivery_city}</p>}
                      </div>
                      {selectedOrder.special_instructions && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Instrucciones</p>
                          <p className="text-sm text-gray-600">{selectedOrder.special_instructions}</p>
                        </div>
                      )}
                      {selectedOrder.catering_order_items && selectedOrder.catering_order_items.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Items</p>
                          <div className="space-y-1">
                            {selectedOrder.catering_order_items.map((item: any) => (
                              <div key={item.id} className="flex justify-between text-sm">
                                <span>{item.quantity}x {item.item_name}</span>
                                <span>${Number(item.total_price).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="border-t pt-3 space-y-1">
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>${Number(selectedOrder.subtotal).toFixed(2)}</span></div>
                        {selectedOrder.delivery_fee > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Entrega</span><span>${Number(selectedOrder.delivery_fee).toFixed(2)}</span></div>}
                        {selectedOrder.tip > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Propina</span><span>${Number(selectedOrder.tip).toFixed(2)}</span></div>}
                        <div className="flex justify-between text-sm"><span className="text-gray-500">IVU</span><span>${Number(selectedOrder.tax).toFixed(2)}</span></div>
                        <div className="flex justify-between font-bold"><span>Total</span><span>${Number(selectedOrder.total).toFixed(2)}</span></div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Cambiar Estado</p>
                        <div className="grid grid-cols-2 gap-2">
                          {["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"].map((status) => (
                            <button key={status} onClick={() => handleUpdateOrderStatus(selectedOrder.id, status)}
                              disabled={selectedOrder.status === status || loading}
                              className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 ${selectedOrder.status === status ? "text-white" : "border-gray-200 text-gray-600"}`}
                              style={selectedOrder.status === status ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}>
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card><CardContent className="py-12 text-center text-gray-400"><p>Selecciona una orden para ver los detalles</p></CardContent></Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* MENU */}
          <TabsContent value="menu" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Categorías</CardTitle>
                <Button onClick={() => { setEditingCategory(null); setCategoryForm({ name: "", description: "", is_active: true }); setShowCategoryModal(true) }} style={{ backgroundColor: primaryColor }} className="text-white">
                  <Plus className="w-4 h-4 mr-2" /> Agregar Categoría
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{category.name}</p>
                        {category.description && <p className="text-xs text-gray-500">{category.description}</p>}
                      </div>
                      <Switch checked={category.is_active} onCheckedChange={async (checked) => { await updateCateringCategory(category.id, { is_active: checked }); setCategories((prev) => prev.map((c) => c.id === category.id ? { ...c, is_active: checked } : c)) }} />
                      <Button variant="ghost" size="sm" onClick={() => { setEditingCategory(category); setCategoryForm({ name: category.name, description: category.description || "", is_active: category.is_active }); setShowCategoryModal(true) }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  {categories.length === 0 && <p className="text-center text-gray-400 py-8">No hay categorías aún</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Items del Menú</CardTitle>
                <Button onClick={() => { setEditingMenuItem(null); setMenuItemForm({ name: "", description: "", price: "", category_id: "", image_url: "", selling_unit: "tray", is_active: true, min_quantity: "1", serves: "", container_type: "none", lead_time_hours: "", is_cart_upsell: false }); setShowMenuItemModal(true) }} style={{ backgroundColor: primaryColor }} className="text-white">
                  <Plus className="w-4 h-4 mr-2" /> Agregar Item
                </Button>
              </CardHeader>
              <CardContent>
                {categories.map((category) => {
                  const items = menuItems.filter((item) => item.catering_category_id === category.id)
                  if (items.length === 0) return null
                  return (
                    <div key={category.id} className="mb-6">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-gray-500 mb-3 pb-2 border-b">{category.name}</h3>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200">
                            {item.image_url && <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs text-gray-500">${Number(item.price).toFixed(2)} / {item.selling_unit}{item.serves && ` · Sirve ${item.serves}`}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Switch checked={item.is_active} onCheckedChange={async (checked) => { const res: any = await updateCateringMenuItem(item.id, { is_active: checked }); if (res && typeof res === "object" && "error" in res) { toast({ title: "Error", description: res.error, variant: "destructive" }); return } setMenuItems((prev) => prev.map((m) => m.id === item.id ? { ...m, is_active: checked } : m)) }} />
                              <Button variant="outline" size="sm" onClick={() => openSizesModal(item)}><Settings className="w-3 h-3 mr-1" /> Tamaños</Button>
                              <Button variant="outline" size="sm" onClick={() => openOptionsModal(item)}><Settings className="w-3 h-3 mr-1" /> Opciones</Button>
                              <Button variant="ghost" size="sm" onClick={() => { setEditingMenuItem(item); setMenuItemForm({ name: item.name, description: item.description || "", price: String(item.price), category_id: item.catering_category_id, image_url: item.image_url || "", selling_unit: item.selling_unit || "tray", is_active: item.is_active, min_quantity: String(item.min_quantity || 1), serves: item.serves || "", container_type: item.container_type || "none", lead_time_hours: item.lead_time_hours ? String(item.lead_time_hours) : "", is_cart_upsell: item.is_cart_upsell || false }); setShowMenuItemModal(true) }}><Pencil className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteMenuItem(item.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {menuItems.length === 0 && <p className="text-center text-gray-400 py-8">No hay items en el menú aún</p>}
              </CardContent>
            </Card>
          </TabsContent>

{/* BRANCHES */}
          <TabsContent value="branches">
            {!showBranchModal && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Sucursales</CardTitle>
                  <Button
                    size="sm"
                    className="text-white"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => {
                      setEditingBranch(null)
                      setBranchForm(EMPTY_BRANCH_FORM)
                      setBranchEditTab("info")
                      setBranchError(null)
                      setShowBranchModal(true)
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Nueva Sucursal
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {branches.map((branch, index) => (
                    <div 
                      key={branch.id} 
                      className="p-4 rounded-xl border border-gray-100 bg-white cursor-move"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", index.toString())
                        e.currentTarget.classList.add("opacity-50")
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.classList.remove("opacity-50")
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.currentTarget.classList.add("border-blue-400", "border-2")
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove("border-blue-400", "border-2")
                      }}
                      onDrop={async (e) => {
                        e.preventDefault()
                        e.currentTarget.classList.remove("border-blue-400", "border-2")
                        const fromIndex = parseInt(e.dataTransfer.getData("text/plain"))
                        const toIndex = index
                        if (fromIndex === toIndex) return
                        
                        // Reorder locally
                        const newBranches = [...branches]
                        const [moved] = newBranches.splice(fromIndex, 1)
                        newBranches.splice(toIndex, 0, moved)
                        setBranches(newBranches)
                        
                        // Save to database
                        await reorderCateringBranches(newBranches.map(b => b.id))
                        toast({ title: "Orden guardado" })
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{branch.name}</p>
                            <p className="text-sm text-gray-500">{branch.address}, {branch.city}</p>
                            {branch.phone && <p className="text-sm text-gray-500">{branch.phone}</p>}
                            {branch.email && <p className="text-sm text-gray-400">{branch.email}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <Switch
                            checked={branch.is_active !== false}
                            onCheckedChange={async (checked) => {
                              setBranches((prev) => prev.map((b) => b.id === branch.id ? { ...b, is_active: checked } : b))
                              await updateCateringBranch(branch.id, { is_active: checked })
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingBranch(branch)
                              setBranchForm({
                                name: branch.name || "",
                                address: branch.address || "",
                                city: branch.city || "",
                                state: branch.state || "PR",
                                zip_code: branch.zip_code || "",
                                phone: branch.phone || "",
                                email: branch.email || "",
                                latitude: branch.latitude ?? null,
                                longitude: branch.longitude ?? null,
                                enable_delivery: branch.enable_delivery ?? null,
                                enable_pickup: branch.enable_pickup ?? null,
                                delivery_radius_miles: branch.delivery_radius_miles ?? null,
                                delivery_fee: branch.delivery_fee ?? null,
                                min_delivery_order: branch.min_delivery_order ?? null,
                                min_pickup_order: branch.min_pickup_order ?? null,
                                default_lead_time_hours: branch.default_lead_time_hours ?? null,
                                delivery_turnaround_hours: branch.delivery_turnaround_hours ?? null,
                                pickup_turnaround_hours: branch.pickup_turnaround_hours ?? null,
                                notification_email: branch.notification_email ?? null,
                                notification_method: branch.notification_method ?? null,
                                eatabit_restaurant_key: branch.eatabit_restaurant_key ?? null,
                                printer_tier: branch.printer_tier ?? null,
                                athmovil_enabled: branch.athmovil_enabled ?? null,
                                athmovil_public_token: branch.athmovil_public_token ?? null,
                                athmovil_private_token: branch.athmovil_private_token ?? null,
                                cash_payment_enabled: branch.cash_payment_enabled ?? null,
                                stripe_enabled: branch.stripe_enabled ?? null,
                                tax_rate: branch.tax_rate ?? null,
                                route_to_main_dispatch: branch.route_to_main_dispatch ?? null,
                                dispatch_hub_branch_id: branch.dispatch_hub_branch_id ?? null,
                              })
                              setBranchEditTab("info")
                              setBranchError(null)
                              setShowBranchModal(true)
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {branches.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No hay sucursales configuradas</p>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Branch Editor — in-place full-width panel (replaces the list while editing) */}
            {showBranchModal && (
            <Card className="overflow-hidden">
              {/* Colored header bar with back button for visual continuity */}
              <div className="px-6 py-4" style={{ backgroundColor: primaryColor }}>
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="flex items-center gap-1.5 text-white/90 hover:text-white text-sm mb-2 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver a Sucursales
                </button>
                <h2 className="text-white text-xl font-bold">
                  {editingBranch ? `Editar Sucursal — ${editingBranch.name}` : "Nueva Sucursal"}
                </h2>
                <p className="text-sm text-white/80 mt-1">
                  Los campos vacíos heredan la configuración del restaurante.
                </p>
              </div>

                <Tabs value={branchEditTab} onValueChange={(v) => setBranchEditTab(v as any)} className="px-6 py-4">
                  <TabsList className="grid grid-cols-6 w-full">
                    <TabsTrigger value="info">Información</TabsTrigger>
                    <TabsTrigger value="service">Entrega / Recogido</TabsTrigger>
                    <TabsTrigger value="payments">Pagos</TabsTrigger>
                    <TabsTrigger value="dispatch">Despacho</TabsTrigger>
                    <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
                    <TabsTrigger value="hours">Horarios</TabsTrigger>
                  </TabsList>

                  {/* ============ TAB: INFO ============ */}
                  <TabsContent value="info" className="space-y-4 pt-4">
                    <div>
                      <Label>Nombre *</Label>
                      <Input
                        value={branchForm.name}
                        onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                        placeholder="Ej: Hato Rey"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Dirección</Label>
                      <Input
                        value={branchForm.address}
                        onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                        placeholder="Calle y número"
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Ciudad</Label>
                        <Input
                          value={branchForm.city}
                          onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                          placeholder="San Juan"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Estado</Label>
                        <Input
                          value={branchForm.state}
                          onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
                          placeholder="PR"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Zip Code</Label>
                        <Input
                          value={branchForm.zip_code}
                          onChange={(e) => setBranchForm({ ...branchForm, zip_code: e.target.value })}
                          placeholder="00917"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Teléfono</Label>
                        <Input
                          value={branchForm.phone}
                          onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                          placeholder="787-000-0000"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Email de contacto</Label>
                        <Input
                          type="email"
                          value={branchForm.email}
                          onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                          placeholder="sucursal@restaurante.com"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Latitud</Label>
                        <Input
                          type="number"
                          step="any"
                          value={branchForm.latitude ?? ""}
                          onChange={(e) => setBranchForm({ ...branchForm, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                          placeholder="18.4655"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Longitud</Label>
                        <Input
                          type="number"
                          step="any"
                          value={branchForm.longitude ?? ""}
                          onChange={(e) => setBranchForm({ ...branchForm, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                          placeholder="-66.1057"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* ============ TAB: SERVICE (Delivery + Pickup) ============ */}
                  <TabsContent value="service" className="space-y-5 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <TriStateToggle
                        label="Habilitar Entrega"
                        value={branchForm.enable_delivery}
                        onChange={(v) => setBranchForm({ ...branchForm, enable_delivery: v })}
                      />
                      <TriStateToggle
                        label="Habilitar Recogido"
                        value={branchForm.enable_pickup}
                        onChange={(v) => setBranchForm({ ...branchForm, enable_pickup: v })}
                      />
                    </div>

                    <div className="rounded-lg border p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-gray-700">Configuración de Entrega</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <NumberOverrideField
                          label="Radio (millas)"
                          value={branchForm.delivery_radius_miles}
                          onChange={(v) => setBranchForm({ ...branchForm, delivery_radius_miles: v })}
                          placeholder="hereda"
                          step="0.1"
                        />
                        <NumberOverrideField
                          label="Costo de entrega ($)"
                          value={branchForm.delivery_fee}
                          onChange={(v) => setBranchForm({ ...branchForm, delivery_fee: v })}
                          placeholder="hereda"
                          step="0.01"
                        />
                        <NumberOverrideField
                          label="Mínimo de orden ($)"
                          value={branchForm.min_delivery_order}
                          onChange={(v) => setBranchForm({ ...branchForm, min_delivery_order: v })}
                          placeholder="hereda"
                          step="0.01"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-gray-700">Configuración de Recogido</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <NumberOverrideField
                          label="Mínimo de orden ($)"
                          value={branchForm.min_pickup_order}
                          onChange={(v) => setBranchForm({ ...branchForm, min_pickup_order: v })}
                          placeholder="hereda"
                          step="0.01"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-gray-700">Tiempos de preparación (horas)</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <NumberOverrideField
                          label="Lead time por defecto"
                          value={branchForm.default_lead_time_hours}
                          onChange={(v) => setBranchForm({ ...branchForm, default_lead_time_hours: v })}
                          placeholder="hereda"
                          step="0.5"
                        />
                        <NumberOverrideField
                          label="Turnaround entrega"
                          value={branchForm.delivery_turnaround_hours}
                          onChange={(v) => setBranchForm({ ...branchForm, delivery_turnaround_hours: v })}
                          placeholder="hereda"
                          step="0.5"
                        />
                        <NumberOverrideField
                          label="Turnaround recogido"
                          value={branchForm.pickup_turnaround_hours}
                          onChange={(v) => setBranchForm({ ...branchForm, pickup_turnaround_hours: v })}
                          placeholder="hereda"
                          step="0.5"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* ============ TAB: PAYMENTS ============ */}
                  <TabsContent value="payments" className="space-y-5 pt-4">
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700">ATH Móvil</h4>
                          <p className="text-xs text-gray-500">Tokens específicos de esta sucursal. Dejar vacío para heredar del restaurante.</p>
                        </div>
                        <TriStateToggle
                          label=""
                          value={branchForm.athmovil_enabled}
                          onChange={(v) => setBranchForm({ ...branchForm, athmovil_enabled: v })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Public Token</Label>
                          <Input
                            value={branchForm.athmovil_public_token ?? ""}
                            onChange={(e) => setBranchForm({ ...branchForm, athmovil_public_token: e.target.value || null })}
                            placeholder="hereda del restaurante"
                            className="mt-1 font-mono text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Private Token</Label>
                          <Input
                            type="password"
                            value={branchForm.athmovil_private_token ?? ""}
                            onChange={(e) => setBranchForm({ ...branchForm, athmovil_private_token: e.target.value || null })}
                            placeholder="hereda del restaurante"
                            className="mt-1 font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700">Stripe</h4>
                          <p className="text-xs text-gray-500">Si cada sucursal usa su propia cuenta Connect, habilítalo aquí. Si la cadena comparte una sola cuenta, deja heredar.</p>
                        </div>
                        <TriStateToggle
                          label=""
                          value={branchForm.stripe_enabled}
                          onChange={(v) => setBranchForm({ ...branchForm, stripe_enabled: v })}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-gray-700">Impuestos</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <NumberOverrideField
                          label="Tasa de impuestos (%)"
                          value={branchForm.tax_rate}
                          onChange={(v) => setBranchForm({ ...branchForm, tax_rate: v })}
                          placeholder="hereda (ej: 11.5)"
                          step="0.001"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* ============ TAB: DISPATCH (Main Dispatch routing) ============ */}
                  <TabsContent value="dispatch" className="space-y-5 pt-4">
                    <div className="rounded-lg border p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-gray-700">Enrutamiento al Main Dispatch</h4>
                      <p className="text-xs text-gray-500">
                        Decide si las órdenes de catering de esta sucursal entran al panel central de despacho.
                        Esta decisión es independiente del Online Ordering — una sucursal puede estar activa en
                        delivery sin recibir catering, y viceversa.
                      </p>
                      <TriStateToggle
                        label="Enviar órdenes a Main Dispatch"
                        value={branchForm.route_to_main_dispatch}
                        onChange={(v) => setBranchForm({ ...branchForm, route_to_main_dispatch: v })}
                      />
                      <p className="text-[11px] text-gray-400">
                        Hereda = usa la configuración del restaurante · Sí = esta sucursal recibe órdenes · No = no las recibe (o se redirigen al hub abajo).
                      </p>
                    </div>

                    {branchForm.route_to_main_dispatch === false && (
                      <div className="rounded-lg border p-4 space-y-3 bg-amber-50/40">
                        <h4 className="font-semibold text-sm text-gray-700">Redirigir a sucursal productora</h4>
                        <p className="text-xs text-gray-500">
                          Si otra sucursal prepara la comida en lugar de esta, selecciónala aquí. La orden se
                          reasigna <strong>antes</strong> de cobrar, y la tarjeta se cobra en la cuenta de la
                          sucursal que produce (regla: quien hace la comida cobra).
                        </p>
                        <div>
                          <Label className="text-xs">Sucursal hub (opcional)</Label>
                          <select
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            value={branchForm.dispatch_hub_branch_id ?? ""}
                            onChange={(e) =>
                              setBranchForm({
                                ...branchForm,
                                dispatch_hub_branch_id: e.target.value || null,
                              })
                            }
                          >
                            <option value="">— Sin redirección (queda pendiente aquí) —</option>
                            {branches
                              .filter((b) => !editingBranch || b.id !== editingBranch.id)
                              .map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                          </select>
                          <p className="text-[11px] text-gray-400 mt-1">
                            Sólo aplica cuando "Enviar órdenes a Main Dispatch" está en <strong>No</strong>.
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* ============ TAB: NOTIFICATIONS ============ */}
                  <TabsContent value="notifications" className="space-y-5 pt-4">
                    <div className="rounded-lg border p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-gray-700">Avisos al restaurante</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Método de notificación</Label>
                          <select
                            value={branchForm.notification_method ?? ""}
                            onChange={(e) => setBranchForm({ ...branchForm, notification_method: e.target.value || null })}
                            className="mt-1 w-full h-10 rounded-md border border-gray-200 px-3 text-sm bg-white"
                          >
                            <option value="">Hereda del restaurante</option>
                            <option value="email">Email</option>
                            <option value="eatabit">Eatabit (impresora)</option>
                            <option value="chowly">Chowly</option>
                            <option value="square_kds">Square KDS</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Email para notificaciones</Label>
                          <Input
                            type="email"
                            value={branchForm.notification_email ?? ""}
                            onChange={(e) => setBranchForm({ ...branchForm, notification_email: e.target.value || null })}
                            placeholder="hereda del restaurante"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-gray-700">Eatabit Printer</h4>
                      <p className="text-xs text-gray-500">
                        Si esta sucursal ya está en Online Ordering y comparte la misma impresora, usa la misma key. Si tiene impresora dedicada para catering, ingresa una key distinta.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Restaurant Key</Label>
                          <Input
                            value={branchForm.eatabit_restaurant_key ?? ""}
                            onChange={(e) => setBranchForm({ ...branchForm, eatabit_restaurant_key: e.target.value || null })}
                            placeholder="hereda del restaurante"
                            className="mt-1 font-mono text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Tier</Label>
                          <select
                            value={branchForm.printer_tier ?? ""}
                            onChange={(e) => setBranchForm({ ...branchForm, printer_tier: e.target.value || null })}
                            className="mt-1 w-full h-10 rounded-md border border-gray-200 px-3 text-sm bg-white"
                          >
                            <option value="">Hereda del restaurante</option>
                            <option value="basic">Básico</option>
                            <option value="standard">Estándar</option>
                            <option value="premium">Premium</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* ============ TAB: HOURS ============ */}
                  <TabsContent value="hours" className="pt-4">
                    {!editingBranch ? (
                      <div className="rounded-lg border p-6 bg-gray-50 text-center">
                        <p className="text-sm text-gray-600">
                          Guarda la sucursal primero para poder configurar horarios propios.
                        </p>
                      </div>
                    ) : !branchHoursLoaded ? (
                      <p className="text-sm text-gray-400 py-8 text-center">Cargando horarios...</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                          <p className="text-xs text-blue-800">
                            Cada día puede <strong>heredar del restaurante</strong> (usar el horario definido en Configuración) o definir su propio horario. Los cambios se guardan al presionar <strong>Guardar Cambios</strong> abajo.
                          </p>
                        </div>
                        {branchHours.map((day, idx) => (
                          <div
                            key={day.day_of_week}
                            className={`flex items-center gap-3 p-3 rounded-lg border ${
                              day.inherit ? "bg-gray-50" : "bg-white"
                            }`}
                          >
                            <div className="w-24 font-medium text-sm">
                              {DAY_NAMES[day.day_of_week]}
                            </div>
                            <div className="flex items-center gap-2 w-44">
                              <Switch
                                checked={!day.inherit}
                                onCheckedChange={(checked) => {
                                  const updated = [...branchHours]
                                  updated[idx] = { ...updated[idx], inherit: !checked }
                                  setBranchHours(updated)
                                }}
                              />
                              <span className="text-xs text-gray-500">
                                {day.inherit ? "Hereda del restaurante" : "Horario propio"}
                              </span>
                            </div>
                            <Switch
                              checked={day.is_open}
                              disabled={day.inherit}
                              onCheckedChange={(checked) => {
                                const updated = [...branchHours]
                                updated[idx] = { ...updated[idx], is_open: checked }
                                setBranchHours(updated)
                              }}
                            />
                            <span
                              className={`text-xs w-14 font-medium ${
                                day.inherit
                                  ? "text-gray-400"
                                  : day.is_open
                                  ? "text-green-600"
                                  : "text-red-500"
                              }`}
                            >
                              {day.is_open ? "Abierto" : "Cerrado"}
                            </span>
                            {day.is_open && (
                              <div className="flex items-center gap-2 ml-auto">
                                <Input
                                  type="time"
                                  value={day.open_time}
                                  disabled={day.inherit}
                                  onChange={(e) => {
                                    const updated = [...branchHours]
                                    updated[idx] = { ...updated[idx], open_time: e.target.value }
                                    setBranchHours(updated)
                                  }}
                                  className="w-32 text-sm"
                                />
                                <span className="text-gray-400 text-sm">a</span>
                                <Input
                                  type="time"
                                  value={day.close_time}
                                  disabled={day.inherit}
                                  onChange={(e) => {
                                    const updated = [...branchHours]
                                    updated[idx] = { ...updated[idx], close_time: e.target.value }
                                    setBranchHours(updated)
                                  }}
                                  className="w-32 text-sm"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

              {branchError && (
                <p className="mx-6 mb-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{branchError}</p>
              )}

              <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setShowBranchModal(false)}>Cancelar</Button>
                <Button
                  className="text-white"
                  style={{ backgroundColor: primaryColor }}
                  disabled={branchSaving || !branchForm.name}
                  onClick={async () => {
                    setBranchSaving(true)
                    setBranchError(null)
                    try {
                      if (editingBranch) {
                        await updateCateringBranch(editingBranch.id, branchForm)
                        // Persist per-branch operating-hour overrides (delete rows
                        // marked `inherit`, upsert the rest).
                        if (branchHoursLoaded && branchHours.length) {
                          await saveCateringBranchOperatingHours(
                            editingBranch.id,
                            branchHours.map((h) => ({
                              day_of_week: h.day_of_week,
                              is_open: h.is_open,
                              open_time: h.is_open ? h.open_time : null,
                              close_time: h.is_open ? h.close_time : null,
                              inherit: h.inherit,
                            })),
                          )
                        }
                        setBranches(prev => prev.map(b => b.id === editingBranch.id ? { ...b, ...branchForm } : b))
                      } else {
                        const newBranch = await createCateringBranch(restaurant.id, branchForm)
                        setBranches(prev => [...prev, newBranch])
                      }
                      setShowBranchModal(false)
                      toast({ title: editingBranch ? "Sucursal actualizada" : "Sucursal creada" })
                    } catch (err: any) {
                      setBranchError(err.message)
                    } finally {
                      setBranchSaving(false)
                    }
                  }}
                >
                  {branchSaving ? "Guardando..." : editingBranch ? "Guardar Cambios" : "Crear Sucursal"}
                </Button>
              </div>
            </Card>
            )}
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="space-y-6">

            {/* DESIGN TEMPLATE */}
            <Card>
              <CardHeader>
                <CardTitle>Diseño del Portal</CardTitle>
                <CardDescription>Elige el estilo visual del portal de clientes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(Object.keys(CATERING_TEMPLATE_INFO) as CateringDesignTemplate[]).map((template) => (
                    <CateringTemplatePreview
                      key={template}
                      template={template}
                      isSelected={settingsForm.design_template === template}
                      onSelect={() => setSettingsForm((f) => ({ ...f, design_template: template }))}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* BRANDING */}
            <Card>
              <CardHeader><CardTitle>Branding</CardTitle><CardDescription>Logos, imágenes y colores del restaurante</CardDescription></CardHeader>
              <CardContent className="space-y-6">
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Nombre del Restaurante</Label>
                    <Input className="mt-1" value={settingsForm.name} onChange={(e) => setSettingsForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Dominio Personalizado</Label>
                    <Input className="mt-1" placeholder="ej. metropolcatering.com" value={settingsForm.custom_domain} onChange={(e) => setSettingsForm((f) => ({ ...f, custom_domain: e.target.value }))} />
                    <p className="text-xs text-gray-500 mt-1">Apunta tu dominio a nuestros servidores para activarlo. Contacta soporte para configuración.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Color Principal</Label>
                    <div className="flex gap-2 mt-1">
                      <input type="color" value={settingsForm.primary_color} onChange={(e) => setSettingsForm((f) => ({ ...f, primary_color: e.target.value }))} className="h-10 w-16 rounded cursor-pointer border" />
                      <Input value={settingsForm.primary_color} onChange={(e) => setSettingsForm((f) => ({ ...f, primary_color: e.target.value }))} />
                    </div>
</div>
                </div>

                {/* Cuisine Type Dropdown */}
                <div>
                  <Label>Tipo de Cocina</Label>
                  {cuisineTypesError ? (
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg mt-1">Error: {cuisineTypesError}</p>
                  ) : !cuisineTypesLoaded ? (
                    <p className="text-sm text-gray-400 mt-1">Cargando tipos de cocina...</p>
                  ) : (
                    <Select value={settingsForm.cuisine_type} onValueChange={(v) => setSettingsForm((f) => ({ ...f, cuisine_type: v }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecciona el tipo de cocina" />
                      </SelectTrigger>
                      <SelectContent>
                        {cuisineTypes.map((ct) => (
                          <SelectItem key={ct.id} value={ct.name}>{ct.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div><Label>Descripción</Label><Textarea className="mt-1" value={settingsForm.description} onChange={(e) => setSettingsForm((f) => ({ ...f, description: e.target.value }))} /></div>

                <div>
                  <Label className="text-sm font-semibold">Logo del Marketplace (cuadrado)</Label>
                  <p className="text-xs text-gray-500 mb-2">Recomendado: 200x200px.</p>
                  {settingsForm.logo_url ? (
                    <div className="flex items-center gap-3">
                      <img src={settingsForm.logo_url} alt="Logo" className="w-16 h-16 object-cover rounded-lg border" />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}><Upload className="w-3 h-3 mr-1" />{uploadingLogo ? "Subiendo..." : "Reemplazar"}</Button>
                        <Button variant="outline" size="sm" className="text-red-500" onClick={() => setSettingsForm((f) => ({ ...f, logo_url: "" }))}><X className="w-3 h-3 mr-1" />Remover</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-gray-300" onClick={() => logoInputRef.current?.click()}>
                      <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-500">{uploadingLogo ? "Subiendo..." : "Click para subir"}</p>
                    </div>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSettingsImageUpload(f, "logo_url", setUploadingLogo) }} />
                </div>

                <div>
                  <Label className="text-sm font-semibold">Logo del Banner (rectangular)</Label>
                  <p className="text-xs text-gray-500 mb-2">Barra superior del portal. Recomendado: 400x100px.</p>
                  {settingsForm.banner_logo_url ? (
                    <div className="flex items-center gap-3">
                      <img src={settingsForm.banner_logo_url} alt="Banner" className="h-12 w-auto object-contain rounded-lg border" />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner}><Upload className="w-3 h-3 mr-1" />{uploadingBanner ? "Subiendo..." : "Reemplazar"}</Button>
                        <Button variant="outline" size="sm" className="text-red-500" onClick={() => setSettingsForm((f) => ({ ...f, banner_logo_url: "" }))}><X className="w-3 h-3 mr-1" />Remover</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-gray-300" onClick={() => bannerInputRef.current?.click()}>
                      <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-500">{uploadingBanner ? "Subiendo..." : "Click para subir"}</p>
                    </div>
                  )}
                  <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSettingsImageUpload(f, "banner_logo_url", setUploadingBanner) }} />
                </div>

                <div>
                  <Label className="text-sm font-semibold">Hero Image (Branch Selector Background)</Label>
                  <p className="text-xs text-gray-500 mb-2">Recomendado: 1920x1080.</p>
                  {settingsForm.hero_image_url ? (
                    <div>
                      <img src={settingsForm.hero_image_url} alt="Hero" className="w-full h-40 object-cover rounded-lg border mb-2" />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => heroInputRef.current?.click()} disabled={uploadingHero}><Upload className="w-3 h-3 mr-1" />{uploadingHero ? "Subiendo..." : "Reemplazar"}</Button>
                        <Button variant="outline" size="sm" className="text-red-500" onClick={() => setSettingsForm((f) => ({ ...f, hero_image_url: "" }))}><X className="w-3 h-3 mr-1" />Remover</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-gray-300" onClick={() => heroInputRef.current?.click()}>
                      <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-500">{uploadingHero ? "Subiendo..." : "Click para subir"}</p>
                    </div>
                  )}
                  <input ref={heroInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSettingsImageUpload(f, "hero_image_url", setUploadingHero) }} />
                </div>

                <div>
                  <Label className="text-sm font-semibold">Imagen por defecto para platos sin foto</Label>
                  <p className="text-xs text-gray-500 mb-2">Se usa cuando un plato no tiene foto.</p>
                  {settingsForm.default_item_image_url ? (
                    <div>
                      <img src={settingsForm.default_item_image_url} alt="Default item" className="w-full h-40 object-cover rounded-lg border mb-2" />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => defaultItemInputRef.current?.click()} disabled={uploadingDefaultItem}><Upload className="w-3 h-3 mr-1" />{uploadingDefaultItem ? "Subiendo..." : "Reemplazar"}</Button>
                        <Button variant="outline" size="sm" className="text-red-500" onClick={() => setSettingsForm((f) => ({ ...f, default_item_image_url: "" }))}><X className="w-3 h-3 mr-1" />Remover</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-gray-300" onClick={() => defaultItemInputRef.current?.click()}>
                      <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-500">{uploadingDefaultItem ? "Subiendo..." : "Click para subir"}</p>
                    </div>
                  )}
                  <input ref={defaultItemInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDefaultItemImageUpload(f) }} />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox id="hide-branch-title" checked={settingsForm.hide_branch_title} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, hide_branch_title: v as boolean }))} />
                  <Label htmlFor="hide-branch-title" className="cursor-pointer">Ocultar nombre en selector de sucursales</Label>
                  <span className="text-xs text-gray-500">(cuando los logos ya est��n visibles)</span>
                </div>
              </CardContent>
            </Card>

{/* NOTIFICATIONS */}
            <Card>
              <CardHeader><CardTitle>Notificaciones de Órdenes</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Email de Notificaciones</Label>
                  <Input className="mt-1" type="email" placeholder="orders@mirestaurante.com" value={settingsForm.notification_email} onChange={(e) => setSettingsForm((f) => ({ ...f, notification_email: e.target.value }))} />
                  <p className="text-xs text-gray-500 mt-1">Dejar vacío para usar el email de la plataforma</p>
                </div>
                <div>
                  <Label>Método de Notificación</Label>
                  <Select value={settingsForm.notification_method} onValueChange={(v) => setSettingsForm((f) => ({ ...f, notification_method: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Solo Email</SelectItem>
                      <SelectItem value="kds">Kitchen Display (KDS)</SelectItem>
                      <SelectItem value="eatabit">Eatabit (Impresora)</SelectItem>
                      <SelectItem value="chowly">Chowly POS</SelectItem>
                      <SelectItem value="square_kds">Square KDS</SelectItem>
                      <SelectItem value="multiple">Múltiples Canales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Email Fallback Toggle */}
                {settingsForm.notification_method && settingsForm.notification_method !== "email" && settingsForm.notification_method !== "multiple" && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div>
                      <Label className="text-blue-900">También enviar por Email</Label>
                      <p className="text-xs text-blue-700">Recibe una copia del pedido por correo además del método principal</p>
                    </div>
                    <Switch checked={settingsForm.email_fallback_enabled} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, email_fallback_enabled: v }))} />
                  </div>
                )}
                {/* Eatabit Settings */}
                {settingsForm.notification_method === "eatabit" && (
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 space-y-3">
                    <Label className="text-orange-900">Configuración Eatabit</Label>
                    <div>
                      <Label className="text-xs">Restaurant Key</Label>
                      <Input className="mt-1" type="text" placeholder="Tu Eatabit Restaurant Key" value={settingsForm.eatabit_restaurant_key} onChange={(e) => setSettingsForm((f) => ({ ...f, eatabit_restaurant_key: e.target.value }))} />
                    </div>
                  </div>
                )}
                {/* Chowly Settings */}
                {settingsForm.notification_method === "chowly" && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 space-y-3">
                    <Label className="text-purple-900">Configuración Chowly</Label>
                    <div>
                      <Label className="text-xs">API Key</Label>
                      <Input className="mt-1" type="password" placeholder="Tu Chowly API Key" value={settingsForm.chowly_api_key} onChange={(e) => setSettingsForm((f) => ({ ...f, chowly_api_key: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Location ID</Label>
                      <Input className="mt-1" placeholder="Tu Chowly Location ID" value={settingsForm.chowly_location_id} onChange={(e) => setSettingsForm((f) => ({ ...f, chowly_location_id: e.target.value }))} />
                    </div>
                    <p className="text-xs text-purple-700">Conecta con tu POS (Toast, Clover, etc.) via Chowly</p>
                  </div>
                )}
                {/* Square KDS Settings */}
                {settingsForm.notification_method === "square_kds" && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200 space-y-3">
                    <Label className="text-green-900">Configuración Square KDS</Label>
                    <div>
                      <Label className="text-xs">Square Access Token</Label>
                      <Input className="mt-1" type="password" placeholder="Tu Square Access Token" value={settingsForm.square_access_token} onChange={(e) => setSettingsForm((f) => ({ ...f, square_access_token: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Square Location ID</Label>
                      <Input className="mt-1" placeholder="Tu Square Location ID" value={settingsForm.square_location_id} onChange={(e) => setSettingsForm((f) => ({ ...f, square_location_id: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Ambiente</Label>
                      <Select value={settingsForm.square_environment || "production"} onValueChange={(v) => setSettingsForm((f) => ({ ...f, square_environment: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="production">Producción</SelectItem>
                          <SelectItem value="sandbox">Sandbox (Pruebas)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-green-700">Los pedidos aparecerán en tu Square Kitchen Display</p>
                  </div>
                )}
                {/* Multiple Channels Settings */}
                {settingsForm.notification_method === "multiple" && (
                  <div className="p-3 bg-gray-50 rounded-lg border space-y-3">
                    <Label>Selecciona los canales a usar:</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between"><span className="text-sm">Email</span><Switch checked={settingsForm.multi_email} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, multi_email: v }))} /></div>
                      <div className="flex items-center justify-between"><span className="text-sm">Kitchen Display (KDS)</span><Switch checked={settingsForm.multi_kds} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, multi_kds: v }))} /></div>
                      <div className="flex items-center justify-between"><span className="text-sm">Eatabit (Impresora)</span><Switch checked={settingsForm.multi_eatabit} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, multi_eatabit: v }))} /></div>
                      <div className="flex items-center justify-between"><span className="text-sm">Chowly POS</span><Switch checked={settingsForm.multi_chowly} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, multi_chowly: v }))} /></div>
                      <div className="flex items-center justify-between"><span className="text-sm">Square KDS</span><Switch checked={settingsForm.multi_square_kds} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, multi_square_kds: v }))} /></div>
                    </div>
                    {settingsForm.multi_eatabit && (
                      <div className="pt-2 border-t space-y-2">
                        <Label className="text-xs font-medium">Eatabit Restaurant Key</Label>
                        <Input type="text" placeholder="Tu Eatabit Restaurant Key" value={settingsForm.eatabit_restaurant_key} onChange={(e) => setSettingsForm((f) => ({ ...f, eatabit_restaurant_key: e.target.value }))} />
                      </div>
                    )}
                    {settingsForm.multi_chowly && (
                      <div className="pt-2 border-t space-y-2">
                        <Label className="text-xs font-medium">Configuración Chowly</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">API Key</Label>
                            <Input type="password" placeholder="API Key" value={settingsForm.chowly_api_key} onChange={(e) => setSettingsForm((f) => ({ ...f, chowly_api_key: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-xs">Location ID</Label>
                            <Input placeholder="Location ID" value={settingsForm.chowly_location_id} onChange={(e) => setSettingsForm((f) => ({ ...f, chowly_location_id: e.target.value }))} />
                          </div>
                        </div>
                      </div>
                    )}
                    {settingsForm.multi_square_kds && (
                      <div className="pt-2 border-t space-y-2">
                        <Label className="text-xs font-medium">Configuración Square KDS</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Access Token</Label>
                            <Input type="password" placeholder="Access Token" value={settingsForm.square_access_token} onChange={(e) => setSettingsForm((f) => ({ ...f, square_access_token: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-xs">Location ID</Label>
                            <Input placeholder="Location ID" value={settingsForm.square_location_id} onChange={(e) => setSettingsForm((f) => ({ ...f, square_location_id: e.target.value }))} />
                          </div>
                        </div>
                        <Select value={settingsForm.square_environment || "production"} onValueChange={(v) => setSettingsForm((f) => ({ ...f, square_environment: v }))}>
                          <SelectTrigger><SelectValue placeholder="Ambiente" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="production">Producción</SelectItem>
                            <SelectItem value="sandbox">Sandbox</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PRICING & TIMING */}
            <Card>
              <CardHeader><CardTitle>Precios y Tiempos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Dirección del Restaurante</Label>
                  <Input className="mt-1" placeholder="Calle Principal 123, Ciudad, PR 00901" value={settingsForm.restaurant_address} onChange={(e) => setSettingsForm((f) => ({ ...f, restaurant_address: e.target.value }))} />
                  <p className="text-xs text-gray-500 mt-1">Usada para calcular la distancia de delivery</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>IVU (%)</Label><Input type="number" step="0.01" className="mt-1" value={settingsForm.tax_rate} onChange={(e) => setSettingsForm((f) => ({ ...f, tax_rate: e.target.value }))} /></div>
                  <div><Label>Tarifa de Delivery por Defecto ($)</Label><Input type="number" step="0.01" className="mt-1" value={settingsForm.delivery_fee} onChange={(e) => setSettingsForm((f) => ({ ...f, delivery_fee: e.target.value }))} /><p className="text-xs text-gray-500 mt-1">Usada cuando no hay zonas configuradas</p></div>
                  <div><Label>Anticipación General (horas)</Label><Input type="number" className="mt-1" value={settingsForm.default_lead_time_hours} onChange={(e) => setSettingsForm((f) => ({ ...f, default_lead_time_hours: e.target.value }))} /></div>
                  <div><Label>Anticipación Máxima (días)</Label><Input type="number" className="mt-1" value={settingsForm.max_advance_days} onChange={(e) => setSettingsForm((f) => ({ ...f, max_advance_days: e.target.value }))} /></div>
                  <div><Label>Anticipación Delivery (horas)</Label><Input type="number" className="mt-1" placeholder={`Default: ${settingsForm.default_lead_time_hours}h`} value={settingsForm.delivery_turnaround_hours} onChange={(e) => setSettingsForm((f) => ({ ...f, delivery_turnaround_hours: e.target.value }))} /><p className="text-xs text-gray-500 mt-1">Vacío = usa anticipación general</p></div>
                  <div><Label>Anticipación Pickup (horas)</Label><Input type="number" className="mt-1" placeholder={`Default: ${settingsForm.default_lead_time_hours}h`} value={settingsForm.pickup_turnaround_hours} onChange={(e) => setSettingsForm((f) => ({ ...f, pickup_turnaround_hours: e.target.value }))} /><p className="text-xs text-gray-500 mt-1">Vacío = usa anticipación general</p></div>
                  <div><Label>Orden Mínima Delivery ($)</Label><Input type="number" step="0.01" className="mt-1" value={settingsForm.min_delivery_order} onChange={(e) => setSettingsForm((f) => ({ ...f, min_delivery_order: e.target.value }))} /></div>
<div><Label>Orden Mínima Pickup ($)</Label><Input type="number" step="0.01" className="mt-1" value={settingsForm.min_pickup_order} onChange={(e) => setSettingsForm((f) => ({ ...f, min_pickup_order: e.target.value }))} /></div>
                </div>

                {/* Dispatch Fee */}
                <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                  <div>
                    <Label className="text-sm font-semibold">Dispatch Fee</Label>
                    <p className="text-xs text-gray-500 mt-1">Platform coordination/dispatch fee per order</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs">Tipo de Tarifa</Label>
                      <Select value={settingsForm.dispatch_fee_type} onValueChange={(v) => setSettingsForm((f) => ({ ...f, dispatch_fee_type: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin tarifa</SelectItem>
                          <SelectItem value="fixed">Monto fijo</SelectItem>
                          <SelectItem value="percentage">Porcentaje de la orden</SelectItem>
                          <SelectItem value="per_order">Tarifa por orden</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {settingsForm.dispatch_fee_type !== "none" && (
                      <>
                        <div>
                          <Label className="text-xs">Valor {settingsForm.dispatch_fee_type === "percentage" ? "(%)" : "($)"}</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="mt-1"
                            placeholder={settingsForm.dispatch_fee_type === "percentage" ? "ej. 5.5" : "ej. 15.00"}
                            value={settingsForm.dispatch_fee_value}
                            onChange={(e) => setSettingsForm((f) => ({ ...f, dispatch_fee_value: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Aplica a</Label>
                          <Select value={settingsForm.dispatch_fee_applies_to} onValueChange={(v) => setSettingsForm((f) => ({ ...f, dispatch_fee_applies_to: v }))}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="entrega">Entrega</SelectItem>
                              <SelectItem value="recogido">Recogido</SelectItem>
                              <SelectItem value="both">Ambos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Main Dispatch routing (chain default) */}
                <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
                  <div>
                    <Label className="text-sm font-semibold">Enrutamiento Main Dispatch</Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Valor por defecto para todas las sucursales. Cada sucursal puede anularlo en su pestaña Dispatch.
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Enviar órdenes a Main Dispatch por defecto</Label>
                      <p className="text-xs text-gray-500">
                        {settingsForm.route_to_main_dispatch_default
                          ? "Las órdenes aparecen en el CSR / Main Dispatch."
                          : "Las sucursales manejan sus órdenes sin pasar por Main Dispatch."}
                      </p>
                    </div>
                    <Switch
                      checked={settingsForm.route_to_main_dispatch_default}
                      onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, route_to_main_dispatch_default: v }))}
                    />
                  </div>
                </div>

<div>
                    <Label className="text-sm font-semibold">Opciones de Propina (%)</Label>
                    <p className="text-xs text-gray-500 mt-1">Números enteros, ej: 15 para 15%</p>
                    <div className="grid grid-cols-4 gap-3 mt-2">
                      <div><Label className="text-xs">Opción 1</Label><Input type="number" min="0" max="100" className="mt-1" value={settingsForm.tip_option_1} onChange={(e) => setSettingsForm((f) => ({ ...f, tip_option_1: e.target.value }))} /></div>
                      <div><Label className="text-xs">Opción 2</Label><Input type="number" min="0" max="100" className="mt-1" value={settingsForm.tip_option_2} onChange={(e) => setSettingsForm((f) => ({ ...f, tip_option_2: e.target.value }))} /></div>
                      <div><Label className="text-xs">Opción 3</Label><Input type="number" min="0" max="100" className="mt-1" value={settingsForm.tip_option_3} onChange={(e) => setSettingsForm((f) => ({ ...f, tip_option_3: e.target.value }))} /></div>
                      <div><Label className="text-xs">Opción 4</Label><Input type="number" min="0" max="100" className="mt-1" value={settingsForm.tip_option_4} onChange={(e) => setSettingsForm((f) => ({ ...f, tip_option_4: e.target.value }))} /></div>
                    </div>
                    <div className="mt-3">
                      <Label className="text-xs">Propina por Defecto</Label>
                      <Select value={settingsForm.default_tip_option} onValueChange={(v) => setSettingsForm((f) => ({ ...f, default_tip_option: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Opción 1 ({settingsForm.tip_option_1 || "?"}%)</SelectItem>
                          <SelectItem value="2">Opción 2 ({settingsForm.tip_option_2 || "?"}%)</SelectItem>
                          <SelectItem value="3">Opción 3 ({settingsForm.tip_option_3 || "?"}%)</SelectItem>
                          <SelectItem value="4">Opción 4 ({settingsForm.tip_option_4 || "?"}%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
              </CardContent>
            </Card>

            {/* DELIVERY & PICKUP */}
            <Card>
              <CardHeader><CardTitle>Delivery y Pickup</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div><Label>Habilitar Delivery</Label><p className="text-xs text-gray-500">Los clientes pueden solicitar entrega</p></div>
                  <Switch checked={settingsForm.enable_delivery} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, enable_delivery: v }))} />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div><Label>Habilitar Pickup</Label><p className="text-xs text-gray-500">Los clientes pueden recoger su orden</p></div>
                  <Switch checked={settingsForm.enable_pickup} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, enable_pickup: v }))} />
                </div>
                <div>
                  <Label>Radio de Delivery (millas)</Label>
                  <Input type="number" step="0.1" className="mt-1" value={settingsForm.delivery_radius_miles} onChange={(e) => setSettingsForm((f) => ({ ...f, delivery_radius_miles: e.target.value }))} />
                </div>
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold">Shipday</Label>
                  <Input className="mt-2" type="password" placeholder="Dejar vacío para usar el key de la plataforma" value={settingsForm.shipday_api_key} onChange={(e) => setSettingsForm((f) => ({ ...f, shipday_api_key: e.target.value }))} />
                  <p className="text-xs text-gray-500 mt-1">{settingsForm.shipday_api_key ? "Usando key específico de este restaurante." : "Usando key de la plataforma. Solo configura si este restaurante tiene su propia cuenta de Shipday."}</p>
                </div>
              </CardContent>
            </Card>

{/* PAYMENT */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" />Métodos de Pago</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between"><Label>Tarjeta (Stripe)</Label><Switch checked={settingsForm.stripe_enabled} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, stripe_enabled: v, square_enabled: v ? false : settingsForm.square_enabled }))} /></div>
                {settingsForm.stripe_enabled && (
                  <div className="ml-4 p-3 bg-gray-50 rounded-lg">
                    <Label className="text-xs">Stripe Account ID</Label>
                    <Input className="mt-1" placeholder="acct_XXXXXXXXXXXXX" value={settingsForm.stripe_account_id} onChange={(e) => setSettingsForm((f) => ({ ...f, stripe_account_id: e.target.value }))} />
                    <p className="text-xs text-gray-500 mt-1">Vacío = los pagos van a la cuenta principal de la plataforma.</p>
                  </div>
                )}
                <div className="flex items-center justify-between"><Label>Tarjeta (Square)</Label><Switch checked={settingsForm.square_enabled} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, square_enabled: v, stripe_enabled: v ? false : settingsForm.stripe_enabled }))} /></div>
                {settingsForm.square_enabled && (
                  <div className="ml-4 p-3 bg-gray-50 rounded-lg space-y-3">
                    <div>
                      <Label className="text-xs">Square Access Token</Label>
                      <Input className="mt-1" type="password" placeholder="EAAAl..." value={settingsForm.square_access_token} onChange={(e) => setSettingsForm((f) => ({ ...f, square_access_token: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Square Location ID</Label>
                      <Input className="mt-1" placeholder="L..." value={settingsForm.square_location_id} onChange={(e) => setSettingsForm((f) => ({ ...f, square_location_id: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Ambiente</Label>
                      <Select value={settingsForm.square_environment || "production"} onValueChange={(v) => setSettingsForm((f) => ({ ...f, square_environment: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="production">Producción</SelectItem>
                          <SelectItem value="sandbox">Sandbox (Pruebas)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between"><Label>ATH Móvil</Label><Switch checked={settingsForm.athmovil_enabled} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, athmovil_enabled: v }))} /></div>
                {settingsForm.athmovil_enabled && (
                  <div className="ml-4 p-3 bg-orange-50 rounded-lg space-y-3">
                    <div><Label className="text-xs">Public Token</Label><Input className="mt-1" type="password" value={settingsForm.athmovil_public_token} onChange={(e) => setSettingsForm((f) => ({ ...f, athmovil_public_token: e.target.value }))} /></div>
                    <div><Label className="text-xs">Private Token</Label><Input className="mt-1" type="password" value={settingsForm.athmovil_private_token} onChange={(e) => setSettingsForm((f) => ({ ...f, athmovil_private_token: e.target.value }))} /></div>
                  </div>
                )}
<div className="flex items-center justify-between"><Label>Efectivo</Label><Switch checked={settingsForm.cash_payment_enabled} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, cash_payment_enabled: v }))} /></div>
  </CardContent>
  </Card>

  {/* ORDER NOTIFICATIONS */}
  <OrderNotificationSettings
    settings={{
      order_notification_method: settingsForm.order_notification_method || "email",
      email_fallback_enabled: settingsForm.email_fallback_enabled || false,
      chowly_api_key: settingsForm.chowly_api_key || "",
      chowly_location_id: settingsForm.chowly_location_id || "",
      chowly_enabled: settingsForm.chowly_enabled || false,
      square_kds_enabled: settingsForm.square_kds_enabled || false,
      square_access_token: settingsForm.square_access_token || "",
      square_location_id: settingsForm.square_location_id || "",
      kds_access_token: settingsForm.kds_access_token || "",
      eatabit_enabled: settingsForm.eatabit_enabled || false,
      eatabit_restaurant_key: settingsForm.eatabit_restaurant_key || "",
    }}
    onChange={(newSettings) => setSettingsForm((f) => ({ ...f, ...newSettings }))}
    restaurantSlug={restaurant?.slug || ""}
    entityType="restaurant"
  />

  {/* PORTAL & MARKETPLACE */}
            <Card>
              <CardHeader><CardTitle>Portal y Marketplace</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div><Label>Mostrar en Marketplace</Label><p className="text-xs text-gray-500">Aparece en el listado público de catering</p></div>
                  <Switch checked={settingsForm.show_in_marketplace} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, show_in_marketplace: v }))} />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div><Label>Habilitar Sección de Servicios</Label><p className="text-xs text-gray-500">Muestra paquetes de servicio en el portal</p></div>
                  <Switch checked={settingsForm.show_service_packages} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, show_service_packages: v }))} />
                </div>
                {settingsForm.show_service_packages && (
                  <div className="ml-4">
                    <Label className="text-xs">Título de la Sección de Servicios</Label>
                    <Input className="mt-1" value={settingsForm.packages_section_title} onChange={(e) => setSettingsForm((f) => ({ ...f, packages_section_title: e.target.value }))} />
                  </div>
                )}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div><Label>Restaurante con Múltiples Sucursales</Label><p className="text-xs text-gray-500">Activa el selector de sucursales para clientes</p></div>
                  <Switch checked={settingsForm.is_chain} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, is_chain: v }))} />
                </div>
              </CardContent>
            </Card>

            {/* FOOTER */}
            <Card>
              <CardHeader><CardTitle>Footer del Portal</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Descripción</Label><Input className="mt-1" value={settingsForm.footer_description} onChange={(e) => setSettingsForm((f) => ({ ...f, footer_description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Teléfono</Label><Input className="mt-1" value={settingsForm.footer_phone} onChange={(e) => setSettingsForm((f) => ({ ...f, footer_phone: e.target.value }))} /></div>
                  <div><Label>Email</Label><Input className="mt-1" type="email" value={settingsForm.footer_email} onChange={(e) => setSettingsForm((f) => ({ ...f, footer_email: e.target.value }))} /></div>
                </div>
              </CardContent>
            </Card>

            {/* SAVE */}
            <div>
              <Button onClick={handleSaveSettings} disabled={loading} className="text-white px-8" style={{ backgroundColor: primaryColor }}>
                {loading ? "Guardando..." : "Guardar Configuración"}
              </Button>
            </div>

            {/* OPERATING HOURS */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" />Horario de Operación</CardTitle>
                <CardDescription>Define los días y horas en que el restaurante acepta pedidos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!hoursLoaded ? (
                  <p className="text-sm text-gray-400">Cargando horario...</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {operatingHours.map((day, idx) => (
                        <div key={day.day_of_week} className="flex items-center gap-3 p-3 rounded-lg border bg-white">
                          <div className="w-24 font-medium text-sm">{DAY_NAMES[day.day_of_week]}</div>
                          <Switch checked={day.is_open} onCheckedChange={(checked) => {
                            const updated = [...operatingHours]
                            updated[idx] = { ...updated[idx], is_open: checked }
                            setOperatingHours(updated)
                          }} />
                          <span className={`text-xs w-14 font-medium ${day.is_open ? "text-green-600" : "text-red-500"}`}>
                            {day.is_open ? "Abierto" : "Cerrado"}
                          </span>
                          {day.is_open && (
                            <div className="flex items-center gap-2 ml-auto">
                              <Input type="time" value={day.open_time} onChange={(e) => {
                                const updated = [...operatingHours]
                                updated[idx] = { ...updated[idx], open_time: e.target.value }
                                setOperatingHours(updated)
                              }} className="w-32 text-sm" />
                              <span className="text-gray-400 text-sm">a</span>
                              <Input type="time" value={day.close_time} onChange={(e) => {
                                const updated = [...operatingHours]
                                updated[idx] = { ...updated[idx], close_time: e.target.value }
                                setOperatingHours(updated)
                              }} className="w-32 text-sm" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button onClick={handleSaveOperatingHours} disabled={savingHours} className="text-white" style={{ backgroundColor: primaryColor }}>
                      {savingHours ? "Guardando..." : "Guardar Horario"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

{/* PRINTER CONFIGURATION */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Printer className="w-5 h-5" />Impresión de Tickets</CardTitle>
                <CardDescription>Configura la impresión automática de tickets para pedidos de catering</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Sistema de Impresión</Label>
                  <select
                    value={settingsForm.printer_tier}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, printer_tier: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  >
                    <option value="none">Sin impresora</option>
                    <option value="eatabit">Eatabit Cloud Printing</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Selecciona el sistema de impresión para recibir tickets automáticamente</p>
                </div>
                {settingsForm.printer_tier === "eatabit" && (
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 space-y-3">
                    <Label className="text-orange-900 font-medium">Configuración Eatabit</Label>
                    <div>
                      <Label className="text-xs">Restaurant Key</Label>
                      <Input
                        type="text"
                        placeholder="Tu Eatabit Restaurant Key (UUID)"
                        value={settingsForm.eatabit_restaurant_key}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, eatabit_restaurant_key: e.target.value }))}
                        className="mt-1"
                      />
                      <p className="text-xs text-orange-700 mt-1">Encuentra tu Restaurant Key en el panel de <a href="https://eatabit.io" target="_blank" rel="noopener noreferrer" className="underline">eatabit.io</a></p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* DELIVERY ZONES */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" />Zonas de Delivery</CardTitle>
                  <CardDescription>Tarifas de delivery basadas en distancia</CardDescription>
                </div>
                <Button onClick={() => { setEditingZone(null); setZoneForm({ name: "", min_miles: "0", max_miles: "", delivery_fee: "" }); setShowZoneModal(true) }} style={{ backgroundColor: primaryColor }} className="text-white">
                  <Plus className="w-4 h-4 mr-2" /> Agregar Zona
                </Button>
              </CardHeader>
              <CardContent>
                {deliveryZones.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No hay zonas configuradas</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deliveryZones.map((zone) => (
                      <div key={zone.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{zone.name}</p>
                          <p className="text-xs text-gray-500">{zone.min_miles}–{zone.max_miles} millas · ${Number(zone.delivery_fee).toFixed(2)}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingZone(zone); setZoneForm({ name: zone.name, min_miles: String(zone.min_miles), max_miles: String(zone.max_miles), delivery_fee: String(zone.delivery_fee) }); setShowZoneModal(true) }}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { await deleteCateringDeliveryZone(zone.id); setDeliveryZones((prev) => prev.filter((z) => z.id !== zone.id)); toast({ title: "Zona eliminada" }) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CONTAINER RATES */}
            <Card>
              <CardHeader><CardTitle>Tarifa de Delivery por Contenedores</CardTitle><CardDescription>Configura la tarifa base y los cargos adicionales por tipo de contenedor</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Tarifa Base ($)</Label><Input type="number" step="0.01" className="mt-1" value={containerBaseForm.base_fee} onChange={(e) => setContainerBaseForm((f) => ({ ...f, base_fee: e.target.value }))} /><p className="text-xs text-gray-500 mt-1">Tarifa base que cubre los contenedores incluidos</p></div>
                  <div><Label>Contenedores Incluidos</Label><Input type="number" min="0" className="mt-1" value={containerBaseForm.containers_included} onChange={(e) => setContainerBaseForm((f) => ({ ...f, containers_included: e.target.value }))} /><p className="text-xs text-gray-500 mt-1">Cantidad cubierta por la tarifa base</p></div>
                </div>
                <Button size="sm" onClick={handleSaveContainerBaseRate} disabled={loading} className="text-white" style={{ backgroundColor: primaryColor }}>Guardar Tarifa Base</Button>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b"><h4 className="text-sm font-semibold">Tarifa por Tipo de Contenedor Adicional</h4></div>
                  {containerTiers.length > 0 ? (
                    <div className="divide-y">
                      {containerTiers.map((tier) => (
                        <div key={tier.id} className="flex items-center justify-between px-4 py-3">
                          <div><span className="font-medium text-sm">{tier.label}</span><span className="text-xs text-gray-500 ml-2">({tier.container_type})</span></div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">${Number(tier.extra_fee_per_unit).toFixed(2)} c/u</span>
                            <Button variant="ghost" size="sm" onClick={() => { setEditingContainerTier(tier); setContainerTierForm({ container_type: tier.container_type, label: tier.label, extra_fee_per_unit: String(tier.extra_fee_per_unit) }) }}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { await deleteCateringContainerRateTier(tier.id); setContainerTiers((prev) => prev.filter((t) => t.id !== tier.id)); toast({ title: "Tarifa eliminada" }) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-4 text-sm text-gray-400 italic">No hay tarifas configuradas</p>
                  )}
                  <div className="border-t bg-gray-50 p-4">
                    <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">{editingContainerTier ? "Editar Tarifa" : "Agregar Tarifa"}</h4>
<div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs">Tipo</Label>
                        <Input className="h-9 mt-1" value={containerTierForm.container_type} onChange={(e) => setContainerTierForm((f) => ({ ...f, container_type: e.target.value }))} placeholder="tray, bowl, bag..." />
                      </div>
                      <div className="flex-1"><Label className="text-xs">Etiqueta</Label><Input className="h-9 mt-1" value={containerTierForm.label} onChange={(e) => setContainerTierForm((f) => ({ ...f, label: e.target.value }))} placeholder="Bandeja Grande" /></div>
                      <div className="w-28"><Label className="text-xs">$/unidad</Label><Input type="number" min="0" step="0.25" className="h-9 mt-1" value={containerTierForm.extra_fee_per_unit} onChange={(e) => setContainerTierForm((f) => ({ ...f, extra_fee_per_unit: e.target.value }))} placeholder="2.75" /></div>
                      <Button size="sm" onClick={handleSaveContainerTier} disabled={loading} className="text-white h-9" style={{ backgroundColor: primaryColor }}>{editingContainerTier ? "Guardar" : "Agregar"}</Button>
                      {editingContainerTier && <Button size="sm" variant="outline" className="h-9" onClick={() => { setEditingContainerTier(null); setContainerTierForm({ container_type: "", label: "", extra_fee_per_unit: "" }) }}>Cancelar</Button>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </TabsContent>
        </Tabs>
      </div>

      {/* MODALS */}

      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{editingCategory ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre *</Label><Input value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Platos Principales" /></div>
            <div><Label>Descripción</Label><Input value={categoryForm.description} onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div className="flex items-center justify-between"><Label>Activa</Label><Switch checked={categoryForm.is_active} onCheckedChange={(v) => setCategoryForm((f) => ({ ...f, is_active: v }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveCategory} disabled={loading} className="text-white" style={{ backgroundColor: primaryColor }}>{loading ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMenuItemModal} onOpenChange={setShowMenuItemModal}>
        <DialogContent aria-describedby={undefined} className="max-w-lg">
          <DialogHeader><DialogTitle>{editingMenuItem ? "Editar Item" : "Nuevo Item"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div><Label>Nombre *</Label><Input value={menuItemForm.name} onChange={(e) => setMenuItemForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Descripción</Label><Textarea value={menuItemForm.description} onChange={(e) => setMenuItemForm((f) => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div>
              <Label>Categoría *</Label>
              <Select value={menuItemForm.category_id} onValueChange={(v) => setMenuItemForm((f) => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                <SelectContent>{categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Precio Base ($) *</Label><Input type="number" value={menuItemForm.price} onChange={(e) => setMenuItemForm((f) => ({ ...f, price: e.target.value }))} /></div>
              <div>
                <Label>Unidad de Venta</Label>
                <Select value={menuItemForm.selling_unit} onValueChange={(v) => setMenuItemForm((f) => ({ ...f, selling_unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SELLING_UNITS.map((u) => <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Sirve (personas)</Label><Input value={menuItemForm.serves} onChange={(e) => setMenuItemForm((f) => ({ ...f, serves: e.target.value }))} placeholder="Ej: 10-15" /></div>
              <div><Label>Cantidad Mínima</Label><Input type="number" value={menuItemForm.min_quantity} onChange={(e) => setMenuItemForm((f) => ({ ...f, min_quantity: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Contenedor para Delivery</Label>
              <Select value={menuItemForm.container_type} onValueChange={(v) => setMenuItemForm((f) => ({ ...f, container_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTAINER_TYPES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Custom Lead Time (horas)</Label>
              <Input type="number" value={menuItemForm.lead_time_hours} onChange={(e) => setMenuItemForm((f) => ({ ...f, lead_time_hours: e.target.value }))} placeholder={`Default: ${restaurant.default_lead_time_hours || 24}h`} />
              <p className="text-xs text-gray-400 mt-1">Opcional — sobreescribe el lead time del restaurante</p>
            </div>
            <div>
              <Label>Imagen del Item</Label>
              {menuItemForm.image_url ? (
                <div className="mt-2">
                  <img src={menuItemForm.image_url} alt="Preview" className="w-full h-40 object-cover rounded-lg mb-2" />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}><Upload className="w-3 h-3 mr-1" />{uploadingImage ? "Subiendo..." : "Reemplazar"}</Button>
                    <Button variant="outline" size="sm" className="text-red-500" onClick={() => setMenuItemForm((f) => ({ ...f, image_url: "" }))}><X className="w-3 h-3 mr-1" />Remover</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300" onClick={() => imageInputRef.current?.click()}>
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">{uploadingImage ? "Subiendo..." : "Click para subir imagen"}</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG o WebP. Max 5MB.</p>
                </div>
              )}
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden"
                onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const url = await handleImageUpload(file); setMenuItemForm((f) => ({ ...f, image_url: url })) } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }) } }} />
              <div className="mt-2">
                <Label className="text-xs text-gray-500">O pega una URL directamente</Label>
                <Input value={menuItemForm.image_url} onChange={(e) => setMenuItemForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://..." className="mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Checkbox id="cart-upsell" checked={menuItemForm.is_cart_upsell} onCheckedChange={(v) => setMenuItemForm((f) => ({ ...f, is_cart_upsell: v as boolean }))} />
              <div>
                <Label htmlFor="cart-upsell" className="cursor-pointer font-medium">Mostrar como Cart Upsell</Label>
                <p className="text-xs text-gray-400">Se muestra en el carrito como add-on opcional</p>
              </div>
            </div>
            <div className="flex items-center justify-between"><Label>Activo</Label><Switch checked={menuItemForm.is_active} onCheckedChange={(v) => setMenuItemForm((f) => ({ ...f, is_active: v }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMenuItemModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveMenuItem} disabled={loading || uploadingImage} className="text-white" style={{ backgroundColor: primaryColor }}>{loading ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSizesModal} onOpenChange={setShowSizesModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tamaños — {sizesMenuItem?.name}</DialogTitle><DialogDescription>Agrega variantes de tamaño con diferentes precios y porciones.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            {sizes.length > 0 ? (
              <div className="border rounded-lg divide-y">
                {sizes.map((size) => (
                  <div key={size.id} className="flex items-center justify-between px-3 py-2 group hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{size.catering_name}</span>
                        {size.catering_is_default && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                      </div>
                      <p className="text-xs text-gray-500">${Number(size.catering_price).toFixed(2)}{size.catering_serves && ` · Sirve ${size.catering_serves}`}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingSizeId(size.id); setSizeForm({ catering_name: size.catering_name, catering_price: String(size.catering_price), catering_serves: size.catering_serves || "", catering_is_default: size.catering_is_default || false }) }}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => handleDeleteSize(size.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4 border rounded-lg bg-gray-50">No hay tamaños. Agrega uno abajo o copia de otro item.</p>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={() => { loadAvailableSizes(); setShowBrowseSizes(true) }}>Copiar Tamaños de Otro Item</Button>
            <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
              <h4 className="text-sm font-semibold">{editingSizeId ? "Editar Tamaño" : "Agregar Tamaño"}</h4>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Nombre *</Label><Input placeholder="Media Bandeja" value={sizeForm.catering_name} onChange={(e) => setSizeForm((f) => ({ ...f, catering_name: e.target.value }))} className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Precio ($) *</Label><Input type="number" step="0.01" value={sizeForm.catering_price} onChange={(e) => setSizeForm((f) => ({ ...f, catering_price: e.target.value }))} className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Sirve</Label><Input placeholder="10-15" value={sizeForm.catering_serves} onChange={(e) => setSizeForm((f) => ({ ...f, catering_serves: e.target.value }))} className="h-8 text-sm" /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={sizeForm.catering_is_default} onCheckedChange={(v) => setSizeForm((f) => ({ ...f, catering_is_default: v }))} /><Label className="text-sm">Default (pre-seleccionado)</Label></div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveSize} disabled={loading} className="text-white" style={{ backgroundColor: primaryColor }}>{loading ? "Guardando..." : editingSizeId ? "Actualizar" : "Agregar"}</Button>
                {editingSizeId && <Button size="sm" variant="outline" onClick={() => { setEditingSizeId(null); setSizeForm({ catering_name: "", catering_price: "", catering_serves: "", catering_is_default: false }) }}>Cancelar</Button>}
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowSizesModal(false)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBrowseSizes} onOpenChange={setShowBrowseSizes}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Copiar Tamaños de Otro Item</DialogTitle><DialogDescription>Selecciona tamaños para copiar a {sizesMenuItem?.name}</DialogDescription></DialogHeader>
          {loadingAvailableSizes ? <p className="text-center text-gray-400 py-8">Cargando...</p> :
            availableSizes.length === 0 ? <p className="text-center text-gray-400 py-8">No hay tamaños disponibles en otros items</p> : (
              <div className="space-y-2">
                {availableSizes.map(({ size, menuItemName }) => (
                  <div key={size.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-sm">{size.catering_name}</p>
                      <p className="text-xs text-gray-500">${Number(size.catering_price).toFixed(2)}{size.catering_serves && ` · Sirve ${size.catering_serves}`}</p>
                      <p className="text-xs text-gray-400">De: {menuItemName}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleCopySize(size)} disabled={loading}>Copiar</Button>
                  </div>
                ))}
              </div>
            )}
          <DialogFooter><Button variant="outline" onClick={() => setShowBrowseSizes(false)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOptionsModal} onOpenChange={setShowOptionsModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Opciones — {optionsMenuItem?.name}</DialogTitle><DialogDescription>Agrega, edita o elimina opciones de personalización.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            {itemOptions.length === 0 && !showOptionForm ? (
              <p className="text-center text-gray-400 py-4 border rounded-lg bg-gray-50">No hay opciones. Agrega una abajo o copia de otro item.</p>
            ) : (
              <div className="space-y-3">
                {itemOptions.map((option) => (
                  <div key={option.id} className="border rounded-xl p-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{option.catering_name}</p>
                        <p className="text-xs text-gray-500">{option.catering_is_required ? "Requerido" : "Opcional"} · {option.catering_display_type} · {option.catering_min_selections}-{option.catering_max_selections} selecciones</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingOption(option); setOptionForm({ catering_name: option.catering_name, catering_prompt: option.catering_prompt || "", catering_display_type: option.catering_display_type || "pills", catering_is_required: option.catering_is_required || false, catering_min_selections: String(option.catering_min_selections || 0), catering_max_selections: String(option.catering_max_selections || 1), choices: (option.choices || []).map((c: any) => ({ id: c.id, catering_name: c.catering_name, catering_price_modifier: String(c.catering_price_modifier || 0) })) }); setShowOptionForm(true) }}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteOption(option.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(option.choices || []).map((choice: any) => (
                        <span key={choice.id} className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                          {choice.catering_name}{choice.catering_price_modifier > 0 && ` (+$${Number(choice.catering_price_modifier).toFixed(2)})`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={() => { loadAvailableOptions(); setShowBrowseOptions(true) }}>Copiar Opciones de Otro Item</Button>
            {showOptionForm ? (
              <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{editingOption ? "Editar Opción" : "Nueva Opci���n"}</p>
                  <Button variant="ghost" size="sm" onClick={() => { setShowOptionForm(false); setEditingOption(null) }}>Cancelar</Button>
                </div>
                <div><Label className="text-xs">Nombre del Grupo *</Label><Input placeholder="Ej: Como los desea" value={optionForm.catering_name} onChange={(e) => setOptionForm((f) => ({ ...f, catering_name: e.target.value }))} /></div>
                <div><Label className="text-xs">Texto de Ayuda</Label><Input placeholder="Ej: Selecciona una opción" value={optionForm.catering_prompt} onChange={(e) => setOptionForm((f) => ({ ...f, catering_prompt: e.target.value }))} /></div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Tipo de Display</Label>
                    <Select value={optionForm.catering_display_type} onValueChange={(v) => setOptionForm((f) => ({ ...f, catering_display_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pills">Pills</SelectItem>
                        <SelectItem value="dropdown">Dropdown</SelectItem>
                        <SelectItem value="list">Lista</SelectItem>
                        <SelectItem value="grid">Grid</SelectItem>
                        <SelectItem value="counter">Contador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Min Selecciones</Label><Input type="number" value={optionForm.catering_min_selections} onChange={(e) => setOptionForm((f) => ({ ...f, catering_min_selections: e.target.value }))} /></div>
                  <div><Label className="text-xs">Max Selecciones</Label><Input type="number" value={optionForm.catering_max_selections} onChange={(e) => setOptionForm((f) => ({ ...f, catering_max_selections: e.target.value }))} /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={optionForm.catering_is_required} onCheckedChange={(v) => setOptionForm((f) => ({ ...f, catering_is_required: v }))} /><Label className="text-sm">Requerido</Label></div>
                <div>
                  <Label className="text-xs font-semibold">Opciones de Selección</Label>
                  <div className="space-y-2 mt-1">
                    {optionForm.choices.map((choice, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" disabled={idx === 0} onClick={() => { const c = [...optionForm.choices]; const [m] = c.splice(idx, 1); c.splice(idx - 1, 0, m); setOptionForm((f) => ({ ...f, choices: c })) }}><ChevronUp className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" disabled={idx === optionForm.choices.length - 1} onClick={() => { const c = [...optionForm.choices]; const [m] = c.splice(idx, 1); c.splice(idx + 1, 0, m); setOptionForm((f) => ({ ...f, choices: c })) }}><ChevronDown className="h-3 w-3" /></Button>
                        </div>
                        <Input placeholder="Nombre" className="flex-1" value={choice.catering_name} onChange={(e) => { const c = [...optionForm.choices]; c[idx] = { ...c[idx], catering_name: e.target.value }; setOptionForm((f) => ({ ...f, choices: c })) }} />
                        <Input type="number" step="0.01" placeholder="+$0.00" className="w-24" value={choice.catering_price_modifier} onChange={(e) => { const c = [...optionForm.choices]; c[idx] = { ...c[idx], catering_price_modifier: e.target.value }; setOptionForm((f) => ({ ...f, choices: c })) }} />
                        <Button variant="ghost" size="sm" className="h-9 px-2 text-red-500" onClick={() => setOptionForm((f) => ({ ...f, choices: f.choices.filter((_, i) => i !== idx) }))}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setOptionForm((f) => ({ ...f, choices: [...f.choices, { catering_name: "", catering_price_modifier: "0" }] }))}><Plus className="w-4 h-4 mr-1" /> Agregar Selección</Button>
                  </div>
                </div>
                <Button className="w-full text-white" onClick={handleSaveOption} disabled={loading} style={{ backgroundColor: primaryColor }}>{loading ? "Guardando..." : editingOption ? "Actualizar Opción" : "Guardar Opción"}</Button>
              </div>
            ) : (
              <Button onClick={() => { setEditingOption(null); setOptionForm({ catering_name: "", catering_prompt: "", catering_display_type: "pills", catering_is_required: false, catering_min_selections: "0", catering_max_selections: "1", choices: [] }); setShowOptionForm(true) }} className="w-full text-white" style={{ backgroundColor: primaryColor }}>
                <Plus className="w-4 h-4 mr-2" /> Nueva Opción
              </Button>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setShowOptionsModal(false); setShowOptionForm(false); setEditingOption(null) }}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBrowseOptions} onOpenChange={setShowBrowseOptions}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Copiar Opciones de Otro Item</DialogTitle><DialogDescription>Selecciona opciones para copiar a {optionsMenuItem?.name}</DialogDescription></DialogHeader>
          {loadingAvailableOptions ? <p className="text-center text-gray-400 py-8">Cargando...</p> :
            availableOptions.length === 0 ? <p className="text-center text-gray-400 py-8">No hay opciones disponibles en otros items</p> : (
              <div className="space-y-2">
                {availableOptions.map(({ option, menuItemName }) => (
                  <div key={option.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-sm">{option.catering_name}</p>
                      <p className="text-xs text-gray-500">{option.catering_is_required ? "Requerido" : "Opcional"} · {option.catering_display_type}</p>
                      <p className="text-xs text-gray-400">De: {menuItemName}</p>
                      {option.catering_item_option_choices && option.catering_item_option_choices.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {option.catering_item_option_choices.slice(0, 4).map((c: any) => <span key={c.id} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{c.catering_name}</span>)}
                          {option.catering_item_option_choices.length > 4 && <span className="text-xs text-gray-400">+{option.catering_item_option_choices.length - 4} más</span>}
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleCopyOption(option)} disabled={loading}>Copiar</Button>
                  </div>
                ))}
              </div>
            )}
          <DialogFooter><Button variant="outline" onClick={() => setShowBrowseOptions(false)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showZoneModal} onOpenChange={setShowZoneModal}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{editingZone ? "Editar Zona" : "Nueva Zona de Delivery"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre de la Zona *</Label><Input value={zoneForm.name} onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Zona Centro" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Distancia Mínima (millas)</Label><Input type="number" step="0.1" value={zoneForm.min_miles} onChange={(e) => setZoneForm((f) => ({ ...f, min_miles: e.target.value }))} /></div>
              <div><Label>Distancia Máxima (millas) *</Label><Input type="number" step="0.1" value={zoneForm.max_miles} onChange={(e) => setZoneForm((f) => ({ ...f, max_miles: e.target.value }))} /></div>
            </div>
            <div><Label>Tarifa de Delivery ($) *</Label><Input type="number" step="0.01" value={zoneForm.delivery_fee} onChange={(e) => setZoneForm((f) => ({ ...f, delivery_fee: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowZoneModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveZone} disabled={loading} className="text-white" style={{ backgroundColor: primaryColor }}>{loading ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
