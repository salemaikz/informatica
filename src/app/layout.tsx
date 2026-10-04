import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "@/components/app/Providers";
import { APP_NAME, ogAlt, siteDescription, siteTitle, siteUrl } from "@/lib/site-meta";

// Превью ссылки (WhatsApp, Telegram, Instagram): картинка public/og.png (scripts/og-image.mjs), текст — ru и kk в одной строке.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: siteTitle(), template: `%s · ${APP_NAME}` },
  description: siteDescription(),
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    locale: "ru_KZ",
    alternateLocale: ["kk_KZ"],
    images: [{ url: "/og.png", width: 1200, height: 630, alt: ogAlt() }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
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
