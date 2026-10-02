"use client";

import { Info } from "lucide-react";
import { entTopicById } from "@/content/ent-topics";
import { useT } from "@/i18n/useT";
import type { ExamNote, ExamPaper } from "@/lib/exam";
import { noteVariant } from "./logic";

/** Честно говорим, чего не хватило в банке заданий (вариант короче или собран из соседних тем). */
export function ExamNotes({ paper }: { paper: ExamPaper }) {
  const { t, l } = useT();
  if (!paper.notes.length) return null;
  const hasContext = paper.items.some((q) => q.item.kind === "context");
  const topic = (id: ExamNote["topic"]) => (id ? l(entTopicById(id).short) : "");
  const kind = (k: ExamNote["kind"]) => t(`exam.kind.${k}` as const);

  return (
    <div className="rounded-2xl border-2 border-warning/40 bg-warning-soft p-3.5">
      <p className="mb-1.5 flex items-center gap-2 text-sm font-extrabold text-warning-strong">
        <Info size={18} aria-hidden /> {t("exam.notes.title")}
      </p>
      <ul className="flex flex-col gap-1 text-sm font-semibold text-text">
        {paper.notes.map((n, i) => {
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
    </div>
  );
}
