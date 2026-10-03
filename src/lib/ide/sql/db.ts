import type { Database, SqlJsStatic, SqlValue, Statement } from "sql.js";

// SQL в браузере: sql.js (SQLite в WebAssembly). Учебная база пересоздаётся перед каждым запуском,
// поэтому запросы ученика (UPDATE, DELETE, DROP) ничего не ломают. Здесь — база, запуск и разбор результата.

/** Версия sql.js для файла .wasm с CDN — должна совпадать с node_modules/sql.js/package.json. */
export const SQLJS_VERSION = "1.14.2";

/** Скольки строк результата хватает для показа (остальные только считаем). */
export const DISPLAY_ROWS = 100;
/** Предел строк, которые мы вообще собираем (защита от случайного перекрёстного соединения). */
const MAX_COLLECT = 10_000;

/** Учебные таблицы, как в задачах ЕНТ. Все числа в условиях — числовые, чтобы не путать русские и латинские буквы. */
export const SCHEMA_SQL = `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  class INTEGER,
  city TEXT,
  score INTEGER
);
INSERT INTO students VALUES
  (1, 'Айдар', 10, 'Астана', 87),
  (2, 'Dana', 9, 'Алматы', 92),
  (3, 'Мадина', 11, 'Шымкент', 78),
  (4, 'Timur', 10, 'Астана', 95),
  (5, 'Алия', 9, 'Астана', 64),
  (6, 'Aruzhan', 11, 'Алматы', 81),
  (7, 'Данияр', 10, 'Қарағанды', 73),
  (8, 'Mark', 9, 'Алматы', 58),
  (9, 'Томирис', 11, 'Астана', 89),
  (10, 'Ерлан', 10, 'Шымкент', 69),
  (11, 'Sofia', 9, 'Шымкент', 76),
  (12, 'Бекзат', 11, 'Қарағанды', 84);

CREATE TABLE classes (
  class INTEGER PRIMARY KEY,
  teacher TEXT,
  room INTEGER
);
INSERT INTO classes VALUES
  (8, 'Серікова А.', 201),
  (9, 'Johnson M.', 204),
  (10, 'Ахметов Н.', 305),
  (11, 'Ким Е.', 312);

CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  title TEXT,
  author TEXT,
  year INTEGER,
  price INTEGER,
  pages INTEGER
);
INSERT INTO books VALUES
  (1, 'Python for Kids', 'Brown', 2019, 4500, 320),
  (2, 'Информатика 9 класс', 'Иванов', 2021, 2800, 256),
  (3, 'Основы SQL', 'Смирнов', 2020, 3200, 210),
  (4, 'Learn Python Fast', 'Taylor', 2022, 5100, 410),
  (5, 'Алгоритмы и структуры', 'Петров', 2018, 4800, 380),
  (6, 'Web Design Basics', 'Miller', 2020, 3900, 290),
  (7, 'Python и данные', 'Ким', 2023, 5600, 450),
  (8, 'Сети и интернет', 'Ахметов', 2017, 2500, 180),
  (9, 'Excel для школьников', 'Омаров', 2021, 2300, 160),
  (10, 'Компьютер изнутри', 'Нурланов', 2019, 3000, 240),
  (11, 'JavaScript Start', 'Wilson', 2022, 4200, 300),
  (12, 'Базы данных', 'Смирнов', 2021, 3500, 270);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  student_id INTEGER,
  book_id INTEGER,
  qty INTEGER,
  ordered TEXT
);
INSERT INTO orders VALUES
  (1, 1, 1, 1, '2026-09-01'),
  (2, 2, 4, 2, '2026-09-02'),
  (3, 4, 7, 1, '2026-09-03'),
  (4, 3, 2, 1, '2026-09-05'),
  (5, 5, 3, 1, '2026-09-06'),
  (6, 6, 11, 3, '2026-09-08'),
  (7, 7, 5, 1, '2026-09-09'),
  (8, 9, 1, 2, '2026-09-10'),
  (9, 10, 9, 1, '2026-09-12'),
  (10, 11, 12, 1, '2026-09-13'),
  (11, 12, 6, 2, '2026-09-15'),
  (12, 2, 10, 1, '2026-09-16'),
  (13, 4, 4, 1, '2026-09-18'),
  (14, 8, 8, 1, '2026-09-20');
`;

// ───────── Загрузка движка ─────────

let enginePromise: Promise<SqlJsStatic> | null = null;

/**
 * Загружает sql.js (один раз). В браузере файл .wasm берётся с CDN; в тестах (node) передаётся locateFile
 * на node_modules/sql.js/dist. Неудача не кэшируется — можно повторить.
 */
export function loadSql(locateFile?: (file: string) => string): Promise<SqlJsStatic> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const mod = (await import("sql.js")) as unknown as { default?: typeof import("sql.js").default } & typeof import("sql.js").default;
      const init = mod.default ?? mod;
      return init({ locateFile: locateFile ?? ((f) => `https://cdn.jsdelivr.net/npm/sql.js@${SQLJS_VERSION}/dist/${f}`) });
    })().catch((e) => {
      enginePromise = null;
      throw e;
    });
  }
  return enginePromise;
}

/** Свежая учебная база. Вызывающий закрывает её через db.close(). */
export function createDb(SQL: SqlJsStatic): Database {
  const db = new SQL.Database();
  db.run(SCHEMA_SQL);
  return db;
}

