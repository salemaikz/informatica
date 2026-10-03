import "server-only";
import type { StudentContext, TaskContext } from "@/lib/ai-types";
import type { Lang } from "@/lib/types";
import type { WithTrack } from "@/lib/school";

// Всё, что пришло с клиента, — недоверенные данные: обрезаем длины и типы.

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const strArr = (v: unknown, maxItems: number, maxLen: number): string[] =>
  Array.isArray(v) ? v.slice(0, maxItems).map((x) => str(x, maxLen)).filter(Boolean) : [];

export function lang(v: unknown): Lang {
  return v === "kk" ? "kk" : "ru";
}

/**
 * Запрос пришёл с нашего же сайта? Если заголовок Origin есть, его хост должен совпасть с Host
 * (или x-forwarded-host за прокси). Нет Origin — пропускаем (старые клиенты, curl в dev).
 * Закрывает использование нашего ИИ чужими сайтами.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
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
    memory: str(c.memory, 1500),
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
    for (const m of c.mistakes) lines.push(`- «${m.q}» — ответил «${m.given}», верно «${m.expected}»`);
  }
  if (c.memory) lines.push(`Заметки наставника об ученике (память):\n${c.memory}`);
  if (c.notes) lines.push(`Заметки ученика из конспекта:\n${c.notes}`);
  return lines.join("\n");
}
