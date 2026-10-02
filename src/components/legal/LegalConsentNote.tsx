"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";

const LINK = "font-bold text-primary underline underline-offset-2";

/** «Продолжая, ты соглашаешься с Условиями и Политикой»: ссылки открываются в новой вкладке, чтобы не потерять онбординг. */
export function LegalConsentNote({ className }: { className?: string }) {
  const { t, lang } = useT();
  return (
    <p className={cn("text-center text-xs leading-relaxed text-muted", className)}>
      {t("legal.consent.pre")}{" "}
      <Link href="/terms" target="_blank" rel="noopener" className={LINK}>
        {t("legal.consent.terms")}
      </Link>{" "}
      {t("legal.consent.and")}{" "}
      <Link href="/privacy" target="_blank" rel="noopener" className={LINK}>
        {t("legal.consent.privacy")}
      </Link>
      {lang === "kk" ? " " : ""}
      {t("legal.consent.post")}
    </p>
  );
}
