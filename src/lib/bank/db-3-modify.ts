import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene, Text } from "../types";
import { hashString, seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка db.modify («Изменение данных и итоги»). Расчётная тема: таблицу и запросы строит код,
// а правильный ответ (сколько записей останется, что вернёт COUNT/SUM/AVG/MIN/MAX, значение после UPDATE,
// число групп GROUP BY) вычисляет мини-интерпретатор ниже — он повторяет семантику SQL
// (проверено сверкой с python3 + sqlite3 в scripts/out/db-3-modify).
// Неверные варианты — типичные ошибки: перепутан порядок значений в VALUES, AND вместо OR, пропущен WHERE,
// перепутана итоговая функция, не учтён UPDATE, не учтён GROUP BY.
// Названия товаров — двуязычные ячейки, поэтому условия на них в запросах не строятся.
// Тексты после переменных чисел — без падежных окончаний (в казахском окончание зависит от числа).

const SKILL = "db.modify";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

// ======================================================================
// Таблицы
// ======================================================================

type Val = string | number;
type TableName = "Students" | "Goods";

interface Table {
  name: TableName;
  cols: string[];
  rows: Val[][];
  /** Подписи записей в столбце-названии (у Goods — двуязычные). */
  labels: Text[];
  nameCol: number;
}

const NUMERIC: Record<TableName, string[]> = {
  Students: ["Class", "Mark"],
  Goods: ["Price", "Qty"],
};
const TABLE_KINDS: TableName[] = ["Students", "Goods"];

const NAMES = ["Айдар", "Алия", "Арман", "Асель", "Берик", "Дана", "Данияр", "Ерлан", "Жанар", "Мадина", "Нурлан", "Сауле"];
/** Имена для новых учеников (INSERT) — не пересекаются с NAMES. */
const NEW_NAMES = ["Тимур", "Камила", "Руслан", "Томирис", "Аружан", "Санжар", "Малика", "Динара"];
const g = (ru: string, kk: string): L => ({ ru, kk });

/** Русское согласование с числом: 1 запись, 2 записи, 5 записей. */
function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a >= 11 && a <= 14) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
/** «2 записи» (им./вин. падеж). */
const recs = (n: number) => `${n} ${plural(n, "запись", "записи", "записей")}`;
/** «Под условие … подходят 2 записи» — глагол и существительное согласованы с числом. */
const fitsRu = (cond: string, n: number) => `Под условие ${cond} ${plural(n, "подходит", "подходят", "подходят")} ${recs(n)}`;
const rowsRu = (n: number) => `${n} ${plural(n, "строка", "строки", "строк")}`;

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
const PRICES = [40, 50, 60, 80, 90, 100, 120, 150, 200, 300, 500, 700];
const QTYS = [4, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100];

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
  const labels = shuffle(GOODS_POOL, rand).slice(0, 7);
  const prices = shuffle(PRICES, rand).slice(0, 7);
  const qtys = shuffle(QTYS, rand).slice(0, 7);
  const rows: Val[][] = labels.map((l, i) => [l.ru, prices[i], qtys[i]]);
  return { name, cols: ["Name", "Price", "Qty"], rows, labels, nameCol: 0 };
}

const col = (t: Table, f: string) => t.cols.indexOf(f);
const num = (t: Table, row: Val[], f: string) => row[col(t, f)] as number;
const valuesOf = (t: Table, f: string): number[] => [...new Set(t.rows.map((r) => num(t, r, f)))].sort((a, b) => a - b);

/** Сцена-таблица; rows — другое состояние (после UPDATE/DELETE), labels — подписи к этим строкам. */
function tableScene(t: Table, highlight?: number[], rows: Val[][] = t.rows, labels: Text[] = t.labels): Scene {
  return {
    kind: "table",
    columns: t.cols,
    rows: rows.map((r, i) => r.map((v, c) => (c === t.nameCol ? labels[i] : String(v)))),
    highlightRows: highlight && highlight.length ? highlight : undefined,
  };
}

// ======================================================================
// Условия и интерпретатор
// ======================================================================

type CmpOp = "=" | "<>" | ">" | "<" | ">=" | "<=";
type Cond =
  | { t: "cmp"; f: string; op: CmpOp; v: number }
  | { t: "between"; f: string; a: number; b: number }
  | { t: "and" | "or"; a: Cond; b: Cond };

const cmp = (f: string, op: CmpOp, v: number): Cond => ({ t: "cmp", f, op, v });
const and = (a: Cond, b: Cond): Cond => ({ t: "and", a, b });
const or = (a: Cond, b: Cond): Cond => ({ t: "or", a, b });

function show(c: Cond): string {
  switch (c.t) {
    case "cmp":
      return `${c.f} ${c.op} ${c.v}`;
    case "between":
      return `${c.f} BETWEEN ${c.a} AND ${c.b}`;
    case "and":
    case "or":
      return `${show(c.a)} ${c.t === "and" ? "AND" : "OR"} ${show(c.b)}`;
  }
}

