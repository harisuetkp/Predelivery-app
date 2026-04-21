import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  // Must match the Bundle ID/Package name registered in Apple Developer account
  // and Google Play Console.
  appId: "ca.salecalle.marketplace.app",
  appName: "SaleCalle Marketplace",
  webDir: "out",
  server: {
    // For production mobile builds, load the live website.
    url: "https://www.prdelivery.com",
    // cleartext: true, // (Removed: Only needed for localhost testing)
    // Prevents Capacitor from throwing URLs out to the system browser (Safari)
    allowNavigation: ["prdelivery.com", "*.prdelivery.com", "*.supabase.co", "checkout.stripe.com"],
  },
  ios: {
    // Use WKWebView (default). Allows cookies and Supabase session storage.
    contentInset: "automatic",
    // Allow deep links back into the app after Apple / Google OAuth redirect.
    scheme: "salecalle",
  },
  android: {
    // Allow mixed content for development
    allowMixedContent: false,
    // Capture all navigation within the app
    captureInput: true,
    // Status bar style
    backgroundColor: "#ffffff",
  },
  plugins: {
    // ─── Apple Sign In (iOS only) ─────────────────────────────────────────────
    // Bundle ID registered in Apple Developer → Identifiers → App IDs
    SignInWithApple: {
      clientId: "ca.salecalle.marketplace.app",
    },

    // ─── Google Sign In (iOS + Android) ──────────────────────────────────────
    // serverClientId: Web Client ID from Google Cloud Console / Firebase
    // iosClientId: iOS Client ID from GoogleService-Info.plist
    // IMPORTANT: Replace the placeholder values below with real values from
    // your Firebase / Google Cloud Console project.
    GoogleAuth: {
      scopes: ["profile", "email"],
      // Web OAuth 2.0 client ID (used by both platforms to validate tokens
      // server-side in Supabase).  Set NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env
      // as well so the runtime JS can read it without hardcoding here.
      serverClientId: "293965454826-9msbtr2th9bt7b13io9vhumkfn5v5hqe.apps.googleusercontent.com",
      // iOS native client ID — from GoogleService-Info.plist → CLIENT_ID field
      // (different from the web client ID)
      iosClientId: "293965454826-45j6rm2ef9gdcae7lf5ggu01v94kb4sd.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    },

    // ─── Push Notifications ───────────────────────────────────────────────────
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },

    // ─── Splash Screen ────────────────────────────────────────────────────────
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },

    // ─── Status Bar ───────────────────────────────────────────────────────────
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: "#ffffff",
      style: "LIGHT",
    },
  },
}

export default config
