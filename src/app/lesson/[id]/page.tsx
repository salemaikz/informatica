import { notFound } from "next/navigation";
import { lessonMeta } from "@/content/catalog";
import { firstParam, parseLessonMode } from "@/lib/drill-meta";
import { LessonScreen } from "./LessonScreen";

// Урок: ?mode=learn (по умолчанию) | check («Проверить себя»). Неизвестный mode — learn.
export default async function LessonPage(props: PageProps<"/lesson/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!lessonMeta(id)) notFound();
  const mode = parseLessonMode(firstParam(sp.mode));
  return <LessonScreen key={mode} id={id} mode={mode} />;
}