function test(t: Table, row: Val[], c: Cond): boolean {
  switch (c.t) {
    case "cmp": {
      const x = num(t, row, c.f);
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
      return num(t, row, c.f) >= c.a && num(t, row, c.f) <= c.b;
    case "and":
      return test(t, row, c.a) && test(t, row, c.b);
    case "or":
      return test(t, row, c.a) || test(t, row, c.b);
  }
}

/** Номера строк, подходящих под условие (без условия — все). */
const matching = (t: Table, where?: Cond): number[] => t.rows.map((_, i) => i).filter((i) => !where || test(t, t.rows[i], where));

type Fn = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
const FNS: Fn[] = ["COUNT", "SUM", "AVG", "MIN", "MAX"];
const fnCall = (fn: Fn, f: string) => (fn === "COUNT" ? "COUNT(*)" : `${fn}(${f})`);

const FN_DESC: Record<Fn, L> = {
  COUNT: g("число записей", "жазбалар саны"),
  SUM: g("сумма значений", "мәндер қосындысы"),
  AVG: g("среднее значение", "орташа мән"),
  MIN: g("наименьшее значение", "ең кіші мән"),
  MAX: g("наибольшее значение", "ең үлкен мән"),
};

/** Итоговая функция по списку чисел (список непустой). */
function aggregate(fn: Fn, vals: number[]): number {
  switch (fn) {
    case "COUNT":
      return vals.length;
    case "SUM":
      return vals.reduce((a, b) => a + b, 0);
    case "AVG":
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    case "MIN":
      return Math.min(...vals);
    case "MAX":
      return Math.max(...vals);
  }
}

const roundNum = (x: number) => Math.round(x * 100) / 100;
/** Число для ответа: до двух знаков, без хвоста нулей. */
const fmt = (x: number) => String(roundNum(x));
/** Среднее «красивое»: не больше двух знаков после запятой. */
const isNice = (x: number) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-9;

/** Итог по записям: значения поля f у выбранных строк. */
function aggOver(t: Table, idx: number[], fn: Fn, f: string): number {
  return aggregate(fn, idx.map((i) => num(t, t.rows[i], f)));
}

/** Состояние таблицы после UPDATE: у подходящих записей поле f получает значение v. */
function applyUpdate(t: Table, f: string, v: number, where?: Cond): Table {
  const idx = new Set(matching(t, where));
  const c = col(t, f);
  return { ...t, rows: t.rows.map((r, i) => (idx.has(i) ? r.map((x, k) => (k === c ? v : x)) : r)) };
}

/** Состояние таблицы после DELETE: подходящие записи удалены. */
function applyDelete(t: Table, where?: Cond): Table {
  const del = new Set(matching(t, where));
  const keep = t.rows.map((_, i) => i).filter((i) => !del.has(i));
  return { ...t, rows: keep.map((i) => t.rows[i]), labels: keep.map((i) => t.labels[i]) };
}

// ---------- Случайные условия ----------

function randNumField(rand: Rand, t: Table, not?: string): string {
  return pick(rand, NUMERIC[t.name].filter((f) => f !== not));
}

function randCmp(rand: Rand, t: Table, field?: string, ops?: CmpOp[]): Cond {
  const f = field ?? randNumField(rand, t);
  return cmp(f, pick(rand, ops ?? ([">", "<", ">=", "<=", "=", "<>"] as CmpOp[])), pick(rand, valuesOf(t, f)));
}

/** Простое условие вида «поле знак значение»; = и <> реже, чтобы было что считать. */
const SIMPLE_OPS: CmpOp[] = [">", "<", ">=", "<=", "=", "<>", ">", "<"];

function randTwo(rand: Rand, t: Table): Cond {
  const f1 = randNumField(rand, t);
  const f2 = randNumField(rand, t, f1);
  const c1 = randCmp(rand, t, f1);
  const c2 = randCmp(rand, t, f2);
  return rand() < 0.5 ? and(c1, c2) : or(c1, c2);
}

// ---------- Типичные ошибки: «мутанты» условия ----------

interface Mut {
  cond: Cond;
  why: L;
}

const WHY_AND_OR: L = {
  ru: "Перепутаны AND и OR: AND требует оба условия сразу, OR — хотя бы одно.",
  kk: "AND және OR шатастырылған: AND екі шартты бірдей, OR кемінде біреуін талап етеді.",
};

function mutants(c: Cond): Mut[] {
  switch (c.t) {
    case "cmp": {
      const flip: Partial<Record<CmpOp, CmpOp>> = { ">": ">=", ">=": ">", "<": "<=", "<=": "<" };
      const op2 = flip[c.op];
      if (!op2) return [];
      const incl = op2.includes("=");
      return [
        {
          cond: { ...c, op: op2 },
          why: {
            ru: `Это ответ для знака ${op2} вместо ${c.op}: граничное значение ${incl ? "включается" : "не включается"}, а в запросе — наоборот.`,
            kk: `Бұл ${c.op} орнына ${op2} белгісі қойылғандағы жауап: шектік мән ${incl ? "қосылады" : "қосылмайды"}, ал сұраныста — керісінше.`,
          },
        },
      ];
    }
    case "between":
      return [];
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

/** Дробный ответ: режим text, оба написания — с точкой и запятой. */
function decimalInput(base: Base, answer: number): InputStep {
  const s = fmt(answer);
  const answers = s.includes(".") ? [s, s.replace(".", ",")] : [s];
  return { type: "input", skill: SKILL, ...base, answers, mode: "text" };
}

/** Идентификатор по содержанию: вид задания + хэш таблицы и запроса (повторов в выдаче не будет). */
function makeId(kind: string, t: Table, extra: string, seed: number): string {
  return `g:${SKILL}:${kind}:${hashString(JSON.stringify(t.rows) + extra).toString(36)}:${seed}`;
}

const T_RU: Record<TableName, string> = { Students: "Students", Goods: "Goods" };

const listOf = (t: Table, idx: number[]): L => ({
  ru: idx.map((i) => (typeof t.labels[i] === "string" ? t.labels[i] : (t.labels[i] as L).ru)).join(", "),
  kk: idx.map((i) => (typeof t.labels[i] === "string" ? t.labels[i] : (t.labels[i] as L).kk)).join(", "),
});

// ---------- Уровень 1 ----------

/** Какой INSERT добавит запись (Students): порядок значений = порядок полей. */
function genInsertWhich(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, "Students");
  const used = new Set(t.rows.map((r) => String(r[1])));
  const free = NEW_NAMES.filter((n) => !used.has(n));
  const name = pick(rand, free);
  const id = t.rows.length + 1;
  const cls = pick(rand, [9, 10, 11]);
  const mark = pick(rand, [3, 4, 5].filter((m) => m !== cls));
  const head = "INSERT INTO Students (ID, Name, Class, Mark)";
  const right = `${head} VALUES (${id}, '${name}', ${cls}, ${mark});`;
  const wrong: Wrong[] = [
    {
      text: `${head} VALUES ('${name}', ${id}, ${cls}, ${mark});`,
      why: { ru: `Значения стоят не в порядке полей: имя попадает в ID, а ${id} — в Name.`, kk: `Мәндер өрістер ретімен тұрған жоқ: есім ID-ге, ал ${id} Name-ге түседі.` },
    },
    {
      text: `${head} VALUES (${id}, '${name}', ${mark}, ${cls});`,
      why: { ru: `Последние два значения поменяны местами: класс ${mark}, оценка ${cls}.`, kk: `Соңғы екі мәннің орны ауыстырылған: сынып ${mark}, баға ${cls}.` },
    },
    {
      text: `UPDATE Students SET Name = '${name}' WHERE ID = ${id};`,
      why: { ru: `UPDATE не добавляет записи, а меняет существующие. Записи с ID = ${id} нет, поэтому ничего не изменится.`, kk: `UPDATE жазба қоспайды, бар жазбаларды өзгертеді. ID = ${id} жазбасы жоқ, сондықтан ештеңе өзгермейді.` },
    },
    {
      text: `${head} VALUES (${id}, '${name}', ${cls});`,
      why: { ru: "Значений три, а полей четыре: не хватает оценки, запрос вызовет ошибку.", kk: "Мәндер үшеу, ал өрістер төртеу: баға жетіспейді, сұраныс қате береді." },
    },
  ];
  return choice(
    rand,
    {
      id: makeId("insert", t, `${name},${id},${cls},${mark}`, seed),
      level,
      prompt: {
        ru: `Какой запрос добавит в таблицу Students ученика: ID ${id}, имя ${name}, класс ${cls}, оценка ${mark}?`,
        kk: `Қай сұраныс Students кестесіне оқушыны қосады: ID ${id}, аты ${name}, сыныбы ${cls}, бағасы ${mark}?`,
      },
      scene: tableScene(t),
      hint: {
        ru: "Ищи команду, которая именно добавляет запись. Потом сверь порядок: каждое значение должно подходить полю, стоящему на том же месте в списке полей.",
        kk: "Жазбаны дәл қосатын команданы ізде. Содан кейін ретін тексер: әр мән өрістер тізіміндегі сол орында тұрған өріске сәйкес келуі керек.",
      },
      explanation: {
        ru: `Новую запись добавляет INSERT INTO. Значения идут в порядке полей: ID = ${id}, Name = '${name}', Class = ${cls}, Mark = ${mark}. Остальные варианты: значения в другом порядке, UPDATE вместо INSERT или неполный список значений.`,
        kk: `Жаңа жазбаны INSERT INTO қосады. Мәндер өрістер ретімен жазылады: ID = ${id}, Name = '${name}', Class = ${cls}, Mark = ${mark}. Қалған нұсқалар: мәндер басқа ретпен, INSERT орнына UPDATE немесе мәндер тізімі толық емес.`,
      },
    },
    right,
    shuffle(wrong, rand),
  );
}

/** Сколько записей останется после DELETE с простым условием (ввод числа). */
function genDeleteSimple(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const cond = randCmp(rand, t, undefined, SIMPLE_OPS);
  const del = matching(t, cond);
  if (del.length < 1 || del.length > t.rows.length - 2) return undefined;
  const sql = `DELETE FROM ${t.name} WHERE ${show(cond)};`;
  const left = t.rows.length - del.length;
  const after = applyDelete(t, cond);
  return numberInput(
    {
      id: makeId("del-simple", t, sql, seed),
      level,
      prompt: {
        ru: `Сколько записей останется в таблице ${T_RU[t.name]} после запроса: ${sql}`,
        kk: `Мына сұраныстан кейін ${T_RU[t.name]} кестесінде неше жазба қалады: ${sql}`,
      },
      scene: tableScene(t),
      reveal: tableScene(after),
      hint: {
        ru: "DELETE удаляет записи, подходящие под WHERE. Посчитай, сколько записей удаляется, и вычти из общего числа.",
        kk: "DELETE WHERE-ге сәйкес жазбаларды жояды. Неше жазба жойылатынын санап, жалпы саннан алып таста.",
      },
      explanation: {
        ru: `${fitsRu(show(cond), del.length)}: ${listOf(t, del).ru}. Они удаляются. Осталось ${t.rows.length} − ${del.length} = ${left}.`,
        kk: `${show(cond)} шарты ${del.length} жазбаға сәйкес келеді: ${listOf(t, del).kk}. Олар жойылады. Қалғаны ${t.rows.length} − ${del.length} = ${left}.`,
      },
    },
    left,
  );
}

/** Простой итог без дробей: COUNT/SUM/MIN/MAX с WHERE или без (ввод числа). */
function genAggSimple(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const fn = pick(rand, ["COUNT", "SUM", "MIN", "MAX"] as Fn[]);
  const f = randNumField(rand, t);
  const useWhere = rand() < 0.7;
  const cond = useWhere ? randCmp(rand, t, randNumField(rand, t), SIMPLE_OPS) : undefined;
  const idx = matching(t, cond);
  if (idx.length < 2 || (useWhere && idx.length > t.rows.length - 1)) return undefined;
  const sql = `SELECT ${fnCall(fn, f)} FROM ${t.name}${cond ? ` WHERE ${show(cond)}` : ""};`;
  const answer = aggOver(t, idx, fn, f);
  const vals = idx.map((i) => num(t, t.rows[i], f));
  const listTxt = vals.join(", ");
  const how: L =
    fn === "COUNT"
      ? { ru: `записей ${idx.length}`, kk: `жазба ${idx.length}` }
      : fn === "SUM"
        ? { ru: `${vals.join(" + ")} = ${answer}`, kk: `${vals.join(" + ")} = ${answer}` }
        : fn === "MIN"
          ? { ru: `наименьшее из них — ${answer}`, kk: `олардың ең кішісі — ${answer}` }
          : { ru: `наибольшее из них — ${answer}`, kk: `олардың ең үлкені — ${answer}` };
  return numberInput(
    {
      id: makeId("agg-simple", t, sql, seed),
      level,
      prompt: { ru: `Что вернёт запрос: ${sql}`, kk: `Сұраныс не қайтарады: ${sql}` },
      scene: tableScene(t),
      reveal: tableScene(t, idx),
      hint: {
        ru: cond
          ? "Сначала WHERE: отметь подходящие записи. Потом примени итоговую функцию только к ним."
          : "Итоговая функция просматривает все записи таблицы и возвращает одно значение.",
        kk: cond
          ? "Алдымен WHERE: сәйкес жазбаларды белгіле. Содан кейін қорытынды функцияны тек соларға қолдан."
          : "Қорытынды функция кестенің барлық жазбасын қарап шығып, бір мән қайтарады.",
      },
      explanation: {
        ru: `${cond ? `WHERE ${show(cond)} оставляет ${recs(idx.length)}` : `Берутся все ${recs(idx.length)}`}${fn === "COUNT" ? "" : `, значения ${f}: ${listTxt}`}. ${fnCall(fn, f)} — ${FN_DESC[fn].ru}: ${how.ru}.`,
        kk: `${cond ? `WHERE ${show(cond)} ${idx.length} жазбаны қалдырады` : `Барлық ${idx.length} жазба алынады`}${fn === "COUNT" ? "" : `, ${f} мәндері: ${listTxt}`}. ${fnCall(fn, f)} — ${FN_DESC[fn].kk}: ${how.kk}.`,
      },
    },
    answer,
  );
}

const FN_GOAL: Record<Fn, (f: string, t: TableName) => L> = {
  COUNT: (_f, t) => ({ ru: `число записей в таблице ${t}`, kk: `${t} кестесіндегі жазбалар санын` }),
  SUM: (f) => ({ ru: `сумму значений поля ${f}`, kk: `${f} өрісі мәндерінің қосындысын` }),
  AVG: (f) => ({ ru: `среднее значение поля ${f}`, kk: `${f} өрісінің орташа мәнін` }),
  MIN: (f) => ({ ru: `наименьшее значение поля ${f}`, kk: `${f} өрісінің ең кіші мәнін` }),
  MAX: (f) => ({ ru: `наибольшее значение поля ${f}`, kk: `${f} өрісінің ең үлкен мәнін` }),
};

/** Какой запрос найдёт нужный итог (выбор итоговой функции по смыслу). */
function genFnChoice(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const f = randNumField(rand, t);
  const fn = pick(rand, FNS);
  const vals = t.rows.map((r) => num(t, r, f));
  const results = new Map<Fn, number>(FNS.map((x) => [x, aggregate(x, vals)]));
  // Результат правильной функции не должен совпасть с результатом другой: иначе два верных ответа.
  const others = FNS.filter((x) => x !== fn);
  if (others.some((x) => results.get(x) === results.get(fn))) return undefined;
  const sqlOf = (x: Fn) => `SELECT ${fnCall(x, f)} FROM ${t.name};`;
  const wrong: Wrong[] = shuffle(others, rand)
    .slice(0, 3)
    .map((x) => ({
      text: sqlOf(x),
      why: {
        ru: `${fnCall(x, f)} возвращает ${FN_DESC[x].ru}, а нужно ${FN_DESC[fn].ru}.`,
        kk: `${fnCall(x, f)} ${FN_DESC[x].kk} қайтарады, ал ${FN_DESC[fn].kk} керек.`,
      },
    }));
  const goal = FN_GOAL[fn](f, t.name);
  return choice(
    rand,
    {
      id: makeId("fn-choice", t, `${fn},${f}`, seed),
      level,
      prompt: { ru: `Какой запрос найдёт ${goal.ru}?`, kk: `Қай сұраныс ${goal.kk} табады?` },
      scene: tableScene(t),
      hint: {
        ru: "Вспомни пять итоговых функций: COUNT — сколько, SUM — сумма, AVG — среднее, MIN — наименьшее, MAX — наибольшее.",
        kk: "Бес қорытынды функцияны еске түсір: COUNT — неше, SUM — қосынды, AVG — орташа, MIN — ең кіші, MAX — ең үлкен.",
      },
      explanation: {
        ru: `${fnCall(fn, f)} возвращает ${FN_DESC[fn].ru}. Остальные функции считают другое: COUNT — число записей, SUM — сумму, AVG — среднее, MIN — наименьшее, MAX — наибольшее.`,
        kk: `${fnCall(fn, f)} ${FN_DESC[fn].kk} қайтарады. Қалған функциялар басқаны санайды: COUNT — жазбалар санын, SUM — қосындыны, AVG — орташа мәнді, MIN — ең кішісін, MAX — ең үлкенін.`,
      },
    },
    sqlOf(fn),
    wrong,
  );
}

// ---------- Уровень 2 ----------

/** Сколько записей останется после DELETE с двумя условиями (выбор из чисел). */
function genDeleteTwo(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const cond = randTwo(rand, t);
  const del = matching(t, cond);
  if (del.length < 1 || del.length > t.rows.length - 2) return undefined;
  const sql = `DELETE FROM ${t.name} WHERE ${show(cond)};`;
  const left = t.rows.length - del.length;
  const seen = new Set<number>([left]);
  const wrong: Wrong[] = [];
  for (const m of shuffle(mutants(cond), rand)) {
    const k = t.rows.length - matching(t, m.cond).length;
    if (seen.has(k)) continue;
    seen.add(k);
    wrong.push({ text: String(k), why: m.why });
  }
  // «Число удалённых вместо оставшихся» — типичная ошибка.
  if (!seen.has(del.length)) {
    seen.add(del.length);
    wrong.push({
      text: String(del.length),
      why: { ru: "Это число удалённых записей, а спрашивается, сколько записей осталось.", kk: "Бұл жойылған жазбалар саны, ал қанша жазба қалғаны сұралған." },
    });
  }
  for (const k of [left + 1, left - 1, left + 2, left - 2]) {
    if (k < 0 || k > t.rows.length || seen.has(k)) continue;
    seen.add(k);
    wrong.push({ text: String(k), why: WHY_COUNT });
  }
  return choice(
    rand,
    {
      id: makeId("del-two", t, sql, seed),
      level,
      prompt: {
        ru: `Сколько записей останется в таблице ${T_RU[t.name]} после запроса: ${sql}`,
        kk: `Мына сұраныстан кейін ${T_RU[t.name]} кестесінде неше жазба қалады: ${sql}`,
      },
      scene: tableScene(t),
      reveal: tableScene(applyDelete(t, cond)),
      hint: {
        ru: "Для каждой записи проверь оба условия. AND требует, чтобы верны были оба, OR — хотя бы одно. Потом вычти удалённые из общего числа.",
        kk: "Әр жазба үшін екі шартты да тексер. AND екеуінің де орындалуын, OR — кемінде біреуінің орындалуын талап етеді. Содан кейін жойылғандарды жалпы саннан алып таста.",
      },
      explanation: {
        ru: `${fitsRu(show(cond), del.length)}: ${listOf(t, del).ru}. Они удаляются: ${t.rows.length} − ${del.length} = ${left}.`,
        kk: `${show(cond)} шарты ${del.length} жазбаға сәйкес келеді: ${listOf(t, del).kk}. Олар жойылады: ${t.rows.length} − ${del.length} = ${left}.`,
      },
    },
    String(left),
    wrong,
    true,
  );
}

/** Значение поля у записи с заданным ID после UPDATE (Students). */
function genUpdateCell(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, "Students");
  const f = "Mark";
  const newV = pick(rand, [2, 3, 5]);
  const cond = randCmp(rand, t, "Class", ["=", ">", "<"]);
  const hit = matching(t, cond);
  if (hit.length < 1 || hit.length > t.rows.length - 2) return undefined;
  // Запись, которую спрашиваем: в половине задач подходит под WHERE, в половине — нет.
  const wantHit = rand() < 0.5;
  const pool = t.rows.map((_, i) => i).filter((i) => hit.includes(i) === wantHit);
  const k = pick(rand, pool);
  const old = num(t, t.rows[k], f);
  if (wantHit && old === newV) return undefined;
  const id = t.rows[k][0] as number;
  const right = wantHit ? newV : old;
  const stmts = [`UPDATE Students SET ${f} = ${newV} WHERE ${show(cond)};`, `SELECT ${f} FROM Students WHERE ID = ${id};`];
  const wrong: Wrong[] = [];
  const seen = new Set<number>([right]);
  const add = (v: number, why: L) => {
    if (seen.has(v)) return;
    seen.add(v);
    wrong.push({ text: String(v), why });
  };
  if (wantHit) {
    add(old, { ru: "Это оценка до UPDATE: запись подходит под WHERE, и значение изменилось.", kk: "Бұл UPDATE-ке дейінгі баға: жазба WHERE-ге сәйкес келеді, мән өзгерді." });
  } else {
    add(newV, { ru: "Запись не подходит под WHERE, поэтому UPDATE её не тронул и значение осталось прежним.", kk: "Жазба WHERE-ге сәйкес келмейді, сондықтан UPDATE оған тиіспеді және мән бұрынғы күйінде қалды." });
  }
  for (const v of shuffle([2, 3, 4, 5], rand)) add(v, { ru: "Такое значение у этой записи не получится: оно не равно ни старой оценке, ни новой.", kk: "Бұл жазбада мұндай мән шықпайды: ол ескі бағаға да, жаңа бағаға да тең емес." });
  return choice(
    rand,
    {
      id: makeId("upd-cell", t, `${stmts.join("")}`, seed),
      level,
      prompt: {
        ru: `Выполнен запрос: ${stmts[0]} Что вернёт после этого запрос: ${stmts[1]}`,
        kk: `Сұраныс орындалды: ${stmts[0]} Осыдан кейін мына сұраныс не қайтарады: ${stmts[1]}`,
      },
      scene: tableScene(t),
      reveal: tableScene(applyUpdate(t, f, newV, cond)),
      hint: {
        ru: `Найди запись с ID = ${id} в таблице и проверь: подходит ли она под условие WHERE? UPDATE меняет только подходящие записи.`,
        kk: `Кестеден ID = ${id} жазбасын тауып, тексер: ол WHERE шартына сәйкес келе ме? UPDATE тек сәйкес жазбаларды өзгертеді.`,
      },
      explanation: {
        ru: wantHit
          ? `Запись с ID = ${id} (${listOf(t, [k]).ru}) подходит под условие ${show(cond)}, поэтому ${f} становится ${newV}.`
          : `Запись с ID = ${id} (${listOf(t, [k]).ru}) не подходит под условие ${show(cond)}, поэтому UPDATE её не меняет: ${f} остаётся ${old}.`,
        kk: wantHit
          ? `ID = ${id} жазбасы (${listOf(t, [k]).kk}) ${show(cond)} шартына сәйкес келеді, сондықтан ${f} ${newV} болады.`
          : `ID = ${id} жазбасы (${listOf(t, [k]).kk}) ${show(cond)} шартына сәйкес келмейді, сондықтан UPDATE оны өзгертпейді: ${f} ${old} күйінде қалады.`,
      },
    },
    String(right),
    wrong.slice(0, 3),
    true,
  );
}

/** Итог по записям с двумя условиями (выбор): неверные варианты — другие функции и неверное условие. */
function genAggWhere(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const fn = pick(rand, ["COUNT", "SUM", "MIN", "MAX"] as Fn[]);
  const f = randNumField(rand, t);
  const cond = randTwo(rand, t);
  const idx = matching(t, cond);
  if (idx.length < 2 || idx.length > t.rows.length - 1) return undefined;
  const sql = `SELECT ${fnCall(fn, f)} FROM ${t.name} WHERE ${show(cond)};`;
  const right = aggOver(t, idx, fn, f);
  const seen = new Set<number>([right]);
  const wrong: Wrong[] = [];
  const add = (v: number, why: L) => {
    if (seen.has(v) || !Number.isFinite(v)) return;
    seen.add(v);
    wrong.push({ text: String(roundNum(v)), why });
  };
  for (const x of shuffle(FNS.filter((y) => y !== fn), rand)) {
    add(aggOver(t, idx, x, f), {
      ru: `Это ${FN_DESC[x].ru} (функция ${x}), а в запросе функция ${fn}.`,
      kk: `Бұл ${FN_DESC[x].kk} (${x} функциясы), ал сұраныста ${fn} функциясы.`,
    });
  }
  for (const m of shuffle(mutants(cond), rand)) {
    const idx2 = matching(t, m.cond);
    if (idx2.length) add(aggOver(t, idx2, fn, f), m.why);
  }
  add(aggOver(t, t.rows.map((_, i) => i), fn, f), {
    ru: "Это итог по всей таблице: условие WHERE не учтено.",
    kk: "Бұл бүкіл кесте бойынша қорытынды: WHERE шарты ескерілмеген.",
  });
  const vals = idx.map((i) => num(t, t.rows[i], f));
  return choice(
    rand,
    {
      id: makeId("agg-where", t, sql, seed),
      level,
      prompt: { ru: `Что вернёт запрос: ${sql}`, kk: `Сұраныс не қайтарады: ${sql}` },
      scene: tableScene(t),
      reveal: tableScene(t, idx),
      hint: {
        ru: "Сначала по WHERE отбери записи (AND — оба условия, OR — хотя бы одно). Потом примени итоговую функцию только к ним.",
        kk: "Алдымен WHERE бойынша жазбаларды іріктеп ал (AND — екі шарт, OR — кемінде біреуі). Содан кейін қорытынды функцияны тек соларға қолдан.",
      },
      explanation: {
        ru: `${fitsRu(show(cond), idx.length)}: ${listOf(t, idx).ru}${fn === "COUNT" ? "" : `, значения ${f}: ${vals.join(", ")}`}. ${fnCall(fn, f)} — ${FN_DESC[fn].ru}: ${right}.`,
        kk: `${show(cond)} шарты ${idx.length} жазбаға сәйкес келеді: ${listOf(t, idx).kk}${fn === "COUNT" ? "" : `, ${f} мәндері: ${vals.join(", ")}`}. ${fnCall(fn, f)} — ${FN_DESC[fn].kk}: ${right}.`,
      },
    },
    String(right),
    wrong,
    true,
  );
}

/** Среднее значение (ввод десятичной дроби; подбираем «красивое» среднее). */
function genAvg(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const f = randNumField(rand, t);
  const cond = randCmp(rand, t, randNumField(rand, t), SIMPLE_OPS);
  const idx = matching(t, cond);
  if (idx.length < 2 || idx.length > t.rows.length - 1) return undefined;
  const avg = aggOver(t, idx, "AVG", f);
  if (!isNice(avg)) return undefined;
  const vals = idx.map((i) => num(t, t.rows[i], f));
  const sum = vals.reduce((a, b) => a + b, 0);
  const sql = `SELECT AVG(${f}) FROM ${t.name} WHERE ${show(cond)};`;
  return decimalInput(
    {
      id: makeId("avg", t, sql, seed),
      level,
      prompt: {
        ru: `Что вернёт запрос: ${sql} Если ответ дробный, запиши его десятичной дробью.`,
        kk: `Сұраныс не қайтарады: ${sql} Жауап бөлшек болса, оны ондық бөлшекпен жаз.`,
      },
      scene: tableScene(t),
      reveal: tableScene(t, idx),
      hint: {
        ru: "Отбери записи по WHERE и выпиши значения поля. Среднее — это сумма значений, делённая на их количество.",
        kk: "WHERE бойынша жазбаларды іріктеп, өрістің мәндерін жаз. Орташа мән — мәндер қосындысын олардың санына бөлгенде шығады.",
      },
      explanation: {
        ru: `WHERE ${show(cond)} оставляет ${recs(idx.length)}, значения ${f}: ${vals.join(", ")}. Сумма ${sum}, среднее ${sum} : ${idx.length} = ${fmt(avg)}.`,
        kk: `WHERE ${show(cond)} ${idx.length} жазбаны қалдырады, ${f} мәндері: ${vals.join(", ")}. Қосынды ${sum}, орташа мән ${sum} : ${idx.length} = ${fmt(avg)}.`,
      },
    },
    avg,
  );
}

// ---------- Уровень 3 ----------

/** После UPDATE: итог SUM или число записей с новым значением (выбор). */
function genUpdateAgg(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const f = randNumField(rand, t);
  const condField = randNumField(rand, t, f);
  const cond = rand() < 0.6 ? randCmp(rand, t, condField) : randCmp(rand, t, f, [">", "<", "<="]);
  const hit = matching(t, cond);
  if (hit.length < 1 || hit.length > t.rows.length - 2) return undefined;
  const newV = pick(rand, valuesOf(t, f));
  const after = applyUpdate(t, f, newV, cond);
  const allIdx = t.rows.map((_, i) => i);
  const byCount = rand() < 0.4;
  const upd = `UPDATE ${t.name} SET ${f} = ${newV} WHERE ${show(cond)};`;
  const sel = byCount ? `SELECT COUNT(*) FROM ${t.name} WHERE ${f} = ${newV};` : `SELECT SUM(${f}) FROM ${t.name};`;
  const calc = (tab: Table) => (byCount ? tab.rows.filter((r) => num(tab, r, f) === newV).length : aggOver(tab, allIdx, "SUM", f));
  const right = calc(after);
  const before = calc(t);
  const all = calc(applyUpdate(t, f, newV));
  const wrong: Wrong[] = [];
  const seen = new Set<number>([right]);
  const add = (v: number, why: L) => {
    if (seen.has(v) || v < 0) return;
    seen.add(v);
    wrong.push({ text: String(v), why });
  };
  add(before, { ru: "Это значение до UPDATE: изменение не учтено.", kk: "Бұл UPDATE-ке дейінгі мән: өзгеріс ескерілмеген." });
  add(all, { ru: "Так было бы, если бы WHERE не было и новое значение получили все записи.", kk: "WHERE болмаса және жаңа мәнді барлық жазба алса, солай болар еді." });
  // Изменена только одна подходящая запись.
  const oneIdx = hit[0];
  const oneRows = t.rows.map((r, i) => (i === oneIdx ? r.map((x, k) => (k === col(t, f) ? newV : x)) : r));
  const one = calc({ ...t, rows: oneRows });
  add(one, { ru: "Изменена только одна запись, а под условие подходят все отобранные.", kk: "Тек бір жазба өзгерген, ал шартқа іріктелген барлық жазба сәйкес келеді." });
  for (const d of [1, -1, 2, -2, 10, -10]) add(right + d, WHY_COUNT);
  const idsTxt = listOf(t, hit);
  return choice(
    rand,
    {
      id: makeId(byCount ? "upd-count" : "upd-sum", t, upd + sel, seed),
      level,
      prompt: {
        ru: `Выполнен запрос: ${upd} Что вернёт после этого запрос: ${sel}`,
        kk: `Сұраныс орындалды: ${upd} Осыдан кейін мына сұраныс не қайтарады: ${sel}`,
      },
      scene: tableScene(t),
      reveal: tableScene(after, hit),
      hint: {
        ru: "Сначала примени UPDATE: найди записи, подходящие под WHERE, и впиши им новое значение. Потом выполни второй запрос по изменённой таблице.",
        kk: "Алдымен UPDATE-ті қолдан: WHERE-ге сәйкес жазбаларды тауып, оларға жаңа мәнді жаз. Содан кейін екінші сұранысты өзгерген кесте бойынша орында.",
      },
      explanation: {
        ru: `${fitsRu(show(cond), hit.length)}: ${idsTxt.ru}. Значение ${f} у них становится ${newV}. ${byCount ? `Теперь ${f} = ${newV} у ${right} ${plural(right, "записи", "записей", "записей")}` : `Сумма ${f} по изменённой таблице равна ${right}`} (до UPDATE было ${before}).`,
        kk: `${show(cond)} шарты ${hit.length} жазбаға сәйкес келеді: ${idsTxt.kk}. Олардағы ${f} мәні ${newV} болады. ${byCount ? `Енді ${f} = ${newV} болатын жазбалар саны ${right}` : `Өзгерген кесте бойынша ${f} қосындысы: ${right}`} (UPDATE-ке дейін ${before} болған).`,
      },
    },
    String(right),
    wrong,
    true,
  );
}

/** Число строк результата GROUP BY Class (Students) с WHERE. */
function genGroupRows(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, "Students");
  const cond = randCmp(rand, t, "Mark", ["=", ">", "<", ">=", "<="]);
  const idx = matching(t, cond);
  const groups = [...new Set(idx.map((i) => t.rows[i][2] as number))].sort((a, b) => a - b);
  // Нужны ситуации, где число групп отличается от числа записей, от 1 и от общего числа записей.
  if (groups.length < 2 || groups.length >= idx.length || idx.length === t.rows.length) return undefined;
  const fn = pick(rand, ["COUNT", "SUM", "MAX"] as Fn[]);
  const sql = `SELECT Class, ${fnCall(fn, "Mark")} FROM Students WHERE ${show(cond)} GROUP BY Class;`;
  const rows: Text[][] = groups.map((c) => [String(c), String(aggOver(t, idx.filter((i) => t.rows[i][2] === c), fn, "Mark"))]);
  const wrong: Wrong[] = [
    { text: String(idx.length), why: { ru: "Это число записей, прошедших WHERE. GROUP BY выводит по строке на каждый класс, а не на каждую запись.", kk: "Бұл WHERE-ден өткен жазбалар саны. GROUP BY әр жазбаға емес, әр сыныпқа бір жолдан шығарады." } },
    { text: String(t.rows.length), why: { ru: "Это число всех записей таблицы: не учтены ни WHERE, ни GROUP BY.", kk: "Бұл кестенің барлық жазбасының саны: WHERE де, GROUP BY да ескерілмеген." } },
    { text: "1", why: { ru: "Одна строка получилась бы без GROUP BY. Здесь записи делятся на группы по классам.", kk: "Бір жол GROUP BY болмаса шығар еді. Мұнда жазбалар сыныптар бойынша топқа бөлінеді." } },
    { text: "3", why: { ru: "Три группы были бы, если бы после WHERE остались записи всех трёх классов. Проверь, какие классы остались.", kk: "WHERE-ден кейін үш сыныптың да жазбалары қалса, үш топ болар еді. Қандай сыныптар қалғанын тексер." } },
  ];
  return choice(
    rand,
    {
      id: makeId("group-rows", t, sql, seed),
      level,
      prompt: { ru: `Сколько строк выведет запрос: ${sql}`, kk: `Сұраныс неше жол шығарады: ${sql}` },
      scene: tableScene(t),
      reveal: { kind: "table", columns: ["Class", fnCall(fn, "Mark")], rows },
      hint: {
        ru: "Выполни запрос в два шага: сначала отбери записи по WHERE, потом разложи их по значениям Class. Сколько разных классов осталось?",
        kk: "Сұранысты екі қадаммен орында: алдымен жазбаларды WHERE бойынша іріктеп, содан кейін оларды Class мәндері бойынша бөл. Неше түрлі сынып қалды?",
      },
      explanation: {
        ru: `WHERE ${show(cond)} оставляет ${recs(idx.length)}: ${listOf(t, idx).ru}. GROUP BY раскладывает их по классам: ${groups.join(", ")}. Групп получилось ${groups.length}, значит, в результате ${rowsRu(groups.length)}.`,
        kk: `WHERE ${show(cond)} ${idx.length} жазбаны қалдырады: ${listOf(t, idx).kk}. GROUP BY оларды сыныптар бойынша бөледі: ${groups.join(", ")}. Топ саны — ${groups.length}, демек, нәтижеде ${groups.length} жол.`,
      },
    },
    String(groups.length),
    wrong,
    true,
  );
}

