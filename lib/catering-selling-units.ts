export interface CateringSellingUnit {
  key: string
  adminLabel: string
  adminDescription: string
  priceSingular: string
  pricePlural: string
  qtySingular: string
  qtyPlural: string
  cardSingular: string
  cardPlural: string
  quantityUnit: string
}

export const CATERING_SELLING_UNITS: CateringSellingUnit[] = [
  {
    key: "each",
    adminLabel: "Each (standard item)",
    adminDescription: "Standard individual item. Price is per unit.",
    priceSingular: "/ unidad",
    pricePlural: "/ unidades",
    qtySingular: "unidad",
    qtyPlural: "unidades",
    cardSingular: "unidad",
    cardPlural: "unidades",
    quantityUnit: "unit",
  },
  {
    key: "tray",
    adminLabel: "Tray / Bandeja (serves multiple people)",
    adminDescription: "Sold by the tray. Each tray serves multiple people.",
    priceSingular: "/ bandeja",
    pricePlural: "/ bandejas",
    qtySingular: "bandeja",
    qtyPlural: "bandejas",
    cardSingular: "bandeja",
    cardPlural: "bandejas",
    quantityUnit: "tray",
  },
  {
    key: "half_tray",
    adminLabel: "Half Tray / Bandejita",
    adminDescription: "Sold by the half tray.",
    priceSingular: "/ bandejita",
    pricePlural: "/ bandejitas",
    qtySingular: "bandejita",
    qtyPlural: "bandejitas",
    cardSingular: "bandejita",
    cardPlural: "bandejitas",
    quantityUnit: "half_tray",
  },
  {
    key: "bowl",
    adminLabel: "Bowl",
    adminDescription: "Sold by the bowl.",
    priceSingular: "/ bowl",
    pricePlural: "/ bowls",
    qtySingular: "bowl",
    qtyPlural: "bowls",
    cardSingular: "bowl",
    cardPlural: "bowls",
    quantityUnit: "bowl",
  },
  {
    key: "bowl_8oz",
    adminLabel: "Bowl 8oz",
    adminDescription: "Sold by the 8oz bowl.",
    priceSingular: "/ bowl 8oz",
    pricePlural: "/ bowls 8oz",
    qtySingular: "bowl 8oz",
    qtyPlural: "bowls 8oz",
    cardSingular: "bowl 8oz",
    cardPlural: "bowls 8oz",
    quantityUnit: "bowl_8oz",
  },
  {
    key: "bowl_16oz",
    adminLabel: "Bowl 16oz",
    adminDescription: "Sold by the 16oz bowl.",
    priceSingular: "/ bowl 16oz",
    pricePlural: "/ bowls 16oz",
    qtySingular: "bowl 16oz",
    qtyPlural: "bowls 16oz",
    cardSingular: "bowl 16oz",
    cardPlural: "bowls 16oz",
    quantityUnit: "bowl_16oz",
  },
  {
    key: "bowl_32oz",
    adminLabel: "Bowl 32oz",
    adminDescription: "Sold by the 32oz bowl.",
    priceSingular: "/ bowl 32oz",
    pricePlural: "/ bowls 32oz",
    qtySingular: "bowl 32oz",
    qtyPlural: "bowls 32oz",
    cardSingular: "bowl 32oz",
    cardPlural: "bowls 32oz",
    quantityUnit: "bowl_32oz",
  },
  {
    key: "bowl_64oz",
    adminLabel: "Bowl 64oz",
    adminDescription: "Sold by the 64oz bowl.",
    priceSingular: "/ bowl 64oz",
    pricePlural: "/ bowls 64oz",
    qtySingular: "bowl 64oz",
    qtyPlural: "bowls 64oz",
    cardSingular: "bowl 64oz",
    cardPlural: "bowls 64oz",
    quantityUnit: "bowl_64oz",
  },
  {
    key: "botella_750ml",
    adminLabel: "Botella 750ml",
    adminDescription: "Sold by the 750ml bottle.",
    priceSingular: "/ botella 750ml",
    pricePlural: "/ botellas 750ml",
    qtySingular: "botella 750ml",
    qtyPlural: "botellas 750ml",
    cardSingular: "botella 750ml",
    cardPlural: "botellas 750ml",
    quantityUnit: "botella_750ml",
  },
  {
    key: "bottle_750ml",
    adminLabel: "Bottle 750ml",
    adminDescription: "Sold by the 750ml bottle.",
    priceSingular: "/ botella 750ml",
    pricePlural: "/ botellas 750ml",
    qtySingular: "botella 750ml",
    qtyPlural: "botellas 750ml",
    cardSingular: "botella 750ml",
    cardPlural: "botellas 750ml",
    quantityUnit: "bottle_750ml",
  },
  {
    key: "gallon",
    adminLabel: "Gallon / Galon",
    adminDescription: "Sold by the gallon.",
    priceSingular: "/ galon",
    pricePlural: "/ galones",
    qtySingular: "galon",
    qtyPlural: "galones",
    cardSingular: "galon",
    cardPlural: "galones",
    quantityUnit: "gallon",
  },
  {
    key: "half_gallon",
    adminLabel: "Half Gallon / Medio Galon",
    adminDescription: "Sold by the half gallon.",
    priceSingular: "/ medio galon",
    pricePlural: "/ medios galones",
    qtySingular: "medio galon",
    qtyPlural: "medios galones",
    cardSingular: "medio galon",
    cardPlural: "medios galones",
    quantityUnit: "half_gallon",
  },
  {
    key: "liter",
    adminLabel: "Liter / Litro",
    adminDescription: "Sold by the liter.",
    priceSingular: "/ litro",
    pricePlural: "/ litros",
    qtySingular: "litro",
    qtyPlural: "litros",
    cardSingular: "litro",
    cardPlural: "litros",
    quantityUnit: "liter",
  },
  {
    key: "pound",
    adminLabel: "Per Pound / Por Libra (sold by weight)",
    adminDescription: "Sold by the pound.",
    priceSingular: "/ libra",
    pricePlural: "/ libras",
    qtySingular: "libra",
    qtyPlural: "libras",
    cardSingular: "libra",
    cardPlural: "libras",
    quantityUnit: "pound",
  },
  {
    key: "per_pound",
    adminLabel: "Per Pound / Por Libra (alias)",
    adminDescription: "Sold by the pound.",
    priceSingular: "/ libra",
    pricePlural: "/ libras",
    qtySingular: "libra",
    qtyPlural: "libras",
    cardSingular: "por libra",
    cardPlural: "por libra",
    quantityUnit: "per_pound",
  },
  {
    key: "person",
    adminLabel: "Per Person / Por Persona (priced per guest)",
    adminDescription: "Priced per person attending.",
    priceSingular: "/ persona",
    pricePlural: "/ personas",
    qtySingular: "persona",
    qtyPlural: "personas",
    cardSingular: "persona",
    cardPlural: "personas",
    quantityUnit: "person",
  },
  {
    key: "per_person",
    adminLabel: "Per Person / Por Persona (alias)",
    adminDescription: "Priced per person attending.",
    priceSingular: "/ persona",
    pricePlural: "/ personas",
    qtySingular: "persona",
    qtyPlural: "personas",
    cardSingular: "persona",
    cardPlural: "personas",
    quantityUnit: "per_person",
  },
  {
    key: "cena_completa",
    adminLabel: "Cena Completa (combo / full dinner)",
    adminDescription: "Full dinner combo.",
    priceSingular: "/ cena",
    pricePlural: "/ cenas",
    qtySingular: "cena",
    qtyPlural: "cenas",
    cardSingular: "cena",
    cardPlural: "cenas",
    quantityUnit: "cena_completa",
  },
  {
    key: "box",
    adminLabel: "Box (boxed portions)",
    adminDescription: "Sold by the box.",
    priceSingular: "/ caja",
    pricePlural: "/ cajas",
    qtySingular: "caja",
    qtyPlural: "cajas",
    cardSingular: "caja",
    cardPlural: "cajas",
    quantityUnit: "box",
  },
  {
    key: "boxed_lunch",
    adminLabel: "Boxed Lunch (individual meals)",
    adminDescription: "Individual boxed lunch.",
    priceSingular: "/ boxed lunch",
    pricePlural: "/ boxed lunches",
    qtySingular: "boxed lunch",
    qtyPlural: "boxed lunches",
    cardSingular: "boxed lunch",
    cardPlural: "boxed lunches",
    quantityUnit: "boxed_lunch",
  },
  {
    key: "paquete",
    adminLabel: "Paquete",
    adminDescription: "Sold by the package.",
    priceSingular: "/ paquete",
    pricePlural: "/ paquetes",
    qtySingular: "paquete",
    qtyPlural: "paquetes",
    cardSingular: "paquete",
    cardPlural: "paquetes",
    quantityUnit: "paquete",
  },
  {
    key: "bolsa",
    adminLabel: "Bolsa",
    adminDescription: "Sold by the bag.",
    priceSingular: "/ bolsa",
    pricePlural: "/ bolsas",
    qtySingular: "bolsa",
    qtyPlural: "bolsas",
    cardSingular: "bolsa",
    cardPlural: "bolsas",
    quantityUnit: "bolsa",
  },
  {
    key: "orden",
    adminLabel: "Orden",
    adminDescription: "Sold by the order.",
    priceSingular: "/ orden",
    pricePlural: "/ ordenes",
    qtySingular: "orden",
    qtyPlural: "ordenes",
    cardSingular: "orden",
    cardPlural: "ordenes",
    quantityUnit: "orden",
  },
]

