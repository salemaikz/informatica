import type { L } from "./types";
import { dayDiff } from "./text";
import { gamifyDict } from "@/i18n/parts/gamify";
import type { Rarity } from "./rarity";

// ---------- XP ----------

export const XP = {
  correct: 10,
  retryCorrect: 5,
  comboBonus: 5, // за ответ при комбо ≥ 3
  lessonComplete: 20,
  perfectLesson: 20,
  drillComplete: 10,
} as const;

/**
 * Награда за прохождение — по длине (этап 14, #46): короткий (до 5 заданий, микроурок) — 0,6, обычный (6–9) — 1,
 * длинный (10 и больше: практика, повторение) — 1,5. Обычные уроки (6–9 заданий) получают ровно как раньше.
 */
export const LENGTH_SHORT_MAX = 5;
export const LENGTH_LONG_MIN = 10;
export function lengthFactor(questions: number): number {
  if (questions <= LENGTH_SHORT_MAX) return 0.6;
  if (questions >= LENGTH_LONG_MIN) return 1.5;
  return 1;
}

/**
 * Множитель награды за прохождение (#83). Урок: микроурок — 0,6, остальные — 1 (вставленные задания ЕНТ и задача
 * с кодом урок «длинным» не делают). Тренировка: короткая — 0,6; 1,5 — только практика и повторение курса 3.0.
 */
export function rewardFactor(r: { kind: "lesson" | "drill"; mode?: string; planned?: number; micro?: boolean }): number {
  if (r.kind === "lesson") return r.micro ? lengthFactor(1) : 1;
  if (!r.planned) return 1;
  const f = lengthFactor(r.planned);
  return r.mode === "practice" || r.mode === "recap" ? f : Math.min(1, f);
}

export function xpForAnswer(correct: boolean, retry: boolean, combo: number): number {
  if (!correct) return 0;
  if (retry) return XP.retryCorrect;
  return XP.correct + (combo >= 3 ? XP.comboBonus : 0);
}

// ---------- Уровни ----------
// Уровень n начинается с 50·n·(n−1) XP: 0, 100, 300, 600, 1000, 1500…

export function levelStart(level: number): number {
  return 50 * level * (level - 1);
}

export function levelInfo(xp: number) {
  let level = 1;
  while (levelStart(level + 1) <= xp) level++;
  const start = levelStart(level);
  const next = levelStart(level + 1);
  return { level, current: xp - start, needed: next - start, progress: (xp - start) / (next - start) };
}

/**
 * Ступень уровня (этап 16В, J): чем выше уровень, тем «богаче» бейдж. 1–4 обычная, 5–9 редкая, 10–19 эпическая,
 * 20–29 легендарная, 30+ мифическая (своей редкости у мифической нет — это только вид бейджа уровня).
 */
export type LevelTier = Rarity | "mythic";

/** Первые уровни ступеней по порядку: по ним строится «Новая ступень» на итогах. */
export const TIER_STARTS: { level: number; tier: LevelTier }[] = [
  { level: 1, tier: "common" },
  { level: 5, tier: "rare" },
  { level: 10, tier: "epic" },
  { level: 20, tier: "legendary" },
  { level: 30, tier: "mythic" },
];

export function levelTier(level: number): LevelTier {
  if (!(level >= 5)) return "common";
  if (level < 10) return "rare";
  if (level < 20) return "epic";
  if (level < 30) return "legendary";
  return "mythic";
}

/** Новая ступень при росте уровня from → to (если за раз перешагнули несколько — самая высокая); иначе null. */
export function newTierOnLevelUp(from: number, to: number): LevelTier | null {
  const t = levelTier(to);
  return to > from && t !== levelTier(from) ? t : null;
}

export const LEVEL_TITLES: L[] = [
  { ru: "Новичок", kk: "Жаңадан бастаушы" },
  { ru: "Бит", kk: "Бит" },
  { ru: "Байт", kk: "Байт" },
  { ru: "Килобайт", kk: "Килобайт" },
  { ru: "Мегабайт", kk: "Мегабайт" },
  { ru: "Гигабайт", kk: "Гигабайт" },
  { ru: "Терабайт", kk: "Терабайт" },
];

