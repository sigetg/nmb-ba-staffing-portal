import type { NextConfig } from "next";

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
};

export default nextConfig;
