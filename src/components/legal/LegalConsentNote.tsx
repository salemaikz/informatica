"use client";

import Link from "next/link";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";

const LINK = "font-bold text-primary underline underline-offset-2";

/**
 * «Продолжая, ты соглашаешься с Условиями и Политикой»: на последнем шаге онбординга.
 * Ссылки открываются в новой вкладке, чтобы не потерять заполненную анкету.
 */
export function LegalConsentNote({ className }: { className?: string }) {
  const { t, lang } = useT();
  return (
    <p className={cn("text-center text-xs font-semibold leading-relaxed text-muted", className)}>
      {t("legal.consent.pre")}{" "}
      <Link href="/terms" target="_blank" rel="noopener" className={LINK}>
        {t("legal.consent.terms")}
      </Link>{" "}
      {t("legal.consent.and")}{" "}
      <Link href="/privacy" target="_blank" rel="noopener" className={LINK}>
        {t("legal.consent.privacy")}
      </Link>
      {lang === "kk" ? " " : ""}
      {t("legal.consent.post")} {t("legal.consent.minor")}
    </p>
  );
}
