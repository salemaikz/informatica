// Базовые типы платформы. Контент всегда двуязычный (ru + kk).

export type Lang = "ru" | "kk";

/** Локализованная строка: обязательно оба языка. */
export type L = { ru: string; kk: string };

/** Текст, который не нужно переводить (числа, код), либо локализованная строка. */
export type Text = string | L;

export type SkillId = string;

export interface Skill {
  id: SkillId;
  title: L;
  topic: L;
}

// ---------- Шаги урока ----------

interface StepBase {
  id: string;
  /** Навык, который тренирует шаг. У теории/видео может отсутствовать. */
  skill?: SkillId;
  /** Формат ЕНТ — помечается бейджем. */
  ent?: boolean;
}

export interface VideoStep extends StepBase {
  type: "video";
  videoId: string;
  title: L;
}

export interface TheoryStep extends StepBase {
  type: "theory";
  title: L;
  /** Markdown. */
  body: L;
  /** Встроенная иллюстрация (React-компонент из components/visuals). */
  visual?: VisualId;
}

export interface ChoiceStep extends StepBase {
  type: "choice";
  prompt: L;
  options: Text[];
  correct: number;
  explanation: L;
}

export interface MultiStep extends StepBase {
  type: "multi";
  prompt: L;
  options: Text[];
  correct: number[];
  explanation: L;
}

export interface InputStep extends StepBase {
  type: "input";
  prompt: L;
  /** Допустимые ответы (после нормализации). */
  answers: string[];
  mode: "number" | "binary" | "text";
  /** Подпись после поля, например «₂». */
  suffix?: string;
  explanation: L;
}

/** Интерактив: переключай биты, чтобы собрать число. */
export interface BitsStep extends StepBase {
  type: "bits";
  prompt: L;
  target: number;
  bits: number;
  explanation: L;
}

/** Интерактив: «лесенка» деления на 2 — ученик выбирает остатки. */
export interface LadderStep extends StepBase {
  type: "ladder";
  prompt: L;
  number: number;
  explanation: L;
}

export interface MatchStep extends StepBase {
  type: "match";
  prompt: L;
  pairs: { left: Text; right: Text }[];
  explanation: L;
}

export interface OrderStep extends StepBase {
  type: "order";
  prompt: L;
  /** Элементы в ПРАВИЛЬНОМ порядке; на экране перемешиваются. */
  items: L[];
  explanation: L;
}

/** Развёрнутое решение: рисунок на платформе или фото тетради, проверяет ИИ. */
export interface SolutionStep extends StepBase {
  type: "solution";
  prompt: L;
  /** Эталонное решение — уходит в промпт ИИ-проверки. */
  reference: L;
  /** Итоговый ответ для быстрой проверки без ИИ. */
  answer: string;
  answerMode: "number" | "binary" | "text";
  explanation: L;
}

export type QuestionStep =
  | ChoiceStep
  | MultiStep
  | InputStep
  | BitsStep
  | LadderStep
  | MatchStep
  | OrderStep
  | SolutionStep;

export type Step = VideoStep | TheoryStep | QuestionStep;

export type StepType = Step["type"];

export type VisualId = "place-values" | "binary-weights" | "division-ladder" | "lamps";

export interface Lesson {
  id: string;
  unitId: string;
  title: L;
  description: L;
  skills: SkillId[];
  durationMin: number;
  steps: Step[];
  /** Конспект урока (markdown) — сохраняется ученику после прохождения. */
  conspect: L;
}

export interface LessonRef {
  id: string;
  title: L;
  /** available — урок готов, soon — в разработке. */
  status: "available" | "soon";
}

export interface Unit {
  id: string;
  title: L;
  description: L;
  /** CSS-цвет акцента раздела. */
  color: string;
  lessons: LessonRef[];
}

// ---------- Результаты ----------

export interface AnswerRecord {
  stepId: string;
  skill?: SkillId;
  correct: boolean;
  /** Частичный балл (для проверки решения ИИ): 0..1. */
  score: number;
  given: string;
  expected: string;
  prompt: string;
  /** Повторная попытка в «работе над ошибками». */
  retry: boolean;
  timeMs: number;
}

export interface SessionResult {
  kind: "lesson" | "drill";
  lessonId?: string;
  title: string;
  answers: AnswerRecord[];
  xp: number;
  maxCombo: number;
  durationSec: number;
  accuracy: number;
}

export type Grade = "8" | "9" | "10" | "11" | "other";
export type Goal = "ent" | "school" | "interest";
export type ExplainStyle = "short" | "examples" | "steps";
export type Theme = "system" | "light" | "dark";
