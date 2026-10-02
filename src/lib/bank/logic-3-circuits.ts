import type { ChoiceStep, InputStep, L, Level, MultiStep, QuestionStep, Scene } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка «Логические схемы» (logic.circuits). Схемы строятся кодом из случайных формул:
// формула → дерево → вентили для сцены circuit. Правильный ответ всегда вычисляет код
// (значения на выходе, число наборов, сопоставление формулы и схемы). Тексты — без падежных окончаний после чисел.

const SKILL = "logic.circuits";

type Bit = 0 | 1;
type Env = Record<string, Bit>;
type Op = "and" | "or" | "xor" | "nand" | "nor";

type Expr = { t: "v"; n: string } | { t: "not"; a: Expr } | { t: "b"; op: Op; a: Expr; b: Expr };

type CircuitScene = Extract<Scene, { kind: "circuit" }>;
type GateDef = CircuitScene["gates"][number];

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

const GATE_NAME: Record<Op | "not", L> = {
  and: { ru: "И", kk: "ЖӘНЕ" },
  or: { ru: "ИЛИ", kk: "НЕМЕСЕ" },
  not: { ru: "НЕ", kk: "ЕМЕС" },
  xor: { ru: "XOR", kk: "XOR" },
  nand: { ru: "И-НЕ", kk: "ЖӘНЕ-ЕМЕС" },
  nor: { ru: "ИЛИ-НЕ", kk: "НЕМЕСЕ-ЕМЕС" },
};

// ---------- Вычисление ----------

function applyOp(op: Op | "not", x: Bit, y: Bit = 0): Bit {
  switch (op) {
    case "not":
      return x ? 0 : 1;
    case "and":
      return x & y ? 1 : 0;
    case "or":
      return x | y ? 1 : 0;
    case "xor":
      return x ^ y ? 1 : 0;
    case "nand":
      return x & y ? 0 : 1;
    case "nor":
      return x | y ? 0 : 1;
  }
}

function evalExpr(e: Expr, env: Env): Bit {
  if (e.t === "v") return env[e.n];
  if (e.t === "not") return applyOp("not", evalExpr(e.a, env));
  return applyOp(e.op, evalExpr(e.a, env), evalExpr(e.b, env));
}

/** Все наборы значений входов по возрастанию двоичного числа (первая переменная — старший разряд). */
function allEnvs(vars: string[]): Env[] {
  const out: Env[] = [];
  for (let m = 0; m < 2 ** vars.length; m++) {
    const env: Env = {};
    vars.forEach((v, i) => (env[v] = ((m >> (vars.length - 1 - i)) & 1) as Bit));
    out.push(env);
  }
  return out;
}

const assignText = (vars: string[], env: Env) => vars.map((v) => `${v} = ${env[v]}`).join(", ");

// ---------- Формулы ----------

const isInvertedGate = (e: Expr) => e.t === "b" && (e.op === "nand" || e.op === "nor");

/** Нормализация: двойное НЕ убираем (в том числе НЕ над И-НЕ / ИЛИ-НЕ). */
function norm(e: Expr): Expr {
  if (e.t === "v") return e;
  if (e.t === "not") {
    const a = norm(e.a);
    if (a.t === "not") return a.a;
    // НЕ над И-НЕ / ИЛИ-НЕ — это снова И / ИЛИ.
    if (a.t === "b" && (a.op === "nand" || a.op === "nor")) return { ...a, op: a.op === "nand" ? "and" : "or" };
    return { t: "not", a };
  }
  return { ...e, a: norm(e.a), b: norm(e.b) };
}

function fmtChild(e: Expr): string {
  return e.t === "b" && (e.op === "and" || e.op === "or" || e.op === "xor") ? `(${fmt(e)})` : fmt(e);
}

/** Формула со скобками вокруг каждой вложенной двухместной операции — приоритетов учить не нужно. */
function fmt(e: Expr): string {
  if (e.t === "v") return e.n;
  if (e.t === "not") return e.a.t === "v" ? `¬${e.a.n}` : `¬(${fmt(e.a)})`;
  const x = fmtChild(e.a);
  const y = fmtChild(e.b);
  switch (e.op) {
    case "and":
      return `${x} ∧ ${y}`;
    case "or":
      return `${x} ∨ ${y}`;
    case "xor":
      return `${x} ⊕ ${y}`;
    case "nand":
      return `¬(${x} ∧ ${y})`;
    case "nor":
      return `¬(${x} ∨ ${y})`;
  }
}

const slug = (s: string) => s.replace(/\s+/g, "");

// ---------- Схема из формулы ----------

