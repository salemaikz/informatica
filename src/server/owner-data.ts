import "server-only";
import { cookies } from "next/headers";
import { LESSONS } from "@/content/course";
import { eventsKey } from "@/lib/analytics-fields";
import { isQuestion, promptText } from "@/lib/evaluate";
import { buildOwnerReport, retention, type DayFields, type OwnerReport, type ReportNames, type Retention } from "@/lib/owner-report";
import { parseErrorRows, parseIssueRows, type ErrorRow, type IssueRow } from "@/lib/owner-rows";
import type { Lesson, Step } from "@/lib/types";
import { getKv, kzDay } from "@/server/kv";
import { OWNER_COOKIE, ownerSecret, verifyOwnerCookie } from "@/server/owner-auth";

// Данные страницы /owner: вход по cookie, счётчики за период, названия из контента, списки жалоб и ошибок.
// Всё читается на сервере; клиенту уходит готовый HTML (никаких запросов из браузера к хранилищу).

/** Сколько суток читаем: хватает на когорты удержания (D30) и переключатель 7 / 30 дней. */
export const HISTORY_DAYS = 60;
/** Сколько жалоб и ошибок показываем. */
export const ISSUES_SHOWN = 100;
export const ERRORS_SHOWN = 50;

export type OwnerSession = "off" | "anon" | "ok";

/** off — секрета нет (страница = 404); anon — нужно войти; ok — вход действует. */
export async function ownerSession(): Promise<OwnerSession> {
  const secret = ownerSecret();
  if (!secret) return "off";
  const jar = await cookies();
  return verifyOwnerCookie(jar.get(OWNER_COOKIE)?.value, secret, Date.now()) ? "ok" : "anon";
}

// ---------- Названия из контента ----------

function stepTitle(step: Step): string {
  const t = isQuestion(step) ? promptText(step, "ru") : step.id;
  return t.length > 140 ? `${t.slice(0, 137)}…` : t;
}

/** Урок по id — только по собственным ключам: `constructor`, `__proto__` и прочие имена Object.prototype урока не дают (C1). */
const lessonById = (id: string): Lesson | undefined => (Object.hasOwn(LESSONS, id) ? LESSONS[id] : undefined);

let stepIndex: Map<string, string[]> | null = null;

/** id шага → в каких уроках он есть (id шага уникален только внутри урока). */
function indexSteps(): Map<string, string[]> {
  if (stepIndex) return stepIndex;
  stepIndex = new Map();
  for (const lesson of Object.values(LESSONS)) {
    for (const s of lesson.steps) stepIndex.set(s.id, [...(stepIndex.get(s.id) ?? []), lesson.id]);
  }
  return stepIndex;
}

/**
 * Названия для сводки. Ключ задания — `<урок>:<шаг>` или просто `<шаг>` (тогда ищем по всем урокам; если шаг есть в нескольких —
 * берём первый и помечаем «+N»). Банк практики и прочее, чего нет в уроках, — без названия (покажется сырой id).
 */
export const ownerNames: ReportNames = {
  lesson: (id) => lessonById(id)?.title.ru,
  task(key) {
    const colon = key.indexOf(":");
    if (colon > 0) {
      const lesson = lessonById(key.slice(0, colon));
      const step = lesson?.steps.find((s) => s.id === key.slice(colon + 1));
      if (lesson && step) return { title: stepTitle(step), lesson: lesson.title.ru };
    }
    const ids = indexSteps().get(key);
    const lesson = ids?.[0] ? lessonById(ids[0]) : undefined;
    const step = lesson?.steps.find((s) => s.id === key);
    if (!lesson || !step) return undefined;
    return { title: stepTitle(step), lesson: ids!.length > 1 ? `${lesson.title.ru} (+${ids!.length - 1})` : lesson.title.ru };
  },
};

// ---------- Загрузка ----------

export interface OwnerData {
  /** Окно сводки, суток. */
  period: 7 | 30;
  storage: "upstash" | "memory";
  /** Сбор включён на сервере (NEXT_PUBLIC_ANALYTICS=1). */
  collecting: boolean;
  /** Хранилище не ответило: данных нет не потому, что их нет, а потому что они не загружены (страница показывает предупреждение, не нули). */
  unavailable: boolean;
  report: OwnerReport;
  retention: Retention;
  issues: IssueRow[];
  errors: ErrorRow[];
}

/** Поля удержания: события active за первые сутки и через 1, 7, 30 дней. */
const RETENTION_FIELDS = ["act:0", "act:1", "act:7", "act:30"];

/**
 * Всё для страницы: счётчики выбранного периода целиком (HGETALL только за эти сутки) + удержание за HISTORY_DAYS суток
 * (HMGET четырёх полей act:*, без чтения целых хешей) + списки жалоб и ошибок.
 * Хранилище не ответило — `unavailable: true` и пустые таблицы: страница покажет предупреждение, а не нули (C3).
 */
export async function loadOwnerData(period: 7 | 30): Promise<OwnerData> {
  const kv = getKv();
  const now = Date.now();
  const dayList = Array.from({ length: HISTORY_DAYS }, (_, i) => kzDay(now - i * 86_400_000));
  const base = { period, storage: kv.kind, collecting: process.env.NEXT_PUBLIC_ANALYTICS === "1" } as const;
  try {
    const [hashes, act, issues, errors] = await Promise.all([
      kv.hgetAllMany(dayList.slice(0, period).map(eventsKey)),
      kv.hmgetMany(dayList.map(eventsKey), RETENTION_FIELDS),
      kv.lrange("issues", 0, ISSUES_SHOWN - 1),
      kv.lrange("client-errors", 0, ERRORS_SHOWN - 1),
    ]);
    const windowDays: DayFields[] = dayList.slice(0, period).map((day, i) => ({ day, fields: hashes[i] ?? {} }));
    const history: DayFields[] = dayList.map((day, i) => ({ day, fields: act[i] ?? {} }));
    return {
      ...base,
      unavailable: false,
      report: buildOwnerReport(windowDays, ownerNames),
      retention: retention(history),
      issues: parseIssueRows(issues),
      errors: parseErrorRows(errors),
    };
  } catch (e) {
    console.error("[owner] storage read failed", e instanceof Error ? e.message : e);
    return { ...base, unavailable: true, report: buildOwnerReport([], ownerNames), retention: retention([]), issues: [], errors: [] };
  }
}
