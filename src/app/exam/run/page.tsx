import { ExamRun } from "@/components/exam/ExamRun";
import { parseRunParams } from "@/components/exam/logic";

// Прохождение: ?kind=full|mini|topic&seed=…&topics=t04,t05. Без kind — продолжение начатой попытки.
export default async function ExamRunPage(props: PageProps<"/exam/run">) {
  const params = parseRunParams(await props.searchParams);
  return <ExamRun kind={params?.kind ?? null} seed={params?.seed ?? null} topics={params?.topics ?? []} />;
}