interface Built {
  expr: Expr;
  vars: string[];
  formula: string;
  gates: GateDef[];
  output: string;
  /** Что считает каждый вентиль (по порядку): имя и формула. */
  steps: { op: Op | "not"; text: string }[];
}

function build(expr: Expr, vars: string[]): Built {
  const gates: GateDef[] = [];
  const steps: Built["steps"] = [];
  let n = 0;
  const walk = (e: Expr): string => {
    if (e.t === "v") return e.n;
    if (e.t === "not") {
      const a = walk(e.a);
      const id = `g${++n}`;
      gates.push({ id, op: "not", in: [a] });
      steps.push({ op: "not", text: fmt(e) });
      return id;
    }
    const a = walk(e.a);
    const b = walk(e.b);
    const id = `g${++n}`;
    gates.push({ id, op: e.op, in: [a, b] });
    steps.push({ op: e.op, text: fmt(e) });
    return id;
  };
  const output = walk(expr);
  return { expr, vars, formula: fmt(expr), gates, output, steps };
}

function sceneOf(b: Built, values?: Env): CircuitScene {
  const scene: CircuitScene = { kind: "circuit", inputs: b.vars, gates: b.gates, output: b.output };
  if (values) scene.values = values;
  return scene;
}

/** Значения на выходах вентилей (для пошагового объяснения). */
function trace(b: Built, env: Env): Record<string, Bit> {
  const wire: Record<string, Bit> = { ...env };
  for (const g of b.gates) wire[g.id] = applyOp(g.op, wire[g.in[0]], g.in[1] !== undefined ? wire[g.in[1]] : 0);
  return wire;
}

/** Строка вычисления одного вентиля: «¬(1 ∧ 0) = 1». */
function gateLine(g: GateDef, wire: Record<string, Bit>): L {
  const x = wire[g.in[0]];
  const y = g.in[1] !== undefined ? wire[g.in[1]] : 0;
  const r = wire[g.id];
  let expr: string;
  switch (g.op) {
    case "not":
      expr = `¬${x}`;
      break;
    case "and":
      expr = `${x} ∧ ${y}`;
      break;
    case "or":
      expr = `${x} ∨ ${y}`;
      break;
    case "xor":
      expr = `${x} ⊕ ${y}`;
      break;
    case "nand":
      expr = `¬(${x} ∧ ${y})`;
      break;
    case "nor":
      expr = `¬(${x} ∨ ${y})`;
      break;
  }
  return { ru: `${GATE_NAME[g.op].ru}: ${expr} = ${r}`, kk: `${GATE_NAME[g.op].kk}: ${expr} = ${r}` };
}

function traceText(b: Built, env: Env): L {
  const wire = trace(b, env);
  const lines = b.gates.map((g) => gateLine(g, wire));
  const out = wire[b.output];
  return {
    ru: `Идём по схеме слева направо. ${lines.map((l) => l.ru).join("; ")}. Итог: F = ${out}.`,
    kk: `Схема бойынша солдан оңға жүреміз. ${lines.map((l) => l.kk).join("; ")}. Қорытынды: F = ${out}.`,
  };
}

// ---------- Случайные формулы ----------

interface Spec {
  vars: string[];
  /** Число двухместных вентилей. */
  nBin: number;
  ops: Op[];
  maxNots: number;
  maxGates: number;
  /** Не больше стольких вентилей И-НЕ / ИЛИ-НЕ (глубокая вложенность читается тяжело). */
  maxInv?: number;
  /** Для заданий на подсчёт: единиц в таблице не слишком мало и не слишком много. */
  balanced?: boolean;
}

type Shape = null | { a: Shape; b: Shape };

function shapeOf(rand: Rand, n: number): Shape {
  if (n === 0) return null;
  const k = int(rand, 0, n - 1);
  return { a: shapeOf(rand, k), b: shapeOf(rand, n - 1 - k) };
}

function gateCount(e: Expr): number {
  if (e.t === "v") return 0;
  if (e.t === "not") return 1 + gateCount(e.a);
  return 1 + gateCount(e.a) + gateCount(e.b);
}

function invCount(e: Expr): number {
  if (e.t === "v") return 0;
  if (e.t === "not") return invCount(e.a);
  return (isInvertedGate(e) ? 1 : 0) + invCount(e.a) + invCount(e.b);
}

const literalVar = (e: Expr): string | null => (e.t === "v" ? e.n : e.t === "not" && e.a.t === "v" ? e.a.n : null);

/** Операнды цепочки одной и той же операции: (A ∧ B) ∧ C → A, B, C. */
function chainOperands(e: Expr & { t: "b" }): Expr[] {
  if (e.op === "nand" || e.op === "nor") return [e.a, e.b];
  const flat = (x: Expr): Expr[] => (x.t === "b" && x.op === e.op ? [...flat(x.a), ...flat(x.b)] : [x]);
  return flat(e);
}

