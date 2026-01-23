import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Required for Tauri
  assetPrefix: process.env.NODE_ENV === "production" ? "" : undefined,
  // Prevent webpack from bundling Tauri plugins (they're loaded at runtime in Tauri)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
