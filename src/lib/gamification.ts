import type { L } from "./types";
import { dayDiff } from "./text";

// ---------- XP ----------

export const XP = {
  correct: 10,
  retryCorrect: 5,
  comboBonus: 5, // за ответ при комбо ≥ 3
  lessonComplete: 20,
  perfectLesson: 20,
  drillComplete: 10,
} as const;

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

export interface Streak {
  current: number;
  best: number;
  lastDay: string | null;
}

/** Обновляет серию при активности в день `today`. */
export function bumpStreak(s: Streak, today: string): Streak {
  if (s.lastDay === today) return s;
  const gap = s.lastDay ? dayDiff(s.lastDay, today) : Infinity;
  const current = gap === 1 ? s.current + 1 : 1;
  return { current, best: Math.max(s.best, current), lastDay: today };
}

/** Актуальная серия на сегодня: если пропущен день — 0. */
export function liveStreak(s: Streak, today: string): number {
  if (!s.lastDay) return 0;
  const gap = dayDiff(s.lastDay, today);
  return gap <= 1 ? s.current : 0;
}

// ---------- Достижения ----------

/** Имя рисованной иконки (компонент — components/app/AchievementBadge.tsx). */
export type AchievementIcon = "graduation" | "gem" | "flame" | "calendar" | "trophy" | "star" | "sparkles" | "camera" | "dumbbell" | "gamepad" | "brain";

export interface AchievementDef {
  id: string;
  icon: AchievementIcon;
  title: L;
  description: L;
  /** Награда чипами: сложность достижения от 1 до 10. */
  difficulty: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_lesson",
    difficulty: 1,
    icon: "graduation",
    title: { ru: "Первый шаг", kk: "Алғашқы қадам" },
    description: { ru: "Пройди первый урок", kk: "Алғашқы сабақты өт" },
  },
  {
    id: "perfect",
    difficulty: 2,
    icon: "gem",
    title: { ru: "Без ошибок", kk: "Қатесіз" },
    description: { ru: "Пройди урок без единой ошибки", kk: "Сабақты бірде-бір қатесіз өт" },
  },
  {
    id: "combo_7",
    difficulty: 3,
    icon: "flame",
    title: { ru: "В ударе", kk: "Бабыңдасың" },
    description: { ru: "7 верных ответов подряд", kk: "Қатарынан 7 дұрыс жауап" },
  },
  {
    id: "streak_3",
    difficulty: 3,
    icon: "calendar",
    title: { ru: "Три дня подряд", kk: "Үш күн қатарынан" },
    description: { ru: "Занимайся 3 дня подряд", kk: "3 күн қатарынан оқы" },
  },
  {
    id: "streak_7",
    difficulty: 7,
    icon: "trophy",
    title: { ru: "Неделя силы", kk: "Күш аптасы" },
    description: { ru: "Занимайся 7 дней подряд", kk: "7 күн қатарынан оқы" },
  },
  {
    id: "xp_500",
    difficulty: 5,
    icon: "star",
    title: { ru: "500 XP", kk: "500 XP" },
    description: { ru: "Набери 500 очков опыта", kk: "500 тәжірибе ұпайын жина" },
  },
  {
    id: "ai_friend",
    difficulty: 1,
    icon: "sparkles",
    title: { ru: "Любопытный", kk: "Білуге құмар" },
    description: { ru: "Задай вопрос ИИ-помощнику", kk: "ЖИ-көмекшіге сұрақ қой" },
  },
  {
    id: "solver",
    difficulty: 2,
    icon: "camera",
    title: { ru: "Решатель", kk: "Шешуші" },
    description: { ru: "Отправь решение на проверку ИИ", kk: "Шешіміңді ЖИ тексеруіне жібер" },
  },
  {
    id: "drill",
    difficulty: 2,
    icon: "dumbbell",
    title: { ru: "Тренер сам себе", kk: "Өз-өзіңе жаттықтырушы" },
    description: { ru: "Пройди тренировку слабых тем", kk: "Әлсіз тақырыптар жаттығуын өт" },
  },
  {
    id: "gamer",
    difficulty: 1,
    icon: "gamepad",
    title: { ru: "Игрок", kk: "Ойыншы" },
    description: { ru: "Сыграй в мини-игру", kk: "Шағын ойын ойна" },
  },
  {
    id: "binary_master",
    difficulty: 10,
    icon: "brain",
    title: { ru: "Повелитель битов", kk: "Биттер әміршісі" },
    description: {
      ru: "Освой оба перевода 2→10 и 10→2 (от 10 ответов каждый)",
      kk: "2→10 және 10→2 аударуларын меңгер (әрқайсысына 10+ жауап)",
    },
  },
];

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
