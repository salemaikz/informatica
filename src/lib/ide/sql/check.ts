import type { Database, SqlJsStatic } from "sql.js";
import type { L } from "@/lib/types";
import type { CheckResult, IdeCheck } from "../types";
import { cellText, createDb, runOn, stripSql, type Cell, type ResultSet } from "./db";

// Проверка задач SQL: результат запроса ученика сравнивается с результатом эталона на той же учебной базе.
// Имена столбцов не важны, порядок строк — только если задача требует ORDER BY (ordered).

/** Сколько строк показываем в примере «ожидалось / получено». */
const SAMPLE_ROWS = 5;

const MSG_EMPTY: L = { ru: "Сначала напишите запрос.", kk: "Алдымен сұраныс жазыңыз." };
const MSG_NO_RESULT: L = {
  ru: "Запрос ничего не вернул: в этой задаче нужен SELECT.",
  kk: "Сұраныс ештеңе қайтармады: бұл есепте SELECT керек.",
};
const MSG_LITERAL: L = {
  ru: "Нужно получить ответ запросом к таблице (FROM), а не написать готовое значение.",
  kk: "Жауапты дайын мән жазып емес, кестеге сұраныс (FROM) арқылы алу керек.",
};
const MSG_VALUES: L = {
  ru: "Строк столько же, сколько нужно, но данные отличаются. Проверьте условие и вычисления.",
  kk: "Жолдар саны сәйкес келеді, бірақ деректер өзгеше. Шартты және есептеулерді тексеріңіз.",
};
const MSG_ORDER: L = {
  ru: "Строки верные, но порядок другой. Проверьте ORDER BY и направление сортировки (ASC или DESC).",
  kk: "Жолдар дұрыс, бірақ реті басқа. ORDER BY мен сұрыптау бағытын (ASC немесе DESC) тексеріңіз.",
};
const MSG_TABLE: L = {
  ru: "После вашего запроса таблица отличается от ожидаемой. Проверьте условие WHERE и новые значения.",
  kk: "Сіздің сұранысыңыздан кейін кесте күтілген нәтижеден өзгеше. WHERE шартын және жаңа мәндерді тексеріңіз.",
};
const MSG_RECURSIVE: L = {
  ru: "Конструкция WITH здесь не поддерживается — для этой задачи она не нужна.",
  kk: "WITH конструкциясы мұнда қолдау таппайды — бұл есепке ол қажет емес.",
};

const TABLES = "students, classes, books, orders";

