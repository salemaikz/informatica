"use client";

import { ArrowRight, ChevronRight, Play } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Mascot } from "@/components/mascot/Mascot";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import { IDE_LANGS, type IdeLang, type IdeTask } from "@/lib/ide/types";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { LangIcon, TONE_CLASS } from "./LangIcon";
import { IDE_REGISTRY } from "./registry";
import { continueTarget, langProgress } from "./shell-helpers";

/** Главная «Практикума»: «Продолжить» и пять карточек языков с прогрессом. */
export function IdeHub() {
  const { t, l } = useT();
  const codeTasks = useApp((s) => s.codeTasks);
  const target = useMemo(() => {
    const byLang = Object.fromEntries(IDE_LANGS.map((id) => [id, IDE_REGISTRY[id].tasks])) as Record<IdeLang, IdeTask[]>;
    return continueTarget(byLang, codeTasks);
  }, [codeTasks]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">{t("ide.title")}</h1>
        <p className="font-semibold text-muted">{t("ide.subtitle")}</p>
      </div>

      {target ? (
        <Link
          href={`/code/${target.task.lang}/${target.task.id}`}
          className="flex items-center gap-3 rounded-3xl bg-primary p-4 text-white shadow-[0_5px_0_var(--primary-strong)] active:translate-y-1 active:shadow-none"
        >
          <Play size={28} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-extrabold uppercase tracking-wide opacity-85">
              {t(target.started ? "ide.hub.continue" : "ide.hub.begin")}
            </span>
            <span className="block truncate text-lg font-extrabold">{l(target.task.title)}</span>
          </span>
          <ArrowRight size={22} className="shrink-0" aria-hidden />
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-3xl border-2 border-border bg-surface p-4">
          <Mascot mood="happy" size={56} />
          <p className="flex-1 font-extrabold">{IDE_LANGS.some((id) => IDE_REGISTRY[id].tasks.length > 0) ? t("ide.hub.allDone") : t("ide.hub.soon")}</p>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {IDE_LANGS.map((id) => {
          const info = IDE_REGISTRY[id];
          const { solved, total } = langProgress(info.tasks, codeTasks);
          const tone = TONE_CLASS[info.tone];
          return (
            <li key={id}>
              <Link
                href={`/code/${id}`}
                className="flex h-full flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4 transition-colors hover:bg-surface-2 active:translate-y-px"
              >
                <span className="flex items-center gap-3">
                  <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", tone.soft)}>
                    <LangIcon name={info.icon} size={26} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-extrabold">{l(info.title)}</span>
                    <span className="block text-sm font-semibold text-muted">{l(info.about)}</span>
                  </span>
                  <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
                </span>
                {total > 0 ? (
                  <span className="flex flex-col gap-1.5">
                    <ProgressBar value={solved / total} color={tone.bar} height={10} label={t("ide.hub.solved", { done: solved, total })} />
                    <span className="text-sm font-extrabold text-muted">{t("ide.hub.solved", { done: solved, total })}</span>
                  </span>
                ) : (
                  <span className="text-sm font-extrabold text-muted">{t("ide.hub.soon")}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