/** Бессмысленные формулы: A ∧ A, A ∧ ¬A, B ∧ (B ∧ C) — одна переменная дважды в одной цепочке. */
function hasTwin(e: Expr): boolean {
  if (e.t === "v") return false;
  if (e.t === "not") return hasTwin(e.a);
  const ops = chainOperands(e);
  const names = ops.map(literalVar).filter((n): n is string => n !== null);
  if (new Set(names).size !== names.length) return true;
  const texts = ops.map(fmt);
  if (new Set(texts).size !== texts.length) return true;
  return ops.some(hasTwin);
}

function isValid(e: Expr, spec: Spec): boolean {
  if (gateCount(e) > spec.maxGates) return false;
  if (spec.maxInv !== undefined && invCount(e) > spec.maxInv) return false;
  const envs = allEnvs(spec.vars);
  const outs = envs.map((env) => evalExpr(e, env));
  if (outs.every((o) => o === outs[0])) return false;
  if (spec.balanced) {
    const ones = outs.filter((o) => o === 1).length;
    if (ones < outs.length / 4 || ones > (outs.length * 3) / 4) return false;
  }
  // Каждая переменная должна влиять на результат.
  for (const v of spec.vars) {
    const matters = envs.some((env) => evalExpr(e, { ...env, [v]: 0 }) !== evalExpr(e, { ...env, [v]: 1 }));
    if (!matters) return false;
  }
  return !hasTwin(e);
}

function tryExpr(rand: Rand, spec: Spec): Expr {
  const shape = shapeOf(rand, spec.nBin);
  const leaves = spec.nBin + 1;
  const names = shuffle(spec.vars, rand);
  while (names.length < leaves) names.push(pick(rand, spec.vars));
  // Листья идут по алфавиту — формулы выглядят привычно: (A ∨ B) ∧ C, а не (C ∨ A) ∧ B.
  const order = [...names].sort();
  let i = 0;
  const make = (s: Shape): Expr => (s === null ? { t: "v", n: order[i++] } : { t: "b", op: pick(rand, spec.ops), a: make(s.a), b: make(s.b) });
  const tree = make(shape);
  let budget = int(rand, 0, spec.maxNots);
  const wrap = (e: Expr): Expr => {
    let r: Expr = e;
    if (e.t === "b") r = { ...e, a: wrap(e.a), b: wrap(e.b) };
    if (budget > 0 && !isInvertedGate(r) && rand() < 0.5) {
      budget--;
      r = { t: "not", a: r };
    }
    return r;
  };
  return norm(wrap(tree));
}

function genExpr(rand: Rand, spec: Spec): Expr {
  for (let attempt = 0; attempt < 120; attempt++) {
    const e = tryExpr(rand, spec);
    if (isValid(e, spec)) return e;
  }
  // Запасной вариант (практически не используется).
  return { t: "b", op: "and", a: { t: "v", n: spec.vars[0] }, b: { t: "not", a: { t: "v", n: spec.vars[1] } } };
}

/** Все формулы, отличающиеся от данной одной «ошибкой»: другая операция, лишнее/пропавшее НЕ, другая переменная. */
function mutations(e: Expr, vars: string[]): Expr[] {
  const out: Expr[] = [];
  const OPS: Op[] = ["and", "or", "xor", "nand", "nor"];
  switch (e.t) {
    case "v":
      for (const v of vars) if (v !== e.n) out.push({ t: "v", n: v });
      break;
    case "not":
      out.push(e.a);
      for (const m of mutations(e.a, vars)) out.push({ t: "not", a: m });
      break;
    case "b":
      for (const op of OPS) if (op !== e.op) out.push({ ...e, op });
      for (const m of mutations(e.a, vars)) out.push({ ...e, a: m });
      for (const m of mutations(e.b, vars)) out.push({ ...e, b: m });
      break;
  }
  if (e.t !== "not" && !isInvertedGate(e)) out.push({ t: "not", a: e });
  return out;
}

function sameTable(a: Expr, b: Expr, vars: string[]): boolean {
  return allEnvs(vars).every((env) => evalExpr(a, env) === evalExpr(b, env));
}

function firstDiff(a: Expr, b: Expr, vars: string[]): Env | undefined {
  return allEnvs(vars).find((env) => evalExpr(a, env) !== evalExpr(b, env));
}

