// Общие типы запросов к ИИ (клиент ↔ сервер).

import type { Lang } from "./types";

export interface StudentContext {
  name: string;
  lang: Lang;
  grade: string;
  goal: string;
  style: string;
  level: number;
  xp: number;
  streak: number;
  weak: string[];
  strong: string[];
  mistakes: { q: string; given: string; expected: string }[];
  memory: string;
  notes: string;
  lessons: string[];
}

/** Задание, к которому относится вопрос (подсказка / разбор ошибки). */
export interface TaskContext {
  prompt: string;
  /** Варианты, если есть. */
  options?: string[];
  correct?: string;
  given?: string;
  explanation?: string;
  /** Текст теории текущего шага (режим «вопрос по уроку»). */
  theory?: string;
  /** Ученик уже ответил на задание — ответ можно обсуждать открыто. */
  answered?: boolean;
  /** Бесплатная подсказка автора (на языке ученика, без разметки). */
  hint?: string;
  /** Разбор выбранного неверного варианта (после ответа). */
  whyWrong?: string;
  /** Стабильный ключ задания (id шага) — для логов/аналитики; ключ кэша строит сервер по содержимому. */
  stepKey?: string;
  /** Практикум кода (решение #35): язык, код ученика и ошибка/итог проверки. */
  ide?: string;
  code?: string;
  error?: string;
}

export type TutorMode = "chat" | "hint" | "explain" | "ask";

export interface TutorRequest {
  mode: TutorMode;
  messages: { role: "user" | "assistant"; content: string }[];
  context: StudentContext;
  task?: TaskContext;
  /** dataURL изображения для последнего сообщения. */
  image?: string;
  /** ИИ-чат 2.0: режим чата (только для mode "chat") и тема ЕНТ (t01–t13). */
  chatMode?: "free" | "explain" | "tasks" | "check" | "ent";
  topic?: string;
}

export interface CheckSolutionRequest {
  lang: Lang;
  context: StudentContext;
  task: { prompt: string; reference: string; answer: string };
  typedAnswer?: string;
  image?: string;
}

export interface CheckSolutionResponse {
  verdict: "correct" | "partial" | "incorrect" | "unreadable";
  score: number;
  feedback: string;
  steps: { text: string; ok: boolean }[];
  tip: string;
}

export interface LessonFeedbackRequest {
  context: StudentContext;
  lesson: string;
  accuracy: number;
  durationSec: number;
  mistakes: { q: string; given: string; expected: string }[];
  skills: { title: string; mastery: number }[];
}

export interface LessonFeedbackResponse {
  feedback: string;
  memory: string;
  focus: string[];
}
