import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка logic.laws: законы логики и упрощение. Выражения строит и считает код (дерево Expr):
// правильный ответ — всегда выражение, чей столбец таблицы истинности совпал с исходным (перебор всех наборов),
// неверные варианты — «ошибки по закону» (не та операция, потерянное НЕ, другая переменная) и обязательно
// НЕ равносильны исходному. Шаги упрощения в объяснениях проверяются кодом (каждый шаг равносилен предыдущему).
// Тексты — без падежных окончаний после чисел.

const SKILL = "logic.laws";

// ---------- Дерево выражения ----------

type Bit = 0 | 1;
type Env = Record<string, Bit>;
type Op = "and" | "or" | "imp";
type Expr = { t: "v"; n: string } | { t: "c"; v: Bit } | { t: "not"; a: Expr } | { t: "bin"; op: Op; a: Expr; b: Expr };

const v = (n: string): Expr => ({ t: "v", n });
const k = (b: Bit): Expr => ({ t: "c", v: b });
const not = (a: Expr): Expr => ({ t: "not", a });
/** Отрицание без двойного ¬: neg(¬A) = A. */
const neg = (e: Expr): Expr => (e.t === "not" ? e.a : not(e));
const bin = (op: Op, a: Expr, b: Expr): Expr => ({ t: "bin", op, a, b });
const and = (a: Expr, b: Expr) => bin("and", a, b);
const or = (a: Expr, b: Expr) => bin("or", a, b);
const imp = (a: Expr, b: Expr) => bin("imp", a, b);

const SYM: Record<Op, string> = { and: "∧", or: "∨", imp: "→" };
const OPS: Op[] = ["and", "or", "imp"];

/** Запись: вложенные двухместные операции — всегда в скобках, чтобы приоритеты учить не пришлось. */
function show(e: Expr): string {
  switch (e.t) {
    case "v":
      return e.n;
    case "c":
      return String(e.v);
    case "not":
      return e.a.t === "bin" ? `¬(${show(e.a)})` : `¬${show(e.a)}`;
    case "bin": {
      const w = (x: Expr) => (x.t === "bin" ? `(${show(x)})` : show(x));
      return `${w(e.a)} ${SYM[e.op]} ${w(e.b)}`;
    }
  }
}

const compact = (s: string) => s.replace(/\s+/g, "");
const same = (s: string): L => ({ ru: s, kk: s });

function evalE(e: Expr, env: Env): Bit {
  switch (e.t) {
    case "v":
      return env[e.n];
    case "c":
      return e.v;
    case "not":
      return evalE(e.a, env) ? 0 : 1;
    case "bin": {
      const x = evalE(e.a, env);
      const y = evalE(e.b, env);
      if (e.op === "and") return x & y ? 1 : 0;
      if (e.op === "or") return x | y ? 1 : 0;
      return x === 1 && y === 0 ? 0 : 1;
    }
  }
}

/** Все наборы по возрастанию двоичного числа (первая переменная — старший разряд). */
function allEnvs(vars: string[]): Env[] {
  return Array.from({ length: 2 ** vars.length }, (_, m) => {
    const env: Env = {};
    vars.forEach((n, i) => (env[n] = ((m >> (vars.length - 1 - i)) & 1) as Bit));
    return env;
  });
}

const column = (e: Expr, vars: string[]): string => allEnvs(vars).map((env) => evalE(e, env)).join("");
const ones = (col: string) => col.split("").filter((c) => c === "1").length;

function varsOf(e: Expr, acc = new Set<string>()): Set<string> {
  if (e.t === "v") acc.add(e.n);
  else if (e.t === "not") varsOf(e.a, acc);
  else if (e.t === "bin") {
    varsOf(e.a, acc);
    varsOf(e.b, acc);
  }
  return acc;
}
const varList = (...es: Expr[]): string[] => {
  const all = new Set<string>();
  for (const e of es) varsOf(e, all);
  return ["A", "B", "C", "D"].filter((n) => all.has(n));
};

const equivalent = (a: Expr, b: Expr): boolean => {
  const vars = varList(a, b);
  return column(a, vars) === column(b, vars);
};

const assignText = (vars: string[], env: Env) => vars.map((n) => `${n} = ${env[n]}`).join(", ");

/** Первый набор, на котором выражения различаются. */
function firstDiff(a: Expr, b: Expr): { vars: string[]; env: Env } | undefined {
  const vars = varList(a, b);
  const env = allEnvs(vars).find((e) => evalE(a, e) !== evalE(b, e));
  return env ? { vars, env } : undefined;
}

/** Убирает двойное ¬ (для вариантов ответа, полученных мутацией). */
function norm(e: Expr): Expr {
  if (e.t === "not") {
    const a = norm(e.a);
    return a.t === "not" ? a.a : not(a);
  }
  if (e.t === "bin") return { ...e, a: norm(e.a), b: norm(e.b) };
  return e;
}

// ---------- Законы ----------

const LAW = {
  dneg: { ru: "двойное отрицание", kk: "қос терістеу" },
  excl: { ru: "A ∨ ¬A = 1", kk: "A ∨ ¬A = 1" },
  contra: { ru: "A ∧ ¬A = 0", kk: "A ∧ ¬A = 0" },
  constants: { ru: "законы с 0 и 1", kk: "0 және 1 қатысатын заңдар" },
  comm: { ru: "переместительный закон", kk: "орын ауыстыру заңы" },
  assoc: { ru: "сочетательный закон", kk: "топтау заңы" },
  distr: { ru: "распределительный закон", kk: "үлестіру заңы" },
  dm: { ru: "закон де Моргана", kk: "де Морган заңы" },
  absorb: { ru: "закон поглощения", kk: "жұтылу заңы" },
  imp: { ru: "замена импликации: A → B = ¬A ∨ B", kk: "импликацияны ауыстыру: A → B = ¬A ∨ B" },
} satisfies Record<string, L>;

type Lit = Expr;

interface Rule {
  id: string;
  law: L;
  /** Уровень задания «какое выражение равносильно». */
  level: 1 | 2;
  lhs: (x: Lit, y: Lit, z: Lit) => Expr;
  rhs: (x: Lit, y: Lit, z: Lit) => Expr;
  /** Ещё равносильные записи (для «какое НЕ равносильно»). */
  alts?: (x: Lit, y: Lit, z: Lit) => Expr[];
}

