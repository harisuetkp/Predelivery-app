import { NextRequest, NextResponse } from "next/server"
import { validateAddress } from "@/lib/address/validate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/address/validate
 *
 * Phase 2 of geocoding overhaul: silent canonical normalization BEFORE the
 * order reaches Stripe/Shipday. Called from components/address-autocomplete
 * after a Google Places suggestion is selected. If Google Address Validation
 * returns a "deliverable" verdict (PREMISE/SUB_PREMISE granularity, no
 * unconfirmed components), the client replaces the form fields with the
 * USPS-CASS canonical form; otherwise the Places values pass through.
 *
 * Body: AddressValidateInput
 * Returns: AddressValidateResult (see lib/address/validate.ts)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.addressLines) || body.addressLines.length === 0) {
      return NextResponse.json(
        { ok: false, deliverable: false, error: "addressLines required" },
        { status: 400 }
      )
    }

    const result = await validateAddress({
      addressLines: body.addressLines.map((s: any) => String(s || "")).filter(Boolean),
      locality: body.locality ? String(body.locality) : undefined,
      administrativeArea: body.administrativeArea ? String(body.administrativeArea) : undefined,
      postalCode: body.postalCode ? String(body.postalCode) : undefined,
      regionCode: body.regionCode ? String(body.regionCode) : undefined,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[api/address/validate] error:", error)
    return NextResponse.json(
      { ok: false, deliverable: false, error: error?.message || "unknown" },
      { status: 500 }
    )
  }
}
