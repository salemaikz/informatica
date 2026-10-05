import type { EntItem, EntTopicId, ReadKind } from "./types";

// Задания «на чтение кода» (решение #87, этап 15). По опыту владельца (ЕНТ и репетиторство): практика на ЕНТ — это не
// «напиши программу», а «прочитай готовое»: что выведет, где ошибка, что поменять, что вставить, зачем строка; в БД —
// где первичный и внешний ключ. Здесь — вид такого задания и квота в варианте пробного ЕНТ. Чистая логика без React
// (тесты — tests/code-read.test.ts).

export const READ_KINDS: readonly ReadKind[] = ["output", "bug", "fix", "fill", "purpose", "schema"];

/** Темы, где «чтение» — главный вид практики: Python, алгоритмы, БД, SQL, электронные таблицы, веб. */
export const READ_TOPICS: readonly EntTopicId[] = ["t06", "t07", "t09", "t10", "t12", "t13"];

/**
 * Доля заданий темы в варианте, которые должны быть «на чтение» (#87). Python (t06) — все; алгоритмы, SQL и веб — две
 * трети (остальное — понятия: сортировки, графы, теги); БД и таблицы — половина (связи и ключи по схеме, формулы).
 * В полном варианте это 12 из 35 обычных заданий + 5 вопросов контекстного = 17 из 40.
 */
export const READ_SHARE: Partial<Record<EntTopicId, number>> = {
  t06: 1,
  t07: 2 / 3,
  t09: 1 / 2,
  t10: 2 / 3,
  t12: 1 / 2,
  t13: 2 / 3,
};

/** Сколько из n заданий темы должны быть «на чтение» (округление вверх: в мини-варианте одно задание темы — тоже чтение). */
export function readTarget(topic: EntTopicId, n: number): number {
  const share = READ_SHARE[topic] ?? 0;
  return n > 0 && share > 0 ? Math.min(n, Math.ceil(share * n - 1e-9)) : 0;
}

/** Контрольная по разделу: если в разделе есть задания «на чтение», не меньше половины single — они. */
export const UNIT_READ_SHARE = 0.5;
/** Раздел «практический», если таких заданий в нём не меньше этой доли. */
export const UNIT_READ_MIN_POOL = 0.2;

// ---------- Вид задания ----------

const RE: [ReadKind, RegExp][] = [
  ["bug", /ошибк|некорректн|не работает|не запускается|в какой строке/i],
  ["fix", /исправ|заменить|изменить|поменять|переставить|убрать|удалить строку|чтобы (программа|запрос|формула|страница|цикл|функция)/i],
  ["fill", /пропуск|вставить|дописать|допишите|впишите|вместо (многоточия|…|___|\?)/i],
  ["purpose", /зачем|для чего|что делает|какую роль|назначение строки/i],
  ["schema", /первичн|внешн|ключ|связ[ьию]|атрибут|сколько (полей|записей) в таблице/i],
];

/** Есть ли в задании материал для чтения: код, разметка, блок-схема, таблица БД или электронная таблица, формула в тексте. */
function hasMaterial(item: EntItem, prompt: string): boolean {
  if (item.kind === "context") return true;
  const scene = item.scene?.kind;
  if (scene === "code" || scene === "web" || scene === "flow") return true;
  if (scene === "table" && (item.topic === "t09" || item.topic === "t10" || item.topic === "t12")) return true;
  // Короткий код в тексте условия (`SELECT …`, `=СУММ(A1:A3)`, `<b>`) — только в «практических» темах.
  return READ_TOPICS.includes(item.topic) && /`[^`]+`/.test(prompt);
}

/**
 * Вид «чтения» по тексту условия (ru). Порядок важен: «ошибка» сильнее «поменять», «поменять» сильнее «вставить».
 * Ничего не подошло — «что выведет» (самый частый вид: сопоставить код и результат, выбрать верные утверждения о программе).
 */
export function inferReadKind(prompt: string, topic: EntTopicId): ReadKind {
  for (const [kind, re] of RE) {
    if (kind === "schema" && topic !== "t09" && topic !== "t10") continue;
    if (re.test(prompt)) return kind;
  }
  return topic === "t09" ? "schema" : "output";
}

/**
 * Вид «чтения» задания или вопроса контекстного задания (sub — номер вопроса); null — задание не «на чтение»
 * (понятие, определение, задача без кода и таблицы). Явное поле `read` главнее вывода по тексту.
 */
export function readKindOf(item: EntItem, sub?: number): ReadKind | null {
  if (item.kind === "context") {
    const q = item.questions[sub ?? 0];
    if (!q) return null;
    return q.read ?? inferReadKind(q.prompt.ru, item.topic);
  }
  if (item.read) return item.read;
  const prompt = item.prompt.ru;
  return hasMaterial(item, prompt) ? inferReadKind(prompt, item.topic) : null;
}

/** Задание (не контекстное) — «на чтение». */
export const isReadItem = (item: EntItem): boolean => item.kind !== "context" && readKindOf(item) !== null;

/**
 * Из кандидатов одного уровня — те, чей вид «чтения» встречался в варианте реже всего (разнообразие: не три
 * «что выведет» подряд, а вывод, ошибка, исправление). Кандидаты без вида — как есть.
 */
export function leastUsedRead<T extends EntItem>(cands: T[], used: ReadonlyMap<ReadKind, number>): T[] {
  const kinds = cands.map((c) => readKindOf(c));
  const uses = kinds.map((k) => (k ? (used.get(k) ?? 0) : Infinity));
  const min = Math.min(...uses);
  if (!Number.isFinite(min)) return cands;
  return cands.filter((_, i) => uses[i] === min);
}

/** Сколько заданий каждого вида «чтения» в наборе (для статистики и тестов). */
export function readStats(items: readonly EntItem[]): Record<ReadKind | "none", number> {
  const out: Record<ReadKind | "none", number> = { output: 0, bug: 0, fix: 0, fill: 0, purpose: 0, schema: 0, none: 0 };
  for (const it of items) {
    if (it.kind === "context") {
      it.questions.forEach((_, sub) => out[readKindOf(it, sub) ?? "none"]++);
    } else out[readKindOf(it) ?? "none"]++;
  }
  return out;
}
