import { notFound } from "next/navigation";
import { getLesson } from "@/content/course";
import { TheoryReader } from "@/components/theory/TheoryReader";
import { CARD_PARAM, paramValue } from "@/lib/theory-href";

// Урок читается на сервере и приходит в клиент одним объектом: страница не грузит содержимое всех уроков (этап 16).
// Карточку (`?card=<шаг>` / `?card=conspect`, на неё ведёт поиск) читаем здесь же: при переходе внутри приложения
// `window.location.hash` в первом рендере ещё старый, а параметры страница получает сразу.
export default async function TheoryLessonPage(props: PageProps<"/theory/[id]">) {
  const { id } = await props.params;
  const card = paramValue((await props.searchParams)[CARD_PARAM]);
  const lesson = getLesson(id);
  if (!lesson) notFound();
  // key с карточкой: другая ссылка на тот же урок (из поиска) открывается с нужной карточки, а не с состоянием прошлого чтения.
  return <TheoryReader key={`${id}|${card ?? ""}`} lesson={lesson} initialCard={card} />;
}
