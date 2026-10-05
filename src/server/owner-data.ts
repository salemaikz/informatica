import "server-only";
import { cookies } from "next/headers";
import { LESSONS } from "@/content/course";
import { eventsKey } from "@/lib/analytics-fields";
import { isQuestion, promptText } from "@/lib/evaluate";
import { buildOwnerReport, retention, type DayFields, type OwnerReport, type ReportNames, type Retention } from "@/lib/owner-report";
import { parseErrorRows, parseIssueRows, type ErrorRow, type IssueRow } from "@/lib/owner-rows";
import type { Step } from "@/lib/types";
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
  lesson: (id) => LESSONS[id]?.title.ru,
  task(key) {
    const colon = key.indexOf(":");
    if (colon > 0) {
      const lesson = LESSONS[key.slice(0, colon)];
      const step = lesson?.steps.find((s) => s.id === key.slice(colon + 1));
      if (lesson && step) return { title: stepTitle(step), lesson: lesson.title.ru };
    }
    const ids = indexSteps().get(key);
    const lesson = ids?.[0] ? LESSONS[ids[0]] : undefined;
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
  report: OwnerReport;
  retention: Retention;
  issues: IssueRow[];
  errors: ErrorRow[];
}

/** Всё для страницы: счётчики за HISTORY_DAYS суток одним конвейером + списки жалоб и ошибок. */
export async function loadOwnerData(period: 7 | 30): Promise<OwnerData> {
  const kv = getKv();
  const now = Date.now();
  const dayList = Array.from({ length: HISTORY_DAYS }, (_, i) => kzDay(now - i * 86_400_000));
  const [hashes, issues, errors] = await Promise.all([
    kv.hgetAllMany(dayList.map(eventsKey)),
    kv.lrange("issues", 0, ISSUES_SHOWN - 1),
    kv.lrange("client-errors", 0, ERRORS_SHOWN - 1),
  ]);
  const history: DayFields[] = dayList.map((day, i) => ({ day, fields: hashes[i] ?? {} }));
  return {
    period,
    storage: kv.kind,
    collecting: process.env.NEXT_PUBLIC_ANALYTICS === "1",
    report: buildOwnerReport(history.slice(0, period), ownerNames),
    retention: retention(history),
    issues: parseIssueRows(issues),
    errors: parseErrorRows(errors),
  };
}