/** Три неверные формулы с разными записями, ни одна не равносильна верной. */
function distractors(rand: Rand, e: Expr, vars: string[]): Expr[] {
  const picked: Expr[] = [];
  const seen = new Set<string>([fmt(e)]);
  let pool = shuffle(mutations(e, vars).map(norm), rand);
  for (let round = 0; round < 3 && picked.length < 3; round++) {
    for (const m of pool) {
      if (picked.length >= 3) break;
      const f = fmt(m);
      if (seen.has(f) || sameTable(e, m, vars) || gateCount(m) > 7 || hasTwin(m)) continue;
      seen.add(f);
      picked.push(m);
    }
    // Если не хватило — берём двойные мутации.
    pool = shuffle(pool.flatMap((m) => mutations(m, vars).map(norm)).slice(0, 400), rand);
  }
  return picked;
}

// ---------- Параметры уровней ----------

const VARS = ["A", "B", "C", "D"];
const ALL_OPS: Op[] = ["and", "or", "xor", "nand", "nor"];

function specFor(rand: Rand, level: Level, kind: "calc" | "formula" | "count"): Spec {
  const balanced = kind === "count";
  if (level === 1) {
    return { vars: VARS.slice(0, 2), nBin: 1, ops: ALL_OPS, maxNots: 1, maxGates: 3, balanced };
  }
  if (level === 2) {
    return { vars: VARS.slice(0, 3), nBin: 2, ops: kind === "formula" ? ["and", "or", "xor"] : ALL_OPS, maxNots: 2, maxGates: 5, maxInv: 1, balanced };
  }
  const four = kind !== "formula" && rand() < 0.25;
  if (four) return { vars: VARS.slice(0, 4), nBin: 3, ops: ALL_OPS, maxNots: 2, maxGates: 6, maxInv: 1, balanced };
  return { vars: VARS.slice(0, 3), nBin: 3, ops: kind === "formula" ? ["and", "or", "xor", "nor"] : ALL_OPS, maxNots: 2, maxGates: 6, maxInv: 1, balanced };
}

// ---------- Задания ----------

const HINT_CALC: L = {
  ru: "Иди по схеме слева направо: сначала найди значение на выходе первого элемента, потом подставь его в следующий.",
  kk: "Схема бойынша солдан оңға жүр: алдымен бірінші элементтің шығыс мәнін тап, сосын оны келесі элементке қой.",
};
const HINT_FORMULA: L = {
  ru: "Запиши, что считает первый элемент, затем подставляй результат в следующий. Следи, к чему именно применяется НЕ.",
  kk: "Бірінші элемент нені есептейтінін жаз, сосын нәтижені келесі элементке қой. ЕМЕС нақты неге қатысты екеніне назар аудар.",
};
const HINT_SETS: L = {
  ru: "Подставь наборы в схему по очереди и проверь, что получается на выходе.",
  kk: "Жиындарды схемаға кезекпен қойып, шығыста не шығатынын тексер.",
};
const HINT_COUNT: L = {
  ru: "Выпиши все наборы входов (по таблице) и найди выход в каждой строке. Иногда проще посчитать противоположное значение и вычесть из общего числа наборов.",
  kk: "Кірістердің барлық жиынын (кесте бойынша) жазып шық және әр жолдағы шығысты тап. Кейде қарама-қарсы мәнді санап, жиындардың жалпы санынан алып тастау оңай.",
};

function calcQuestion(rand: Rand, level: Level, seed: number): InputStep {
  const spec = specFor(rand, level, "calc");
  const b = build(genExpr(rand, spec), spec.vars);
  const env = pick(rand, allEnvs(spec.vars));
  const val = evalExpr(b.expr, env);
  const as = assignText(spec.vars, env);
  return {
    id: `g:${SKILL}:calc:${slug(b.formula)}|${slug(as)}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `Найди значение F на выходе схемы при ${as}.`,
      kk: `${as} болғанда схема шығысындағы F мәнін тап.`,
    },
    scene: sceneOf(b),
    reveal: sceneOf(b, env),
    answers: [String(val)],
    mode: "number",
    hint: HINT_CALC,
    explanation: traceText(b, env),
  };
}

function formulaQuestion(rand: Rand, level: Level, seed: number): ChoiceStep {
  const spec = specFor(rand, level, "formula");
  const expr = genExpr(rand, spec);
  const b = build(expr, spec.vars);
  const wrong = distractors(rand, expr, spec.vars);
  const all = shuffle([expr, ...wrong], rand);
  const correct = all.indexOf(expr);
  const whyWrong = all.map((m, i): L | null => {
    if (i === correct) return null;
    const env = firstDiff(expr, m, spec.vars)!;
    const as = assignText(spec.vars, env);
    return {
      ru: `Не подходит: при ${as} схема даёт ${evalExpr(expr, env)}, а эта формула — ${evalExpr(m, env)}.`,
      kk: `Сәйкес келмейді: ${as} болғанда схема ${evalExpr(expr, env)} береді, ал бұл формула — ${evalExpr(m, env)}.`,
    };
  });
  const steps = b.steps.map((s) => ({ ru: `${GATE_NAME[s.op].ru} → ${s.text}`, kk: `${GATE_NAME[s.op].kk} → ${s.text}` }));
  return {
    id: `g:${SKILL}:formula:${slug(b.formula)}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: { ru: "Какая формула соответствует схеме?", kk: "Қай формула схемаға сәйкес келеді?" },
    scene: sceneOf(b),
    options: all.map((m) => fmt(m)),
    correct,
    whyWrong,
    hint: HINT_FORMULA,
    explanation: {
      ru: `Читаем схему слева направо и записываем, что считает каждый элемент: ${steps.map((s) => s.ru).join("; ")}. Последний элемент даёт F = ${b.formula}.`,
      kk: `Схеманы солдан оңға қарай оқып, әр элемент нені есептейтінін жазамыз: ${steps.map((s) => s.kk).join("; ")}. Соңғы элемент F = ${b.formula} береді.`,
    },
  };
}

