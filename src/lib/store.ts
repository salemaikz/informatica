"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AnswerRecord,
  AvatarConfig,
  AvatarColor,
  EntTopicId,
  ExplainStyle,
  Goal,
  Grade,
  Lang,
  LessonVia,
  SessionResult,
  Theme,
} from "./types";
import { bumpStreak, levelInfo, XP, type Streak } from "./gamification";
import { masteryLevel, updateSkill, type SkillStat } from "./mastery";
import { todayKey } from "./text";
import { gameReward, gameStatKey, type GameReward } from "./games";
import { lessonXpFactor, scaleXp, scheduleAfter, type LessonStat } from "./review";
import {
  emptyNotebook,
  folderForSource,
  migrateLegacyNotes,
  NOTE_LIMITS,
  repairNotebook,
  systemFolderId,
  titleFromBody,
  type FolderColor,
  type LegacyNotes,
  type Note,
  type NoteFolder,
  type Notebook,
  type NoteSource,
} from "./notebook";
import type { GameMode, GameResult } from "@/games/types";

export type { LessonStat } from "./review";
export type { Note, NoteFolder, Notebook, FolderColor, NoteSource } from "./notebook";

// Локальное хранилище прогресса (MVP). Всё лежит в localStorage устройства.
// План: заменить на синхронизацию с бэкендом (см. docs/ROADMAP.md) — интерфейс действий не менять.

export interface ReminderSettings {
  /** Напоминать о занятии (на главной и, если разрешено, уведомлением). */
  enabled: boolean;
  /** Время напоминания «ЧЧ:ММ». */
  time: string;
  /** Системные уведомления браузера разрешены и включены. */
  push: boolean;
}

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
  /** Аватар (буква, рисованный, фото). */
  avatar: AvatarConfig;
  reminder: ReminderSettings;
  /** Дата ЕНТ «ГГГГ-ММ-ДД» (цель) или null. */
  examDate: string | null;
  /** Цель по информатике — баллов из 50. */
  targetScore: number;
  /** Цель: уроков в неделю. */
  weeklyLessons: number;
}

export interface DayStat {
  xp: number;
  answers: number;
  correct: number;
  seconds: number;
  /** Уроков засчитано за день. */
  lessons?: number;
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

export type ExamKind = "full" | "mini" | "topic";

/** Итог попытки пробного ЕНТ (сами вопросы и ответы — в IndexedDB, lib/exam-store.ts). */
export interface ExamSummary {
  id: string;
  kind: ExamKind;
  /** Вариант (seed): по нему вариант восстанавливается, им можно поделиться. */
  seed: number;
  at: number;
  points: number;
  maxPoints: number;
  durationSec: number;
  byTopic: Partial<Record<EntTopicId, { points: number; max: number }>>;
  /** Темы теста по теме. */
  topics?: EntTopicId[];
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
  /** Конспекты 2.0: папки и записи. */
  notebook: Notebook;
  /** Заметки ИИ об ученике: как объяснять, что западает. Видны ученику в статистике. */
  memory: string;
  chat: ChatMessage[];
  aiUsage: { day: string; count: number };
  maxCombo: number;
  /** Рекорды мини-игр. */
  games: Record<string, GameStat>;
  /** Попытки пробного ЕНТ — новые первыми. */
  exams: ExamSummary[];
}

export interface NoteInput {
  folderId?: string;
  title?: string;
  body?: string;
  lessonId?: string;
  source?: NoteSource;
  images?: string[];
}

export interface AppActions {
  completeOnboarding: (p: Partial<Profile>) => void;
  updateProfile: (p: Partial<Profile>) => void;
  recordAnswer: (rec: AnswerRecord, xp: number, lessonId?: string) => void;
  /**
   * Итог урока/тренировки: бонус XP (у повтора урока — меньше, см. lib/review.ts), статистика урока,
   * расписание повторения, серия, достижения.
   */
  finishSession: (result: SessionResult) => { bonusXp: number };
  /** Засчитать урок без прохождения в плеере: игрой или экстерном (тест по разделу). Без бонуса XP. */
  completeLessons: (lessonIds: string[], via: Extract<LessonVia, "game" | "extern">, accuracy: number) => void;
  /** Повторение (разминка): навыки уроков повторены с точностью accuracy — сдвинуть расписание повторения. */
  markReviewed: (lessonIds: string[], accuracy: number) => void;
  noteCombo: (combo: number) => void;
  unlock: (id: string) => void;
  consumeNewAchievements: () => string[];
  setMemory: (text: string) => void;
  addChat: (msg: Omit<ChatMessage, "id" | "at">) => void;
  clearChat: () => void;

