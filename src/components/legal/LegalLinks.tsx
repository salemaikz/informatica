"use client";

import Link from "next/link";
import { LEGAL_IDS, type LegalId } from "@/content/legal";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";

const HREF: Record<LegalId, string> = { privacy: "/privacy", terms: "/terms" };

/** Ссылки на документы (политика и условия): внизу правовых страниц, в «Профиле» и в подвале меню. */
export function LegalLinks({ current, className }: { current?: LegalId; className?: string }) {
  const { t } = useT();
  return (
    <nav aria-label={t("legal.nav.label")} className={cn("flex flex-wrap gap-x-5 text-sm font-bold", className)}>
      {LEGAL_IDS.map((id) => (
        <Link
          key={id}
          href={HREF[id]}
          aria-current={current === id ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
            current === id ? "text-muted no-underline" : "text-primary",
          )}
        >
          {t(`legal.nav.${id}`)}
        </Link>
      ))}
    </nav>
  );
}
