import { getLesson } from "@/content/course";
import { LessonNotesScreen } from "./LessonNotesScreen";

export default async function LessonNotesPage(props: PageProps<"/notes/lesson/[id]">) {
  const { id } = await props.params;
  const lesson = getLesson(id);
  return <LessonNotesScreen id={id} lesson={lesson ? { title: lesson.title, conspect: lesson.conspect } : null} />;
}
