import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import type { SqlJsStatic } from "sql.js";
import { checkSql, compareSets, explainSqlError, formatSet } from "@/lib/ide/sql/check";
import { createDb, describeSchema, hasRecursive, loadSql, mutatedTable, runOn, runSql } from "@/lib/ide/sql/db";
import { TASKS } from "@/lib/ide/sql/tasks";

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql((f) => path.join(process.cwd(), "node_modules/sql.js/dist", f));
});

const task = (id: string) => {
  const t = TASKS.find((x) => x.id === id);
  if (!t || t.check.kind !== "sql") throw new Error(id);
  return t as typeof t & { check: Extract<typeof t.check, { kind: "sql" }> };
};
const verdict = (id: string, code: string) => {
  const t = task(id);
  return checkSql(t.check, code, SQL);
};

describe("SQL: задачи", () => {
  it("20 задач, уникальные id, двуязычные, навыки db.*, уровни A/B/C", () => {
    expect(TASKS).toHaveLength(20);
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(20);
    for (const t of TASKS) {
      expect(t.lang).toBe("sql");
      expect(["db.select", "db.modify", "db.where", "db.order", "db.group", "db.join", "db.ddl"]).toContain(t.skill);
      for (const l of [t.title, t.prompt, t.hint!]) {
        expect(l.ru.trim().length).toBeGreaterThan(3);
        expect(l.kk.trim().length).toBeGreaterThan(3);
      }
      expect(t.check.kind).toBe("sql");
    }
    expect(TASKS.some((t) => t.skill === "db.modify")).toBe(true);
    for (const sk of ["db.where", "db.order", "db.group", "db.join", "db.ddl"]) {
      expect(TASKS.filter((t) => t.skill === sk).length, sk).toBeGreaterThanOrEqual(2);
    }
    for (const lv of [1, 2, 3]) expect(TASKS.filter((t) => t.level === lv).length).toBeGreaterThanOrEqual(4);
  });

  it("эталонное решение каждой задачи проходит проверку", () => {
    for (const t of TASKS) {
      if (t.check.kind !== "sql") continue;
      const r = checkSql(t.check, t.solution, SQL);
      expect(r.ok, `${t.id}: ${JSON.stringify(r.message)}`).toBe(true);
      expect(r.passed).toBe(1);
    }
  });

  it("стартовый код (заготовка) не проходит проверку", () => {
    for (const t of TASKS) {
      if (t.check.kind !== "sql") continue;
      expect(checkSql(t.check, t.starter, SQL).ok, t.id).toBe(false);
    }
  });

  it("явная ошибка SQL не проходит и объясняется на двух языках", () => {
    const r = verdict("sql-1-select", "SELEC * FROM students");
    expect(r.ok).toBe(false);
    const m = r.message as { ru: string; kk: string };
    expect(m.ru).toContain("SELEC");
    expect(m.kk).toContain("SELEC");
    expect(verdict("sql-1-select", "").ok).toBe(false);
    expect(verdict("sql-1-select", "SELECT * FROM student").ok).toBe(false);
  });

  it("разные записи одного и того же запроса проходят (регистр, IN вместо OR, имена столбцов)", () => {
    expect(verdict("sql-4-where", "select name, class, score from students where class in (10, 11) and score > 80").ok).toBe(true);
    expect(verdict("sql-5-count", "SELECT COUNT(id) AS n FROM students WHERE score > 80").ok).toBe(true);
    expect(verdict("sql-7-group", "SELECT class, ROUND(AVG(score), 2) FROM students GROUP BY class").ok).toBe(true);
    expect(verdict("sql-3-order", "SELECT name, score FROM students ORDER BY score DESC;").ok).toBe(true);
  });

  it("неверные ответы отличаются и объясняют, что не так", () => {
    // лишний столбец
    const a = verdict("sql-2-columns", "SELECT * FROM students");
    expect(a.ok).toBe(false);
    expect((a.message as { ru: string }).ru).toContain("Столбцов");
    expect(a.sample?.expected).toContain("name | city");
    // порядок
    const b = verdict("sql-3-order", "SELECT name, score FROM students ORDER BY score ASC");
    expect(b.ok).toBe(false);
    expect((b.message as { ru: string }).ru).toContain("порядок");
    // приоритет AND/OR без скобок
    const c = verdict("sql-4-where", "SELECT name, class, score FROM students WHERE class = 10 OR class = 11 AND score > 80");
    expect(c.ok).toBe(false);
    // неверное число
    expect(verdict("sql-5-count", "SELECT COUNT(*) FROM students WHERE score >= 80").ok).toBe(true); // 80 нет в данных
    expect(verdict("sql-5-count", "SELECT COUNT(*) FROM students WHERE score > 90").ok).toBe(false);
    // не группировка
    expect(verdict("sql-7-group", "SELECT AVG(score) FROM students").ok).toBe(false);
    // LIKE без шаблона
    expect(verdict("sql-6-like", "SELECT title FROM books WHERE title = 'Python'").ok).toBe(false);
  });

  it("UPDATE: без WHERE, не тот класс и просто SELECT не проходят", () => {
    expect(verdict("sql-8-update", "UPDATE students SET score = score + 5").ok).toBe(false);
    expect(verdict("sql-8-update", "UPDATE students SET score = score + 5 WHERE class = 10").ok).toBe(false);
    expect(verdict("sql-8-update", "SELECT * FROM students WHERE class = 9").ok).toBe(false);
    expect(verdict("sql-8-update", "UPDATE students SET score = score + 5 WHERE class = 9").ok).toBe(true);
    expect(verdict("sql-8-update", "UPDATE students SET score = score + 2 WHERE class = 9; UPDATE students SET score = score + 3 WHERE class = 9;").ok).toBe(true);
  });

  it("новые задачи: ожидаемые результаты эталонов (число строк)", () => {
    const rows = (id: string) => {
      const t = task(id);
      const r = runSql(SQL, t.check.reference);
      return r.ok ? r.sets[0]?.rows.length ?? 0 : -1;
    };
    expect(rows("sql-9-between")).toBe(6);
    expect(rows("sql-10-in")).toBe(2);
    expect(rows("sql-11-like-or")).toBe(3);
    expect(rows("sql-12-distinct")).toBe(4);
    expect(rows("sql-13-order-limit")).toBe(5);
    expect(rows("sql-14-aggregates")).toBe(1);
    expect(rows("sql-15-group-city")).toBe(4);
    expect(rows("sql-16-having")).toBe(3);
    expect(rows("sql-17-join-room")).toBe(4);
    expect(rows("sql-18-join-total")).toBe(3);
  });

  it("db.where: границы BETWEEN, IN, LIKE с «_» и скобки", () => {
    expect(verdict("sql-9-between", "SELECT title, price FROM books WHERE price > 3000 AND price < 4500").ok).toBe(false);
    expect(verdict("sql-9-between", "SELECT title, price FROM books WHERE price >= 3000 AND price <= 4500").ok).toBe(true);
    expect(verdict("sql-10-in", "SELECT title, author, year FROM books WHERE author IN ('Brown','Taylor','Wilson')").ok).toBe(false);
    expect(
      verdict("sql-10-in", "SELECT title, author, year FROM books WHERE (author = 'Taylor' OR author = 'Wilson' OR author = 'Brown') AND year > 2019").ok,
    ).toBe(true);
    const like = "SELECT id, ordered, qty, book_id FROM orders WHERE ordered LIKE '2026-09-1_'";
    expect(verdict("sql-11-like-or", `${like} AND qty > 1 OR book_id = 4`).ok).toBe(false); // без скобок
    expect(verdict("sql-11-like-or", `${like} AND (qty > 1 OR book_id = 4)`).ok).toBe(true);
    expect(verdict("sql-11-like-or", "SELECT id, ordered, qty, book_id FROM orders WHERE ordered LIKE '2026-09-1%' AND (qty > 1 OR book_id = 4)").ok).toBe(true); // 10-19 = 1%
  });

  it("db.order: DISTINCT, порядок, два ключа, LIMIT", () => {
    expect(verdict("sql-12-distinct", "SELECT city FROM students ORDER BY city").ok).toBe(false);
    expect(verdict("sql-12-distinct", "SELECT DISTINCT city FROM students ORDER BY city DESC").ok).toBe(false);
    expect(verdict("sql-12-distinct", "SELECT city FROM students GROUP BY city ORDER BY city").ok).toBe(true);
    expect(verdict("sql-13-order-limit", "SELECT name, class, score FROM students ORDER BY class, score DESC").ok).toBe(false);
    expect(verdict("sql-13-order-limit", "SELECT name, class, score FROM students ORDER BY class, score LIMIT 5").ok).toBe(false);
    expect(verdict("sql-13-order-limit", "SELECT name, class, score FROM students ORDER BY score DESC, class LIMIT 5").ok).toBe(false);
    expect(verdict("sql-13-order-limit", "SELECT name, class, score FROM students ORDER BY class ASC, score DESC LIMIT 5").ok).toBe(true);
  });

  it("db.group: агрегаты, GROUP BY, WHERE против HAVING", () => {
    expect(verdict("sql-14-aggregates", "SELECT COUNT(*), MIN(price), MAX(price) FROM books").ok).toBe(true);
    expect(verdict("sql-14-aggregates", "SELECT COUNT(*), MIN(price), AVG(price) FROM books").ok).toBe(false);
    expect(verdict("sql-15-group-city", "SELECT city, COUNT(*), MIN(score) FROM students GROUP BY city").ok).toBe(false);
    expect(verdict("sql-15-group-city", "SELECT city, COUNT(id), MAX(score) FROM students GROUP BY city").ok).toBe(true);
    // без фильтра по дате и без HAVING
    expect(verdict("sql-16-having", "SELECT student_id, SUM(qty) FROM orders GROUP BY student_id HAVING SUM(qty) >= 2").ok).toBe(false);
    expect(verdict("sql-16-having", "SELECT student_id, SUM(qty) FROM orders WHERE ordered >= '2026-09-05' GROUP BY student_id").ok).toBe(false);
    const w = verdict("sql-16-having", "SELECT student_id, SUM(qty) FROM orders WHERE SUM(qty) >= 2 GROUP BY student_id");
    expect(w.ok).toBe(false);
    expect((w.message as { ru: string }).ru).toContain("HAVING");
  });

  it("db.join: связь по ключу, без условия связи получается произведение", () => {
    expect(verdict("sql-17-join-room", "SELECT students.name, classes.room FROM students, classes WHERE students.score > 85").ok).toBe(false);
    const amb = verdict("sql-17-join-room", "SELECT name, room FROM students JOIN classes ON class = class WHERE score > 85");
    expect(amb.ok).toBe(false);
    expect((amb.message as { ru: string }).ru).toContain("таблица.столбец");
    expect(
      verdict("sql-17-join-room", "SELECT s.name, c.room FROM students s INNER JOIN classes c ON s.class = c.class WHERE s.score > 85").ok,
    ).toBe(true);
    expect(
      verdict("sql-18-join-total", "SELECT b.title, b.price * o.qty AS total FROM books b JOIN orders o ON o.book_id = b.id WHERE total > 8000").ok,
    ).toBe(true);
    expect(verdict("sql-18-join-total", "SELECT books.title, books.price FROM orders JOIN books ON orders.book_id = books.id WHERE books.price > 4000").ok).toBe(false);
  });

  it("db.ddl: INSERT и DELETE проверяются по содержимому таблицы", () => {
    expect(verdict("sql-19-insert", "INSERT INTO classes VALUES (12, 'Ivanov K.', 210)").ok).toBe(true);
    expect(verdict("sql-19-insert", "INSERT INTO classes (room, teacher, class) VALUES (210, 'Ivanov K.', 12)").ok).toBe(true);
    expect(verdict("sql-19-insert", "INSERT INTO classes VALUES (12, 'Ivanov K.', 201)").ok).toBe(false);
    expect(verdict("sql-19-insert", "SELECT * FROM classes").ok).toBe(false);
    const dup = verdict("sql-19-insert", "INSERT INTO classes VALUES (11, 'Ivanov K.', 210)");
    expect(dup.ok).toBe(false);
    expect((dup.message as { ru: string }).ru).toContain("id");
    expect(verdict("sql-20-delete", "DELETE FROM books").ok).toBe(false);
    expect(verdict("sql-20-delete", "DELETE FROM books WHERE price < 3000 OR pages < 200").ok).toBe(false); // книги на 210 и 240 страниц остаются
    expect(verdict("sql-20-delete", "DELETE FROM books WHERE price < 3000 AND pages < 250").ok).toBe(false);
    expect(verdict("sql-20-delete", "DELETE FROM books WHERE price < 3000").ok).toBe(false);
    expect(verdict("sql-20-delete", "DELETE FROM books WHERE price < 3000; DELETE FROM books WHERE pages < 250;").ok).toBe(true);
  });

  it("баллы учеников уникальны (порядок ORDER BY однозначен)", () => {
    const rows = runSql(SQL, "SELECT COUNT(DISTINCT score), COUNT(*) FROM students");
    expect(rows.ok && rows.sets[0].rows[0]).toEqual([12, 12]);
  });
});

