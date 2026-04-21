import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// Default zip codes in case database is not yet set up
const DEFAULT_ZIP_CODES = [
  { zip: "00901", area: "Viejo San Juan" },
  { zip: "00907", area: "Condado" },
  { zip: "00909", area: "Santurce" },
  { zip: "00917", area: "Hato Rey" },
  { zip: "00918", area: "Hato Rey" },
  { zip: "00920", area: "Río Piedras" },
  { zip: "00923", area: "Cupey" },
  { zip: "00926", area: "Cupey Gardens" },
  { zip: "00949", area: "Toa Baja" },
  { zip: "00956", area: "Bayamón" },
  { zip: "00959", area: "Bayamón" },
  { zip: "00965", area: "Guaynabo" },
  { zip: "00968", area: "Guaynabo" },
  { zip: "00969", area: "Garden Hills" },
  { zip: "00976", area: "Trujillo Alto" },
  { zip: "00979", area: "Carolina" },
  { zip: "00983", area: "Isla Verde" },
]

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: areas, error } = await supabase
      .from("service_areas")
      .select("zip_code, area_name, default_address")
      .eq("is_active", true)
      .order("zip_code", { ascending: true })

    if (error) {
      // If table doesn't exist yet, return defaults
      if (error.code === "42P01") {
        return NextResponse.json(DEFAULT_ZIP_CODES)
      }
      console.error("Error fetching service areas:", error)
      return NextResponse.json(DEFAULT_ZIP_CODES)
    }

    // Transform to expected format
    const zipCodes = areas.map((area) => ({
      zip: area.zip_code,
      area: area.area_name,
      defaultAddress: area.default_address,
    }))

    // Return defaults if no areas configured
    if (zipCodes.length === 0) {
      return NextResponse.json(DEFAULT_ZIP_CODES)
    }

    return NextResponse.json(zipCodes)
  } catch (error) {
    console.error("Error in service-areas API:", error)
    return NextResponse.json(DEFAULT_ZIP_CODES)
  }
}
