import { notFound } from "next/navigation";
import { getLesson } from "@/content/course";
import { buildCheck } from "@/lib/drill";
import { firstParam, parseLessonMode } from "@/lib/drill-meta";
import { withEntBoss } from "@/lib/ent-boss";
import { LessonScreen } from "./LessonScreen";

/**
 * Зерно набора «Проверить себя» — время запроса: каждый вход даёт свой набор. Страница динамическая
 * (читает searchParams) и рендерится один раз на запрос, поэтому разные значения при повторном рендере не грозят.
 */
function requestSeed(): number {
  return Date.now();
}

// Урок: ?mode=learn (по умолчанию) | check («Проверить себя»). Неизвестный mode — learn.
// Урок с «боссом» (#84) и набор «Проверить себя» собираются здесь, на сервере: в браузер уходит один урок,
// а не все уроки, банки навыков и банк ЕНТ (этап 16).
export default async function LessonPage(props: PageProps<"/lesson/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const base = getLesson(id);
  if (!base) notFound();
  const mode = parseLessonMode(firstParam(sp.mode));
  // «Босс урока»: настоящее ЕНТ-«соответствие» и «несколько верных» из банка ЕНТ — и в «Учиться», и в «Проверить себя».
  const lesson = withEntBoss(base);
  // «Проверить себя»: только задания (A → B → C), недостающее добираем из банка.
  const check = mode === "check" ? buildCheck(lesson, requestSeed()) : [];
  return <LessonScreen key={mode} lesson={lesson} mode={mode} check={check} />;
}
