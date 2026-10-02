import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "@/components/app/Providers";

export const metadata: Metadata = {
  title: "Informatica — информатика к ЕНТ",
  description: "Короткие уроки информатики на русском и казахском: теория, видео, интерактивные задания, ИИ-помощник и подготовка к ЕНТ.",
  applicationName: "Informatica",
  appleWebApp: { capable: true, title: "Informatica", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1420" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
