import { notFound } from "next/navigation";
import { getLesson } from "@/content/course";
import { TheoryReader } from "@/components/theory/TheoryReader";

export default async function TheoryLessonPage(props: PageProps<"/theory/[id]">) {
  const { id } = await props.params;
  if (!getLesson(id)) notFound();
  return <TheoryReader key={id} id={id} />;
}