export function getCateringSellingUnit(key: string): CateringSellingUnit | undefined {
  return CATERING_SELLING_UNITS.find((u) => u.key === key)
}

/**
 * Strictly retrieves a selling unit - throws if not found.
 * Use this when you expect the unit to exist.
 */
export function getCateringSellingUnitStrict(key: string): CateringSellingUnit {
  const u = CATERING_SELLING_UNITS.find((u) => u.key === key)
  if (!u) {
    throw new Error(`[CATERING] Unknown selling_unit: "${key}". Add it to CATERING_SELLING_UNITS in lib/catering-selling-units.ts`)
  }
  return u
}

export function getCateringUnitLabel(unit: string | null | undefined, count: number = 1): string {
  if (!unit) return ""
  const u = getCateringSellingUnitStrict(unit)
  return count === 1 ? u.priceSingular : u.pricePlural
}

export function getCateringQuantityUnitLabel(unit: string | null | undefined, count: number = 1): string {
  if (!unit) return ""
  const u = getCateringSellingUnitStrict(unit)
  return count === 1 ? u.qtySingular : u.qtyPlural
}

export function getCateringUnitLabelCard(unit: string | null | undefined, count: number = 1): string {
  if (!unit) return ""
  const u = getCateringSellingUnitStrict(unit)
  return count === 1 ? u.cardSingular : u.cardPlural
}

export function getCateringMinQtyLabel(unit: string | null | undefined, count: number = 1): string {
  if (!unit) return ""
  const u = getCateringSellingUnitStrict(unit)
  return `${count} ${count === 1 ? u.qtySingular : u.qtyPlural}`
}

export function getCateringAdminDisplayLabel(unit: string | null | undefined): string {
  if (!unit) return ""
  const u = getCateringSellingUnitStrict(unit)
  return u.adminLabel
}
