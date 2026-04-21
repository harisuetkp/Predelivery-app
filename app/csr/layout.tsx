import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const metadata = {
  title: "CSR Portal - FoodNetPR",
  description: "Customer Service Representative Phone Order Portal",
}

// Roles that can access the CSR Portal
const CSR_ALLOWED_ROLES = ["super_admin", "manager", "csr"]

export default async function CSRLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    // Redirect to admin login (not customer login) for employees
    redirect("/auth/login?redirect=/csr")
  }
  
  // Check if user is in admin_users table with an allowed role
  const { data: adminUser } = await supabase
    .from("admin_users")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single()
  
  // Also check super_admins table for legacy super admin accounts
  const { data: superAdmin } = await supabase
    .from("super_admins")
    .select("id, email")
    .eq("email", user.email)
    .single()
  
  // Allow access if user has an allowed role OR is in super_admins table
  const hasAccess = (adminUser && CSR_ALLOWED_ROLES.includes(adminUser.role)) || 
                    superAdmin !== null
  
  if (!hasAccess) {
    // No access - redirect to admin login with error
    redirect("/auth/login?error=unauthorized&redirect=/csr")
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  )
}
