"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AnswerRecord, ExplainStyle, Goal, Grade, Lang, SessionResult, Theme } from "./types";
import { achievementById, bumpStreak, levelInfo, XP, type Streak } from "./gamification";
import { masteryLevel, updateSkill, type SkillStat } from "./mastery";
import { todayKey } from "./text";
import { gameReward, gameStatKey, type GameReward } from "./games";
import type { GameMode, GameResult } from "@/games/types";
import { ECONOMY, canFinishSession, heartStatus, recentChipHistory, spendHeart, type ChipTransaction, type HeartWallet, type LearningRunKind, type Subscription } from "./economy";
import { COSMETICS, pickCosmetic, type Cosmetic } from "./cosmetics";

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
  /** Вибрация при ответе (где поддерживается). */
  vibration: boolean;
  /** Меньше анимаций (плюс системная настройка prefers-reduced-motion). */
  reduceMotion: boolean;
  /** Последний выбранный темп мини-игр. */
  gameMode: GameMode;
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

export interface QuestionStat {
  stepId: string;
  skill?: string;
  lessonId?: string;
  prompt: string;
  attempts: number;
  correct: number;
  scoreTotal: number;
  lastAt: number;
}

export interface AppState {
  chips: number;
  chipHistory: ChipTransaction[];
  /** Ключи уже выданных наград сохраняются после очистки истории. */
  chipClaims: Record<string, number>;
  hearts: HeartWallet;
  subscription: Subscription;
  xpBoostUntil: number;
  learningRuns: Record<string, { kind: LearningRunKind; at: number; sequence?: number }>;
  caseLevel: number;
  cases: number;
  cosmetics: string[];
  equippedCosmeticId: string | null;
  questionStats: Record<string, QuestionStat>;
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
  startLearningRun: (kind: LearningRunKind, runId: string) => boolean;
  heartStatus: () => ReturnType<typeof heartStatus>;
  recordAssessment: (kind: "ent" | "section-test", id: string, accuracy: number, durationSec?: number) => void;
  /** Время неполного занятия: без XP, чипов и отметки завершения. */
  recordStudyTime: (durationSec: number) => void;
  buyXpBoost: () => boolean;
  openCase: () => Cosmetic | null;
  equipCosmetic: (id: string | null) => void;
  pruneChipHistory: () => void;
  completeOnboarding: (p: Partial<Profile>) => void;
  updateProfile: (p: Partial<Profile>) => void;
  recordAnswer: (rec: AnswerRecord, xp: number, lessonId?: string) => number;
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
  recordGame: (gameId: string, result: GameResult, mode?: GameMode) => GameReward;
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
  vibration: true,
  reduceMotion: false,
  gameMode: "normal",
  createdAt: 0,
};

