import type { NextConfig } from "next";

// Forward /api/* through the frontend's domain to the backend service so
// OAuth callbacks (PayPal, QBO) and other API calls all share the
// staffing.nmbmedia.com origin. Required because:
//   - PayPal/QBO Return URLs must match what's configured in their app
//     dashboards; we want them on the public domain, not the bare Railway URL.
//   - Same-origin avoids cross-site complications for any future endpoints
//     that need cookies.
const API_ORIGIN = process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || ''

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.dropbox.com',
        pathname: '/scl/**',
      },
      {
        protocol: 'https',
        hostname: 'dl.dropboxusercontent.com',
        pathname: '/**',
      },
    ],
  },
  async rewrites() {
    if (!API_ORIGIN) return []
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ]
  },
};

export default nextConfig;
