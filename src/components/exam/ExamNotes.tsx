"use client";

import { ChevronDown, Info } from "lucide-react";
import { useState } from "react";
import { entTopicById } from "@/content/ent-topics";
import { useT } from "@/i18n/useT";
import type { ExamNote, ExamPaper } from "@/lib/exam";
import { noteVariant } from "./logic";

/** Сколько записей видно сразу: при скудном банке их бывает 20+, и список вытесняет кнопку «Начать». */
const SHOWN = 3;

/** Честно говорим, чего не хватило в банке заданий (вариант короче или собран из соседних тем). */
export function ExamNotes({ paper }: { paper: ExamPaper }) {
  const { t, l } = useT();
  const [all, setAll] = useState(false);
  if (!paper.notes.length) return null;
  const notes = all ? paper.notes : paper.notes.slice(0, SHOWN);
  const hidden = paper.notes.length - SHOWN;
  const hasContext = paper.items.some((q) => q.item.kind === "context");
  const topic = (id: ExamNote["topic"]) => (id ? l(entTopicById(id).short) : "");
  const kind = (k: ExamNote["kind"]) => t(`exam.kind.${k}` as const);

  return (
    <div className="rounded-2xl border-2 border-warning/40 bg-warning-soft p-3.5">
      <p className="mb-1.5 flex items-center gap-2 text-sm font-extrabold text-warning-strong">
        <Info size={18} aria-hidden /> {t("exam.notes.title")}
      </p>
      <ul className="flex flex-col gap-1 text-sm font-semibold text-text">
        {notes.map((n, i) => {
          const v = noteVariant(n, hasContext);
          const params = {
            topic: topic(n.topic),
            kind: kind(n.kind),
            n: n.missing,
            u: n.unfilled,
            from: n.filledFrom.map((x) => topic(x)).join(", "),
          };
          return <li key={i}>{t(`exam.note.${v}` as const, params)}</li>;
        })}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((v) => !v)}
          className="mt-1 flex min-h-10 items-center gap-1 text-sm font-extrabold text-warning-strong"
        >
          {all ? t("exam.notes.less") : t("exam.notes.more", { n: hidden })}
          <ChevronDown size={16} className={all ? "rotate-180" : undefined} aria-hidden />
        </button>
      )}
    </div>
  );
}
