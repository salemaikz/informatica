import type { Lesson, Unit } from "@/lib/types";
import { lessonBinary } from "./lessons/ns-1-binary";
import { CURRICULUM_LESSONS } from "./lessons";

export const LESSONS: Record<string, Lesson> = Object.fromEntries(
  [lessonBinary, ...CURRICULUM_LESSONS].map((lesson) => [lesson.id, lesson]),
);

const sections: Omit<Unit, "lessons">[] = [
  { id: "u1", title: { ru: "Информация и системы счисления", kk: "Ақпарат және санау жүйелері" }, description: { ru: "Числа, кодирование, объём и передача данных", kk: "Сандар, кодтау, көлем және деректерді тасымалдау" }, color: "#1a91d6" },
  { id: "u2", title: { ru: "Логика", kk: "Логика" }, description: { ru: "Условия, таблицы истинности и схемы", kk: "Шарттар, ақиқат кестелері және сызбалар" }, color: "#0f9f8f" },
  { id: "u3", title: { ru: "Алгоритмы и Python", kk: "Алгоритмдер және Python" }, description: { ru: "От переменных до рекурсии, файлов и графов", kk: "Айнымалылардан рекурсия, файлдар мен графтарға дейін" }, color: "#d13e70" },
  { id: "u4", title: { ru: "Компьютер и программы", kk: "Компьютер және программалар" }, description: { ru: "Устройства, память, операционная система и ПО", kk: "Құрылғылар, жад, операциялық жүйе және программалар" }, color: "#5964cf" },
  { id: "u5", title: { ru: "Базы данных и SQL", kk: "Деректер қоры және SQL" }, description: { ru: "Ключи, связи, запросы и изменение данных", kk: "Кілттер, байланыстар, сұраныстар және деректерді өзгерту" }, color: "#0e8fa2" },
  { id: "u6", title: { ru: "Сети и безопасность", kk: "Желілер және қауіпсіздік" }, description: { ru: "Адреса, протоколы, защита и электронная подпись", kk: "Мекенжайлар, хаттамалар, қорғау және электрондық қолтаңба" }, color: "#bd691d" },
  { id: "u7", title: { ru: "Таблицы, документы и веб", kk: "Кестелер, құжаттар және веб" }, description: { ru: "Формулы, информационные объекты, HTML и CSS", kk: "Формулалар, ақпараттық нысандар, HTML және CSS" }, color: "#317fa6" },
  { id: "u8", title: { ru: "Современные технологии", kk: "Қазіргі технологиялар" }, description: { ru: "Облака, ИИ, стартапы и 3D-моделирование", kk: "Бұлт, ЖИ, стартаптар және 3D модельдеу" }, color: "#a353b2" },
  { id: "u9", title: { ru: "Стратегия ЕНТ", kk: "ҰБТ стратегиясы" }, description: { ru: "Форматы, темп и разбор ошибок", kk: "Пішімдер, қарқын және қателерді талдау" }, color: "#aa7730" },
];

export const UNITS: Unit[] = sections.map((section) => ({
  ...section,
  lessons: Object.values(LESSONS).filter((lesson) => lesson.unitId === section.id)
    .map((lesson) => ({ id: lesson.id, title: lesson.title, status: "available" as const })),
}));

export function getLesson(id: string): Lesson | undefined { return LESSONS[id]; }

export function lessonNumber(id: string): number {
  let n = 0;
  for (const unit of UNITS) for (const lesson of unit.lessons) { n++; if (lesson.id === id) return n; }
  return 0;
}

export function unlockedSkills(completedLessonIds: string[]): string[] {
  return [...new Set(completedLessonIds.flatMap((id) => LESSONS[id]?.skills ?? []))];
}

export function findStep(lessonId: string | undefined, stepId: string) {
  return lessonId ? LESSONS[lessonId]?.steps.find((step) => step.id === stepId) : undefined;
}
