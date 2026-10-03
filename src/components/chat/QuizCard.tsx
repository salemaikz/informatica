"use client";

import { ListRestart, Sparkles } from "lucide-react";
import type { QuizSummary } from "@/lib/chats";
import { cn } from "@/lib/cn";
import { plainText } from "@/lib/text";
import { useT } from "@/i18n/useT";
import { AiCost } from "@/components/economy/AiCost";
import { Button } from "@/components/ui/Button";
import { topicTitle } from "./helpers";

const GRADE_TONE: Record<QuizSummary["grade"], string> = {
  5: "bg-success-soft text-success-strong",
  4: "bg-success-soft text-success-strong",
  3: "bg-warning-soft text-warning-strong",
  2: "bg-danger-soft text-danger",
};

/** Карточка итога «Дай задачи» в ленте: «7 из 10», оценка, ошибки. Кнопки — только у последней карточки. */
export function QuizCard({
  quiz,
  actions,
  busy,
  onMore,
  onReview,
}: {
  quiz: QuizSummary;
  /** Показывать кнопки «Ещё задачи» / «Разобрать ошибки». */
  actions: boolean;
  busy: boolean;
  onMore: () => void;
  onReview: () => void;
}) {
  const { t, lang } = useT();
  const topic = topicTitle(quiz.topic, lang);
  return (
    <div className="flex w-full flex-col gap-3 rounded-3xl border-2 border-ai/25 bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wide text-ai">{t("chat2.quiz.title")}</p>
          {topic && <p className="truncate text-sm font-bold text-muted">{topic}</p>}
          <p className="text-2xl font-black tabular-nums">{t("chat2.quiz.score", { correct: quiz.correct, total: quiz.total })}</p>
        </div>
        <span className={cn("shrink-0 rounded-2xl px-3 py-2 text-center text-sm font-extrabold", GRADE_TONE[quiz.grade])}>
          {t("chat2.quiz.grade", { grade: quiz.grade })}
        </span>
      </div>

      {quiz.mistakes.length === 0 ? (
        <p className="font-bold text-success-strong">{t("chat2.quiz.noMistakes")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-extrabold text-muted">{t("chat2.quiz.mistakes")}</p>
          <ul className="flex flex-col gap-2">
            {quiz.mistakes.map((m, i) => (
              <li key={i} className="rounded-2xl bg-surface-2 p-3 text-sm">
                <p className="line-clamp-3 font-bold">{plainText(m.prompt)}</p>
                <p className="mt-1 text-danger">
                  <span className="font-extrabold">{t("chat2.quiz.given")}:</span> <span className="font-semibold">{plainText(m.given)}</span>
                </p>
                <p className="text-success-strong">
                  <span className="font-extrabold">{t("chat2.quiz.expected")}:</span> <span className="font-semibold">{plainText(m.expected)}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {actions && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" block icon={<ListRestart size={18} />} onClick={onMore} disabled={busy}>
            {t("chat2.quiz.more")}
          </Button>
          {quiz.mistakes.length > 0 && (
            <Button variant="ai" block icon={<Sparkles size={18} />} onClick={onReview} disabled={busy}>
              {t("chat2.quiz.review")}
              <AiCost kind="chat" variant="solid" short />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
