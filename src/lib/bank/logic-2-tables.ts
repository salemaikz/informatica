import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка logic.tables: таблицы истинности. Выражения строит и считает код (дерево Expr),
// правильный ответ всегда вычисляется перебором всех наборов. Тексты после переменных чисел —
// без падежных окончаний (в казахском окончание зависит от числа).

const SKILL = "logic.tables";

// ---------- Дерево выражения ----------

type Op = "and" | "or" | "imp" | "eqv";
type Bit = 0 | 1;
type Env = Record<string, Bit>;
type Expr = { t: "v"; n: string } | { t: "not"; a: Expr } | { t: "bin"; op: Op; a: Expr; b: Expr };

const v = (n: string): Expr => ({ t: "v", n });
const not = (a: Expr): Expr => ({ t: "not", a });
const bin = (op: Op, a: Expr, b: Expr): Expr => ({ t: "bin", op, a, b });
/** Отрицание без двойного ¬: neg(¬A) = A. */
const neg = (e: Expr): Expr => (e.t === "not" ? e.a : not(e));

const SYM: Record<Op, string> = { and: "∧", or: "∨", imp: "→", eqv: "↔" };
const PREC: Record<Op, number> = { and: 4, or: 3, imp: 2, eqv: 1 };
const OPS: Op[] = ["and", "or", "imp", "eqv"];
const NAMES = ["A", "B", "C", "D"];

/**
 * Запись выражения. explicit — лишние скобки вокруг вложенных операций (для начинающих);
 * иначе только по приоритету ¬, ∧, ∨ (на уровне C ученик сам учитывает приоритет).
 * Операнды → и ↔ всегда в скобках, чтобы запись читалась однозначно.
 */
function show(e: Expr, explicit = true): string {
  if (e.t === "v") return e.n;
  if (e.t === "not") return e.a.t === "v" ? `¬${e.a.n}` : `¬(${show(e.a, explicit)})`;
  const wrap = (c: Expr, right: boolean): string => {
    const s = show(c, explicit);
    if (c.t !== "bin") return s;
    const must =
      e.op === "imp" || e.op === "eqv"
        ? true
        : explicit
          ? c.op !== e.op || right
          : PREC[c.op] < PREC[e.op] || (PREC[c.op] === PREC[e.op] && right);
    return must ? `(${s})` : s;
  };
  return `${wrap(e.a, false)} ${SYM[e.op]} ${wrap(e.b, true)}`;
}

const apply = (op: Op, a: Bit, b: Bit): Bit => {
  if (op === "and") return (a & b) as Bit;
  if (op === "or") return (a | b) as Bit;
  if (op === "imp") return a === 1 && b === 0 ? 0 : 1;
  return a === b ? 1 : 0;
};

function evalE(e: Expr, env: Env): Bit {
  if (e.t === "v") return env[e.n];
  if (e.t === "not") return evalE(e.a, env) === 1 ? 0 : 1;
  return apply(e.op, evalE(e.a, env), evalE(e.b, env));
}

/** Все наборы значений в порядке двоичного счёта: 000, 001, …, 111. */
function allSets(count: number): Bit[][] {
  return Array.from({ length: 2 ** count }, (_, i) => Array.from({ length: count }, (_, k) => ((i >> (count - 1 - k)) & 1) as Bit));
}

const envOf = (vars: string[], bits: Bit[]): Env => Object.fromEntries(vars.map((n, i) => [n, bits[i]]));
const column = (e: Expr, vars: string[]): string => allSets(vars.length).map((s) => evalE(e, envOf(vars, s))).join("");
const countOf = (col: string, ch: "0" | "1") => col.split("").filter((c) => c === ch).length;

/** Подвыражения по порядку выполнения: «¬B = 1; A ∨ ¬B = 1». */
function trace(e: Expr, env: Env, explicit: boolean): string {
  const parts: string[] = [];
  const walk = (x: Expr): Bit => {
    if (x.t === "v") return env[x.n];
    const r: Bit = x.t === "not" ? (walk(x.a) === 1 ? 0 : 1) : apply(x.op, walk(x.a), walk(x.b));
    parts.push(`${show(x, explicit)} = ${r}`);
    return r;
  };
  walk(e);
  return parts.join("; ");
}