const RULES: Rule[] = [
  { id: "comm-and", law: LAW.comm, level: 1, lhs: (x, y) => and(x, y), rhs: (x, y) => and(y, x) },
  { id: "comm-or", law: LAW.comm, level: 1, lhs: (x, y) => or(x, y), rhs: (x, y) => or(y, x) },
  {
    id: "dm-and",
    law: LAW.dm,
    level: 1,
    lhs: (x, y) => not(and(x, y)),
    rhs: (x, y) => or(neg(x), neg(y)),
    alts: (x, y) => [or(neg(x), neg(y)), or(neg(y), neg(x)), not(and(y, x)), imp(x, neg(y))],
  },
  {
    id: "dm-or",
    law: LAW.dm,
    level: 1,
    lhs: (x, y) => not(or(x, y)),
    rhs: (x, y) => and(neg(x), neg(y)),
    alts: (x, y) => [and(neg(x), neg(y)), and(neg(y), neg(x)), not(or(y, x))],
  },
  {
    id: "imp",
    law: LAW.imp,
    level: 2,
    lhs: (x, y) => imp(x, y),
    rhs: (x, y) => or(neg(x), y),
    alts: (x, y) => [or(neg(x), y), or(y, neg(x)), not(and(x, neg(y))), imp(neg(y), neg(x))],
  },
  {
    id: "distr-and",
    law: LAW.distr,
    level: 2,
    lhs: (x, y, z) => and(x, or(y, z)),
    rhs: (x, y, z) => or(and(x, y), and(x, z)),
    alts: (x, y, z) => [or(and(x, y), and(x, z)), or(and(x, z), and(x, y)), and(x, or(z, y)), or(and(y, x), and(z, x))],
  },
  {
    id: "distr-or",
    law: LAW.distr,
    level: 2,
    lhs: (x, y, z) => or(x, and(y, z)),
    rhs: (x, y, z) => and(or(x, y), or(x, z)),
    alts: (x, y, z) => [and(or(x, y), or(x, z)), and(or(x, z), or(x, y)), or(x, and(z, y))],
  },
  {
    id: "factor",
    law: LAW.distr,
    level: 2,
    lhs: (x, y, z) => or(and(x, y), and(x, z)),
    rhs: (x, y, z) => and(x, or(y, z)),
    alts: (x, y, z) => [and(x, or(y, z)), and(x, or(z, y)), and(or(y, z), x)],
  },
  { id: "assoc", law: LAW.assoc, level: 2, lhs: (x, y, z) => and(and(x, y), z), rhs: (x, y, z) => and(x, and(y, z)) },
  {
    id: "absorb-or",
    law: LAW.absorb,
    level: 2,
    lhs: (x, y) => or(x, and(x, y)),
    rhs: (x) => x,
    alts: (x, y) => [x, and(x, or(x, y)), or(x, and(y, x)), and(x, or(y, x))],
  },
  {
    id: "absorb-and",
    law: LAW.absorb,
    level: 2,
    lhs: (x, y) => and(x, or(x, y)),
    rhs: (x) => x,
    alts: (x, y) => [x, or(x, and(x, y)), and(x, or(y, x)), or(x, and(y, x))],
  },
];

/** Законы с константами: одна переменная; ответ — 0, 1 или сама переменная. */
interface ConstRule {
  id: string;
  law: L;
  /** Нужна «чистая» переменная (без ¬). */
  plain?: boolean;
  lhs: (x: Lit) => Expr;
  rhs: (x: Lit) => Expr;
}
const CONST_RULES: ConstRule[] = [
  { id: "dneg", law: LAW.dneg, plain: true, lhs: (x) => not(not(x)), rhs: (x) => x },
  { id: "excl", law: LAW.excl, lhs: (x) => or(x, neg(x)), rhs: () => k(1) },
  { id: "contra", law: LAW.contra, lhs: (x) => and(x, neg(x)), rhs: () => k(0) },
  { id: "and1", law: LAW.constants, lhs: (x) => and(x, k(1)), rhs: (x) => x },
  { id: "or0", law: LAW.constants, lhs: (x) => or(x, k(0)), rhs: (x) => x },
  { id: "or1", law: LAW.constants, lhs: (x) => or(x, k(1)), rhs: () => k(1) },
  { id: "and0", law: LAW.constants, lhs: (x) => and(x, k(0)), rhs: () => k(0) },
];

/** Упрощение: цепочка шагов, каждый шаг — применение закона. Переменные — «чистые» (A, B, C). */
interface SimplifyRule {
  id: string;
  lhs: (x: Expr, y: Expr) => Expr;
  steps: { law: L; to: (x: Expr, y: Expr) => Expr }[];
}
const SIMPLIFY: SimplifyRule[] = [
  {
    id: "factor-excl",
    lhs: (x, y) => or(and(x, y), and(x, not(y))),
    steps: [
      { law: LAW.distr, to: (x, y) => and(x, or(y, not(y))) },
      { law: LAW.excl, to: (x) => and(x, k(1)) },
      { law: LAW.constants, to: (x) => x },
    ],
  },
  {
    id: "factor-contra",
    lhs: (x, y) => and(or(x, y), or(x, not(y))),
    steps: [
      { law: LAW.distr, to: (x, y) => or(x, and(y, not(y))) },
      { law: LAW.contra, to: (x) => or(x, k(0)) },
      { law: LAW.constants, to: (x) => x },
    ],
  },
  {
    id: "or-not",
    lhs: (x, y) => or(x, and(not(x), y)),
    steps: [
      { law: LAW.distr, to: (x, y) => and(or(x, not(x)), or(x, y)) },
      { law: LAW.excl, to: (x, y) => and(k(1), or(x, y)) },
      { law: LAW.constants, to: (x, y) => or(x, y) },
    ],
  },
  {
    id: "and-not",
    lhs: (x, y) => and(x, or(not(x), y)),
    steps: [
      { law: LAW.distr, to: (x, y) => or(and(x, not(x)), and(x, y)) },
      { law: LAW.contra, to: (x, y) => or(k(0), and(x, y)) },
      { law: LAW.constants, to: (x, y) => and(x, y) },
    ],
  },
  {
    id: "dm-dneg",
    lhs: (x, y) => not(or(not(x), not(y))),
    steps: [
      { law: LAW.dm, to: (x, y) => and(not(not(x)), not(not(y))) },
      { law: LAW.dneg, to: (x, y) => and(x, y) },
    ],
  },
  {
    id: "dm-factor",
    lhs: (x, y) => and(not(and(not(x), y)), or(x, y)),
    steps: [
      { law: LAW.dm, to: (x, y) => and(or(not(not(x)), not(y)), or(x, y)) },
      { law: LAW.dneg, to: (x, y) => and(or(x, not(y)), or(x, y)) },
      { law: LAW.distr, to: (x, y) => or(x, and(not(y), y)) },
      { law: LAW.contra, to: (x) => or(x, k(0)) },
      { law: LAW.constants, to: (x) => x },
    ],
  },
  {
    id: "imp-factor",
    lhs: (x, y) => and(imp(x, y), or(x, y)),
    steps: [
      { law: LAW.imp, to: (x, y) => and(or(not(x), y), or(x, y)) },
      { law: LAW.comm, to: (x, y) => and(or(y, not(x)), or(y, x)) },
      { law: LAW.distr, to: (x, y) => or(y, and(not(x), x)) },
      { law: LAW.contra, to: (_x, y) => or(y, k(0)) },
      { law: LAW.constants, to: (_x, y) => y },
    ],
  },
  {
    id: "not-imp",
    lhs: (x, y) => not(imp(x, y)),
    steps: [
      { law: LAW.imp, to: (x, y) => not(or(not(x), y)) },
      { law: LAW.dm, to: (x, y) => and(not(not(x)), not(y)) },
      { law: LAW.dneg, to: (x, y) => and(x, not(y)) },
    ],
  },
  {
    id: "or-and-not",
    lhs: (x, y) => and(or(x, y), not(x)),
    steps: [
      { law: LAW.distr, to: (x, y) => or(and(x, not(x)), and(y, not(x))) },
      { law: LAW.contra, to: (x, y) => or(k(0), and(y, not(x))) },
      { law: LAW.constants, to: (x, y) => and(y, not(x)) },
    ],
  },
  {
    id: "factor-y",
    lhs: (x, y) => or(and(x, y), and(not(x), y)),
    steps: [
      { law: LAW.distr, to: (x, y) => and(or(x, not(x)), y) },
      { law: LAW.excl, to: (_x, y) => and(k(1), y) },
      { law: LAW.constants, to: (_x, y) => y },
    ],
  },
  {
    id: "nor-or",
    lhs: (x, y) => or(not(or(x, y)), x),
    steps: [
      { law: LAW.dm, to: (x, y) => or(and(not(x), not(y)), x) },
      { law: LAW.comm, to: (x, y) => or(x, and(not(x), not(y))) },
      { law: LAW.distr, to: (x, y) => and(or(x, not(x)), or(x, not(y))) },
      { law: LAW.excl, to: (x, y) => and(k(1), or(x, not(y))) },
      { law: LAW.constants, to: (x, y) => or(x, not(y)) },
    ],
  },
];