/** Значение итога в строке нужного класса после GROUP BY Class (Students). */
function genGroupValue(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, "Students");
  const fn = pick(rand, ["COUNT", "SUM", "MAX", "MIN"] as Fn[]);
  const c = pick(rand, [9, 10, 11]);
  const useWhere = rand() < 0.5;
  const cond = useWhere ? randCmp(rand, t, "Mark", [">=", "<=", "<>", ">", "<"]) : undefined;
  const idx = matching(t, cond);
  const inGroup = idx.filter((i) => t.rows[i][2] === c);
  if (inGroup.length < 2) return undefined;
  const sql = `SELECT Class, ${fnCall(fn, "Mark")} AS R FROM Students${cond ? ` WHERE ${show(cond)}` : ""} GROUP BY Class;`;
  const right = aggOver(t, inGroup, fn, "Mark");
  const wrong: Wrong[] = [];
  const seen = new Set<number>([right]);
  const add = (v: number, why: L) => {
    if (seen.has(v) || v < 0) return;
    seen.add(v);
    wrong.push({ text: String(v), why });
  };
  add(aggOver(t, idx, fn, "Mark"), { ru: "Это итог по всем записям сразу: группы по классам не учтены.", kk: "Бұл барлық жазба бойынша бірден қорытынды: сыныптар бойынша топтар ескерілмеген." });
  for (const x of shuffle(FNS.filter((y) => y !== fn && y !== "AVG"), rand)) {
    add(aggOver(t, inGroup, x, "Mark"), {
      ru: `Это ${FN_DESC[x].ru} (функция ${x}) для этого класса, а в запросе функция ${fn}.`,
      kk: `Бұл осы сынып үшін ${FN_DESC[x].kk} (${x} функциясы), ал сұраныста ${fn} функциясы.`,
    });
  }
  // Итог другого класса — путаница строк.
  for (const c2 of [9, 10, 11].filter((x) => x !== c)) {
    const other = idx.filter((i) => t.rows[i][2] === c2);
    if (other.length) add(aggOver(t, other, fn, "Mark"), { ru: `Это значение для класса ${c2}, а спрашивается про класс ${c}.`, kk: `Бұл ${c2}-сынып үшін мән, ал ${c}-сынып туралы сұралған.` });
  }
  // Для MIN/MAX «соседние» числа вне шкалы оценок 2–5 — бессмысленные варианты.
  for (const d of [1, -1, 2]) if (fn === "COUNT" || fn === "SUM" || (right + d >= 2 && right + d <= 5)) add(right + d, WHY_COUNT);
  return choice(
    rand,
    {
      id: makeId("group-val", t, sql + c, seed),
      level,
      prompt: {
        ru: `Запрос: ${sql} Чему равно значение R в строке для класса ${c}?`,
        kk: `Сұраныс: ${sql} ${c}-сынып үшін жолдағы R мәні неге тең?`,
      },
      scene: tableScene(t),
      reveal: tableScene(t, inGroup),
      hint: {
        ru: `Сначала отбери записи по WHERE (если он есть), потом возьми только записи класса ${c} и примени итоговую функцию к ним.`,
        kk: `Алдымен WHERE бойынша жазбаларды іріктеп ал (егер ол бар болса), содан кейін тек ${c}-сынып жазбаларын алып, оларға қорытынды функцияны қолдан.`,
      },
      explanation: {
        ru: `${cond ? `WHERE ${show(cond)} оставляет ${recs(idx.length)}. ` : ""}В группе класса ${c} — ${recs(inGroup.length)}: ${listOf(t, inGroup).ru}, оценки ${inGroup.map((i) => t.rows[i][3]).join(", ")}. ${fnCall(fn, "Mark")} — ${FN_DESC[fn].ru}: ${right}.`,
        kk: `${cond ? `WHERE ${show(cond)} ${idx.length} жазбаны қалдырады. ` : ""}${c}-сынып тобында ${inGroup.length} жазба бар: ${listOf(t, inGroup).kk}, бағалары ${inGroup.map((i) => t.rows[i][3]).join(", ")}. ${fnCall(fn, "Mark")} — ${FN_DESC[fn].kk}: ${right}.`,
      },
    },
    String(right),
    wrong,
    true,
  );
}

