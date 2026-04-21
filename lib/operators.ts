import { createClient } from "@/lib/supabase/server"
import type { Operator } from "@/contexts/operator-context"

export async function getOperator(slug: string): Promise<Operator> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("operators")
    .select("*")
    .eq("slug", slug)
    .single()

  if (error || !data) {
    throw new Error(`Operator not found: slug "${slug}" does not exist in the database`)
  }

  return data as Operator
}

export async function resolveOperatorSlugFromHostname(hostname: string): Promise<string> {
  const supabase = await createClient()

  // Query domain_mappings table
  const { data } = await supabase
    .from("domain_mappings")
    .select("operator_slug")
    .eq("domain", hostname)
    .eq("is_active", true)
    .single()

  if (data?.operator_slug) {
    return data.operator_slug
  }

  // Development exception: localhost
  if (hostname === "localhost" || hostname.startsWith("localhost:")) {
    return "foodnetpr"
  }

  // Preview exception: Vercel preview deployments
  if (hostname.endsWith(".vercel.app") || hostname.endsWith(".vercel.run")) {
    return "foodnetpr"
  }

  // Domain not mapped - explicit error
  throw new Error(
    `Domain "${hostname}" is not mapped to any operator. ` +
    `Add it to the domain_mappings table to proceed.`
  )
}
