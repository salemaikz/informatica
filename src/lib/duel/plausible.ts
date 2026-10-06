import { checkAnswer } from "./deck";
import { CLOCK_SLACK_MS, DUEL_MODES, LATE_GRACE_MS, MIN_MS, matchDurationMs } from "./modes";
import type { AnswerIn, DuelAnswer, DuelEvent, DuelItem, DuelModeId } from "./types";

// Правдоподобность ответов (docs/specs/duels.md §3): сервер сам выставляет «верно/неверно» и проверяет время клиента.
// - ms < MIN_MS[форма] → неверно + флаг fast;
// - накопленное время клиента (Σms + паузы после ошибок) > прошедшее по серверу + 1,5 с → неверно + флаг sum;
// - порядок: только следующее задание; повтор (dup) и пропуск вперёд (order) отбрасываются;
// - поздно: после общих часов режима или после конца матча + 3 с — отбрасывается; дольше лимита задания — тайм-аут
//   (неверно, флаг late, это не жульничество).
// Чистая функция: сервер передаёт уже принятые ответы (prior) и новую пачку.

export type PlausibleFlag = "fast" | "sum" | "late";
export type RejectReason = "range" | "dup" | "order" | "late";

export interface JudgedAnswer {
  i: number;
  a: DuelAnswer;
  /** Время на задание (для тайм-аута — обрезано до лимита). */
  ms: number;
  ok: boolean;
  pts: number;
  /** Мс от старта до ответа (накопленно, с паузами после ошибок). */
  t: number;
  flags: PlausibleFlag[];
}

export interface PlausibleResult {
  /** Новые принятые ответы (по порядку). */
  accepted: JudgedAnswer[];
  rejected: { i: number; reason: RejectReason }[];
  /** Флаги честной игры среди новых (fast + sum; late не считается). */
  cheatFlags: number;
}

/** Самое долгое время на одно задание, которое вообще принимаем, мс (больше — мусор). */
const MAX_ITEM_MS = 10 * 60_000;
/** Допуск к лимиту задания на задержку интерфейса, мс. */
const LIMIT_SLACK_MS = 500;

const isCheat = (f: PlausibleFlag) => f === "fast" || f === "sum";

/**
 * Проверяет пачку ответов. elapsedMs — серверное «сейчас − начало матча». prior — уже принятые ответы этой стороны.
 */
export function judgeAnswers(
  mode: DuelModeId,
  deck: readonly DuelItem[],
  answers: readonly AnswerIn[],
  elapsedMs: number,
  prior: readonly JudgedAnswer[] = [],
): PlausibleResult {
  const meta = DUEL_MODES[mode];
  const durationMs = matchDurationMs(mode, deck.map((d) => d.level));
  const accepted: JudgedAnswer[] = [];
  const rejected: PlausibleResult["rejected"] = [];
  let last: JudgedAnswer | undefined = prior[prior.length - 1];
  let expected = prior.length;
  let cheatFlags = 0;

  for (const raw of answers) {
    const i = raw?.i;
    if (!Number.isInteger(i) || i < 0 || i >= deck.length || typeof raw.ms !== "number" || !Number.isFinite(raw.ms) || raw.ms < 0 || raw.ms > MAX_ITEM_MS) {
      rejected.push({ i: Number.isInteger(i) ? i : -1, reason: "range" });
      continue;
    }
    if (i < expected) {
      rejected.push({ i, reason: "dup" });
      continue;
    }
    if (i > expected) {
      rejected.push({ i, reason: "order" });
      continue;
    }
    // Пришло после конца матча + 3 с по часам сервера.
    if (elapsedMs > durationMs + LATE_GRACE_MS) {
      rejected.push({ i, reason: "late" });
      continue;
    }
    const item = deck[i];
    const flags: PlausibleFlag[] = [];
    let ms = Math.round(raw.ms);
    let { ok, pts } = checkAnswer(item, raw.a);

    // Тайм-аут задания («10 вопросов»): неверно, время — по лимиту.
    if (item.limitMs != null && ms > item.limitMs + LIMIT_SLACK_MS) {
      ms = item.limitMs;
      ok = false;
      pts = meta.pts.bad;
      flags.push("late");
    }
    const pause = last && !last.ok ? meta.errorPauseMs : 0;
    const t = (last?.t ?? 0) + pause + ms;
    // Общие часы режима кончились по собственному времени клиента — ответ не засчитывается.
    if (meta.clockMs != null && t > meta.clockMs + CLOCK_SLACK_MS) {
      rejected.push({ i, reason: "late" });
      continue;
    }
    if (ms < MIN_MS[item.shape]) flags.push("fast");
    if (t > elapsedMs + CLOCK_SLACK_MS) flags.push("sum");
    if (flags.some(isCheat)) {
      ok = false;
      pts = meta.pts.bad;
      cheatFlags++;
    }
    const judged: JudgedAnswer = { i, a: raw.a, ms, ok, pts, t, flags };
    accepted.push(judged);
    last = judged;
    expected++;
  }
  return { accepted, rejected, cheatFlags };
}

/** Таймлайн стороны по принятым ответам. */
export function eventsOf(judged: readonly JudgedAnswer[]): DuelEvent[] {
  return judged.map((j) => ({ i: j.i, ok: j.ok, t: j.t }));
}

/** Сколько флагов честной игры набралось за матч (fast/sum по ответам). */
export function cheatFlagCount(judged: readonly JudgedAnswer[]): number {
  return judged.filter((j) => j.flags.some(isCheat)).length;
}
