import type { ChoiceStep, InputStep, L, Level, MatchStep, MultiStep, OrderStep, QuestionStep, Scene, Text } from "../types";
import { poolBank } from "./pool";
import type { Pair, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка py.graphs («Графы и кратчайший путь»): пул заданий, где числа и ответы считает код
// (степени, суммы матриц, перебор маршрутов, число путей по стрелкам, результат программ).
// Программы из сцен прогнаны python3 (scripts/out/py-7d-graphs/verify): вывод совпал с ответом в каждом задании.
// Тексты после переменных — без падежных окончаний (названия вершин — только перед словом «вершина/төбе/пункт»).

const SKILL = "py.graphs";

const w = (ru: string, kk: string): L => ({ ru, kk });
const code = (lines: string[]): Scene => ({ kind: "code", lang: "python", lines });
const WHAT_PRINTS = w("Что выведет программа?", "Программа не шығарады?");

// ---------- Графы и вычисления ----------

type Edge = [string, string];
type Road = [string, string, number];

const L4 = ["A", "B", "C", "D"];
const L5 = ["A", "B", "C", "D", "E"];
const L6 = ["A", "B", "C", "D", "E", "F"];

const sumRow = (r: number[]) => r.reduce((a, b) => a + b, 0);
const total = (m: number[][]) => m.reduce((a, r) => a + sumRow(r), 0);
const degOf = (m: number[][], i: number) => sumRow(m[i]);
const inDegOf = (m: number[][], j: number) => m.reduce((a, r) => a + r[j], 0);

/** Матрица смежности по списку рёбер. */
function adjacency(labels: string[], edges: Edge[], directed = false): number[][] {
  const m = labels.map(() => labels.map(() => 0));
  for (const [a, b] of edges) {
    m[labels.indexOf(a)][labels.indexOf(b)] = 1;
    if (!directed) m[labels.indexOf(b)][labels.indexOf(a)] = 1;
  }
  return m;
}

interface MatrixOpts {
  rows?: number[];
  cols?: number[];
  cells?: [number, number][];
  sums?: "row" | "both";
  caption?: Extract<Scene, { kind: "table" }>["caption"];
}

/** Матрица смежности как таблица (подсветка — в координатах матрицы, без заголовков). */
function matrixScene(labels: string[], m: number[][], o: MatrixOpts = {}): Scene {
  const colSums = labels.map((_, j) => inDegOf(m, j));
  const rows = m.map((r, i) => [labels[i], ...r.map(String), ...(o.sums ? [String(sumRow(r))] : [])]);
  if (o.sums === "both") rows.push(["Σ", ...colSums.map(String), String(total(m))]);
  return {
    kind: "table",
    columns: ["", ...labels, ...(o.sums ? ["Σ"] : [])],
    rows,
    mono: true,
    highlightRows: o.rows,
    highlightCols: o.cols?.map((c) => c + 1),
    highlightCells: o.cells?.map(([r, c]) => [r, c + 1] as [number, number]),
    caption: o.caption,
  };
}

/** Матрица как строки Python: m = [[…], …]. */
const matrixLines = (m: number[][]): string[] => m.map((r, i) => `${i === 0 ? "m = [" : "     "}[${r.join(", ")}]${i === m.length - 1 ? "]" : ","}`);

const POS: Record<string, [number, number]> = { A: [2, 0], B: [1, 1], C: [3, 1], D: [1, 2], E: [3, 2] };
/** Схема ориентированного графа A–E со стрелками. */
/** Раскладка «зигзагом» в две строки — для графов, где у C есть стрелка в D (иначе линии пересекаются). */
const ZIG: Record<string, [number, number]> = { A: [0, 1], B: [1, 0], C: [2, 1], D: [3, 0], E: [4, 1] };
const digraphScene = (edges: Edge[], pos = POS): Scene => ({
  kind: "flow",
  nodes: L5.map((id) => ({ id, shape: "box" as const, label: id, x: pos[id][0], y: pos[id][1] })),
  edges: edges.map(([from, to]) => ({ from, to })),
});

/** Таблица расстояний между пунктами (прочерк — прямой дороги нет). */
function distScene(labels: string[], roads: Road[]): Scene {
  const len = (a: string, b: string) => roads.find(([x, y]) => (x === a && y === b) || (x === b && y === a))?.[2];
  return { kind: "table", columns: ["", ...labels], rows: labels.map((a) => [a, ...labels.map((b) => String(len(a, b) ?? "–"))]), mono: true };
}

/** Число путей по стрелкам без повторов вершин. */
function countPaths(m: number[][], labels: string[], from: string, to: string): number {
  let n = 0;
  const seen = new Set<number>();
  const go = (v: number) => {
    if (v === labels.indexOf(to)) {
      n++;
      return;
    }
    seen.add(v);
    m[v].forEach((x, j) => x === 1 && !seen.has(j) && go(j));
    seen.delete(v);
  };
  go(labels.indexOf(from));
  return n;
}

interface Route {
  path: string[];
  len: number;
}

/** Все маршруты без повторов вершин, по возрастанию длины. via — обязательный пункт, closed — закрытые дороги. */
function routes(roads: Road[], from: string, to: string, opts: { via?: string; closed?: [string, string][] } = {}): Route[] {
  const open = roads.filter(([a, b]) => !(opts.closed ?? []).some(([x, y]) => (x === a && y === b) || (x === b && y === a)));
  const nb = (v: string): [string, number][] => open.flatMap(([a, b, x]) => (a === v ? [[b, x] as [string, number]] : b === v ? [[a, x] as [string, number]] : []));
  const out: Route[] = [];
  const go = (v: string, path: string[], len: number) => {
    if (v === to) {
      if (!opts.via || path.includes(opts.via)) out.push({ path: [...path], len });
      return;
    }
    for (const [u, x] of nb(v)) if (!path.includes(u)) go(u, [...path, u], len + x);
  };
  go(from, [from], 0);
  return out.sort((p, q) => p.len - q.len);
}
const shortest = (roads: Road[], from: string, to: string, opts: { via?: string; closed?: [string, string][] } = {}) => routes(roads, from, to, opts)[0];
const pathText = (r: Route) => r.path.join("→");

/** «Жадный» маршрут: из каждого пункта едем по самой короткой дороге в ещё не посещённый пункт. */
function greedy(roads: Road[], from: string, to: string): Route {
  const path = [from];
  let len = 0;
  while (path[path.length - 1] !== to) {
    const v = path[path.length - 1];
    const next = roads
      .flatMap(([a, b, x]) => (a === v ? [[b, x] as [string, number]] : b === v ? [[a, x] as [string, number]] : []))
      .filter(([u]) => !path.includes(u))
      .sort((p, q) => p[1] - q[1] || p[0].localeCompare(q[0]))[0];
    if (!next) throw new Error("greedy: тупик");
    path.push(next[0]);
    len += next[1];
  }
  return { path, len };
}

// Данные задач.
const U1 = adjacency(L5, [["A", "B"], ["A", "C"], ["B", "C"], ["C", "D"], ["D", "E"]]); // степени 2 2 3 2 1
const U2 = adjacency(L5, [["A", "B"], ["A", "C"], ["A", "D"], ["A", "E"], ["B", "C"]]); // степени 4 2 2 1 1
const U3 = adjacency(L5, [["A", "B"], ["B", "C"], ["C", "D"], ["D", "E"], ["E", "A"], ["B", "D"]]); // степени 2 3 2 3 2
const U5 = adjacency(L5, [["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"], ["C", "D"], ["C", "E"], ["D", "E"]]); // степени 2 3 4 3 2
const F1 = adjacency(L4, [["A", "B"], ["A", "C"], ["A", "D"], ["C", "D"]]); // степени 3 1 2 2
const X6 = adjacency(L6, [["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"], ["C", "E"], ["D", "E"], ["D", "F"], ["E", "F"]]); // 8 рёбер

const D1_EDGES: Edge[] = [["A", "B"], ["A", "C"], ["C", "B"], ["B", "D"], ["D", "E"], ["E", "C"]];
const D2_EDGES: Edge[] = [["A", "B"], ["A", "C"], ["C", "B"], ["B", "D"], ["C", "E"], ["D", "E"]];
const D3_EDGES: Edge[] = [["A", "B"], ["B", "C"], ["C", "A"], ["A", "D"], ["D", "E"]];
const D4_EDGES: Edge[] = [["A", "B"], ["A", "C"], ["C", "B"], ["B", "D"], ["C", "D"], ["C", "E"], ["D", "E"]]; // без циклов, 4 пути A → E
const D1 = adjacency(L5, D1_EDGES, true);
const D2 = adjacency(L5, D2_EDGES, true);
const D3 = adjacency(L5, D3_EDGES, true);
const D4 = adjacency(L5, D4_EDGES, true);

const W1: Road[] = [["A", "E", 2], ["A", "F", 9], ["B", "C", 3], ["B", "E", 8], ["B", "F", 9], ["C", "D", 2], ["C", "E", 3], ["C", "F", 2], ["D", "F", 5]];
const W2: Road[] = [["A", "B", 2], ["A", "E", 7], ["A", "F", 9], ["B", "C", 3], ["B", "D", 8], ["C", "E", 3], ["C", "F", 3], ["D", "E", 5], ["E", "F", 3]];
const W3: Road[] = [["A", "C", 5], ["A", "E", 1], ["A", "F", 8], ["B", "C", 6], ["B", "D", 5], ["C", "D", 7], ["C", "E", 2], ["D", "F", 2], ["E", "F", 4]];

/** Четыре варианта числового ответа: верный первым и три неверных с объяснениями (повторы отбрасываются). */
function numOptions(correct: number, wrongs: [number, L][]): { options: string[]; correct: number; whyWrong: (L | null)[] } {
  const seen = new Set<number>([correct]);
  const picked: [number, L][] = [];
  for (const [n, why] of wrongs) {
    if (seen.has(n)) continue;
    seen.add(n);
    picked.push([n, why]);
  }
  if (picked.length < 3) throw new Error(`numOptions: мало неверных вариантов для ${correct}`);
  const three = picked.slice(0, 3);
  return { options: [String(correct), ...three.map(([n]) => String(n))], correct: 0, whyWrong: [null, ...three.map(([, why]) => why)] };
}

// ---------- Конструкторы заданий ----------

interface ChoiceArgs {
  name: string;
  level: Level;
  prompt: L;
  scene?: Scene;
  reveal?: Scene;
  options: Text[];
  correct: number;
  whyWrong: (L | null)[];
  explanation: L;
  hint: L;
}

const choice = (a: ChoiceArgs): ChoiceStep => ({
  id: `p:${SKILL}:${a.name}`,
  type: "choice",
  skill: SKILL,
  level: a.level,
  prompt: a.prompt,
  scene: a.scene,
  reveal: a.reveal,
  options: a.options,
  correct: a.correct,
  whyWrong: a.whyWrong,
  explanation: a.explanation,
  hint: a.hint,
});

interface InputArgs {
  name: string;
  level: Level;
  prompt: L;
  scene?: Scene;
  reveal?: Scene;
  answer: number;
  explanation: L;
  hint: L;
}

const input = (a: InputArgs): InputStep => ({
  id: `p:${SKILL}:${a.name}`,
  type: "input",
  skill: SKILL,
  level: a.level,
  prompt: a.prompt,
  scene: a.scene,
  reveal: a.reveal,
  answers: [String(a.answer)],
  mode: "number",
  explanation: a.explanation,
  hint: a.hint,
});

const match = (name: string, level: Level, prompt: L, pairs: MatchStep["pairs"], explanation: L, hint: L): MatchStep => ({
  id: `p:${SKILL}:${name}`,
  type: "match",
  skill: SKILL,
  level,
  prompt,
  pairs,
  explanation,
  hint,
});

const order = (name: string, level: Level, prompt: L, items: OrderStep["items"], explanation: L, hint: L): OrderStep => ({
  id: `p:${SKILL}:${name}`,
  type: "order",
  skill: SKILL,
  level,
  prompt,
  items,
  explanation,
  hint,
});

const multi = (name: string, level: Level, prompt: L, scene: Scene, options: L[], correct: number[], whyWrong: (L | null)[], explanation: L, hint: L): MultiStep => ({
  id: `p:${SKILL}:${name}`,
  type: "multi",
  skill: SKILL,
  level,
  prompt,
  scene,
  options,
  correct,
  whyWrong,
  explanation,
  hint,
});

// ---------- Фабрики по данным графа ----------

/** Степень вершины по матрице (ввод числа). */
function degInput(name: string, labels: string[], m: number[][], v: string): InputStep {
  const i = labels.indexOf(v);
  const d = degOf(m, i);
  const row = m[i].join(" ");
  return input({
    name,
    level: 1,
    prompt: w(`Матрица смежности неориентированного графа. Чему равна степень вершины ${v}?`, `Бағытталмаған графтың көршілестік матрицасы. ${v} төбесінің дәрежесі неге тең?`),
    scene: matrixScene(labels, m),
    reveal: matrixScene(labels, m, { sums: "row", rows: [i] }),
    answer: d,
    explanation: w(
      `Степень вершины — сумма её строки. Строка ${v}: ${row}, сумма ${d}. Степень вершины ${v}: ${d}.`,
      `Төбенің дәрежесі — оның жолының қосындысы. ${v} жолы: ${row}, қосынды ${d}. ${v} төбесінің дәрежесі: ${d}.`,
    ),
    hint: w(`Найди в таблице строку ${v} и сложи числа в ней.`, `Кестеден ${v} жолын тауып, ондағы сандарды қос.`),
  });
}

/** Число рёбер по матрице (ввод числа). */
function edgesInput(name: string, labels: string[], m: number[][], level: Level): InputStep {
  const s = total(m);
  return input({
    name,
    level,
    prompt: w("Матрица смежности неориентированного графа. Сколько в графе рёбер?", "Бағытталмаған графтың көршілестік матрицасы. Графта қанша қабырға бар?"),
    scene: matrixScene(labels, m),
    reveal: matrixScene(labels, m, { sums: "row", cols: [labels.length] }),
    answer: s / 2,
    explanation: w(
      `Сумма всех чисел матрицы: ${s}. Каждое ребро записано дважды (в клетках i–j и j–i), поэтому рёбер ${s} / 2 = ${s / 2}.`,
      `Матрицаның барлық сандарының қосындысы: ${s}. Әр қабырға екі рет жазылған (i–j және j–i ұяшықтарында), сондықтан қабырғалар ${s} / 2 = ${s / 2}.`,
    ),
    hint: w("Сложи все числа матрицы (удобно — суммы строк) и вспомни, сколько раз записано каждое ребро.", "Матрицаның барлық сандарын қос (жолдардың қосындыларымен ыңғайлы) және әр қабырға қанша рет жазылғанын еске түсір."),
  });
}

/** Вершина с наибольшей степенью (выбор буквы). */
function maxDegChoice(name: string, labels: string[], m: number[][]): ChoiceStep {
  const degs = labels.map((_, i) => degOf(m, i));
  const top = degs.indexOf(Math.max(...degs));
  const others = labels.map((_, i) => i).filter((i) => i !== top).slice(0, 3);
  const idx = [top, ...others];
  return choice({
    name,
    level: 2,
    prompt: w("Матрица смежности неориентированного графа. Какая вершина имеет наибольшую степень?", "Бағытталмаған графтың көршілестік матрицасы. Қай төбенің дәрежесі ең үлкен?"),
    scene: matrixScene(labels, m),
    reveal: matrixScene(labels, m, { sums: "row", rows: [top] }),
    options: idx.map((i) => labels[i]),
    correct: 0,
    whyWrong: idx.map((i, k) =>
      k === 0 ? null : w(`Степень вершины ${labels[i]} равна ${degs[i]}, а наибольшая — ${degs[top]}.`, `${labels[i]} төбесінің дәрежесі ${degs[i]}, ал ең үлкені — ${degs[top]}.`),
    ),
    explanation: w(
      `Степени — суммы строк: ${labels.map((l, i) => `${l} — ${degs[i]}`).join(", ")}. Наибольшая у вершины ${labels[top]}.`,
      `Дәрежелер — жолдардың қосындылары: ${labels.map((l, i) => `${l} — ${degs[i]}`).join(", ")}. Ең үлкені ${labels[top]} төбесінде.`,
    ),
    hint: w("Сложи числа в каждой строке: у какой строки сумма больше всех?", "Әр жолдағы сандарды қос: қай жолдың қосындысы ең үлкен?"),
  });
}

/** Сколько стрелок входит в вершину или выходит из неё (по схеме). */
function inOutChoice(name: string, edges: Edge[], m: number[][], v: string, dir: "in" | "out"): ChoiceStep {
  const j = L5.indexOf(v);
  const outd = degOf(m, j);
  const ind = inDegOf(m, j);
  const correct = dir === "in" ? ind : outd;
  const opp = dir === "in" ? outd : ind;
  const opts = numOptions(correct, [
    [opp, dir === "in" ? w("Это число **выходящих** стрелок, а в вопросе — входящие.", "Бұл **шығатын** көрсеткілер саны, ал сұрақта — кіретіндер.") : w("Это число **входящих** стрелок, а в вопросе — выходящие.", "Бұл **кіретін** көрсеткілер саны, ал сұрақта — шығатындар.")],
    [ind + outd, w("Так считаются все стрелки, которые касаются вершины: и входящие, и выходящие.", "Төбеге тиетін барлық көрсеткілер осылай саналады: кіретіндер де, шығатындар да.")],
    [edges.length, w("Это число всех стрелок графа, а не только стрелок одной вершины.", "Бұл графтың барлық көрсеткілерінің саны, бір төбенің көрсеткілері ғана емес.")],
  ]);
  const names = edges.map(([a, b]) => `${a}→${b}`).join(", ");
  return choice({
    name,
    level: 2,
    prompt: dir === "in" ? w(`Сколько стрелок входит в вершину ${v}?`, `${v} төбесіне қанша көрсеткі кіреді?`) : w(`Сколько стрелок выходит из вершины ${v}?`, `${v} төбесінен қанша көрсеткі шығады?`),
    scene: digraphScene(edges),
    options: opts.options,
    correct: opts.correct,
    whyWrong: opts.whyWrong,
    explanation:
      dir === "in"
        ? w(`Стрелки графа: ${names}. В вершину ${v} входят ${ind}, а выходят ${outd}. Нужны входящие: ${ind}.`, `Графтың көрсеткілері: ${names}. ${v} төбесіне ${ind} көрсеткі кіреді, ${outd} көрсеткі шығады. Кіретіндері керек: ${ind}.`)
        : w(`Стрелки графа: ${names}. Из вершины ${v} выходят ${outd}, а входят ${ind}. Нужны выходящие: ${outd}.`, `Графтың көрсеткілері: ${names}. ${v} төбесінен ${outd} көрсеткі шығады, ${ind} көрсеткі кіреді. Шығатындары керек: ${outd}.`),
    hint:
      dir === "in"
        ? w("Считай только стрелки, у которых наконечник направлен в эту вершину.", "Тек ұшы осы төбеге қараған көрсеткілерді сана.")
        : w("Считай только стрелки, которые начинаются в этой вершине (там, откуда стрелка идёт).", "Тек осы төбеден басталатын (көрсеткі шығатын жерде) көрсеткілерді сана."),
  });
}

/** Программа: сколько вершин, у которых сумма строки удовлетворяет условию. */
function countDegInput(name: string, labels: string[], m: number[][], op: "==" | ">=", k: number): InputStep {
  const degs = labels.map((_, i) => degOf(m, i));
  const hits = labels.filter((_, i) => (op === "==" ? degs[i] === k : degs[i] >= k));
  const n = labels.length;
  return input({
    name,
    level: 2,
    prompt: w("Матрица m описывает граф. Что выведет программа?", "m матрицасы графты сипаттайды. Программа не шығарады?"),
    scene: code([...matrixLines(m), "k = 0", `for i in range(${n}):`, `    if sum(m[i]) ${op} ${k}:`, "        k += 1", "print(k)"]),
    reveal: matrixScene(labels, m, { sums: "row", rows: labels.map((_, i) => i).filter((i) => (op === "==" ? degs[i] === k : degs[i] >= k)) }),
    answer: hits.length,
    explanation: w(
      `Программа считает вершины, у которых сумма строки ${op} ${k}. Суммы строк: ${labels.map((l, i) => `${l} — ${degs[i]}`).join(", ")}. Подходят ${hits.join(", ")}, значит, k = ${hits.length}.`,
      `Программа жолының қосындысы ${op} ${k} болатын төбелерді санайды. Жолдардың қосындылары: ${labels.map((l, i) => `${l} — ${degs[i]}`).join(", ")}. ${hits.join(", ")} сәйкес келеді, демек k = ${hits.length}.`,
    ),
    hint: w("Для каждой строки найди сумму и проверь условие в `if`. Сколько строк его выполняют?", "Әр жолдың қосындысын тауып, `if` ішіндегі шартты тексер. Қанша жол оны орындайды?"),
  });
}

/** Кратчайший путь по таблице (ввод числа). */
function shortestInput(name: string, roads: Road[], from: string, to: string): InputStep {
  const all = routes(roads, from, to);
  const best = all[0];
  return input({
    name,
    level: 2,
    prompt: w(
      `Пункты A–F связаны дорогами, длины которых даны в таблице (прочерк — прямой дороги нет). Найдите длину кратчайшего пути из ${from} в ${to}.`,
      `A–F пункттері ұзындықтары кестеде берілген жолдармен байланысқан (сызықша — тікелей жол жоқ). ${from} пунктінен ${to} пунктіне дейінгі ең қысқа маршруттың ұзындығын табыңыз.`,
    ),
    scene: distScene(L6, roads),
    answer: best.len,
    explanation: w(
      `Выпишем маршруты и их длины: ${all.map((r) => `${pathText(r)} = ${r.len}`).join("; ")}. Наименьшая длина: ${best.len} (${pathText(best)}).`,
      `Маршруттарды және олардың ұзындықтарын жазайық: ${all.map((r) => `${pathText(r)} = ${r.len}`).join("; ")}. Ең кіші ұзындық: ${best.len} (${pathText(best)}).`,
    ),
    hint: w(
      `Выпиши все маршруты из ${from} в ${to} без повторов пунктов (их ${all.length}) и сложи длины дорог каждого. Важно не пропустить ни один.`,
      `${from} пунктінен ${to} пунктіне пункттерді қайталамай барлық маршрутты жазып (олар ${all.length}), әрқайсысының жол ұзындықтарын қос. Бірде-бірін өткізіп алмау маңызды.`,
    ),
  });
}

/** Кратчайший путь через пункт (уровень C). */
function viaInput(name: string, roads: Road[], via: string): InputStep {
  const all = routes(roads, "A", "F");
  const ok = routes(roads, "A", "F", { via });
  return input({
    name,
    level: 3,
    prompt: w(
      `Пункты A–F связаны дорогами (длины в таблице). Найдите длину кратчайшего маршрута из A в F, проходящего через пункт ${via} (каждый пункт — не более одного раза).`,
      `A–F пункттері жолдармен байланысқан (ұзындықтары кестеде). A пунктінен F пунктіне ${via} пункті арқылы өтетін ең қысқа маршруттың ұзындығын табыңыз (әр пункт ең көбі бір рет).`,
    ),
    scene: distScene(L6, roads),
    answer: ok[0].len,
    explanation: w(
      `Из всех маршрутов (${all.length}) через ${via} идут: ${ok.map((r) => `${pathText(r)} = ${r.len}`).join("; ")}. Наименьший — ${ok[0].len}.${all[0].path.includes(via) ? "" : ` Общий кратчайший маршрут (${pathText(all[0])} = ${all[0].len}) через ${via} не идёт, поэтому не подходит.`}`,
      `Барлық ${all.length} маршруттың ішінен ${via} арқылы өтетіндері: ${ok.map((r) => `${pathText(r)} = ${r.len}`).join("; ")}. Ең кішісі — ${ok[0].len}.${all[0].path.includes(via) ? "" : ` Жалпы ең қысқа маршрут (${pathText(all[0])} = ${all[0].len}) ${via} арқылы өтпейді, сондықтан сәйкес келмейді.`}`,
    ),
    hint: w(`Выпиши только те маршруты из A в F, в которых есть пункт ${via}, и выбери наименьшую длину среди них.`, `A пунктінен F пунктіне дейінгі тек құрамында ${via} пункті бар маршруттарды жазып, солардың ішінен ең кіші ұзындықты таңда.`),
  });
}

/** Кратчайший путь при закрытых дорогах (уровень C). */
function closedInput(name: string, roads: Road[], closed: [string, string][]): InputStep {
  const ok = routes(roads, "A", "F", { closed });
  const list = closed.map(([a, b]) => `${a}–${b}`);
  const wasBest = routes(roads, "A", "F")[0];
  return input({
    name,
    level: 3,
    prompt: w(
      `Пункты A–F связаны дорогами (длины в таблице). ${list.length === 1 ? `Дорога ${list[0]} закрыта` : `Дороги ${list.join(" и ")} закрыты`} на ремонт. Найдите длину кратчайшего пути из A в F по оставшимся дорогам.`,
      `A–F пункттері жолдармен байланысқан (ұзындықтары кестеде). ${list.length === 1 ? `${list[0]} жолы` : `${list.join(" және ")} жолдары`} жөндеуге жабылған. A пунктінен F пунктіне қалған жолдармен баратын ең қысқа маршруттың ұзындығын табыңыз.`,
    ),
    scene: distScene(L6, roads),
    answer: ok[0].len,
    explanation: w(
      `Раньше кратчайшим был маршрут ${pathText(wasBest)} (${wasBest.len}). Этот маршрут идёт по закрытой дороге, поэтому остаются: ${ok.map((r) => `${pathText(r)} = ${r.len}`).join("; ")}. Наименьшая длина: ${ok[0].len}.`,
      `Бұрын ең қысқа ${pathText(wasBest)} маршруты болған (${wasBest.len}). Бұл маршрут жабық жолмен өтеді, сондықтан мыналар қалады: ${ok.map((r) => `${pathText(r)} = ${r.len}`).join("; ")}. Ең кіші ұзындық: ${ok[0].len}.`,
    ),
    hint: w("Вычеркни из всех маршрутов те, где есть закрытая дорога, и выбери наименьший среди оставшихся.", "Барлық маршруттан жабық жолы бар маршруттарды сызып таста да, қалғандарының ішінен ең кішісін таңда."),
  });
}

/** Число различных путей по стрелкам в графе без циклов (уровень C): считаем по вершинам, ответ проверяет перебор. */
function pathsInput(name: string, edges: Edge[], m: number[][], from: string, to: string): InputStep {
  const n = countPaths(m, L5, from, to);
  // Число путей в вершину = сумма чисел путей в вершины, из которых в неё входят стрелки (порядок — топологический).
  const memo = new Map<string, number>();
  const ways = (v: string): number => {
    if (v === from) return 1;
    if (!memo.has(v)) memo.set(v, edges.filter(([, b]) => b === v).reduce((a, [u]) => a + ways(u), 0));
    return memo.get(v)!;
  };
  const order: string[] = [];
  const visit = (v: string) => {
    if (order.includes(v)) return;
    edges.filter(([, b]) => b === v).forEach(([u]) => visit(u));
    order.push(v);
  };
  visit(to);
  if (ways(to) !== n) throw new Error(`pathsInput ${name}: подсчёт по вершинам ${ways(to)} ≠ перебор ${n}`);
  const steps = order.map((v) => {
    const pre = edges.filter(([, b]) => b === v).map(([u]) => u);
    if (v === from) return `${v} = 1`;
    return pre.length === 1 ? `${v} = ${pre[0]} = ${ways(v)}` : `${v} = ${pre.join(" + ")} = ${pre.map(ways).join(" + ")} = ${ways(v)}`;
  });
  return input({
    name,
    level: 3,
    prompt: w(`Сколько различных путей ведёт из ${from} в ${to}? Идти можно только по стрелкам.`, `${from} төбесінен ${to} төбесіне неше түрлі маршрут бар? Тек көрсеткілер бойынша жүруге болады.`),
    scene: digraphScene(edges, edges.some(([a, b]) => a === "C" && b === "D") ? ZIG : POS),
    answer: n,
    explanation: w(
      `Стрелки: ${edges.map(([a, b]) => `${a}→${b}`).join(", ")}. Считаем по вершинам: число путей в вершину — сумма чисел путей в те вершины, из которых в неё входят стрелки. ${steps.join("; ")}. Всего путей: ${n}.`,
      `Көрсеткілер: ${edges.map(([a, b]) => `${a}→${b}`).join(", ")}. Төбелер бойынша санаймыз: төбеге баратын маршруттар саны — оған көрсеткі келетін төбелерге баратын маршруттар сандарының қосындысы. ${steps.join("; ")}. Барлығы: ${n}.`,
    ),
    hint: w(
      `Начни с ${from} = 1. Для каждой следующей вершины сложи числа путей тех вершин, из которых в неё входят стрелки.`,
      `${from} = 1 деп баста. Әр келесі төбе үшін оған көрсеткі келетін төбелердің маршрут сандарын қос.`,
    ),
  });
}

/** Закон рукопожатий: найти неизвестную степень (уровень C). */
function handshakeInput(name: string, n: number, edges: number, known: number[]): InputStep {
  const x = 2 * edges - sumRow(known);
  const list = known.join(", ");
  return input({
    name,
    level: 3,
    prompt: w(
      `В неориентированном графе ${n} вершин и ${edges} рёбер. Степени ${known.length} вершин равны ${list}. Чему равна степень последней, неизвестной вершины?`,
      `Бағытталмаған графта ${n} төбе және ${edges} қабырға бар. ${known.length} төбенің дәрежелері: ${list}. Белгісіз соңғы төбенің дәрежесі неге тең?`,
    ),
    answer: x,
    explanation: w(
      `Каждое ребро даёт степень двум вершинам, поэтому сумма всех степеней равна 2 · ${edges} = ${2 * edges}. Известные степени дают ${sumRow(known)}, остаётся ${2 * edges} − ${sumRow(known)} = ${x}.`,
      `Әр қабырға екі төбенің дәрежесін қосады, сондықтан барлық дәрежелердің қосындысы 2 · ${edges} = ${2 * edges}. Белгілі дәрежелер ${sumRow(known)} береді, қалғаны ${2 * edges} − ${sumRow(known)} = ${x}.`,
    ),
    hint: w("Сумма степеней всех вершин связана с числом рёбер: каждое ребро учитывается у двух своих концов.", "Барлық төбелер дәрежелерінің қосындысы қабырғалар санымен байланысты: әр қабырға өзінің екі ұшында есептеледі."),
  });
}

/** Столбец из нулей / строка из нулей в матрице ориентированного графа. */
function sourceChoice(name: string, m: number[][], kind: "source" | "sink"): ChoiceStep {
  const idx = L5.map((_, i) => i);
  const target = idx.find((i) => (kind === "source" ? inDegOf(m, i) === 0 : degOf(m, i) === 0))!;
  const others = idx.filter((i) => i !== target).slice(0, 3);
  const all = [target, ...others];
  const sumsLabel = (i: number) => (kind === "source" ? inDegOf(m, i) : degOf(m, i));
  return choice({
    name,
    level: 2,
    prompt:
      kind === "source"
        ? w("Дана матрица смежности ориентированного графа. В какую вершину не входит ни одна стрелка?", "Бағытталған графтың көршілестік матрицасы берілген. Қай төбеге бірде-бір көрсеткі кірмейді?")
        : w("Дана матрица смежности ориентированного графа. Из какой вершины не выходит ни одна стрелка?", "Бағытталған графтың көршілестік матрицасы берілген. Қай төбеден бірде-бір көрсеткі шықпайды?"),
    scene: matrixScene(L5, m),
    reveal: matrixScene(L5, m, { sums: "both", ...(kind === "source" ? { cols: [target] } : { rows: [target] }) }),
    options: all.map((i) => L5[i]),
    correct: 0,
    whyWrong: all.map((i, k) =>
      k === 0
        ? null
        : kind === "source"
          ? w(`В вершину ${L5[i]} входит стрелок: ${sumsLabel(i)}. Нужна вершина с пустым столбцом.`, `${L5[i]} төбесіне кіретін көрсеткілер: ${sumsLabel(i)}. Бағаны бос төбе керек.`)
          : w(`Из вершины ${L5[i]} выходит стрелок: ${sumsLabel(i)}. Нужна вершина с пустой строкой.`, `${L5[i]} төбесінен шығатын көрсеткілер: ${sumsLabel(i)}. Жолы бос төбе керек.`),
    ),
    explanation:
      kind === "source"
        ? w(`Входящие стрелки — это единицы в столбце. Столбец ${L5[target]} состоит из одних нулей, значит, в вершину ${L5[target]} не входит ни одна стрелка.`, `Кіретін көрсеткілер — бағандағы бірліктер. ${L5[target]} бағаны тек нөлден тұрады, демек ${L5[target]} төбесіне бірде-бір көрсеткі кірмейді.`)
        : w(`Выходящие стрелки — это единицы в строке. Строка ${L5[target]} состоит из одних нулей, значит, из вершины ${L5[target]} не выходит ни одна стрелка.`, `Шығатын көрсеткілер — жолдағы бірліктер. ${L5[target]} жолы тек нөлден тұрады, демек ${L5[target]} төбесінен бірде-бір көрсеткі шықпайды.`),
    hint:
      kind === "source"
        ? w("Входящие стрелки вершины записаны в её столбце. Найди столбец, где все нули.", "Төбенің кіретін көрсеткілері оның бағанында жазылған. Барлығы нөл болатын бағанды тап.")
        : w("Выходящие стрелки вершины записаны в её строке. Найди строку, где все нули.", "Төбенің шығатын көрсеткілері оның жолында жазылған. Барлығы нөл болатын жолды тап."),
  });
}

// ---------- Задания ----------

const QUESTIONS: QuestionStep[] = [
  // ======== Уровень A: применить правило ========
  degInput("deg-f1-c", L4, F1, "C"),
  degInput("deg-u3-b", L5, U3, "B"),
  degInput("deg-u2-e", L5, U2, "E"),
  choice({
    name: "kind-friends",
    level: 1,
    prompt: w(
      "Вершины графа — люди, ребро означает «дружат». Дружба взаимная: если A дружит с B, то и B дружит с A. Какой это граф?",
      "Графтың төбелері — адамдар, қабырға «дос» дегенді білдіреді. Достық өзара: A төбесі B төбесімен дос болса, B де A төбесімен дос. Бұл қандай граф?",
    ),
    options: [w("Неориентированный", "Бағытталмаған"), w("Ориентированный", "Бағытталған"), w("Граф без рёбер", "Қабырғасыз граф"), w("Граф без вершин", "Төбесіз граф")],
    correct: 0,
    whyWrong: [
      null,
      w("Стрелки нужны, когда связь идёт в одну сторону. Дружба взаимная, поэтому хватает обычной линии.", "Көрсеткілер байланыс бір жаққа жүргенде керек. Достық өзара, сондықтан қарапайым сызық жеткілікті."),
      w("Друзья есть, значит, рёбра есть.", "Достар бар, демек қабырғалар бар."),
      w("Люди есть, значит, вершины есть.", "Адамдар бар, демек төбелер бар."),
    ],
    explanation: w(
      "Связь работает в обе стороны, поэтому ребро — линия без стрелки, а граф неориентированный.",
      "Байланыс екі жаққа жұмыс істейді, сондықтан қабырға — көрсеткісіз сызық, ал граф бағытталмаған.",
    ),
    hint: w("Спроси себя: если связь есть от A к B, есть ли она и от B к A?", "Өзіңнен сұра: A төбесінен B төбесіне байланыс болса, B төбесінен A төбесіне де бар ма?"),
  }),
  choice({
    name: "kind-subscribe",
    level: 1,
    prompt: w(
      "Вершины графа — аккаунты. Стрелка A → B означает «A подписан на B». Какой это граф?",
      "Графтың төбелері — аккаунттар. A → B көрсеткісі «A аккаунты B аккаунтына жазылған» дегенді білдіреді. Бұл қандай граф?",
    ),
    options: [w("Ориентированный", "Бағытталған"), w("Неориентированный", "Бағытталмаған"), w("Граф без рёбер", "Қабырғасыз граф"), w("Матрица смежности", "Көршілестік матрицасы")],
    correct: 0,
    whyWrong: [
      null,
      w("В неориентированном графе рёбра рисуют линиями, и связь взаимная. Подписка идёт только от A к B.", "Бағытталмаған графта қабырғаларды сызықпен салады және байланыс өзара. Жазылу тек A төбесінен B төбесіне қарай жүреді."),
      w("Стрелки — это и есть рёбра.", "Көрсеткілер — қабырғалардың өзі."),
      w("Матрица смежности — способ записи графа, а не вид графа.", "Көршілестік матрицасы — графты жазу тәсілі, графтың түрі емес."),
    ],
    explanation: w(
      "Подписка работает только в одну сторону, поэтому рёбра — стрелки, а граф ориентированный.",
      "Жазылу тек бір жаққа жұмыс істейді, сондықтан қабырғалар — көрсеткілер, ал граф бағытталған.",
    ),
    hint: w("Есть ли в вопросе слово «взаимно» или связь идёт только в одну сторону?", "Сұрақта «өзара» деген сөз бар ма, әлде байланыс тек бір жаққа жүре ме?"),
  }),
  choice({
    name: "one-meaning",
    level: 1,
    prompt: w("Что означает число 1 в строке C и столбце E матрицы смежности?", "Көршілестік матрицасының C жолы мен E бағанындағы 1 саны нені білдіреді?"),
    options: [
      w("Между вершинами C и E есть ребро", "C және E төбелерінің арасында қабырға бар"),
      w("Степень вершины C равна 1", "C төбесінің дәрежесі 1-ге тең"),
      w("Вершина E стоит первой", "E төбесі бірінші тұр"),
      w("Вершины C и E не связаны", "C және E төбелері байланыспаған"),
    ],
    correct: 0,
    whyWrong: [
      null,
      w("Степень — это сумма всей строки, а не одно число из неё.", "Дәреже — бүкіл жолдың қосындысы, ондағы бір сан емес."),
      w("Порядок вершин задают подписи строк и столбцов, а не значения в клетках.", "Төбелердің ретін жолдар мен бағандардың жазулары береді, ұяшықтардағы мәндер емес."),
      w("Наоборот: 1 значит «связь есть», а 0 — «связи нет».", "Керісінше: 1 «байланыс бар», ал 0 «байланыс жоқ» дегенді білдіреді."),
    ],
    explanation: w(
      "Единица на пересечении строки C и столбца E говорит, что вершины C и E соединены ребром. Нуль означал бы, что ребра нет.",
      "C жолы мен E бағанының қиылысындағы бірлік C және E төбелерінің қабырғамен қосылғанын көрсетеді. Нөл қабырға жоқ дегенді білдірер еді.",
    ),
    hint: w("Строка — «откуда», столбец — «куда», число показывает, есть ли связь.", "Жол — «қайдан», баған — «қайда», сан байланыс бар-жоғын көрсетеді."),
  }),
  choice({
    name: "diagonal",
    level: 1,
    prompt: w("Что обычно стоит на главной диагонали матрицы смежности (клетки A–A, B–B, C–C…)?", "Көршілестік матрицасының басты диагоналінде (A–A, B–B, C–C… ұяшықтарында) әдетте не тұрады?"),
    options: [
      w("Нули: вершина не соединена сама с собой", "Нөлдер: төбе өзімен қосылмаған"),
      w("Единицы: каждая вершина связана с собой", "Бірліктер: әр төбе өзімен байланысқан"),
      w("Степени вершин", "Төбелердің дәрежелері"),
      w("Номера вершин", "Төбелердің нөмірлері"),
    ],
    correct: 0,
    whyWrong: [
      null,
      w("Обычно в графе нет петель (рёбер из вершины в неё же), поэтому на диагонали нули.", "Әдетте графта ілмектер (төбеден өзіне баратын қабырғалар) болмайды, сондықтан диагональда нөлдер тұрады."),
      w("Степени получаются как суммы строк, в клетках матрицы они не записаны.", "Дәрежелер жолдардың қосындысы ретінде шығады, матрицаның ұяшықтарында жазылмайды."),
      w("Номера вершин — это подписи сверху и слева, а не содержимое клеток.", "Төбелердің нөмірлері — жоғарыдағы және сол жақтағы жазулар, ұяшықтардың мазмұны емес."),
    ],
    explanation: w(
      "Клетка A–A спрашивает: «есть ли ребро из A в A?». Обычно такого ребра нет, поэтому на главной диагонали стоят нули.",
      "A–A ұяшығы «A төбесінен A төбесіне қабырға бар ма?» деп сұрайды. Әдетте мұндай қабырға болмайды, сондықтан басты диагональда нөлдер тұрады.",
    ),
    hint: w("Клетка A–A спрашивает про ребро из A в саму A. Бывает ли оно в обычной карте дорог?", "A–A ұяшығы A төбесінен өзіне баратын қабырға туралы сұрайды. Қарапайым жол картасында ол болады ма?"),
  }),
  input({
    name: "weight-cf",
    level: 1,
    prompt: w("В таблице — длины дорог между пунктами (прочерк — дороги нет). Какова длина дороги между пунктами C и F?", "Кестеде — пункттер арасындағы жолдардың ұзындығы (сызықша — жол жоқ). C және F пункттері арасындағы жолдың ұзындығы қанша?"),
    scene: distScene(L6, W1),
    answer: 2,
    explanation: w(
      "Находим строку C и столбец F: на пересечении 2. Таблица симметрична: на пересечении строки F и столбца C тоже 2.",
      "C жолы мен F бағанын табамыз: қиылысында 2 тұр. Кесте симметриялы: F жолы мен C бағанының қиылысында да 2.",
    ),
    hint: w("Найди строку C и иди по ней до столбца F.", "C жолын тауып, F бағанына дейін жүр."),
  }),
  input({
    name: "weight-be",
    level: 1,
    prompt: w("В таблице — длины дорог между пунктами (прочерк — дороги нет). Какова длина дороги между пунктами B и E?", "Кестеде — пункттер арасындағы жолдардың ұзындығы (сызықша — жол жоқ). B және E пункттері арасындағы жолдың ұзындығы қанша?"),
    scene: distScene(L6, W1),
    answer: 8,
    explanation: w("Строка B, столбец E: на пересечении 8.", "B жолы, E бағаны: қиылысында 8 тұр."),
    hint: w("Найди строку B и столбец E, ответ — на их пересечении.", "B жолы мен E бағанын тап, жауап олардың қиылысында."),
  }),
  match(
    "match-terms",
    1,
    w("Соедини понятие с его смыслом.", "Ұғымды оның мағынасымен жұптастыр."),
    [
      { left: w("Сумма строки матрицы", "Матрица жолының қосындысы"), right: w("степень вершины", "төбенің дәрежесі") },
      { left: w("Симметричная матрица", "Симметриялы матрица"), right: w("неориентированный граф", "бағытталмаған граф") },
      { left: w("Сумма всех чисел (неориентированный граф)", "Барлық сандардың қосындысы (бағытталмаған граф)"), right: w("удвоенное число рёбер", "қабырғалар санының екі еселенгені") },
      { left: w("Единица в клетке i–j", "i–j ұяшығындағы бірлік"), right: w("между вершинами i и j есть ребро", "i және j төбелерінің арасында қабырға бар") },
    ],
    w(
      "Сумма строки — степень вершины. Симметричная матрица у неориентированного графа. Сумма всех чисел вдвое больше числа рёбер. Единица говорит, что ребро есть.",
      "Жолдың қосындысы — төбенің дәрежесі. Симметриялы матрица бағытталмаған графта болады. Барлық сандардың қосындысы қабырғалар санынан екі есе көп. Бірлік қабырға барын көрсетеді.",
    ),
    w("Начни с самого простого: что показывает единица в клетке и что получится, если сложить одну строку.", "Ең қарапайымынан баста: ұяшықтағы бірлік нені көрсетеді және бір жолды қосса не шығады."),
  ),
  choice({
    name: "deg-from-edges",
    level: 1,
    prompt: w("В графе есть рёбра AB, AC, BC и CD. Чему равна степень вершины C?", "Графта AB, AC, BC және CD қабырғалары бар. C төбесінің дәрежесі неге тең?"),
    options: ["3", "2", "4", "1"],
    correct: 0,
    whyWrong: [
      null,
      w("2 — степень вершины A (рёбра AB и AC) или B (рёбра AB и BC), но не C.", "2 — A төбесінің (AB және AC қабырғалары) немесе B төбесінің (AB және BC) дәрежесі, C төбесінің емес."),
      w("4 — число всех рёбер графа, а не рёбер вершины C.", "4 — графтың барлық қабырғаларының саны, C төбесінің қабырғалары емес."),
      w("1 — степень вершины D (у неё одно ребро, CD).", "1 — D төбесінің дәрежесі (оның бір қабырғасы бар, CD)."),
    ],
    explanation: w(
      "Вершина C входит в рёбра AC, BC и CD — их три, значит, степень C равна 3.",
      "C төбесі AC, BC және CD қабырғаларына кіреді — олар үшеу, демек C төбесінің дәрежесі 3-ке тең.",
    ),
    hint: w("Выпиши рёбра, в названии которых есть буква C, и сосчитай их.", "Атауында C әрпі бар қабырғаларды жазып, санап шық."),
  }),

  // ======== Уровень B: распознать модель, сравнить ========
  edgesInput("edges-u1", L5, U1, 2),
  edgesInput("edges-x6", L6, X6, 2),
  choice({
    name: "edges-u3-choice",
    level: 2,
    prompt: w("Матрица смежности неориентированного графа. Сколько в графе рёбер?", "Бағытталмаған графтың көршілестік матрицасы. Графта қанша қабырға бар?"),
    scene: matrixScene(L5, U3),
    reveal: matrixScene(L5, U3, { sums: "row", cols: [5] }),
    ...(() => {
      const o = numOptions(total(U3) / 2, [
        [total(U3), w("12 — сумма всех чисел матрицы: каждое ребро в ней записано дважды.", "12 — матрицаның барлық сандарының қосындысы: әр қабырға онда екі рет жазылған.")],
        [5, w("5 — число вершин, а не рёбер.", "5 — төбелер саны, қабырғалар емес.")],
        [3, w("3 — наибольшая степень вершины, а не число рёбер.", "3 — төбенің ең үлкен дәрежесі, қабырғалар саны емес.")],
      ]);
      return { options: o.options, correct: o.correct, whyWrong: o.whyWrong };
    })(),
    explanation: w(
      "Сумма всех чисел матрицы равна 12. Каждое ребро записано дважды, значит, рёбер 12 / 2 = 6.",
      "Матрицаның барлық сандарының қосындысы 12. Әр қабырға екі рет жазылған, демек қабырғалар 12 / 2 = 6.",
    ),
    hint: w("Найди сумму всех чисел и вспомни, сколько раз записано каждое ребро.", "Барлық сандардың қосындысын тауып, әр қабырға қанша рет жазылғанын еске түсір."),
  }),
  maxDegChoice("maxdeg-u2", L5, U2),
  maxDegChoice("maxdeg-u5", L5, U5),
  inOutChoice("inout-d2-b-in", D2_EDGES, D2, "B", "in"),
  inOutChoice("inout-d1-c-in", D1_EDGES, D1, "C", "in"),
  inOutChoice("inout-d3-a-out", D3_EDGES, D3, "A", "out"),
  input({
    name: "sum14",
    level: 2,
    prompt: w("Сумма всех чисел матрицы смежности неориентированного графа равна 14. Сколько в графе рёбер?", "Бағытталмаған графтың көршілестік матрицасындағы барлық сандардың қосындысы 14. Графта қанша қабырға бар?"),
    answer: 7,
    explanation: w("Каждое ребро записано в матрице дважды, поэтому рёбер 14 / 2 = 7.", "Әр қабырға матрицада екі рет жазылған, сондықтан қабырғалар 14 / 2 = 7."),
    hint: w("Сколько раз в симметричной матрице записано каждое ребро?", "Симметриялы матрицада әр қабырға қанша рет жазылған?"),
  }),
  input({
    name: "sum9-directed",
    level: 2,
    prompt: w("Сумма всех чисел матрицы смежности ориентированного графа равна 9. Сколько в нём стрелок?", "Бағытталған графтың көршілестік матрицасындағы барлық сандардың қосындысы 9. Онда қанша көрсеткі бар?"),
    answer: 9,
    explanation: w("В ориентированном графе каждая стрелка записана один раз (строка — откуда, столбец — куда), поэтому делить на 2 не нужно: стрелок 9.", "Бағытталған графта әр көрсеткі бір рет жазылады (жол — қайдан, баған — қайда), сондықтан 2-ге бөлудің қажеті жоқ: көрсеткілер 9."),
    hint: w("Записана ли каждая стрелка дважды, как ребро в неориентированном графе?", "Әр көрсеткі бағытталмаған графтағы қабырға сияқты екі рет жазылған ба?"),
  }),
  countDegInput("count-deg-eq2", L5, U2, "==", 2),
  countDegInput("count-deg-ge2", L5, U1, ">=", 2),
  shortestInput("shortest-w1", W1, "A", "F"),
  shortestInput("shortest-w2", W2, "A", "F"),
  multi(
    "multi-u2",
    2,
    w("Дана матрица смежности неориентированного графа. Выберите верные утверждения.", "Бағытталмаған графтың көршілестік матрицасы берілген. Дұрыс тұжырымдарды таңдаңыз."),
    matrixScene(L5, U2),
    [
      w("В графе 5 рёбер", "Графта 5 қабырға бар"),
      w("Степень вершины A равна 4", "A төбесінің дәрежесі 4-ке тең"),
      w("Вершины D и E соединены ребром", "D және E төбелері қабырғамен қосылған"),
      w("Вершины B и C соединены ребром", "B және C төбелері қабырғамен қосылған"),
      w("Сумма всех чисел матрицы равна 5", "Матрицаның барлық сандарының қосындысы 5-ке тең"),
    ],
    [0, 1, 3],
    [
      null,
      null,
      w("В строке D единица только в столбце A: ребра D–E нет.", "D жолында бірлік тек A бағанында: D–E қабырғасы жоқ."),
      null,
      w("Сумма матрицы равна 10: рёбер 5, но каждое записано дважды.", "Матрицаның қосындысы 10: қабырғалар 5, бірақ әрқайсысы екі рет жазылған."),
    ],
    w(
      "Суммы строк: A — 4, B — 2, C — 2, D — 1, E — 1; сумма матрицы 10, рёбер 5. Ребро B–C есть, ребра D–E нет.",
      "Жолдардың қосындылары: A — 4, B — 2, C — 2, D — 1, E — 1; матрицаның қосындысы 10, қабырғалар 5. B–C қабырғасы бар, D–E қабырғасы жоқ.",
    ),
    w("Найди суммы строк и сумму всей матрицы, а потом проверяй утверждения по одному.", "Жолдардың қосындыларын және бүкіл матрицаның қосындысын тап, содан кейін тұжырымдарды бір-бірден тексер."),
  ),
  order(
    "order-brute-force",
    2,
    w("Расставь шаги поиска кратчайшего пути перебором по порядку.", "Ең қысқа маршрутты іріктеп іздеу қадамдарын ретімен орналастыр."),
    [
      w("Выписать все маршруты без повторов пунктов", "Пункттері қайталанбайтын барлық маршрутты жазу"),
      w("Сложить длины дорог каждого маршрута", "Әр маршруттың жол ұзындықтарын қосу"),
      w("Сравнить полученные суммы", "Алынған қосындыларды салыстыру"),
      w("Выбрать наименьшую сумму", "Ең кіші қосындыны таңдау"),
    ],
    w("Сначала нужно получить список маршрутов, потом для каждого посчитать длину, и только после этого сравнить.", "Алдымен маршруттар тізімін алу керек, содан кейін әрқайсысының ұзындығын есептеп, соңында ғана салыстыру керек."),
    w("Что нужно знать, прежде чем сравнивать маршруты по длине?", "Маршруттарды ұзындығы бойынша салыстырмас бұрын нені білу керек?"),
  ),
  choice({
    name: "reach-d1",
    level: 2,
    prompt: w("Можно ли по стрелкам попасть из B в A?", "Көрсеткілер бойынша B төбесінен A төбесіне жетуге бола ма?"),
    scene: digraphScene(D1_EDGES),
    options: [
      w("Нельзя: ни одна стрелка в A не входит", "Болмайды: A төбесіне бірде-бір көрсеткі кірмейді"),
      w("Можно: B→D→E→A", "Болады: B→D→E→A"),
      w("Можно: B→C→A", "Болады: B→C→A"),
      w("Можно: стрелкой B→A", "Болады: B→A көрсеткісімен"),
    ],
    correct: 0,
    whyWrong: [
      null,
      w("Стрелки E→A на схеме нет: из E выходит только E→C.", "Схемада E→A көрсеткісі жоқ: E төбесінен тек E→C шығады."),
      w("Стрелки B→C нет, а в A всё равно ничего не входит.", "B→C көрсеткісі жоқ, ал A төбесіне бәрібір ештеңе кірмейді."),
      w("Стрелка B→A на схеме не нарисована: из B выходит только B→D.", "Схемада B→A көрсеткісі салынбаған: B төбесінен тек B→D шығады."),
    ],
    explanation: w(
      "Из B можно пройти B→D→E→C→B и по кругу, но в вершину A не ведёт ни одна стрелка (столбец A матрицы состоит из нулей). Значит, из B в A попасть нельзя.",
      "B төбесінен B→D→E→C→B және шеңбер бойымен жүруге болады, бірақ A төбесіне бірде-бір көрсеткі апармайды (матрицаның A бағаны нөлдерден тұрады). Демек, B төбесінен A төбесіне жету мүмкін емес.",
    ),
    hint: w("Посмотри, есть ли хотя бы одна стрелка, которая входит в A.", "A төбесіне кіретін кемінде бір көрсеткі бар-жоғын қара."),
  }),

  sourceChoice("source-d1", D1, "source"),
  sourceChoice("sink-d2", D2, "sink"),

  // ======== Уровень C: несколько шагов, обратная задача ========
  viaInput("via-w2-d", W2, "D"),
  viaInput("via-w1-b", W1, "B"),
  closedInput("closed-w1-cf", W1, [["C", "F"]]),
  closedInput("closed-w2-af-bc", W2, [["A", "F"], ["B", "C"]]),
  handshakeInput("handshake-5-6", 5, 6, [3, 3, 2, 2]),
  handshakeInput("handshake-6-8", 6, 8, [4, 3, 3, 3, 2]),
  choice({
    name: "code-nonadjacent",
    level: 3,
    prompt: WHAT_PRINTS,
    scene: code([...matrixLines(U3), "cnt = 0", "for i in range(5):", "    for j in range(i + 1, 5):", "        if m[i][j] == 0:", "            cnt += 1", "print(cnt)"]),
    reveal: matrixScene(L5, U3),
    ...(() => {
      const n = L5.length;
      const pairs = (n * (n - 1)) / 2;
      const zeros = pairs - total(U3) / 2;
      const o = numOptions(zeros, [
        [total(U3) / 2, w("6 — число единиц над диагональю, то есть рёбер. Программа же считает нули.", "6 — диагональдан жоғарыдағы бірліктер саны, яғни қабырғалар. Ал программа нөлдерді санайды.")],
        [pairs, w("10 — число всех пар i < j. Но в счётчик попадают только пары с нулём.", "10 — барлық i < j жұптарының саны. Бірақ санағышқа тек нөлі бар жұптар түседі.")],
        [pairs * 2 - total(U3), w("8 — так вышло бы, если считать нули по обе стороны от диагонали. Но `j` начинается с `i + 1`.", "8 — нөлдерді диагональдың екі жағынан санаса, осылай шығар еді. Бірақ `j` циклі `i + 1` мәнінен басталады.")],
      ]);
      return { options: o.options, correct: o.correct, whyWrong: o.whyWrong };
    })(),
    explanation: w(
      "Двойной цикл перебирает все пары i < j: их 10. Единица стоит у шести пар (это рёбра), значит, нуль — у остальных 4 пар. Программа считает нули и выводит 4.",
      "Қос цикл барлық i < j жұптарын аралайды: олар 10. Алты жұпта бірлік тұр (бұл қабырғалар), демек қалған 4 жұпта нөл. Программа нөлдерді санап, 4 шығарады.",
    ),
    hint: w("Пар i < j всего 10. Сколько из них рёбра (единицы)? Остальные нулевые.", "i < j жұптары барлығы 10. Олардың қайсысы қабырға (бірлік)? Қалғандары нөл."),
  }),
  choice({
    name: "code-equal-u5",
    level: 3,
    prompt: WHAT_PRINTS,
    scene: code([...matrixLines(U5), "cnt = 0", "for i in range(5):", "    for j in range(i + 1, 5):", "        if m[i][j] == 1 and sum(m[i]) == sum(m[j]):", "            cnt += 1", "print(cnt)"]),
    reveal: matrixScene(L5, U5, { sums: "row" }),
    ...(() => {
      const degs = L5.map((_, i) => degOf(U5, i));
      let hits = 0;
      let edgesTotal = 0;
      let sameDeg = 0;
      let either = 0;
      for (let i = 0; i < 5; i++)
        for (let j = i + 1; j < 5; j++) {
          if (U5[i][j] === 1) edgesTotal++;
          if (degs[i] === degs[j]) sameDeg++;
          if (U5[i][j] === 1 && degs[i] === degs[j]) hits++;
          if (U5[i][j] === 1 || degs[i] === degs[j]) either++;
        }
      const o = numOptions(hits, [
        [edgesTotal, w("7 — число всех рёбер: условие про равные степени не учтено.", "7 — барлық қабырғалардың саны: тең дәрежелер шарты ескерілмеген.")],
        [sameDeg, w("Так считаются пары с равными степенями без проверки ребра, а условие требует и ребро.", "Дәрежелері тең жұптар қабырғаны тексермей осылай саналады, ал шартта қабырға да керек.")],
        [either, w("Так было бы при `or`: подошли бы все рёбра и ещё пары с равными степенями без ребра. А `and` требует оба условия сразу.", "`or` болса, осылай шығар еді: барлық қабырғалар және қабырғасыз, бірақ дәрежелері тең жұптар сәйкес келер еді. Ал `and` екі шартты бірге талап етеді.")],
        [hits * 2, w("Каждая пара считается один раз: `j` начинается с `i + 1`, повторов нет.", "Әр жұп бір рет саналады: `j` циклі `i + 1` мәнінен басталады, қайталану жоқ.")],
      ]);
      return { options: o.options, correct: o.correct, whyWrong: o.whyWrong };
    })(),
    explanation: (() => {
      const degs = L5.map((_, i) => degOf(U5, i));
      const hitPairs: string[] = [];
      for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) if (U5[i][j] === 1 && degs[i] === degs[j]) hitPairs.push(`${L5[i]}${L5[j]} (${degs[i]} и ${degs[j]})`);
      const hitPairsKk = hitPairs.map((p) => p.replace(" и ", " және "));
      return w(
        `Степени: ${L5.map((l, i) => `${l} — ${degs[i]}`).join(", ")}. Условие выполняют рёбра с одинаковыми степенями концов: ${hitPairs.join(", ")}. Их ${hitPairs.length}, программа выводит ${hitPairs.length}.`,
        `Дәрежелер: ${L5.map((l, i) => `${l} — ${degs[i]}`).join(", ")}. Шартты ұштарының дәрежелері бірдей қабырғалар орындайды: ${hitPairsKk.join(", ")}. Олар ${hitPairs.length}, программа ${hitPairs.length} шығарады.`,
      );
    })(),
    hint: w("Найди степень каждой вершины. Затем пройди по рёбрам и отметь те, у которых оба конца имеют одинаковую степень.", "Әр төбенің дәрежесін тап. Содан кейін қабырғалармен жүріп, екі ұшының дәрежесі бірдей қабырғаларды белгіле."),
  }),
  pathsInput("paths-d2-ae", D2_EDGES, D2, "A", "E"),
  pathsInput("paths-d4-ae", D4_EDGES, D4, "A", "E"),
  choice({
    name: "greedy-trap",
    level: 3,
    prompt: w(
      "Водитель едет из A в F по правилу: в каждом пункте он выбирает самую короткую дорогу в ещё не посещённый пункт, даже если из этого пункта есть дорога прямо в F. Какова длина его маршрута?",
      "Жүргізуші A пунктінен F пунктіне мына ереже бойынша жүреді: әр пунктте ол әлі барылмаған пунктке баратын ең қысқа жолды таңдайды, тіпті сол пункттен F пунктіне тікелей жол болса да. Оның маршрутының ұзындығы қанша?",
    ),
    scene: distScene(L6, W3),
    ...(() => {
      const g = greedy(W3, "A", "F");
      const all = routes(W3, "A", "F");
      const o = numOptions(g.len, [
        [all[0].len, w(`${all[0].len} — длина настоящего кратчайшего пути (${pathText(all[0])}), но водитель выбирает по самой короткой дороге из пункта и не видит дальше.`, `${all[0].len} — нағыз ең қысқа маршруттың ұзындығы (${pathText(all[0])}), бірақ жүргізуші пункттен шығатын ең қысқа жолмен таңдайды және әрі қарай көрмейді.`)],
        [all[1].len, w(`${all[1].len} — прямая дорога A–F. Из A водитель сразу выбирает самую короткую дорогу (в E), а не прямую.`, `${all[1].len} — A–F тікелей жолы. A пунктінен жүргізуші бірден ең қысқа жолды (E пунктіне) таңдайды, тікелей жолды емес.`)],
        [all[all.length - 1].len, w(`${all[all.length - 1].len} — самый длинный из маршрутов, но водитель его не выбирает.`, `${all[all.length - 1].len} — маршруттардың ең ұзыны, бірақ жүргізуші оны таңдамайды.`)],
      ]);
      return { options: o.options, correct: o.correct, whyWrong: o.whyWrong };
    })(),
    explanation: (() => {
      const g = greedy(W3, "A", "F");
      const best = shortest(W3, "A", "F");
      return w(
        `Из A самая короткая дорога — в E (1). Из E — в C (2): дорога в F (4) длиннее. Из C — в B (6), из B — в D (5), из D — в F (2). Маршрут ${pathText(g)}: 1 + 2 + 6 + 5 + 2 = ${g.len}. А настоящий кратчайший путь ${pathText(best)} равен ${best.len}: «жадный» выбор не даёт кратчайшего.`,
        `A пунктінен ең қысқа жол — E пунктіне (1). E пунктінен — C пунктіне (2): F пунктіне баратын жол (4) ұзынырақ. C пунктінен — B пунктіне (6), B пунктінен — D пунктіне (5), D пунктінен — F пунктіне (2). ${pathText(g)} маршруты: 1 + 2 + 6 + 5 + 2 = ${g.len}. Ал нағыз ең қысқа маршрут — ${pathText(best)}, ұзындығы ${best.len}: «ашкөз» таңдау ең қысқа маршрутты бермейді.`,
      );
    })(),
    hint: w("Иди по шагам: из текущего пункта выбери самую короткую дорогу в пункт, где водитель ещё не был, и записывай длины.", "Қадам-қадаммен жүр: ағымдағы пункттен жүргізуші әлі болмаған пунктке баратын ең қысқа жолды таңда да, ұзындықтарды жазып отыр."),
  }),
];

