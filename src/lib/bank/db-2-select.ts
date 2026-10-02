import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene, Text } from "../types";
import { hashString, seeded, shuffle, tx } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка db.select («Запросы SELECT»). Расчётная тема: таблицы и запросы строит код, а правильный ответ
// (число записей, первая строка после сортировки, выбранные записи) вычисляет мини-интерпретатор ниже —
// он повторяет семантику SQL (проверено сверкой с python3 + sqlite3 в scripts/out/db-2-select).
// Неверные варианты — типичные ошибки: граница BETWEEN, > вместо >=, AND вместо OR, потерянное NOT, приоритет AND.
// Названия товаров и книг — двуязычные ячейки, поэтому условия на них в запросах не строятся (LIKE — только по именам).
// Тексты после переменных чисел — без падежных окончаний (в казахском окончание зависит от числа).

const SKILL = "db.select";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
/** Русское склонение после числа: 1 запись, 3 записи, 5 записей. */
const plural = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
};

// ======================================================================
// Таблицы
// ======================================================================

type Val = string | number;
type TableName = "Students" | "Goods" | "Books";

interface Table {
  name: TableName;
  cols: string[];
  rows: Val[][];
  /** Подписи записей в столбце-названии (у Goods/Books — двуязычные). */
  labels: Text[];
  /** Номер столбца-названия: Name (Students — 1, Goods — 0) или Title (Books — 0). */
  nameCol: number;
}

const NUMERIC: Record<TableName, string[]> = {
  Students: ["Class", "Mark"],
  Goods: ["Price", "Qty"],
  Books: ["Year", "Pages"],
};
const TABLE_KINDS: TableName[] = ["Students", "Goods", "Books"];

const NAMES = ["Айдар", "Алия", "Арман", "Асель", "Берик", "Дана", "Данияр", "Ерлан", "Жанар", "Мадина", "Нурлан", "Сауле"];
const g = (ru: string, kk: string): L => ({ ru, kk });
const GOODS_POOL: L[] = [
  g("Тетрадь", "Дәптер"),
  g("Ручка", "Қалам"),
  g("Карандаш", "Қарындаш"),
  g("Линейка", "Сызғыш"),
  g("Ластик", "Өшіргіш"),
  g("Пенал", "Қаламсауыт"),
  g("Альбом", "Альбом"),
  g("Калькулятор", "Калькулятор"),
  g("Папка", "Папка"),
  g("Маркер", "Маркер"),
  g("Блокнот", "Блокнот"),
];
const BOOKS_POOL: L[] = [
  g("Сказки", "Ертегілер"),
  g("Атлас", "Атлас"),
  g("Словарь", "Сөздік"),
  g("Задачник", "Есептер жинағы"),
  g("Энциклопедия", "Энциклопедия"),
  g("Букварь", "Әліппе"),
  g("Справочник", "Анықтамалық"),
  g("Учебник", "Оқулық"),
  g("Журнал", "Журнал"),
  g("Календарь", "Күнтізбе"),
];
const PRICES = [40, 50, 60, 80, 90, 100, 120, 150, 200, 300, 500, 700];
const QTYS = [4, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100];
const PAGES = [48, 64, 96, 120, 160, 200, 240, 320, 400, 480];

function makeTable(rand: Rand, name: TableName): Table {
  if (name === "Students") {
    for (;;) {
      const n = int(rand, 7, 8);
      const names = shuffle(NAMES, rand).slice(0, n);
      const rows: Val[][] = names.map((nm, i) => [i + 1, nm, pick(rand, [9, 10, 11]), int(rand, 3, 5)]);
      const classes = new Set(rows.map((r) => r[2]));
      const marks = new Set(rows.map((r) => r[3]));
      if (classes.size === 3 && marks.size === 3) {
        return { name, cols: ["ID", "Name", "Class", "Mark"], rows, labels: names, nameCol: 1 };
      }
    }
  }
  if (name === "Goods") {
    const labels = shuffle(GOODS_POOL, rand).slice(0, 7);
    const prices = shuffle(PRICES, rand).slice(0, 7);
    const qtys = shuffle(QTYS, rand).slice(0, 7);
    const rows: Val[][] = labels.map((l, i) => [l.ru, prices[i], qtys[i]]);
    return { name, cols: ["Name", "Price", "Qty"], rows, labels, nameCol: 0 };
  }
  const labels = shuffle(BOOKS_POOL, rand).slice(0, 7);
  const pages = shuffle(PAGES, rand).slice(0, 7);
  // Годы: есть повторы, чтобы у DISTINCT и сортировки было что показать.
  const base = [int(rand, 2006, 2012), int(rand, 2013, 2016), int(rand, 2017, 2022)];
  const rows: Val[][] = labels.map((l, i) => [l.ru, i < 3 ? base[i] : pick(rand, base), pages[i]]);
  return { name, cols: ["Title", "Year", "Pages"], rows, labels, nameCol: 0 };
}

const col = (t: Table, f: string) => t.cols.indexOf(f);
const nameField = (t: Table) => t.cols[t.nameCol];
const valuesOf = (t: Table, f: string): number[] => [...new Set(t.rows.map((r) => r[col(t, f)] as number))].sort((a, b) => a - b);

function tableScene(t: Table, highlight?: number[]): Scene {
  return {
    kind: "table",
    columns: t.cols,
    rows: t.rows.map((r, i) => r.map((v, c) => (c === t.nameCol ? t.labels[i] : String(v)))),
    highlightRows: highlight,
  };
}

/** Подписи записей по номерам строк: «Айдар, Мадина». */
function labelList(t: Table, idx: number[]): L {
  const join = (lang: "ru" | "kk") => idx.map((i) => tx(t.labels[i], lang)).join(", ");
  return { ru: join("ru"), kk: join("kk") };
}

// ======================================================================
// Условия и запросы
// ======================================================================

type CmpOp = "=" | "<>" | ">" | "<" | ">=" | "<=";
type Cond =
  | { t: "cmp"; f: string; op: CmpOp; v: number }
  | { t: "between"; f: string; a: number; b: number }
  | { t: "in"; f: string; vs: number[] }
  | { t: "like"; f: string; p: string }
  | { t: "and" | "or"; a: Cond; b: Cond }
  | { t: "not"; a: Cond };

const cmp = (f: string, op: CmpOp, v: number): Cond => ({ t: "cmp", f, op, v });
const and = (a: Cond, b: Cond): Cond => ({ t: "and", a, b });
const or = (a: Cond, b: Cond): Cond => ({ t: "or", a, b });
const not = (a: Cond): Cond => ({ t: "not", a });

/** Запись условия. explicit — скобки вокруг AND внутри OR (иначе читаем по приоритету: AND сильнее OR). */
function show(c: Cond, explicit = true): string {
  switch (c.t) {
    case "cmp":
      return `${c.f} ${c.op} ${c.v}`;
    case "between":
      return `${c.f} BETWEEN ${c.a} AND ${c.b}`;
    case "in":
      return `${c.f} IN (${c.vs.join(", ")})`;
    case "like":
      return `${c.f} LIKE '${c.p}'`;
    case "not":
      return `NOT (${show(c.a, explicit)})`;
    case "and":
    case "or": {
      const wrap = (x: Cond) => {
        const s = show(x, explicit);
        if (x.t !== "and" && x.t !== "or") return s;
        if (x.t === c.t) return s;
        if (c.t === "and") return `(${s})`; // OR внутри AND — скобки обязательны
        return explicit ? `(${s})` : s; // AND внутри OR — по приоритету
      };
      return `${wrap(c.a)} ${c.t === "and" ? "AND" : "OR"} ${wrap(c.b)}`;
    }
  }
}