/** Понятное объяснение ошибки SQLite на двух языках (исходное сообщение показывается отдельно). */
export function explainSqlError(raw: string): L {
  const msg = raw.trim();
  if (/with is not supported|recursive queries are not supported/i.test(msg)) return MSG_RECURSIVE;
  let m = /no such table: (.+)/i.exec(msg);
  if (m) {
    return {
      ru: `Такой таблицы нет: ${m[1]}. Доступные таблицы: ${TABLES}.`,
      kk: `Мұндай кесте жоқ: ${m[1]}. Қолжетімді кестелер: ${TABLES}.`,
    };
  }
  m = /no such column: (.+)/i.exec(msg);
  if (m) {
    return {
      ru: `Такого столбца нет: ${m[1]}. Загляните в «Таблицы базы» и проверьте названия. Текст в условии пишите в одинарных кавычках: 'текст'.`,
      kk: `Мұндай баған жоқ: ${m[1]}. «Деректер қоры кестелерін» ашып, атауларды тексеріңіз. Шарттағы мәтінді жалғыз тырнақшаға алыңыз: 'мәтін'.`,
    };
  }
  m = /ambiguous column name: (.+)/i.exec(msg);
  if (m) {
    return {
      ru: `Название столбца ${m[1]} есть в нескольких таблицах — укажите таблицу: таблица.столбец.`,
      kk: `${m[1]} бағанының аты бірнеше кестеде бар — кестені көрсетіңіз: кесте.баған.`,
    };
  }
  m = /near "(.*)": syntax error/i.exec(msg);
  if (m) {
    return {
      ru: `Синтаксическая ошибка рядом с «${m[1]}». Проверьте запятые между столбцами, порядок слов (SELECT, FROM, WHERE, ORDER BY) и скобки.`,
      kk: `«${m[1]}» жанында синтаксистік қате бар. Бағандар арасындағы үтірлерді, сөздердің ретін (SELECT, FROM, WHERE, ORDER BY) және жақшаларды тексеріңіз.`,
    };
  }
  if (/incomplete input/i.test(msg)) {
    return {
      ru: "Запрос не закончен: проверьте, что все скобки и кавычки закрыты и после FROM указана таблица.",
      kk: "Сұраныс аяқталмаған: жақшалар мен тырнақшалардың жабылғанын және FROM-нан кейін кесте көрсетілгенін тексеріңіз.",
    };
  }
  if (/misuse of aggregate|aggregate functions are not allowed/i.test(msg)) {
    return {
      ru: "Функции COUNT, SUM, AVG, MIN, MAX нельзя использовать в WHERE. Условие по результату функции пишут в HAVING.",
      kk: "COUNT, SUM, AVG, MIN, MAX функцияларын WHERE ішінде қолдануға болмайды. Функция нәтижесі бойынша шартты HAVING-ке жазады.",
    };
  }
  if (/UNIQUE constraint failed|PRIMARY KEY/i.test(msg)) {
    return {
      ru: "Строка с таким id уже есть — id должен быть уникальным.",
      kk: "Мұндай id бар жол бұрыннан бар — id бірегей болуы керек.",
    };
  }
  if (/values for \d+ columns|has \d+ columns but \d+ values/i.test(msg)) {
    return {
      ru: "Число значений в VALUES не совпадает с числом столбцов.",
      kk: "VALUES ішіндегі мәндер саны бағандар санына сәйкес келмейді.",
    };
  }
  if (/no tables specified|no such function/i.test(msg)) {
    return {
      ru: "Не хватает части запроса или имя функции написано неверно. Проверьте FROM и названия функций.",
      kk: "Сұраныстың бір бөлігі жетіспейді немесе функция аты қате жазылған. FROM мен функция атауларын тексеріңіз.",
    };
  }
  return {
    ru: "Запрос не выполнился. Прочитайте сообщение ниже: оно подсказывает, где ошибка.",
    kk: "Сұраныс орындалмады. Төмендегі хабарламаны оқыңыз: ол қатенің қай жерде екенін көрсетеді.",
  };
}

// ───────── Сравнение результатов ─────────

function cellKey(v: Cell): string {
  if (v === null) return "n";
  if (typeof v === "number") return `d${Number(v.toFixed(6))}`;
  if (typeof v === "string") return `s${v}`;
  return `b${Array.from(v).join(",")}`;
}
const rowKey = (row: Cell[]) => JSON.stringify(row.map(cellKey));

export type Diff = "same" | "columns" | "count" | "values" | "order";

/** Сравнение двух результатов: имена столбцов не важны; ordered — важен порядок строк. */
export function compareSets(got: ResultSet, want: ResultSet, ordered: boolean): Diff {
  if (got.columns.length !== want.columns.length) return "columns";
  if (got.rows.length !== want.rows.length) return "count";
  const g = got.rows.map(rowKey);
  const w = want.rows.map(rowKey);
  if (ordered) {
    if (g.every((k, i) => k === w[i])) return "same";
    const gs = [...g].sort();
    const ws = [...w].sort();
    return gs.every((k, i) => k === ws[i]) ? "order" : "values";
  }
  const gs = [...g].sort();
  const ws = [...w].sort();
  return gs.every((k, i) => k === ws[i]) ? "same" : "values";
}

/** Текстовая таблица для примера: «a | b» и первые строки. */
export function formatSet(s: ResultSet, max = SAMPLE_ROWS): string {
  const lines = [s.columns.join(" | ")];
  for (const row of s.rows.slice(0, max)) lines.push(row.map(cellText).join(" | "));
  if (s.rows.length > max) lines.push(`… (${s.rows.length})`);
  else if (s.rows.length === 0) lines.push("—");
  return lines.join("\n");
}

