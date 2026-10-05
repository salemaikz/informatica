import "server-only";
import type { StudentContext, TaskContext } from "@/lib/ai-types";
import type { Lang } from "@/lib/types";
import type { WithTrack } from "@/lib/school";
import { clampSecrets } from "@/lib/answer-leak";

// Всё, что пришло с клиента, — недоверенные данные: обрезаем длины и типы.

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const strArr = (v: unknown, maxItems: number, maxLen: number): string[] =>
  Array.isArray(v) ? v.slice(0, maxItems).map((x) => str(x, maxLen)).filter(Boolean) : [];

export function lang(v: unknown): Lang {
  return v === "kk" ? "kk" : "ru";
}

/**
 * Запрос пришёл с нашего же сайта? В production заголовок Origin обязателен и его хост должен совпасть с Host
 * (или x-forwarded-host за прокси); если есть Sec-Fetch-Site, он должен быть same-origin.
 * Вне production (dev, тесты) запрос без Origin пропускаем — curl и тесты маршрутов.
 * Закрывает использование нашего ИИ чужими сайтами; подделать заголовки из curl можно, от этого защищает
 * потолок расходов (server/ai-guard.ts).
 */
export function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site.toLowerCase() !== "same-origin") return false;
  const origin = req.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  let host: string;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return false; // например, Origin: null
  }
  const allowed = [req.headers.get("x-forwarded-host")?.split(",")[0], req.headers.get("host")]
    .map((h) => h?.trim().toLowerCase())
    .filter((h): h is string => !!h);
  return allowed.includes(host);
}

/** Сколько последних сообщений чата берём, сколько символов в каждом и во всей истории (старые отбрасываются). */
export const HISTORY_MAX_MESSAGES = 12;
export const HISTORY_MAX_MESSAGE_CHARS = 2000;
export const HISTORY_MAX_CHARS = 8000;

export interface HistoryMsg {
  role: "user" | "assistant";
  content: string;
}

/** История чата с клиента: только user/assistant с непустым текстом, каждое до 2000 символов, всего до 8000 (с конца). */
export function sanitizeHistory(raw: unknown): HistoryMsg[] {
  const msgs = (Array.isArray(raw) ? raw : [])
    .slice(-HISTORY_MAX_MESSAGES)
    .filter(
      (m): m is HistoryMsg =>
        !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, HISTORY_MAX_MESSAGE_CHARS) }));
  const out: HistoryMsg[] = [];
  let total = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    total += msgs[i].content.length;
    if (total > HISTORY_MAX_CHARS) break;
    out.unshift(msgs[i]);
  }
  return out;
}

/** Текст про стиль объяснений для промпта (по умолчанию — коротко). */
export function styleRule(style: string): string {
  return STYLES[style] ?? STYLES.short;
}

/** Допустимые классы профиля (5–11 и «другое»); всё остальное — пустая строка. */
const GRADES = ["5", "6", "7", "8", "9", "10", "11", "other"];
const grade = (v: unknown): string => (typeof v === "string" && GRADES.includes(v) ? v : "");

export function sanitizeContext(raw: unknown): StudentContext & WithTrack {
  const c = (raw ?? {}) as Record<string, unknown>;
  const mistakes = Array.isArray(c.mistakes)
    ? c.mistakes.slice(0, 6).map((m) => {
        const o = (m ?? {}) as Record<string, unknown>;
        return { q: str(o.q, 220), given: str(o.given, 80), expected: str(o.expected, 80) };
      })
    : [];
  return {
    name: str(c.name, 40),
    lang: lang(c.lang),
    grade: grade(c.grade),
    track: c.track === "school" ? "school" : "ent",
    goal: str(c.goal, 20),
    style: str(c.style, 20),
    level: num(c.level),
    xp: num(c.xp),
    streak: num(c.streak),
    weak: strArr(c.weak, 8, 60),
    strong: strArr(c.strong, 8, 60),
    mistakes,
    notes: str(c.notes, 800),
    lessons: strArr(c.lessons, 20, 80),
  };
}

export function sanitizeTask(raw: unknown): TaskContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Record<string, unknown>;
  return {
    prompt: str(t.prompt, 600),
    options: strArr(t.options, 8, 120),
    correct: str(t.correct, 200),
    secrets: clampSecrets(t.secrets),
    given: str(t.given, 200),
    explanation: str(t.explanation, 800),
    theory: str(t.theory, 1500),
    answered: t.answered === true,
    hint: str(t.hint, 500),
    whyWrong: str(t.whyWrong, 600),
    stepKey: str(t.stepKey, 80),
    ide: str(t.ide, 40),
    code: str(t.code, 2000),
    error: str(t.error, 500),
  };
}

