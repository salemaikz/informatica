import type { L, Lesson, Scene, Text } from "@/lib/types";

// Урок «Запросы SELECT» (раздел 4, тема ЕНТ t10). Расчётная тема: ход — сюжет → SELECT/FROM → WHERE → разбор →
// BETWEEN/IN/LIKE → ловушки → ORDER BY/DISTINCT → решаем вместе → сам → ЕНТ-босс → сюжет.
// Все запросы выполнены в python3 + sqlite3 на тех же таблицах (scripts/out/db-2-select).

// ---------- Таблицы урока ----------

const STUDENTS: string[][] = [
  ["1", "Айдар", "10", "5"],
  ["2", "Алия", "9", "4"],
  ["3", "Берик", "10", "4"],
  ["4", "Дана", "11", "5"],
  ["5", "Ерлан", "10", "3"],
  ["6", "Мадина", "10", "5"],
  ["7", "Нурлан", "9", "5"],
  ["8", "Сауле", "11", "4"],
];

/** Таблица Students; подсветка строк/столбцов и подпись — по шагу. */
const students = (opts: { rows?: number[]; cols?: number[]; caption?: Text } = {}): Scene => ({
  kind: "table",
  columns: ["ID", "Name", "Class", "Mark"],
  rows: STUDENTS,
  highlightRows: opts.rows,
  highlightCols: opts.cols,
  caption: opts.caption,
});

const g = (ru: string, kk: string): L => ({ ru, kk });

const GOODS: Text[][] = [
  [g("Тетрадь", "Дәптер"), "90", "30"],
  [g("Ручка", "Қалам"), "60", "100"],
  [g("Карандаш", "Қарындаш"), "40", "80"],
  [g("Линейка", "Сызғыш"), "150", "25"],
  [g("Ластик", "Өшіргіш"), "50", "60"],
  [g("Пенал", "Қаламсауыт"), "700", "10"],
  [g("Альбом", "Альбом"), "200", "15"],
  [g("Калькулятор", "Калькулятор"), "1500", "4"],
];

const goods = (opts: { rows?: number[]; caption?: Text } = {}): Scene => ({
  kind: "table",
  columns: ["Name", "Price", "Qty"],
  rows: GOODS,
  highlightRows: opts.rows,
  caption: opts.caption,
});

const BOOKS: Text[][] = [
  [g("Сказки", "Ертегілер"), "2008", "120"],
  [g("Атлас", "Атлас"), "2015", "64"],
  [g("Словарь", "Сөздік"), "2012", "480"],
  [g("Задачник", "Есептер жинағы"), "2019", "96"],
  [g("Энциклопедия", "Энциклопедия"), "2010", "320"],
  [g("Букварь", "Әліппе"), "2019", "48"],
  [g("Справочник", "Анықтамалық"), "2015", "200"],
];

const books = (opts: { rows?: number[] } = {}): Scene => ({
  kind: "table",
  columns: ["Title", "Year", "Pages"],
  rows: BOOKS,
  highlightRows: opts.rows,
});

const sql = (lines: string[], active?: number): Scene => ({ kind: "sql" as never, lines, active }) as never;

export const lesson: Lesson = {
  id: "db-2-select",
  unitId: "u4",
  title: { ru: "Запросы SELECT", kk: "SELECT сұраныстары" },
  description: {
    ru: "Задаём вопросы базе данных на языке SQL: выбираем поля и записи, сортируем и убираем повторы",
    kk: "SQL тілінде деректер қорына сұрақ қоямыз: өрістер мен жазбаларды таңдаймыз, сұрыптаймыз, қайталауларды алып тастаймыз",
  },
  skills: ["db.select"],
  durationMin: 7,
  entTopics: ["t10"],
  steps: [],
  conspect: { ru: "", kk: "" },
};

void sql;
void students;
void goods;
void books;