const initialState: AppState = {
  chips: 0,
  chipHistory: [],
  chipClaims: {},
  hearts: { count: ECONOMY.freeHearts, refilledAt: 0 },
  subscription: { plan: "free", expiresAt: null },
  xpBoostUntil: 0,
  learningRuns: {},
  caseLevel: 1,
  cases: 0,
  cosmetics: [],
  equippedCosmeticId: null,
  questionStats: {},
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

function awardChips(state: AppState, claim: string, reason: string, amount: number): AppState {
  if (state.chipClaims[claim]) return state;
  const at = Date.now();
  return { ...state, chips: state.chips + amount, chipClaims: { ...state.chipClaims, [claim]: at }, chipHistory: [{ id: uid(), reason, amount, at }, ...recentChipHistory(state.chipHistory, at)] };
}

function withAchievement(state: AppState, id: string): Partial<AppState> {
  if (state.achievements[id]) return {};
  const difficulty = achievementById(id)?.difficulty;
  const rewarded = difficulty ? awardChips(state, `achievement:${id}`, "achievement", Math.max(1, Math.min(10, difficulty))) : state;
  return {
    chips: rewarded.chips, chipClaims: rewarded.chipClaims, chipHistory: rewarded.chipHistory,
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
  return { achievements: s.achievements, newAchievements: s.newAchievements, chips: s.chips, chipClaims: s.chipClaims, chipHistory: s.chipHistory };
}

function settle(state: AppState): AppState {
  let next = { ...state, ...evaluate(state) };
  const today = todayKey();
  if ((next.days[today]?.xp ?? 0) >= next.profile.dailyGoalXp) next = awardChips(next, `daily:${today}`, "daily", ECONOMY.dailyGoal);
  const level = levelInfo(next.xp).level;
  if (level > next.caseLevel) next = { ...next, cases: next.cases + level - next.caseLevel, caseLevel: level };
  return { ...next, chipHistory: recentChipHistory(next.chipHistory) };
}

const boostedXp = (state: AppState, xp: number) => (Number.isFinite(xp) ? Math.max(0, Math.min(1000, Math.floor(xp))) : 0) * (state.xpBoostUntil > Date.now() ? 2 : 1);

export const useApp = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      heartStatus: () => heartStatus(get().hearts, get().subscription),

      startLearningRun: (kind, runId) => {
        if (!runId || runId.length > 160) return false;
        const s = get();
        if (s.learningRuns[runId]) return s.learningRuns[runId].kind === kind;
        const wallet = spendHeart(s.hearts, s.subscription);
        if (!wallet) return false;
        const entries = Object.entries(s.learningRuns).sort((a, b) => (b[1].sequence ?? 0) - (a[1].sequence ?? 0) || b[1].at - a[1].at).slice(0, 249);
        const sequence = Math.max(0, ...entries.map(([, run]) => run.sequence ?? 0)) + 1;
        set({ hearts: wallet, learningRuns: { ...Object.fromEntries(entries), [runId]: { kind, at: Date.now(), sequence } }, chipHistory: recentChipHistory(s.chipHistory) });
        return true;
      },

      recordAssessment: (kind, id, accuracy, durationSec = 0) => {
        if (!id || id.length > 160 || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1) return;
        const s = get();
        const today = todayKey();
        const day = s.days[today] ?? { xp: 0, answers: 0, correct: 0, seconds: 0 };
        const seconds = Number.isFinite(durationSec) ? Math.max(0, Math.min(7200, Math.floor(durationSec))) : 0;
        // Награда за каждый отдельный вариант — один раз, повтор не печатает чипы.
        set(settle(awardChips({ ...s, days: { ...s.days, [today]: { ...day, seconds: day.seconds + seconds } }, streak: bumpStreak(s.streak, today) }, `${kind}:${id}`, kind, kind === "ent" ? ECONOMY.ent : ECONOMY.sectionTest)));
      },

      recordStudyTime: (durationSec) => set((s) => {
        const seconds = Number.isFinite(durationSec) ? Math.max(0, Math.min(7200, Math.floor(durationSec))) : 0;
        if (!seconds) return {};
        const today = todayKey();
        const day = s.days[today] ?? { xp: 0, answers: 0, correct: 0, seconds: 0 };
        return { days: { ...s.days, [today]: { ...day, seconds: day.seconds + seconds } } };
      }),

      buyXpBoost: () => {
        const s = get();
        if (s.chips < ECONOMY.xpBoostCost || s.xpBoostUntil > Date.now()) return false;
        const at = Date.now();
        set({ chips: s.chips - ECONOMY.xpBoostCost, xpBoostUntil: at + ECONOMY.xpBoostDurationMs, chipHistory: [{ id: uid(), reason: "boost", amount: -ECONOMY.xpBoostCost, at }, ...recentChipHistory(s.chipHistory, at)] });
        return true;
      },

      openCase: () => {
        const s = get();
        if (s.cases <= 0 || COSMETICS.every((item) => s.cosmetics.includes(item.id))) return null;
        const item = pickCosmetic(s.cosmetics);
        set({ cases: s.cases - 1, cosmetics: Array.from(new Set([...s.cosmetics, item.id])) });
        return item;
      },

      equipCosmetic: (id) => set((s) => id === null || s.cosmetics.includes(id) ? { equippedCosmeticId: id } : {}),
      pruneChipHistory: () => set((s) => ({ chipHistory: recentChipHistory(s.chipHistory) })),

      completeOnboarding: (p) =>
        set((s) => ({ onboarded: true, profile: { ...s.profile, ...p, createdAt: Date.now() } })),

      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),

      recordAnswer: (rec, baseXp, lessonId) => {
        let creditedXp = 0;
        set((s) => {
          const xp = boostedXp(s, baseXp);
          creditedXp = xp;
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
          const previous = s.questionStats[rec.stepId];
          const questionStats = rec.retry ? s.questionStats : { ...s.questionStats, [rec.stepId]: { stepId: rec.stepId, skill: rec.skill ?? previous?.skill, lessonId: lessonId ?? previous?.lessonId, prompt: rec.prompt.slice(0, 2000), attempts: (previous?.attempts ?? 0) + 1, correct: (previous?.correct ?? 0) + (rec.correct ? 1 : 0), scoreTotal: (previous?.scoreTotal ?? 0) + Math.max(0, Math.min(1, rec.score)), lastAt: Date.now() } };
          const boundedStats = Object.fromEntries(Object.entries(questionStats).sort((a, b) => b[1].lastAt - a[1].lastAt).slice(0, 1000));
          const next: AppState = {
            ...s,
            questionStats: boundedStats,
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
          return settle(next);
        });
        return creditedXp;
      },

      finishSession: (result) => {
        const s = get();
        if (!canFinishSession(result)) return { bonusXp: 0 };
        const firstTry = result.answers.filter((a) => !a.retry);
        // Пропущенное задание (например, решение по фото) — уже не «без ошибок».
        const perfect = firstTry.length > 0 && firstTry.every((a) => a.correct) && !result.skipped;
        let bonusXp: number = result.kind === "lesson" ? XP.lessonComplete : XP.drillComplete;
        if (result.kind === "lesson" && perfect) bonusXp += XP.perfectLesson;
        bonusXp = boostedXp(s, bonusXp);

        const today = todayKey();
        const day = s.days[today] ?? { xp: 0, answers: 0, correct: 0, seconds: 0 };
        let next: AppState = {
          ...s,
          xp: s.xp + bonusXp,
          streak: bumpStreak(s.streak, today),
          days: { ...s.days, [today]: { ...day, xp: day.xp + bonusXp, seconds: day.seconds + (Number.isFinite(result.durationSec) ? Math.max(0, Math.min(7200, result.durationSec)) : 0) } },
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
          if (!prev?.completions) next = awardChips(next, `lesson:${result.lessonId}`, "lesson", ECONOMY.firstLesson);
          if (perfect) next = awardChips(next, `perfect:${result.lessonId}`, "perfect", ECONOMY.perfectLesson);
          next = { ...next, ...withAchievement(next, "first_lesson") };
          if (perfect) next = { ...next, ...withAchievement(next, "perfect") };
        }
        if (result.kind === "drill") next = { ...next, ...withAchievement(next, "drill") };
        set(settle(next));
        return { bonusXp };
      },

      noteCombo: (combo) =>
        set((s) => {
          if (combo <= s.maxCombo) return {};
          const next = { ...s, maxCombo: combo };
          return settle(next);
        }),

      unlock: (id) => set((s) => settle({ ...s, ...withAchievement(s, id) })),

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

      recordGame: (gameId, result, mode = "normal") => {
        const s = get();
        const key = gameStatKey(gameId, mode);
        const baseReward = gameReward(result, key ? s.games[key]?.best : undefined, mode);
        const reward = { ...baseReward, xp: boostedXp(s, baseReward.xp) };
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
          games: key
            ? {
                ...s.games,
                [key]: { best: Math.max(s.games[key]?.best ?? 0, result.score), plays: (s.games[key]?.plays ?? 0) + 1, lastAt: Date.now() },
              }
            : s.games,
        };
        next = { ...next, ...withAchievement(next, "gamer") };
        set(settle(next));
        return reward;
      },

      resetProgress: () => set({ ...initialState }),
    }),
    {
      name: "informatica-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Сохранения раннего MVP имели version 0: сохраняем прогресс, merge добавит новые поля.
      migrate: (persisted) => (persisted && typeof persisted === "object" && !Array.isArray(persisted) ? persisted : {}) as AppState & AppActions,
      partialize: (state) => ({ ...state, chipHistory: recentChipHistory(state.chipHistory) }),
      onRehydrateStorage: () => (state) => state?.pruneChipHistory(),
      // Новые поля профиля получают значения по умолчанию у старых сохранений.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        const xp = Number.isFinite(p.xp) ? Math.max(0, p.xp ?? 0) : 0;
        return { ...current, ...p, xp, profile: { ...current.profile, ...p.profile }, hearts: { ...current.hearts, ...p.hearts }, subscription: { ...current.subscription, ...p.subscription }, chipHistory: recentChipHistory(p.chipHistory ?? []), caseLevel: p.caseLevel ?? levelInfo(xp).level, cases: p.cases ?? Math.max(0, levelInfo(xp).level - 1), cosmetics: (p.cosmetics ?? []).filter((id) => COSMETICS.some((item) => item.id === id)) };
      },
    },
  ),
);

/** Текущий уровень по XP. */
export const selectLevel = (s: AppState) => levelInfo(s.xp);