// ---------- Утверждения «верно / неверно» ----------

const st = (name: string, level: Level, text: L, value: boolean, explanation: L, hint: L): Statement => ({
  id: `s:${SKILL}:${name}`,
  skill: SKILL,
  level,
  text,
  value,
  explanation,
  hint,
});

const STATEMENTS: Statement[] = [
  st(
    "friends-two-way",
    1,
    w("В неориентированном графе дружбы, если A дружит с B, то и B дружит с A.", "Достықтың бағытталмаған графында A төбесі B төбесімен дос болса, B де A төбесімен дос."),
    true,
    w("Ребро неориентированного графа работает в обе стороны.", "Бағытталмаған графтың қабырғасы екі жаққа да жұмыс істейді."),
    w("Есть ли у ребра без стрелки направление?", "Көрсеткісіз қабырғаның бағыты бар ма?"),
  ),
  st(
    "directed-lines",
    1,
    w("В ориентированном графе рёбра рисуют линиями без стрелок.", "Бағытталған графта қабырғаларды көрсеткісіз сызықпен салады."),
    false,
    w("В ориентированном графе рёбра рисуют стрелками: они показывают направление движения.", "Бағытталған графта қабырғаларды көрсеткімен салады: олар қозғалыс бағытын көрсетеді."),
    w("Что показывает стрелка?", "Көрсеткі нені көрсетеді?"),
  ),
  st(
    "degree-def",
    1,
    w("Степень вершины — это число рёбер, подходящих к ней.", "Төбенің дәрежесі — оған келетін қабырғалар саны."),
    true,
    w("Так и определяется степень вершины: у человека с тремя друзьями степень 3.", "Төбенің дәрежесі осылай анықталады: үш досы бар адамның дәрежесі 3."),
    w("Вспомни пример с друзьями: что считается степенью?", "Достар мысалын еске түсір: дәреже ретінде не саналады?"),
  ),
  st(
    "diagonal-ones",
    1,
    w("На главной диагонали матрицы смежности простого графа стоят единицы.", "Қарапайым графтың көршілестік матрицасының басты диагоналінде бірліктер тұрады."),
    false,
    w("На диагонали стоят нули: вершина не соединена сама с собой.", "Диагональда нөлдер тұрады: төбе өзімен қосылмаған."),
    w("Клетка A–A спрашивает про ребро из A в A. Бывает ли оно в карте дорог?", "A–A ұяшығы A төбесінен A төбесіне қабырға туралы сұрайды. Ол жол картасында болады ма?"),
  ),
  st(
    "symmetric",
    2,
    w("Матрица смежности неориентированного графа симметрична.", "Бағытталмаған графтың көршілестік матрицасы симметриялы."),
    true,
    w("Ребро A–B записано и в клетке A–B, и в клетке B–A, поэтому матрица симметрична относительно главной диагонали.", "A–B қабырғасы A–B ұяшығында да, B–A ұяшығында да жазылған, сондықтан матрица басты диагональға қатысты симметриялы."),
    w("В скольких клетках записано одно ребро?", "Бір қабырға қанша ұяшықта жазылған?"),
  ),
  st(
    "sum-equals-edges",
    2,
    w("Сумма всех чисел матрицы смежности неориентированного графа равна числу его рёбер.", "Бағытталмаған графтың көршілестік матрицасындағы барлық сандардың қосындысы оның қабырғалар санына тең."),
    false,
    w("Каждое ребро записано дважды, поэтому сумма вдвое больше числа рёбер.", "Әр қабырға екі рет жазылған, сондықтан қосынды қабырғалар санынан екі есе көп."),
    w("Сколько единиц даёт одно ребро?", "Бір қабырға қанша бірлік береді?"),
  ),
  st(
    "row-sum-degree",
    2,
    w("Сумма строки матрицы смежности неориентированного графа — степень соответствующей вершины.", "Бағытталмаған графтың көршілестік матрицасы жолының қосындысы — сәйкес төбенің дәрежесі."),
    true,
    w("Единицы в строке — это рёбра вершины, их число и есть степень.", "Жолдағы бірліктер — төбенің қабырғалары, олардың саны дәреже болып табылады."),
    w("Что означает каждая единица в строке?", "Жолдағы әр бірлік нені білдіреді?"),
  ),
  st(
    "asymmetric-directed",
    2,
    w("Если матрица смежности несимметрична, то граф ориентированный.", "Егер көршілестік матрицасы симметриялы болмаса, граф бағытталған."),
    true,
    w("Несимметрична — значит, есть стрелка в одну сторону без обратной. В неориентированном графе так не бывает.", "Симметриялы емес — яғни кері көрсеткісі жоқ бір жақты көрсеткі бар. Бағытталмаған графта олай болмайды."),
    w("Может ли неориентированный граф иметь несимметричную матрицу?", "Бағытталмаған графтың матрицасы симметриялы емес болуы мүмкін бе?"),
  ),
  st(
    "direct-road",
    2,
    w("Прямая дорога между двумя пунктами всегда образует кратчайший путь.", "Екі пункт арасындағы тікелей жол әрдайым ең қысқа маршрут болады."),
    false,
    w("Объезд из нескольких коротких дорог может оказаться короче одной длинной прямой.", "Бірнеше қысқа жолдан тұратын айналма бір ұзын тікелей жолдан қысқа болуы мүмкін."),
    w("Сравни одну дорогу длиной 9 с объездом 2 + 3 + 2.", "Ұзындығы 9 бір жолды 2 + 3 + 2 айналмасымен салыстыр."),
  ),
  st(
    "column-sum-in",
    2,
    w("В ориентированном графе сумма столбца матрицы — число стрелок, входящих в вершину.", "Бағытталған графта матрица бағанының қосындысы — төбеге кіретін көрсеткілер саны."),
    true,
    w("Столбец — «куда»: единицы в нём показывают стрелки, которые приходят в вершину.", "Баған — «қайда»: ондағы бірліктер төбеге келетін көрсеткілерді көрсетеді."),
    w("Что означает столбец в матрице ориентированного графа: «откуда» или «куда»?", "Бағытталған граф матрицасындағы баған нені білдіреді: «қайдан» ба, әлде «қайда» ма?"),
  ),
  st(
    "directed-sum-arrows",
    3,
    w("В ориентированном графе сумма всех чисел матрицы смежности равна числу стрелок.", "Бағытталған графта көршілестік матрицасындағы барлық сандардың қосындысы көрсеткілер санына тең."),
    true,
    w("Каждая стрелка записана один раз: единица в строке «откуда» и столбце «куда». Делить на 2 не нужно.", "Әр көрсеткі бір рет жазылған: «қайдан» жолы мен «қайда» бағанында бірлік. 2-ге бөлудің қажеті жоқ."),
    w("Сколько клеток нужно, чтобы записать одну стрелку?", "Бір көрсеткіні жазу үшін қанша ұяшық керек?"),
  ),
  st(
    "odd-degree-sum",
    3,
    w("Сумма степеней всех вершин неориентированного графа может быть нечётной.", "Бағытталмаған графтың барлық төбелері дәрежелерінің қосындысы тақ болуы мүмкін."),
    false,
    w("Сумма степеней равна удвоенному числу рёбер, поэтому всегда чётная.", "Дәрежелердің қосындысы қабырғалар санының екі еселенгеніне тең, сондықтан әрдайым жұп."),
    w("Чему равна сумма степеней, если выразить её через число рёбер?", "Дәрежелердің қосындысын қабырғалар саны арқылы өрнектесе, неге тең?"),
  ),
  st(
    "greedy-shortest",
    3,
    w("Если в каждом пункте выбирать самую короткую из дорог в новые пункты, придём по кратчайшему пути.", "Әр пунктте жаңа пункттерге баратын жолдардың ең қысқасын таңдасақ, ең қысқа маршрутпен барамыз."),
    false,
    w("Такой «жадный» выбор может завести в длинный объезд. Надёжный способ — перебрать все маршруты.", "Мұндай «ашкөз» таңдау ұзақ айналмаға әкелуі мүмкін. Сенімді тәсіл — барлық маршрутты іріктеу."),
    w("Подумай: выбор самой короткой дороги сейчас всегда ли даёт самую короткую сумму в конце?", "Ойлан: қазір ең қысқа жолды таңдау соңында әрдайым ең кіші қосынды бере ме?"),
  ),
  st(
    "degree-sum-13",
    3,
    w("Неориентированный граф с пятью вершинами и степенями 4, 3, 3, 2, 1 существует.", "Дәрежелері 4, 3, 3, 2, 1 болатын бес төбелі бағытталмаған граф бар."),
    false,
    w("Сумма степеней 4 + 3 + 3 + 2 + 1 = 13 нечётна, а она должна быть чётной (равна 2 · число рёбер).", "Дәрежелердің қосындысы 4 + 3 + 3 + 2 + 1 = 13 тақ, ал ол жұп болуы керек (2 · қабырғалар санына тең)."),
    w("Сложи степени и проверь чётность суммы.", "Дәрежелерді қосып, қосындының жұптығын тексер."),
  ),
];

