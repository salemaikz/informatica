"use client";

import type { QuestionStep } from "@/lib/types";
import { BitsView } from "@/components/lesson/steps/BitsView";
import { ChoiceView, MultiView } from "@/components/lesson/steps/ChoiceView";
import { ClozeView } from "@/components/lesson/steps/ClozeView";
import { InputView } from "@/components/lesson/steps/InputView";
import { LadderView } from "@/components/lesson/steps/LadderView";
import { MatchView } from "@/components/lesson/steps/MatchView";
import { OrderView } from "@/components/lesson/steps/OrderView";
import { SolutionView } from "@/components/lesson/steps/SolutionView";
import type { StepProps } from "@/components/lesson/steps/types";

/** Вид задания по его типу — те же компоненты, что в уроках (LessonPlayer). */
export function QuizStepView(props: StepProps<QuestionStep>) {
  const { step } = props;
  switch (step.type) {
    case "choice":
      return <ChoiceView {...props} step={step} />;
    case "multi":
      return <MultiView {...props} step={step} />;
    case "input":
      return <InputView {...props} step={step} />;
    case "bits":
      return <BitsView {...props} step={step} />;
    case "ladder":
      return <LadderView {...props} step={step} />;
    case "match":
      return <MatchView {...props} step={step} />;
    case "order":
      return <OrderView {...props} step={step} />;
    case "solution":
      return <SolutionView {...props} step={step} />;
    case "cloze":
      return <ClozeView {...props} step={step} />;
  }
}