/** Результат упрощения и проверка: каждый шаг равносилен предыдущему (иначе — ошибка в правиле). */
function simplifyChain(rule: SimplifyRule, x: Expr, y: Expr): { lhs: Expr; result: Expr; chain: { law: L; from: Expr; to: Expr }[] } {
  const lhs = rule.lhs(x, y);
  let cur = lhs;
  const chain: { law: L; from: Expr; to: Expr }[] = [];
  for (const s of rule.steps) {
    const to = s.to(x, y);
    if (!equivalent(cur, to)) throw new Error(`logic.laws: шаг упрощения ${rule.id} нарушает равносильность: ${show(cur)} → ${show(to)}`);
    chain.push({ law: s.law, from: cur, to });
    cur = to;
  }
  return { lhs, result: cur, chain };
}

// ---------- Случайный выбор ----------

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

const NAMES = ["A", "B", "C"];
/** Три разные переменные в случайном порядке. */
const pickVars = (rand: Rand): [Expr, Expr, Expr] => {
  const [a, b, c] = shuffle(NAMES, rand);
  return [v(a), v(b), v(c)];
};
const lit = (rand: Rand, e: Expr, p = 0.4): Expr => (rand() < p ? not(e) : e);

// ---------- Неверные варианты ----------

/** Все выражения, отличающиеся от данного одной «ошибкой по закону». */
function mutations(e: Expr, vars: string[]): Expr[] {
  const out: Expr[] = [];
  switch (e.t) {
    case "v":
      out.push(not(e));
      for (const n of vars) if (n !== e.n) out.push(v(n));
      break;
    case "c":
      break;
    case "not":
      out.push(e.a);
      for (const m of mutations(e.a, vars)) out.push(not(m));
      break;
    case "bin":
      for (const op of OPS) if (op !== e.op) out.push({ ...e, op });
      out.push({ ...e, a: e.b, b: e.a });
      for (const m of mutations(e.a, vars)) out.push({ ...e, a: m });
      for (const m of mutations(e.b, vars)) out.push({ ...e, b: m });
      out.push(not(e));
      break;
  }
  return out;
}

/** «Глупые» варианты: A ∨ A, A ∧ ¬A (операнды совпадают или противоположны) — их ученик отбросит не думая. */
function isSilly(e: Expr): boolean {
  if (e.t === "not") return isSilly(e.a);
  if (e.t !== "bin") return false;
  const a = show(e.a);
  const b = show(e.b);
  return a === b || a === show(neg(e.b)) || isSilly(e.a) || isSilly(e.b);
}

const size = (e: Expr): number => (e.t === "v" || e.t === "c" ? 1 : e.t === "not" ? 1 + size(e.a) : 1 + size(e.a) + size(e.b));

/** Три неверных варианта: не равносильны stem, записаны по-разному, не совпадают с верным. */
function distractors(rand: Rand, stem: Expr, correct: Expr, vars: string[], limit = 9): Expr[] {
  const seen = new Set<string>([show(correct), show(stem)]);
  const picked: Expr[] = [];
  let pool = shuffle(mutations(correct, vars).map(norm), rand);
  for (let round = 0; round < 3 && picked.length < 3; round++) {
    for (const m of pool) {
      if (picked.length >= 3) break;
      const s = show(m);
      if (seen.has(s) || size(m) > limit || isSilly(m) || equivalent(stem, m)) continue;
      seen.add(s);
      picked.push(m);
    }
    pool = shuffle(pool.flatMap((m) => mutations(m, vars).map(norm)).slice(0, 300), rand);
  }
  return picked;
}

// ---------- Общие куски ----------

const counterText = (stem: Expr, opt: Expr): L => {
  const d = firstDiff(stem, opt);
  if (!d) return { ru: "Этот вариант равносилен исходному.", kk: "Бұл нұсқа бастапқы өрнекке пара-пар." };
  const a = evalE(stem, d.env);
  const b = evalE(opt, d.env);
  const as = assignText(d.vars, d.env);
  return {
    ru: `Не подходит: при ${as} исходное выражение равно ${a}, а этот вариант даёт ${b}.`,
    kk: `Сәйкес келмейді: ${as} болғанда бастапқы өрнектің мәні ${a}, ал бұл нұсқа ${b} береді.`,
  };
};

const counterEq = (l: Expr, r: Expr): L => {
  const d = firstDiff(l, r);
  if (!d) return { ru: "Это равенство верно.", kk: "Бұл теңдік дұрыс." };
  const as = assignText(d.vars, d.env);
  return {
    ru: `Неверно: при ${as} левая часть равна ${evalE(l, d.env)}, а правая — ${evalE(r, d.env)}.`,
    kk: `Қате: ${as} болғанда сол жағы ${evalE(l, d.env)}, ал оң жағы ${evalE(r, d.env)}.`,
  };
};

/** Выбор из 4: верный (равносильный stem) и три неверных; whyWrong — контрпримеры. */
function makeChoice(rand: Rand, stem: Expr, correct: Expr, wrong: Expr[]) {
  const all = shuffle([correct, ...wrong], rand);
  const idx = all.indexOf(correct);
  return {
    options: all.map(show) as Text[],
    correct: idx,
    whyWrong: all.map((e, i): L | null => (i === idx ? null : counterText(stem, e))),
  };
}