  // ---- конспекты 2.0 ----
  createFolder: (name: string, color?: FolderColor) => string;
  updateFolder: (id: string, patch: Partial<Pick<NoteFolder, "name" | "color">>) => void;
  /** Удаляет папку ученика; записи переезжают в «Мои записи». Системные папки не удаляются. */
  deleteFolder: (id: string) => void;
  createNote: (input: NoteInput) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "body" | "folderId" | "pinned" | "images">>) => void;
  /** Удаляет запись; возвращает id её картинок (их удаляет вызывающий из IndexedDB). */
  deleteNote: (id: string) => string[];
  /** Совместимость: ответ ИИ в конспект (key — id урока или "general"). */
  saveToNotes: (key: string, text: string) => string;

  /** Учитывает обращение к ИИ; false — дневной лимит исчерпан. */
  spendAi: () => boolean;
  /** Вернуть обращение, если запрос к ИИ не удался или ответ взят из кэша. */
  refundAi: () => void;
  /** Закрыть ошибку(и) по id задания. */
  dismissMistake: (stepId: string) => void;
  /** Итог мини-игры: XP, рекорд, освоение навыков, серия. */
  recordGame: (gameId: string, result: GameResult, mode?: GameMode) => GameReward;
  /**
   * Итог пробного ЕНТ: история попыток, освоение навыков (по доле баллов за задания навыка), серия и время.
   * XP за пробник не начисляется — это проверка, а не тренировка.
   */
  recordExam: (summary: ExamSummary, skillScores: Record<string, number[]>) => void;
  /** Заменить весь прогресс (импорт резервной копии). Данные проверяются как недоверенные. */
  importProgress: (raw: unknown) => boolean;
  resetProgress: () => void;
}

export const AI_DAILY_LIMIT = 60;
const MAX_MISTAKES = 60;
const MAX_CHAT = 60;
const MAX_EXAMS = 50;
const AVATAR_COLORS: AvatarColor[] = ["primary", "success", "warning", "danger", "ai", "gold", "streak"];

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
  gameMode: "calm",
  createdAt: 0,
  avatar: { kind: "initial", color: "primary" },
  reminder: { enabled: true, time: "19:00", push: false },
  examDate: null,
  targetScore: 35,
  weeklyLessons: 4,
};

const initialState: AppState = {
  onboarded: false,
  profile: defaultProfile,
  xp: 0,
  streak: { current: 0, best: 0, lastDay: null, freezes: 0 },
  days: {},
  skills: {},
  lessons: {},
  mistakes: [],
  achievements: {},
  newAchievements: [],
  notebook: emptyNotebook(),
  memory: "",
  chat: [],
  aiUsage: { day: "", count: 0 },
  maxCombo: 0,
  games: {},
  exams: [],
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const emptyDay = (): DayStat => ({ xp: 0, answers: 0, correct: 0, seconds: 0, lessons: 0 });

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
  if (s.exams.length > 0) apply("exam_first");
  if (s.notebook.notes.some((n) => n.source === "own" || n.source === "scratch")) apply("explorer");
  const solid = (id: string) => masteryLevel(s.skills[id]) === "mastered" && (s.skills[id]?.attempts ?? 0) >= 10;
  if (solid("ns.bin2dec") && solid("ns.dec2bin")) {
    apply("binary_master");
  }
  return { achievements: s.achievements, newAchievements: s.newAchievements };
}

/** Новая статистика урока после засчитанного прохождения. */
function nextLessonStat(prev: LessonStat | undefined, via: LessonVia, accuracy: number, xp: number, now: number): LessonStat {
  const sched = scheduleAfter(prev, accuracy, now);
  return {
    completions: (prev?.completions ?? 0) + 1,
    bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, accuracy),
    lastAt: now,
    totalXp: (prev?.totalXp ?? 0) + xp,
    firstAt: prev?.firstAt ?? now,
    via: prev?.via ?? via,
    stage: sched.stage,
    dueAt: sched.dueAt,
  };
}

