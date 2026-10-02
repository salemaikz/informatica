import { PrintSheet } from "@/components/exam/PrintSheet";
import { parsePrintParams } from "@/components/exam/print-logic";

// Лист для печати: ?kind=full|mini|topic&seed=…&topics=t04,t05&lang=ru|kk. Публичная (см. lib/public-paths.ts).
export default async function ExamPrintPage(props: PageProps<"/exam/print">) {
  const params = parsePrintParams(await props.searchParams);
  return <PrintSheet params={params} />;
}