/** Выражение зависит от всех переменных и не постоянно. */
function isGood(e: Expr, vars: string[]): boolean {
  const col = column(e, vars);
  const ones = countOf(col, "1");
  if (ones === 0 || ones === col.length) return false;
  return vars.every((_, k) => {
    const step = 2 ** (vars.length - 1 - k);
    return col.split("").some((c, i) => ((i >> (vars.length - 1 - k)) & 1) === 0 && c !== col[i + step]);
  });
}

// ---------- Случайные выражения ----------

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });
const lit = (rand: Rand, name: string): Expr => (rand() < 0.5 ? v(name) : not(v(name)));

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const sup = (n: number) => String(n).replace(/\d/g, (d) => SUP[d]);

const THREE = ["A", "B", "C"];
const THREE_OPS: Op[] = ["and", "or", "imp"];

/** Две переменные: ¬A ∨ B, A ∧ ¬B, A ↔ B … */
function exprTwo(rand: Rand, ops: Op[] = OPS): Expr {
  return bin(pick(rand, ops), lit(rand, "A"), lit(rand, "B"));
}

/** Две переменные посложнее: ¬(A ∧ ¬B) и обычные. */
function exprTwoHard(rand: Rand): Expr {
  const inner = bin(pick(rand, OPS), lit(rand, "A"), lit(rand, "B"));
  return rand() < 0.5 ? not(inner) : inner;
}

/** Три переменные, две операции: (A ∨ B) ∧ ¬C, A → (B ∧ C). */
function exprThree(rand: Rand): Expr {
  const names = shuffle(THREE, rand);
  const o1 = pick(rand, THREE_OPS);
  const o2 = pick(rand, THREE_OPS.filter((o) => o !== o1));
  const [x, y, z] = names.map((n) => lit(rand, n));
  return rand() < 0.5 ? bin(o1, bin(o2, x, y), z) : bin(o1, x, bin(o2, y, z));
}

/** Три переменные, четыре «листа» ((A ∨ B) ∧ (¬A ∨ C)), четыре переменные, обёртка ¬. */
function exprHard(rand: Rand): { e: Expr; vars: string[] } {
  if (rand() < 0.3) {
    const vars = NAMES;
    const names = shuffle(vars, rand);
    const [p, q, r, s] = names.map((n) => lit(rand, n));
    const o1 = pick(rand, THREE_OPS);
    const o2 = pick(rand, THREE_OPS);
    const o3 = pick(rand, ["and", "or"] as Op[]);
    return { e: bin(o3, bin(o1, p, q), bin(o2, r, s)), vars };
  }
  const names = shuffle([...THREE, pick(rand, THREE)], rand);
  const [p, q, r, s] = names.map((n) => lit(rand, n));
  const o1 = pick(rand, OPS);
  const o2 = pick(rand, THREE_OPS);
  const o3 = pick(rand, ["and", "or", "imp"] as Op[]);
  const inner = bin(o3, bin(o1, p, q), bin(o2, r, s));
  return { e: rand() < 0.25 ? not(inner) : inner, vars: THREE };
}

/** Выражения без вырожденных случаев (константа, лишняя переменная). */
function goodThree(rand: Rand): Expr {
  let e = exprThree(rand);
  for (let i = 0; i < 40 && !isGood(e, THREE); i++) e = exprThree(rand);
  return e;
}
function goodHard(rand: Rand): { e: Expr; vars: string[] } {
  let h = exprHard(rand);
  for (let i = 0; i < 40 && !isGood(h.e, h.vars); i++) h = exprHard(rand);
  return h;
}

/** Одно небольшое изменение: сменить операцию или добавить/убрать ¬ у переменной. */
function mutate(e: Expr, rand: Rand): Expr {
  const count = (x: Expr): number => (x.t === "v" ? 1 : x.t === "not" ? (x.a.t === "v" ? 1 : count(x.a)) : 1 + count(x.a) + count(x.b));
  const k = { i: Math.floor(rand() * count(e)) };
  const walk = (x: Expr): Expr => {
    if (x.t === "v") return k.i-- === 0 ? not(x) : x;
    if (x.t === "not") {
      if (x.a.t === "v") return k.i-- === 0 ? x.a : x;
      return not(walk(x.a));
    }
    if (k.i-- === 0) return { ...x, op: pick(rand, OPS.filter((o) => o !== x.op)) };
    return { ...x, a: walk(x.a), b: walk(x.b) };
  };
  return walk(e);
}