/** Проверяет dataURL картинки: только jpeg/png/webp и не больше ~4 МБ. */
export function sanitizeImage(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > 4_000_000) return undefined;
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) return undefined;
  return v;
}

const GOALS: Record<string, string> = {
  ent: "сдать ЕНТ по информатике на высокий балл",
  school: "подтянуть школьную информатику",
  interest: "учится из интереса",
};

const STYLES: Record<string, string> = {
  short: "коротко и по делу: правило + один пример, 2–5 предложений",
  examples: "через аналогии из жизни и несколько примеров",
  steps: "пошагово, нумерованными шагами, без пропусков переходов",
};

/** Строка про режим обучения: школьная программа или подготовка к ЕНТ; младшим классам — простой язык. */
function trackLine(c: StudentContext & Partial<WithTrack>): string {
  const small = ["5", "6", "7"].includes(c.grade);
  const base =
    c.track === "school"
      ? `Режим: школьная программа информатики Казахстана${c.grade && c.grade !== "other" ? `, ${c.grade} класс` : ""} — объясняй в рамках школьной программы, без упора на формат ЕНТ.`
      : "Режим: подготовка к ЕНТ по информатике.";
  return small ? `${base} Ученик младших классов: простые слова, короткие предложения, бытовые примеры.` : base;
}

/** Блок с данными ученика для системного промпта. */
export function renderContext(c: StudentContext & Partial<WithTrack>): string {
  const lines = [
    `Имя: ${c.name || "не указано"}; класс: ${c.grade || "?"}; цель: ${GOALS[c.goal] ?? c.goal}.`,
    trackLine(c),
    `Предпочитаемый стиль объяснений: ${STYLES[c.style] ?? c.style}.`,
    `Уровень ${c.level}, опыт ${c.xp} XP, серия ${c.streak} дн.`,
  ];
  if (c.lessons.length) lines.push(`Пройденные уроки: ${c.lessons.join("; ")}.`);
  if (c.weak.length) lines.push(`Слабые темы: ${c.weak.join("; ")}.`);
  if (c.strong.length) lines.push(`Сильные темы: ${c.strong.join("; ")}.`);
  if (c.mistakes.length) {
    lines.push("Недавние ошибки:");
    for (const m of c.mistakes) lines.push(`- «${m.q}» — ответ ученика «${m.given}», верно «${m.expected}»`);
  }
  if (c.notes) lines.push(`Заметки ученика из конспекта:\n${c.notes}`);
  return lines.join("\n");
}

// ---------- Бюджет входа одного запроса (v0.9.1) ----------
// Размер входа считаем в символах (токены без токенизатора не посчитать): системный промпт + данные ученика + задание +
// история. Бюджеты — INPUT_BUDGET в server/openai.ts. Потолки полей выше заданы так, что обычный запрос укладывается без
// обрезки; сюда попадают только тяжёлые: длинный чат с большим конспектом и списком ошибок.

/** Сумма длин текстов сообщений истории. */
export function historyChars(history: readonly HistoryMsg[]): number {
  return history.reduce((sum, m) => sum + m.content.length, 0);
}

/** Размер текстового входа готового запроса к модели: строки и текстовые части (картинка не считается). */
export function messagesChars(messages: ReadonlyArray<{ content?: unknown }>): number {
  let n = 0;
  for (const m of messages) {
    if (typeof m.content === "string") n += m.content.length;
    else if (Array.isArray(m.content)) {
      for (const p of m.content as { type?: string; text?: unknown }[]) if (p?.type === "text" && typeof p.text === "string") n += p.text.length;
    }
  }
  return n;
}

/** Убрать с конца текста `over` символов (не больше длины). */
export function clipEnd(text: string, over: number): string {
  return over <= 0 ? text : text.slice(0, Math.max(0, text.length - over)).trimEnd();
}

/** Остаток текста короче этого не оставляем: пустым он полезнее, чем обрывком в пару слов. */
const MIN_KEEP_CHARS = 40;

/** Один шаг ужатия контекста: вернуть укороченный контекст или null, если в этой части ужимать уже нечего. */
type ShrinkStep = <C extends StudentContext>(ctx: C, over: number) => C | null;

