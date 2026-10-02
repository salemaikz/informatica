"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AnswerRecord, ExplainStyle, Goal, Grade, Lang, SessionResult, Theme } from "./types";
import { bumpStreak, levelInfo, XP, type Streak } from "./gamification";
import { masteryLevel, updateSkill, type SkillStat } from "./mastery";
import { todayKey } from "./text";
import { gameReward, type GameReward } from "./games";
import type { GameResult } from "@/games/types";

// Локальное хранилище прогресса (MVP). Всё лежит в localStorage устройства.
// План: заменить на синхронизацию с бэкендом (см. docs/ROADMAP.md) — интерфейс действий не менять.

export interface Profile {
  name: string;
  lang: Lang;
  grade: Grade;
  goal: Goal;
  style: ExplainStyle;
  dailyGoalXp: number;
  theme: Theme;
  sound: boolean;
  createdAt: number;
}

export interface DayStat {
  xp: number;
  answers: number;
  correct: number;
  seconds: number;
}

export interface LessonStat {
  completions: number;
  bestAccuracy: number;
  lastAt: number;
  totalXp: number;
}

export interface MistakeRecord {
  id: string;
  stepId: string;
  lessonId?: string;
  skill?: string;
  prompt: string;
  given: string;
  expected: string;
  at: number;
}

export interface SavedNote {
  id: string;
  text: string;
  at: number;
}

export interface NoteData {
  own: string;
  saved: SavedNote[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Было ли приложено фото (само фото не храним). */
  hadImage?: boolean;
  at: number;
}

export interface GameStat {
  best: number;
  plays: number;
  lastAt: number;
}

export interface AppState {
  onboarded: boolean;
  profile: Profile;
  xp: number;
  streak: Streak;
  days: Record<string, DayStat>;
  skills: Record<string, SkillStat>;
  lessons: Record<string, LessonStat>;
  mistakes: MistakeRecord[];
  achievements: Record<string, number>;
  newAchievements: string[];
  notes: Record<string, NoteData>;
  /** Заметки ИИ об ученике: как объяснять, что западает. Видны ученику в статистике. */
  memory: string;
  chat: ChatMessage[];
  aiUsage: { day: string; count: number };
  maxCombo: number;
  /** Рекорды мини-игр. */
  games: Record<string, GameStat>;
}

export interface AppActions {
  completeOnboarding: (p: Partial<Profile>) => void;
  updateProfile: (p: Partial<Profile>) => void;
  recordAnswer: (rec: AnswerRecord, xp: number, lessonId?: string) => void;
  finishSession: (result: SessionResult) => { bonusXp: number };
  noteCombo: (combo: number) => void;
  unlock: (id: string) => void;
  consumeNewAchievements: () => string[];
  setMemory: (text: string) => void;
  addChat: (msg: Omit<ChatMessage, "id" | "at">) => void;
  clearChat: () => void;
  setOwnNote: (key: string, text: string) => void;
  saveToNotes: (key: string, text: string) => void;
  removeSavedNote: (key: string, id: string) => void;
  /** Учитывает обращение к ИИ; false — дневной лимит исчерпан. */
  spendAi: () => boolean;
  /** Вернуть обращение, если запрос к ИИ не удался. */
  refundAi: () => void;
  /** Закрыть ошибку(и) по id задания. */
  dismissMistake: (stepId: string) => void;
  /** Итог мини-игры: XP, рекорд, освоение навыков, серия. */
  recordGame: (gameId: string, result: GameResult) => GameReward;
  resetProgress: () => void;
}

export const AI_DAILY_LIMIT = 60;
const MAX_MISTAKES = 60;
const MAX_CHAT = 60;

export const defaultProfile: Profile = {
  name: "",
  lang: "ru",
  grade: "11",
  goal: "ent",
  style: "examples",
  dailyGoalXp: 50,
  theme: "system",
  sound: true,
  createdAt: 0,
};

const initialState: AppState = {
  onboarded: false,
  profile: defaultProfile,
  xp: 0,
  streak: { current: 0, best: 0, lastDay: null },
  days: {},
  skills: {},
  lessons: {},
  mistakes: [],
  achievements: {},
  newAchievements: [],
  notes: {},
  memory: "",
  chat: [],
  aiUsage: { day: "", count: 0 },
  maxCombo: 0,
  games: {},
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function withAchievement(state: AppState, id: string): Partial<AppState> {
  if (state.achievements[id]) return {};
  return {
    achievements: { ...state.achievements, [id]: Date.now() },
    newAchievements: [...state.newAchievements, id],
  };
}

/** Проверяет условия достижений, зависящих от общего состояния. */
function evaluate(state: AppState): Partial<AppState> {
  let s = state;
  const apply = (id: string) => {
    s = { ...s, ...withAchievement(s, id) };
  };
  if (s.xp >= 500) apply("xp_500");
  if (s.streak.current >= 3) apply("streak_3");
  if (s.streak.current >= 7) apply("streak_7");
  if (s.maxCombo >= 7) apply("combo_7");
  const solid = (id: string) => masteryLevel(s.skills[id]) === "mastered" && (s.skills[id]?.attempts ?? 0) >= 10;
  if (solid("ns.bin2dec") && solid("ns.dec2bin")) {
    apply("binary_master");
  }
  return { achievements: s.achievements, newAchievements: s.newAchievements };
}

export const useApp = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      completeOnboarding: (p) =>
        set((s) => ({ onboarded: true, profile: { ...s.profile, ...p, createdAt: Date.now() } })),

      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),