/** После DELETE: итог по оставшимся записям (ввод числа). */
function genDeleteAgg(rand: Rand, level: Level, seed: number): QuestionStep | undefined {
  const t = makeTable(rand, pick(rand, TABLE_KINDS));
  const f = randNumField(rand, t);
  const cond = randCmp(rand, t, randNumField(rand, t), SIMPLE_OPS);
  const del = matching(t, cond);
  if (del.length < 1 || del.length > t.rows.length - 3) return undefined;
  const after = applyDelete(t, cond);
  const fn = pick(rand, ["COUNT", "SUM", "MIN", "MAX"] as Fn[]);
  const allIdx = after.rows.map((_, i) => i);
  const answer = aggOver(after, allIdx, fn, f);
  const dsql = `DELETE FROM ${t.name} WHERE ${show(cond)};`;
  const ssql = `SELECT ${fnCall(fn, f)} FROM ${t.name};`;
  const vals = after.rows.map((r) => num(after, r, f));
  return numberInput(
    {
      id: makeId("del-agg", t, dsql + ssql, seed),
      level,
      prompt: {
        ru: `Выполнен запрос: ${dsql} Что вернёт после этого запрос: ${ssql}`,
        kk: `Сұраныс орындалды: ${dsql} Осыдан кейін мына сұраныс не қайтарады: ${ssql}`,
      },
      scene: tableScene(t),
      reveal: tableScene(after),
      hint: {
        ru: "Сначала выполни DELETE: вычеркни записи, подходящие под WHERE. Потом примени итоговую функцию к тем записям, что остались.",
        kk: "Алдымен DELETE-ті орында: WHERE-ге сәйкес жазбаларды сызып таста. Содан кейін қорытынды функцияны қалған жазбаларға қолдан.",
      },
      explanation: {
        ru: `${fitsRu(show(cond), del.length)}: ${listOf(t, del).ru}. Они удалены, осталось ${recs(after.rows.length)}${fn === "COUNT" ? "" : `, значения ${f}: ${vals.join(", ")}`}. ${fnCall(fn, f)} — ${FN_DESC[fn].ru}: ${answer}.`,
        kk: `${show(cond)} шарты ${del.length} жазбаға сәйкес келеді: ${listOf(t, del).kk}. Олар жойылды, ${after.rows.length} жазба қалды${fn === "COUNT" ? "" : `, ${f} мәндері: ${vals.join(", ")}`}. ${fnCall(fn, f)} — ${FN_DESC[fn].kk}: ${answer}.`,
      },
    },
    answer,
  );
}

