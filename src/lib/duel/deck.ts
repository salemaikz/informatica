import { draw, rampLevel } from "../bank";
import type { Statement } from "../bank/types";
import { hashString, seeded } from "../text";
import type { ChoiceStep, Level, QuestionStep, Text } from "../types";
import { DUEL_MODES, bandLevels, isDuelBand, isDuelMode, itemLimitMs } from "./modes";
import { bandSkills, topicSkills } from "./topics";
import type { DuelBand, DuelItem, DuelModeId, DuelTopic } from "./types";

// Лёгкие части (проверка ответа, темы) живут в check.ts и topics.ts — их берёт и клиент; здесь — реэкспорт для сервера.
export { checkAnswer, correctAnswer, isCorrect, optionCount } from "./check";
export { bandSkills, duelTopics, isDuelTopic, topicSkills } from "./topics";

// Набор заданий дуэли (docs/specs/duels.md §5): buildDeck(mode, seed, band, topic?) — чистая детерминированная функция,
// общая для клиента, сервера и бота. Задания — только из банка (draw), только формы «выбор» и «утверждение».
// Язык на выбор заданий не влияет. ВАЖНО: всё, от чего зависит набор, входит в deckTag (scripts/deck-tag.mjs):
// поменял этот файл или банк — у новой сборки другой тег, старые клиенты получат «Обнови страницу».

/** Тег версии набора: проставляет `node scripts/deck-tag.mjs next build`; без него (dev, тесты) — "dev". */
export const DECK_TAG: string = process.env.NEXT_PUBLIC_DECK_TAG || "dev";

/** Минимум вариантов у задания на выбор: при 2 вариантах случайное нажатие со штрафом +2/−1 было бы выгодно. */
export const MIN_OPTIONS = 3;

/** Уровни позиций набора: ступенька режима или плавный рост по полосе. */
export function deckLevels(mode: DuelModeId, band: DuelBand): Level[] {
  const m = DUEL_MODES[mode];
  if (m.ladder) return m.ladder.flatMap((count, li) => Array<Level>(count).fill((li + 1) as Level));
  const { min, max } = bandLevels(band);
  return Array.from({ length: m.n }, (_, i) => rampLevel(i, m.n, min, max));
}

const textRu = (t: Text): string => (typeof t === "string" ? t : t.ru);

function isDuelChoice(q: QuestionStep): q is ChoiceStep {
  return (
    q.type === "choice" &&
    Array.isArray(q.options) &&
    q.options.length >= MIN_OPTIONS &&
    Number.isInteger(q.correct) &&
    q.correct >= 0 &&
    q.correct < q.options.length
  );
}

/** Ключ для отсева повторов внутри набора (по видимому тексту, а не по id). */
function choiceDedupe(q: ChoiceStep): string {
  return `${q.prompt.ru}|${q.options.map(textRu).join("|")}`;
}

/** Сколько раз добираем уровень, если банк вернул мало подходящих заданий. */
const MAX_ATTEMPTS = 12;

/**
 * Набор заданий дуэли. Детерминирован по (mode, seed, band, topic); не зависит от языка.
 * Негодные параметры (неизвестный режим/полоса/тема) — пустой набор: вызывающий сверяет длину с DUEL_MODES[mode].n.
 */
export function buildDeck(mode: DuelModeId, seed: number, band: DuelBand, topic?: DuelTopic): DuelItem[] {
  if (!isDuelMode(mode) || !isDuelBand(band) || !Number.isFinite(seed)) return [];
  const meta = DUEL_MODES[mode];
  const skills = meta.needsTopic ? (topic ? topicSkills(topic) : []) : bandSkills(band);
  if (!skills.length) return [];
  const levels = deckLevels(mode, band);
  const base = hashString(`duel:${mode}:${seed >>> 0}:${band}:${meta.needsTopic ? topic : ""}`);

  // Сколько заданий каждого уровня нужно (уровни в наборе идут по возрастанию).
  const need: Record<Level, number> = { 1: 0, 2: 0, 3: 0 };
  for (const lv of levels) need[lv]++;

  const seen = new Set<string>();
  const byLevel: Record<Level, DuelItem[]> = { 1: [], 2: [], 3: [] };
  // «Верю — не верю»: ровно поровну «верно» и «неверно» на каждом уровне (нечётный остаток — по очереди между уровнями),
  // иначе «верю» на всё подряд без чтения приносит очки (§3). Порядок внутри уровня — перемешан по seed.
  let extraTrue = (base & 1) === 1;
  for (const lv of [1, 2, 3] as const) {
    if (meta.shape === "choice") {
      for (let attempt = 0; byLevel[lv].length < need[lv] && attempt < MAX_ATTEMPTS; attempt++) {
        const want = need[lv] - byLevel[lv].length;
        const opts = { skills, count: want * 3 + 4, seed: hashString(`${base}:${lv}:${attempt}`), minLevel: lv, maxLevel: lv, ramp: false };
        for (const q of draw("question", opts)) {
          if (byLevel[lv].length >= need[lv]) break;
          // Уровень задания должен совпасть с местом в ступеньке (генератор иногда отдаёт соседний).
          if (!isDuelChoice(q) || (q.level ?? lv) !== lv) continue;
          const k = choiceDedupe(q);
          if (seen.has(k)) continue;
          seen.add(k);
          byLevel[lv].push(choiceItem(mode, q, lv));
        }
      }
      continue;
    }
    if (!need[lv]) continue;
    const half = need[lv] >> 1;
    const want = { true: half, false: half };
    if (need[lv] % 2) {
      want[extraTrue ? "true" : "false"]++;
      extraTrue = !extraTrue;
    }
    const pools: Record<"true" | "false", Statement[]> = { true: [], false: [] };
    const spare: Statement[] = [];
    const full = () => pools.true.length >= want.true && pools.false.length >= want.false;
    for (let attempt = 0; !full() && attempt < MAX_ATTEMPTS; attempt++) {
      const missing = want.true - pools.true.length + want.false - pools.false.length;
      const opts = { skills, count: missing * 3 + 4, seed: hashString(`${base}:${lv}:${attempt}`), minLevel: lv, maxLevel: lv, ramp: false };
      for (const st of draw("statement", opts)) {
        if (typeof st.value !== "boolean" || st.level !== lv || seen.has(st.text.ru)) continue;
        seen.add(st.text.ru);
        const side = st.value ? "true" : "false";
        (pools[side].length < want[side] ? pools[side] : spare).push(st);
        if (full()) break;
      }
    }
    // Запасной путь (банк не дал нужного значения): добираем чем есть, лишь бы набор был полным.
    const picked = [...pools.true, ...pools.false, ...spare.slice(0, Math.max(0, need[lv] - pools.true.length - pools.false.length))];
    const rand = seeded(hashString(`${base}:${lv}:order`));
    for (let k = picked.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [picked[k], picked[j]] = [picked[j], picked[k]];
    }
    byLevel[lv] = picked.map((st) => statementItem(mode, st, lv));
  }
  const items = [...byLevel[1], ...byLevel[2], ...byLevel[3]];
  return items.map((it, i) => ({ ...it, i }));
}

function choiceItem(mode: DuelModeId, step: ChoiceStep, level: Level): DuelItem {
  return { i: 0, key: `q:${step.id}`, mode, skill: step.skill ?? "", level, limitMs: itemLimitMs(mode, level), shape: "choice", step };
}

function statementItem(mode: DuelModeId, st: Statement, level: Level): DuelItem {
  return { i: 0, key: `s:${st.id}`, mode, skill: st.skill, level, limitMs: itemLimitMs(mode, level), shape: "statement", statement: st };
}
