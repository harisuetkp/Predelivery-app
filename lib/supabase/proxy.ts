import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Handle KDS PWA session restoration FIRST, before any other processing
  if (pathname.match(/^\/[^\/]+\/kds$/)) {
    const urlToken = searchParams.get('token')
    
    if (!urlToken) {
      const slugMatch = pathname.match(/^\/([^\/]+)\/kds$/)
      if (slugMatch) {
        const slug = slugMatch[1]
        const sessionCookie = request.cookies.get(`kds_session_${slug}`)
        
        if (sessionCookie?.value) {
          try {
            const decodedValue = decodeURIComponent(sessionCookie.value)
            const session = JSON.parse(decodedValue)
            
            if (session.token) {
              const url = request.nextUrl.clone()
              url.searchParams.set('token', session.token)
              if (session.branchId) {
                url.searchParams.set('branch', session.branchId)
              }
              return NextResponse.redirect(url)
            }
          } catch {
            // Invalid cookie format - continue
          }
        }
      }
    }
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  // Create Supabase client with proper cookie handling
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // Get the user - this refreshes the session if needed
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const hostname = request.headers.get("host") || ""

  // Skip routing for known system paths
  const isSystemPath =
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/admin")

  // Check if we're on a custom domain
  const isCustomDomain =
    !hostname.includes("localhost") &&
    !hostname.includes("vercel.app") &&
    !hostname.includes("v0.dev") &&
    !hostname.includes("vusercontent.net")

  if (isCustomDomain && !isSystemPath) {
    // Custom domains must be added to Vercel project domains
    // AND DNS CNAME must point to cname.vercel-dns.com
    // Contact support to activate each new custom domain

    const normalizedHostname = hostname.replace("www.", "")

    // PART 1: Check catering restaurant custom domains first
    const { data: cateringRestaurant, error: cateringError } = await supabase
      .from("catering_restaurants")
      .select("id, slug")
      .eq("custom_domain", normalizedHostname)
      .eq("is_active", true)
      .maybeSingle()

    if (cateringError) {
      throw new Error(`Catering domain lookup failed: ${cateringError.message}`)
    }

    if (cateringRestaurant) {
      // Rewrite to catering portal - keep custom domain in browser URL bar
      const url = request.nextUrl.clone()
      url.pathname = `/catering/${cateringRestaurant.slug}${pathname === "/" ? "" : pathname}`
      
      const response = NextResponse.rewrite(url)
      // Pass catering restaurant ID and custom domain as headers
      response.headers.set("x-catering-restaurant-id", cateringRestaurant.id)
      response.headers.set("x-custom-domain", normalizedHostname)
      return response
    }

    // PART 2: Fall through to delivery tent restaurant domain routing
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("standalone_domain", normalizedHostname)
      .eq("is_active", true)
      .maybeSingle()

    if (restaurant) {
      if (pathname === "/" || pathname === "") {
        const url = request.nextUrl.clone()
        url.pathname = `/${restaurant.slug}`
        return NextResponse.rewrite(url)
      }

      if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        const url = request.nextUrl.clone()
        url.pathname = `/${restaurant.slug}${pathname}`
        return NextResponse.rewrite(url)
      }
    }
  }

  // Protect admin routes
  if (pathname.includes("/admin") && !pathname.startsWith("/api") && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  // Protect super-admin and CSR routes
  if ((pathname.startsWith("/super-admin") || pathname.startsWith("/csr")) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