type Gen = (rand: Rand, level: Level, seed: number) => QuestionStep | undefined;

const KINDS: Record<Level, Gen[]> = {
  1: [genInsertWhich, genDeleteSimple, genAggSimple, genFnChoice],
  2: [genDeleteTwo, genUpdateCell, genAggWhere, genAvg, genAggSimple],
  3: [genUpdateAgg, genGroupRows, genGroupValue, genDeleteAgg, genAggWhere],
};

function genQuestion(level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  for (let attempt = 0; attempt < 80; attempt++) {
    const q = pick(rand, KINDS[level])(rand, level, seed);
    if (q) return q;
  }
  // Запасной вариант: простое удаление (подбираем таблицу, пока не подойдёт).
  for (let k = 0; k < 200; k++) {
    const q = genDeleteSimple(seeded(seed + k + 1), level, seed);
    if (q) return q;
  }
  throw new Error("db.modify: не удалось собрать задание");
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
  st("insert-adds", 1, "Команда INSERT INTO добавляет в таблицу новую запись.", "INSERT INTO командасы кестеге жаңа жазба қосады.", true,
    "INSERT INTO таблица (поля) VALUES (значения) добавляет одну запись в конец таблицы.", "INSERT INTO кесте (өрістер) VALUES (мәндер) кестенің соңына бір жазба қосады.",
    { ru: "Слово insert по-английски значит «вставить».", kk: "Insert ағылшынша «кірістіру» дегенді білдіреді." }),
  st("insert-order", 1, "В команде INSERT значения в VALUES записывают в том же порядке, что и поля в скобках.", "INSERT командасында VALUES ішіндегі мәндер жақшадағы өрістермен бірдей ретпен жазылады.", true,
    "Первое значение попадает в первое поле, второе — во второе и так далее.", "Бірінші мән бірінші өріске, екінші мән екінші өріске түседі, т.с.с.",
    { ru: "Как база узнаёт, в какое поле какое значение класть?", kk: "Деректер қоры қай мәнді қай өріске салуды қалай біледі?" }),
  st("update-changes", 1, "Команда UPDATE изменяет значения в уже существующих записях.", "UPDATE командасы бар жазбалардағы мәндерді өзгертеді.", true,
    "UPDATE таблица SET поле = значение WHERE условие меняет значение поля у подходящих записей.", "UPDATE кесте SET өріс = мән WHERE шарт сәйкес жазбалардағы өріс мәнін өзгертеді.",
    { ru: "Слово update по-английски — «обновить».", kk: "Update сөзі ағылшынша — «жаңарту»." }),
  st("delete-removes", 1, "Команда DELETE FROM удаляет записи целиком, а не отдельные ячейки.", "DELETE FROM командасы жазбаларды түгелдей жояды, жеке ұяшықтарды емес.", true,
    "DELETE удаляет строки таблицы. Чтобы изменить значение в ячейке, используют UPDATE.", "DELETE кестенің жолдарын жояды. Ұяшықтағы мәнді өзгерту үшін UPDATE қолданылады.",
    { ru: "Что исчезает при DELETE — ячейка или вся строка?", kk: "DELETE кезінде не жоғалады — ұяшық па, әлде бүкіл жол ма?" }),
  st("no-where-update", 1, "Команда UPDATE без WHERE изменит значение только в первой записи.", "WHERE жоқ UPDATE командасы мәнді тек бірінші жазбада өзгертеді.", false,
    "Без WHERE условия нет, поэтому подходят все записи: значение изменится во всех.", "WHERE болмаса шарт жоқ, сондықтан барлық жазба сәйкес келеді: мән барлығында өзгереді.",
    { ru: "Что значит «нет условия отбора»: подходят все записи или ни одной?", kk: "«Іріктеу шарты жоқ» дегеніміз не: барлық жазба сәйкес келе ме, әлде бірде-бірі ме?" }),
  st("no-where-delete", 1, "Команда DELETE FROM Students; без WHERE удалит все записи таблицы.", "WHERE жоқ DELETE FROM Students; командасы кестенің барлық жазбасын жояды.", true,
    "Без условия подходят все записи. Сама таблица (её поля) остаётся, но становится пустой.", "Шарт болмаса барлық жазба сәйкес келеді. Кестенің өзі (оның өрістері) қалады, бірақ бос болады.",
    { ru: "Что подходит под отсутствующее условие?", kk: "Жоқ шартқа не сәйкес келеді?" }),
  st("count-star", 1, "COUNT(*) возвращает число записей.", "COUNT(*) жазбалар санын қайтарады.", true,
    "COUNT(*) считает записи, которые остались после WHERE (или все записи, если WHERE нет).", "COUNT(*) WHERE-ден кейін қалған жазбаларды (немесе WHERE болмаса, барлық жазбаны) санайды.",
    { ru: "Слово count по-английски — «считать».", kk: "Count сөзі ағылшынша — «санау»." }),
  st("sum-vs-count", 1, "SUM(Mark) возвращает число записей в таблице.", "SUM(Mark) кестедегі жазбалар санын қайтарады.", false,
    "SUM — это сумма значений поля Mark, а число записей считает COUNT(*).", "SUM — Mark өрісі мәндерінің қосындысы, ал жазбалар санын COUNT(*) санайды.",
    { ru: "Какая функция складывает, а какая считает записи?", kk: "Қай функция қосады, ал қайсысы жазбаларды санайды?" }),
  st("avg-def", 2, "AVG(Mark) — это сумма значений Mark, делённая на количество записей.", "AVG(Mark) — Mark мәндерінің қосындысын жазбалар санына бөлгенде шығатын мән.", true,
    "Среднее значение — сумма, делённая на количество.", "Орташа мән — қосындыны санға бөлгенде шығады.",
    { ru: "Как в школе считают среднюю оценку?", kk: "Мектепте орташа бағаны қалай есептейді?" }),
  st("avg-minmax", 2, "AVG(Mark) всегда равно (MIN(Mark) + MAX(Mark)) : 2.", "AVG(Mark) әрқашан (MIN(Mark) + MAX(Mark)) : 2 өрнегіне тең.", false,
    "Среднее зависит от всех значений, а не только от самого большого и самого маленького. Для оценок 5, 4, 3, 5 среднее 4,25, а (3 + 5) : 2 = 4.", "Орташа мән тек ең үлкен және ең кіші мәндерге емес, барлық мәнге тәуелді. 5, 4, 3, 5 бағалары үшін орташа 4,25, ал (3 + 5) : 2 = 4.",
    { ru: "Проверь на оценках 5, 4, 3, 5: посчитай оба выражения.", kk: "5, 4, 3, 5 бағаларында тексер: екі өрнекті де есепте." }),
  st("where-aggregate", 2, "В запросе SELECT MAX(Price) FROM Goods WHERE Qty > 20; сначала отбираются записи по WHERE, а потом ищется наибольшая цена среди них.", "SELECT MAX(Price) FROM Goods WHERE Qty > 20; сұранысында алдымен жазбалар WHERE бойынша іріктеледі, содан кейін солардың ішінен ең үлкен баға табылады.", true,
    "WHERE всегда выполняется раньше итоговой функции.", "WHERE әрқашан қорытынды функциядан бұрын орындалады.",
    { ru: "Что делается раньше — отбор записей или подсчёт итога?", kk: "Не бұрын орындалады — жазбаларды іріктеу ме, әлде қорытындыны санау ма?" }),
  st("group-rows", 2, "Запрос SELECT Class, COUNT(*) FROM Students GROUP BY Class; выводит одну строку на каждое значение Class.", "SELECT Class, COUNT(*) FROM Students GROUP BY Class; сұранысы Class өрісінің әр мәні үшін бір жолдан шығарады.", true,
    "GROUP BY объединяет записи с одинаковым значением поля в группу, и итог считается для каждой группы отдельно.", "GROUP BY өрістің мәні бірдей жазбаларды топқа біріктіреді, қорытынды әр топ үшін бөлек есептеледі.",
    { ru: "Сколько групп, столько и ...?", kk: "Қанша топ болса, сонша ...?" }),
  st("as-name", 2, "Слово AS в запросе задаёт название столбца результата.", "Сұраныстағы AS сөзі нәтиже бағанының атын береді.", true,
    "Например, COUNT(*) AS N выведет столбец с названием N.", "Мысалы, COUNT(*) AS N жазылса, нәтиже бағаны N деп аталады.",
    { ru: "AS по-английски значит «как».", kk: "AS ағылшынша «ретінде» дегенді білдіреді." }),
  st("update-not-insert", 2, "Чтобы добавить новую запись, можно использовать UPDATE.", "Жаңа жазба қосу үшін UPDATE қолдануға болады.", false,
    "UPDATE меняет только существующие записи. Новую запись добавляет INSERT INTO.", "UPDATE тек бар жазбаларды өзгертеді. Жаңа жазбаны INSERT INTO қосады.",
    { ru: "Если подходящих записей нет, что сделает UPDATE?", kk: "Сәйкес жазба жоқ болса, UPDATE не істейді?" }),
  st("delete-or-twice", 3, "Запись, подходящая под оба условия в DELETE ... WHERE A OR B, удаляется дважды, поэтому удалённых записей больше.", "DELETE ... WHERE A OR B ішіндегі екі шартқа да сәйкес келетін жазба екі рет жойылады, сондықтан жойылған жазбалар көп болады.", false,
    "Запись удаляется один раз. Подходящие записи считаются как объединение множеств: общую часть считают один раз.", "Жазба бір рет жойылады. Сәйкес жазбалар жиындардың бірігуі ретінде саналады: ортақ бөлікті бір рет санайды.",
    { ru: "Можно ли удалить одну и ту же строку два раза?", kk: "Бір жолды екі рет жоюға бола ма?" }),
  st("count-vs-distinct-rows", 3, "После DELETE FROM Students WHERE Class = 9; запрос SELECT COUNT(*) FROM Students; вернёт число, меньшее, чем до удаления (если записи 9 класса были).", "DELETE FROM Students WHERE Class = 9; соң SELECT COUNT(*) FROM Students; сұранысы жоюға дейінгіден аз сан қайтарады (егер 9-сынып жазбалары болса).", true,
    "Удалённые записи больше не считаются, поэтому COUNT(*) уменьшается на их число.", "Жойылған жазбалар енді саналмайды, сондықтан COUNT(*) олардың санына азаяды.",
    { ru: "Считаются ли удалённые записи?", kk: "Жойылған жазбалар саналады ма?" }),
];

