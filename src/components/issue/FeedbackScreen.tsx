"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { buildFeedbackBody, ISSUE_LIMITS, ISSUE_REASONS, submitIssue } from "@/lib/issue";
import { Mascot } from "@/components/mascot/Mascot";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Kind = (typeof ISSUE_REASONS.feedback)[number];

const KIND_KEY = {
  idea: "feedback.kind.idea",
  bug: "feedback.kind.bug",
  content: "feedback.kind.content",
  other: "feedback.kind.other",
} as const satisfies Record<Kind, DictKey>;

type Status = "idle" | "sending" | "done" | "error";

/** Минимум знаков в отзыве: пустое и «.» не отправляем. */
const MIN_CHARS = 3;

/**
 * Страница «Отзывы и предложения»: вид обращения, текст до 1000 знаков, «Отправить» → /api/issue (type "feedback").
 * Без имени и контактов — об этом честно сказано в форме. После отправки — событие feedback (только вид).
 */
export function FeedbackScreen() {
  const { t, lang } = useT();
  const [kind, setKind] = useState<Kind>("idea");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const trimmed = text.trim();
  const canSend = trimmed.length >= MIN_CHARS && status !== "sending";

  const send = async () => {
    if (!canSend) return;
    setStatus("sending");
    const ok = await submitIssue(buildFeedbackBody(kind, text, lang));
    if (ok) track({ e: "feedback", kind });
    setStatus(ok ? "done" : "error");
  };

  const again = () => {
    setText("");
    setKind("idea");
    setStatus("idle");
  };

  if (status === "done") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold">{t("feedback.title")}</h1>
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <Mascot mood="happy" size={88} />
          <p role="status" className="text-xl font-extrabold">
            {t("feedback.thanks")}
          </p>
          <Button variant="secondary" size="lg" className="mt-2" onClick={again} autoFocus>
            {t("feedback.again")}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">{t("feedback.title")}</h1>
        <p className="font-semibold text-muted">{t("feedback.lead")}</p>
      </div>

      <Card className="flex flex-col gap-5">
        <div role="radiogroup" aria-label={t("feedback.kinds")} className="flex flex-col gap-2">
          {ISSUE_REASONS.feedback.map((k) => {
            const picked = kind === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={picked}
                onClick={() => setKind(k)}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-2xl border-2 px-4 py-2 text-left text-[15px] font-extrabold transition-colors",
                  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  picked ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-surface text-text hover:bg-surface-2",
                )}
              >
                <span
                  aria-hidden
                  className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", picked ? "border-primary bg-primary text-white" : "border-border")}
                >
                  {picked && <Check size={12} strokeWidth={4} />}
                </span>
                {t(KIND_KEY[k])}
              </button>
            );
          })}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-extrabold text-muted">{t("feedback.text")}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={ISSUE_LIMITS.feedback}
            rows={6}
            placeholder={t("feedback.placeholder")}
            className="w-full resize-none rounded-2xl border-2 border-border bg-surface p-3 text-base font-semibold text-text placeholder:text-muted focus:border-primary/40 focus:outline-none"
          />
          <span className="self-end text-xs font-bold text-muted" aria-hidden>
            {text.length}/{ISSUE_LIMITS.feedback}
          </span>
        </label>

        <p className="text-sm font-semibold text-muted">{t("feedback.anon")}</p>

        {status === "error" && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-center text-sm font-bold text-danger">
            {t("feedback.error")}
          </p>
        )}

        <Button size="lg" block disabled={!canSend} aria-busy={status === "sending"} onClick={() => void send()}>
          {status === "sending" ? t("feedback.sending") : t("feedback.send")}
        </Button>
      </Card>
    </div>
  );
}