const HINT_CONST: L = {
  ru: "Подставь в выражение 0 и 1 вместо переменной и посмотри, что получается. Помни: в A ∨ ¬A всегда один из двух членов истинен, а в A ∧ ¬A — один ложен.",
  kk: "Айнымалының орнына 0 және 1 қойып, не шығатынын қара. Есте сақта: A ∨ ¬A өрнегінде екі мүшенің бірі әрқашан ақиқат, ал A ∧ ¬A өрнегінде бірі әрқашан жалған.",
};
const HINT_EQUIV: L = {
  ru: "Вспомни подходящий закон: де Моргана, распределительный, замену импликации. Если сомневаешься — подставь один набор значений в исходное выражение и в вариант и сравни.",
  kk: "Қолайлы заңды еске түсір: де Морган, үлестіру, импликацияны ауыстыру. Күмән болса — бастапқы өрнекке және нұсқаға бір жиынды қойып, салыстыр.",
};
const HINT_NOTEQUIV: L = {
  ru: "Три варианта получаются из исходного по законам, один — с ошибкой. Подставь набор значений в сомнительный вариант и сравни с исходным.",
  kk: "Үш нұсқа бастапқыдан заңдар бойынша шығады, біреуінде қате бар. Күмәнді нұсқаға бір жиынды қойып, бастапқымен салыстыр.",
};
const HINT_SIMPLIFY: L = {
  ru: "Ищи общую часть в скобках — её можно вынести (распределительный закон). Потом ищи пары B ∨ ¬B и B ∧ ¬B: они дают 1 и 0.",
  kk: "Жақшалардағы ортақ бөлікті ізде — оны сыртқа шығаруға болады (үлестіру заңы). Одан кейін B ∨ ¬B және B ∧ ¬B жұптарын ізде: олар 1 және 0 береді.",
};
const HINT_COUNT: L = {
  ru: "Сначала упрости выражение по законам, потом посчитай наборы для короткой формулы — так надёжнее, чем таблица из 8 строк.",
  kk: "Алдымен өрнекті заңдар бойынша ықшамда, сосын қысқа формула үшін жиындарды сана — 8 жолдан тұратын кестеден гөрі сенімдірек.",
};
const HINT_VALUE: L = {
  ru: "Подставь значения и считай по порядку: сначала ¬, потом скобки, потом остальное. Закон из начала урока подскажет результат части выражения.",
  kk: "Мәндерді қойып, ретімен есепте: алдымен ¬, сосын жақшалар, соңында қалғаны. Сабақ басындағы заң өрнектің бір бөлігінің нәтижесін айтады.",
};
const HINT_EQTRUE: L = {
  ru: "Проверь каждое равенство подстановкой: найди набор значений, при котором левая и правая части различаются, — такое равенство неверно.",
  kk: "Әр теңдікті қойып тексер: сол және оң жақтары айырмашылық беретін жиынды тап — ондай теңдік қате.",
};
const HINT_WHO: L = {
  ru: "Предположи, что одно из высказываний верно. Тогда второе высказывание этого ученика ложно — и по цепочке проверь, нет ли противоречия. Если есть, исходное предположение неверно.",
  kk: "Бір пікір ақиқат деп ұйғар. Сонда осы оқушының екінші пікірі жалған — тізбек бойынша қайшылық бар-жоғын тексер. Қайшылық болса, бастапқы ұйғарым қате.",
};

/** Подвыражения по порядку выполнения: «¬B = 1; A ∨ ¬B = 1». */
function trace(e: Expr, env: Env): string {
  const parts: string[] = [];
  const walk = (x: Expr): Bit => {
    if (x.t === "v") return env[x.n];
    if (x.t === "c") return x.v;
    let r: Bit;
    if (x.t === "not") r = walk(x.a) ? 0 : 1;
    else {
      const p = walk(x.a);
      const q = walk(x.b);
      r = evalE({ t: "bin", op: x.op, a: k(p), b: k(q) }, env);
    }
    if (x.t !== "not" || x.a.t !== "c") parts.push(`${show(x)} = ${r}`);
    return r;
  };
  walk(e);
  return parts.join("; ");
}

/** Шаги упрощения: «Шаг 1 (закон): X = Y.» — формат разбирает независимая проверка. */
function chainText(chain: { law: L; from: Expr; to: Expr }[]): L {
  const line = (lang: "ru" | "kk", word: string) => chain.map((s, i) => `${word} ${i + 1} (${s.law[lang]}): ${show(s.from)} = ${show(s.to)}.`).join(" ");
  return { ru: line("ru", "Шаг"), kk: line("kk", "Қадам") };
}

// ---------- Задания: уровень 1 ----------

/** A: упростить выражение с константой или противоречием (выбор из 0, 1, x, ¬x). */
function qConst(rand: Rand, seed: number): QuestionStep {
  const rule = pick(rand, CONST_RULES);
  const x = rule.plain ? v(pick(rand, NAMES)) : lit(rand, v(pick(rand, NAMES)), 0.35);
  const stem = rule.lhs(x);
  const correct = rule.rhs(x);
  const cands: Expr[] = [k(0), k(1), x, neg(x)];
  const ok = cands.filter((c) => equivalent(stem, c));
  if (ok.length !== 1) throw new Error(`logic.laws: const ${show(stem)} — верных вариантов ${ok.length}`);
  const c = makeChoice(rand, stem, ok[0], cands.filter((e) => e !== ok[0]));
  const s = show(stem);
  const rhs = show(correct);
  return {
    id: `g:${SKILL}:const:${compact(s)}:${seed}`,
    type: "choice",
    skill: SKILL,
    level: 1,
    prompt: { ru: `Упрости выражение: ${s}`, kk: `Өрнекті ықшамда: ${s}` },
    ...c,
    hint: HINT_CONST,
    explanation: {
      ru: `${s} = ${rhs} (${rule.law.ru}). Проверка: при каждом значении переменной левая и правая части совпадают.`,
      kk: `${s} = ${rhs} (${rule.law.kk}). Тексеру: айнымалының әр мәнінде сол және оң жақтары сәйкес келеді.`,
    },
  };
}

/** A: какое из равенств верно (три неверных — подмена результата закона). */
function qEqTrue(rand: Rand, seed: number): QuestionStep {
  type Eq = { l: Expr; r: Expr };
  const pairs: Eq[] = [];
  const [x, y] = pickVars(rand);
  for (const r of CONST_RULES) pairs.push({ l: r.lhs(x), r: r.rhs(x) });
  for (const r of RULES.filter((r) => r.level === 1)) pairs.push({ l: r.lhs(x, y, y), r: r.rhs(x, y, y) });
  const good = pick(rand, pairs);
  // Неверные равенства: левая часть из другого закона, правая — «подмена» (мутация верной правой части).
  const bad: Eq[] = [];
  const seen = new Set<string>([`${show(good.l)} = ${show(good.r)}`]);
  for (const p of shuffle(pairs, rand)) {
    if (bad.length >= 3) break;
    const alt = shuffle([...mutations(p.r, varList(p.l, p.r)).map(norm), k(1), k(0)], rand).find((m) => !equivalent(p.l, m));
    if (!alt) continue;
    const text = `${show(p.l)} = ${show(alt)}`;
    if (seen.has(text)) continue;
    seen.add(text);
    bad.push({ l: p.l, r: alt });
  }
  const all = shuffle([good, ...bad], rand);
  const idx = all.indexOf(good);
  return {
    id: `g:${SKILL}:eqtrue:${compact(show(good.l))}:${seed}`,
    type: "choice",
    skill: SKILL,
    level: 1,
    prompt: {
      ru: "Какое из равенств верно при любых значениях переменных?",
      kk: "Қай теңдік айнымалылардың кез келген мәнінде дұрыс?",
    },
    options: all.map((e) => `${show(e.l)} = ${show(e.r)}`),
    correct: idx,
    whyWrong: all.map((e, i): L | null => (i === idx ? null : counterEq(e.l, e.r))),
    hint: HINT_EQTRUE,
    explanation: {
      ru: `Верно равенство ${show(good.l)} = ${show(good.r)}. В остальных есть набор значений, на котором части различаются.`,
      kk: `${show(good.l)} = ${show(good.r)} теңдігі дұрыс. Қалғандарында бөліктері айырмашылық беретін жиын бар.`,
    },
  };
}

