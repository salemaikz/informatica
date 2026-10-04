import { ExamRun } from "@/components/exam/ExamRun";
import { parseRunParams } from "@/components/exam/logic";
import { EntOnly } from "@/components/school/EntOnly";

// Прохождение: ?kind=full|mini|topic|unit&seed=…&topics=t04,t05&unit=u3. Без kind — продолжение начатой попытки.
// В школьном треке — карточка «Этот раздел — для подготовки к ЕНТ» (#52); результаты старых попыток (/exam/result/[id]) остаются доступны.
export default async function ExamRunPage(props: PageProps<"/exam/run">) {
  const params = parseRunParams(await props.searchParams);
  return (
    <EntOnly fullscreen>
      <ExamRun kind={params?.kind ?? null} seed={params?.seed ?? null} topics={params?.topics ?? []} unit={params?.unit} />
    </EntOnly>
  );
}