// ---------- Общие куски заданий ----------

const setText = (vars: string[], bits: Bit[]) => vars.map((n, i) => `${n} = ${bits[i]}`).join(", ");
const tuple = (bits: Bit[]) => `(${bits.join(", ")})`;
const varList = (vars: string[]) => vars.join(", ");
const word = (truth: boolean): L => (truth ? { ru: "истинно", kk: "ақиқат" } : { ru: "ложно", kk: "жалған" });
const compact = (s: string) => s.replace(/ /g, "");

interface Opt {
  text: Text;
  /** null — верный вариант. */
  why: L | null;
}

function makeChoice(rand: Rand, opts: Opt[], keepOrder = false) {
  const list = keepOrder ? opts : shuffle(opts, rand);
  return { options: list.map((o) => o.text), correct: list.findIndex((o) => o.why === null), whyWrong: list.map((o) => o.why) };
}

const HINT_TABLE: L = {
  ru: "Составь таблицу: столбцы переменных, затем промежуточные столбцы по приоритету (¬, ∧, ∨, →, ↔), затем итог.",
  kk: "Кесте құр: алдымен айнымалылардың бағандары, сосын басымдық бойынша аралық бағандар (¬, ∧, ∨, →, ↔), соңында қорытынды.",
};

// ---------- Задания ----------

/** A: сколько строк при n переменных. */
function qRows(rand: Rand, seed: number): QuestionStep {
  const n = pick(rand, [3, 5, 6, 7]);
  const N = 2 ** n;
  const extra = rand() < 0.5 ? N / 2 : N * 2;
  const opts: Opt[] = [
    { text: String(N), why: null },
    {
      text: String(n * n),
      why: {
        ru: `${n}${sup(2)} = ${n * n} — степень записана наоборот: нужно 2 в степени ${n}, а не ${n} в степени 2.`,
        kk: `${n}${sup(2)} = ${n * n} — дәреже кері жазылған: ${n}-тің 2-дәрежесі емес, 2-нің ${n}-дәрежесі керек.`,
      },
    },
    {
      text: String(2 * n),
      why: {
        ru: `${n} · 2 = ${2 * n} — переменные не складываются: каждая новая удваивает число строк.`,
        kk: `${n} · 2 = ${2 * n} — қате: әр жаңа айнымалы жолдар санын екі есе арттырады.`,
      },
    },
    {
      text: String(extra),
      why:
        extra < N
          ? { ru: `${extra} — это 2${sup(n - 1)}, на одну переменную меньше.`, kk: `${extra} — бұл 2${sup(n - 1)}, бір айнымалы кем.` }
          : { ru: `${extra} — это 2${sup(n + 1)}, на одну переменную больше.`, kk: `${extra} — бұл 2${sup(n + 1)}, бір айнымалы артық.` },
    },
  ];
  const c = makeChoice(rand, opts);
  const step: ChoiceStep = {
    id: `g:${SKILL}:rows:${n}:${seed}`,
    type: "choice",
    skill: SKILL,
    level: 1,
    prompt: {
      ru: `Сколько строк в таблице истинности выражения с ${n} переменными (без строки заголовков)?`,
      kk: `${n} айнымалысы бар өрнектің ақиқат кестесінде неше жол болады (тақырып жолынсыз)?`,
    },
    ...c,
    hint: {
      ru: "Каждая новая переменная удваивает число наборов: 1 → 2, 2 → 4, 3 → 8.",
      kk: "Әрбір жаңа айнымалы жиындар санын екі есе арттырады: 1 → 2, 2 → 4, 3 → 8.",
    },
    explanation: {
      ru: `Каждая из ${n} переменных удваивает число наборов: 2${sup(n)} = ${N} строк.`,
      kk: `${n} айнымалының әрқайсысы жиындар санын екі есе арттырады: 2${sup(n)} = ${N} жол.`,
    },
  };
  return step;
}

