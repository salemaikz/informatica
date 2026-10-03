"use client";

import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import { IDE_LANGS, type IdeLang } from "@/lib/ide/types";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { IdeShell } from "./IdeShell";
import { LangIcon, TONE_CLASS } from "./LangIcon";
import { LangTabs } from "./LangTabs";
import { IDE_REGISTRY, isIdeLang } from "./registry";
import { langProgress } from "./shell-helpers";
import { TaskList } from "./TaskList";

type Mode = "tasks" | "sandbox";

/** /code/[lang]: вкладки языков, переключатель «Задачи / Песочница», список задач или свободная рабочая область. */
export function IdeLangPage({ lang }: { lang: string }) {
  if (!IDE_LANGS.includes(lang as IdeLang) || !isIdeLang(lang)) notFound();
  return <LangView key={lang} lang={lang} />;
}

function LangView({ lang }: { lang: IdeLang }) {
  const { t, l } = useT();
  const info = IDE_REGISTRY[lang];
  const codeTasks = useApp((s) => s.codeTasks);
  const [mode, setMode] = useState<Mode>("tasks");
  const { solved, total } = langProgress(info.tasks, codeTasks);
  const tone = TONE_CLASS[info.tone];

  return (
    <div className="flex flex-col gap-4">
      <ButtonLink href="/code" variant="ghost" size="sm" icon={<ArrowLeft size={16} />} className="-ml-2 self-start">
        {t("ide.back.all")}
      </ButtonLink>
      <LangTabs active={lang} />

      <header className="flex items-center gap-3">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", tone.soft)}>
          <LangIcon name={info.icon} size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">{l(info.title)}</h1>
          <p className="text-sm font-semibold text-muted">{l(info.about)}</p>
        </div>
      </header>

      {total > 0 && (
        <div className="flex flex-col gap-1.5">
          <ProgressBar value={solved / total} color={tone.bar} height={10} label={t("ide.hub.solved", { done: solved, total })} />
          <p className="text-sm font-extrabold text-muted">{t("ide.hub.solved", { done: solved, total })}</p>
        </div>
      )}

      <div role="tablist" aria-label={t("ide.mode.aria")} className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
        {(["tasks", "sandbox"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "h-11 rounded-xl font-extrabold transition-colors",
              mode === m ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-text",
            )}
          >
            {t(m === "tasks" ? "ide.mode.tasks" : "ide.mode.sandbox")}
          </button>
        ))}
      </div>

      {mode === "tasks" ? <TaskList lang={lang} tasks={info.tasks} /> : <IdeShell key={`sandbox-${lang}`} lang={lang} task={null} />}
    </div>
  );
}
