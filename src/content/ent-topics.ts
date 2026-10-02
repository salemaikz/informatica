import type { EntTopicId, L } from "@/lib/types";

// 13 тем спецификации ЕНТ-2026 по информатике (docs/ENT.md, раздел 2).
// examCount — сколько заданий темы (кроме 5 контекстных) в полном пробном ЕНТ: всего 35.
// Число заданий по темам НЦТ официально не публикует — это наш ориентир по демоверсии.

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
    examCount: 5,
  },
  {
    id: "t02",
    title: { ru: "Сети и информационная безопасность", kk: "Желілер және ақпараттық қауіпсіздік" },
    short: { ru: "Сети", kk: "Желілер" },
    examCount: 5,
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
    examCount: 4,
  },
  {
    id: "t05",
    title: { ru: "Логические основы компьютера", kk: "Компьютердің логикалық негіздері" },
    short: { ru: "Логика", kk: "Логика" },
    examCount: 4,
  },
  {
    id: "t06",
    title: { ru: "Программирование на Python", kk: "Python тілінде программалау" },
    short: { ru: "Python", kk: "Python" },
    examCount: 2,
  },
  {
    id: "t07",
    title: { ru: "Алгоритмы и программы", kk: "Алгоритмдер және программалар" },
    short: { ru: "Алгоритмы", kk: "Алгоритмдер" },
    examCount: 1,
  },
  {
    id: "t08",
    title: { ru: "Аппаратное и программное обеспечение", kk: "Аппараттық және программалық қамтамасыз ету" },
    short: { ru: "ПО", kk: "ПҚ" },
    examCount: 2,
  },
  {
    id: "t09",
    title: { ru: "Реляционные базы данных", kk: "Реляциялық деректер қоры" },
    short: { ru: "Базы данных", kk: "Деректер қоры" },
    examCount: 1,
  },
  {
    id: "t10",
    title: { ru: "Разработка БД и SQL-запросы", kk: "Деректер қорын әзірлеу және SQL сұраныстары" },
    short: { ru: "SQL", kk: "SQL" },
    examCount: 2,
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
    examCount: 2,
  },
  {
    id: "t13",
    title: { ru: "Веб-проектирование", kk: "Web-жобалау" },
    short: { ru: "Веб", kk: "Веб" },
    examCount: 1,
  },
];

/** Контекстные задания полного пробного ЕНТ (5 вопросов к одной программе) — тема Python. */
export const CONTEXT_TOPIC: EntTopicId = "t06";

export function entTopicById(id: EntTopicId): EntTopic {
  return ENT_TOPICS.find((t) => t.id === id)!;
}

/**
 * Доля темы в 50 баллах полного ЕНТ (для прогноза балла).
 * 25 «один верный» по 1 баллу + 5 контекстных по 1 + 5 «несколько верных» и 5 «соответствий» по 2 = 50.
 * Считаем вес пропорционально числу заданий темы; контекстные (5 баллов) отдаём Python.
 */
export function topicWeight(id: EntTopicId): number {
  const t = entTopicById(id);
  const base = (t.examCount / 35) * 45;
  return (base + (id === CONTEXT_TOPIC ? 5 : 0)) / 50;
}
