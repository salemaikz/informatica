import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.INFORMATICA_DIST_DIR || ".next",
  turbopack: { root: __dirname },
};

export default nextConfig;