function cleanAvatar(raw: unknown): AvatarConfig {
  const a = raw as Partial<AvatarConfig> | undefined;
  if (a?.kind === "initial" && AVATAR_COLORS.includes((a as { color: AvatarColor }).color)) return { kind: "initial", color: (a as { color: AvatarColor }).color };
  if (a?.kind === "preset" && typeof (a as { id?: unknown }).id === "string") return { kind: "preset", id: (a as { id: string }).id.slice(0, 40) };
  if (a?.kind === "photo") {
    const data = (a as { data?: unknown }).data;
    if (typeof data === "string" && data.startsWith("data:image/jpeg;base64,") && data.length <= 80_000) return { kind: "photo", data };
  }
  return defaultProfile.avatar;
}

function cleanProfile(raw: unknown): Profile {
  const p = (raw ?? {}) as Partial<Profile>;
  const reminder = { ...defaultProfile.reminder, ...(p.reminder ?? {}) };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time)) reminder.time = defaultProfile.reminder.time;
  const targetScore = typeof p.targetScore === "number" && p.targetScore >= 5 && p.targetScore <= 50 ? Math.round(p.targetScore) : defaultProfile.targetScore;
  const weeklyLessons = typeof p.weeklyLessons === "number" && p.weeklyLessons >= 1 && p.weeklyLessons <= 21 ? Math.round(p.weeklyLessons) : defaultProfile.weeklyLessons;
  const examDate = typeof p.examDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.examDate) ? p.examDate : null;
  return { ...defaultProfile, ...p, avatar: cleanAvatar(p.avatar), reminder, targetScore, weeklyLessons, examDate };
}

/** Миграции сохранений: v1 (конспекты по ключу урока) → v2 (папки и записи). */
export function migrateState(persisted: unknown, version: number): Partial<AppState> {
  const s = { ...((persisted ?? {}) as Record<string, unknown>) };
  if (version < 2) {
    s.notebook = migrateLegacyNotes(s.notes as LegacyNotes | undefined, Date.now());
    delete s.notes;
    s.exams = [];
    // Уже пройденные уроки ставим в расписание повторения: через день после прохождения.
    const lessons = (s.lessons ?? {}) as Record<string, LessonStat>;
    s.lessons = Object.fromEntries(
      Object.entries(lessons).map(([id, st]) => [id, { ...st, firstAt: st.firstAt ?? st.lastAt, via: st.via ?? "learn", stage: st.stage ?? 0, dueAt: st.dueAt ?? st.lastAt + 86_400_000 }]),
    );
  }
  return s as Partial<AppState>;
}

