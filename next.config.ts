import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
      },
    ],
  },
  experimental: {
    // Avoid reusing a stale Turbopack CSS cache across production deploys.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
