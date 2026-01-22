import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Required for Tauri
  assetPrefix: process.env.NODE_ENV === "production" ? "" : undefined,
};

export default nextConfig;
