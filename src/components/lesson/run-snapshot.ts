// Снимок и восстановление прохождения урока (#41) — чистые функции для LessonPlayer и LessonScreen, без React.
// Хранение и правила («20 минут», «до 5 уроков») — lib/lesson-run.ts; здесь только перевод «состояние плеера ↔ LessonRun».

import { isQuestion } from "@/lib/evaluate";
import { RUN_GRACE_MS, lessonSig, restoreQueue, runPaid, type LessonRun } from "@/lib/lesson-run";
import type { AnswerRecord, Lang, Step } from "@/lib/types";

/** Элемент очереди плеера: шаг урока, пометка «повтор ошибки» и ключ для анимации. */
export interface PlayerQueueItem {
  step: Step;
  retry: boolean;
  key: string;
}

/** Очередь «с нуля»: все шаги урока по порядку. */
export function freshQueue(steps: readonly Step[]): PlayerQueueItem[] {
  return steps.map((step) => ({ step, retry: false, key: step.id }));
}

/** Повтор ошибки в конце урока («работа над ошибками»). */
export function retryItem(step: Step): PlayerQueueItem {
  return { step, retry: true, key: `${step.id}:retry` };
}

/**
 * Активное время прохождения, мс (#68): сохранённое до продолжения + то, что набежало на часах вкладки (lib/active-clock.ts)
 * с момента показа плеера. clockAtMount — показание часов при монтировании, clockNow — сейчас.
 * Простой, фон и закрытая вкладка в сумму не попадают; часы сбросились (вкладка перезапущена) — не уходим в минус.
 */
export function activeElapsed(savedMs: number, clockAtMount: number, clockNow: number): number {
  const saved = Number.isFinite(savedMs) ? Math.max(0, savedMs) : 0;
  const gained = Number.isFinite(clockNow - clockAtMount) ? Math.max(0, clockNow - clockAtMount) : 0;
  return Math.round(saved + gained);
}

export interface RunSnapshotInput {
  lessonId: string;
  /** Шаги урока (для отпечатка sig) — те же, что у usableRun. */
  steps: readonly Pick<Step, "id" | "type">[];
  queue: readonly { step: { id: string }; retry: boolean }[];
  /** Индекс следующего непройденного шага в очереди. */
  pos: number;
  done: number;
  records: readonly AnswerRecord[];
  xp: number;
  combo: number;
  maxCombo: number;
  skipped: number;
  /** Активное время в уроке к этому моменту, мс (activeElapsed). */
  activeMs: number;
  xpFactor: number;
  /** Чипов заработано в этом прохождении к этому моменту. */
  chipsEarned: number;
  /** Цена входа в сердечках. */
  cost: number;
  /** Когда прохождение началось (первый вход). */
  startedAt: number;
  /** Когда оплачен вход; null — ещё ни одного ответа. */
  paidAt: number | null;
  /** Сейчас (мс) — станет updatedAt. */
  now: number;
}

const whole = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/** Снимок прохождения для стора (saveLessonRun): значения приводим к тем же границам, что проверяет sanitizeLessonRuns. */
export function buildRun(i: RunSnapshotInput): LessonRun {
  const queue = i.queue.map((q) => ({ id: q.step.id, retry: q.retry }));
  return {
    lessonId: i.lessonId,
    sig: lessonSig(i.steps),
    queue,
    pos: Math.min(whole(i.pos), queue.length),
    done: Math.min(whole(i.done), queue.length),
    records: [...i.records],
    xp: whole(i.xp),
    combo: whole(i.combo),
    maxCombo: whole(i.maxCombo),
    skipped: whole(i.skipped),
    activeMs: whole(i.activeMs),
    xpFactor: Math.max(0, Math.min(1, i.xpFactor)),
    chipsEarned: whole(i.chipsEarned),
    cost: i.cost >= 2 ? 2 : 1,
    startedAt: i.startedAt,
    updatedAt: i.now,
    paidAt: i.paidAt,
  };
}

/** Начальное состояние плеера из сохранения. */
export interface RestoredRun {
  queue: PlayerQueueItem[];
  pos: number;
  done: number;
  records: AnswerRecord[];
  xp: number;
  combo: number;
  maxCombo: number;
  skipped: number;
  activeMs: number;
  xpFactor: number;
  /** Чипов, заработанных в этом прохождении до сохранения (чипы на старте = wallet.earned − chipsEarned). */
  chipsEarned: number;
  startedAt: number;
  /** Вход уже оплачен и с последнего действия прошло не больше RUN_GRACE_MS — новая плата не нужна. */
  paid: boolean;
  /** Момент оплаты (для следующих сохранений); null — платить при первом ответе. */
  paidAt: number | null;
}

/** Восстановление: null — очередь не собирается (шаг пропал) → начинаем с нуля. */
export function restoreRun(run: LessonRun, steps: readonly Step[], now: number): RestoredRun | null {
  const queue = restoreQueue(run, steps);
  if (!queue) return null;
  const paid = runPaid(run, now);
  return {
    queue,
    pos: Math.min(Math.max(0, run.pos), queue.length),
    done: run.done,
    records: [...run.records],
    xp: run.xp,
    combo: run.combo,
    maxCombo: run.maxCombo,
    skipped: run.skipped,
    activeMs: run.activeMs,
    xpFactor: run.xpFactor,
    chipsEarned: run.chipsEarned,
    startedAt: run.startedAt,
    paid,
    paidAt: paid ? run.paidAt : null,
  };
}

/** Впереди есть задания (в том числе повтор ошибок) — значит, плата за вход ещё может понадобиться. */
export function questionsAhead(run: Pick<LessonRun, "queue" | "pos">, steps: readonly Step[]): boolean {
  const byId = new Map(steps.map((s) => [s.id, s]));
  return run.queue.slice(Math.max(0, run.pos)).some((q) => {
    const step = byId.get(q.id);
    return !!step && isQuestion(step);
  });
}

/** Шаг N из M для экрана «Продолжить»: следующий шаг по числу пройденных, не больше общего числа. */
export function resumeStep(run: Pick<LessonRun, "done">, total: number): { n: number; m: number } {
  const m = Math.max(1, total);
  return { n: Math.min(m, Math.max(0, run.done) + 1), m };
}

/** Окно без повторной платы для подписи «Вернуться в течение {time}» — из RUN_GRACE_MS: «20 минут» (ru, родительный) / «20 минут» (kk). */
export function graceText(lang: Lang): string {
  const n = Math.max(1, Math.round(RUN_GRACE_MS / 60_000));
  if (lang === "kk") return `${n} минут`;
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? "минуты" : "минут"}`;
}
