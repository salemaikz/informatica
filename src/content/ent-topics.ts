import type { EntTopicId, L } from "@/lib/types";

// 13 тем спецификации ЕНТ-2026 по информатике (docs/ENT.md, раздел 2).
// examCount — сколько обычных заданий темы (кроме 5 контекстных) в полном пробном ЕНТ: всего 35.
// Официальны только суммы по шести разделам плана теста НЦТ — 4 / 10 / 11 / 1 / 7 / 7 (docs/CURRICULUM_REVIEW.md):
//   01 Компьютерные системы: t01 + t02 = 4;  02 Информационные процессы: t03 + t04 + t05 = 10;
//   03 Компьютерное мышление: t06 + t07 + 5 контекстных = 11;  04 ПО: t08 = 1;
//   05 Информационные процессы и системы: t09 + t10 + t11 = 7;  06 Объекты: t12 + t13 = 7.
// Разбивка раздела на темы — наше допущение (решение #43): сверять с новым планом НЦТ каждую осень.

export interface EntTopic {
  id: EntTopicId;
  title: L;
  short: L;
  examCount: number;
}

export const ENT_TOPICS: EntTopic[] = [
  {
    id: "t01",
    title: { ru: "Устройства компьютера", kk: "Компьютердің құрылғылары" },
    short: { ru: "Устройства", kk: "Құрылғылар" },
    examCount: 2,
  },
  {
    id: "t02",
    title: { ru: "Сети и информационная безопасность", kk: "Желілер және ақпараттық қауіпсіздік" },
    short: { ru: "Сети", kk: "Желілер" },
    examCount: 2,
  },
  {
    id: "t03",
    title: { ru: "Измерение и кодирование информации", kk: "Ақпаратты өлшеу және кодтау" },
    short: { ru: "Информация", kk: "Ақпарат" },
    examCount: 4,
  },
  {
    id: "t04",
    title: { ru: "Системы счисления", kk: "Санау жүйелері" },
    short: { ru: "Счисление", kk: "Санау жүйелері" },
    examCount: 3,
  },
  {
    id: "t05",
    title: { ru: "Логические основы компьютера", kk: "Компьютердің логикалық негіздері" },
    short: { ru: "Логика", kk: "Логика" },
    examCount: 3,
  },
  {
    id: "t06",
    title: { ru: "Программирование на Python", kk: "Python тілінде программалау" },
    short: { ru: "Python", kk: "Python" },
    examCount: 3,
  },
  {
    id: "t07",
    title: { ru: "Алгоритмы и программы", kk: "Алгоритмдер және программалар" },
    short: { ru: "Алгоритмы", kk: "Алгоритмдер" },
    examCount: 3,
  },
  {
    id: "t08",
    title: { ru: "Аппаратное и программное обеспечение", kk: "Аппараттық және программалық қамтамасыз ету" },
    short: { ru: "ПО", kk: "ПҚ" },
    examCount: 1,
  },
  {
    id: "t09",
    title: { ru: "Реляционные базы данных", kk: "Реляциялық деректер қоры" },
    short: { ru: "Базы данных", kk: "Деректер қоры" },
    examCount: 2,
  },
  {
    id: "t10",
    title: { ru: "Разработка БД и SQL-запросы", kk: "Деректер қорын әзірлеу және SQL сұраныстары" },
    short: { ru: "SQL", kk: "SQL" },
    examCount: 3,
  },
  {
    id: "t11",
    title: { ru: "Современные IT, IT-стартап, 3D-моделирование", kk: "Заманауи IT, IT-стартап, 3D жобалау" },
    short: { ru: "Современные IT", kk: "Заманауи IT" },
    examCount: 2,
  },
  {
    id: "t12",
    title: { ru: "Документы и электронные таблицы", kk: "Құжаттар және электрондық кестелер" },
    short: { ru: "Таблицы", kk: "Кестелер" },
    examCount: 4,
  },
  {
    id: "t13",
    title: { ru: "Веб-проектирование", kk: "Web-жобалау" },
    short: { ru: "Веб", kk: "Веб" },
    examCount: 3,
  },
];

/** Профильный предмет ЕНТ (информатика): 50 баллов за 40 заданий. */
export const ENT_POINTS = 50;
/** Вопросов контекстных заданий в полном ЕНТ: одна программа — 5 вопросов по 1 баллу. */
export const CONTEXT_COUNT = 5;
/** Обычных заданий (без контекстных) в полном ЕНТ — сумма `examCount`, 35. */
export const ORDINARY_COUNT = ENT_TOPICS.reduce((s, t) => s + t.examCount, 0);

/**
 * Темы, из которых берётся контекстное задание полного пробного ЕНТ (программа на Python и вопросы к ней):
 * t06 (Python) или t07 (алгоритмы и программы). Какая из двух — по seed варианта (`buildExam`);
 * в прогнозе 5 баллов контекстных делятся между ними поровну.
 */
export const CONTEXT_TOPICS: readonly EntTopicId[] = ["t06", "t07"];

export function entTopicById(id: EntTopicId): EntTopic {
  return ENT_TOPICS.find((t) => t.id === id)!;
}

/** Заданий темы с долей контекстных (t06 и t07 — по 3 + 2,5): по нему размер плитки «Карты ЕНТ». */
export function topicTaskShare(id: EntTopicId): number {
  return entTopicById(id).examCount + (CONTEXT_TOPICS.includes(id) ? CONTEXT_COUNT / CONTEXT_TOPICS.length : 0);
}

/**
 * Доля темы в 50 баллах полного ЕНТ (для прогноза балла и плана недели).
 * 25 «один верный» по 1 баллу + 5 контекстных по 1 + 5 «несколько верных» и 5 «соответствий» по 2 = 50.
 * 45 баллов обычных заданий делим пропорционально `examCount`; 5 баллов контекстных — поровну между
 * `CONTEXT_TOPICS`. Сумма весов всех тем равна 1.
 */
export function topicWeight(id: EntTopicId): number {
  const base = (entTopicById(id).examCount / ORDINARY_COUNT) * (ENT_POINTS - CONTEXT_COUNT);
  const context = CONTEXT_TOPICS.includes(id) ? CONTEXT_COUNT / CONTEXT_TOPICS.length : 0;
  return (base + context) / ENT_POINTS;
}
