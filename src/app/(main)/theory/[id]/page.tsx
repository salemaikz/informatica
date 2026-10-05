import { notFound } from "next/navigation";
import { getLesson } from "@/content/course";
import { TheoryReader } from "@/components/theory/TheoryReader";

// Урок читается на сервере и приходит в клиент одним объектом: страница не грузит содержимое всех уроков (этап 16).
export default async function TheoryLessonPage(props: PageProps<"/theory/[id]">) {
  const { id } = await props.params;
  const lesson = getLesson(id);
  if (!lesson) notFound();
  return <TheoryReader key={id} lesson={lesson} />;
}
