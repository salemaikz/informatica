"use client";

import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Mascot } from "@/components/mascot/Mascot";
import { ButtonLink } from "@/components/ui/Button";
import { IDE_LANGS, type IdeLang } from "@/lib/ide/types";
import { useT } from "@/i18n/useT";
import { IdeShell } from "./IdeShell";
import { findTask, isIdeLang } from "./registry";

/** /code/[lang]/[task]: условие, рабочая область, итог. Неизвестный язык — 404; нет такой задачи — подсказка вернуться к списку. */
export function IdeTaskPage({ lang, taskId }: { lang: string; taskId: string }) {
  const { t } = useT();
  if (!IDE_LANGS.includes(lang as IdeLang) || !isIdeLang(lang)) notFound();
  const task = findTask(lang, taskId);

  return (
    <div className="flex flex-col gap-4">
      <ButtonLink href={`/code/${lang}`} variant="ghost" size="sm" icon={<ArrowLeft size={16} />} className="-ml-2 self-start">
        {t("ide.task.back")}
      </ButtonLink>
      {task ? (
        <IdeShell key={task.id} lang={lang} task={task} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border bg-surface p-6 text-center">
          <Mascot mood="sad" size={72} />
          <p className="font-extrabold">{t("ide.task.notFound")}</p>
          <ButtonLink href={`/code/${lang}`}>{t("ide.task.back")}</ButtonLink>
        </div>
      )}
    </div>
  );
}