// ---------- Пары ----------

const pr = (name: string, level: Level, left: Text, right: Text): Pair => ({ id: `p:${SKILL}:pair-${name}`, skill: SKILL, level, left, right });

const PAIRS: Pair[] = [
  pr("vertex", 1, w("Вершина", "Төбе"), w("Пункт графа: город, человек, компьютер", "Граф пункті: қала, адам, компьютер")),
  pr("edge", 1, w("Ребро", "Қабырға"), w("Связь между двумя вершинами", "Екі төбе арасындағы байланыс")),
  pr("weight", 1, w("Вес ребра", "Қабырғаның салмағы"), w("Число на ребре: длина, время, цена", "Қабырғадағы сан: ұзындық, уақыт, баға")),
  pr("degree", 1, w("Степень вершины", "Төбенің дәрежесі"), w("Число рёбер, подходящих к вершине", "Төбеге келетін қабырғалар саны")),
  pr("matrix", 1, w("Матрица смежности", "Көршілестік матрицасы"), w("Таблица из 0 и 1: есть ли ребро между вершинами", "Төбелер арасында қабырға бар-жоғын көрсететін 0 және 1 кестесі")),
  pr("arrow", 2, w("Стрелка A → B", "A → B көрсеткісі"), w("Идти можно только из A в B", "Тек A төбесінен B төбесіне жүруге болады")),
  pr("symmetric", 2, w("Симметричная матрица", "Симметриялы матрица"), w("Неориентированный граф", "Бағытталмаған граф")),
  pr("row-sum", 2, w("Сумма строки", "Жолдың қосындысы"), w("Степень вершины (у ориентированного — выходящие стрелки)", "Төбенің дәрежесі (бағытталған графта — шығатын көрсеткілер)")),
  pr("col-sum", 2, w("Сумма столбца у ориентированного графа", "Бағытталған графтағы бағанның қосындысы"), w("Число входящих стрелок", "Кіретін көрсеткілер саны")),
  pr("total-undirected", 3, w("Сумма всех чисел (неориентированный граф)", "Барлық сандардың қосындысы (бағытталмаған граф)"), w("Удвоенное число рёбер", "Қабырғалар санының екі еселенгені")),
  pr("zero-column", 3, w("Столбец из одних нулей", "Тек нөлдерден тұратын баған"), w("В вершину не входит ни одна стрелка", "Төбеге бірде-бір көрсеткі кірмейді")),
  pr("brute-force", 3, w("Перебор маршрутов", "Маршруттарды іріктеу"), w("Выписать все пути без повторов и выбрать наименьшую длину", "Пункттері қайталанбайтын барлық маршрутты жазып, ең кіші ұзындықты таңдау")),
];

