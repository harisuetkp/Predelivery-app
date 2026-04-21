"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Monitor, 
  ExternalLink, 
  Search, 
  Copy, 
  Check, 
  RefreshCw,
  Key,
  Building2,
  Eye,
  Settings,
  Download,
  Truck,
  UtensilsCrossed
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

// Tent filter type
type TentFilter = "todos" | "online" | "catering"

interface Restaurant {
  id: string
  name: string
  slug: string
  logo_url: string | null
  kds_access_token: string | null
  kds_setup_code: string | null
  is_active: boolean
}

interface Branch {
  id: string
  name: string
  restaurant_id: string
  kds_access_token: string | null
  kds_setup_code: string | null
}

// Catering restaurants share KDS with their linked delivery restaurant
// They do NOT have their own KDS tokens
interface CateringRestaurant {
  id: string
  name: string
  slug: string
  logo_url: string | null
  is_active: boolean
  is_chain: boolean
  restaurant_id: string | null // Links to delivery restaurant for shared KDS
}

interface CateringBranch {
  id: string
  catering_restaurant_id: string
  name: string
  city: string | null
  is_active: boolean
}

// Unified card item for catering display (either restaurant or branch)
interface CateringCardItem {
  id: string
  displayName: string // "Restaurant Name" or "Restaurant Name - Branch Name"
  cateringRestaurant: CateringRestaurant
  branch: CateringBranch | null // null for non-chain restaurants
  linkedDeliveryRestaurant: Restaurant | null
}