/** Какой набор даёт нужное значение выхода: один верный из четырёх. */
function setsQuestion(rand: Rand, level: Level, seed: number): ChoiceStep {
  const spec = specFor(rand, level, "calc");
  const b = build(genExpr(rand, spec), spec.vars);
  const envs = allEnvs(spec.vars);
  const ones = envs.filter((e) => evalExpr(b.expr, e) === 1);
  const zeros = envs.filter((e) => evalExpr(b.expr, e) === 0);
  let target: Bit = rand() < 0.5 ? 1 : 0;
  if ((target === 1 ? ones : zeros).length < 1 || (target === 1 ? zeros : ones).length < 3) target = target === 1 ? 0 : 1;
  const good = pick(rand, target === 1 ? ones : zeros);
  const bad = shuffle(target === 1 ? zeros : ones, rand).slice(0, 3);
  const opts = shuffle([good, ...bad], rand);
  const correct = opts.indexOf(good);
  return {
    id: `g:${SKILL}:sets:${slug(b.formula)}|${target}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: {
      ru: `При каком наборе значений на выходе схемы получается ${target}?`,
      kk: `Кірістердің қай жиынында схема шығысында ${target} шығады?`,
    },
    scene: sceneOf(b),
    reveal: sceneOf(b, good),
    options: opts.map((e) => assignText(spec.vars, e)),
    correct,
    whyWrong: opts.map((e, i): L | null =>
      i === correct
        ? null
        : {
            ru: `При ${assignText(spec.vars, e)} на выходе получается ${evalExpr(b.expr, e)}, а не ${target}.`,
            kk: `${assignText(spec.vars, e)} болғанда шығыста ${evalExpr(b.expr, e)} шығады, ${target} емес.`,
          },
    ),
    hint: HINT_SETS,
    explanation: {
      ru: `Подставляем набор ${assignText(spec.vars, good)}. ${traceText(b, good).ru}`,
      kk: `${assignText(spec.vars, good)} жиынын қоямыз. ${traceText(b, good).kk}`,
    },
  };
}

/** Один вентиль: при каком наборе выход «редкий» (единственный в таблице). */
function gateOneQuestion(rand: Rand, level: Level): ChoiceStep {
  const op = pick(rand, ["and", "nor", "nand", "or"] as const);
  const vars = ["A", "B"];
  const expr: Expr = { t: "b", op, a: { t: "v", n: "A" }, b: { t: "v", n: "B" } };
  const b = build(expr, vars);
  const envs = allEnvs(vars);
  const ones = envs.filter((e) => evalExpr(expr, e) === 1);
  const target: Bit = ones.length === 1 ? 1 : 0;
  const good = envs.find((e) => evalExpr(expr, e) === target)!;
  const opts = shuffle(envs, rand);
  const correct = opts.indexOf(good);
  return {
    id: `g:${SKILL}:gate:${op}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: {
      ru: `Элемент ${GATE_NAME[op].ru}. При каких входах на его выходе получается ${target}?`,
      kk: `${GATE_NAME[op].kk} элементі. Қандай кірістерде оның шығысында ${target} шығады?`,
    },
    scene: sceneOf(b),
    reveal: sceneOf(b, good),
    options: opts.map((e) => assignText(vars, e)),
    correct,
    whyWrong: opts.map((e, i): L | null =>
      i === correct
        ? null
        : {
            ru: `При ${assignText(vars, e)} элемент ${GATE_NAME[op].ru} выдаёт ${evalExpr(expr, e)}, а не ${target}.`,
            kk: `${assignText(vars, e)} болғанда ${GATE_NAME[op].kk} элементі ${evalExpr(expr, e)} береді, ${target} емес.`,
          },
    ),
    hint: {
      ru: "Вспомни опорное слово элемента: И — «оба», ИЛИ — «хотя бы один», НЕ в названии — «наоборот». Проверь каждую строку.",
      kk: "Элементтің тірек сөзін еске түсір: ЖӘНЕ — «екеуі де», НЕМЕСЕ — «кемінде біреуі», атаудағы ЕМЕС — «керісінше». Әр жолды тексер.",
    },
    explanation: {
      ru: `${GATE_NAME[op].ru}: выход ${target} получается ровно при одном наборе — ${assignText(vars, good)}. При остальных наборах выход ${1 - target}.`,
      kk: `${GATE_NAME[op].kk}: шығыс ${target} дәл бір жиында шығады — ${assignText(vars, good)}. Қалған жиындарда шығыс ${1 - target}.`,
    },
  };
}

