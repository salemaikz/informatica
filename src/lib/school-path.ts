import { LESSON_META } from "@/content/catalog";
import type { CourseGroup } from "@/content/groups";
import type { SchoolGradePlan, SchoolTopic } from "@/content/school-program";
import type { L } from "./types";

// Школьная дорожка (этап 16Б, волна 2): класс → разделы по порядку плана → готовые уроки раздела, узлы «Упражнения» после раздела,
// «Повторение» в конце четверти, «Тест по разделу». Чистая логика без React; данные — школьная программа и лёгкий каталог.
// Тесты — tests/school-path.test.ts.
//
// - Урок встречается в классе один раз: в первом разделе, где он закрывает тему (повтор в следующих разделах — только в списке тем).
// - Раздел без готовых уроков — на дорожке только строкой «Скоро: …», без узлов.
// - Группы в формате CourseGroup — их понимает сборка упражнений и повторения (lib/course-mix.ts) наравне с группами ЕНТ.

/** Ключ плана: «8», «10-emn», «11-ogn». */
export const schoolPlanKey = (plan: Pick<SchoolGradePlan, "grade" | "direction">): string =>
  plan.direction ? `${plan.grade}-${plan.direction}` : plan.grade;

/** id узла «Упражнения» раздела (формат узлов курса: lib/course-nodes.ts, ID_RE). */
export const schoolPracticeNodeId = (sectionId: string): string => `practice:sch-${sectionId}`;
/** id узла «Повторение» четверти (без четвертей — всего класса). */
export const schoolRecapNodeId = (planKey: string, quarter?: number): string => `recap:sch-${planKey}${quarter ? `-q${quarter}` : ""}`;
/** «Раздел» для повторения: группы одной четверти делят unitId. */
const recapUnitId = (planKey: string, quarter?: number): string => `sch-${planKey}${quarter ? `-q${quarter}` : ""}`;

export interface SchoolPathSection {
  sectionId: string;
  title: L;
  quarter?: 1 | 2 | 3 | 4;
  /** Готовые уроки раздела в порядке тем, без повторов внутри класса. */
  lessons: string[];
  /** Темы без уроков («скоро»). */
  soon: SchoolTopic[];
  /** Группа для упражнений; null — в разделе нет готовых уроков. */
  group: CourseGroup | null;
  /** После этого раздела заканчивается четверть (или класс) — узел «Повторение». */
  recapAfter: boolean;
}

export interface SchoolPath {
  planKey: string;
  sections: SchoolPathSection[];
  /** Группы класса в порядке дорожки (для course-mix: «недавнее» и «давнее» считаются внутри класса). */
  groups: CourseGroup[];
}

const ready = (id: string): boolean => Object.hasOwn(LESSON_META, id);

export function schoolPath(plan: SchoolGradePlan): SchoolPath {
  const planKey = schoolPlanKey(plan);
  const seen = new Set<string>();
  const sections: SchoolPathSection[] = plan.sections.map((sec) => {
    const lessons: string[] = [];
    const soon: SchoolTopic[] = [];
    for (const t of sec.topics) {
      const own = t.lessonIds.filter(ready);
      if (!own.length) soon.push(t);
      for (const id of own) {
        if (seen.has(id)) continue;
        seen.add(id);
        lessons.push(id);
      }
    }
    return { sectionId: sec.id, title: sec.title, quarter: sec.quarter, lessons, soon, group: null, recapAfter: false };
  });

  // Повторение — после последнего раздела четверти, в котором есть уроки (у плана без четвертей — после последнего такого раздела).
  const withLessons = sections.filter((s) => s.lessons.length > 0);
  withLessons.forEach((s, i) => {
    const next = withLessons[i + 1];
    s.recapAfter = !next || next.quarter !== s.quarter;
  });

  const groups: CourseGroup[] = withLessons.map((s, index) => ({
    id: `g:sch-${s.sectionId}`,
    unitId: recapUnitId(planKey, s.quarter),
    index,
    last: s.recapAfter,
    title: s.title,
    lessons: s.lessons,
  }));
  withLessons.forEach((s, i) => (s.group = groups[i]));
  return { planKey, sections, groups };
}

/** Группы четверти (для «Повторения»): все разделы с тем же unitId. */
export function recapGroups(path: SchoolPath, recapNodeId: string): CourseGroup[] {
  const unitId = recapNodeId.replace(/^recap:/, "");
  return path.groups.filter((g) => g.unitId === unitId);
}

/** Раздел по id узла «Упражнения» (null — узла нет в этом классе). */
export function sectionOfPracticeNode(path: SchoolPath, nodeId: string): SchoolPathSection | null {
  return path.sections.find((s) => s.group && schoolPracticeNodeId(s.sectionId) === nodeId) ?? null;
}