const diffMessage = (d: Exclude<Diff, "same">, got: ResultSet, want: ResultSet, reference: string): L => {
  const ref = stripSql(reference);
  const hint: L = /group\s+by/i.test(ref)
    ? { ru: "Проверьте GROUP BY.", kk: "GROUP BY-ды тексеріңіз." }
    : /\bwhere\b/i.test(ref)
      ? { ru: "Проверьте условие WHERE.", kk: "WHERE шартын тексеріңіз." }
      : { ru: "Проверьте условие и FROM.", kk: "Шартты және FROM-ды тексеріңіз." };
  if (d === "columns") {
    return {
      ru: `Столбцов в результате: ${got.columns.length}, а нужно ${want.columns.length}. Проверьте, какие столбцы перечислены после SELECT.`,
      kk: `Нәтижеде бағандар саны: ${got.columns.length}, ал ${want.columns.length} болуы керек. SELECT-тен кейін қандай бағандар тізілгенін тексеріңіз.`,
    };
  }
  if (d === "count") {
    return {
      ru: `Строк в результате: ${got.rows.length}, а ожидалось ${want.rows.length}. ${hint.ru}`,
      kk: `Нәтижеде жолдар саны: ${got.rows.length}, ал ${want.rows.length} күтілген. ${hint.kk}`,
    };
  }
  return d === "order" ? MSG_ORDER : MSG_VALUES;
};

/** Результат последнего оператора, вернувшего столбцы. */
function lastSet(sets: ResultSet[]): ResultSet | null {
  return sets.length ? sets[sets.length - 1] : null;
}

export type SqlCheck = Extract<IdeCheck, { kind: "sql" }>;

/**
 * Проверка задачи. База создаётся из SQL (sql.js) заново для ученика и для эталона.
 * Задача на изменение (checkQuery): сравниваются таблицы после запроса ученика и после эталона.
 */
export function checkSql(check: SqlCheck, code: string, SQL: SqlJsStatic): CheckResult {
  const fail = (message: L | string, sample?: CheckResult["sample"]): CheckResult => ({ ok: false, passed: 0, total: 1, message, sample });
  if (!code.trim()) return fail(MSG_EMPTY);

  const mine = createDb(SQL);
  const ref = createDb(SQL);
  try {
    const r = runOn(mine, code);
    if (!r.ok) return fail(explainSqlError(r.error));
    const e = runOn(ref, check.reference);
    if (!e.ok) return fail(`Reference query failed: ${e.error}`);

    let got: ResultSet | null;
    let want: ResultSet | null;
    let ordered = !!check.ordered;
    if (check.checkQuery) {
      // Задача на изменение: сравниваем содержимое таблицы после обоих запросов.
      const a = runOn(mine, check.checkQuery);
      const b = runOn(ref, check.checkQuery);
      if (!a.ok) return fail(explainSqlError(a.error));
      if (!b.ok) return fail(`Reference check failed: ${b.error}`);
      got = lastSet(a.sets);
      want = lastSet(b.sets);
      ordered = true;
    } else {
      got = lastSet(r.sets);
      want = lastSet(e.sets);
    }
    if (!want) return fail("Reference query returned no result");
    if (!got) return fail(MSG_NO_RESULT);
    if (!check.checkQuery && /\bfrom\b/i.test(stripSql(check.reference)) && !/\bfrom\b/i.test(stripSql(code))) return fail(MSG_LITERAL);

    const d = compareSets(got, want, ordered);
    if (d === "same") return { ok: true, passed: 1, total: 1 };
    const message = check.checkQuery && d !== "columns" ? MSG_TABLE : diffMessage(d, got, want, check.reference);
    return fail(message, { expected: formatSet(want), got: formatSet(got) });
  } finally {
    mine.close();
    ref.close();
  }
}

/** Для тестов: запуск эталона и разбор результата. */
export function referenceSet(SQL: SqlJsStatic, sql: string): ResultSet | null {
  const db: Database = createDb(SQL);
  try {
    const r = runOn(db, sql);
    return r.ok ? lastSet(r.sets) : null;
  } finally {
    db.close();
  }
}
