import { SKILLS } from "@/content/skills";
import type { GameMode } from "@/games/types";
import { isSupported, stepKey, type TowerStep } from "@/games/tower/logic";
import { draw, rampLevel, skillsWithShape } from "@/lib/bank";
import type { SkillStat } from "@/lib/mastery";
import { hashString, seeded, shuffle } from "@/lib/text";
import type { Answer } from "@/lib/evaluate";
import type { EntTopicId, L, Level, QuestionStep, SkillId } from "@/lib/types";

// Чистая логика «Босс-битвы»: сборка босса из слабых навыков, урон, ходы, очки. Без React.

export const DEFAULT_SKILLS: SkillId[] = ["ns.bin2dec", "ns.dec2bin", "ns.base", "ns.props"];
export const BOSS_HP = 100;
export const BIG_HP = 150;
/** Урон по уровню задания A / B / C. */
export const DAMAGE: Record<Level, number> = { 1: 20, 2: 30, 3: 40 };
/** Босс восстанавливает при ошибке. */
export const HEAL = 10;
export const MAX_TURNS = 12;
export const BLITZ_MS = 180_000;
export const NORMAL_SEC: Record<Level, number> = { 1: 30, 2: 45, 3: 60 };
export const WEAK_COUNT = 3;
/** Бонус за победу: базовый + за каждый оставшийся ход (blitz — за секунду). */
export const WIN_BONUS = 50;
export const TURN_BONUS = 5;

export type BossKind = "weak" | "big";
export type EndKind = "win" | "retreat" | "time" | "pool";

export function resolveSkills(skills?: SkillId[]): SkillId[] {
  const wanted = skills && skills.length > 0 ? skills : DEFAULT_SKILLS;
  // Навыки из URL — недоверенные: без повторов (иначе босс из «трёх» одинаковых навыков).
  return skillsWithShape([...new Set(wanted)], "question");
}

/** Часовой пояс Казахстана (UTC+5): неделя начинается в понедельник 00:00 по местному времени. */
const KZ_OFFSET_MS = 5 * 3_600_000;
const DAY_MS = 86_400_000;

/** Номер недели с начала эпохи (seed большого босса): у всех один и тот же на неделе. */
export function weekNumber(date: Date = new Date()): number {
  // 1 января 1970 — четверг: +3 дня сдвигают границу недели на понедельник.
  return Math.floor((Math.floor((date.getTime() + KZ_OFFSET_MS) / DAY_MS) + 3) / 7);
}

/** Номер недели в году по ISO 8601 (1–53) — для показа ученику. */
export function weekOfYear(date: Date = new Date()): number {
  const d = new Date(date.getTime() + KZ_OFFSET_MS);
  const day = (d.getUTCDay() + 6) % 7; // пн = 0
  const thursday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3);
  const yearStart = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return 1 + Math.floor((thursday - yearStart) / DAY_MS / 7);
}

/**
 * Три слабейших навыка: сначала те, по которым есть статистика (от меньшего освоения), затем случайные
 * (от seed) — если данных нет. Первый в списке — самый слабый.
 */
export function pickWeakSkills(skills: SkillId[], stats: Record<string, SkillStat | undefined>, seed: number, count = WEAK_COUNT): SkillId[] {
  // Статистика из localStorage — недоверенная: битое освоение считаем «нет данных».
  const m = (s: SkillId): number | null => {
    const st = stats[s];
    return st && Number(st.attempts) > 0 && Number.isFinite(st.mastery) ? st.mastery : null;
  };
  const known = skills.filter((s) => m(s) !== null).sort((a, b) => m(a)! - m(b)! || (a < b ? -1 : 1));
  const rest = shuffle(skills.filter((s) => !known.includes(s)), seeded(seed));
  return [...known, ...rest].slice(0, count);
}

/** Тема ЕНТ навыка (для имени босса). */
export function topicOfSkill(skill: SkillId): EntTopicId {
  return SKILLS.find((s) => s.id === skill)?.ent ?? "t04";
}

/** Здоровье босса. */
export const bossHp = (kind: BossKind): number => (kind === "big" ? BIG_HP : BOSS_HP);

/** Число ходов (null — без лимита, блиц). */
export const maxTurns = (mode: GameMode): number | null => (mode === "blitz" ? null : MAX_TURNS);

/** Уровень хода (0-based): обычный босс растёт A→C, большой — B–C. */
export function turnLevel(turn: number, kind: BossKind): Level {
  const i = Math.min(turn, MAX_TURNS - 1);
  return kind === "big" ? rampLevel(i, MAX_TURNS, 2, 3) : rampLevel(i, MAX_TURNS, 1, 3);
}

export const taskLevel = (step: QuestionStep, turn: number, kind: BossKind): Level => step.level ?? turnLevel(turn, kind);

export function taskBudgetMs(mode: GameMode, level: Level): number | null {
  return mode === "normal" ? NORMAL_SEC[level] * 1000 : null;
}

export function damageFor(level: Level): number {
  return DAMAGE[level];
}

function levelOrder(level: Level): Level[] {
  const all: Level[] = [1, 2, 3];
  return all.sort((a, b) => Math.abs(a - level) - Math.abs(b - level) || a - b);
}

export interface PickOptions {
  skills: SkillId[];
  turn: number;
  kind: BossKind;
  seed: number;
  used: readonly string[];
  lastKey?: string;
}