export function KDSTab() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [cateringRestaurants, setCateringRestaurants] = useState<CateringRestaurant[]>([])
  const [cateringBranches, setCateringBranches] = useState<CateringBranch[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [generatingToken, setGeneratingToken] = useState<string | null>(null)
  const [tentFilter, setTentFilter] = useState<TentFilter>("todos")

  useEffect(() => {
    fetchRestaurants()
  }, [])

  const fetchRestaurants = async () => {
    setLoading(true)
    const supabase = createClient()
    
    // Fetch delivery restaurants
    const { data: restaurantsData } = await supabase
      .from("restaurants")
      .select("id, name, slug, logo_url, kds_access_token, kds_setup_code, is_active")
      .order("name")
    
    const { data: branchesData } = await supabase
      .from("branches")
      .select("id, name, restaurant_id, kds_access_token, kds_setup_code")
      .order("name")
    
    // Fetch catering restaurants (no KDS token columns - they share delivery restaurant's KDS)
    const { data: cateringRestaurantsData } = await supabase
      .from("catering_restaurants")
      .select("id, name, slug, logo_url, is_active, is_chain, restaurant_id")
      .order("name")
    
    // Fetch catering branches for chain restaurants
    const { data: cateringBranchesData } = await supabase
      .from("catering_branches")
      .select("id, catering_restaurant_id, name, city, is_active")
      .order("name")
    
    setRestaurants(restaurantsData || [])
    setBranches(branchesData || [])
    setCateringRestaurants(cateringRestaurantsData || [])
    setCateringBranches(cateringBranchesData || [])
    setLoading(false)
  }

  // Generate a short 6-character alphanumeric code (uppercase, easy to type)
  const generateSetupCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Avoid confusing chars like 0/O, 1/I/L
    let code = ""
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // Token generation ONLY for delivery restaurants - catering shares delivery restaurant's KDS
  const generateToken = async (restaurantId: string, branchId?: string) => {
    const tokenKey = branchId || restaurantId
    setGeneratingToken(tokenKey)
    
    const supabase = createClient()
    const newToken = crypto.randomUUID().replace(/-/g, "").substring(0, 24)
    const newSetupCode = generateSetupCode()
    
    if (branchId) {
      await supabase
        .from("branches")
        .update({ kds_access_token: newToken, kds_setup_code: newSetupCode })
        .eq("id", branchId)
    } else {
      await supabase
        .from("restaurants")
        .update({ kds_access_token: newToken, kds_setup_code: newSetupCode })
        .eq("id", restaurantId)
    }
    
    await fetchRestaurants()
    setGeneratingToken(null)
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedToken(id)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const getKDSUrl = (slug: string, token?: string | null, branchId?: string) => {
    let url = `/${slug}/kds`
    const params = new URLSearchParams()
    if (branchId) params.append("branch", branchId)
    if (token) params.append("token", token)
    if (params.toString()) url += `?${params.toString()}`
    return url
  }

  // Find matching delivery restaurant for catering
  // For chains with branches: match by restaurant name + branch name/city
  // For non-chains: match by restaurant name or direct restaurant_id link
  const findMatchingDeliveryRestaurant = (
    cateringRestaurant: CateringRestaurant, 
    branch: CateringBranch | null
  ): Restaurant | null => {
    // First, check direct restaurant_id link (most reliable)
    if (cateringRestaurant.restaurant_id) {
      return restaurants.find(r => r.id === cateringRestaurant.restaurant_id) || null
    }
    
    const cateringNameLower = cateringRestaurant.name.toLowerCase()
    
    // For chain branches, try to match by restaurant name + branch name/city
    if (branch) {
      const branchNameLower = branch.name.toLowerCase()
      const branchCityLower = branch.city?.toLowerCase() || ""
      
      // Try matching: delivery restaurant name contains both catering restaurant name AND branch name/city
      // e.g. "Metropol Guaynabo" should match catering "Metropol" branch "Guaynabo"
      const match = restaurants.find(r => {
        const deliveryNameLower = r.name.toLowerCase()
        return (
          deliveryNameLower.includes(cateringNameLower) && 
          (deliveryNameLower.includes(branchNameLower) || deliveryNameLower.includes(branchCityLower))
        )
      })
      if (match) return match
      
      // Try exact match with combined name
      const combinedName = `${cateringNameLower} ${branchNameLower}`
      const exactMatch = restaurants.find(r => 
        r.name.toLowerCase() === combinedName || 
        r.name.toLowerCase() === `${cateringNameLower} - ${branchNameLower}`
      )
      if (exactMatch) return exactMatch
    }
    
    // Fallback: try matching by exact name (for non-chains)
    return restaurants.find(r => 
      r.name.toLowerCase() === cateringNameLower
    ) || null
  }

  // Build unified list of catering card items
  // For chains: one card per branch
  // For non-chains: one card per restaurant
  const buildCateringCardItems = (): CateringCardItem[] => {
    const items: CateringCardItem[] = []
    
    filteredCateringRestaurants.forEach(cateringRestaurant => {
      if (cateringRestaurant.is_chain) {
        // For chains: create one card per branch
        const branchesForRestaurant = cateringBranches.filter(
          b => b.catering_restaurant_id === cateringRestaurant.id
        )
        
        if (branchesForRestaurant.length === 0) {
          // Chain with no branches - show as single card with warning
          items.push({
            id: `catering-${cateringRestaurant.id}`,
            displayName: `${cateringRestaurant.name} (sin sucursales)`,
            cateringRestaurant,
            branch: null,
            linkedDeliveryRestaurant: findMatchingDeliveryRestaurant(cateringRestaurant, null)
          })
        } else {
          branchesForRestaurant.forEach(branch => {
            items.push({
              id: `catering-branch-${branch.id}`,
              displayName: `${cateringRestaurant.name} - ${branch.name}`,
              cateringRestaurant,
              branch,
              linkedDeliveryRestaurant: findMatchingDeliveryRestaurant(cateringRestaurant, branch)
            })
          })
        }
      } else {
        // For non-chains: one card per restaurant
        items.push({
          id: `catering-${cateringRestaurant.id}`,
          displayName: cateringRestaurant.name,
          cateringRestaurant,
          branch: null,
          linkedDeliveryRestaurant: findMatchingDeliveryRestaurant(cateringRestaurant, null)
        })
      }
    })
    
    return items
  }

  const exportToCSV = () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    
    // Build CSV data - include both setup code (for typing) and full URL (for reference)
    const rows: string[][] = [
      ["Restaurante", "Codigo", "Slug", "URL Completa", "Tipo"]
    ]
    
    restaurants.forEach((restaurant) => {
      if (restaurant.kds_setup_code) {
        const url = `${baseUrl}${getKDSUrl(restaurant.slug, restaurant.kds_access_token)}`
        rows.push([
          restaurant.name,
          restaurant.kds_setup_code,
          restaurant.slug,
          url,
          "KDS Principal"
        ])
      }
      
      // Add branches
      const restaurantBranches = branches.filter(b => b.restaurant_id === restaurant.id)
      restaurantBranches.forEach((branch) => {
        if (branch.kds_setup_code) {
          const url = `${baseUrl}${getKDSUrl(restaurant.slug, branch.kds_access_token, branch.id)}`
          rows.push([
            `${restaurant.name} - ${branch.name}`,
            branch.kds_setup_code,
            restaurant.slug,
            url,
            "Sucursal"
          ])
        }
      })
    })
    
    // Convert to CSV string
    const csvContent = rows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")
    ).join("\n")
    
    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `kds-tokens-${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const filteredRestaurants = restaurants.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Filter catering restaurants - also search branch names for chains
  const filteredCateringRestaurants = cateringRestaurants.filter(r => {
    const searchLower = searchQuery.toLowerCase()
    const nameMatch = r.name.toLowerCase().includes(searchLower)
    const slugMatch = r.slug.toLowerCase().includes(searchLower)
    
    // For chains, also check if any branch matches
    if (r.is_chain) {
      const branchMatch = cateringBranches.some(
        b => b.catering_restaurant_id === r.id && 
        (b.name.toLowerCase().includes(searchLower) || 
         b.city?.toLowerCase().includes(searchLower))
      )
      return nameMatch || slugMatch || branchMatch
    }
    
    return nameMatch || slugMatch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Monitor className="h-6 w-6" />
            Kitchen Display System (KDS)
          </h2>
          <p className="text-slate-500 mt-1">
            Accede y configura el KDS de cada restaurante. Genera tokens de acceso para tablets.
          </p>
          <p className="text-sm text-slate-400 mt-1">
            En la tablet, visita <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">prdelivery.com/setup</span> e ingresa el código de 6 caracteres.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={fetchRestaurants}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refrescar
          </Button>
        </div>
      </div>

      {/* Tent Toggle */}
      <div className="flex items-center gap-4">
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setTentFilter("todos")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tentFilter === "todos"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setTentFilter("online")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              tentFilter === "online"
                ? "bg-blue-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Truck className="h-4 w-4" />
            Online Ordering
          </button>
          <button
            onClick={() => setTentFilter("catering")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              tentFilter === "catering"
                ? "bg-orange-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <UtensilsCrossed className="h-4 w-4" />
            Catering
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar restaurante..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Restaurant Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Online Ordering / Delivery Restaurants */}
        {(tentFilter === "todos" || tentFilter === "online") && filteredRestaurants.map((restaurant) => {
          const restaurantBranches = branches.filter(b => b.restaurant_id === restaurant.id)
          const kdsUrl = getKDSUrl(restaurant.slug, restaurant.kds_access_token)
          
          return (
            <Card key={restaurant.id} className={!restaurant.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {restaurant.logo_url ? (
                      <img 
                        src={restaurant.logo_url} 
                        alt={restaurant.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-slate-400" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base">{restaurant.name}</CardTitle>
                      <CardDescription className="text-xs">/{restaurant.slug}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {tentFilter === "todos" && (
                      <Badge className="text-xs bg-blue-500 hover:bg-blue-500">ONLINE</Badge>
                    )}
                    {!restaurant.is_active && (
                      <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Setup Code - Main display */}
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500 flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    Código de Configuración
                  </Label>
                  {restaurant.kds_setup_code ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-lg px-4 py-3 text-center">
                        <span className="text-2xl font-mono font-bold tracking-[0.2em] text-slate-800">
                          {restaurant.kds_setup_code}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => copyToClipboard(restaurant.kds_setup_code!, `code-${restaurant.id}`)}
                      >
                        {copiedToken === `code-${restaurant.id}` ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg px-4 py-3 text-center text-slate-400 text-sm">
                      Sin código - genera uno abajo
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => generateToken(restaurant.id)}
                      disabled={generatingToken === restaurant.id}
                    >
                      {generatingToken === restaurant.id ? (
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Key className="h-3 w-3 mr-1" />
                      )}
                      {restaurant.kds_setup_code ? "Regenerar" : "Generar"} Código
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 text-xs"
                      asChild
                    >
                      <Link href={kdsUrl} target="_blank">
                        <Eye className="h-3 w-3 mr-1" />
                        Abrir KDS
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>



                {/* Branches */}
                {restaurantBranches.length > 0 && (
                  <div className="pt-3 border-t space-y-2">
                    <Label className="text-xs text-slate-500">Sucursales</Label>
                    {restaurantBranches.map((branch) => {
                      const branchKdsUrl = getKDSUrl(restaurant.slug, branch.kds_access_token, branch.id)
                      return (
                        <div key={branch.id} className="p-2 bg-slate-50 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{branch.name}</span>
                            <div className="flex items-center gap-1">
                              {branch.kds_setup_code && (
                                <span className="font-mono font-bold text-sm tracking-wider bg-white px-2 py-0.5 rounded">
                                  {branch.kds_setup_code}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                asChild
                              >
                                <Link href={branchKdsUrl} target="_blank">
                                  <Eye className="h-3 w-3 mr-1" />
                                  KDS
                                </Link>
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-7 text-xs"
                              onClick={() => generateToken(restaurant.id, branch.id)}
                              disabled={generatingToken === branch.id}
                            >
                              {generatingToken === branch.id ? (
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Key className="h-3 w-3 mr-1" />
                              )}
                              {branch.kds_setup_code ? "Regenerar" : "Generar"} Código
                            </Button>
                            {branch.kds_setup_code && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => copyToClipboard(branch.kds_setup_code!, `code-${branch.id}`)}
                              >
                                {copiedToken === `code-${branch.id}` ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
})}

        {/* Catering Cards - READ ONLY - they share delivery restaurant's KDS */}
        {/* For chains: one card per branch. For non-chains: one card per restaurant */}
        {(tentFilter === "todos" || tentFilter === "catering") && buildCateringCardItems().map((item) => {
          const { cateringRestaurant, branch, linkedDeliveryRestaurant } = item
          const kdsUrl = linkedDeliveryRestaurant 
            ? getKDSUrl(linkedDeliveryRestaurant.slug, linkedDeliveryRestaurant.kds_access_token)
            : null
          const isActive = cateringRestaurant.is_active && (branch ? branch.is_active : true)
          
          return (
            <Card key={item.id} className={!isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {cateringRestaurant.logo_url ? (
                      <img 
                        src={cateringRestaurant.logo_url} 
                        alt={cateringRestaurant.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                        <UtensilsCrossed className="h-5 w-5 text-orange-500" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base">{item.displayName}</CardTitle>
                      <CardDescription className="text-xs">
                        /catering/{cateringRestaurant.slug}
                        {branch && <span className="text-orange-500"> (sucursal)</span>}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {tentFilter === "todos" && (
                      <Badge className="text-xs bg-orange-500 hover:bg-orange-500">CATERING</Badge>
                    )}
                    {!isActive && (
                      <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Linked Delivery Restaurant Info */}
                {linkedDeliveryRestaurant ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <Label className="text-xs text-blue-600 font-medium">Usa el KDS de:</Label>
                      <div className="flex items-center gap-2 mt-1">
                        {linkedDeliveryRestaurant.logo_url ? (
                          <img 
                            src={linkedDeliveryRestaurant.logo_url} 
                            alt={linkedDeliveryRestaurant.name}
                            className="w-6 h-6 rounded object-cover"
                          />
                        ) : (
                          <Building2 className="h-5 w-5 text-blue-500" />
                        )}
                        <span className="font-medium text-blue-900">{linkedDeliveryRestaurant.name}</span>
                      </div>
                    </div>

                    {/* Show linked restaurant's setup code (read-only) */}
                    {linkedDeliveryRestaurant.kds_setup_code && (
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-500 flex items-center gap-1">
                          <Key className="h-3 w-3" />
                          Código de Configuración (compartido)
                        </Label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-lg px-4 py-3 text-center">
                            <span className="text-2xl font-mono font-bold tracking-[0.2em] text-slate-600">
                              {linkedDeliveryRestaurant.kds_setup_code}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => copyToClipboard(linkedDeliveryRestaurant.kds_setup_code!, `code-linked-${item.id}`)}
                          >
                            {copiedToken === `code-linked-${item.id}` ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Open KDS button */}
                    {kdsUrl && (
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full text-xs bg-orange-500 hover:bg-orange-600"
                        asChild
                      >
                        <Link href={kdsUrl} target="_blank">
                          <Eye className="h-3 w-3 mr-1" />
                          Abrir KDS
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    )}

                    <p className="text-xs text-slate-400 text-center">
                      Las órdenes de catering aparecen en el KDS del restaurante vinculado
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
                    <p className="text-sm text-amber-800">
                      Sin KDS vinculado
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      Para recibir órdenes en el KDS, el nombre del restaurante de catering debe coincidir con un restaurante de delivery
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
      
      {/* Empty State */}
      {((tentFilter === "online" || tentFilter === "todos") && filteredRestaurants.length === 0) && 
       ((tentFilter === "catering" || tentFilter === "todos") && filteredCateringRestaurants.length === 0) && (
        <div className="text-center py-12 text-slate-500">
          No se encontraron restaurantes
        </div>
      )}
    </div>
  )
}