describe("SQL: база и запуск", () => {
  it("учебные таблицы заполнены (10-15 строк, кроме справочника classes)", () => {
    const schema = describeSchema(SQL);
    expect(schema.map((t) => t.name)).toEqual(["students", "classes", "books", "orders"]);
    for (const t of schema) {
      expect(t.columns.length).toBeGreaterThanOrEqual(3);
      if (t.name !== "classes") {
        expect(t.rowCount).toBeGreaterThanOrEqual(10);
        expect(t.rowCount).toBeLessThanOrEqual(15);
      }
      expect(t.sample.rows.length).toBeGreaterThan(0);
    }
    expect(schema[0].columns.map((c) => c.name)).toEqual(["id", "name", "class", "city", "score"]);
  });

  it("база пересоздаётся перед каждым запуском", () => {
    expect(runSql(SQL, "DELETE FROM students").ok).toBe(true);
    const r = runSql(SQL, "SELECT COUNT(*) FROM students");
    expect(r.ok && r.sets[0].rows[0][0]).toBe(12);
  });

  it("пустой SELECT возвращает столбцы; UPDATE — число строк и таблицу после запроса", () => {
    const e = runSql(SQL, "SELECT name, score FROM students WHERE score > 1000");
    expect(e.ok && e.sets[0].columns).toEqual(["name", "score"]);
    expect(e.ok && e.sets[0].rows).toHaveLength(0);
    const u = runSql(SQL, "UPDATE students SET score = 0 WHERE class = 9");
    expect(u.ok && u.sets).toHaveLength(0);
    expect(u.ok && u.changes).toBe(4);
    expect(u.ok && u.after?.table).toBe("students");
    expect(u.ok && u.after?.set.rows).toHaveLength(12);
  });

  it("несколько операторов: берётся последний результат; ошибка — понятное сообщение", () => {
    const db = createDb(SQL);
    const r = runOn(db, "SELECT 1; SELECT 2, 3;");
    db.close();
    expect(r.ok && r.sets).toHaveLength(2);
    const bad = runSql(SQL, "SELECT FROM students");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(explainSqlError(bad.error).ru).toContain("Синтаксическая ошибка");
  });

  it("разбор: изменяемая таблица, рекурсия, комментарии", () => {
    expect(mutatedTable("UPDATE books SET price = 1")).toBe("books");
    expect(mutatedTable("insert into orders values (1)")).toBe("orders");
    expect(mutatedTable("DELETE FROM students WHERE id = 1")).toBe("students");
    expect(mutatedTable("SELECT * FROM students")).toBeNull();
    expect(hasRecursive("WITH RECURSIVE t(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM t) SELECT * FROM t")).toBe(true);
    expect(hasRecursive("-- with recursive\nSELECT 1")).toBe(false);
    const r = runSql(SQL, "WITH RECURSIVE t(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM t) SELECT * FROM t");
    expect(r.ok).toBe(false);
    expect(hasRecursive("WITH t(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM t) SELECT COUNT(*) FROM t")).toBe(true);
    expect(runSql(SQL, "WITH t(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM t) SELECT COUNT(*) FROM t").ok).toBe(false);
  });

  it("changes считает только свои изменения; replace() не мутация", () => {
    const r = runSql(SQL, "CREATE TABLE t(a); INSERT INTO t VALUES(1),(2)");
    expect(r.ok && r.changes).toBe(2);
    const d = runSql(SQL, "DROP TABLE students");
    expect(d.ok && d.changes).toBe(0);
    const s = runSql(SQL, "SELECT replace(name,'a','b') FROM students");
    expect(s.ok && s.mutated).toBe(false);
  });

  it("сравнение результатов: порядок, числа, NULL", () => {
    const a = { columns: ["x"], rows: [[1], [2]], total: 2 };
    const b = { columns: ["y"], rows: [[2], [1]], total: 2 };
    expect(compareSets(a, b, false)).toBe("same");
    expect(compareSets(a, b, true)).toBe("order");
    expect(compareSets(a, { columns: ["x"], rows: [[1], [3]], total: 2 }, false)).toBe("values");
    expect(compareSets(a, { columns: ["x", "z"], rows: [[1, 1], [2, 2]], total: 2 }, false)).toBe("columns");
    expect(compareSets({ columns: ["x"], rows: [[0.1 + 0.2]], total: 1 }, { columns: ["x"], rows: [[0.3]], total: 1 }, false)).toBe("same");
    expect(compareSets({ columns: ["x"], rows: [[null]], total: 1 }, { columns: ["x"], rows: [["NULL"]], total: 1 }, false)).toBe("values");
    expect(formatSet({ columns: ["a", "b"], rows: [[1, null]], total: 1 })).toBe("a | b\n1 | NULL");
  });
});