function likeRegex(p: string): RegExp {
  const body = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${body}$`);
}

function test(t: Table, row: Val[], c: Cond): boolean {
  const val = (f: string) => row[col(t, f)];
  switch (c.t) {
    case "cmp": {
      const x = val(c.f) as number;
      switch (c.op) {
        case "=":
          return x === c.v;
        case "<>":
          return x !== c.v;
        case ">":
          return x > c.v;
        case "<":
          return x < c.v;
        case ">=":
          return x >= c.v;
        case "<=":
          return x <= c.v;
      }
      return false;
    }
    case "between":
      return (val(c.f) as number) >= c.a && (val(c.f) as number) <= c.b;
    case "in":
      return c.vs.includes(val(c.f) as number);
    case "like":
      return likeRegex(c.p).test(String(val(c.f)));
    case "and":
      return test(t, row, c.a) && test(t, row, c.b);
    case "or":
      return test(t, row, c.a) || test(t, row, c.b);
    case "not":
      return !test(t, row, c.a);
  }
}

interface Query {
  t: Table;
  fields: string[] | "*";
  distinct?: boolean;
  where?: Cond;
  order?: { f: string; desc?: boolean }[];
}

const fieldsOf = (q: Query) => (q.fields === "*" ? q.t.cols : q.fields);

function sqlText(q: Query, explicit = true): string {
  const parts = [`SELECT ${q.distinct ? "DISTINCT " : ""}${q.fields === "*" ? "*" : q.fields.join(", ")}`, `FROM ${q.t.name}`];
  if (q.where) parts.push(`WHERE ${show(q.where, explicit)}`);
  if (q.order) parts.push(`ORDER BY ${q.order.map((o) => `${o.f} ${o.desc ? "DESC" : "ASC"}`).join(", ")}`);
  return `${parts.join(" ")};`;
}

/** Номера строк таблицы в порядке результата (после WHERE и ORDER BY, до DISTINCT). */
function selectRows(q: Query): number[] {
  const idx = q.t.rows.map((_, i) => i).filter((i) => !q.where || test(q.t, q.t.rows[i], q.where));
  if (q.order) {
    const keys = q.order;
    idx.sort((a, b) => {
      for (const k of keys) {
        const x = q.t.rows[a][col(q.t, k.f)];
        const y = q.t.rows[b][col(q.t, k.f)];
        if (x === y) continue;
        return ((x as number | string) < (y as number | string) ? -1 : 1) * (k.desc ? -1 : 1);
      }
      return 0;
    });
  }
  return idx;
}

const countOf = (t: Table, where: Cond) => t.rows.filter((r) => test(t, r, where)).length;
const matching = (t: Table, where: Cond) => t.rows.map((_, i) => i).filter((i) => test(t, t.rows[i], where));

/** Таблица-результат запроса (для reveal): выбранные поля в порядке результата. */
function resultScene(q: Query, highlightFirst = true): Scene {
  const idx = selectRows(q);
  const fs = fieldsOf(q);
  return {
    kind: "table",
    columns: fs,
    rows: idx.map((i) => fs.map((f) => (col(q.t, f) === q.t.nameCol ? q.t.labels[i] : String(q.t.rows[i][col(q.t, f)])))),
    highlightRows: highlightFirst && idx.length ? [0] : undefined,
  };
}

// ---------- Случайные условия ----------

function randNumField(rand: Rand, t: Table, not?: string): string {
  const fs = NUMERIC[t.name].filter((f) => f !== not);
  return pick(rand, fs);
}

function randCmp(rand: Rand, t: Table, field?: string, ops?: CmpOp[]): Cond {
  const f = field ?? randNumField(rand, t);
  let c = cmp(f, "=", valuesOf(t, f)[0]);
  // Без вырожденных условий вида Mark <= 5 (верно для всех записей) или Mark < 3 (ни для одной).
  for (let k = 0; k < 20; k++) {
    c = cmp(f, pick(rand, ops ?? ([">", "<", ">=", "<=", "=", "<>"] as CmpOp[])), pick(rand, valuesOf(t, f)));
    const n = countOf(t, c);
    if (n > 0 && n < t.rows.length) break;
  }
  return c;
}

function randBetween(rand: Rand, t: Table, field?: string): Cond | undefined {
  const f = field ?? randNumField(rand, t);
  const vals = valuesOf(t, f);
  if (vals.length < 3) return undefined;
  const i = int(rand, 0, vals.length - 3);
  const j = int(rand, i + 1, vals.length - 1);
  return { t: "between", f, a: vals[i], b: vals[j] };
}

function randIn(rand: Rand, t: Table, field?: string): Cond | undefined {
  const f = field ?? randNumField(rand, t);
  const vals = valuesOf(t, f);
  if (vals.length < 4) return undefined;
  const vs = shuffle(vals, rand)
    .slice(0, int(rand, 2, 3))
    .sort((a, b) => a - b);
  return { t: "in", f, vs };
}

// ======================================================================
// Типичные ошибки: «мутанты» условия (ровно одна правка)
// ======================================================================

interface Mut {
  cond: Cond;
  why: L;
}

const WHY_AND_OR: L = {
  ru: "Перепутаны AND и OR: AND требует оба условия сразу, OR — хотя бы одно.",
  kk: "AND және OR шатастырылған: AND екі шартты бірдей, OR кемінде біреуін талап етеді.",
};
const WHY_ALL_OR: L = {
  ru: "Так выйдет, если AND принять за OR: тогда хватило бы любого одного условия из трёх.",
  kk: "AND-ты OR деп қабылдаса, осылай шығады: онда үш шарттың кез келген біреуі жеткілікті болар еді.",
};
const WHY_ALL_AND: L = {
  ru: "Так выйдет, если OR принять за AND: тогда нужны были бы все три условия сразу.",
  kk: "OR-ды AND деп қабылдаса, осылай шығады: онда үш шарттың бәрі бірден орындалуы керек болар еді.",
};
const WHY_NOT_LOST: L = { ru: "Потеряно NOT: условие применено без отрицания.", kk: "NOT жоғалған: шарт терістеусіз қолданылған." };

function mutants(c: Cond): Mut[] {
  switch (c.t) {
    case "cmp": {
      const out: Mut[] = [];
      const flip: Partial<Record<CmpOp, CmpOp>> = { ">": ">=", ">=": ">", "<": "<=", "<=": "<" };
      const op2 = flip[c.op];
      if (op2) {
        const incl = op2.includes("=");
        out.push({
          cond: { ...c, op: op2 },
          why: {
            ru: `Это ответ для знака ${op2} вместо ${c.op}: граничное значение ${incl ? "включается" : "не включается"}, а в запросе — наоборот.`,
            kk: `Бұл ${c.op} орнына ${op2} белгісі қойылғандағы жауап: шектік мән ${incl ? "кіреді" : "кірмейді"}, ал сұраныста — керісінше.`,
          },
        });
      }
      if (c.op === "=") {
        out.push({
          cond: { ...c, op: "<>" },
          why: { ru: "Это ответ для <> («не равно»): выбраны записи, которые не подходят под =.", kk: "Бұл <> («тең емес») белгісінің жауабы: = шартына сәйкес келмейтін жазбалар таңдалған." },
        });
      }
      if (c.op === "<>") {
        out.push({
          cond: { ...c, op: "=" },
          why: { ru: "Это ответ для знака = вместо <>: выбраны как раз те записи, которые нужно исключить.", kk: "Бұл <> орнына = белгісі қойылғандағы жауап: алып тастау керек жазбалар таңдалған." },
        });
      }
      return out;
    }
    case "between":
      return [
        {
          cond: and(cmp(c.f, ">", c.a), cmp(c.f, "<", c.b)),
          why: { ru: "Границы BETWEEN не учтены: на самом деле они входят в диапазон.", kk: "BETWEEN шектері ескерілмеген: шын мәнінде олар аралыққа кіреді." },
        },
        {
          cond: and(cmp(c.f, ">", c.a), cmp(c.f, "<=", c.b)),
          why: { ru: "Нижняя граница потеряна: BETWEEN включает и её.", kk: "Төменгі шек жоғалған: BETWEEN оны да қамтиды." },
        },
        {
          cond: and(cmp(c.f, ">=", c.a), cmp(c.f, "<", c.b)),
          why: { ru: "Верхняя граница потеряна: BETWEEN включает и её.", kk: "Жоғарғы шек жоғалған: BETWEEN оны да қамтиды." },
        },
      ];
    case "in": {
      const out: Mut[] = [
        {
          cond: { t: "between", f: c.f, a: c.vs[0], b: c.vs[c.vs.length - 1] },
          why: { ru: "Список IN принят за диапазон: выбраны и промежуточные значения, которых в списке нет.", kk: "IN тізімі аралық деп қабылданған: тізімде жоқ аралық мәндер де таңдалған." },
        },
      ];
      if (c.vs.length > 2) {
        out.push({
          cond: { ...c, vs: c.vs.slice(0, -1) },
          why: { ru: "Потеряно одно значение из списка IN.", kk: "IN тізіміндегі бір мән жоғалған." },
        });
      }
      return out;
    }
    case "like":
      return [];
    case "not":
      return [
        { cond: c.a, why: WHY_NOT_LOST },
        ...mutants(c.a).map((m) => ({ cond: not(m.cond), why: m.why })),
      ];
    case "and":
    case "or": {
      const flipped: Cond = { t: c.t === "and" ? "or" : "and", a: c.a, b: c.b };
      return [
        { cond: flipped, why: WHY_AND_OR },
        ...mutants(c.a).map((m) => ({ cond: { ...c, a: m.cond } as Cond, why: m.why })),
        ...mutants(c.b).map((m) => ({ cond: { ...c, b: m.cond } as Cond, why: m.why })),
      ];
    }
  }
}

const WHY_COUNT: L = {
  ru: "Ошибка при подсчёте: проверь условие для каждой записи по очереди.",
  kk: "Санау кезіндегі қате: шартты әр жазба үшін кезекпен тексер.",
};

/** Неверные варианты-числа: счётчики мутантов, а если их мало — близкие числа. */
function countWrongs(rand: Rand, t: Table, correct: number, muts: Mut[]): { text: Text; why: L }[] {
  const seen = new Set<number>([correct]);
  const out: { text: Text; why: L }[] = [];
  for (const m of shuffle(muts, rand)) {
    const k = countOf(t, m.cond);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ text: String(k), why: m.why });
    if (out.length === 3) return out;
  }
  for (const k of [correct + 1, correct - 1, correct + 2, correct - 2, t.rows.length, 0, 1]) {
    if (out.length === 3) break;
    if (k < 0 || k > t.rows.length || seen.has(k)) continue;
    seen.add(k);
    out.push({ text: String(k), why: WHY_COUNT });
  }
  return out;
}

// ======================================================================
// Сборка заданий
// ======================================================================

interface Base {
  id: string;
  level: Level;
  prompt: L;
  scene?: Scene;
  reveal?: Scene;
  hint: L;
  explanation: L;
}

interface Wrong {
  text: Text;
  why: L;
}

/** choice: правильный вариант + 3 неверных (с разбором ошибки); numeric — числа по возрастанию, иначе перемешаны. */
function choice(rand: Rand, base: Base, right: Text, wrong: Wrong[], numeric = false): ChoiceStep | undefined {
  const seen = new Set<string>([JSON.stringify(right)]);
  const uniq: Wrong[] = [];
  for (const w of wrong) {
    const key = JSON.stringify(w.text);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(w);
    if (uniq.length === 3) break;
  }
  if (uniq.length < 3) return undefined;
  let all: { text: Text; why: L | null }[] = [{ text: right, why: null }, ...uniq];
  all = numeric ? all.sort((a, b) => Number(a.text) - Number(b.text)) : shuffle(all, rand);
  return {
    type: "choice",
    skill: SKILL,
    ...base,
    options: all.map((o) => o.text),
    correct: all.findIndex((o) => o.why === null),
    whyWrong: all.map((o) => o.why),
  };
}

function numberInput(base: Base, answer: number): InputStep {
  return { type: "input", skill: SKILL, ...base, answers: [String(answer)], mode: "number" };
}

/** Идентификатор по содержанию: вид задания + хэш таблицы и запроса (повторов в выдаче не будет). */
function makeId(kind: string, t: Table, extra: string, seed: number): string {
  return `g:${SKILL}:${kind}:${hashString(JSON.stringify(t.rows) + extra).toString(36)}:${seed}`;
}

const HINT_ROWS: L = {
  ru: "Иди по таблице сверху вниз и проверяй условие для каждой записи отдельно. Обрати внимание, включается ли граничное значение.",
  kk: "Кестені жоғарыдан төмен қарай қарап шығып, шартты әр жазба үшін бөлек тексер. Шектік мән кіретін-кірмейтініне назар аудар.",
};
const HINT_ORDER: L = {
  ru: "Сначала WHERE отбрасывает лишние записи, потом ORDER BY расставляет оставшиеся. Выпиши отобранные записи и отсортируй их.",
  kk: "Алдымен WHERE артық жазбаларды тастайды, содан кейін ORDER BY қалғандарын орналастырады. Іріктелген жазбаларды жазып, сұрыпта.",
};

const countPrompt = (sql: string): L => ({ ru: `Сколько записей выведет запрос: ${sql}`, kk: `Сұраныс неше жазба шығарады: ${sql}` });

function countExplain(t: Table, cond: Cond, idx: number[], tail?: L): L {
  const list = labelList(t, idx);
  const empty = idx.length === 0;
  return {
    ru: `Проверяем условие ${show(cond)} для каждой записи: ${empty ? "подходящих записей нет" : `подходят ${list.ru}`} — всего ${idx.length}.${tail ? ` ${tail.ru}` : ""}`,
    kk: `${show(cond)} шартын әр жазба үшін тексереміз: ${empty ? "сәйкес жазба жоқ" : `${list.kk} сәйкес келеді`} — барлығы ${idx.length}.${tail ? ` ${tail.kk}` : ""}`,
  };
}

/** Простой подсчёт: SELECT * FROM T WHERE f op v → число записей (ввод числа). */
function genCountSimple(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const cond = randCmp(rand, t);
  const q: Query = { t, fields: "*", where: cond };
  const idx = selectRows(q);
  if (idx.length < 1 || idx.length > t.rows.length - 1) return undefined;
  const sql = sqlText(q);
  return numberInput(
    {
      id: makeId("count-simple", t, sql, seed),
      level,
      prompt: countPrompt(sql),
      scene: tableScene(t),
      reveal: tableScene(t, idx),
      hint: HINT_ROWS,
      explanation: countExplain(t, cond, idx, {
        ru: "Знаки >= и <= включают само значение, а > и < — нет.",
        kk: ">= және <= белгілері мәннің өзін қамтиды, ал > және < — қамтымайды.",
      }),
    },
    idx.length,
  );
}

/** Какой запрос выведет только указанные поля. */
function genFields(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const cols = t.name === "Students" ? t.cols.slice(1) : t.cols; // ID не берём — поля Name, Class, Mark
  const [a, b, c] = shuffle(cols, rand);
  const right = `SELECT ${a}, ${b} FROM ${t.name};`;
  const wrong: Wrong[] = [
    {
      text: `SELECT ${a}, ${c} FROM ${t.name};`,
      why: { ru: `Выведены поля ${a} и ${c}, а нужно поле ${b} вместо ${c}.`, kk: `${a} және ${c} өрістері шығады, ал ${c} орнына ${b} өрісі керек.` },
    },
    {
      text: `SELECT * FROM ${t.name};`,
      why: { ru: "Звёздочка выводит все поля таблицы, а нужны только два.", kk: "Жұлдызша кестенің барлық өрісін шығарады, ал тек екеуі керек." },
    },
    {
      text: `SELECT ${a} FROM ${t.name};`,
      why: { ru: `Выведено одно поле ${a}, а второе потеряно.`, kk: `Бір ${a} өрісі шығады, ал екіншісі жоғалған.` },
    },
    {
      text: `SELECT ${t.name} FROM ${a}, ${b};`,
      why: { ru: "Части перепутаны: после SELECT идут поля, а после FROM — имя таблицы.", kk: "Бөліктер шатастырылған: SELECT-тен кейін өрістер, ал FROM-нан кейін кесте аты тұрады." },
    },
  ];
  return choice(
    rand,
    {
      id: makeId("fields", t, `${a},${b}`, seed),
      level,
      prompt: {
        ru: `Какой запрос выведет только поля ${a} и ${b} таблицы ${t.name}?`,
        kk: `${t.name} кестесінің тек ${a} және ${b} өрістерін қай сұраныс шығарады?`,
      },
      scene: tableScene(t),
      hint: {
        ru: "После SELECT перечисляют нужные поля через запятую, после FROM — имя таблицы.",
        kk: "SELECT-тен кейін керекті өрістерді үтір арқылы тізеді, FROM-нан кейін — кесте атын.",
      },
      explanation: {
        ru: `После SELECT перечисляем нужные поля (${a}, ${b}), после FROM — таблицу (${t.name}). Звёздочка вывела бы все поля.`,
        kk: `SELECT-тен кейін керекті өрістерді (${a}, ${b}) тіземіз, FROM-нан кейін — кестені (${t.name}). Жұлдызша барлық өрісті шығарар еді.`,
      },
    },
    right,
    shuffle(wrong, rand),
  );
}

const FIRST_Q: Record<TableName, L> = {
  Students: { ru: "Какое имя выведется первым", kk: "Қай есім бірінші шығады" },
  Goods: { ru: "Какой товар выведется первым", kk: "Қай тауар бірінші шығады" },
  Books: { ru: "Какая книга выведется первой", kk: "Қай кітап бірінші шығады" },
};
const NTH_Q: Record<TableName, (n: number) => L> = {
  Students: (n) => ({ ru: `Какое имя будет в строке ${n} результата`, kk: `Нәтиженің ${n}-жолында қай есім тұрады` }),
  Goods: (n) => ({ ru: `Какой товар будет в строке ${n} результата`, kk: `Нәтиженің ${n}-жолында қай тауар тұрады` }),
  Books: (n) => ({ ru: `Какая книга будет в строке ${n} результата`, kk: `Нәтиженің ${n}-жолында қай кітап тұрады` }),
};

/** Ключ сортировки без повторов: Students — Name, Goods — Price/Qty, Books — Pages. */
function uniqueKey(rand: Rand, t: Table): string {
  if (t.name === "Students") return "Name";
  if (t.name === "Goods") return pick(rand, ["Price", "Qty"]);
  return "Pages";
}

const WHY_DIR: L = {
  ru: "Направление перепутано: ASC — по возрастанию (с меньшего), DESC — по убыванию (с большего).",
  kk: "Бағыт шатастырылған: ASC — өсу бойынша (кішіден), DESC — кему бойынша (үлкеннен).",
};

/** Первая строка после сортировки по одному полю (без WHERE). */
function genFirst(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const key = uniqueKey(rand, t);
  const desc = rand() < 0.5;
  const q: Query = { t, fields: [nameField(t)], order: [{ f: key, desc }] };
  const idx = selectRows(q);
  const sql = sqlText(q);
  const lab = (i: number) => t.labels[idx[i]];
  const wrong: Wrong[] = [
    { text: lab(idx.length - 1), why: WHY_DIR },
    { text: lab(1), why: { ru: "Это вторая запись результата, а нужна первая.", kk: "Бұл нәтиженің екінші жазбасы, ал біріншісі керек." } },
    { text: lab(2), why: { ru: "Эта запись стоит в середине результата, а нужна первая.", kk: "Бұл жазба нәтиженің ортасында тұр, ал біріншісі керек." } },
    { text: lab(3), why: { ru: "Эта запись стоит в середине результата, а нужна первая.", kk: "Бұл жазба нәтиженің ортасында тұр, ал біріншісі керек." } },
  ];
  const keyDesc: L = {
    ru: `${desc ? "DESC — по убыванию, первой идёт запись с наибольшим" : "ASC — по возрастанию, первой идёт запись с наименьшим"} значением ${key}`,
    kk: `${desc ? "DESC — кему бойынша, бірінші ең үлкен" : "ASC — өсу бойынша, бірінші ең кіші"} ${key} мәнді жазба шығады`,
  };
  return choice(
    rand,
    {
      id: makeId("first", t, sql, seed),
      level,
      prompt: { ru: `${FIRST_Q[t.name].ru}: ${sql}`, kk: `${FIRST_Q[t.name].kk}: ${sql}` },
      scene: tableScene(t),
      reveal: resultScene(q),
      hint: {
        ru: "ASC — от меньшего к большему, DESC — от большего к меньшему. Расставь записи по полю сортировки и посмотри на первую.",
        kk: "ASC — кішіден үлкенге, DESC — үлкеннен кішіге. Жазбаларды сұрыптау өрісі бойынша орналастырып, біріншісіне қара.",
      },
      explanation: {
        ru: `${keyDesc.ru}. Первая запись — ${tx(lab(0), "ru")}.`,
        kk: `${keyDesc.kk}. Бірінші жазба — ${tx(lab(0), "kk")}.`,
      },
    },
    lab(0),
    wrong,
  );
}

/** Два условия через AND/OR (в том числе BETWEEN и IN): число записей. */
function genCountTwo(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const f1 = randNumField(rand, t);
  const f2 = randNumField(rand, t, f1);
  const c1 = randCmp(rand, t, f1);
  const second = pick(rand, [0, 1, 2]);
  const c2 = second === 0 ? randCmp(rand, t, f2) : second === 1 ? (randBetween(rand, t, f2) ?? randCmp(rand, t, f2)) : (randIn(rand, t, f2) ?? randCmp(rand, t, f2));
  const cond = rand() < 0.5 ? and(c1, c2) : or(c1, c2);
  const q: Query = { t, fields: "*", where: cond };
  const idx = selectRows(q);
  if (idx.length < 1 || idx.length > t.rows.length - 1) return undefined;
  const sql = sqlText(q);
  return choice(
    rand,
    {
      id: makeId("count-two", t, sql, seed),
      level,
      prompt: countPrompt(sql),
      scene: tableScene(t),
      reveal: tableScene(t, idx),
      hint: {
        ru: "Для каждой записи проверь оба условия. AND требует, чтобы верны были оба, OR — хотя бы одно.",
        kk: "Әр жазба үшін екі шартты да тексер. AND екеуінің де орындалуын, OR — кемінде біреуінің орындалуын талап етеді.",
      },
      explanation: countExplain(t, cond, idx),
    },
    String(idx.length),
    countWrongs(rand, t, idx.length, mutants(cond)),
    true,
  );
}

/** BETWEEN: границы входят в диапазон (число записей). */
function genBetween(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const cond = randBetween(rand, t);
  if (!cond || cond.t !== "between") return undefined;
  const q: Query = { t, fields: "*", where: cond };
  const idx = selectRows(q);
  if (idx.length < 2 || idx.length > t.rows.length - 1) return undefined;
  const sql = sqlText(q);
  return choice(
    rand,
    {
      id: makeId("between", t, sql, seed),
      level,
      prompt: countPrompt(sql),
      scene: tableScene(t),
      reveal: tableScene(t, idx),
      hint: {
        ru: "BETWEEN a AND b — это «от a до b», и сами a и b тоже подходят. Отметь строки, где значение попало в диапазон.",
        kk: "BETWEEN a AND b — a мен b аралығы, a және b мәндерінің өзі де сәйкес келеді. Мәні аралыққа түскен жолдарды белгіле.",
      },
      explanation: countExplain(t, cond, idx, {
        ru: `BETWEEN включает границы: ${cond.f} >= ${cond.a} AND ${cond.f} <= ${cond.b}.`,
        kk: `BETWEEN шектерді қамтиды: ${cond.f} >= ${cond.a} AND ${cond.f} <= ${cond.b}.`,
      }),
    },
    String(idx.length),
    countWrongs(rand, t, idx.length, mutants(cond)),
    true,
  );
}

/** IN со списком значений (число записей). */
function genIn(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const cond = randIn(rand, t);
  if (!cond || cond.t !== "in") return undefined;
  const q: Query = { t, fields: "*", where: cond };
  const idx = selectRows(q);
  if (idx.length < 1 || idx.length > t.rows.length - 1) return undefined;
  const sql = sqlText(q);
  return choice(
    rand,
    {
      id: makeId("in", t, sql, seed),
      level,
      prompt: countPrompt(sql),
      scene: tableScene(t),
      reveal: tableScene(t, idx),
      hint: {
        ru: "IN (…) — «равно одному из списка». Отметь строки, у которых значение поля есть в списке.",
        kk: "IN (…) — «тізімдегінің біріне тең». Өрістің мәні тізімде бар жолдарды белгіле.",
      },
      explanation: countExplain(t, cond, idx, {
        ru: `IN — то же, что ${cond.vs.map((v) => `${cond.f} = ${v}`).join(" OR ")}.`,
        kk: `IN — ${cond.vs.map((v) => `${cond.f} = ${v}`).join(" OR ")} дегенмен бірдей.`,
      }),
    },
    String(idx.length),
    countWrongs(rand, t, idx.length, mutants(cond)),
    true,
  );
}

/** LIKE по именам учеников: число записей для разных шаблонов. */
function genLike(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, "Students");
  const names = t.rows.map((r) => String(r[1]));
  const word = pick(rand, names);
  const x = word[1]; // вторая буква — строчная
  const X = x.toUpperCase();
  const kinds: { key: string; p: string; ru: string; kk: string }[] = [
    { key: "prefix", p: `${X}%`, ru: `имя начинается с ${X}`, kk: `есім ${X} әрпінен басталады` },
    { key: "suffix", p: `%${x}`, ru: `имя оканчивается на ${x}`, kk: `есім ${x} әрпімен аяқталады` },
    { key: "second", p: `_${x}%`, ru: `вторая буква имени — ${x}`, kk: `есімнің екінші әрпі — ${x}` },
    { key: "contains", p: `%${x}%`, ru: `буква ${x} встречается в имени где угодно`, kk: `${x} әрпі есімнің кез келген жерінде кездеседі` },
  ];
  const counts = kinds.map((k) => countOf(t, { t: "like", f: "Name", p: k.p }));
  if (new Set(counts).size < 4) return undefined;
  // В одних СУБД LIKE различает регистр (SQLite для кириллицы), в других (Access, MySQL) — нет.
  // Берём только шаблоны, у которых ответ не зависит от регистра: иначе «Алия» и '%а%' дают спор.
  const ci = (p: string) => new RegExp(likeRegex(p).source, "i");
  if (kinds.some((k, i) => names.filter((nm) => ci(k.p).test(nm)).length !== counts[i])) return undefined;
  const ri = int(rand, 0, 3);
  const right = kinds[ri];
  const cond: Cond = { t: "like", f: "Name", p: right.p };
  const q: Query = { t, fields: ["Name"], where: cond };
  const idx = selectRows(q);
  const sql = sqlText(q);
  const wrong: Wrong[] = kinds
    .map((k, i) => ({ k, i }))
    .filter(({ i }) => i !== ri)
    .map(({ k, i }) => ({
      text: String(counts[i]),
      why: {
        ru: `Это результат для шаблона '${k.p}': ${k.ru}. А в запросе — другой шаблон.`,
        kk: `Бұл '${k.p}' үлгісінің нәтижесі: ${k.kk}. Ал сұраныста — басқа үлгі.`,
      },
    }));
  return choice(
    rand,
    {
      id: makeId("like", t, sql, seed),
      level,
      prompt: countPrompt(sql),
      scene: tableScene(t),
      reveal: tableScene(t, idx),
      hint: {
        ru: "% заменяет любое число символов (даже ноль), _ — ровно один символ. Проверь шаблон на каждом имени.",
        kk: "% кез келген сандағы таңбаларды (тіпті бірде-бір таңба болмаса да) алмастырады, _ — дәл бір таңбаны. Үлгіні әр есімге тексер.",
      },
      explanation: {
        ru: `Шаблон '${right.p}': ${right.ru}. Подходят ${labelList(t, idx).ru} — всего ${idx.length}.`,
        kk: `'${right.p}' үлгісі: ${right.kk}. ${labelList(t, idx).kk} сәйкес келеді — барлығы ${idx.length}.`,
      },
    },
    String(idx.length),
    wrong,
    true,
  );
}

/** Подсвечены выбранные записи — какое условие WHERE их выбирает. */
function genWhich(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const f1 = randNumField(rand, t);
  const f2 = randNumField(rand, t, f1);
  const kind = pick(rand, ["cmp2", "between", "in"]);
  let cond: Cond | undefined;
  if (kind === "cmp2") cond = (rand() < 0.5 ? and : or)(randCmp(rand, t, f1), randCmp(rand, t, f2));
  else if (kind === "between") cond = randBetween(rand, t, f1);
  else cond = randIn(rand, t, f1);
  if (!cond) return undefined;
  const idx = matching(t, cond);
  if (idx.length < 1 || idx.length > t.rows.length - 1) return undefined;
  const key = (c: Cond) => matching(t, c).join(",");
  const wrong: Wrong[] = [];
  const seen = new Set<string>([key(cond)]);
  for (const m of shuffle(mutants(cond), rand)) {
    const k = key(m.cond);
    if (seen.has(k)) continue;
    seen.add(k);
    // Разбор по данным: какие записи это условие добавляет лишними и какие теряет.
    const got = matching(t, m.cond);
    const extra = got.filter((i) => !idx.includes(i));
    const lost = idx.filter((i) => !got.includes(i));
    const part = (lang: "ru" | "kk") =>
      [
        extra.length ? `${lang === "ru" ? "лишние записи" : "артық жазбалар"}: ${tx(labelList(t, extra), lang)}` : "",
        lost.length ? `${lang === "ru" ? "не выбраны" : "таңдалмай қалғандар"}: ${tx(labelList(t, lost), lang)}` : "",
      ]
        .filter(Boolean)
        .join("; ");
    wrong.push({
      text: show(m.cond),
      why: { ru: `Это условие выбирает другой набор записей — ${part("ru")}.`, kk: `Бұл шарт басқа жазбаларды таңдайды — ${part("kk")}.` },
    });
    if (wrong.length === 3) break;
  }
  const sql = `SELECT * FROM ${t.name} WHERE …;`;
  return choice(
    rand,
    {
      id: makeId("which", t, show(cond), seed),
      level,
      prompt: {
        ru: `Запрос ${sql} выбрал подсвеченные записи. Какое условие стоит на месте многоточия?`,
        kk: `${sql} сұранысы бөлектелген жазбаларды таңдады. Көп нүктенің орнында қандай шарт тұр?`,
      },
      scene: tableScene(t, idx),
      hint: {
        ru: "Проверь каждое условие на подсвеченных и на неподсвеченных записях: оно должно подходить первым и не подходить вторым.",
        kk: "Әр шартты бөлектелген және бөлектелмеген жазбаларда тексер: ол біріншілеріне сәйкес келіп, екіншілеріне сәйкес келмеуі керек.",
      },
      explanation: {
        ru: `Условие ${show(cond)} выбирает ${labelList(t, idx).ru} — ровно подсвеченные записи. Остальные варианты выбирают другой набор записей.`,
        kk: `${show(cond)} шарты ${labelList(t, idx).kk} жазбаларын таңдайды — дәл бөлектелген жазбаларды. Қалған нұсқалар басқа жазбалар жиынын таңдайды.`,
      },
    },
    show(cond),
    wrong,
  );
}

/** Три условия: приоритет AND над OR, скобки, NOT — число записей. */
function genComplex(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const f1 = randNumField(rand, t);
  const f2 = randNumField(rand, t, f1);
  const A = randCmp(rand, t, f1, [">", "<", "=", ">=", "<="]);
  const B = randCmp(rand, t, f2, [">", "<", "=", ">=", "<="]);
  const C = randCmp(rand, t, f1, [">", "<", ">=", "<="]);
  const form = pick(rand, ["prio", "paren", "notor"]);
  let cond: Cond;
  let muts: Mut[];
  let explicit = true;
  let note: L;
  if (form === "prio") {
    // A OR B AND C: без скобок AND выполняется раньше OR
    cond = or(A, and(B, C));
    explicit = false;
    muts = [
      {
        cond: and(or(A, B), C),
        why: {
          ru: "Условие прочитано так, будто первые две части стоят в скобках. Но AND выполняется раньше OR.",
          kk: "Шарт алғашқы екі бөлік жақшада тұрғандай оқылған. Бірақ AND OR-дан бұрын орындалады.",
        },
      },
      { cond: or(A, or(B, C)), why: WHY_ALL_OR },
      { cond: and(A, and(B, C)), why: WHY_ALL_AND },
    ];
    note = {
      ru: `AND выполняется раньше OR: сначала находим записи, где верно ${show(B)} AND ${show(C)}, потом добавляем записи, где верно ${show(A)}.`,
      kk: `AND OR-дан бұрын орындалады: алдымен ${show(B)} AND ${show(C)} орындалатын жазбаларды табамыз, содан кейін ${show(A)} орындалатын жазбаларды қосамыз.`,
    };
  } else if (form === "paren") {
    cond = and(or(A, B), C);
    muts = [
      {
        cond: or(A, and(B, C)),
        why: { ru: "Скобки не учтены: сначала выполняется действие в скобках.", kk: "Жақшалар ескерілмеген: алдымен жақшаның ішіндегі әрекет орындалады." },
      },
      { cond: or(or(A, B), C), why: WHY_ALL_OR },
      { cond: and(and(A, B), C), why: WHY_ALL_AND },
    ];
    note = {
      ru: `Сначала скобка: записи, где верно ${show(A)} или ${show(B)}. Из них AND оставляет те, где верно ещё и ${show(C)}.`,
      kk: `Алдымен жақша: ${show(A)} немесе ${show(B)} орындалатын жазбалар. AND олардың ішінен ${show(C)} шарты да орындалатындарын қалдырады.`,
    };
  } else {
    cond = not(or(A, B));
    muts = [
      { cond: or(not(A), B), why: { ru: "NOT применён только к первому условию, а он действует на всю скобку.", kk: "NOT тек бірінші шартқа қолданылған, ал ол бүкіл жақшаға әсер етеді." } },
      { cond: or(not(A), not(B)), why: { ru: "NOT внесли в скобку и оставили OR: нужно заменить OR на AND.", kk: "NOT жақшаның ішіне кіргізіліп, OR қалдырылған: OR-дың орнына AND қою керек." } },
      { cond: or(A, B), why: WHY_NOT_LOST },
    ];
    note = { ru: "NOT (A OR B) = (NOT A) AND (NOT B): подходят записи, где не верно ни одно из условий.", kk: "NOT (A OR B) = (NOT A) AND (NOT B): ешбір шарт орындалмайтын жазбалар сәйкес келеді." };
  }
  const q: Query = { t, fields: "*", where: cond };
  const idx = selectRows(q);
  if (idx.length < 1 || idx.length > t.rows.length - 1) return undefined;
  const wrongs = countWrongs(rand, t, idx.length, muts);
  // Нужно три настоящих мутанта (а не запасные числа) — иначе задание теряет смысл.
  if (wrongs.filter((w) => w.why !== WHY_COUNT).length < 2) return undefined;
  const sql = sqlText(q, explicit);
  const shown = (c: Cond) => show(c, explicit);
  return choice(
    rand,
    {
      id: makeId("complex", t, sql, seed),
      level,
      prompt: countPrompt(sql),
      scene: tableScene(t),
      reveal: tableScene(t, idx),
      hint: {
        ru: "Расставь мысленно скобки по приоритету: NOT и скобки — первыми, затем AND, затем OR. Потом проверяй записи по очереди.",
        kk: "Жақшаларды басымдық бойынша ойша қой: алдымен NOT және жақшалар, содан кейін AND, одан кейін OR. Содан соң жазбаларды кезекпен тексер.",
      },
      explanation: {
        ru: `Условие ${shown(cond)}. ${note.ru} Подходят ${labelList(t, idx).ru} — всего ${idx.length}.`,
        kk: `${shown(cond)} шарты. ${note.kk} ${labelList(t, idx).kk} сәйкес келеді — барлығы ${idx.length}.`,
      },
    },
    String(idx.length),
    wrongs,
    true,
  );
}

/** N-я строка результата: WHERE + ORDER BY (у Students — два ключа). */
function genNth(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const n = pick(rand, [2, 3]);
  const f = randNumField(rand, t);
  const where = pick(rand, [0, 1]) === 0 ? randCmp(rand, t, f, [">", "<", ">=", "<="]) : randBetween(rand, t, f);
  if (!where) return undefined;
  let order: { f: string; desc?: boolean }[];
  if (t.name === "Students") {
    order = [{ f: "Mark", desc: rand() < 0.5 }, { f: "Name", desc: rand() < 0.5 }];
  } else {
    order = [{ f: uniqueKey(rand, t), desc: rand() < 0.5 }];
  }
  const q: Query = { t, fields: [nameField(t)], where, order };
  const idx = selectRows(q);
  if (idx.length < 4) return undefined;
  const sql = sqlText(q);
  const lab = (i: number) => t.labels[idx[i]];
  const outside = t.rows.map((_, i) => i).filter((i) => !idx.includes(i));
  const rev = { ...q, order: order.map((o) => ({ ...o, desc: !o.desc })) };
  const revIdx = selectRows(rev);
  const wrong: Wrong[] = [
    { text: lab(n - 2), why: { ru: `Это строка ${n - 1} результата, а нужна строка ${n}.`, kk: `Бұл нәтиженің ${n - 1}-жолы, ал ${n}-жол керек.` } },
    { text: lab(n), why: { ru: `Это строка ${n + 1} результата, а нужна строка ${n}.`, kk: `Бұл нәтиженің ${n + 1}-жолы, ал ${n}-жол керек.` } },
    { text: t.labels[revIdx[n - 1]], why: { ru: "Порядок сортировки обращён: направление ASC/DESC перепутано.", kk: "Сұрыптау реті керісінше: ASC/DESC бағыты шатастырылған." } },
  ];
  if (outside.length) {
    wrong.push({ text: t.labels[outside[0]], why: { ru: "Эта запись не проходит условие WHERE и в результат не попадает.", kk: "Бұл жазба WHERE шартына сәйкес келмейді және нәтижеге кірмейді." } });
  }
  const res = labelList(t, idx);
  return choice(
    rand,
    {
      id: makeId(`nth${n}`, t, sql, seed),
      level,
      prompt: { ru: `${NTH_Q[t.name](n).ru}: ${sql}`, kk: `${NTH_Q[t.name](n).kk}: ${sql}` },
      scene: tableScene(t),
      reveal: resultScene(q, false),
      hint: HINT_ORDER,
      explanation: {
        ru: `Сначала WHERE отбирает записи, потом ORDER BY их упорядочивает. Результат по порядку: ${res.ru}. Строка ${n} — ${tx(lab(n - 1), "ru")}.`,
        kk: `Алдымен WHERE жазбаларды іріктейді, содан кейін ORDER BY оларды реттейді. Нәтиже ретімен: ${res.kk}. ${n}-жол — ${tx(lab(n - 1), "kk")}.`,
      },
    },
    lab(n - 1),
    shuffle(wrong, rand),
  );
}

/** DISTINCT с условием: сколько разных значений (ввод числа). */
function genDistinct(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, ["Students", "Books"] as TableName[]));
  const f = t.name === "Students" ? pick(rand, ["Class", "Mark"]) : "Year";
  const other = NUMERIC[t.name].find((x) => x !== f) ?? f;
  const cond = randCmp(rand, t, other, [">", "<", ">=", "<="]);
  const q: Query = { t, fields: [f], distinct: true, where: cond };
  const rows = selectRows(q);
  const vals = [...new Set(rows.map((i) => t.rows[i][col(t, f)] as number))];
  if (rows.length === vals.length || vals.length < 2) return undefined;
  const sql = sqlText(q);
  return numberInput(
    {
      id: makeId("distinct", t, sql, seed),
      level,
      prompt: countPrompt(sql),
      scene: tableScene(t),
      hint: {
        ru: "Сначала отбери записи по WHERE и выпиши значения нужного поля. Потом вычеркни повторы: DISTINCT оставляет каждое значение один раз.",
        kk: "Алдымен WHERE бойынша жазбаларды іріктеп, керекті өрістің мәндерін жаз. Содан кейін қайталарын сызып таста: DISTINCT әр мәнді бір реттен қалдырады.",
      },
      explanation: {
        ru: `WHERE оставляет ${rows.length} ${plural(rows.length, "запись", "записи", "записей")}, значения ${f} в них: ${rows.map((i) => t.rows[i][col(t, f)]).join(", ")}. DISTINCT убирает повторы — остаётся ${vals.length}: ${vals.sort((a, b) => a - b).join(", ")}.`,
        kk: `WHERE ${rows.length} жазбаны қалдырады, олардағы ${f} мәндері: ${rows.map((i) => t.rows[i][col(t, f)]).join(", ")}. DISTINCT қайталарын алып тастайды — ${vals.length} мән қалады: ${vals.join(", ")}.`,
      },
    },
    vals.length,
  );
}

type Gen = (rand: Rand, level: Level, seed: number) => QuestionStep | undefined;

const KINDS: Record<Level, Gen[]> = {
  1: [genCountSimple, genFields, genFirst],
  2: [genCountTwo, genBetween, genLike, genIn, genWhich],
  3: [genComplex, genNth, genDistinct],
};

function genQuestion(level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    const q = pick(rand, KINDS[level])(rand, level, seed);
    if (q) return q;
  }
  // Запасной вариант: простой подсчёт (подбираем таблицу, пока не подойдёт).
  for (let k = 0; k < 200; k++) {
    const q = genCountSimple(seeded(seed + k + 1), level, seed);
    if (q) return q;
  }
  throw new Error("db.select: не удалось собрать задание");
}

// ======================================================================
// Утверждения, пары, короткие вопросы
// ======================================================================

const st = (id: string, level: Level, ru: string, kk: string, value: boolean, exRu: string, exKk: string, hint: L): Statement => ({
  id: `s:${SKILL}:${id}`,
  skill: SKILL,
  level,
  text: { ru, kk },
  value,
  explanation: { ru: exRu, kk: exKk },
  hint,
});

const STATEMENTS: Statement[] = [
  st("between-edges", 1, "Условие Price BETWEEN 50 AND 150 выбирает и записи с ценой 50, и записи с ценой 150.", "Price BETWEEN 50 AND 150 шарты бағасы 50 жазбаларды да, бағасы 150 жазбаларды да таңдайды.", true,
    "BETWEEN включает обе границы: это то же, что Price >= 50 AND Price <= 150.", "BETWEEN екі шекті де қамтиды: бұл Price >= 50 AND Price <= 150 дегенмен бірдей.",
    { ru: "Вспомни, входят ли в диапазон его концы.", kk: "Аралықтың шеттері кіретінін еске түсір." }),
  st("star", 1, "SELECT * FROM Students; выводит все поля таблицы Students.", "SELECT * FROM Students; сұранысы Students кестесінің барлық өрісін шығарады.", true,
    "Звёздочка вместо списка полей означает «все поля».", "Өрістер тізімінің орнындағы жұлдызша «барлық өріс» дегенді білдіреді.",
    { ru: "Что обозначает знак * после SELECT?", kk: "SELECT-тен кейінгі * белгісі нені білдіреді?" }),
  st("where-role", 1, "Слово WHERE в запросе задаёт порядок сортировки записей.", "Сұраныстағы WHERE сөзі жазбаларды сұрыптау ретін береді.", false,
    "WHERE задаёт условие отбора записей, а порядок задаёт ORDER BY.", "WHERE жазбаларды іріктеу шартын береді, ал ретті ORDER BY береді.",
    { ru: "Одно слово отбирает записи, другое — упорядочивает. Какое что делает?", kk: "Бір сөз жазбаларды іріктейді, екіншісі реттейді. Қайсысы не істейді?" }),
  st("eq-sign", 1, "В условии SQL «равно» записывают двойным знаком ==, как в Python.", "SQL шартында «тең» Python-дағыдай қос == белгісімен жазылады.", false,
    "В SQL «равно» — один знак =, а «не равно» — <>.", "SQL-де «тең» — бір = белгісі, ал «тең емес» — <>.",
    { ru: "Сравни запись Class = 10 с условием в Python: там знак сравнения двойной.", kk: "Class = 10 жазбасын Python-дағы шартпен салыстыр: онда салыстыру белгісі қос." }),
  st("text-quotes", 1, "Текстовое значение в условии записывают в одинарных кавычках: Name = 'Дана'.", "Шарттағы мәтіндік мән бір тырнақшада жазылады: Name = 'Дана'.", true,
    "Текст в SQL берут в одинарные кавычки, числа — без кавычек.", "SQL-де мәтін бір тырнақшаға алынады, сандар — тырнақшасыз.",
    { ru: "Как в SQL отличают текст от числа?", kk: "SQL-де мәтінді саннан қалай ажыратады?" }),
  st("orderby-default", 1, "Если в ORDER BY не указано направление, записи сортируются по возрастанию (ASC).", "ORDER BY-да бағыт көрсетілмесе, жазбалар өсу бойынша (ASC) сұрыпталады.", true,
    "ASC — направление по умолчанию; для убывания нужно написать DESC.", "ASC — әдепкі бағыт; кему үшін DESC жазу керек.",
    { ru: "Что будет, если после поля сортировки ничего не написать?", kk: "Сұрыптау өрісінен кейін ештеңе жазбаса, не болады?" }),
  st("and-or", 2, "Условие Class = 9 AND Class = 11 выбирает учеников 9 и 11 классов.", "Class = 9 AND Class = 11 шарты 9 және 11-сынып оқушыларын таңдайды.", false,
    "AND требует обоих условий для одной записи, а класс у ученика один — результат пустой. Нужно OR или IN.", "AND бір жазба үшін екі шартты да талап етеді, ал оқушының сыныбы біреу — нәтиже бос. OR немесе IN керек.",
    { ru: "Может ли у одной записи быть два значения поля Class?", kk: "Бір жазбада Class өрісінің екі мәні бола ала ма?" }),
  st("in-or", 2, "Условие Qty IN (10, 15) равносильно Qty = 10 OR Qty = 15.", "Qty IN (10, 15) шарты Qty = 10 OR Qty = 15 шартымен пара-пар.", true,
    "IN выбирает записи, у которых значение равно одному из списка.", "IN мәні тізімдегінің біріне тең жазбаларды таңдайды.",
    { ru: "Какое слово подходит к «одному из списка» — AND или OR?", kk: "«Тізімдегінің бірі» дегенге қайсысы сәйкес — AND әлде OR?" }),
  st("like-percent", 2, "Шаблон LIKE 'А%' выбирает имена, которые начинаются на А.", "LIKE 'А%' үлгісі А әрпінен басталатын есімдерді таңдайды.", true,
    "% заменяет любое число символов после А, поэтому подходят и Айдар, и Алия.", "% А әрпінен кейінгі кез келген сандағы таңбаларды алмастырады, сондықтан Айдар да, Алия да сәйкес келеді.",
    { ru: "Что означает знак % в шаблоне?", kk: "Үлгідегі % белгісі нені білдіреді?" }),
  st("like-underscore", 2, "Шаблон LIKE '_а%' выбирает имена, у которых первая буква а.", "LIKE '_а%' үлгісі бірінші әрпі а болатын есімдерді таңдайды.", false,
    "Знак _ заменяет ровно один символ, поэтому буква а должна быть второй.", "_ белгісі дәл бір таңбаны алмастырады, сондықтан а әрпі екінші болуы керек.",
    { ru: "Что стоит перед буквой а в этом шаблоне?", kk: "Бұл үлгіде а әрпінің алдында не тұр?" }),
  st("distinct", 2, "SELECT DISTINCT Class FROM Students; выводит значение поля Class один раз, даже если оно встречается у многих учеников.", "SELECT DISTINCT Class FROM Students; сұранысы Class өрісінің мәнін көп оқушыда кездессе де, бір рет шығарады.", true,
    "DISTINCT убирает повторяющиеся строки результата.", "DISTINCT нәтиженің қайталанатын жолдарын алып тастайды.",
    { ru: "Что делает слово DISTINCT с повторами?", kk: "DISTINCT сөзі қайталауларға не істейді?" }),
  st("order-before-where", 2, "В запросе часть ORDER BY пишется раньше WHERE.", "Сұраныста ORDER BY бөлігі WHERE бөлігінен бұрын жазылады.", false,
    "Порядок частей строгий: SELECT, FROM, WHERE, ORDER BY.", "Бөліктер реті қатаң: SELECT, FROM, WHERE, ORDER BY.",
    { ru: "Вспомни порядок: что, откуда, какие записи, в каком порядке.", kk: "Ретін еске түсір: не, қайдан, қандай жазбалар, қандай ретпен." }),
  st("priority", 3, "В условии A OR B AND C сначала выполняется OR, потому что он записан раньше.", "A OR B AND C шартында алдымен OR орындалады, өйткені ол бұрын жазылған.", false,
    "AND сильнее OR и выполняется первым: условие читается как A OR (B AND C).", "AND OR-дан күштірек және бірінші орындалады: шарт A OR (B AND C) түрінде оқылады.",
    { ru: "Какая операция сильнее: AND или OR?", kk: "Қай операция күштірек: AND әлде OR?" }),
  st("not-or", 3, "Условие NOT (A OR B) равносильно (NOT A) AND (NOT B).", "NOT (A OR B) шарты (NOT A) AND (NOT B) шартымен пара-пар.", true,
    "Это закон де Моргана: отрицание OR превращается в AND отрицаний.", "Бұл де Морган заңы: OR-ды терістегенде, ол терістеулердің AND-іне айналады.",
    { ru: "Проверь на таблице истинности для A и B.", kk: "A және B үшін ақиқат кестесінде тексер." }),
  st("between-not-in-order", 3, "Условие Mark BETWEEN 5 AND 3 выберет оценки 3, 4 и 5.", "Mark BETWEEN 5 AND 3 шарты 3, 4 және 5 бағаларын таңдайды.", false,
    "В BETWEEN сначала идёт меньшее значение. Для Mark BETWEEN 5 AND 3 не найдётся ни одного числа, которое не меньше 5 и не больше 3.", "BETWEEN-де алдымен кіші мән тұрады. Mark BETWEEN 5 AND 3 үшін 5-тен кем емес және 3-тен артық емес бірде-бір сан табылмайды.",
    { ru: "Запиши условие через >= и <= и проверь, бывает ли такое число.", kk: "Шартты >= және <= арқылы жазып, мұндай сан бола ала ма тексер." }),
];

const pr = (id: string, level: Level, left: Text, right: Text): Pair => ({ id: `p:${SKILL}:${id}`, skill: SKILL, level, left, right });

const PAIRS: Pair[] = [
  pr("select", 1, "SELECT", g("какие поля показать", "қандай өрістерді көрсету")),
  pr("from", 1, "FROM", g("из какой таблицы брать данные", "деректерді қай кестеден алу")),
  pr("where", 1, "WHERE", g("условие отбора записей", "жазбаларды іріктеу шарты")),
  pr("orderby", 1, "ORDER BY", g("порядок записей в результате", "нәтижедегі жазбалар реті")),
  pr("desc", 1, "DESC", g("по убыванию", "кему бойынша")),
  pr("asc", 1, "ASC", g("по возрастанию", "өсу бойынша")),
  pr("distinct", 2, "DISTINCT", g("убирает повторяющиеся значения", "қайталанатын мәндерді алып тастайды")),
  pr("between", 2, "BETWEEN a AND b", g("от a до b, границы входят", "a мен b аралығы, шектері кіреді")),
  pr("in", 2, "IN (1, 2, 3)", g("значение из списка", "тізімдегі мән")),
  pr("like", 2, "LIKE", g("поиск по шаблону в тексте", "мәтінді үлгі бойынша іздеу")),
  pr("percent", 2, "%", g("любое число символов", "кез келген сандағы таңбалар")),
  pr("underscore", 2, "_", g("ровно один символ", "дәл бір таңба")),
  pr("star", 1, "SELECT *", g("все поля таблицы", "кестенің барлық өрісі")),
  pr("neq", 1, "<>", g("не равно", "тең емес")),
  pr("and", 2, "AND", g("верны оба условия", "екі шарт та орындалады")),
  pr("or", 2, "OR", g("верно хотя бы одно условие", "кемінде бір шарт орындалады")),
  pr("not", 3, "NOT", g("отрицание условия", "шартты терістеу")),
];

const sq = (id: string, level: Level, ru: string, kk: string, answer: string, mode: "number" | "text", exRu: string, exKk: string, hint: L): ShortQuestion => ({
  id: `q:${SKILL}:${id}`,
  skill: SKILL,
  level,
  prompt: { ru, kk },
  answer,
  mode,
  explanation: { ru: exRu, kk: exKk },
  hint,
});

const SHORTS: ShortQuestion[] = [
  sq("kw-where", 1, "Какое ключевое слово задаёт условие отбора записей?", "Жазбаларды іріктеу шартын қандай кілт сөз береді?", "WHERE", "text", "Условие отбора пишут после слова WHERE.", "Іріктеу шартын WHERE сөзінен кейін жазады.", { ru: "Слово по-английски значит «где».", kk: "Бұл сөз ағылшынша «қайда» дегенді білдіреді." }),
  sq("kw-star", 1, "Какой знак после SELECT выводит все поля таблицы?", "SELECT-тен кейінгі қандай белгі кестенің барлық өрісін шығарады?", "*", "text", "Звёздочка заменяет список всех полей.", "Жұлдызша барлық өрістер тізімін алмастырады.", { ru: "Этот знак ещё называют «звёздочка».", kk: "Бұл белгіні «жұлдызша» деп те атайды." }),
  sq("kw-distinct", 1, "Какое слово после SELECT убирает повторяющиеся значения?", "SELECT-тен кейінгі қандай сөз қайталанатын мәндерді алып тастайды?", "DISTINCT", "text", "DISTINCT оставляет каждое значение один раз.", "DISTINCT әр мәнді бір реттен қалдырады.", { ru: "Английское слово означает «различный, отдельный».", kk: "Ағылшын сөзі «әртүрлі, бөлек» дегенді білдіреді." }),
  sq("kw-orderby", 1, "Какие слова задают сортировку записей?", "Жазбаларды сұрыптауды қандай сөздер береді?", "ORDER BY", "text", "Сортировка задаётся словами ORDER BY.", "Сұрыптауды ORDER BY сөздері береді.", { ru: "По-английски: «порядок по».", kk: "Ағылшынша: «... бойынша реті»." }),
  sq("kw-desc", 1, "Какое слово после ORDER BY задаёт порядок по убыванию?", "ORDER BY-дан кейінгі қандай сөз кему бойынша ретті береді?", "DESC", "text", "DESC — по убыванию, ASC — по возрастанию.", "DESC — кему бойынша, ASC — өсу бойынша.", { ru: "Слово происходит от английского descending.", kk: "Сөз ағылшынша descending сөзінен шыққан." }),
  sq("kw-between", 2, "Какое слово задаёт диапазон «от … до …» с границами?", "«…-ден …-ге дейін» аралығын шектерімен қоса қандай сөз береді?", "BETWEEN", "text", "BETWEEN a AND b выбирает значения от a до b включительно.", "BETWEEN a AND b мәндерді a мен b аралығында шектерін қоса таңдайды.", { ru: "По-английски «между».", kk: "Ағылшынша «арасында»." }),
  sq("kw-percent", 2, "Какой знак в шаблоне LIKE заменяет любое число символов?", "LIKE үлгісіндегі қандай белгі кез келген сандағы таңбаларды алмастырады?", "%", "text", "Знак % заменяет любое число символов, в том числе ни одного.", "% белгісі кез келген сандағы таңбаларды алмастырады, тіпті бірде-бір таңба болмауы да мүмкін.", { ru: "Этот знак ещё означает проценты.", kk: "Бұл белгі пайызды да білдіреді." }),
  sq("kw-underscore", 2, "Какой знак в шаблоне LIKE заменяет ровно один символ?", "LIKE үлгісіндегі қандай белгі дәл бір таңбаны алмастырады?", "_", "text", "Знак _ (подчёркивание) заменяет ровно один символ.", "_ (асты сызу) белгісі дәл бір таңбаны алмастырады.", { ru: "Этот знак похож на линию внизу строки.", kk: "Бұл белгі жолдың астындағы сызыққа ұқсайды." }),
];

function shortGenerated(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  const a = int(rand, 2, 12);
  const w = int(rand, 3, 9);
  const b = a + w;
  if (level === 1) {
    return sq(`between-${a}-${b}`, 1,
      `Сколько целых чисел x удовлетворяют условию: x BETWEEN ${a} AND ${b}`,
      `x BETWEEN ${a} AND ${b} шартын қанша бүтін x саны қанағаттандырады`,
      String(w + 1), "number",
      `BETWEEN включает границы: x от ${a} до ${b}, всего ${b} − ${a} + 1 = ${w + 1} ${plural(w + 1, "число", "числа", "чисел")}.`,
      `BETWEEN шектерді қамтиды: ${a} ≤ x ≤ ${b}, барлығы ${b} − ${a} + 1 = ${w + 1} сан.`,
      { ru: "Границы входят в диапазон. Выпиши числа от меньшей границы до большей и посчитай.", kk: "Шектер аралыққа кіреді. Кіші шектен үлкен шекке дейінгі сандарды жазып, санап шық." });
  }
  if (level === 2) {
    const strict = rand() < 0.5;
    return sq(`range-${a}-${b}-${strict ? "s" : "h"}`, 2,
      strict
        ? `Сколько целых чисел x удовлетворяют условию: x > ${a} AND x < ${b}`
        : `Сколько целых чисел x удовлетворяют условию: x > ${a} AND x <= ${b}`,
      strict
        ? `x > ${a} AND x < ${b} шартын қанша бүтін x саны қанағаттандырады`
        : `x > ${a} AND x <= ${b} шартын қанша бүтін x саны қанағаттандырады`,
      String(strict ? w - 1 : w), "number",
      strict
        ? `Обе границы не входят: от ${a + 1} до ${b - 1}, всего ${w - 1} ${plural(w - 1, "число", "числа", "чисел")}.`
        : `Нижняя граница не входит, верхняя входит: от ${a + 1} до ${b}, всего ${w} ${plural(w, "число", "числа", "чисел")}.`,
      strict
        ? `Екі шек те кірмейді: ${a + 1} ≤ x ≤ ${b - 1}, барлығы ${w - 1} сан.`
        : `Төменгі шек кірмейді, жоғарғысы кіреді: ${a + 1} ≤ x ≤ ${b}, барлығы ${w} сан.`,
      { ru: "Знаки > и < не включают границу, а >= и <= включают.", kk: "> және < белгілері шекті қамтымайды, ал >= және <= қамтиды." });
  }
  const n = b + int(rand, 2, 6);
  return sq(`notbetween-${a}-${b}-${n}`, 3,
    `Целые числа x лежат в пределах от 1 до ${n}. Сколько из них удовлетворяют условию: x NOT BETWEEN ${a} AND ${b}`,
    `1 ≤ x ≤ ${n} аралығындағы бүтін x сандарының қаншасы x NOT BETWEEN ${a} AND ${b} шартын қанағаттандырады`,
    String(n - (w + 1)), "number",
    `Внутри BETWEEN ${a} AND ${b} (границы входят) ${w + 1} ${plural(w + 1, "число", "числа", "чисел")}, NOT берёт остальные: ${n} − ${w + 1} = ${n - (w + 1)}.`,
    `BETWEEN ${a} AND ${b} ішінде (шектер кіреді) ${w + 1} сан бар, NOT қалғандарын алады: ${n} − ${w + 1} = ${n - (w + 1)}.`,
    { ru: "Сначала посчитай числа внутри BETWEEN вместе с границами, затем вычти из общего количества.", kk: "Алдымен BETWEEN ішіндегі сандарды шектерімен қоса санап, содан кейін жалпы саннан алып таста." });
}

function byLevel<T extends { level: Level }>(items: T[], level: Level): T[] {
  for (const d of [0, -1, 1, -2, 2]) {
    const found = items.filter((x) => x.level === level + d);
    if (found.length) return found;
  }
  return items;
}

const selectBank: SkillBank = {
  skill: SKILL,
  question: (level, seed) => genQuestion(level, seed),
  statement(level, seed) {
    const pool = byLevel(STATEMENTS, level);
    return pool[Math.floor(seeded(seed)() * pool.length)];
  },
  pair(level, seed) {
    const pool = byLevel(PAIRS, level);
    return pool[Math.floor(seeded(seed)() * pool.length)];
  },
  short(level, seed) {
    const rand = seeded(seed);
    // Половина коротких вопросов — вычисляемые (диапазоны BETWEEN), половина — на термины.
    if (rand() < 0.5) return shortGenerated(level, seed);
    const pool = byLevel(SHORTS, level);
    return pool[Math.floor(rand() * pool.length)];
  },
};

export const BANKS: SkillBank[] = [selectBank];
