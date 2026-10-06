"use client";

import { Check, ListChecks, RotateCcw, Swords, Trophy, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { ENTRY_COST } from "@/lib/economy";
import { correctAnswer } from "@/lib/duel/check";
import type { DuelOutcome } from "@/lib/duel/bot";
import type { DuelSideStat } from "@/lib/duel/record";
import type { DuelAnswer, DuelEvent, DuelItem } from "@/lib/duel/types";
import { useT } from "@/i18n/useT";
import { InlineMarkdown, Markdown } from "@/components/Markdown";
import { SceneView } from "@/components/scenes/SceneView";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { HeartCost } from "@/components/economy/HeartCost";
import { XpIcon } from "@/components/economy/XpIcon";
import { Avatar } from "@/components/app/Avatar";
import { Mascot, MascotSays } from "@/components/mascot/Mascot";
import { BotChip } from "./BotChip";

// Итоги дуэли (этап 16Д, docs/specs/duels.md §9): победа — кубок золотом; проигрыш — мягко, без красного заголовка;
// счёт, верные, время, опыт; «Реванш» (новый вход — новое сердечко), «Разобрать ошибки» (статические объяснения),
// «К дуэлям». «Отправить другу» появится с вызовами (Ф3). Бит подписан «бот».

const fmtTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function DuelResult({
  result,
  you,
  rival,
  xp,
  items,
  events,
  answers,
  onRematch,
  onHub,
}: {
  result: DuelOutcome;
  you: DuelSideStat;
  rival: DuelSideStat;
  xp: number;
  items: DuelItem[];
  events: DuelEvent[];
  answers: (DuelAnswer | null)[];
  onRematch: () => void;
  onHub: () => void;
}) {
  const { t } = useT();
  const name = useApp((s) => s.profile.name);
  const avatar = useApp((s) => s.profile.avatar);
  const [review, setReview] = useState(false);
  const wrong = events.filter((e) => !e.ok);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-6 animate-fade-in" data-testid="duel-result">
      <div className="flex flex-col items-center gap-2 text-center">
        {result === "win" ? (
          <>
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gold-soft animate-pop">
              <Trophy size={44} className="text-gold" aria-hidden />
            </span>
            <h1 className="text-3xl font-black text-ink-gold">{t("duel.result.win")}</h1>
          </>
        ) : result === "draw" ? (
          <>
            <Mascot mood="happy" size={88} />
            <h1 className="text-3xl font-black text-ink-primary">{t("duel.result.draw")}</h1>
          </>
        ) : (
          <>
            <Mascot mood="neutral" size={88} />
            <h1 className="text-xl font-extrabold">{t("duel.result.loss")}</h1>
          </>
        )}
      </div>

      <section className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-3xl border-2 border-border bg-surface p-4" aria-label={t("duel.score")}>
        <div className="flex min-w-0 flex-col items-center gap-1">
          <Avatar config={avatar} name={name} size={40} />
          <span className="w-full truncate text-center text-sm font-extrabold">{name || t("duel.you")}</span>
        </div>
        <span className="whitespace-nowrap font-mono text-3xl font-black tabular-nums" data-testid="duel-final-score">
          {you.score} : {rival.score}
        </span>
        <div className="flex min-w-0 flex-col items-center gap-1">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-surface-2">
            <Mascot mood="neutral" size={38} />
          </span>
          <span className="text-sm font-extrabold">{t("duel.bot.name")}</span>
          <BotChip />
        </div>
        <Row label={t("duel.correct")} a={String(you.correct)} b={String(rival.correct)} />
        <Row label={t("duel.time")} a={fmtTime(you.timeMs)} b={fmtTime(rival.timeMs)} />
      </section>

      <div className="flex items-center justify-center gap-2 rounded-2xl border-2 border-gold bg-surface p-3">
        <XpIcon size={18} decorative />
        <span className="text-sm font-extrabold text-muted">{t("res.xp")}</span>
        <span className="text-2xl font-extrabold text-ink-gold" data-testid="duel-xp">
          +{xp}
        </span>
      </div>

      <MascotSays mood={result === "loss" ? "happy" : result === "win" ? "celebrate" : "happy"} size={56}>
        <span className="font-bold">{t(result === "win" ? "duel.line.win" : result === "draw" ? "duel.line.draw" : "duel.line.loss")}</span>
      </MascotSays>
      <p className="text-center text-xs font-semibold text-muted">{t("duel.bot.note")}</p>

      <div className="flex-1" />
      <div className="flex flex-col gap-3">
        <Button size="lg" block onClick={onRematch} icon={<RotateCcw size={20} />}>
          {t("duel.rematch")}
          <HeartCost n={ENTRY_COST.duel} variant="solid" />
        </Button>
        {wrong.length > 0 ? (
          <Button variant="secondary" block onClick={() => setReview(true)} icon={<ListChecks size={18} />}>
            {t("duel.review")} · {wrong.length}
          </Button>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm font-extrabold text-ink-success">
            <Check size={18} strokeWidth={3} aria-hidden /> {t("duel.review.none")}
          </p>
        )}
        <Button variant="ghost" block onClick={onHub} icon={<Swords size={18} />}>
          {t("duel.toHub")}
        </Button>
      </div>

      <Modal open={review} onClose={() => setReview(false)} label={t("duel.review")}>
        <ReviewList items={items} wrong={wrong} answers={answers} onClose={() => setReview(false)} />
      </Modal>
    </div>
  );
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <>
      <span className="text-center font-mono text-lg font-extrabold tabular-nums">{a}</span>
      <span className="text-center text-xs font-extrabold text-muted">{label}</span>
      <span className="text-center font-mono text-lg font-extrabold tabular-nums text-muted">{b}</span>
    </>
  );
}