/** Собирает состояние из сохранения поверх текущего (новые поля — значения по умолчанию). */
export function mergeState(persisted: unknown, current: AppState & AppActions): AppState & AppActions {
  const p = (persisted ?? {}) as Partial<AppState>;
  return {
    ...current,
    ...p,
    profile: cleanProfile(p.profile),
    streak: { ...current.streak, ...(p.streak ?? {}) },
    notebook: repairNotebook(p.notebook ?? current.notebook),
    exams: Array.isArray(p.exams) ? p.exams.slice(0, MAX_EXAMS) : [],
  };
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
          const day = s.days[today] ?? emptyDay();
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
                ...day,
                xp: day.xp + xp,
                answers: day.answers + 1,
                correct: day.correct + (rec.correct ? 1 : 0),
              },
            },
          };
          return { ...next, ...evaluate(next) };
        }),

      finishSession: (result) => {
        const s = get();
        const now = Date.now();
        const firstTry = result.answers.filter((a) => !a.retry);
        // Пропущенное задание (например, решение по фото) — уже не «без ошибок».
        const perfect = firstTry.length > 0 && firstTry.every((a) => a.correct) && !result.skipped;
        const isLesson = result.kind === "lesson" && !!result.lessonId;
        const prev = isLesson ? s.lessons[result.lessonId!] : undefined;
        // Повтор урока даёт меньше XP (плановое повторение — почти полный). Бонус «без ошибок» — за первый раз.
        const factor = isLesson ? lessonXpFactor(prev, now) : 1;
        let bonusXp = result.kind === "lesson" ? scaleXp(XP.lessonComplete, factor) : XP.drillComplete;
        if (result.kind === "lesson" && perfect && !prev) bonusXp += XP.perfectLesson;
        // «Проверить себя» — короче урока: бонус за прохождение вдвое меньше.
        if (result.kind === "lesson" && result.via === "check") bonusXp = Math.round(bonusXp / 2);

        const today = todayKey();
        const day = s.days[today] ?? emptyDay();
        let next: AppState = {
          ...s,
          xp: s.xp + bonusXp,
          streak: bumpStreak(s.streak, today),
          days: {
            ...s.days,
            [today]: {
              ...day,
              xp: day.xp + bonusXp,
              seconds: day.seconds + Math.min(7200, result.durationSec),
              lessons: (day.lessons ?? 0) + (isLesson ? 1 : 0),
            },
          },
        };
        if (isLesson) {
          next.lessons = {
            ...s.lessons,
            [result.lessonId!]: nextLessonStat(prev, result.via ?? "learn", result.accuracy, result.xp + bonusXp, now),
          };
          next = { ...next, ...withAchievement(next, "first_lesson") };
          if (perfect) next = { ...next, ...withAchievement(next, "perfect") };
        }
        if (result.kind === "drill") next = { ...next, ...withAchievement(next, "drill") };
        next = { ...next, ...evaluate(next) };
        set(next);
        return { bonusXp };
      },

      completeLessons: (lessonIds, via, accuracy) =>
        set((s) => {
          const now = Date.now();
          const lessons = { ...s.lessons };
          for (const id of lessonIds) lessons[id] = nextLessonStat(s.lessons[id], via, accuracy, 0, now);
          const today = todayKey();
          const day = s.days[today] ?? emptyDay();
          let next: AppState = {
            ...s,
            lessons,
            days: { ...s.days, [today]: { ...day, lessons: (day.lessons ?? 0) + lessonIds.length } },
          };
          if (lessonIds.length) next = { ...next, ...withAchievement(next, "first_lesson") };
          return { ...next, ...evaluate(next) };
        }),

      markReviewed: (lessonIds, accuracy) =>
        set((s) => {
          const now = Date.now();
          const lessons = { ...s.lessons };
          for (const id of lessonIds) {
            const prev = s.lessons[id];
            if (!prev) continue;
            const sched = scheduleAfter(prev, accuracy, now);
            lessons[id] = { ...prev, lastAt: now, stage: sched.stage, dueAt: sched.dueAt };
          }
          return { lessons };
        }),

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

      // ---------- конспекты 2.0 ----------

      createFolder: (name, color = "primary") => {
        const id = `f${uid()}`;
        set((s) => {
          if (s.notebook.folders.length >= NOTE_LIMITS.folders) return {};
          const folder: NoteFolder = { id, name: name.trim().slice(0, NOTE_LIMITS.folderName), color, createdAt: Date.now() };
          return { notebook: { ...s.notebook, folders: [...s.notebook.folders, folder] } };
        });
        return get().notebook.folders.some((f) => f.id === id) ? id : systemFolderId("general");
      },

      updateFolder: (id, patch) =>
        set((s) => ({
          notebook: {
            ...s.notebook,
            folders: s.notebook.folders.map((f) =>
              f.id === id ? { ...f, ...patch, name: f.system ? f.name : (patch.name ?? f.name).trim().slice(0, NOTE_LIMITS.folderName) } : f,
            ),
          },
        })),

      deleteFolder: (id) =>
        set((s) => {
          const folder = s.notebook.folders.find((f) => f.id === id);
          if (!folder || folder.system) return {};
          const general = systemFolderId("general");
          return {
            notebook: {
              folders: s.notebook.folders.filter((f) => f.id !== id),
              notes: s.notebook.notes.map((n) => (n.folderId === id ? { ...n, folderId: general } : n)),
            },
          };
        }),

      createNote: (input) => {
        const id = `n${uid()}`;
        const now = Date.now();
        set((s) => {
          const source = input.source ?? "own";
          const body = (input.body ?? "").slice(0, NOTE_LIMITS.body);
          const folderId =
            input.folderId && s.notebook.folders.some((f) => f.id === input.folderId) ? input.folderId : folderForSource(source, input.lessonId);
          const note: Note = {
            id,
            folderId,
            title: (input.title ?? titleFromBody(body)).trim().slice(0, NOTE_LIMITS.title),
            body,
            lessonId: input.lessonId,
            source,
            images: input.images?.length ? input.images : undefined,
            createdAt: now,
            updatedAt: now,
          };
          // Лимит записей: вытесняем самую старую незакреплённую.
          let notes = [note, ...s.notebook.notes];
          if (notes.length > NOTE_LIMITS.notes) {
            const victim = [...notes].reverse().find((n) => !n.pinned && n.id !== id);
            if (victim) notes = notes.filter((n) => n.id !== victim.id);
          }
          const next: AppState = { ...s, notebook: { ...s.notebook, notes } };
          return { notebook: next.notebook, ...evaluate(next) };
        });
        return id;
      },

      updateNote: (id, patch) =>
        set((s) => {
          const folderOk = patch.folderId === undefined || s.notebook.folders.some((f) => f.id === patch.folderId);
          return {
            notebook: {
              ...s.notebook,
              notes: s.notebook.notes.map((n) =>
                n.id === id
                  ? {
                      ...n,
                      ...patch,
                      folderId: folderOk ? (patch.folderId ?? n.folderId) : n.folderId,
                      title: (patch.title ?? n.title).slice(0, NOTE_LIMITS.title),
                      body: (patch.body ?? n.body).slice(0, NOTE_LIMITS.body),
                      updatedAt: patch.pinned !== undefined && Object.keys(patch).length === 1 ? n.updatedAt : Date.now(),
                    }
                  : n,
              ),
            },
          };
        }),

      deleteNote: (id) => {
        const note = get().notebook.notes.find((n) => n.id === id);
        if (!note) return [];
        set((s) => ({ notebook: { ...s.notebook, notes: s.notebook.notes.filter((n) => n.id !== id) } }));
        return note.images ?? [];
      },

      saveToNotes: (key, text) =>
        get().createNote({ source: "ai", body: text, lessonId: key === "general" ? undefined : key }),

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
        const reward = gameReward(result, key ? s.games[key]?.best : undefined, mode);
        const today = todayKey();
        const day = s.days[today] ?? emptyDay();
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
        next = { ...next, ...evaluate(next) };
        set(next);
        return reward;
      },

      recordExam: (summary, skillScores) =>
        set((s) => {
          const today = todayKey();
          const day = s.days[today] ?? emptyDay();
          let skills = s.skills;
          for (const [skill, scores] of Object.entries(skillScores)) {
            for (const score of scores) skills = { ...skills, [skill]: updateSkill(skills[skill], score) };
          }
          const answered = Object.values(skillScores).reduce((a, x) => a + x.length, 0);
          const correct = Object.values(skillScores).reduce((a, x) => a + x.filter((v) => v >= 0.99).length, 0);
          const next: AppState = {
            ...s,
            skills,
            exams: [summary, ...s.exams.filter((e) => e.id !== summary.id)].slice(0, MAX_EXAMS),
            streak: answered > 0 ? bumpStreak(s.streak, today) : s.streak,
            days: {
              ...s.days,
              [today]: {
                ...day,
                answers: day.answers + answered,
                correct: day.correct + correct,
                seconds: day.seconds + Math.min(7200, summary.durationSec),
              },
            },
          };
          return { ...next, ...evaluate(next) };
        }),

      importProgress: (raw) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
        const data = raw as Record<string, unknown>;
        // Минимальная проверка, что это наш экспорт.
        if (typeof data.xp !== "number" || !data.profile || typeof data.profile !== "object") return false;
        const migrated = migrateState(data, typeof data.version === "number" ? data.version : data.notebook ? 2 : 1);
        set((s) => mergeState({ ...initialState, ...migrated, onboarded: true }, s));
        return true;
      },

      resetProgress: () => set({ ...initialState, notebook: emptyNotebook(Date.now()) }),
    }),
    {
      name: "informatica-v1",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted, version) => migrateState(persisted, version) as AppState & AppActions,
      // Новые поля получают значения по умолчанию у старых сохранений; данные проверяются как недоверенные.
      merge: (persisted, current) => mergeState(persisted, current),
    },
  ),
);

/** Текущий уровень по XP. */
export const selectLevel = (s: AppState) => levelInfo(s.xp);

/** Множитель XP для урока прямо сейчас (1 — первый раз; меньше — повтор). */
export function lessonXpFactorNow(lessonId: string | undefined): number {
  if (!lessonId) return 1;
  return lessonXpFactor(useApp.getState().lessons[lessonId], Date.now());
}