const pr = (id: string, level: Level, left: Text, right: Text): Pair => ({ id: `p:${SKILL}:${id}`, skill: SKILL, level, left, right });

const PAIRS: Pair[] = [
  pr("insert", 1, "INSERT INTO", g("добавить запись", "жазба қосу")),
  pr("update", 1, "UPDATE ... SET", g("изменить значения", "мәндерді өзгерту")),
  pr("delete", 1, "DELETE FROM", g("удалить записи", "жазбаларды жою")),
  pr("create", 1, "CREATE TABLE", g("создать таблицу", "кесте құру")),
  pr("values", 1, "VALUES", g("значения новой записи", "жаңа жазбаның мәндері")),
  pr("count", 1, "COUNT(*)", g("число записей", "жазбалар саны")),
  pr("sum", 1, "SUM(Mark)", g("сумма оценок", "бағалар қосындысы")),
  pr("avg", 1, "AVG(Mark)", g("средняя оценка", "орташа баға")),
  pr("min", 1, "MIN(Mark)", g("наименьшая оценка", "ең төмен баға")),
  pr("max", 1, "MAX(Mark)", g("наибольшая оценка", "ең жоғары баға")),
  pr("groupby", 2, "GROUP BY", g("итоги по группам записей", "жазбалар топтары бойынша қорытынды")),
  pr("as", 2, "AS", g("название столбца результата", "нәтиже бағанының атауы")),
  pr("integer", 2, "INTEGER", g("тип: целое число", "тип: бүтін сан")),
  pr("varchar", 2, "VARCHAR(20)", g("тип: текст до 20 символов", "тип: 20 таңбаға дейінгі мәтін")),
  pr("real", 2, "REAL", g("тип: дробное число", "тип: нақты (бөлшек) сан")),
  pr("date", 2, "DATE", g("тип: дата", "тип: күн")),
  pr("primary", 2, "PRIMARY KEY", g("ключ: у каждой записи своё значение", "кілт: әр жазбада өз мәні бар")),
  pr("nowhere", 3, g("UPDATE или DELETE без WHERE", "WHERE жоқ UPDATE немесе DELETE"), g("затрагивает все записи", "барлық жазбаға әсер етеді")),
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
  sq("kw-insert", 1, "Каким словом начинается команда, которая добавляет новую запись в таблицу?", "Кестеге жаңа жазба қосатын команда қай сөзден басталады?", "INSERT", "text", "Новую запись добавляет INSERT INTO.", "Жаңа жазбаны INSERT INTO қосады.", { ru: "Слово по-английски значит «вставить».", kk: "Бұл сөз ағылшынша «кірістіру» дегенді білдіреді." }),
  sq("kw-update", 1, "Каким словом начинается команда, которая меняет значения в существующих записях?", "Бар жазбалардағы мәндерді өзгертетін команда қай сөзден басталады?", "UPDATE", "text", "Значения меняет UPDATE ... SET.", "Мәндерді UPDATE ... SET өзгертеді.", { ru: "Слово по-английски значит «обновить».", kk: "Бұл сөз ағылшынша «жаңарту» дегенді білдіреді." }),
  sq("kw-delete", 1, "Каким словом начинается команда, которая удаляет записи из таблицы?", "Кестеден жазбаларды жоятын команда қай сөзден басталады?", "DELETE", "text", "Записи удаляет DELETE FROM.", "Жазбаларды DELETE FROM жояды.", { ru: "Слово по-английски значит «удалить».", kk: "Бұл сөз ағылшынша «жою» дегенді білдіреді." }),
  sq("kw-create", 1, "Какими двумя словами начинается команда, которая создаёт новую таблицу?", "Жаңа кесте құратын команда қандай екі сөзден басталады?", "CREATE TABLE", "text", "Таблицу создаёт CREATE TABLE.", "Кестені CREATE TABLE құрады.", { ru: "Слово по-английски значит «создать».", kk: "Бұл сөз ағылшынша «құру» дегенді білдіреді." }),
  sq("kw-count", 1, "Как называется итоговая функция, которая считает число записей? Напиши название без скобок.", "Жазбалар санын санайтын қорытынды функция қалай аталады? Атауын жақшасыз жаз.", "COUNT", "text", "COUNT(*) возвращает число записей.", "COUNT(*) жазбалар санын қайтарады.", { ru: "Английское слово означает «считать».", kk: "Ағылшын сөзі «санау» дегенді білдіреді." }),
  sq("kw-avg", 1, "Как называется итоговая функция, которая находит среднее значение? Напиши название без скобок.", "Орташа мәнді табатын қорытынды функция қалай аталады? Атауын жақшасыз жаз.", "AVG", "text", "AVG — среднее значение (average).", "AVG — орташа мән (average).", { ru: "Название — сокращение английского слова average.", kk: "Атауы — ағылшынша average сөзінің қысқартылуы." }),
  sq("kw-groupby", 2, "Какие слова задают подсчёт итогов по группам записей?", "Жазбалар топтары бойынша қорытынды санауды қандай сөздер береді?", "GROUP BY", "text", "GROUP BY раскладывает записи по группам.", "GROUP BY жазбаларды топтарға бөледі.", { ru: "По-английски: «группировать по».", kk: "Ағылшынша: «... бойынша топтау»." }),
  sq("kw-as", 2, "Какое слово задаёт название столбца результата, например COUNT(*) ... N?", "Нәтиже бағанының атауын қандай сөз береді, мысалы COUNT(*) ... N?", "AS", "text", "COUNT(*) AS N: столбец называется N.", "COUNT(*) AS N: баған N деп аталады.", { ru: "Это короткое слово из двух букв.", kk: "Бұл екі әріптен тұратын қысқа сөз." }),
];