      recordAnswer: (rec, xp, lessonId) =>
        set((s) => {
          const today = todayKey();
          const day = s.days[today] ?? { xp: 0, answers: 0, correct: 0, seconds: 0 };
          const skills = rec.skill ? { ...s.skills, [rec.skill]: updateSkill(s.skills[rec.skill], rec.score) } : s.skills;
          // Одна запись на задание: повторная ошибка обновляет запись (и сохраняет урок),
          // верный ответ закрывает её.
          let mistakes = s.mistakes;
          const existing = s.mistakes.find((m) => m.stepId === rec.stepId);
          if (!rec.correct && !rec.retry) {
            mistakes = [
              {
                id: existing?.id ?? uid(),
                stepId: rec.stepId,
                lessonId: lessonId ?? existing?.lessonId,
                skill: rec.skill,
                prompt: rec.prompt,
                given: rec.given,
                expected: rec.expected,
                at: Date.now(),
              },
              ...s.mistakes.filter((m) => m.stepId !== rec.stepId),
            ].slice(0, MAX_MISTAKES);
          } else if (rec.correct && existing) {
            mistakes = s.mistakes.filter((m) => m.stepId !== rec.stepId);
          }
          const next: AppState = {
            ...s,
            xp: s.xp + xp,
            skills,
            mistakes,
            streak: bumpStreak(s.streak, today),
            days: {
              ...s.days,
              [today]: {
                xp: day.xp + xp,
                answers: day.answers + 1,
                correct: day.correct + (rec.correct ? 1 : 0),
                seconds: day.seconds,
              },
            },
          };
          return { ...next, ...evaluate(next) };
        }),