/** A: значение выражения с законом внутри (ввод 0/1). */
function valueData(rand: Rand) {
  const rule = pick(rand, CONST_RULES);
  const [a, b] = pickVars(rand);
  const x = rule.plain ? a : lit(rand, a, 0.3);
  const y = lit(rand, b, 0.3);
  const op: Op = pick(rand, ["and", "or"] as Op[]);
  const e = bin(op, rule.lhs(x), y);
  const vars = varList(e);
  const env = pick(rand, allEnvs(vars));
  return { rule, e, vars, env, val: evalE(e, env) };
}

function qValue(rand: Rand, seed: number): QuestionStep {
  const d = valueData(rand);
  const s = show(d.e);
  const as = assignText(d.vars, d.env);
  const step: InputStep = {
    id: `g:${SKILL}:value:${compact(s)}|${compact(as)}:${seed}`,
    type: "input",
    skill: SKILL,
    level: 1,
    prompt: {
      ru: `Чему равно значение выражения ${s} при ${as}?`,
      kk: `${as} болғанда ${s} өрнегінің мәні неге тең?`,
    },
    answers: [String(d.val)],
    mode: "number",
    hint: HINT_VALUE,
    explanation: {
      ru: `Считаем по порядку: ${trace(d.e, d.env)}. Ответ: ${d.val}.`,
      kk: `Ретімен есептейміз: ${trace(d.e, d.env)}. Жауабы: ${d.val}.`,
    },
  };
  return step;
}

// ---------- Задания: уровни 1–2 («какое выражение равносильно») ----------

function ruleInputs(rand: Rand, level: 1 | 2): [Lit, Lit, Lit] {
  const [a, b, c] = pickVars(rand);
  return level === 1 ? [a, b, c] : [lit(rand, a), lit(rand, b), lit(rand, c)];
}

