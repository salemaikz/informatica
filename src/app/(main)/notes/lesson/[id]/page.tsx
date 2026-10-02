import { LessonNotesScreen } from "./LessonNotesScreen";

export default async function LessonNotesPage(props: PageProps<"/notes/lesson/[id]">) {
  const { id } = await props.params;
  return <LessonNotesScreen id={id} />;
}
