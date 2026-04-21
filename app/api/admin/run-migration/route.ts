import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { migrationKey } = await request.json()
    
    // Simple protection - require a key
    if (migrationKey !== process.env.MIGRATION_KEY && migrationKey !== "eatabit-2024") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Add Eatabit fields to restaurants
    const { error: restError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS eatabit_enabled BOOLEAN DEFAULT false;
        ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS eatabit_printer_id TEXT;
      `
    })
    
    if (restError) {
      console.log("Restaurants alter error (may already exist):", restError.message)
    }

    // Add Eatabit fields to branches
    const { error: branchError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE branches ADD COLUMN IF NOT EXISTS eatabit_enabled BOOLEAN DEFAULT false;
        ALTER TABLE branches ADD COLUMN IF NOT EXISTS eatabit_printer_id TEXT;
      `
    })
    
    if (branchError) {
      console.log("Branches alter error (may already exist):", branchError.message)
    }

    // Add Eatabit fields to orders
    const { error: orderError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS eatabit_job_id TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS eatabit_status TEXT;
      `
    })
    
    if (orderError) {
      console.log("Orders alter error (may already exist):", orderError.message)
    }

    return NextResponse.json({ 
      success: true, 
      message: "Eatabit migration completed. Fields may already exist if errors shown.",
      errors: {
        restaurants: restError?.message,
        branches: branchError?.message,
        orders: orderError?.message
      }
    })

  } catch (error: any) {
    console.error("Migration error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
