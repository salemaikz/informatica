import type { Answer, StepResult } from "@/lib/evaluate";
import type { QuestionStep } from "@/lib/types";

export interface StepProps<S extends QuestionStep> {
  step: S;
  answer: Answer | null;
  /** submit: сразу проверить (для самопроверяющихся заданий, например «пары»). */
  onAnswer: (a: Answer | null, opts?: { submit?: boolean }) => void;
  /** Ответ проверен — интерфейс заблокирован и подсвечен. */
  locked: boolean;
  result: StepResult | null;
}
