import type { L, LessonRef, Unit } from "@/lib/types";
import { UNITS } from "./course-map";

// Группы уроков курса 3.0 (этап 14, решение #46). Группа — 2–5 соседних уроков одной подтемы.
// После каждой группы, кроме последней в разделе, на карте — узел «Практика» (собирается кодом из банков);
// в конце раздела — «Повторение» сквозь курс (тоже кодом), затем контрольная.
// Порядок групп = порядок уроков на карте: от него считаются «текущая», «2–3 предыдущие» и «всё с начала» (50/30/20).
// Группу задаём списком id уроков (не номером), чтобы id узла не съезжал при вставке новых уроков.

export const GROUPS_BY_UNIT: Record<string, { title: L; lessons: string[] }[]> = {
  u0: [
    { title: { ru: "Компьютер и устройства", kk: "Компьютер және құрылғылар" }, lessons: ["base-1-computer", "base-2-inside", "base-3-devices", "base-4-media"] },
    { title: { ru: "Процессор, ОС и клавиатура", kk: "Процессор, ОЖ және пернетақта" }, lessons: ["base-5-cpu", "base-6-os", "base-7-keys", "base-8-info"] },
  ],
  u1: [
    { title: { ru: "Двоичная система", kk: "Екілік жүйе" }, lessons: ["ns-1-bits", "ns-2-read", "ns-3-write", "ns-4-traps"] },
    { title: { ru: "Другие системы и арифметика", kk: "Басқа жүйелер және арифметика" }, lessons: ["ns-5-oct-hex", "ns-6-any-base", "ns-7-arith", "ns-8-compare", "ns-9-count"] },
    { title: { ru: "Объём информации", kk: "Ақпарат көлемі" }, lessons: ["info-1-units", "info-2-formula", "info-5-alphabet", "info-6-text-volume"] },
    { title: { ru: "Кодирование текста, графики и звука", kk: "Мәтінді, графиканы және дыбысты кодтау" }, lessons: ["info-3-text", "info-7-encodings", "info-4-media", "info-8-graphics", "info-9-sound"] },
  ],
  u2: [
    { title: { ru: "Операции и таблицы истинности", kk: "Амалдар және ақиқат кестелері" }, lessons: ["logic-1-ops", "logic-5-impl", "logic-2-tables", "logic-6-build"] },
    { title: { ru: "Схемы и законы логики", kk: "Схемалар және логика заңдары" }, lessons: ["logic-3-circuits", "logic-7-schemes", "logic-4-laws"] },
    { title: { ru: "Логические задачи", kk: "Логикалық есептер" }, lessons: ["logic-8-numbers", "logic-9-sets", "logic-10-reasoning"] },
  ],
  u3: [
    { title: { ru: "Первые программы", kk: "Алғашқы программалар" }, lessons: ["algo-1-basics", "py-0-start", "py-1-vars", "py-1b-types", "py-1c-ops"] },
    { title: { ru: "Ветвления", kk: "Тармақталу" }, lessons: ["py-2a-if", "py-2a-else", "py-2a-elif", "py-2-if", "py-2b-logic"] },
    { title: { ru: "Цикл for и range", kk: "for циклі және range" }, lessons: ["py-3-loops", "py-3a-range", "py-3a-range2", "py-3a-step", "py-3b-for"] },
    { title: { ru: "while и типовые алгоритмы", kk: "while және типтік алгоритмдер" }, lessons: ["py-3c-while", "py-3d-nested", "py-3e-patterns"] },
    { title: { ru: "Строки и срезы", kk: "Жолдар және тілімдер" }, lessons: ["py-4-strings", "py-4a-index", "py-4a-slice", "py-4a-step", "py-4b-methods"] },
    { title: { ru: "Списки", kk: "Тізімдер" }, lessons: ["py-5-lists", "py-5b-listops", "py-5c-matrix"] },
    { title: { ru: "Функции и рекурсия", kk: "Функциялар және рекурсия" }, lessons: ["py-6-functions", "py-6b-params", "py-6c-recursion"] },
    { title: { ru: "Сортировка, поиск, файлы, графы", kk: "Сұрыптау, іздеу, файлдар, графтар" }, lessons: ["py-7-algos", "py-7a-sort", "py-7b-search", "py-7c-files", "py-7d-graphs"] },
    { title: { ru: "Чтение и отладка программ", kk: "Программаны оқу және жөндеу" }, lessons: ["py-8-trace", "py-8b-context", "py-8c-debug"] },
  ],
  u4: [
    { title: { ru: "Таблицы, ключи, связи", kk: "Кестелер, кілттер, байланыстар" }, lessons: ["db-1-relational", "db-4-keys", "db-5-design"] },
    { title: { ru: "SELECT и WHERE", kk: "SELECT және WHERE" }, lessons: ["db-2-select", "db-6-where", "db-7-order"] },
    { title: { ru: "Изменение, итоги, JOIN", kk: "Өзгерту, қорытынды, JOIN" }, lessons: ["db-3-modify", "db-8-group", "db-9-join", "db-10-ddl"] },
  ],
  u5: [
    { title: { ru: "Устройство и память", kk: "Құрылғы және жад" }, lessons: ["pc-1-devices", "pc-2-cpu", "pc-4-neumann", "pc-5-memory"] },
    { title: { ru: "Программы и файлы", kk: "Программалар және файлдар" }, lessons: ["pc-3-software", "pc-6-os", "pc-7-licenses", "pc-8-archives"] },
  ],
  u6: [
    { title: { ru: "Сети и оборудование", kk: "Желілер және жабдық" }, lessons: ["net-1-basics", "net-5-topology", "net-6-hardware"] },
    { title: { ru: "Адреса, протоколы, скорость", kk: "Мекенжайлар, хаттамалар, жылдамдық" }, lessons: ["net-2-internet", "net-7-protocols", "net-8-mask", "net-3-speed"] },
    { title: { ru: "Безопасность", kk: "Қауіпсіздік" }, lessons: ["net-4-security", "net-9-malware", "net-10-crypto"] },
  ],
  u7: [
    { title: { ru: "Ссылки в таблицах", kk: "Кестедегі сілтемелер" }, lessons: ["data-1-sheets", "data-2a-relative", "data-2a-absolute", "data-2a-mixed", "data-2-refs"] },
    { title: { ru: "Функции таблиц", kk: "Кесте функциялары" }, lessons: ["data-3-functions", "data-4-if", "data-5-text"] },
    { title: { ru: "Копирование, диаграммы, документы", kk: "Көшіру, диаграммалар, құжаттар" }, lessons: ["data-6-copy", "data-7-charts", "doc-1-text"] },
    { title: { ru: "HTML", kk: "HTML" }, lessons: ["web-1-html", "web-3-content", "web-4-tables"] },
    { title: { ru: "CSS", kk: "CSS" }, lessons: ["web-2-css", "web-5-layout"] },
  ],
  u8: [
    { title: { ru: "ИИ, данные, облака", kk: "Жасанды интеллект, деректер, бұлт" }, lessons: ["it-1-trends", "it-4-ai", "it-5-data"] },
    { title: { ru: "Стартап и 3D", kk: "Стартап және 3D" }, lessons: ["it-2-startup", "it-6-business", "it-3-3d", "it-7-print"] },
  ],
  u9: [{ title: { ru: "Стратегия ЕНТ", kk: "ҰБТ стратегиясы" }, lessons: ["ent-1-strategy"] }],
};

