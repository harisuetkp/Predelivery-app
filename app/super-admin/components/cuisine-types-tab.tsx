"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2, Upload, Loader2, ImageIcon } from "lucide-react"
import { fetchCuisineTypes, createCuisineType, updateCuisineType, deleteCuisineType } from "../actions"

interface CuisineType {
  id: string
  name: string
  icon_url: string | null
  display_order: number
  is_active: boolean
}

export function CuisineTypesTab() {
  const [cuisineTypes, setCuisineTypes] = useState<CuisineType[]>([])
  const [loading, setLoading] = useState(true)
  const [newCuisineName, setNewCuisineName] = useState("")
  const [addingCuisine, setAddingCuisine] = useState(false)
  
  // Edit modal state
  const [editingCuisine, setEditingCuisine] = useState<CuisineType | null>(null)
  const [editName, setEditName] = useState("")
  const [editIconUrl, setEditIconUrl] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Delete confirmation
  const [deletingCuisine, setDeletingCuisine] = useState<CuisineType | null>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setUploadError("Por favor selecciona una imagen válida")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("La imagen debe ser menor a 5MB")
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload-cuisine-icon", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Error al subir la imagen")
      }

      setEditIconUrl(result.url)
    } catch (error) {
      console.error("Upload error:", error)
      setUploadError(error instanceof Error ? error.message : "Error al subir la imagen")
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const loadCuisineTypes = async () => {
    setLoading(true)
    const result = await fetchCuisineTypes()
    if (result.success) {
      setCuisineTypes(result.cuisineTypes)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCuisineTypes()
  }, [])

  const handleAddCuisine = async () => {
    if (!newCuisineName.trim()) return
    setAddingCuisine(true)
    const result = await createCuisineType(newCuisineName.trim())
    if (result.success) {
      setNewCuisineName("")
      await loadCuisineTypes()
    }
    setAddingCuisine(false)
  }

  const handleOpenEdit = (cuisine: CuisineType) => {
    setEditingCuisine(cuisine)
    setEditName(cuisine.name)
    setEditIconUrl(cuisine.icon_url)
    setUploadError(null)
    setSaveError(null)
  }

  const handleSaveEdit = async () => {
    if (!editingCuisine) return
    
    setSavingEdit(true)
    setSaveError(null)
    
    try {
      const result = await updateCuisineType(editingCuisine.id, {
        name: editName,
        icon_url: editIconUrl,
      })
      
      if (result.success) {
        await loadCuisineTypes()
        setEditingCuisine(null)
      } else {
        // Show user-friendly error message
        if (result.error?.includes("duplicate key") || result.error?.includes("unique constraint")) {
          setSaveError("Ya existe un tipo de cocina con ese nombre")
        } else {
          setSaveError(result.error || "Error al guardar")
        }
      }
    } catch (error) {
      setSaveError("Error inesperado al guardar")
    }
    setSavingEdit(false)
  }

  const handleDelete = async () => {
    if (!deletingCuisine) return
    const result = await deleteCuisineType(deletingCuisine.id)
    if (result.success) {
      await loadCuisineTypes()
      setDeletingCuisine(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Add form */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Agregar Nuevo Tipo de Cocina</h3>
          <div className="flex gap-3">
            <Input
              placeholder="Nombre del tipo de cocina (ej: Peruana)"
              value={newCuisineName}
              onChange={(e) => setNewCuisineName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCuisine()}
              className="max-w-md"
            />
            <Button onClick={handleAddCuisine} disabled={addingCuisine || !newCuisineName.trim()}>
              {addingCuisine ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cuisine Types Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {cuisineTypes.map((cuisine) => (
          <Card key={cuisine.id} className="group relative overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              {/* Image preview */}
              <div className="aspect-square relative mb-3 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                {cuisine.icon_url ? (
                  <Image
                    src={cuisine.icon_url}
                    alt={cuisine.name}
                    fill
                    className="object-contain p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <ImageIcon className="h-12 w-12 mb-2" />
                    <span className="text-xs">Sin imagen</span>
                  </div>
                )}
              </div>
              
              {/* Name */}
              <h4 className="font-medium text-center text-sm truncate">{cuisine.name}</h4>
              
              {/* Action buttons - visible on hover */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleOpenEdit(cuisine)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeletingCuisine(cuisine)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {cuisineTypes.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No hay tipos de cocina definidos. Agrega el primero arriba.
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingCuisine} onOpenChange={(open) => !open && setEditingCuisine(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Tipo de Cocina</DialogTitle>
            <DialogDescription>
              Actualiza el nombre y la imagen del tipo de cocina.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nombre del tipo de cocina"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Imagen / Icono</Label>
              <div className="flex flex-col items-center gap-4">
                {/* Current image preview */}
                <div className="w-32 h-32 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                  {editIconUrl ? (
                    <Image
                      src={editIconUrl}
                      alt={editName}
                      width={128}
                      height={128}
                      className="object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-slate-400" />
                  )}
                </div>
                
                {/* Image upload */}
                <div className="w-full">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="cuisine-icon-upload"
                  />
                  <label
                    htmlFor="cuisine-icon-upload"
                    className={`flex items-center justify-center gap-2 w-full py-3 px-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      uploading
                        ? "border-slate-300 bg-slate-50 cursor-not-allowed"
                        : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                        <span className="text-sm text-slate-500">Subiendo...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-slate-500" />
                        <span className="text-sm text-slate-600">Seleccionar imagen</span>
                      </>
                    )}
                  </label>
                  {uploadError && (
                    <p className="text-sm text-red-500 mt-2 text-center">{uploadError}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-2 text-center">PNG, JPG o WebP. Max 5MB.</p>
                </div>
                
                {editIconUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditIconUrl(null)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Eliminar imagen
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {saveError && (
              <p className="text-sm text-red-500 w-full text-center sm:text-left sm:flex-1">{saveError}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingCuisine(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit || !editName.trim()}>
                {savingEdit && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingCuisine} onOpenChange={(open) => !open && setDeletingCuisine(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Tipo de Cocina</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar "{deletingCuisine?.name}"? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingCuisine(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