function qEquiv(rand: Rand, level: Level, seed: number): QuestionStep {
  const rule = pick(rand, RULES.filter((r) => r.level === (level === 1 ? 1 : 2)));
  const [x, y, z] = ruleInputs(rand, level === 1 ? 1 : 2);
  const stem = rule.lhs(x, y, z);
  const correct = rule.rhs(x, y, z);
  if (!equivalent(stem, correct)) throw new Error(`logic.laws: закон ${rule.id} нарушает равносильность`);
  const vars = varList(stem, correct);
  const wrong = distractors(rand, stem, correct, vars);
  const c = makeChoice(rand, stem, correct, wrong);
  const s = show(stem);
  return {
    id: `g:${SKILL}:equiv:${compact(s)}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: { ru: `Какое выражение равносильно ${s}?`, kk: `${s} өрнегіне қай өрнек пара-пар?` },
    ...c,
    hint: HINT_EQUIV,
    explanation: {
      ru: `По закону (${rule.law.ru}): ${s} = ${show(correct)}. Остальные варианты не равносильны исходному: для каждого есть набор значений, на котором они различаются.`,
      kk: `Заң бойынша (${rule.law.kk}): ${s} = ${show(correct)}. Қалған нұсқалар бастапқы өрнекке пара-пар емес: әрқайсысы үшін олар айырмашылық беретін жиын бар.`,
    },
  };
}

/** B: какое из выражений НЕ равносильно исходному. */
function qNotEquiv(rand: Rand, seed: number): QuestionStep {
  const rule = pick(rand, RULES.filter((r) => r.alts && r.alts(v("A"), v("B"), v("C")).length >= 3));
  const [x, y, z] = ruleInputs(rand, 2);
  const stem = rule.lhs(x, y, z);
  const alts = shuffle(rule.alts!(x, y, z), rand);
  const good: Expr[] = [];
  const seen = new Set<string>([show(stem)]);
  for (const a of alts) {
    const t = show(a);
    if (good.length >= 3) break;
    if (seen.has(t) || !equivalent(stem, a)) continue;
    seen.add(t);
    good.push(a);
  }
  const vars = varList(stem);
  const base = rule.rhs(x, y, z);
  const bad = distractors(rand, stem, base, vars.length ? vars : NAMES, 8).filter((e) => !seen.has(show(e)))[0];
  if (good.length < 3 || !bad) return qEquiv(rand, 2, seed);
  const all = shuffle([...good, bad], rand);
  const idx = all.indexOf(bad);
  const s = show(stem);
  const d = firstDiff(stem, bad)!;
  const as = assignText(d.vars, d.env);
  return {
    id: `g:${SKILL}:notequiv:${compact(s)}:${seed}`,
    type: "choice",
    skill: SKILL,
    level: 2,
    prompt: { ru: `Какое выражение НЕ равносильно ${s}?`, kk: `Қай өрнек ${s} өрнегіне пара-пар ЕМЕС?` },
    options: all.map(show),
    correct: idx,
    whyWrong: all.map((e, i): L | null =>
      i === idx
        ? null
        : { ru: `Это выражение равносильно исходному (${rule.law.ru}) — искать нужно то, что ему не равносильно.`, kk: `Бұл өрнек бастапқыға пара-пар (${rule.law.kk}) — оған пара-пар емесін іздеу керек.` },
    ),
    hint: HINT_NOTEQUIV,
    explanation: {
      ru: `Остальные три равносильны исходному ${s} (${rule.law.ru}). Выражение ${show(bad)} не равносильно: при ${as} исходное равно ${evalE(stem, d.env)}, а оно — ${evalE(bad, d.env)}.`,
      kk: `Қалған үшеуі бастапқы ${s} өрнегіне пара-пар (${rule.law.kk}). ${show(bad)} өрнегі пара-пар емес: ${as} болғанда бастапқы өрнектің мәні ${evalE(stem, d.env)}, ал оныкі ${evalE(bad, d.env)}.`,
    },
  };
}

/** B: сколько наборов делают истинным (сначала упрощаем по закону). */
function qCountRule(rand: Rand, seed: number): QuestionStep {
  const rule = pick(rand, RULES.filter((r) => r.level === 2));
  const [x, y, z] = ruleInputs(rand, 2);
  const stem = rule.lhs(x, y, z);
  const simp = rule.rhs(x, y, z);
  const vars = varList(stem, simp);
  const col = column(stem, vars);
  const n = ones(col);
  const s = show(stem);
  const step: InputStep = {
    id: `g:${SKILL}:count:${compact(s)}:${seed}`,
    type: "input",
    skill: SKILL,
    level: 2,
    prompt: {
      ru: `Сколько наборов значений (${vars.join(", ")}) делают выражение ${s} истинным?`,
      kk: `(${vars.join(", ")}) мәндерінің қанша жиыны ${s} өрнегін ақиқат етеді?`,
    },
    answers: [String(n)],
    mode: "number",
    hint: HINT_COUNT,
    explanation: {
      ru: `Упрощаем (${rule.law.ru}): ${s} = ${show(simp)}. Итоговый столбец для ${2 ** vars.length} наборов: ${col}. Единиц в нём: ${n}.`,
      kk: `Ықшамдаймыз (${rule.law.kk}): ${s} = ${show(simp)}. ${2 ** vars.length} жиын үшін қорытынды баған: ${col}. Ондағы бірліктер саны: ${n}.`,
    },
  };
  return step;
}

// ---------- Задания: уровень 3 ----------

function simplifyInputs(rand: Rand): [Expr, Expr, Expr] {
  return pickVars(rand);
}

function simplifyPool(x: Expr, y: Expr): Expr[] {
  return [x, y, not(x), not(y), and(x, y), or(x, y), and(x, not(y)), and(not(x), y), or(x, not(y)), or(not(x), y), imp(x, y), k(0), k(1)];
}

function qSimplify(rand: Rand, seed: number): QuestionStep {
  const rule = pick(rand, SIMPLIFY);
  const [x, y] = simplifyInputs(rand);
  const { lhs, result, chain } = simplifyChain(rule, x, y);
  const all = simplifyPool(x, y).filter((e) => !equivalent(lhs, e));
  // Константы 0 и 1 — запасные варианты: сначала правдоподобные выражения.
  const pool = [...shuffle(all.filter((e) => e.t !== "c"), rand), ...shuffle(all.filter((e) => e.t === "c"), rand)];
  const wrong = pool.slice(0, 3);
  const c = makeChoice(rand, lhs, result, wrong);
  const s = show(lhs);
  return {
    id: `g:${SKILL}:simplify:${compact(s)}:${seed}`,
    type: "choice",
    skill: SKILL,
    level: 3,
    prompt: { ru: `Упрости выражение: ${s}`, kk: `Өрнекті ықшамда: ${s}` },
    ...c,
    hint: HINT_SIMPLIFY,
    explanation: {
      ru: `${chainText(chain).ru} Итог: ${s} = ${show(result)}.`,
      kk: `${chainText(chain).kk} Қорытынды: ${s} = ${show(result)}.`,
    },
  };
}

/** C: упрощаем и считаем наборы для трёх переменных (F = выражение ∧ третья переменная). */
function qSimplifyCount(rand: Rand, seed: number): QuestionStep {
  const rule = pick(rand, SIMPLIFY);
  const [x, y, z] = simplifyInputs(rand);
  const { lhs, result, chain } = simplifyChain(rule, x, y);
  const f = and(lhs, z);
  const vars = varList(f);
  const col = column(f, vars);
  const n = ones(col);
  const s = show(f);
  const simp = and(result, z);
  if (!equivalent(f, simp)) throw new Error("logic.laws: упрощение с переменной z нарушило равносильность");
  return {
    id: `g:${SKILL}:count3:${compact(s)}:${seed}`,
    type: "input",
    skill: SKILL,
    level: 3,
    prompt: {
      ru: `Сколько наборов значений (${vars.join(", ")}) делают выражение ${s} истинным?`,
      kk: `(${vars.join(", ")}) мәндерінің қанша жиыны ${s} өрнегін ақиқат етеді?`,
    },
    answers: [String(n)],
    mode: "number",
    hint: HINT_COUNT,
    explanation: {
      ru: `Упрощаем скобку. ${chainText(chain).ru} Значит, F = ${show(simp)}. Итоговый столбец для ${2 ** vars.length} наборов: ${col}. Единиц в нём: ${n}.`,
      kk: `Жақшаны ықшамдаймыз. ${chainText(chain).kk} Демек, F = ${show(simp)}. ${2 ** vars.length} жиын үшін қорытынды баған: ${col}. Ондағы бірліктер саны: ${n}.`,
    },
  };
}

// ---------- «Кто есть кто» ----------

interface Atom {
  p: number;
  place: number;
  not: boolean;
}

interface Puzzle {
  names: string[];
  /** statements[i] — два высказывания i-го ученика. */
  statements: [Atom, Atom][];
  solution: number[];
}

const NAME_SETS = [
  ["Айдар", "Мади", "Данияр"],
  ["Асем", "Динара", "Томирис"],
  ["Ерлан", "Санжар", "Алибек"],
  ["Арман", "Мирас", "Дана"],
];

const PERMS: number[][] = [
  [1, 2, 3],
  [1, 3, 2],
  [2, 1, 3],
  [2, 3, 1],
  [3, 1, 2],
  [3, 2, 1],
];

const atomTrue = (a: Atom, perm: number[]) => (perm[a.p] === a.place) !== a.not;

/** Сколько высказываний i-го ученика верны при расстановке perm. */
const trueCount = (st: [Atom, Atom], perm: number[]) => Number(atomTrue(st[0], perm)) + Number(atomTrue(st[1], perm));

/** Расстановки, при которых у каждого ровно одно верное высказывание. */
const solutionsOf = (statements: [Atom, Atom][]) => PERMS.filter((perm) => statements.every((st) => trueCount(st, perm) === 1));

function makePuzzle(rand: Rand): Puzzle {
  const names = pick(rand, NAME_SETS);
  for (let attempt = 0; attempt < 600; attempt++) {
    const truth = shuffle([1, 2, 3], rand);
    const statements: [Atom, Atom][] = [];
    for (let i = 0; i < 3; i++) {
      const own: Atom = { p: i, place: int(rand, 1, 3), not: rand() < 0.5 };
      const wantOther = !atomTrue(own, truth);
      const others = [0, 1, 2].filter((j) => j !== i);
      const cands: Atom[] = [];
      for (const j of others) for (let place = 1; place <= 3; place++) cands.push({ p: j, place, not: false });
      const ok = cands.filter((a) => atomTrue(a, truth) === wantOther);
      if (!ok.length) break;
      const other = pick(rand, ok);
      statements.push(rand() < 0.5 ? [own, other] : [other, own]);
    }
    if (statements.length < 3) continue;
    const sols = solutionsOf(statements);
    if (sols.length === 1) return { names, statements, solution: sols[0] };
  }
  // Запасная головоломка (решение проверено перебором): Айдар 2, Мади 1, Данияр 3.
  const statements: [Atom, Atom][] = [
    [
      { p: 0, place: 1, not: true },
      { p: 1, place: 2, not: false },
    ],
    [
      { p: 1, place: 2, not: true },
      { p: 2, place: 1, not: false },
    ],
    [
      { p: 2, place: 1, not: true },
      { p: 0, place: 3, not: false },
    ],
  ];
  return { names: NAME_SETS[0], statements, solution: solutionsOf(statements)[0] };
}

function sayAtom(names: string[], speaker: number, a: Atom): L {
  const who = names[a.p];
  const self = a.p === speaker;
  const ruSub = self ? "Я" : who;
  const ru = `${ruSub} ${a.not ? "не " : ""}на ${a.place} месте`;
  const kk = self ? (a.not ? `Мен ${a.place}-орында емеспін` : `Мен ${a.place}-орындамын`) : `${who} ${a.place}-орында${a.not ? " емес" : ""}`;
  return { ru, kk };
}

function whoQuestion(rand: Rand, seed: number): ChoiceStep {
  const pz = makePuzzle(rand);
  const target = int(rand, 1, 3);
  const who = pz.solution.indexOf(target);
  const names = pz.names;
  const options: Text[] = shuffle([...names, "Определить нельзя"], rand).map((n) => (n === "Определить нельзя" ? { ru: "Определить нельзя", kk: "Анықтау мүмкін емес" } : n));
  const optName = (o: Text) => (typeof o === "string" ? o : null);
  const correct = options.findIndex((o) => optName(o) === names[who]);
  const permText = (perm: number[]) => `(${names.map((n, i) => `${n} — ${perm[i]}`).join(", ")})`;
  const failReason = (perm: number[]): { ru: string; kk: string } => {
    for (let i = 0; i < 3; i++) {
      const c = trueCount(pz.statements[i], perm);
      if (c !== 1) return { ru: `${names[i]} — верных высказываний ${c} вместо одного`, kk: `${names[i]} — ақиқат пікір саны ${c} (біреу болуы керек)` };
    }
    return { ru: "подходит", kk: "сәйкес келеді" };
  };
  const rows = PERMS.map((perm) => `${permText(perm)}: ${failReason(perm).ru}`);
  const rowsKk = PERMS.map((perm) => `${permText(perm)}: ${failReason(perm).kk}`);
  const scene: Scene = {
    kind: "table",
    columns: [
      { ru: "Говорит", kk: "Айтады" },
      { ru: "Высказывание 1", kk: "1-пікір" },
      { ru: "Высказывание 2", kk: "2-пікір" },
    ],
    rows: pz.statements.map((st, i) => [names[i], sayAtom(names, i, st[0]), sayAtom(names, i, st[1])]),
  };
  const code = pz.statements.map((st) => st.map((a) => `${a.p}${a.place}${a.not ? "n" : "p"}`).join("")).join("");
  const placeWord = target;
  return {
    id: `g:${SKILL}:who:${names[0]}${code}-${target}:${seed}`,
    type: "choice",
    skill: SKILL,
    level: 3,
    prompt: {
      ru: `${names[0]}, ${names[1]} и ${names[2]} — на трёх первых местах, места разные. У каждого ровно одно высказывание верное, другое ложное. Кто на ${placeWord} месте?`,
      kk: `${names[0]}, ${names[1]} және ${names[2]} — алғашқы үш орында, орындар әртүрлі. Әрқайсысының дәл бір пікірі ақиқат, екіншісі жалған. ${placeWord}-орында кім тұр?`,
    },
    scene,
    options,
    correct,
    whyWrong: options.map((o, i): L | null => {
      if (i === correct) return null;
      const nm = optName(o);
      if (nm === null) return { ru: "Условие определяет расстановку однозначно — перебор всех шести вариантов даёт ровно одну подходящую.", kk: "Шарт орналасуды бірмәнді анықтайды — алты нұсқаны түгел қарағанда дәл біреуі сәйкес келеді." };
      const idx = names.indexOf(nm);
      const perm = PERMS.find((p) => p[idx] === target && !solutionsOf(pz.statements).includes(p))!;
      const r = failReason(perm);
      return {
        ru: `Если ${nm} на ${target} месте, условие нарушается: например, расстановка ${permText(perm)} не подходит — ${r.ru}.`,
        kk: `${nm} ${target}-орында болса, шарт бұзылады: мысалы, ${permText(perm)} орналасуы сәйкес келмейді — ${r.kk}.`,
      };
    }),
    hint: HINT_WHO,
    explanation: {
      ru: `Перебираем все 6 расстановок и для каждой считаем верные высказывания у каждого ученика. ${rows.join("; ")}. Подходит одна расстановка ${permText(pz.solution)}: на ${target} месте — ${names[who]}.`,
      kk: `Барлық 6 орналасуды қарап, әр оқушының ақиқат пікірлерін санаймыз. ${rowsKk.join("; ")}. Бір орналасу ғана сәйкес келеді: ${permText(pz.solution)}. ${target}-орында — ${names[who]}.`,
    },
  };
}

// ---------- question ----------

function question(level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  if (level === 1) {
    const kind = pick(rand, ["const", "const", "eqtrue", "value", "equiv", "const"] as const);
    if (kind === "eqtrue") return qEqTrue(rand, seed);
    if (kind === "value") return qValue(rand, seed);
    if (kind === "equiv") return qEquiv(rand, 1, seed);
    return qConst(rand, seed);
  }
  if (level === 2) {
    const kind = pick(rand, ["equiv", "equiv", "notequiv", "count", "equiv"] as const);
    if (kind === "notequiv") return qNotEquiv(rand, seed);
    if (kind === "count") return qCountRule(rand, seed);
    return qEquiv(rand, 2, seed);
  }
  const kind = pick(rand, ["simplify", "simplify", "simplify", "count3", "who"] as const);
  if (kind === "count3") return qSimplifyCount(rand, seed);
  if (kind === "who") return whoQuestion(rand, seed);
  return qSimplify(rand, seed);
}

// ---------- «Верю — не верю» ----------

const sameText = (a: string, b: string): L => ({
  ru: `Выражения ${a} и ${b} равносильны`,
  kk: `${a} және ${b} өрнектері пара-пар`,
});

function claimStatement(level: Level, stem: Expr, truth: Expr, wrong: Expr[], rand: Rand, hint: L, law: L | null): Statement {
  const claimTrue = rand() < 0.5;
  const rhs = claimTrue || !wrong.length ? truth : pick(rand, wrong);
  const a = show(stem);
  const b = show(rhs);
  const value = equivalent(stem, rhs);
  const vars = varList(stem, rhs);
  const d = firstDiff(stem, rhs);
  return {
    id: `s:${SKILL}:${compact(a)}=${compact(b)}`,
    skill: SKILL,
    level,
    text: sameText(a, b),
    value,
    explanation: value
      ? {
          ru: `Верно${law ? ` (${law.ru})` : ""}: столбцы таблиц истинности совпадают — ${column(stem, vars)}.`,
          kk: `Дұрыс${law ? ` (${law.kk})` : ""}: ақиқат кестелерінің бағандары сәйкес келеді — ${column(stem, vars)}.`,
        }
      : {
          ru: `Неверно: при ${assignText(d!.vars, d!.env)} первое выражение равно ${evalE(stem, d!.env)}, а второе — ${evalE(rhs, d!.env)}.`,
          kk: `Қате: ${assignText(d!.vars, d!.env)} болғанда бірінші өрнектің мәні ${evalE(stem, d!.env)}, ал екіншісінікі ${evalE(rhs, d!.env)}.`,
        },
    hint,
  };
}

function statement(level: Level, seed: number): Statement {
  const rand = seeded(seed);
  if (level === 1) {
    const rule = pick(rand, CONST_RULES);
    const x = rule.plain ? v(pick(rand, NAMES)) : lit(rand, v(pick(rand, NAMES)), 0.35);
    const stem = rule.lhs(x);
    const wrong = [k(0), k(1), x, neg(x)].filter((e) => !equivalent(stem, e));
    return claimStatement(1, stem, rule.rhs(x), wrong, rand, HINT_CONST, rule.law);
  }
  if (level === 2) {
    const rule = pick(rand, RULES);
    const [x, y, z] = ruleInputs(rand, 2);
    const stem = rule.lhs(x, y, z);
    const truth = rule.rhs(x, y, z);
    const wrong = shuffle(mutations(truth, varList(stem, truth)).map(norm), rand).filter((e) => !equivalent(stem, e) && size(e) <= 9);
    return claimStatement(2, stem, truth, wrong, rand, HINT_EQUIV, rule.law);
  }
  const rule = pick(rand, SIMPLIFY);
  const [x, y] = pickVars(rand);
  const { lhs, result } = simplifyChain(rule, x, y);
  const wrong = simplifyPool(x, y).filter((e) => !equivalent(lhs, e));
  return claimStatement(3, lhs, result, wrong, rand, HINT_SIMPLIFY, null);
}

// ---------- Пары ----------

const LAW_PAIRS: { level: Level; left: Text; right: Text }[] = [
  { level: 1, left: { ru: "Двойное отрицание", kk: "Қос терістеу" }, right: "¬¬A = A" },
  { level: 1, left: { ru: "«A или не A» — всегда истина", kk: "«A немесе A емес» — әрқашан ақиқат" }, right: "A ∨ ¬A = 1" },
  { level: 1, left: { ru: "«A и не A» — всегда ложь", kk: "«A және A емес» — әрқашан жалған" }, right: "A ∧ ¬A = 0" },
  { level: 1, left: "A ∧ 1", right: "A" },
  { level: 1, left: "A ∨ 1", right: "1" },
  { level: 1, left: "A ∧ 0", right: "0" },
  { level: 1, left: "A ∨ B", right: "B ∨ A" },
  { level: 1, left: "A ∧ B", right: "B ∧ A" },
  { level: 2, left: { ru: "Закон де Моргана для И", kk: "ЖӘНЕ үшін де Морган заңы" }, right: "¬(A ∧ B) = ¬A ∨ ¬B" },
  { level: 2, left: { ru: "Закон де Моргана для ИЛИ", kk: "НЕМЕСЕ үшін де Морган заңы" }, right: "¬(A ∨ B) = ¬A ∧ ¬B" },
  { level: 2, left: { ru: "Распределительный закон", kk: "Үлестіру заңы" }, right: "A ∧ (B ∨ C) = (A ∧ B) ∨ (A ∧ C)" },
  { level: 2, left: { ru: "Замена импликации", kk: "Импликацияны ауыстыру" }, right: "A → B = ¬A ∨ B" },
  { level: 2, left: { ru: "Поглощение", kk: "Жұтылу" }, right: "A ∨ (A ∧ B) = A" },
  { level: 2, left: { ru: "Сочетательный закон", kk: "Топтау заңы" }, right: "(A ∧ B) ∧ C = A ∧ (B ∧ C)" },
  { level: 2, left: "A → B", right: "¬A ∨ B" },
  { level: 2, left: "A ∧ (A ∨ B)", right: "A" },
];

function pair(level: Level, seed: number): Pair {
  const rand = seeded(seed);
  if (level === 3) {
    const rule = pick(rand, SIMPLIFY);
    const [x, y] = pickVars(rand);
    const { lhs, result } = simplifyChain(rule, x, y);
    return { id: `p:${SKILL}:${compact(show(lhs))}`, skill: SKILL, level, left: show(lhs), right: show(result) };
  }
  const items = LAW_PAIRS.filter((p) => p.level === level);
  const p = pick(rand, items);
  const key = typeof p.left === "string" ? p.left : p.left.ru;
  return { id: `p:${SKILL}:${compact(key)}`, skill: SKILL, level, left: p.left, right: p.right };
}

// ---------- Короткие вопросы ----------

function short(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  if (level === 1) {
    const d = valueData(rand);
    const s = show(d.e);
    const as = assignText(d.vars, d.env);
    return {
      id: `q:${SKILL}:value:${compact(s)}|${compact(as)}`,
      skill: SKILL,
      level,
      prompt: same(`${s}, ${as}: F = ?`),
      answer: String(d.val),
      mode: "number",
      explanation: same(`${trace(d.e, d.env)}`),
      hint: HINT_VALUE,
    };
  }
  if (level === 2) {
    const rule = pick(rand, RULES.filter((r) => r.level === 2));
    const [x, y, z] = ruleInputs(rand, 2);
    const stem = rule.lhs(x, y, z);
    const vars = varList(stem);
    const col = column(stem, vars);
    const s = show(stem);
    return {
      id: `q:${SKILL}:count:${compact(s)}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `Сколько наборов (${vars.join(", ")}) делают ${s} истинным?`,
        kk: `(${vars.join(", ")}) жиындарының нешеуі ${s} өрнегін ақиқат етеді?`,
      },
      answer: String(ones(col)),
      mode: "number",
      explanation: same(`${s} = ${show(rule.rhs(x, y, z))}: ${col} → ${ones(col)}`),
      hint: HINT_COUNT,
    };
  }
  const rule = pick(rand, SIMPLIFY);
  const [x, y, z] = pickVars(rand);
  const { lhs, result } = simplifyChain(rule, x, y);
  const f = and(lhs, z);
  const vars = varList(f);
  const col = column(f, vars);
  const s = show(f);
  return {
    id: `q:${SKILL}:count3:${compact(s)}`,
    skill: SKILL,
    level,
    prompt: {
      ru: `Сколько наборов (${vars.join(", ")}) делают ${s} истинным?`,
      kk: `(${vars.join(", ")}) жиындарының нешеуі ${s} өрнегін ақиқат етеді?`,
    },
    answer: String(ones(col)),
    mode: "number",
    explanation: same(`${show(lhs)} = ${show(result)}, F = ${show(and(result, z))}: ${col} → ${ones(col)}`),
    hint: HINT_COUNT,
  };
}

export const BANKS: SkillBank[] = [{ skill: SKILL, question, statement, pair, short }];
