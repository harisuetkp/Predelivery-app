"use client"

import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, Loader2, MapPin, GripVertical, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"

interface ServiceArea {
  id: string
  zip_code: string
  area_name: string
  default_address: string | null
  is_active: boolean
  display_order: number
  delivery_fee_override: number | null
  min_order_override: number | null
}

export function ServiceAreasTab() {
  const [areas, setAreas] = useState<ServiceArea[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingArea, setEditingArea] = useState<ServiceArea | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form states
  const [formData, setFormData] = useState({
    zip_code: "",
    area_name: "",
    default_address: "",
    is_active: true,
    delivery_fee_override: "",
    min_order_override: "",
  })

  const supabase = createClient()

  // Fetch service areas
  const fetchAreas = async () => {
    setIsLoading(true)
    setError(null)
    
    const { data, error } = await supabase
      .from("service_areas")
      .select("*")
      .order("zip_code", { ascending: true })
    
    if (error) {
      console.error("Error fetching service areas:", error)
      setError("Failed to load service areas")
    } else {
      setAreas(data || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchAreas()
  }, [])

  // Add new area
  const handleAdd = async () => {
    if (!formData.zip_code || !formData.area_name) {
      setError("Zip code and area name are required")
      return
    }

    setIsSaving(true)
    setError(null)

    const newOrder = areas.length > 0 ? Math.max(...areas.map(a => a.display_order)) + 1 : 1

    const { error } = await supabase.from("service_areas").insert({
      zip_code: formData.zip_code,
      area_name: formData.area_name,
      default_address: formData.default_address || null,
      is_active: formData.is_active,
      display_order: newOrder,
      delivery_fee_override: formData.delivery_fee_override ? parseFloat(formData.delivery_fee_override) : null,
      min_order_override: formData.min_order_override ? parseFloat(formData.min_order_override) : null,
    })

    if (error) {
      console.error("Error adding service area:", error)
      setError(error.message.includes("duplicate") ? "This zip code already exists" : "Failed to add service area")
    } else {
      setShowAddModal(false)
      resetForm()
      fetchAreas()
    }
    setIsSaving(false)
  }

  // Update area
  const handleUpdate = async () => {
    if (!editingArea || !formData.zip_code || !formData.area_name) {
      setError("Zip code and area name are required")
      return
    }

    setIsSaving(true)
    setError(null)

    const { error } = await supabase
      .from("service_areas")
      .update({
        zip_code: formData.zip_code,
        area_name: formData.area_name,
        default_address: formData.default_address || null,
        is_active: formData.is_active,
        delivery_fee_override: formData.delivery_fee_override ? parseFloat(formData.delivery_fee_override) : null,
        min_order_override: formData.min_order_override ? parseFloat(formData.min_order_override) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingArea.id)

    if (error) {
      console.error("Error updating service area:", error)
      setError("Failed to update service area")
    } else {
      setShowEditModal(false)
      setEditingArea(null)
      resetForm()
      fetchAreas()
    }
    setIsSaving(false)
  }

  // Delete area
  const handleDelete = async (area: ServiceArea) => {
    if (!confirm(`Are you sure you want to delete ${area.zip_code} - ${area.area_name}?`)) {
      return
    }

    const { error } = await supabase
      .from("service_areas")
      .delete()
      .eq("id", area.id)

    if (error) {
      console.error("Error deleting service area:", error)
      setError("Failed to delete service area")
    } else {
      fetchAreas()
    }
  }

  // Toggle active status
  const handleToggleActive = async (area: ServiceArea) => {
    const { error } = await supabase
      .from("service_areas")
      .update({ is_active: !area.is_active, updated_at: new Date().toISOString() })
      .eq("id", area.id)

    if (error) {
      console.error("Error toggling service area:", error)
      setError("Failed to update service area")
    } else {
      setAreas(prev => prev.map(a => 
        a.id === area.id ? { ...a, is_active: !a.is_active } : a
      ))
    }
  }

  // Open edit modal
  const openEditModal = (area: ServiceArea) => {
    setEditingArea(area)
    setFormData({
      zip_code: area.zip_code,
      area_name: area.area_name,
      default_address: area.default_address || "",
      is_active: area.is_active,
      delivery_fee_override: area.delivery_fee_override?.toString() || "",
      min_order_override: area.min_order_override?.toString() || "",
    })
    setShowEditModal(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      zip_code: "",
      area_name: "",
      default_address: "",
      is_active: true,
      delivery_fee_override: "",
      min_order_override: "",
    })
    setError(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Service Areas (Zip Codes)
            </CardTitle>
            <CardDescription>
              Manage the zip codes available for delivery. These appear in the location dropdown on the navigation bar.
            </CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setShowAddModal(true) }} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Zip Code
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Zip Code</TableHead>
                <TableHead>Area Name</TableHead>
                <TableHead>Default Address</TableHead>
                <TableHead className="w-[80px] text-center">Active</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No service areas configured. Add your first zip code to get started.
                  </TableCell>
                </TableRow>
              ) : (
                areas.map((area) => (
                  <TableRow key={area.id}>
                    <TableCell className="font-mono font-medium">{area.zip_code}</TableCell>
                    <TableCell>{area.area_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-slate-600">
                      {area.default_address || <span className="text-slate-400 italic">Not set</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={area.is_active}
                        onCheckedChange={() => handleToggleActive(area)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(area)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(area)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Service Area</DialogTitle>
            <DialogDescription>
              Add a new zip code to enable delivery service in that area.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zip_code">Zip Code *</Label>
                <Input
                  id="zip_code"
                  placeholder="00920"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area_name">Area Name *</Label>
                <Input
                  id="area_name"
                  placeholder="Río Piedras"
                  value={formData.area_name}
                  onChange={(e) => setFormData({ ...formData, area_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_address">Default Address</Label>
              <Input
                id="default_address"
                placeholder="Río Piedras, PR 00920"
                value={formData.default_address}
                onChange={(e) => setFormData({ ...formData, default_address: e.target.value })}
              />
              <p className="text-xs text-slate-500">
                This address will display in the location bar when this zip code is selected.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delivery_fee">Delivery Fee Override</Label>
                <Input
                  id="delivery_fee"
                  type="number"
                  step="0.01"
                  placeholder="Leave empty for default"
                  value={formData.delivery_fee_override}
                  onChange={(e) => setFormData({ ...formData, delivery_fee_override: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_order">Min Order Override</Label>
                <Input
                  id="min_order"
                  type="number"
                  step="0.01"
                  placeholder="Leave empty for default"
                  value={formData.min_order_override}
                  onChange={(e) => setFormData({ ...formData, min_order_override: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active (available for delivery)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Service Area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service Area</DialogTitle>
            <DialogDescription>
              Update the zip code settings.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_zip_code">Zip Code *</Label>
                <Input
                  id="edit_zip_code"
                  placeholder="00920"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_area_name">Area Name *</Label>
                <Input
                  id="edit_area_name"
                  placeholder="Río Piedras"
                  value={formData.area_name}
                  onChange={(e) => setFormData({ ...formData, area_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_default_address">Default Address</Label>
              <Input
                id="edit_default_address"
                placeholder="Río Piedras, PR 00920"
                value={formData.default_address}
                onChange={(e) => setFormData({ ...formData, default_address: e.target.value })}
              />
              <p className="text-xs text-slate-500">
                This address will display in the location bar when this zip code is selected.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_delivery_fee">Delivery Fee Override</Label>
                <Input
                  id="edit_delivery_fee"
                  type="number"
                  step="0.01"
                  placeholder="Leave empty for default"
                  value={formData.delivery_fee_override}
                  onChange={(e) => setFormData({ ...formData, delivery_fee_override: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_min_order">Min Order Override</Label>
                <Input
                  id="edit_min_order"
                  type="number"
                  step="0.01"
                  placeholder="Leave empty for default"
                  value={formData.min_order_override}
                  onChange={(e) => setFormData({ ...formData, min_order_override: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="edit_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="edit_is_active">Active (available for delivery)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
