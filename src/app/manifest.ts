import type { MetadataRoute } from "next";

// PWA-манифест: приложение можно «установить» на телефон с сайта. Позже — сборка в сторы (см. ROADMAP).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Informatica — информатика к ЕНТ",
    short_name: "Informatica",
    description: "Уроки информатики на русском и казахском с ИИ-помощником",
    start_url: "/learn",
    display: "standalone",
    background_color: "#f6f7fb",
    theme_color: "#1a91d6",
    lang: "ru",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
