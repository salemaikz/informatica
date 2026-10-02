import type { Lesson, Unit } from "@/lib/types";
import { lessonBinary } from "./lessons/ns-1-binary";

// Карта курса подготовки к ЕНТ по информатике.
// status: "soon" — урок запланирован, но ещё не написан (см. docs/ROADMAP.md).

export const UNITS: Unit[] = [
  {
    id: "u1",
    title: { ru: "Информация и системы счисления", kk: "Ақпарат және санау жүйелері" },
    description: { ru: "Как компьютер хранит числа", kk: "Компьютер сандарды қалай сақтайды" },
    color: "#1a91d6",
    lessons: [
      { id: "ns-1-binary", title: lessonBinary.title, status: "available" },
      { id: "ns-2-oct-hex", title: { ru: "Восьмеричная и шестнадцатеричная", kk: "Сегіздік және он алтылық" }, status: "soon" },
      { id: "ns-3-arith", title: { ru: "Арифметика в двоичной системе", kk: "Екілік жүйедегі арифметика" }, status: "soon" },
      { id: "info-units", title: { ru: "Единицы измерения информации", kk: "Ақпаратты өлшеу бірліктері" }, status: "soon" },
    ],
  },
  {
    id: "u2",
    title: { ru: "Логика", kk: "Логика" },
    description: { ru: "Высказывания и таблицы истинности", kk: "Пікірлер және ақиқат кестелері" },
    color: "#0f9f8f",
    lessons: [
      { id: "logic-1-ops", title: { ru: "Логические операции", kk: "Логикалық амалдар" }, status: "soon" },
      { id: "logic-2-tables", title: { ru: "Таблицы истинности", kk: "Ақиқат кестелері" }, status: "soon" },
    ],
  },
  {
    id: "u3",
    title: { ru: "Алгоритмы и Python", kk: "Алгоритмдер және Python" },
    description: { ru: "От блок-схем к первым программам", kk: "Блок-схемалардан алғашқы бағдарламаларға дейін" },
    color: "#e0457b",
    lessons: [
      { id: "algo-1-basics", title: { ru: "Алгоритмы и блок-схемы", kk: "Алгоритмдер және блок-схемалар" }, status: "soon" },
      { id: "py-1-vars", title: { ru: "Переменные и типы данных", kk: "Айнымалылар және деректер типтері" }, status: "soon" },
      { id: "py-2-if", title: { ru: "Ветвления", kk: "Тармақталу" }, status: "soon" },
      { id: "py-3-loops", title: { ru: "Циклы", kk: "Циклдер" }, status: "soon" },
    ],
  },
  {
    id: "u4",
    title: { ru: "Компьютер и сети", kk: "Компьютер және желілер" },
    description: { ru: "Устройство ПК, интернет, адресация", kk: "ДК құрылысы, интернет, адрестеу" },
    color: "#5b63e6",
    lessons: [
      { id: "pc-1-arch", title: { ru: "Устройство компьютера", kk: "Компьютердің құрылысы" }, status: "soon" },
      { id: "net-1-basics", title: { ru: "Компьютерные сети и интернет", kk: "Компьютерлік желілер және интернет" }, status: "soon" },
    ],
  },
  {
    id: "u5",
    title: { ru: "Данные", kk: "Деректер" },
    description: { ru: "Кодирование, таблицы, базы данных", kk: "Кодтау, кестелер, деректер қоры" },
    color: "#0e8fb0",
    lessons: [
      { id: "data-1-coding", title: { ru: "Кодирование текста и изображений", kk: "Мәтін мен суретті кодтау" }, status: "soon" },
      { id: "data-2-sheets", title: { ru: "Электронные таблицы", kk: "Электрондық кестелер" }, status: "soon" },
      { id: "data-3-db", title: { ru: "Базы данных", kk: "Деректер қоры" }, status: "soon" },
    ],
  },
];

export const LESSONS: Record<string, Lesson> = {
  [lessonBinary.id]: lessonBinary,
};

export function getLesson(id: string): Lesson | undefined {
  return LESSONS[id];
}

/** Порядковый номер урока в курсе (1-based). */
export function lessonNumber(id: string): number {
  let n = 0;
  for (const u of UNITS) {
    for (const l of u.lessons) {
      n++;
      if (l.id === id) return n;
    }
  }
  return 0;
}

/** Навыки, открытые пройденными уроками — их можно тренировать. */
export function unlockedSkills(completedLessonIds: string[]): string[] {
  const set = new Set<string>();
  for (const id of completedLessonIds) LESSONS[id]?.skills.forEach((s) => set.add(s));
  return [...set];
}

/** Ищет шаг урока по id (для работы над ошибками). */
export function findStep(lessonId: string | undefined, stepId: string) {
  if (!lessonId) return undefined;
  return LESSONS[lessonId]?.steps.find((s) => s.id === stepId);
}