/** Укорачивает заметки ученика с конца; остаток короче MIN_KEEP_CHARS убирается целиком. */
const cutNotes: ShrinkStep = (ctx, over) => {
  const s = ctx.notes;
  if (!s) return null;
  return { ...ctx, notes: s.length - over < MIN_KEEP_CHARS ? "" : clipEnd(s, over) };
};

/** Убирает по одному элементу с конца списка. */
const dropLast =
  (key: "mistakes" | "lessons" | "strong" | "weak"): ShrinkStep =>
  (ctx) =>
    ctx[key].length ? { ...ctx, [key]: ctx[key].slice(0, -1) } : null;

/**
 * Необязательные части контекста — с конца блока «ДАННЫЕ УЧЕНИКА» (renderContext): заметки ученика,
 * ошибки, пройденные уроки, сильные и слабые темы. Основа (имя, класс, режим, цель, стиль, уровень) не трогается.
 */
const SHRINK_STEPS: ShrinkStep[] = [cutNotes, dropLast("mistakes"), dropLast("lessons"), dropLast("strong"), dropLast("weak")];

export interface FitResult<C extends StudentContext> {
  ctx: C;
  history: HistoryMsg[];
  /** Размер входа после ужатия (символы). Больше бюджета — только если не поддаётся ужатию (правила + задание + последний вопрос). */
  chars: number;
  /** Вход пришлось укоротить. */
  trimmed: boolean;
}

/**
 * Укладывает вход одного запроса в бюджет (символы). Чистая функция: ничего не мутирует, маленький запрос возвращает
 * как есть (те же объекты). Порядок ужатия:
 * 1) отбрасываем самые старые сообщения истории — последнее (вопрос ученика, до 2000 символов) остаётся целиком;
 * 2) укорачиваем необязательные части контекста с конца: заметки, ошибки, уроки, сильные и слабые темы.
 * Системные правила и задание не трогаем — они внутри `base`.
 * base(ctx) — размер всего входа, КРОМЕ истории, для данного контекста (длина системного промпта и прочего текста).
 */
export function fitInput<C extends StudentContext>(a: {
  budget: number;
  ctx: C;
  history: HistoryMsg[];
  base: (ctx: C) => number;
}): FitResult<C> {
  let { ctx, history } = a;
  let chars = a.base(ctx) + historyChars(history);
  if (chars <= a.budget) return { ctx, history, chars, trimmed: false };

  let from = 0;
  while (chars > a.budget && history.length - from > 1) chars -= history[from++].content.length;
  history = history.slice(from);

  for (const step of SHRINK_STEPS) {
    while (chars > a.budget) {
      const next = step(ctx, chars - a.budget);
      if (!next) break;
      ctx = next;
      chars = a.base(ctx) + historyChars(history);
    }
  }
  return { ctx, history, chars, trimmed: true };
}

/** Сводка по уроку для отзыва ИИ не длиннее: ошибки отбрасываются с конца (остаётся хотя бы одна). */
export const FEEDBACK_SUMMARY_MAX_CHARS = 2500;

/**
 * Сводка по только что пройденному уроку для /api/ai/lesson-feedback (недоверенные данные с клиента → текст).
 * Не длиннее FEEDBACK_SUMMARY_MAX_CHARS: иначе длинные ошибки вытеснили бы из бюджета входа данные ученика.
 */
export function feedbackSummary(body: Record<string, unknown>): string {
  const mistakes = (Array.isArray(body.mistakes) ? body.mistakes : []).slice(0, 10).map((m) => {
    const o = (m ?? {}) as Record<string, unknown>;
    return `- «${str(o.q, 200)}» — ответ «${str(o.given, 60)}», верно «${str(o.expected, 60)}»`;
  });
  const skills = (Array.isArray(body.skills) ? body.skills : []).slice(0, 10).map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    return `- ${str(o.title, 60)}: ${Math.round((Number(o.mastery) || 0) * 100)}%`;
  });
  const build = (list: string[]) =>
    [
      `Урок: ${str(body.lesson, 120)}`,
      `Точность: ${Math.round((Number(body.accuracy) || 0) * 100)}%`,
      `Время: ${Math.round((Number(body.durationSec) || 0) / 60)} мин`,
      list.length ? `Ошибки:\n${list.join("\n")}` : "Ошибок не было.",
      skills.length ? `Освоение тем после урока:\n${skills.join("\n")}` : "",
    ].join("\n");
  let list = mistakes;
  while (list.length > 1 && build(list).length > FEEDBACK_SUMMARY_MAX_CHARS) list = list.slice(0, -1);
  return build(list);
}