/** Задание хода: нужного уровня и новое; иначе соседних уровней; иначе повтор (не подряд). null — банка нет. */
export function pickTurnTask(o: PickOptions): TowerStep | null {
  const pool = skillsWithShape(o.skills, "question");
  if (!pool.length) return null;
  const order = shuffle(pool, seeded(hashString(`${o.seed}:${o.turn}:skills`)));
  const tries = Math.max(order.length, 4);
  const levels = o.kind === "big" ? levelOrder(turnLevel(o.turn, o.kind)).filter((l) => l >= 2).concat([1]) : levelOrder(turnLevel(o.turn, o.kind));
  const used = new Set(o.used);
  for (const pass of ["fresh", "repeat", "any"] as const) {
    for (const level of levels) {
      for (let k = 0; k < tries; k++) {
        const skill = order[k % order.length];
        const items = draw("question", {
          skills: [skill],
          count: 4,
          seed: hashString(`${o.seed}:${o.turn}:${level}:${k}`),
          minLevel: level,
          maxLevel: level,
          ramp: false,
        });
        const found = items.find((s) => {
          if (!isSupported(s)) return false;
          if (pass === "any") return true;
          const key = stepKey(s);
          if (key === o.lastKey) return false;
          return pass === "repeat" || !used.has(key);
        });
        if (found) return { ...(found as TowerStep), skill: found.skill ?? skill };
      }
    }
  }
  return null;
}

export interface BossAttempt {
  skill: SkillId;
  correct: boolean;
}

export interface BossState {
  kind: BossKind;
  hp: number;
  maxHp: number;
  /** Сколько ходов сделано. */
  turn: number;
  /** Нанесено урона всего (без учёта восстановления). */
  dealt: number;
  healed: number;
  score: number;
  correct: number;
  total: number;
  attempts: BossAttempt[];
  used: string[];
  taskNo: number;
  lastKey?: string;
}

export function initialState(kind: BossKind): BossState {
  const maxHp = bossHp(kind);
  return { kind, hp: maxHp, maxHp, turn: 0, dealt: 0, healed: 0, score: 0, correct: 0, total: 0, attempts: [], used: [], taskNo: 0 };
}

export const isDefeated = (s: BossState): boolean => s.hp <= 0;

/** Ходы кончились (calm / normal). */
export function outOfTurns(s: BossState, mode: GameMode): boolean {
  const lim = maxTurns(mode);
  return lim !== null && s.turn >= lim;
}

export function drawNext(state: BossState, skills: SkillId[], seed: number): { state: BossState; step: TowerStep } | null {
  const step = pickTurnTask({ skills, turn: state.turn, kind: state.kind, seed: hashString(`${seed}:${state.taskNo}`), used: state.used, lastKey: state.lastKey });
  if (!step) return null;
  const key = stepKey(step);
  return { state: { ...state, used: [...state.used, key], taskNo: state.taskNo + 1, lastKey: key }, step };
}

export interface AnswerOutcome {
  state: BossState;
  /** Нанесённый урон (0 при ошибке). */
  damage: number;
  /** На сколько босс восстановился (0 при верном). */
  healed: number;
}

/** Верно — урон по уровню; ошибка — босс +10 (не выше максимума). Каждый ответ — ход. */
export function applyAnswer(state: BossState, step: QuestionStep, correct: boolean): AnswerOutcome {
  const attempts = [...state.attempts, { skill: step.skill ?? "", correct }];
  const base = { ...state, attempts, total: state.total + 1, turn: state.turn + 1 };
  if (!correct) {
    const hp = Math.min(state.maxHp, state.hp + HEAL);
    const healed = hp - state.hp;
    return { state: { ...base, hp, healed: state.healed + healed }, damage: 0, healed };
  }
  const dmg = damageFor(taskLevel(step, state.turn, state.kind));
  const damage = Math.min(dmg, state.hp);
  return {
    state: { ...base, hp: state.hp - damage, dealt: state.dealt + damage, score: state.score + damage, correct: state.correct + 1 },
    damage,
    healed: 0,
  };
}

/** Бонус к очкам за победу (только если босс побеждён). */
export function winBonus(state: BossState, mode: GameMode, remainMs = 0): number {
  if (!isDefeated(state)) return 0;
  if (mode === "blitz") return WIN_BONUS + Math.floor(Math.max(0, remainMs) / 1000);
  return WIN_BONUS + Math.max(0, MAX_TURNS - state.turn) * TURN_BONUS;
}

/** Почему неверен выбранный вариант (choice / multi) — бесплатный разбор в спокойном темпе. */
export function whyWrongOf(step: QuestionStep, answer: Answer | null): L | null {
  if (!answer) return null;
  let idx = -1;
  if (step.type === "choice" && answer.type === "choice") idx = answer.index;
  if (step.type === "multi" && answer.type === "multi") idx = answer.indices.find((i) => !step.correct.includes(i)) ?? -1;
  if (idx < 0 || (step.type !== "choice" && step.type !== "multi")) return null;
  return step.whyWrong?.[idx] ?? null;
}

export function toResult(state: BossState, bonus = 0) {
  return { score: state.score + bonus, correct: state.correct, total: state.total, attempts: state.attempts.slice() };
}
