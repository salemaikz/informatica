import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Сервис-воркер напоминаний: браузер не должен держать старую версию.
  async headers() {
    return [
      {
        // Воркер JavaScript практикума: код ученика без сети и без загрузки чужих скриптов (решение #35).
        source: "/ide/js-worker.js",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; script-src 'self' 'unsafe-eval'" }],
      },
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
