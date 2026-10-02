import { redirect } from "next/navigation";
import { UNITS, getLesson } from "@/content/course";
import { systemFolderId } from "@/lib/notebook";
import { NoteScreen } from "./NoteScreen";

export default async function NotePage(props: PageProps<"/notes/[id]">) {
  const { id } = await props.params;
  // Старые адреса (конспекты 1.0): /notes/general и /notes/<id урока> — переходим на новые экраны.
  if (id === "general") redirect(`/notes/folder/${systemFolderId("general")}`);
  if (getLesson(id) || UNITS.some((u) => u.lessons.some((r) => r.id === id))) redirect(`/notes/lesson/${id}`);
  return <NoteScreen id={id} />;
}
