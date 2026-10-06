"use client";

import { ThumbsDown, ThumbsUp, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { playSound } from "@/lib/sound";
import { DUEL_MODES } from "@/lib/duel/modes";
import { opponentAt, type OpponentState, type OpponentTimeline } from "@/lib/duel/timeline";
import { clockLeftMs, clockNow, clockPause, clockResume, clockStart, itemLeftMs, runAnswer, runTick, sideStat, startRun, type MatchClock, type RunState } from "@/lib/duel/run";
import type { DuelAnswer, DuelEvent, DuelItem, DuelModeId } from "@/lib/duel/types";
import { useT } from "@/i18n/useT";
import { InlineMarkdown } from "@/components/Markdown";
import { SceneView } from "@/components/scenes/SceneView";
import { Option, type OptionState } from "@/components/lesson/steps/Option";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useHearts } from "@/components/economy/useEconomy";
import { MusicToggle } from "@/components/music/MusicToggle";
import { Avatar } from "@/components/app/Avatar";
import { Mascot } from "@/components/mascot/Mascot";
import { BotChip } from "./BotChip";
import { MODE_TITLE } from "./mode-meta";

// Экран матча дуэли (этап 16Д, Ф1): задания по очереди, общие часы (блиц, «верю — не верю») или лимит на задание
// («10 вопросов»), штраф и пауза после ошибки, полоса соперника по его таймлайну (бот — opponentAt). Соперник для экрана —
// только таймлайн: потом сюда же придут живой матч и запись друга. Время — «часы матча» (lib/duel/run.ts): в «10 вопросах»
// они стоят, пока ученик смотрит разбор ответа (бот этого времени тоже не тратит).

/** Шаг часов экрана, мс. */
const TICK_MS = 100;
/** «10 вопросов»: сколько показываем разбор ответа (часы матча стоят), мс. */
export const FEEDBACK_OK_MS = 650;
export const FEEDBACK_WRONG_MS = 1600;
/** Блиц и «верю — не верю»: после верного ответа следующее задание сразу на том же месте — столько нажатия не принимаем (двойной тап). */
export const ANSWER_LOCK_MS = 180;

interface Feedback {
  i: number;
  /** null — время вышло. */
  answer: DuelAnswer | null;
  ok: boolean;
  /** До какого момента показываем (реальное время, мс). */
  until: number;
}

interface Ui {
  run: RunState;
  /** Часы матча, мс. */
  now: number;
  fb: Feedback | null;
  opp: OpponentState;
}