function shortGenerated(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  const n = int(rand, 5, 9);
  const k = int(rand, 1, n - 3);
  const marks = Array.from({ length: n }, () => int(rand, 3, 5));
  const total = marks.reduce((a, b) => a + b, 0);
  if (level === 1) {
    return sq(`del-left-${n}-${k}`, 1,
      `В таблице ${n} записей. Запрос DELETE удалил ${k} из них. Сколько записей осталось?`,
      `Кестеде ${n} жазба бар. DELETE сұранысы олардың ${k} жазбасын жойды. Неше жазба қалды?`,
      String(n - k), "number",
      `Было ${n}, удалено ${k}, осталось ${n} − ${k} = ${n - k}.`,
      `${n} болған, ${k} жойылды, қалғаны ${n} − ${k} = ${n - k}.`,
      { ru: "Из общего числа вычти число удалённых записей.", kk: "Жалпы саннан жойылған жазбалар санын алып таста." });
  }
  if (level === 2) {
    return sq(`sum-${marks.join("")}`, 2,
      `Оценки учеников: ${marks.join(", ")}. Чему равно SUM(Mark)?`,
      `Оқушылардың бағалары: ${marks.join(", ")}. SUM(Mark) неге тең?`,
      String(total), "number",
      `SUM — сумма значений: ${marks.join(" + ")} = ${total}.`,
      `SUM — мәндер қосындысы: ${marks.join(" + ")} = ${total}.`,
      { ru: "Сложи все оценки.", kk: "Барлық бағаны қос." });
  }
  // Уровень 3: два шага — сначала UPDATE, потом SUM по изменённым оценкам.
  if (!marks.includes(3)) marks[int(rand, 0, n - 1)] = 3;
  const threes = marks.filter((m) => m === 3).length;
  const after = marks.map((m) => (m === 3 ? 4 : m));
  const sumAfter = after.reduce((x, y) => x + y, 0);
  return sq(`upd-sum-${marks.join("")}`, 3,
    `Оценки в поле Mark: ${marks.join(", ")}. Выполнен запрос UPDATE T SET Mark = 4 WHERE Mark = 3; Чему теперь равно SUM(Mark)?`,
    `Mark өрісіндегі бағалар: ${marks.join(", ")}. UPDATE T SET Mark = 4 WHERE Mark = 3; сұранысы орындалды. Енді SUM(Mark) неге тең?`,
    String(sumAfter), "number",
    `UPDATE меняет каждую тройку на 4 (троек: ${threes}). Новые оценки: ${after.join(", ")}. SUM = ${after.join(" + ")} = ${sumAfter}.`,
    `UPDATE әр 3 бағасын 4-ке ауыстырады (3 бағасының саны: ${threes}). Жаңа бағалар: ${after.join(", ")}. SUM = ${after.join(" + ")} = ${sumAfter}.`,
    { ru: "Сначала замени по условию WHERE все тройки, потом сложи все оценки.", kk: "Алдымен WHERE шарты бойынша барлық 3 бағасын ауыстыр, содан кейін барлық бағаны қос." });
}

function byLevel<T extends { level: Level }>(items: T[], level: Level): T[] {
  for (const d of [0, -1, 1, -2, 2]) {
    const found = items.filter((x) => x.level === level + d);
    if (found.length) return found;
  }
  return items;
}

const modifyBank: SkillBank = {
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
    // Половина коротких вопросов — вычисляемые (остаток после DELETE, SUM), половина — на термины.
    if (rand() < 0.5) return shortGenerated(level, seed);
    const pool = byLevel(SHORTS, level);
    return pool[Math.floor(rand() * pool.length)];
  },
};

export const BANKS: SkillBank[] = [modifyBank];