export function levelTitle(level: number): L {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

// ---------- Серия дней ----------

/** Заморозка серии: зарабатывается за каждые 7 дней подряд (не покупается), не больше двух в запасе. */
export const STREAK_FREEZE = { every: 7, max: 2 } as const;

export interface Streak {
  current: number;
  best: number;
  lastDay: string | null;
  /** Заморозки в запасе: каждая спасает серию при одном пропущенном дне. */
  freezes?: number;
  /** Дни, которые «спасла» заморозка (последние 10) — для календаря. */
  frozenDays?: string[];
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Обновляет серию при активности в день `today`.
 * Пропущенные дни закрываются заморозками, если их хватает; иначе серия начинается заново.
 */
export function bumpStreak(s: Streak, today: string): Streak {
  if (s.lastDay === today) return s;
  const freezes = s.freezes ?? 0;
  const gap = s.lastDay ? dayDiff(s.lastDay, today) : Infinity;
  const missed = gap - 1;
  let current: number;
  let left = freezes;
  let frozen = s.frozenDays ?? [];
  if (gap === 1) {
    current = s.current + 1;
  } else if (Number.isFinite(gap) && missed >= 1 && missed <= freezes) {
    current = s.current + 1;
    left = freezes - missed;
    const saved = Array.from({ length: missed }, (_, i) => addDays(s.lastDay!, i + 1));
    frozen = [...frozen, ...saved].slice(-10);
  } else {
    current = 1;
  }
  // Новая заморозка за каждые 7 дней подряд.
  if (current > s.current && current % STREAK_FREEZE.every === 0) left = Math.min(STREAK_FREEZE.max, left + 1);
  return { current, best: Math.max(s.best, current), lastDay: today, freezes: left, frozenDays: frozen };
}

/** Актуальная серия на сегодня: если пропущено больше дней, чем есть заморозок, — 0. */
export function liveStreak(s: Streak, today: string): number {
  if (!s.lastDay) return 0;
  const gap = dayDiff(s.lastDay, today);
  return gap - 1 <= (s.freezes ?? 0) ? s.current : 0;
}

/** Серия под угрозой: сегодня ещё не занимались, а серия есть (её спасёт только занятие сегодня или заморозка). */
export function streakAtRisk(s: Streak, today: string): boolean {
  return s.lastDay !== today && liveStreak(s, today) > 0;
}

// ---------- Достижения ----------

/** Имя рисованной иконки (компонент — components/app/AchievementBadge.tsx). */
export type AchievementIcon =
  | "graduation" | "gem" | "flame" | "calendar" | "trophy" | "star" | "sparkles" | "camera" | "dumbbell" | "gamepad" | "brain" | "target" | "notebook"
  | "book" | "library" | "medal" | "crown" | "mountain" | "sun" | "shield" | "badge" | "clipboard" | "award" | "check" | "chevrons" | "zap" | "rocket"
  | "orbit" | "wrench" | "terminal" | "lightbulb" | "atom" | "activity";

export interface AchievementDef {
  id: string;
  icon: AchievementIcon;
  /** Редкость: цвет значка, группа в профиле, чипы за получение (ACHIEVEMENT_CHIPS в economy.ts). */
  rarity: Rarity;
  title: L;
  description: L;
}

/** Названия и описания новых достижений (этап 16В) лежат в словаре `gamify.ach.<id>.title|desc`. */
type NewAchievementId =
  | "lessons_10" | "lessons_25" | "lessons_50" | "lessons_100"
  | "streak_30" | "streak_100"
  | "perfect_10" | "perfect_50"
  | "exam_5" | "exam_90" | "unit_pass"
  | "level_5" | "level_10" | "level_20" | "level_30"
  | "code_1" | "code_10"
  | "mastery_5" | "mastery_20"
  | "fixer_5" | "combo_20";

const fresh = (id: NewAchievementId, icon: AchievementIcon, rarity: Rarity): AchievementDef => ({
  id,
  icon,
  rarity,
  title: gamifyDict[`gamify.ach.${id}.title` as const],
  description: gamifyDict[`gamify.ach.${id}.desc` as const],
});

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_lesson",
    icon: "graduation",
    rarity: "common",
    title: { ru: "Первый шаг", kk: "Алғашқы қадам" },
    description: { ru: "Пройди первый урок", kk: "Алғашқы сабақты өт" },
  },
  {
    id: "perfect",
    icon: "gem",
    rarity: "common",
    title: { ru: "Без ошибок", kk: "Қатесіз" },
    description: { ru: "Пройди урок без единой ошибки", kk: "Сабақты бірде-бір қатесіз өт" },
  },
  {
    id: "combo_7",
    icon: "flame",
    rarity: "common",
    title: { ru: "В ударе", kk: "Бабыңдасың" },
    description: { ru: "7 верных ответов подряд", kk: "Қатарынан 7 дұрыс жауап" },
  },
  {
    id: "streak_3",
    icon: "calendar",
    rarity: "common",
    title: { ru: "Три дня подряд", kk: "Үш күн қатарынан" },
    description: { ru: "Занимайся 3 дня подряд", kk: "3 күн қатарынан оқы" },
  },
  {
    id: "streak_7",
    icon: "trophy",
    rarity: "rare",
    title: { ru: "Неделя силы", kk: "Күш аптасы" },
    description: { ru: "Занимайся 7 дней подряд", kk: "7 күн қатарынан оқы" },
  },
  {
    id: "xp_500",
    icon: "star",
    rarity: "common",
    title: { ru: "500 XP", kk: "500 XP" },
    description: { ru: "Набери 500 очков опыта", kk: "500 тәжірибе ұпайын жина" },
  },
  {
    id: "ai_friend",
    icon: "sparkles",
    rarity: "common",
    title: { ru: "Любопытный", kk: "Білуге құмар" },
    description: { ru: "Задай вопрос ИИ-помощнику", kk: "ЖИ-көмекшіге сұрақ қой" },
  },
  {
    id: "solver",
    icon: "camera",
    rarity: "rare",
    title: { ru: "Решатель", kk: "Шешуші" },
    description: { ru: "Отправь решение на проверку ИИ", kk: "Шешіміңді ЖИ тексеруіне жібер" },
  },
  {
    id: "drill",
    icon: "dumbbell",
    rarity: "common",
    title: { ru: "Тренер сам себе", kk: "Өз-өзіңе жаттықтырушы" },
    description: { ru: "Пройди тренировку слабых тем", kk: "Әлсіз тақырыптар жаттығуын өт" },
  },
  {
    id: "gamer",
    icon: "gamepad",
    rarity: "common",
    title: { ru: "Игрок", kk: "Ойыншы" },
    description: { ru: "Сыграй в мини-игру", kk: "Шағын ойын ойна" },
  },
  {
    id: "binary_master",
    icon: "brain",
    rarity: "epic",
    title: { ru: "Повелитель битов", kk: "Биттер әміршісі" },
    description: {
      ru: "Освой оба перевода 2→10 и 10→2 (от 10 ответов каждый)",
      kk: "2→10 және 10→2 аударуларын меңгер (әрқайсысына 10+ жауап)",
    },
  },
  {
    id: "exam_first",
    icon: "target",
    rarity: "rare",
    title: { ru: "Пробный старт", kk: "Сынақ бастамасы" },
    description: { ru: "Пройди мини-ЕНТ или пробный ЕНТ", kk: "Шағын ҰБТ немесе сынақ ҰБТ тапсыр" },
  },
  {
    id: "perfect_5",
    icon: "gem",
    rarity: "rare",
    title: { ru: "Пять идеальных", kk: "Бес мінсіз сабақ" },
    description: { ru: "Пройди 5 новых уроков подряд без единой ошибки", kk: "Қатарынан 5 жаңа сабақты бірде-бір қатесіз өт" },
  },
  {
    id: "explorer",
    icon: "notebook",
    rarity: "common",
    title: { ru: "Конспектер", kk: "Конспект шебері" },
    description: { ru: "Создай свой конспект", kk: "Өз конспектіңді жаса" },
  },
  // ---- этап 16В: условия считает lib/achievement-rules.ts по данным стора ----
  fresh("lessons_10", "book", "common"),
  fresh("code_1", "terminal", "common"),
  fresh("fixer_5", "wrench", "common"),
  fresh("lessons_25", "library", "rare"),
  fresh("perfect_10", "shield", "rare"),
  fresh("unit_pass", "check", "rare"),
  fresh("level_5", "chevrons", "rare"),
  fresh("code_10", "terminal", "rare"),
  fresh("mastery_5", "lightbulb", "rare"),
  fresh("lessons_50", "medal", "epic"),
  fresh("streak_30", "mountain", "epic"),
  fresh("perfect_50", "badge", "epic"),
  fresh("exam_5", "clipboard", "epic"),
  fresh("level_10", "zap", "epic"),
  fresh("combo_20", "activity", "epic"),
  fresh("mastery_20", "atom", "epic"),
  fresh("lessons_100", "crown", "legendary"),
  fresh("streak_100", "sun", "legendary"),
  fresh("exam_90", "award", "legendary"),
  fresh("level_20", "rocket", "legendary"),
  fresh("level_30", "orbit", "legendary"),
];

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** Достижения одной редкости — в порядке списка. */
export function achievementsOfRarity(r: Rarity): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.rarity === r);
}

/** Сколько получено из скольких, в целом и по каждой редкости (для сводки и групп в профиле). */
export interface AchievementTally {
  got: number;
  total: number;
  /** Доля 0..1 (0, если достижений нет). */
  ratio: number;
}

export function tallyAchievements(earned: Record<string, unknown>, rarity?: Rarity): AchievementTally {
  const list = rarity ? achievementsOfRarity(rarity) : ACHIEVEMENTS;
  const got = list.filter((a) => earned[a.id]).length;
  return { got, total: list.length, ratio: list.length ? got / list.length : 0 };
}
