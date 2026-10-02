import type { GameMode } from "@/games/types";
import { draw, skillsWithShape } from "@/lib/bank";
import { hashString, plainText, seeded, shuffle, tx } from "@/lib/text";
import type { ChoiceStep, Lang, Level, QuestionStep, SkillId } from "@/lib/types";

// Чистая логика «Бинго»: сборка карточки из верных ответов choice-заданий, очередь вопросов, линии, очки. Без React.

/** Навыки по умолчанию (совпадают с GameMeta.skills в реестре). */
export const DEFAULT_SKILLS: SkillId[] = ["ns.bin2dec", "ns.dec2bin", "ns.base", "ns.props"];
/** Самый длинный ответ на клетке (после plainText), символов. */
export const MAX_ANSWER_LEN = 16;
/** Размеры карточки: 4 × 4, запасной — 3 × 3. */
export const BIG = 4;
export const SMALL = 3;
/** Блиц: общее время, мс. */
export const BLITZ_MS = 120_000;
/** Обычный темп: время на вопрос по уровню A/B/C, секунд. */
export const NORMAL_SEC: Record<Level, number> = { 1: 30, 2: 45, 3: 60 };
/** Множитель очков по уровню задания. */
export const LEVEL_MULT: Record<Level, number> = { 1: 1, 2: 1.5, 3: 2 };
/** Очки за верную клетку (до множителя). */
export const CELL_POINTS = 10;
/** Бонус за каждую собранную линию. */
export const LINE_BONUS = 50;
/** Бонус за полную карточку. */
export const FULL_BONUS = 100;

export interface BingoCell {
  /** Короткий ответ, как на клетке. */
  answer: string;
  /** Вопрос, ответом на который эта клетка является (ровно один). */
  step: ChoiceStep;
  skill: SkillId;
  level: Level;
}

export interface BingoCard {
  /** Сторона квадрата: 4 или 3. */
  size: number;
  /** size * size клеток по строкам. */
  cells: BingoCell[];
}

/** Нормализация для сравнения ответов (повторяющиеся — пропускаем). */
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Верный ответ choice-задания как короткий текст клетки; null — не подходит (длинный, пустой, не choice). */
export function cellAnswer(step: QuestionStep, lang: Lang): string | null {
  if (step.type !== "choice") return null;
  const raw = step.options[step.correct];
  if (raw === undefined) return null;
  const a = plainText(tx(raw, lang)).trim();
  if (!a || a.length > MAX_ANSWER_LEN) return null;
  return a;
}

const RU_LETTER = "а-яёa-z";
const KK_LETTER = "а-яёәіңғүұқөһa-z";
/** «НЕ …», «лишнее» и вопросы-выбор «какое из (чисел / перечисленного)», «что подходит», «остальные скрыты». */
const RU_AMBIGUOUS = new RegExp(
  `(^|[^${RU_LETTER}])(не|лишн\\S*|исключ\\S*|подход\\S*|скрыт\\S*|(какое|какой|какая|какие|какого|каком|какому|что|кто|чего|чему) из)([^${RU_LETTER}]|$)`,
  "i",
);
const KK_AMBIGUOUS = new RegExp(`(^|[^${KK_LETTER}])(емес|артық|қайсы\\S*|төменде\\S*|жасырыл\\S*)([^${KK_LETTER}]|$)`, "i");

/**
 * Неоднозначные для бинго вопросы: «что НЕ …», «лишнее» и вопросы-выбор, ответ которых имеет смысл
 * только среди своих вариантов («Какое из чисел наибольшее?», «Какое выражение подходит?»). На карточке
 * у них может быть несколько верных клеток, а сами варианты ученик не видит — каждая клетка должна быть
 * ответом ровно одного вопроса. Проверяем обе языковые версии условия.
 */
export function isAmbiguousPrompt(step: QuestionStep): boolean {
  return RU_AMBIGUOUS.test(plainText(step.prompt.ru)) || KK_AMBIGUOUS.test(plainText(step.prompt.kk));
}

/** Собирает до 16 подходящих клеток (разные ответы и разные вопросы) из банка по навыкам. Порядок — от seed. */
export function collectCells(skills: SkillId[], lang: Lang, seed: number): BingoCell[] {
  const pool = skillsWithShape(skills, "question");
  if (!pool.length) return [];
  const order = shuffle(pool, seeded(hashString(`${seed}:order`)));
  const answers = new Set<string>();
  const keys = new Set<string>();
  /** Одинаковые условия без сцены (разные варианты) для ученика — один и тот же вопрос. */
  const prompts = new Set<string>();
  const out: BingoCell[] = [];
  const need = BIG * BIG;
  for (let round = 0; round < 14 && out.length < need; round++) {
    for (let si = 0; si < order.length && out.length < need; si++) {
      const level = (1 + ((round + si) % 3)) as Level;
      const items = draw("question", {
        skills: [order[si]],
        count: 5,
        seed: hashString(`${seed}:${round}:${si}`),
        minLevel: level,
        maxLevel: level,
        ramp: false,
      });
      for (const s of items) {
        if (out.length >= need) break;
        const a = cellAnswer(s, lang);
        if (a === null || s.type !== "choice" || isAmbiguousPrompt(s)) continue;
        const key = s.id.split("#")[0].split(":").slice(0, 4).join(":");
        const prompt = s.scene ? null : norm(plainText(s.prompt.ru));
        if (keys.has(key) || answers.has(norm(a)) || (prompt !== null && prompts.has(prompt))) continue;
        keys.add(key);
        if (prompt !== null) prompts.add(prompt);
        answers.add(norm(a));
        out.push({ answer: a, step: s, skill: s.skill ?? order[si], level: s.level ?? level });
      }
    }
  }
  return out;
}

