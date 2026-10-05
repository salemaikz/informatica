// Узлы курса 3.0 на карте (этап 14, #46): «Практика» после группы уроков и «Повторение» в конце раздела.
// Прогресс узла — сколько раз пройден, лучшая точность, когда; у «Практики» ещё лучший результат мини-теста.
// Чистая логика без React (тесты — tests/course-nodes.test.ts); стор хранит Record<id узла, CourseNodeStat>.

export interface CourseNodeStat {
  /** Сколько раз пройдена практика/повторение. */
  runs: number;
  /** Лучшая точность 0..1. */
  best: number;
  /** Когда пройдено последний раз (ms). */
  at: number;
  /** Мини-тест группы: сколько раз, лучшая доля баллов 0..1, когда. */
  testRuns?: number;
  testBest?: number;
  testAt?: number;
}

export type CourseNodeRun = "practice" | "recap" | "minitest";

/** Узлы храним не больше этого числа (курс — ~40 групп; запас на будущее). */
export const MAX_COURSE_NODES = 200;
const ID_RE = /^(practice|recap):[a-z0-9-]{1,40}$/;

export const isCourseNodeId = (id: unknown): id is string => typeof id === "string" && ID_RE.test(id);

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/** Итог прохождения узла: практика и повторение копят runs/best, мини-тест — testRuns/testBest. */
export function nextNodeStat(prev: CourseNodeStat | undefined, run: CourseNodeRun, accuracy: number, now: number): CourseNodeStat {
  const p: CourseNodeStat = prev ?? { runs: 0, best: 0, at: 0 };
  const acc = clamp01(accuracy);
  if (run === "minitest") {
    return { ...p, testRuns: (p.testRuns ?? 0) + 1, testBest: Math.max(p.testBest ?? 0, acc), testAt: now };
  }
  return { ...p, runs: p.runs + 1, best: Math.max(p.best, acc), at: now };
}

const nonNeg = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

/** Проверка сохранённого: битые записи и чужие id отбрасываются (#57). */
export function sanitizeCourseNodes(raw: unknown): Record<string, CourseNodeStat> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, CourseNodeStat> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_COURSE_NODES)) {
    if (!isCourseNodeId(id) || !v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const stat: CourseNodeStat = { runs: Math.floor(nonNeg(r.runs)), best: clamp01(nonNeg(r.best)), at: nonNeg(r.at) };
    if (r.testRuns !== undefined) {
      stat.testRuns = Math.floor(nonNeg(r.testRuns));
      stat.testBest = clamp01(nonNeg(r.testBest));
      stat.testAt = nonNeg(r.testAt);
    }
    out[id] = stat;
  }
  return out;
}

/** Узел пройден (практика или повторение хотя бы раз). */
export const nodeDone = (s: CourseNodeStat | undefined): boolean => !!s && s.runs > 0;