/** A: значение выражения на одном наборе. */
function qValue(rand: Rand, seed: number): QuestionStep {
  const vars = ["A", "B"];
  const e = exprTwo(rand);
  const bits = pick(rand, allSets(2));
  const env = envOf(vars, bits);
  const r = evalE(e, env);
  const s = show(e);
  const step: InputStep = {
    id: `g:${SKILL}:value:${compact(s)}:${compact(setText(vars, bits))}:${seed}`,
    type: "input",
    skill: SKILL,
    level: 1,
    prompt: {
      ru: `Дано выражение F = ${s}. Чему равно F при ${setText(vars, bits)}?`,
      kk: `F = ${s} өрнегі берілген. ${setText(vars, bits)} болғанда F неге тең?`,
    },
    answers: [String(r)],
    mode: "number",
    hint: {
      ru: "Подставь значения вместо букв и выполни операции по порядку: сначала ¬, потом остальные.",
      kk: "Әріптердің орнына мәндерді қойып, амалдарды ретімен орында: алдымен ¬, сосын қалғандары.",
    },
    explanation: {
      ru: `Подставляем значения и считаем по порядку: ${trace(e, env, true)}. Ответ: ${r}.`,
      kk: `Мәндерді қойып, ретімен есептейміз: ${trace(e, env, true)}. Жауабы: ${r}.`,
    },
  };
  return step;
}

/** A: единственный набор, на котором выражение истинно (или ложно). */
function qSetOne(rand: Rand, seed: number): QuestionStep {
  const vars = ["A", "B"];
  const e = exprTwo(rand, THREE_OPS);
  const col = column(e, vars);
  const target = countOf(col, "1") === 1; // единственная единица → ищем истинный набор, иначе единственный ноль
  const sets = allSets(2);
  const goal: Bit = target ? 1 : 0;
  const s = show(e);
  const opts: Opt[] = sets.map((bits) => {
    const val = evalE(e, envOf(vars, bits));
    return {
      text: tuple(bits),
      why:
        val === goal
          ? null
          : {
              ru: `При ${setText(vars, bits)} выражение равно ${val}, а нужно ${goal}.`,
              kk: `${setText(vars, bits)} болғанда өрнектің мәні ${val}, ал ${goal} керек.`,
            },
    };
  });
  const c = makeChoice(rand, opts, true);
  const answer = sets[c.correct];
  const rows = sets.map((bits) => `${tuple(bits)} → ${evalE(e, envOf(vars, bits))}`).join("; ");
  const w = word(target);
  const step: ChoiceStep = {
    id: `g:${SKILL}:setone:${compact(s)}:${target ? "t" : "f"}:${seed}`,
    type: "choice",
    skill: SKILL,
    level: 1,
    prompt: {
      ru: `Для какого набора значений (A, B) выражение ${s} ${w.ru}?`,
      kk: `(A, B) мәндерінің қай жиынында ${s} өрнегі ${w.kk} болады?`,
    },
    ...c,
    hint: {
      ru: "Выпиши все четыре набора и посчитай выражение для каждого — подойдёт ровно один.",
      kk: "Төрт жиынды түгел жазып, әрқайсысы үшін өрнекті есепте — тек біреуі сәйкес келеді.",
    },
    explanation: {
      ru: `Считаем выражение на каждом наборе: ${rows}. Подходит набор ${tuple(answer)}.`,
      kk: `Өрнекті әр жиында есептейміз: ${rows}. ${tuple(answer)} жиыны сәйкес келеді.`,
    },
  };
  return step;
}

