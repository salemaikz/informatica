import { ExamResult } from "@/components/exam/ExamResult";

// Итог попытки пробного ЕНТ: id — из истории в сторе, разбор — из IndexedDB.
export default async function ExamResultPage(props: PageProps<"/exam/result/[id]">) {
  const { id } = await props.params;
  return <ExamResult id={id} />;
}
