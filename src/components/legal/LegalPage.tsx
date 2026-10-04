"use client";

import { ArrowLeft, FileWarning } from "lucide-react";
import { useRouter } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { Mascot } from "@/components/mascot/Mascot";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LEGAL, legalMarkdown, type LegalId } from "@/content/legal";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import type { Lang } from "@/lib/types";
import { LegalLinks } from "./LegalLinks";
import { useGuestLang } from "./useGuestLang";

const LANGS: { id: Lang; label: string }[] = [
  { id: "ru", label: "Рус" },
  { id: "kk", label: "Қаз" },
];

/** Публичная страница документа (открывается без онбординга): «Назад», язык, текст через Markdown, ссылки на соседние документы. */
export function LegalPage({ doc }: { doc: LegalId }) {
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
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
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
                "h-11 min-w-12 rounded-xl px-3 text-sm font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
                lang === o.id ? "bg-primary text-white" : "text-muted hover:bg-surface-2",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center gap-3">
        <Mascot mood="happy" size={56} className="shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-muted">{t("app.name")}</p>
          <h1 className="break-words text-2xl font-extrabold leading-tight">{t(`legal.title.${doc}`)}</h1>
        </div>
      </div>

      <p className="flex items-start gap-2.5 rounded-2xl border-2 border-warning/40 bg-warning-soft px-4 py-3 text-sm font-semibold">
        <FileWarning size={18} aria-hidden className="mt-0.5 shrink-0 text-warning-strong" />
        <span>{t("legal.draft")}</span>
      </p>

      <Card className="sm:p-6">
        <Markdown>{legalMarkdown(d, lang)}</Markdown>
      </Card>

      <p className="text-sm font-semibold text-muted">
        {t("legal.updated")}: {l(d.updated)}
      </p>
      <LegalLinks current={doc} />
      <ButtonLink href="/" variant="secondary" block className="sm:w-auto sm:self-start">
        {t("legal.home")}
      </ButtonLink>
    </main>
  );
}
