import { getLesson } from "@/content/course";
import { UNITS } from "@/content/course-map";
import { hasBank } from "@/content/catalog";
import { ENT_TOPICS } from "@/content/ent-topics";
import { SKILLS } from "@/content/skills";
import { canGenerate } from "@/lib/generators";
import { buildIndex, lessonDocs, skillDocs, topicDocs, type SearchIndex } from "@/lib/search";
import { readableLessonIds } from "@/lib/theory";
import type { Lang, Lesson } from "@/lib/types";

// Индекс поиска по курсу: теория и конспекты всех уроков, навыки, темы ЕНТ.
// Тяжёлый (содержимое всех уроков) — страница поиска грузит его отдельным куском после показа (этап 16).

export function buildCourseIndex(lang: Lang): SearchIndex {
  const lessons = readableLessonIds(UNITS)
    .map((id) => getLesson(id))
    .filter((x): x is Lesson => !!x);
  const skills = SKILLS.filter((s) => hasBank(s.id) || canGenerate(s.id));
  return buildIndex([...lessonDocs(lessons, UNITS, lang), ...skillDocs(skills, lang), ...topicDocs(ENT_TOPICS, lang)]);
}