function countQuestion(rand: Rand, level: Level, seed: number): InputStep {
  const spec = specFor(rand, level, "count");
  const b = build(genExpr(rand, spec), spec.vars);
  const envs = allEnvs(spec.vars);
  const ones = envs.filter((e) => evalExpr(b.expr, e) === 1);
  const total = envs.length;
  const list = ones.map((e) => `(${spec.vars.map((v) => e[v]).join(", ")})`).join(", ");
  return {
    id: `g:${SKILL}:count:${slug(b.formula)}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `Сколько из ${total} наборов значений (${spec.vars.join(", ")}) дают на выходе схемы 1?`,
      kk: `Кірістердің ${total} жиынының (${spec.vars.join(", ")}) нешеуінде схема шығысында 1 шығады?`,
    },
    scene: sceneOf(b),
    answers: [String(ones.length)],
    mode: "number",
    hint: HINT_COUNT,
    explanation: {
      ru: `Формула схемы: F = ${b.formula}. Перебираем все ${total} наборов: единица получается при ${list}. Всего ${ones.length}.`,
      kk: `Схема формуласы: F = ${b.formula}. Барлық ${total} жиынды қарап шығамыз: бірлік мына жиындарда шығады: ${list}. Барлығы ${ones.length}.`,
    },
  };
}

function multiSetsQuestion(rand: Rand, level: Level, seed: number): MultiStep | QuestionStep {
  for (let attempt = 0; attempt < 30; attempt++) {
    const spec = specFor(rand, level, "calc");
    const b = build(genExpr(rand, spec), spec.vars);
    const envs = allEnvs(spec.vars);
    const ones = envs.filter((e) => evalExpr(b.expr, e) === 1);
    const zeros = envs.filter((e) => evalExpr(b.expr, e) === 0);
    const k = int(rand, 2, 3);
    if (ones.length < k || zeros.length < 6 - k) continue;
    const good = shuffle(ones, rand).slice(0, k);
    const bad = shuffle(zeros, rand).slice(0, 6 - k);
    const opts = shuffle([...good, ...bad], rand);
    const correct = opts.map((e, i) => (good.includes(e) ? i : -1)).filter((i) => i >= 0);
    return {
      id: `g:${SKILL}:multi:${slug(b.formula)}:${seed}`,
      type: "multi",
      skill: SKILL,
      level,
      prompt: {
        ru: "Выбери все наборы значений, при которых на выходе схемы получается 1.",
        kk: "Схема шығысында 1 шығатын барлық кіріс жиындарын таңда.",
      },
      scene: sceneOf(b),
      options: opts.map((e) => assignText(spec.vars, e)),
      correct,
      whyWrong: opts.map((e, i): L | null =>
        correct.includes(i)
          ? null
          : {
              ru: `При ${assignText(spec.vars, e)} на выходе получается 0.`,
              kk: `${assignText(spec.vars, e)} болғанда шығыста 0 шығады.`,
            },
      ),
      hint: HINT_SETS,
      explanation: {
        ru: `Формула схемы: F = ${b.formula}. Проверяем каждый набор: единица получается на верных наборах (${good.map((e) => assignText(spec.vars, e)).join("; ")}), на остальных — 0.`,
        kk: `Схема формуласы: F = ${b.formula}. Әр жиынды тексереміз: бірлік дұрыс жиындарда (${good.map((e) => assignText(spec.vars, e)).join("; ")}) шығады, қалғандарында — 0.`,
      },
    };
  }
  return countQuestion(rand, level, seed);
}

// ---------- Утверждения, пары, короткие вопросы ----------

function statement(level: Level, seed: number): Statement {
  const rand = seeded(seed);
  const truth = rand() < 0.5;
  if (level === 1) {
    const op = pick(rand, ALL_OPS);
    const vars = ["A", "B"];
    const env = pick(rand, allEnvs(vars));
    const expr: Expr = { t: "b", op, a: { t: "v", n: "A" }, b: { t: "v", n: "B" } };
    const actual = evalExpr(expr, env);
    const claim: Bit = truth ? actual : ((1 - actual) as Bit);
    const as = assignText(vars, env);
    return {
      id: `s:${SKILL}:gate:${op}:${slug(as)}:${claim}`,
      skill: SKILL,
      level,
      text: {
        ru: `Элемент ${GATE_NAME[op].ru} при ${as} выдаёт ${claim}`,
        kk: `${GATE_NAME[op].kk} элементі ${as} болғанда ${claim} береді`,
      },
      value: claim === actual,
      explanation: {
        ru: `${GATE_NAME[op].ru}: при ${as} выход равен ${actual}.`,
        kk: `${GATE_NAME[op].kk}: ${as} болғанда шығыс мәні: ${actual}.`,
      },
    };
  }
  const spec = specFor(rand, level, level === 2 ? "calc" : "count");
  const b = build(genExpr(rand, spec), spec.vars);
  if (level === 2) {
    const env = pick(rand, allEnvs(spec.vars));
    const actual = evalExpr(b.expr, env);
    const claim: Bit = truth ? actual : ((1 - actual) as Bit);
    const as = assignText(spec.vars, env);
    return {
      id: `s:${SKILL}:calc:${slug(b.formula)}|${slug(as)}:${claim}`,
      skill: SKILL,
      level,
      text: {
        ru: `Схема F = ${b.formula} при ${as} даёт на выходе ${claim}`,
        kk: `F = ${b.formula} схемасы ${as} болғанда шығыста ${claim} береді`,
      },
      value: claim === actual,
      explanation: traceText(b, env),
    };
  }
  const total = 2 ** spec.vars.length;
  const ones = allEnvs(spec.vars).filter((e) => evalExpr(b.expr, e) === 1).length;
  const claim = truth ? ones : Math.max(0, ones + pick(rand, [-1, 1, 2]));
  return {
    id: `s:${SKILL}:count:${slug(b.formula)}:${claim}`,
    skill: SKILL,
    level,
    text: {
      ru: `У схемы F = ${b.formula} единица на выходе получается ровно при ${claim} из ${total} наборов входов`,
      kk: `F = ${b.formula} схемасының шығысында кірістердің ${total} жиынының дәл ${claim} жиынында 1 шығады`,
    },
    value: claim === ones,
    explanation: {
      ru: `Перебор всех ${total} наборов показывает: единица на выходе получается при ${ones} наборах.`,
      kk: `Барлық ${total} жиынды қарап шығу көрсетеді: шығыста 1 ${ones} жиында шығады.`,
    },
  };
}

const PAIRS: { level: Level; left: L; right: L }[] = [
  { level: 1, left: { ru: "И", kk: "ЖӘНЕ" }, right: { ru: "1 только при 1 и 1", kk: "тек 1 және 1 болғанда 1" } },
  { level: 1, left: { ru: "ИЛИ", kk: "НЕМЕСЕ" }, right: { ru: "1, если хотя бы один вход равен 1", kk: "кемінде бір кіріс 1 болса, 1" } },
  { level: 1, left: { ru: "НЕ", kk: "ЕМЕС" }, right: { ru: "переворачивает сигнал", kk: "сигналды терістейді" } },
  { level: 1, left: { ru: "Вход схемы", kk: "Схема кірісі" }, right: { ru: "сюда подаётся сигнал 0 или 1", kk: "мұнда 0 немесе 1 сигналы беріледі" } },
  { level: 2, left: { ru: "И-НЕ", kk: "ЖӘНЕ-ЕМЕС" }, right: { ru: "0 только при 1 и 1", kk: "тек 1 және 1 болғанда 0" } },
  { level: 2, left: { ru: "ИЛИ-НЕ", kk: "НЕМЕСЕ-ЕМЕС" }, right: { ru: "1 только при 0 и 0", kk: "тек 0 және 0 болғанда 1" } },
  { level: 2, left: { ru: "Исключающее ИЛИ", kk: "Ерекшелеуші НЕМЕСЕ" }, right: { ru: "1, когда входы разные", kk: "кірістер әртүрлі болғанда 1" } },
  { level: 2, left: { ru: "Вентиль", kk: "Вентиль" }, right: { ru: "логический элемент схемы", kk: "схеманың логикалық элементі" } },
  { level: 3, left: { ru: "Сумма в полусумматоре", kk: "Жартылай сумматордағы қосынды" }, right: { ru: "A ⊕ B", kk: "A ⊕ B" } },
  { level: 3, left: { ru: "Перенос в полусумматоре", kk: "Жартылай сумматордағы ауысу" }, right: { ru: "A ∧ B", kk: "A ∧ B" } },
  { level: 3, left: { ru: "1 + 1 в двоичной системе", kk: "Екілік жүйедегі 1 + 1" }, right: { ru: "10₂", kk: "10₂" } },
  { level: 3, left: { ru: "Схема читается", kk: "Схема оқылады" }, right: { ru: "от входов к выходу", kk: "кірістен шығысқа қарай" } },
];

function pair(level: Level, seed: number): Pair {
  const rand = seeded(seed);
  const items = PAIRS.filter((p) => p.level === level);
  const p = pick(rand, items.length ? items : PAIRS);
  return { id: `p:${SKILL}:${p.left.ru}`, skill: SKILL, level: p.level, left: p.left, right: p.right };
}

function short(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  if (level === 1) {
    const op = pick(rand, ALL_OPS);
    const vars = ["A", "B"];
    const env = pick(rand, allEnvs(vars));
    const expr: Expr = { t: "b", op, a: { t: "v", n: "A" }, b: { t: "v", n: "B" } };
    const val = evalExpr(expr, env);
    const as = assignText(vars, env);
    return {
      id: `q:${SKILL}:gate:${op}:${slug(as)}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `Элемент ${GATE_NAME[op].ru}, ${as}. Чему равен выход?`,
        kk: `${GATE_NAME[op].kk} элементі, ${as}. Шығыс неге тең?`,
      },
      answer: String(val),
      mode: "number",
      explanation: {
        ru: `${GATE_NAME[op].ru}: при ${as} выход равен ${val}.`,
        kk: `${GATE_NAME[op].kk}: ${as} болғанда шығыс мәні: ${val}.`,
      },
    };
  }
  const spec = specFor(rand, level, level === 2 ? "calc" : "count");
  const b = build(genExpr(rand, spec), spec.vars);
  if (level === 2) {
    const env = pick(rand, allEnvs(spec.vars));
    const as = assignText(spec.vars, env);
    return {
      id: `q:${SKILL}:calc:${slug(b.formula)}|${slug(as)}`,
      skill: SKILL,
      level,
      prompt: { ru: `F = ${b.formula}, ${as}. F = ?`, kk: `F = ${b.formula}, ${as}. F = ?` },
      answer: String(evalExpr(b.expr, env)),
      mode: "number",
      explanation: traceText(b, env),
    };
  }
  const total = 2 ** spec.vars.length;
  const ones = allEnvs(spec.vars).filter((e) => evalExpr(b.expr, e) === 1).length;
  return {
    id: `q:${SKILL}:count:${slug(b.formula)}`,
    skill: SKILL,
    level,
    prompt: {
      ru: `F = ${b.formula}. При скольких из ${total} наборов (${spec.vars.join(", ")}) F = 1?`,
      kk: `F = ${b.formula}. ${total} жиынның (${spec.vars.join(", ")}) нешеуінде F = 1?`,
    },
    answer: String(ones),
    mode: "number",
    explanation: {
      ru: `Перебор всех ${total} наборов: единица получается при ${ones} наборах.`,
      kk: `Барлық ${total} жиынды қарап шығу: бірлік ${ones} жиында шығады.`,
    },
  };
}

function question(level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  if (level === 1) {
    const kind = pick(rand, ["calc", "calc", "gate", "formula"] as const);
    if (kind === "gate") return gateOneQuestion(rand, level);
    if (kind === "formula") return formulaQuestion(rand, level, seed);
    return calcQuestion(rand, level, seed);
  }
  if (level === 2) {
    const kind = pick(rand, ["formula", "formula", "calc", "sets"] as const);
    if (kind === "calc") return calcQuestion(rand, level, seed);
    if (kind === "sets") return setsQuestion(rand, level, seed);
    return formulaQuestion(rand, level, seed);
  }
  const kind = pick(rand, ["count", "formula", "multi", "sets"] as const);
  if (kind === "count") return countQuestion(rand, level, seed);
  if (kind === "multi") return multiSetsQuestion(rand, level, seed);
  if (kind === "sets") return setsQuestion(rand, level, seed);
  return formulaQuestion(rand, level, seed);
}

export const BANKS: SkillBank[] = [
  {
    skill: SKILL,
    question,
    statement,
    pair,
    short,
  },
];

