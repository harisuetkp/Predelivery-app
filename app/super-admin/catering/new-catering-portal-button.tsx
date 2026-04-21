"use client"

import { useState, useTransition } from "react"
import { Plus, X, Loader2 } from "lucide-react"
import { createCateringPortal } from "./actions"

const CUISINE_TYPES = [
  "Americana", "Cubana", "Italiana", "Mexicana", "China",
  "Japonesa", "Puertorriqueña", "Mediterránea", "Francesa",
  "Española", "BBQ", "Mariscos", "Vegetariana", "Fusion", "Otra",
]

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") + "-catering"
}

export function NewCateringPortalButton() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [isChain, setIsChain] = useState(false)

  function handleNameChange(val: string) {
    setName(val)
    if (!slugEdited) setSlug(slugify(val))
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true)
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ""))
  }

  function handleClose() {
    setOpen(false)
    setError(null)
    setName("")
    setSlug("")
    setSlugEdited(false)
    setIsChain(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await createCateringPortal(formData)
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nuevo Portal
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">Nuevo Portal de Catering</h2>
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* Portal info */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Información del Portal
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del Restaurante *
                    </label>
                    <input
                      name="name"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Ej: Casa Cortés"
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL Slug *
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400 whitespace-nowrap">
                        /catering/
                      </span>
                      <input
                        name="slug"
                        value={slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        placeholder="casa-cortes-catering"
                        required
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Solo letras minúsculas, números y guiones
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Cocina
                      </label>
                      <select
                        name="cuisine_type"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Seleccionar...</option>
                        {CUISINE_TYPES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color Principal
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          name="primary_color"
                          defaultValue="#f97316"
                          className="h-9 w-14 rounded border cursor-pointer"
                        />
                        <span className="text-xs text-gray-400">Color de marca</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IVU (%)
                    </label>
                    <input
                      type="number"
                      name="tax_rate"
                      defaultValue="11.5"
                      step="0.1"
                      min="0"
                      max="30"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="is_chain"
                      name="is_chain"
                      value="true"
                      checked={isChain}
                      onChange={(e) => setIsChain(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-orange-500"
                    />
                    <div>
                      <label htmlFor="is_chain" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Restaurante con múltiples sucursales
                      </label>
                      <p className="text-xs text-gray-400">
                        Activa el selector de sucursales en el portal
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* First branch */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {isChain ? "Primera Sucursal" : "Ubicación"}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre de la Sucursal *
                    </label>
                    <input
                      name="branch_name"
                      defaultValue={isChain ? "" : name}
                      placeholder={isChain ? "Ej: Sucursal Santurce" : "Nombre de la ubicación"}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dirección
                      </label>
                      <input
                        name="branch_address"
                        placeholder="Calle Principal 123"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ciudad
                      </label>
                      <input
                        name="branch_city"
                        placeholder="San Juan"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      name="branch_phone"
                      placeholder="787-000-0000"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name || !slug}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear Portal"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
