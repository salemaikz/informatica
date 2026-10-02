import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Сервис-воркер напоминаний: браузер не должен держать старую версию.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
