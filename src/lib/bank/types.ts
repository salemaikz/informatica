import type { L, Level, QuestionStep, SkillId, Text } from "../types";

// Банк заданий: единый источник заданий для уроков, тренировки, мини-игр и пробного ЕНТ.
// Каждый навык умеет выдавать задания разных «форм» — игры берут ту форму, которая им нужна,
// поэтому новая тема автоматически появляется во всех подходящих играх.

export type Rand = () => number;

/** Утверждение «верно / неверно» (игра «Верю — не верю»). */
export interface Statement {
  id: string;
  skill: SkillId;
  level: Level;
  text: L;
  value: boolean;
  /** Почему так — показывается после ответа. */
  explanation: L;
  /** Бесплатная подсказка (не выдаёт ответ): с чего начать проверку. */
  hint?: L;
}

/** Пара соответствия (игры «Мемо-пары», «Бинго», задание «соответствие»). */
export interface Pair {
  id: string;
  skill: SkillId;
  level: Level;
  left: Text;
  right: Text;
}

/** Вопрос с коротким однозначным ответом (игры «Шифровка», «Бинго», «Спринт» с вводом). */
export interface ShortQuestion {
  id: string;
  skill: SkillId;
  level: Level;
  prompt: L;
  /** Канонический ответ (как его показывать). */
  answer: string;
  mode: "number" | "binary" | "text";
  explanation: L;
  /** Бесплатная подсказка (не выдаёт ответ). */
  hint?: L;
}

/** Что умеет выдавать навык. question — обязательно, остальные формы — по возможности. */
export interface SkillBank {
  skill: SkillId;
  question: (level: Level, seed: number) => QuestionStep;
  statement?: (level: Level, seed: number) => Statement;
  pair?: (level: Level, seed: number) => Pair;
  short?: (level: Level, seed: number) => ShortQuestion;
}

export type Shape = "question" | "statement" | "pair" | "short";
