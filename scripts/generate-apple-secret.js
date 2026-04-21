import jwt from "jsonwebtoken"

// Apple Sign In Configuration
const TEAM_ID = "5HDD4RTV3K"
const KEY_ID = "FC2N6BKH8Y"
const SERVICES_ID = "com.foodnetpr.web"

// PASTE YOUR PRIVATE KEY FROM THE .p8 FILE HERE
// It should look like:
// -----BEGIN PRIVATE KEY-----
// MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
// -----END PRIVATE KEY-----
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
PASTE_YOUR_KEY_HERE
-----END PRIVATE KEY-----`

// Generate JWT
const now = Math.floor(Date.now() / 1000)
const expiresIn = 15777000 // 6 months in seconds

const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + expiresIn,
  aud: "https://appleid.apple.com",
  sub: SERVICES_ID,
}

const header = {
  alg: "ES256",
  kid: KEY_ID,
}

try {
  const clientSecret = jwt.sign(payload, PRIVATE_KEY, {
    algorithm: "ES256",
    header: header,
  })

  console.log("\n=== Apple Sign In Client Secret ===\n")
  console.log(clientSecret)
  console.log("\n=== Configuration for Supabase ===\n")
  console.log("Services ID (Client ID):", SERVICES_ID)
  console.log("Client Secret: [JWT above]")
  console.log("\nThis secret expires in 6 months (around", new Date((now + expiresIn) * 1000).toISOString().split("T")[0], ")")
  console.log("\nPaste this into Supabase Dashboard > Authentication > Providers > Apple")
} catch (error) {
  console.error("Error generating JWT:", error.message)
  if (error.message.includes("PASTE_YOUR_KEY_HERE")) {
    console.error("\nPlease replace PASTE_YOUR_KEY_HERE with your actual private key from the .p8 file")
  }
}