export interface CourseGroup {
  /** «g:<id первого урока>» — стабилен при вставке уроков в другие группы. */
  id: string;
  unitId: string;
  /** Номер группы в разделе (с 0). */
  index: number;
  /** Последняя группа раздела: после неё «Повторение», а не «Практика». */
  last: boolean;
  /** Короткое название подтемы: «Практика: Ветвления», «Мини-тест: Ветвления». */
  title: L;
  lessons: string[];
}

/** Узел курса 3.0 на карте: «Практика» после группы или «Повторение» в конце раздела. */
export type CourseNodeKind = "practice" | "recap";

/** id узла: «practice:<id первого урока группы>», «recap:<id раздела>». */
export const practiceNodeId = (g: Pick<CourseGroup, "lessons">): string => `practice:${g.lessons[0]}`;
export const recapNodeId = (unitId: string): string => `recap:${unitId}`;

/** Группы раздела в порядке карты (уроки, которых нет на карте раздела, отбрасываются). */
export function unitGroups(unit: Pick<Unit, "id" | "lessons">): CourseGroup[] {
  const onMap = new Set(unit.lessons.map((l: LessonRef) => l.id));
  const lists = (GROUPS_BY_UNIT[unit.id] ?? [])
    .map((g) => ({ title: g.title, lessons: g.lessons.filter((id) => onMap.has(id)) }))
    .filter((g) => g.lessons.length > 0);
  return lists.map((g, index) => ({ id: `g:${g.lessons[0]}`, unitId: unit.id, index, last: index === lists.length - 1, title: g.title, lessons: g.lessons }));
}

/** Все группы курса подготовки к ЕНТ в порядке карты. */
export const COURSE_GROUPS: CourseGroup[] = UNITS.flatMap(unitGroups);

export function groupById(id: string): CourseGroup | undefined {
  return COURSE_GROUPS.find((g) => g.id === id);
}

/** Группа, к которой относится узел «Практика» (по id узла). */
export function groupOfPracticeNode(nodeId: string): CourseGroup | undefined {
  return COURSE_GROUPS.find((g) => !g.last && practiceNodeId(g) === nodeId);
}