      finishSession: (result) => {
        const s = get();
        const firstTry = result.answers.filter((a) => !a.retry);
        // Пропущенное задание (например, решение по фото) — уже не «без ошибок».
        const perfect = firstTry.length > 0 && firstTry.every((a) => a.correct) && !result.skipped;
        let bonusXp = result.kind === "lesson" ? XP.lessonComplete : XP.drillComplete;
        if (result.kind === "lesson" && perfect) bonusXp += XP.perfectLesson;

        const today = todayKey();
        const day = s.days[today] ?? { xp: 0, answers: 0, correct: 0, seconds: 0 };
        let next: AppState = {
          ...s,
          xp: s.xp + bonusXp,
          streak: bumpStreak(s.streak, today),
          days: { ...s.days, [today]: { ...day, xp: day.xp + bonusXp, seconds: day.seconds + Math.min(7200, result.durationSec) } },
        };
        if (result.kind === "lesson" && result.lessonId) {
          const prev = s.lessons[result.lessonId];
          next.lessons = {
            ...s.lessons,
            [result.lessonId]: {
              completions: (prev?.completions ?? 0) + 1,
              bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, result.accuracy),
              lastAt: Date.now(),
              totalXp: (prev?.totalXp ?? 0) + result.xp + bonusXp,
            },
          };
          next = { ...next, ...withAchievement(next, "first_lesson") };
          if (perfect) next = { ...next, ...withAchievement(next, "perfect") };
        }
        if (result.kind === "drill") next = { ...next, ...withAchievement(next, "drill") };
        next = { ...next, ...evaluate(next) };
        set(next);
        return { bonusXp };
      },

      noteCombo: (combo) =>
        set((s) => {
          if (combo <= s.maxCombo) return {};
          const next = { ...s, maxCombo: combo };
          return { maxCombo: combo, ...evaluate(next) };
        }),

      unlock: (id) => set((s) => withAchievement(s, id)),

      consumeNewAchievements: () => {
        const ids = get().newAchievements;
        if (ids.length) set({ newAchievements: [] });
        return ids;
      },

      setMemory: (text) => set({ memory: text.slice(0, 1500) }),

      addChat: (msg) =>
        set((s) => ({ chat: [...s.chat, { ...msg, id: uid(), at: Date.now() }].slice(-MAX_CHAT) })),

      clearChat: () => set({ chat: [] }),

      setOwnNote: (key, text) =>
        set((s) => ({
          notes: { ...s.notes, [key]: { own: text, saved: s.notes[key]?.saved ?? [] } },
        })),

      saveToNotes: (key, text) =>
        set((s) => ({
          notes: {
            ...s.notes,
            [key]: {
              own: s.notes[key]?.own ?? "",
              saved: [{ id: uid(), text, at: Date.now() }, ...(s.notes[key]?.saved ?? [])].slice(0, 50),
            },
          },
        })),

      removeSavedNote: (key, id) =>
        set((s) => {
          const n = s.notes[key];
          if (!n) return {};
          return { notes: { ...s.notes, [key]: { ...n, saved: n.saved.filter((x) => x.id !== id) } } };
        }),

      refundAi: () =>
        set((s) => (s.aiUsage.day === todayKey() && s.aiUsage.count > 0 ? { aiUsage: { ...s.aiUsage, count: s.aiUsage.count - 1 } } : {})),

      spendAi: () => {
        const today = todayKey();
        const u = get().aiUsage;
        const count = u.day === today ? u.count : 0;
        if (count >= AI_DAILY_LIMIT) return false;
        set({ aiUsage: { day: today, count: count + 1 } });
        return true;
      },

      dismissMistake: (stepId) => set((s) => ({ mistakes: s.mistakes.filter((m) => m.stepId !== stepId) })),

      recordGame: (gameId, result) => {
        const s = get();
        const reward = gameReward(result, s.games[gameId]?.best);
        const today = todayKey();
        const day = s.days[today] ?? { xp: 0, answers: 0, correct: 0, seconds: 0 };
        let skills = s.skills;
        for (const [skill, score] of Object.entries(reward.skillScores)) skills = { ...skills, [skill]: updateSkill(skills[skill], score) };
        let next: AppState = {
          ...s,
          xp: s.xp + reward.xp,
          skills,
          streak: result.total > 0 ? bumpStreak(s.streak, today) : s.streak,
          days: {
            ...s.days,
            [today]: { ...day, xp: day.xp + reward.xp, answers: day.answers + result.total, correct: day.correct + result.correct },
          },
          games: {
            ...s.games,
            [gameId]: { best: Math.max(s.games[gameId]?.best ?? 0, result.score), plays: (s.games[gameId]?.plays ?? 0) + 1, lastAt: Date.now() },
          },
        };
        next = { ...next, ...withAchievement(next, "gamer") };
        next = { ...next, ...evaluate(next) };
        set(next);
        return reward;
      },

      resetProgress: () => set({ ...initialState }),
    }),
    {
      name: "informatica-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** Текущий уровень по XP. */
export const selectLevel = (s: AppState) => levelInfo(s.xp);
