"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { Mascot } from "@/components/mascot/Mascot";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { LEGAL, type LegalDoc } from "@/content/legal";
import { useGuestLang } from "@/components/onboarding/useGuestLang";
import { useT } from "@/i18n/useT";
import { useApp } from "@/lib/store";
import type { Lang } from "@/lib/types";
import { LegalLinks } from "./LegalLinks";

const LANGS: { id: Lang; label: string }[] = [
  { id: "ru", label: "Рус" },
  { id: "kk", label: "Қаз" },
];

/** Простой макет публичной страницы: логотип, «Назад», переключатель языка, текст через Markdown. */
export function LegalPage({ doc }: { doc: LegalDoc["id"] }) {
  const { t, l, lang } = useT();
  const router = useRouter();
  const updateProfile = useApp((s) => s.updateProfile);
  useGuestLang();
  const d = LEGAL[doc];
  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="md" icon={<ArrowLeft size={18} aria-hidden />} onClick={back}>
          {t("legal.back")}
        </Button>
        <div role="group" aria-label={t("legal.lang")} className="flex rounded-2xl border-2 border-border p-0.5">
          {LANGS.map((o) => (
            <button
              key={o.id}
              type="button"
              lang={o.id}
              aria-pressed={lang === o.id}
              onClick={() => updateProfile({ lang: o.id })}
              className={cn(
                "h-11 min-w-12 rounded-xl px-3 text-sm font-extrabold",
                lang === o.id ? "bg-primary text-white" : "text-muted hover:bg-surface-2",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center gap-3">
        <Mascot mood="happy" size={56} />
        <div>
          <p className="text-sm font-bold text-muted">{t("app.name")}</p>
          <h1 className="text-2xl font-extrabold leading-tight">{t(`legal.title.${doc}`)}</h1>
        </div>
      </div>

      <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm font-semibold">{t("legal.draft")}</p>

      <article className="rounded-3xl border-2 border-border bg-surface p-4 sm:p-6">
        <Markdown>{l(d.body)}</Markdown>
      </article>

      <p className="text-sm text-muted">
        {t("legal.updated")}: {d.updated}
      </p>
      <LegalLinks current={doc} />
    </main>
  );
}