/** Разбор ошибок: условие, ответ ученика, верный ответ и бесплатное статическое объяснение (без ИИ). */
function ReviewList({ items, wrong, answers, onClose }: { items: DuelItem[]; wrong: DuelEvent[]; answers: (DuelAnswer | null)[]; onClose: () => void }) {
  const { t, l } = useT();
  const say = (item: DuelItem, a: DuelAnswer | null | undefined): string => {
    if (a === null || a === undefined) return t("duel.review.timeout");
    if (item.shape === "statement") return a === true ? t("duel.true") : t("duel.false");
    const opt = typeof a === "number" ? item.step.options[a] : undefined;
    return opt === undefined ? "—" : typeof opt === "string" ? opt : l(opt);
  };
  return (
    <div className="flex max-h-[80dvh] flex-col gap-4 overflow-y-auto pb-[max(8px,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-xl font-extrabold">{t("duel.review")}</h2>
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
          <X size={22} />
        </button>
      </div>
      {wrong.map((e) => {
        const item = items[e.i];
        if (!item) return null;
        const given = answers[e.i];
        const why = item.shape === "choice" && typeof given === "number" ? item.step.whyWrong?.[given] : null;
        const explanation = item.shape === "choice" ? item.step.explanation : item.statement.explanation;
        return (
          <article key={e.i} className="flex flex-col gap-2 rounded-3xl border-2 border-border bg-surface p-4">
            <p className="font-extrabold leading-snug [overflow-wrap:anywhere]">
              <InlineMarkdown>{item.shape === "choice" ? l(item.step.prompt) : l(item.statement.text)}</InlineMarkdown>
            </p>
            {item.shape === "choice" && item.step.scene && <SceneView scene={item.step.scene} />}
            <p className="rounded-2xl bg-danger-soft px-3 py-2 text-sm font-bold text-ink-danger [overflow-wrap:anywhere]">
              {t("duel.review.yours")}: <InlineMarkdown>{say(item, given)}</InlineMarkdown>
            </p>
            <p className="rounded-2xl bg-success-soft px-3 py-2 text-sm font-bold text-ink-success [overflow-wrap:anywhere]">
              {t("duel.review.right")}: <InlineMarkdown>{say(item, correctAnswer(item))}</InlineMarkdown>
            </p>
            {why && <p className={cn("text-sm font-semibold text-muted")}>{l(why)}</p>}
            <div className="text-sm">
              <Markdown>{l(explanation)}</Markdown>
            </div>
          </article>
        );
      })}
    </div>
  );
}