const fmtClock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function DuelRun({
  items,
  mode,
  timeline,
  onFinish,
  onQuit,
}: {
  items: DuelItem[];
  mode: DuelModeId;
  timeline: OpponentTimeline;
  onFinish: (run: RunState, oppEvents: DuelEvent[]) => void;
  onQuit: () => void;
}) {
  const { t } = useT();
  const sound = useApp((s) => s.profile.sound);
  const meta = DUEL_MODES[mode];
  const onClock = meta.clockMs != null;

  const [ui, setUi] = useState<Ui>(() => ({ run: startRun(), now: 0, fb: null, opp: opponentAt(timeline, 0) }));
  // Ход игры — в ref (меняют обработчики и таймер), экран рисует копию из состояния.
  const game = useRef<{ run: RunState; clock: MatchClock | null; fb: Feedback | null; oppAnswered: number; finished: boolean; lockUntil: number }>({
    run: ui.run,
    clock: null,
    fb: null,
    oppAnswered: 0,
    finished: false,
    lockUntil: 0,
  });
  const hearts = useHearts();
  const [quitAsk, setQuitAsk] = useState(false);
  const props = useRef({ items, timeline, onFinish, sound, onClock });
  useEffect(() => {
    props.current = { items, timeline, onFinish, sound, onClock };
  });

  const commit = (now: number) => {
    const g = game.current;
    setUi({ run: g.run, now, fb: g.fb, opp: opponentAt(props.current.timeline, now) });
  };

  const finish = () => {
    const g = game.current;
    if (g.finished) return;
    g.finished = true;
    const { timeline: tl, onFinish: done, sound: snd } = props.current;
    if (snd) playSound("complete");
    done(g.run, tl.events);
  };

  // Часы: старт при монтировании, шаг TICK_MS. Тайм-ауты, конец часов, ответы соперника — здесь.
  useEffect(() => {
    const g = game.current;
    g.clock ??= clockStart(Date.now());
    const step = () => {
      const { items: list, timeline: tl, sound: snd, onClock: clocked } = props.current;
      if (g.finished || !g.clock) return;
      const real = Date.now();
      if (g.fb && real >= g.fb.until) {
        g.fb = null;
        if (!clocked) g.clock = clockResume(g.clock, real);
      }
      const now = clockNow(g.clock, real);
      if (!g.fb) {
        const before = g.run;
        g.run = runTick(g.run, list, now);
        // Тайм-аут «10 вопросов»: показываем верный ответ, часы матча стоят.
        if (g.run.events.length > before.events.length && !clocked) {
          g.fb = { i: before.i, answer: null, ok: false, until: real + FEEDBACK_WRONG_MS };
          g.clock = clockPause(g.clock, real);
          if (snd) playSound("wrong");
        }
      }
      const opp = opponentAt(tl, now);
      if (opp.answered > g.oppAnswered) {
        g.oppAnswered = opp.answered;
        if (snd) playSound("pop");
      }
      const meta0 = list[0] ? DUEL_MODES[list[0].mode] : null;
      const over = clocked ? meta0?.clockMs != null && now >= meta0.clockMs : g.run.done && !g.fb && opp.done;
      if (over) {
        g.run = { ...g.run, done: true };
        commit(now);
        finish();
        return;
      }
      commit(now);
    };
    const id = window.setInterval(step, TICK_MS);
    return () => window.clearInterval(id);
    // Часы запускаются один раз за матч; свежие пропсы — через props.current.
  }, []);

  const answer = (a: DuelAnswer) => {
    const g = game.current;
    if (g.finished || g.fb || g.run.done || !g.clock) return;
    const real = Date.now();
    if (real < g.lockUntil) return;
    const now = clockNow(g.clock, real);
    const before = g.run;
    g.run = runAnswer(g.run, items, a, now);
    if (g.run === before) return;
    const ev = g.run.events[g.run.events.length - 1];
    if (sound) playSound(ev.ok ? "correct" : "wrong");
    if (onClock) {
      // Блиц и «верю — не верю»: после ошибки — пауза режима с верным ответом, часы идут.
      if (!ev.ok) g.fb = { i: before.i, answer: a, ok: false, until: real + meta.errorPauseMs };
      else g.lockUntil = real + ANSWER_LOCK_MS;
    } else {
      g.fb = { i: before.i, answer: a, ok: ev.ok, until: real + (ev.ok ? FEEDBACK_OK_MS : FEEDBACK_WRONG_MS) };
      g.clock = clockPause(g.clock, real);
    }
    commit(now);
  };

  // Ответ — через ref, чтобы карточка задания (memo) не перерисовывалась на каждом шаге часов.
  const answerRef = useRef<(a: DuelAnswer) => void>(() => {});
  useEffect(() => {
    answerRef.current = answer;
  });
  const onAnswer = useCallback((a: DuelAnswer) => answerRef.current(a), []);

  const { run, now, fb, opp } = ui;
  const shownIdx = fb ? fb.i : run.i;
  const item = items[shownIdx];
  const waiting = run.done && !fb;
  const clockLeft = clockLeftMs(mode, now);
  const itemLeft = fb ? null : itemLeftMs(run, items, now);
  const urgent = clockLeft != null ? clockLeft <= 10_000 : itemLeft != null && itemLeft <= 5_000;
  const you = sideStat(mode, run.events);
  const them = sideStat(mode, opp.events);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-2 px-4">
          <button type="button" onClick={() => setQuitAsk(true)} aria-label={t("common.close")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
            <X size={24} />
          </button>
          <span className="min-w-0 flex-1 truncate text-lg font-extrabold">{t(MODE_TITLE[mode])}</span>
          <MusicToggle />
          {clockLeft != null && (
            <span
              role="timer"
              aria-label={t("duel.clock.aria", { sec: Math.ceil(clockLeft / 1000) })}
              className={cn("min-w-14 text-right font-mono text-xl font-extrabold tabular-nums", urgent ? "text-ink-warning" : "text-text")}
            >
              {fmtClock(clockLeft)}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <ScoreBoard
          you={{ score: you.score, answered: you.answered, correct: you.correct, events: run.events }}
          them={{ score: them.score, answered: them.answered, correct: them.correct }}
          n={items.length}
          perItem={!onClock}
        />

        {itemLeft != null && item?.limitMs != null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div
              className={cn("h-full rounded-full transition-[width] duration-100 ease-linear", urgent ? "bg-warning" : "bg-primary")}
              style={{ width: `${Math.max(0, Math.min(100, (itemLeft / item.limitMs) * 100))}%` }}
            />
          </div>
        )}

        {waiting ? (
          <WaitPanel answered={opp.answered} total={onClock ? null : items.length} onSkip={finish} />
        ) : item ? (
          <ItemCard key={shownIdx} item={item} index={shownIdx} total={items.length} perItem={!onClock} fb={fb && fb.i === shownIdx ? fb : null} onAnswer={onAnswer} />
        ) : null}
      </div>

      {/* Выход посреди матча: сердечко уже списано, матч не засчитается — спрашиваем. */}
      <Modal open={quitAsk} onClose={() => setQuitAsk(false)} label={t("duel.quit.title")}>
        <h2 className="mb-2 text-xl font-extrabold">{t("duel.quit.title")}</h2>
        <p className="mb-4 font-semibold text-muted">{hearts.unlimited ? t("duel.quit.descFree") : t("duel.quit.desc")}</p>
        <div className="flex flex-col gap-2">
          <Button size="lg" block onClick={() => setQuitAsk(false)}>
            {t("duel.quit.stay")}
          </Button>
          <Button variant="secondary" block onClick={onQuit} data-testid="duel-quit">
            {t("duel.quit.leave")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/** Счёт и полосы: свои ответы — success/danger, соперник — нейтральная полоса (не цвет ИИ). */
function ScoreBoard({
  you,
  them,
  n,
  perItem,
}: {
  you: { score: number; answered: number; correct: number; events: DuelEvent[] };
  them: { score: number; answered: number; correct: number };
  n: number;
  perItem: boolean;
}) {
  const { t } = useT();
  const name = useApp((s) => s.profile.name);
  const avatar = useApp((s) => s.profile.avatar);
  // На часах набор с запасом (40–50 заданий): полоса — доля верных от «шкалы» (не меньше 10).
  const scale = perItem ? n : Math.max(10, you.correct, them.correct);
  const width = (v: number) => `${Math.max(0, Math.min(100, (v / scale) * 100))}%`;
  const own = perItem ? you.events : you.events.slice(-10);
  return (
    <section className="flex flex-col gap-2 rounded-3xl border-2 border-border bg-surface p-3">
      <div className="flex items-center gap-2" aria-label={t("duel.you.aria", { n: you.answered, c: you.correct })} role="group">
        <Avatar config={avatar} name={name} size={28} />
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{name || t("duel.you")}</span>
        <span className="font-mono text-lg font-extrabold tabular-nums" data-testid="duel-you-score">
          {you.score}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: width(perItem ? you.answered : you.correct) }} />
      </div>
      {/* Свои ответы: верно — зелёная точка, неверно — красная (в «10 вопросах» — все 10 ячеек). */}
      <div className="flex gap-1" aria-hidden>
        {(perItem ? Array.from({ length: n }, (_, k) => own[k]) : own).map((e, k) => (
          <span key={k} className={cn("h-1.5 flex-1 rounded-full", !e ? "bg-surface-2" : e.ok ? "bg-success" : "bg-danger")} />
        ))}
      </div>
      <div className="mt-1 flex items-center gap-2" aria-label={t("duel.opp.aria", { n: them.answered, c: them.correct })} role="group" data-testid="duel-opp">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2">
          <Mascot mood="neutral" size={26} />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-extrabold">
          <span className="truncate">{t("duel.bot.name")}</span>
          <BotChip />
        </span>
        <span className="font-mono text-lg font-extrabold tabular-nums text-muted" data-testid="duel-opp-score">
          {them.score}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-muted/60 transition-[width] duration-300" style={{ width: width(perItem ? them.answered : them.correct) }} />
      </div>
    </section>
  );
}

/** Задание: выбор варианта или «верю — не верю». Во время разбора (fb) — верный и выбранный ответ подсвечены. */
const ItemCard = memo(function ItemCard({
  item,
  index,
  total,
  perItem,
  fb,
  onAnswer,
}: {
  item: DuelItem;
  index: number;
  total: number;
  perItem: boolean;
  fb: Feedback | null;
  onAnswer: (a: DuelAnswer) => void;
}) {
  const { t, l } = useT();
  const locked = !!fb;
  return (
    <section data-testid="duel-item" data-item={index} className="flex flex-1 flex-col gap-3 motion-safe:animate-fade-in">
      {perItem && (
        <p className="text-xs font-extrabold text-muted">
          {index + 1} / {total}
        </p>
      )}
      {item.shape === "choice" ? (
        <>
          <h2 className="text-lg font-extrabold leading-snug [overflow-wrap:anywhere]">
            <InlineMarkdown>{l(item.step.prompt)}</InlineMarkdown>
          </h2>
          {item.step.scene && <SceneView scene={item.step.scene} />}
          <div className="mt-auto flex flex-col gap-2.5 pt-2">
            {item.step.options.map((opt, k) => {
              let state: OptionState = "idle";
              if (fb) state = k === item.step.correct ? "correct" : k === fb.answer ? "wrong" : "dim";
              return (
                <Option key={k} index={k} state={state} disabled={locked} onClick={() => onAnswer(k)} badge={k + 1}>
                  <span data-option={k} className="block [overflow-wrap:anywhere]">
                    <InlineMarkdown>{typeof opt === "string" ? opt : l(opt)}</InlineMarkdown>
                  </span>
                </Option>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="flex min-h-40 flex-1 items-center justify-center rounded-3xl border-2 border-border bg-surface px-4 py-6 text-center">
            <p className="text-xl font-bold leading-snug [overflow-wrap:anywhere]">
              <InlineMarkdown>{l(item.statement.text)}</InlineMarkdown>
            </p>
          </div>
          {fb && (
            <p
              role="status"
              className={cn(
                "rounded-2xl px-3 py-2 text-center text-sm font-extrabold",
                fb.ok ? "bg-success-soft text-ink-success" : "bg-danger-soft text-ink-danger",
              )}
            >
              {item.statement.value ? t("duel.st.true") : t("duel.st.false")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button size="lg" variant="secondary" disabled={locked} onClick={() => onAnswer(false)} icon={<ThumbsDown size={20} />} data-answer="false">
              {t("duel.false")}
            </Button>
            <Button size="lg" variant="secondary" disabled={locked} onClick={() => onAnswer(true)} icon={<ThumbsUp size={20} />} data-answer="true">
              {t("duel.true")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
});

/** Ученик доиграл, Бит ещё отвечает: его таймлайн известен заранее — итоги можно показать сразу (результат тот же). */
function WaitPanel({ answered, total, onSkip }: { answered: number; total: number | null; onSkip: () => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Mascot mood="thinking" size={88} />
      <p className="flex items-center gap-2 font-extrabold">
        {total != null ? t("duel.wait", { n: answered, total }) : t("duel.wait.clock", { n: answered })}
        <BotChip />
      </p>
      <Button onClick={onSkip}>{t("duel.wait.skip")}</Button>
    </div>
  );
}
