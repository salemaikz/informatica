import "server-only";
import type { StudentContext, TaskContext } from "@/lib/ai-types";
import type { Lang } from "@/lib/types";

// Всё, что пришло с клиента, — недоверенные данные: обрезаем длины и типы.

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const strArr = (v: unknown, maxItems: number, maxLen: number): string[] =>
  Array.isArray(v) ? v.slice(0, maxItems).map((x) => str(x, maxLen)).filter(Boolean) : [];

export function lang(v: unknown): Lang {
  return v === "kk" ? "kk" : "ru";
}

export function sanitizeContext(raw: unknown): StudentContext {
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
    grade: str(c.grade, 10),
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
  };
}

/** Проверяет dataURL картинки: только jpeg/png/webp и не больше ~4 МБ. */
export function sanitizeImage(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) return undefined;
  if (v.length > 4_000_000) return undefined;
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

/** Блок с данными ученика для системного промпта. */
export function renderContext(c: StudentContext): string {
  const lines = [
    `Имя: ${c.name || "не указано"}; класс: ${c.grade || "?"}; цель: ${GOALS[c.goal] ?? c.goal}.`,
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
