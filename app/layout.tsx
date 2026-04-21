import type React from "react"
import type { Viewport } from "next"
import { Inter, Playfair_Display } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import { Toaster } from "@/components/ui/toaster"
import { CartProvider } from "@/contexts/cart-context"
import { headers } from "next/headers"
import { OperatorProvider } from "@/contexts/operator-context"
import { getOperator, resolveOperatorSlugFromHostname } from "@/lib/operators"
import { SplashScreenHandler } from "@/components/SplashScreenHandler"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import "./globals.css"

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
})

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  variable: "--font-playfair",
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let hostname = ""
  
  // Static export (Capacitor mobile app) avoids dynamic headers()
  if (process.env.NEXT_PUBLIC_OUTPUT === "export") {
    hostname = "localhost"
  } else {
    try {
      const headersList = await headers()
      hostname = headersList.get("host") || headersList.get("x-forwarded-host") || ""
    } catch(e) {
      hostname = "localhost"
    }
  }
  
  if (!hostname) {
    hostname = "localhost"
  }
  
  const operatorSlug = await resolveOperatorSlugFromHostname(hostname)
  const operator = await getOperator(operatorSlug)
  
  return (
    <html lang="es" translate="no" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      </head>
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        {/* Facebook Pixel */}
        <Script id="facebook-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1591222855495258');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img height="1" width="1" style={{display:'none'}}
            src="https://www.facebook.com/tr?id=1591222855495258&ev=PageView&noscript=1"
          />
        </noscript>
        {/* Skip navigation link for keyboard/screen reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-black focus:text-white focus:rounded-md focus:outline-none"
        >
          Saltar al contenido principal
        </a>
        <OperatorProvider operator={operator}>
          <CartProvider>
            {children}
            <MobileBottomNav />
            <Toaster />
            <SplashScreenHandler />
          </CartProvider>
        </OperatorProvider>
        <Analytics />
      </body>
    </html>
  )
}

export const metadata = {
  generator: 'v0.app',
  metadataBase: new URL('https://prdelivery.com'),
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}