/** Карточка: 4 × 4 при ≥ 16 ответов, 3 × 3 при ≥ 9, иначе null («мало заданий»). Клетки перемешаны по seed. */
export function buildCard(skills: SkillId[], lang: Lang, seed: number): BingoCard | null {
  const cells = collectCells(skills, lang, seed);
  const size = cells.length >= BIG * BIG ? BIG : cells.length >= SMALL * SMALL ? SMALL : 0;
  if (!size) return null;
  const rand = seeded(hashString(`${seed}:grid`));
  return { size, cells: shuffle(cells.slice(0, size * size), rand) };
}

/** Все линии квадрата: строки, столбцы, две диагонали (индексы клеток). */
export function linesOf(size: number): number[][] {
  const lines: number[][] = [];
  for (let r = 0; r < size; r++) lines.push(Array.from({ length: size }, (_, c) => r * size + c));
  for (let c = 0; c < size; c++) lines.push(Array.from({ length: size }, (_, r) => r * size + c));
  lines.push(Array.from({ length: size }, (_, i) => i * size + i));
  lines.push(Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)));
  return lines;
}

/** Индексы собранных линий (все клетки отмечены). */
export function completedLines(marked: readonly boolean[], size: number): number[] {
  return linesOf(size).flatMap((line, i) => (line.every((k) => marked[k]) ? [i] : []));
}

/** Время на вопрос, мс: только в обычном темпе. */
export function taskBudgetMs(mode: GameMode, level: Level): number | null {
  return mode === "normal" ? NORMAL_SEC[level] * 1000 : null;
}

export interface BingoState {
  card: BingoCard;
  /** Порядок вопросов: индексы клеток. */
  queue: number[];
  /** Сколько вопросов уже задано и отвечено. */
  pos: number;
  marked: boolean[];
  /** Клетки, на вопросы которых ответили неверно. */
  missed: boolean[];
  /** Собранные линии (индексы из linesOf). */
  lines: number[];
  score: number;
  correct: number;
  total: number;
  attempts: { skill: SkillId; correct: boolean }[];
}

export function initialState(card: BingoCard, seed: number): BingoState {
  const n = card.cells.length;
  const queue = shuffle(
    Array.from({ length: n }, (_, i) => i),
    seeded(hashString(`${seed}:queue`)),
  );
  return { card, queue, pos: 0, marked: Array(n).fill(false), missed: Array(n).fill(false), lines: [], score: 0, correct: 0, total: 0, attempts: [] };
}

/** Клетка текущего вопроса; null — вопросы кончились. */
export function currentCell(state: BingoState): number | null {
  return state.pos < state.queue.length ? state.queue[state.pos] : null;
}

export function isDone(state: BingoState): boolean {
  return state.pos >= state.queue.length;
}

export interface AnswerOutcome {
  state: BingoState;
  correct: boolean;
  gained: number;
  /** Часть gained, которая — бонус за линии и полную карточку. */
  bonus: number;
  /** Номера линий, собранных этим ответом. */
  newLines: number[];
  full: boolean;
}

/** Ответ: нажатая клетка (null — время вышло). Верно, только если нажата клетка текущего вопроса. */
export function applyAnswer(state: BingoState, tapped: number | null): AnswerOutcome {
  const cur = currentCell(state);
  if (cur === null) return { state, correct: false, gained: 0, bonus: 0, newLines: [], full: false };
  const cell = state.card.cells[cur];
  const correct = tapped === cur;
  const attempts = [...state.attempts, { skill: cell.skill, correct }];
  const base = { ...state, attempts, total: state.total + 1, pos: state.pos + 1 };
  if (!correct) {
    const missed = state.missed.slice();
    missed[cur] = true;
    return { state: { ...base, missed }, correct: false, gained: 0, bonus: 0, newLines: [], full: false };
  }
  const marked = state.marked.slice();
  marked[cur] = true;
  const lines = completedLines(marked, state.card.size);
  const newLines = lines.filter((i) => !state.lines.includes(i));
  const full = marked.every(Boolean);
  const bonus = newLines.length * LINE_BONUS + (full ? FULL_BONUS : 0);
  const gained = Math.round(CELL_POINTS * LEVEL_MULT[cell.level]) + bonus;
  return {
    state: { ...base, marked, lines, score: state.score + gained, correct: state.correct + 1 },
    correct: true,
    gained,
    bonus,
    newLines,
    full,
  };
}

/** Результат для onFinish. */
export function toResult(state: BingoState) {
  return { score: state.score, correct: state.correct, total: state.total, attempts: state.attempts.slice() };
}

export function emptyResult() {
  return { score: 0, correct: 0, total: 0, attempts: [] as { skill: SkillId; correct: boolean }[] };
}

/** Навыки игры: переданные или по умолчанию — только те, что умеют выдавать вопросы. */
export function resolveSkills(skills?: SkillId[]): SkillId[] {
  const wanted = skills && skills.length > 0 ? skills : DEFAULT_SKILLS;
  return skillsWithShape(wanted, "question");
}
