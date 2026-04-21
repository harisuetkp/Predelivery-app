/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Capacitor mobile builds when NEXT_PUBLIC_OUTPUT is set
  ...(process.env.NEXT_PUBLIC_OUTPUT === 'export' ? { output: 'export' } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'deliverlogic-common-assets.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
}

export default nextConfig

