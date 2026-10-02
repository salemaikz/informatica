import { notFound } from "next/navigation";
import { getLesson } from "@/content/course";
import { LessonScreen } from "./LessonScreen";

export default async function LessonPage(props: PageProps<"/lesson/[id]">) {
  const { id } = await props.params;
  if (!getLesson(id)) notFound();
  return <LessonScreen id={id} />;
}