/** Общий ответ «сколько наборов»: истинных или ложных. */
function countQuestion(kind: string, e: Expr, vars: string[], wantOnes: boolean, level: Level, explicit: boolean, seed: number): InputStep {
  const col = column(e, vars);
  const ones = countOf(col, "1");
  const zeros = col.length - ones;
  const k = wantOnes ? ones : zeros;
  const s = show(e, explicit);
  const w = word(wantOnes);
  return {
    id: `g:${SKILL}:${kind}:${compact(s)}:${wantOnes ? "t" : "f"}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `Сколько существует наборов значений переменных ${varList(vars)}, при которых выражение ${s} ${w.ru}?`,
      kk: `(${varList(vars)}) мәндерінің қанша жиынында ${s} өрнегі ${w.kk} болады?`,
    },
    answers: [String(k)],
    mode: "number",
    hint: HINT_TABLE,
    explanation: {
      ru: `Составляем таблицу из ${col.length} строк. Итоговый столбец: ${col}. ${wantOnes ? "Единиц" : "Нулей"} в нём: ${k}. Проверка: ${ones} + ${zeros} = ${col.length}.`,
      kk: `${col.length} жолдан тұратын кесте құрамыз. Қорытынды баған: ${col}. ${wantOnes ? "Бірлер" : "Нөлдер"} саны: ${k}. Тексеру: ${ones} + ${zeros} = ${col.length}.`,
    },
  };
}

/** B: выписать итоговый столбец для двух переменных. */
function qColumn(rand: Rand, seed: number): QuestionStep {
  const vars = ["A", "B"];
  let e = exprTwoHard(rand);
  for (let i = 0; i < 20 && !isGood(e, vars); i++) e = exprTwoHard(rand);
  const s = show(e);
  const col = column(e, vars);
  const rows = allSets(2)
    .map((bits) => `${bits.join("")} → ${evalE(e, envOf(vars, bits))}`)
    .join("; ");
  return {
    id: `g:${SKILL}:column:${compact(s)}:${seed}`,
    type: "input",
    skill: SKILL,
    level: 2,
    prompt: {
      ru: `Выпиши значения F = ${s} для наборов (A, B) в порядке 00, 01, 10, 11 — четыре цифры подряд.`,
      kk: `F = ${s} өрнегінің мәндерін (A, B) жиындарының 00, 01, 10, 11 ретімен жаз — төрт цифр қатар.`,
    },
    answers: [col],
    mode: "text",
    hint: {
      ru: "Выпиши четыре набора и для каждого вычисли выражение по порядку: скобки, затем ¬, затем остальное.",
      kk: "Төрт жиынды жазып, әрқайсысы үшін өрнекті ретімен есепте: жақша, сосын ¬, соңында қалғаны.",
    },
    explanation: {
      ru: `Считаем F на наборах: ${rows}. Итоговый столбец: ${col}.`,
      kk: `F мәнін жиындар бойынша есептейміз: ${rows}. Қорытынды баған: ${col}.`,
    },
  };
}

/** B: из четырёх наборов (A, B, C) выбрать тот, где выражение истинно/ложно. */
function qFindSet(rand: Rand, seed: number): QuestionStep {
  const vars = THREE;
  const e = goodThree(rand);
  const col = column(e, vars);
  const ones = countOf(col, "1");
  // Нужен «одинокий» ответ среди четырёх: берём то значение, которого хотя бы 1, а противоположного хотя бы 3.
  const canTrue = 8 - ones >= 3; // единиц хотя бы 1 (isGood), нулей хотя бы 3
  const canFalse = ones >= 3;
  const goal: Bit = canTrue && canFalse ? (rand() < 0.5 ? 1 : 0) : canTrue ? 1 : 0;
  const sets = allSets(3);
  const good = sets.filter((b) => evalE(e, envOf(vars, b)) === goal);
  const bad = sets.filter((b) => evalE(e, envOf(vars, b)) !== goal);
  const chosen = [pick(rand, good), ...shuffle(bad, rand).slice(0, 3)];
  const ordered = chosen.sort((x, y) => parseInt(x.join(""), 2) - parseInt(y.join(""), 2));
  const s = show(e);
  const opts: Opt[] = ordered.map((bits) => {
    const val = evalE(e, envOf(vars, bits));
    return {
      text: tuple(bits),
      why:
        val === goal
          ? null
          : {
              ru: `При ${setText(vars, bits)} выражение равно ${val}, а нужно ${goal}.`,
              kk: `${setText(vars, bits)} болғанда өрнектің мәні ${val}, ал ${goal} керек.`,
            },
    };
  });
  const c = makeChoice(rand, opts, true);
  const answer = ordered[c.correct];
  const w = word(goal === 1);
  const step: ChoiceStep = {
    id: `g:${SKILL}:findset:${compact(s)}:${goal}:${seed}`,
    type: "choice",
    skill: SKILL,
    level: 2,
    prompt: {
      ru: `Для какого из наборов значений (A, B, C) выражение ${s} ${w.ru}?`,
      kk: `Төмендегі (A, B, C) жиындарының қайсысында ${s} өрнегі ${w.kk} болады?`,
    },
    ...c,
    hint: {
      ru: "Не обязательно строить всю таблицу: подставь значения каждого варианта в выражение и сравни.",
      kk: "Бүкіл кестені құрудың қажеті жоқ: әр нұсқаның мәндерін өрнекке қойып, салыстыр.",
    },
    explanation: {
      ru: `Проверяем варианты по очереди. Подходит набор ${tuple(answer)}: ${trace(e, envOf(vars, answer), true)}.`,
      kk: `Нұсқаларды ретімен тексереміз. ${tuple(answer)} жиыны сәйкес келеді: ${trace(e, envOf(vars, answer), true)}.`,
    },
  };
  return step;
}

/** C: какое выражение соответствует фрагменту таблицы. */
function qFragment(rand: Rand, seed: number): QuestionStep {
  const vars = THREE;
  const sets = allSets(3);
  for (let attempt = 0; attempt < 200; attempt++) {
    const target = goodThree(rand);
    // Три правдоподобных неверных варианта — небольшие изменения верного.
    const cols = new Set<string>([column(target, vars)]);
    const wrong: Expr[] = [];
    for (let t = 0; t < 30 && wrong.length < 3; t++) {
      const m = mutate(target, rand);
      const col = column(m, vars);
      if (cols.has(col) || !isGood(m, vars)) continue;
      cols.add(col);
      wrong.push(m);
    }
    if (wrong.length < 3) continue;
    const cands = [target, ...wrong];
    const colsOf = cands.map((c) => column(c, vars));
    // Фрагмент: 3 строки, по которым подходит только верное выражение (иначе 4 строки).
    const fits = (rows: number[]) => colsOf.slice(1).every((cc) => rows.some((r) => cc[r] !== colsOf[0][r]));
    const triples: number[][] = [];
    for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) for (let c = b + 1; c < 8; c++) if (fits([a, b, c])) triples.push([a, b, c]);
    if (!triples.length) continue;
    const rows = pick(rand, triples);
    const text = (x: Expr) => show(x, false);
    const opts: Opt[] = cands.map((c, i) => {
      if (i === 0) return { text: text(c), why: null };
      const r = rows.find((rr) => colsOf[i][rr] !== colsOf[0][rr])!;
      return {
        text: text(c),
        why: {
          ru: `В строке ${setText(vars, sets[r])} это выражение даёт ${colsOf[i][r]}, а в таблице F = ${colsOf[0][r]}.`,
          kk: `${setText(vars, sets[r])} жолында бұл өрнек ${colsOf[i][r]} береді, ал кестеде F = ${colsOf[0][r]}.`,
        },
      };
    });
    const c = makeChoice(rand, opts);
    const scene: Scene = {
      kind: "table",
      columns: [...vars, "F"],
      rows: rows.map((r) => [...sets[r].map(String), colsOf[0][r]]),
      mono: true,
    };
    const fvals = rows.map((r) => colsOf[0][r]).join(", ");
    const step: ChoiceStep = {
      id: `g:${SKILL}:fragment:${compact(text(target))}:${rows.join("")}:${seed}`,
      type: "choice",
      skill: SKILL,
      level: 3,
      prompt: {
        ru: "В таблице показаны три строки таблицы истинности выражения F (остальные скрыты). Какое выражение подходит?",
        kk: "Кестеде F өрнегінің ақиқат кестесінің үш жолы көрсетілген (қалғандары жасырылған). Қай өрнек сәйкес келеді?",
      },
      scene,
      ...c,
      hint: {
        ru: "Подставь значения одной строки во все варианты — несколько сразу отпадут. Затем проверь следующую строку.",
        kk: "Бір жолдың мәндерін барлық нұсқаға қойып көр — біразы бірден түседі. Содан кейін келесі жолды тексер.",
      },
      explanation: {
        ru: `Подставляем значения из каждой строки в варианты и вычёркиваем те, что не совпали с F. Подходит только ${text(target)}: в строках фрагмента оно даёт ${fvals}.`,
        kk: `Әр жолдың мәндерін нұсқаларға қойып, F-пен сәйкес келмегенін сызып тастаймыз. Тек ${text(target)} сәйкес келеді: үзіндінің жолдарында ол ${fvals} береді.`,
      },
    };
    return step;
  }
  // Запасной вариант (практически недостижим): простой счёт единиц.
  const e = bin("or", v("A"), bin("and", v("B"), v("C")));
  return countQuestion("count", e, vars, true, 3, false, seed);
}

/** B/C: сколько наборов. */
function qCount(rand: Rand, seed: number, level: Level): QuestionStep {
  if (level === 2) {
    return countQuestion("count", goodThree(rand), THREE, true, 2, true, seed);
  }
  const h = goodHard(rand);
  return countQuestion("count", h.e, h.vars, rand() < 0.65, 3, false, seed);
}

function question(level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  if (level === 1) {
    const kind = pick(rand, ["rows", "value", "setone", "value", "setone"] as const);
    if (kind === "rows") return qRows(rand, seed);
    return kind === "value" ? qValue(rand, seed) : qSetOne(rand, seed);
  }
  if (level === 2) {
    const kind = pick(rand, ["count", "column", "findset", "count", "findset"] as const);
    if (kind === "column") return qColumn(rand, seed);
    return kind === "findset" ? qFindSet(rand, seed) : qCount(rand, seed, 2);
  }
  const kind = pick(rand, ["fragment", "count", "fragment", "count"] as const);
  return kind === "fragment" ? qFragment(rand, seed) : qCount(rand, seed, 3);
}

// ---------- «Верю — не верю» ----------

/** Пары равносильных записей: левая и правая части (x, y — литералы). */
const EQUIV: ((x: Expr, y: Expr) => [Expr, Expr])[] = [
  (x, y) => [bin("imp", x, y), bin("or", neg(x), y)],
  (x, y) => [not(bin("and", x, y)), bin("or", neg(x), neg(y))],
  (x, y) => [not(bin("or", x, y)), bin("and", neg(x), neg(y))],
  (x, y) => [bin("imp", x, y), bin("imp", neg(y), neg(x))],
  (x, y) => [bin("eqv", x, y), bin("and", bin("imp", x, y), bin("imp", y, x))],
];

function statement(level: Level, seed: number): Statement {
  const rand = seeded(seed);
  const kind = level === 1 ? pick(rand, ["rows", "value"] as const) : level === 2 ? pick(rand, ["value", "count"] as const) : pick(rand, ["equal", "count"] as const);
  if (kind === "rows") {
    const n = pick(rand, [3, 5, 6, 7]);
    const real = 2 ** n;
    const truth = rand() < 0.5;
    const claim = truth ? real : pick(rand, [n * n, 2 * n, real / 2, real * 2]);
    return {
      id: `s:${SKILL}:rows:${n}:${claim}`,
      skill: SKILL,
      level,
      text: {
        ru: `Таблица истинности выражения с ${n} переменными содержит ${claim} строк`,
        kk: `${n} айнымалысы бар өрнектің ақиқат кестесінде ${claim} жол бар`,
      },
      value: claim === real,
      explanation: { ru: `Число строк — 2${sup(n)} = ${real}.`, kk: `Жолдар саны — 2${sup(n)} = ${real}.` },
    };
  }
  if (kind === "value") {
    const vars = level === 1 ? ["A", "B"] : THREE;
    const e = level === 1 ? exprTwo(rand) : exprThree(rand);
    const bits = pick(rand, allSets(vars.length));
    const env = envOf(vars, bits);
    const actual = evalE(e, env) === 1;
    const claimTrue = rand() < 0.5;
    const s = show(e);
    const w = word(claimTrue);
    return {
      id: `s:${SKILL}:value:${compact(s)}:${compact(setText(vars, bits))}:${claimTrue ? "t" : "f"}`,
      skill: SKILL,
      level,
      text: { ru: `При ${setText(vars, bits)} выражение ${s} ${w.ru}`, kk: `${setText(vars, bits)} болғанда ${s} өрнегі ${w.kk}` },
      value: actual === claimTrue,
      explanation: { ru: `${trace(e, env, true)}.`, kk: `${trace(e, env, true)}.` },
    };
  }
  if (kind === "count") {
    const h = level === 2 ? { e: goodThree(rand), vars: THREE } : goodHard(rand);
    const e = h.e;
    const vars = h.vars;
    const explicit = level === 2;
    const col = column(e, vars);
    const ones = countOf(col, "1");
    const N = col.length;
    const truth = rand() < 0.5;
    const claim = truth ? ones : Math.max(1, ones + pick(rand, [-1, 1]));
    const s = show(e, explicit);
    return {
      id: `s:${SKILL}:count:${compact(s)}:${claim}`,
      skill: SKILL,
      level,
      text: {
        ru: `Выражение ${s} истинно ровно на ${claim} наборах из ${N}`,
        kk: `Барлық ${N} жиынның ішінде ${s} өрнегі ${claim} жиында ақиқат болады`,
      },
      value: claim === ones,
      explanation: { ru: `Итоговый столбец: ${col} — единиц ${ones}.`, kk: `Қорытынды баған: ${col} — бірлер ${ones}.` },
    };
  }
  // equal: равны ли итоговые столбцы двух записей
  const vars = ["A", "B", "C"];
  const x = lit(rand, pick(rand, vars.slice(0, 2)));
  const y = lit(rand, "C");
  const [l, r0] = pick(rand, EQUIV)(x, y);
  let r = r0;
  const equalClaim = rand() < 0.5;
  if (!equalClaim) r = mutate(r, rand);
  const used = vars.filter((n) => show(l).includes(n) || show(r).includes(n));
  const sl = show(l, false);
  const sr = show(r, false);
  const cl = column(l, used);
  const cr = column(r, used);
  return {
    id: `s:${SKILL}:equal:${compact(sl)}:${compact(sr)}`,
    skill: SKILL,
    level,
    text: {
      ru: `Итоговые столбцы таблиц истинности выражений ${sl} и ${sr} одинаковы`,
      kk: `${sl} және ${sr} өрнектерінің ақиқат кестелерінің қорытынды бағандары бірдей`,
    },
    value: cl === cr,
    explanation: {
      ru: `Столбцы (наборы по порядку): ${cl} и ${cr} — ${cl === cr ? "совпадают" : "различаются"}.`,
      kk: `Бағандар (жиындар ретімен): ${cl} және ${cr} — ${cl === cr ? "сәйкес келеді" : "әртүрлі"}.`,
    },
  };
}

// ---------- Пары ----------

function pair(level: Level, seed: number): Pair {
  const rand = seeded(seed);
  if (level <= 2) {
    const e = level === 1 ? exprTwo(rand) : exprTwoHard(rand);
    const s = show(e);
    return { id: `p:${SKILL}:col:${compact(s)}`, skill: SKILL, level, left: s, right: column(e, ["A", "B"]) };
  }
  const e = goodThree(rand);
  const s = show(e);
  const ones = countOf(column(e, THREE), "1");
  return {
    id: `p:${SKILL}:ones:${compact(s)}`,
    skill: SKILL,
    level,
    left: { ru: `Единиц в столбце F: ${s}`, kk: `F бағанындағы бірлер: ${s}` },
    right: String(ones),
  };
}

// ---------- Короткие вопросы ----------

function short(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  if (level === 1) {
    if (rand() < 0.5) {
      const n = int(rand, 2, 6);
      return {
        id: `q:${SKILL}:rows:${n}`,
        skill: SKILL,
        level,
        prompt: {
          ru: `Сколько строк в таблице истинности выражения с ${n} переменными?`,
          kk: `${n} айнымалысы бар өрнектің ақиқат кестесінде неше жол бар?`,
        },
        answer: String(2 ** n),
        mode: "number",
        explanation: { ru: `2${sup(n)} = ${2 ** n}`, kk: `2${sup(n)} = ${2 ** n}` },
      };
    }
    const e = exprTwo(rand);
    const vars = ["A", "B"];
    const bits = pick(rand, allSets(2));
    const env = envOf(vars, bits);
    const s = show(e);
    return {
      id: `q:${SKILL}:value:${compact(s)}:${compact(setText(vars, bits))}`,
      skill: SKILL,
      level,
      prompt: same(`${s}, ${setText(vars, bits)}: F = ?`),
      answer: String(evalE(e, env)),
      mode: "number",
      explanation: same(trace(e, env, true)),
    };
  }
  const h = level === 2 ? { e: goodThree(rand), vars: THREE } : goodHard(rand);
  const explicit = level === 2;
  const col = column(h.e, h.vars);
  const ones = countOf(col, "1");
  const s = show(h.e, explicit);
  return {
    id: `q:${SKILL}:ones:${compact(s)}`,
    skill: SKILL,
    level,
    prompt: {
      ru: `Сколько единиц в итоговом столбце таблицы истинности выражения ${s}?`,
      kk: `${s} өрнегінің ақиқат кестесінің қорытынды бағанында неше бірлік бар?`,
    },
    answer: String(ones),
    mode: "number",
    explanation: same(`${col} → ${ones}`),
  };
}

export const BANKS: SkillBank[] = [{ skill: SKILL, question, statement, pair, short }];