// ───────── Запуск запроса ─────────

export type Cell = SqlValue;

/** Один результат SELECT: столбцы и строки (собрано не более MAX_COLLECT). */
export interface ResultSet {
  columns: string[];
  rows: Cell[][];
  /** Сколько строк вернул запрос (может быть больше rows.length при очень больших результатах — не более MAX_COLLECT). */
  total: number;
}

export interface SqlRunOk {
  ok: true;
  /** Результаты всех операторов, вернувших столбцы (SELECT, PRAGMA…). */
  sets: ResultSet[];
  /** Сколько строк изменили INSERT/UPDATE/DELETE за запуск. */
  changes: number;
  /** Была ли в запросе команда изменения данных. */
  mutated: boolean;
  /** Для запросов на изменение — содержимое изменённой таблицы после запроса. */
  after?: { table: string; set: ResultSet };
  ms: number;
}
export interface SqlRunErr {
  ok: false;
  /** Сообщение SQLite как есть. */
  error: string;
}
export type SqlRun = SqlRunOk | SqlRunErr;

const MUTATION_RE = /\b(update|insert|delete|replace|drop|alter|create)\b/i;
const MUTATED_TABLE_RE = /\b(?:update|insert\s+(?:or\s+\w+\s+)?into|delete\s+from|replace\s+into)\s+["`[]?([A-Za-z_][A-Za-z0-9_]*)/i;

/** Убирает комментарии и содержимое строк — чтобы искать ключевые слова только в коде. */
export function stripSql(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''");
}

/** Рекурсивные запросы могут не закончиться, а прервать их в основном потоке нельзя — в учебном курсе они не нужны. */
export function hasRecursive(sql: string): boolean {
  return /\bwith\s+recursive\b/i.test(stripSql(sql));
}

/** Имя таблицы, которую меняет запрос (первая из UPDATE / INSERT INTO / DELETE FROM). */
export function mutatedTable(sql: string): string | null {
  const m = MUTATED_TABLE_RE.exec(stripSql(sql));
  return m ? m[1] : null;
}

function collect(stmt: Statement): ResultSet {
  const columns = stmt.getColumnNames();
  const rows: Cell[][] = [];
  let total = 0;
  while (stmt.step()) {
    total++;
    if (rows.length < MAX_COLLECT) rows.push(stmt.get());
    else break;
  }
  return { columns, rows, total };
}

/** Выполняет все операторы запроса по очереди на переданной базе. Результат пустого SELECT тоже содержит столбцы. */
export function runOn(db: Database, sql: string): SqlRun {
  if (hasRecursive(sql)) return { ok: false, error: "recursive queries are not supported" };
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  try {
    const sets: ResultSet[] = [];
    let changes = 0;
    for (const stmt of db.iterateStatements(sql)) {
      const names = stmt.getColumnNames();
      if (names.length > 0) sets.push(collect(stmt));
      else {
        stmt.step();
        changes += db.getRowsModified();
      }
    }
    const mutated = MUTATION_RE.test(stripSql(sql));
    let after: SqlRunOk["after"];
    const table = mutated ? mutatedTable(sql) : null;
    if (table) {
      try {
        const rs = db.exec(`SELECT * FROM ${table}`);
        if (rs[0]) after = { table, set: { columns: rs[0].columns, rows: rs[0].values, total: rs[0].values.length } };
      } catch {
        // таблицу могли удалить — просто не показываем
      }
    }
    const ms = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0;
    return { ok: true, sets, changes, mutated, after, ms };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Запуск запроса ученика на чистой базе. */
export function runSql(SQL: SqlJsStatic, sql: string): SqlRun {
  const db = createDb(SQL);
  try {
    return runOn(db, sql);
  } finally {
    db.close();
  }
}

// ───────── Схема для SchemaView ─────────

export interface ColumnInfo {
  name: string;
  type: string;
  pk: boolean;
}
export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
  /** Первые строки таблицы. */
  sample: ResultSet;
}

/** Таблицы учебной базы со столбцами и первыми строками (для боковой справки). */
export function describeSchema(SQL: SqlJsStatic, sampleRows = 3): TableInfo[] {
  const db = createDb(SQL);
  try {
    const names = (db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY rowid")[0]?.values ?? []).map((r) => String(r[0]));
    return names.map((name) => {
      const cols = db.exec(`PRAGMA table_info(${name})`)[0]?.values ?? [];
      const count = Number(db.exec(`SELECT COUNT(*) FROM ${name}`)[0]?.values[0]?.[0] ?? 0);
      const s = db.exec(`SELECT * FROM ${name} LIMIT ${sampleRows}`)[0];
      return {
        name,
        rowCount: count,
        columns: cols.map((c) => ({ name: String(c[1]), type: String(c[2]).toLowerCase(), pk: Number(c[5]) > 0 })),
        sample: { columns: s?.columns ?? [], rows: s?.values ?? [], total: s?.values.length ?? 0 },
      };
    });
  } finally {
    db.close();
  }
}

/** Значение ячейки для показа. */
export function cellText(v: Cell): string {
  if (v === null) return "NULL";
  if (v instanceof Uint8Array) return "<BLOB>";
  return String(v);
}
