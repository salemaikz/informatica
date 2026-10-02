"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";

const ITEMS = [
  { id: "about", href: "/about", key: "legal.nav.about" },
  { id: "privacy", href: "/privacy", key: "legal.nav.privacy" },
  { id: "terms", href: "/terms", key: "legal.nav.terms" },
] as const;

/** Перекрёстные ссылки между правовыми страницами (и для блока в профиле). */
export function LegalLinks({ current, className }: { current?: string; className?: string }) {
  const { t } = useT();
  return (
    <nav aria-label={t("legal.nav.label")} className={cn("flex flex-wrap gap-x-5 pb-4 text-sm font-bold", className)}>
      {ITEMS.map((i) => (
        <Link
          key={i.id}
          href={i.href}
          aria-current={current === i.id ? "page" : undefined}
          className={cn("inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline", current === i.id && "text-muted no-underline")}
        >
          {t(i.key)}
        </Link>
      ))}
    </nav>
  );
}