// ---------- Короткие вопросы ----------

const sh = (name: string, level: Level, prompt: L, answer: string, explanation: L, hint: L): ShortQuestion => ({
  id: `q:${SKILL}:short-${name}`,
  skill: SKILL,
  level,
  prompt,
  answer,
  mode: "number",
  explanation,
  hint,
});

const SHORTS: ShortQuestion[] = [
  sh(
    "deg-a3",
    1,
    w("Рёбра графа: AB, AC, AD. Чему равна степень вершины A?", "Графтың қабырғалары: AB, AC, AD. A төбесінің дәрежесі неге тең?"),
    "3",
    w("Вершина A входит во все три ребра, значит, её степень равна 3.", "A төбесі үш қабырғаның үшеуіне де кіреді, демек оның дәрежесі 3."),
    w("Выпиши рёбра, в которых участвует вершина A.", "A төбесі қатысатын қабырғаларды жазып шық."),
  ),
  sh(
    "rows-4",
    1,
    w("В графе 4 вершины. Сколько строк в его матрице смежности?", "Графта 4 төбе бар. Оның көршілестік матрицасында қанша жол бар?"),
    "4",
    w("Матрица квадратная: по одной строке на каждую вершину.", "Матрица шаршы: әр төбеге бір жол."),
    w("Сколько вершин, столько и строк.", "Қанша төбе болса, сонша жол."),
  ),
  sh(
    "ones-in-row",
    1,
    w("У вершины 3 соседа. Сколько единиц в её строке матрицы смежности?", "Төбенің 3 көршісі бар. Оның көршілестік матрицасы жолында қанша бірлік бар?"),
    "3",
    w("Одна единица на каждого соседа, значит, три.", "Әр көршіге бір бірлік, демек үшеу."),
    w("Что означает каждая единица в строке?", "Жолдағы әр бірлік нені білдіреді?"),
  ),
  sh(
    "sum18",
    2,
    w("Сумма всех чисел матрицы неориентированного графа равна 18. Сколько в нём рёбер?", "Бағытталмаған графтың матрицасындағы барлық сандардың қосындысы 18. Онда қанша қабырға бар?"),
    "9",
    w("Каждое ребро записано дважды: 18 / 2 = 9.", "Әр қабырға екі рет жазылған: 18 / 2 = 9."),
    w("Сколько раз записано каждое ребро?", "Әр қабырға қанша рет жазылған?"),
  ),
  sh(
    "degsum20",
    2,
    w("Сумма степеней всех вершин неориентированного графа равна 20. Сколько в нём рёбер?", "Бағытталмаған графтың барлық төбелері дәрежелерінің қосындысы 20. Онда қанша қабырға бар?"),
    "10",
    w("Каждое ребро учитывается у двух концов: рёбер 20 / 2 = 10.", "Әр қабырға екі ұшында есептеледі: қабырғалар 20 / 2 = 10."),
    w("У скольких вершин учитывается каждое ребро?", "Әр қабырға қанша төбеде есептеледі?"),
  ),
  sh(
    "route-ac",
    2,
    w("Дороги: A–B длиной 4, B–C длиной 5, A–C длиной 11. Какова длина кратчайшего пути из A в C?", "Жолдар: A–B ұзындығы 4, B–C ұзындығы 5, A–C ұзындығы 11. A пунктінен C пунктіне дейінгі ең қысқа маршруттың ұзындығы қанша?"),
    "9",
    w("Объезд через B: 4 + 5 = 9. Прямая дорога 11 длиннее.", "B арқылы айналма: 4 + 5 = 9. Тікелей жол 11 ұзынырақ."),
    w("Сравни прямую дорогу с объездом через B.", "Тікелей жолды B арқылы айналмамен салыстыр."),
  ),
  sh(
    "paths-abc",
    2,
    w("Стрелки: A→B, B→C и A→C. Сколько путей ведёт из A в C?", "Көрсеткілер: A→B, B→C және A→C. A төбесінен C төбесіне неше маршрут бар?"),
    "2",
    w("Прямой путь A→C и путь через B: A→B→C. Всего 2.", "A→C тікелей маршруты және B арқылы өтетін A→B→C маршруты. Барлығы 2."),
    w("Есть ли путь без промежуточных вершин и путь через B?", "Аралық төбесіз маршрут және B арқылы өтетін маршрут бар ма?"),
  ),
  sh(
    "regular-8-3",
    3,
    w("В неориентированном графе 8 вершин, степень каждой равна 3. Сколько в нём рёбер?", "Бағытталмаған графта 8 төбе бар, әрқайсысының дәрежесі 3. Онда қанша қабырға бар?"),
    "12",
    w("Сумма степеней 8 · 3 = 24, рёбер 24 / 2 = 12.", "Дәрежелердің қосындысы 8 · 3 = 24, қабырғалар 24 / 2 = 12."),
    w("Найди сумму степеней всех вершин, потом вспомни связь с числом рёбер.", "Барлық төбелер дәрежелерінің қосындысын тап, содан кейін қабырғалар санымен байланысын еске түсір."),
  ),
  sh(
    "complete-5",
    3,
    w("В неориентированном графе из 5 вершин каждая пара вершин соединена ребром. Сколько в нём рёбер?", "5 төбелі бағытталмаған графта әр төбелер жұбы қабырғамен қосылған. Онда қанша қабырға бар?"),
    "10",
    w("Каждая вершина соединена с четырьмя другими: сумма степеней 5 · 4 = 20, рёбер 20 / 2 = 10.", "Әр төбе қалған төртеуімен қосылған: дәрежелер қосындысы 5 · 4 = 20, қабырғалар 20 / 2 = 10."),
    w("Чему равна степень каждой вершины, если она соединена со всеми остальными?", "Әр төбе қалғандарының бәрімен қосылса, оның дәрежесі неге тең?"),
  ),
  sh(
    "directed-4x2",
    3,
    w("В ориентированном графе из каждой из 4 вершин выходит по 2 стрелки. Сколько всего стрелок?", "Бағытталған графта 4 төбенің әрқайсысынан 2 көрсеткіден шығады. Барлығы қанша көрсеткі бар?"),
    "8",
    w("Каждая стрелка выходит ровно из одной вершины: 4 · 2 = 8. Делить на 2 не нужно.", "Әр көрсеткі дәл бір төбеден шығады: 4 · 2 = 8. 2-ге бөлудің қажеті жоқ."),
    w("Сколько раз каждая стрелка учтена среди выходящих?", "Әр көрсеткі шығатындар арасында қанша рет есептелген?"),
  ),
];

export const BANKS: SkillBank[] = [
  poolBank({
    skill: SKILL,
    questions: QUESTIONS,
    statements: STATEMENTS,
    pairs: PAIRS,
    shorts: SHORTS,
  }),
];
