import type { ChoiceStep, InputStep, L, Level, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка py.if («Ветвления»): генератор программ с условным оператором.
// Правильный ответ всегда считает код (функции ниже повторяют логику программы), неверные варианты — типичные ошибки:
// пропущенная ветка, неверный порядок elif, отступ, = вместо ==. Тексты после переменных — без падежных окончаний
// (в казахском окончание зависит от числа), поэтому формулы и двоеточия.

const SKILL = "py.if";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });
const tf = (b: boolean) => (b ? "True" : "False");
const codeScene = (lines: string[]): Scene => ({ kind: "code", lang: "python", lines });

const PRINT_Q: L = { ru: "Что выведет программа?", kk: "Программа не шығарады?" };

// ---------- сборка заданий ----------

interface Base {
  id: string;
  level: Level;
  prompt: L;
  scene?: Scene;
  hint: L;
  explanation: L;
}

interface Wrong {
  text: Text;
  why: L;
}

/** choice: правильный вариант + неверные (с разбором ошибки), варианты перемешаны, whyWrong выровнен. */
function choice(rand: Rand, base: Base, right: Text, wrong: Wrong[]): ChoiceStep {
  const seen = new Set<string>([JSON.stringify(right)]);
  const uniq: Wrong[] = [];
  for (const w of wrong) {
    const key = JSON.stringify(w.text);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(w);
    if (uniq.length === 3) break;
  }
  const all: { text: Text; why: L | null }[] = shuffle([{ text: right, why: null }, ...uniq], rand);
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

/** Подпись набора выводов: «A», «B и C», «A, B и C». */
function lettersLabel(list: string[]): L {
  if (list.length === 0) return { ru: "Ничего не выведет", kk: "Ештеңе шығармайды" };
  if (list.length === 1) return same(list[0]);
  const head = list.slice(0, -1).join(", ");
  const last = list[list.length - 1];
  return { ru: `${head} и ${last}`, kk: `${head} және ${last}` };
}

// ======================================================================
// Уровень A: применить правило по образцу
// ======================================================================

// --- чётное / нечётное: две ветки с числовым результатом ---

const EVEN_EXPRS: { src: string; f: (x: number) => number }[] = [
  { src: "x // 2", f: (x) => Math.floor(x / 2) },
  { src: "x + 10", f: (x) => x + 10 },
  { src: "x * 2", f: (x) => x * 2 },
];
const ODD_EXPRS: { src: string; f: (x: number) => number }[] = [
  { src: "x * 3 + 1", f: (x) => x * 3 + 1 },
  { src: "x - 1", f: (x) => x - 1 },
  { src: "x + 5", f: (x) => x + 5 },
];

function genParity(rand: Rand, level: Level, seed: number): InputStep {
  const x = int(rand, 3, 40);
  const ei = int(rand, 0, EVEN_EXPRS.length - 1);
  const oi = int(rand, 0, ODD_EXPRS.length - 1);
  const e = EVEN_EXPRS[ei];
  const o = ODD_EXPRS[oi];
  const even = x % 2 === 0;
  const out = even ? e.f(x) : o.f(x);
  const lines = [`x = ${x}`, "if x % 2 == 0:", `    print(${e.src})`, "else:", `    print(${o.src})`];
  const expr = even ? e.src : o.src;
  return numberInput(
    {
      id: `g:${SKILL}:parity:${x}-${ei}${oi}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(lines),
      hint: {
        ru: "Найди остаток от деления x на 2 и реши, какая ветка сработает.",
        kk: "x санын 2-ге бөлгендегі қалдықты тап та, қай тармақ орындалатынын шеш.",
      },
      explanation: {
        ru: `x = ${x}. Остаток ${x} % 2 равен ${x % 2}, поэтому условие x % 2 == 0 ${even ? "верно — выполняется ветка if" : "неверно — выполняется ветка else"}: ${expr} = ${out}.`,
        kk: `x = ${x}. ${x} % 2 = ${x % 2} (қалдық), сондықтан x % 2 == 0 шарты ${even ? "ақиқат — if тармағы орындалады" : "жалған — else тармағы орындалады"}: ${expr} = ${out}.`,
      },
    },
    out,
  );
}

// --- порог: if x > T ---

function genThreshold(rand: Rand, level: Level, seed: number): InputStep {
  const t = int(rand, 6, 20);
  const a = int(rand, 1, 5);
  const b = int(rand, 1, 9);
  const x = int(rand, t - 5, t + 8);
  const big = x > t;
  const out = big ? x - a : x + b;
  const lines = [`x = ${x}`, `if x > ${t}:`, `    print(x - ${a})`, "else:", `    print(x + ${b})`];
  return numberInput(
    {
      id: `g:${SKILL}:threshold:${x}-${t}-${a}-${b}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(lines),
      hint: {
        ru: "Сравни x с порогом: условие верно или нет? От этого зависит ветка.",
        kk: "x мәнін шекпен салыстыр: шарт ақиқат па, жоқ па? Тармақ соған байланысты.",
      },
      explanation: {
        ru: `${x} > ${t} — ${tf(big)}, поэтому выполняется ветка ${big ? `if: ${x} − ${a} = ${out}` : `else: ${x} + ${b} = ${out}`}.`,
        kk: `${x} > ${t} — ${tf(big)}, сондықтан ${big ? `if тармағы орындалады: ${x} − ${a} = ${out}` : `else тармағы орындалады: ${x} + ${b} = ${out}`}.`,
      },
    },
    out,
  );
}

// --- какое условие верно при x ---

interface Cond {
  text: string;
  value: boolean;
  /** Почему условие даёт именно такое значение при данном x. */
  why: L;
}

function randCond(rand: Rand, x: number): Cond {
  const kind = int(rand, 0, 2);
  if (kind === 0) {
    const op = pick(rand, [">", "<", ">=", "<=", "==", "!="] as const);
    const k = Math.max(0, x + int(rand, -4, 4));
    const value = op === ">" ? x > k : op === "<" ? x < k : op === ">=" ? x >= k : op === "<=" ? x <= k : op === "==" ? x === k : x !== k;
    const why = same(`${x} ${op} ${k} — ${tf(value)}`);
    return { text: `x ${op} ${k}`, value, why };
  }
  if (kind === 1) {
    const m = pick(rand, [2, 3, 4, 5] as const);
    const r = int(rand, 0, m - 1);
    const value = x % m === r;
    return {
      text: `x % ${m} == ${r}`,
      value,
      why: {
        ru: `${x} % ${m} = ${x % m}, а в условии ${r}: ${tf(value)}`,
        kk: `${x} % ${m} = ${x % m}, ал шартта ${r} тұр: ${tf(value)}`,
      },
    };
  }
  const lo = Math.max(0, x + int(rand, -5, 5));
  const hi = lo + int(rand, 2, 8);
  const value = lo <= x && x <= hi;
  return {
    text: `${lo} <= x <= ${hi}`,
    value,
    why: {
      ru: `${x} ${value ? "лежит" : "не лежит"} между ${lo} и ${hi}: ${tf(value)}`,
      kk: `${x} саны ${lo} мен ${hi} аралығында ${value ? "жатыр" : "жатпайды"}: ${tf(value)}`,
    },
  };
}

function genWhichTrue(rand: Rand, level: Level, seed: number): ChoiceStep {
  const x = int(rand, 3, 25);
  const trues: Cond[] = [];
  const falses: Cond[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 300 && (trues.length < 1 || falses.length < 3); i++) {
    const c = randCond(rand, x);
    if (seen.has(c.text)) continue;
    seen.add(c.text);
    if (c.value) {
      if (trues.length < 1) trues.push(c);
    } else if (falses.length < 3) falses.push(c);
  }
  if (!trues.length) trues.push({ text: `x == ${x}`, value: true, why: same(`${x} == ${x} — True`) });
  while (falses.length < 3) {
    const k = x + 10 + falses.length;
    falses.push({ text: `x > ${k}`, value: false, why: same(`${x} > ${k} — False`) });
  }
  const right = trues[0];
  return choice(
    rand,
    {
      id: `g:${SKILL}:whichtrue:${x}-${right.text.replace(/\s/g, "")}:${seed}`,
      level,
      prompt: {
        ru: `Какое условие верно при x = ${x}?`,
        kk: `x = ${x} болғанда қай шарт ақиқат?`,
      },
      hint: {
        ru: "Подставь значение x в каждое условие по очереди и найди то, что даёт True.",
        kk: "x мәнін әр шартқа кезекпен қойып, True беретінін тап.",
      },
      explanation: {
        ru: `Подставляем x = ${x}: ${right.text} — True. В остальных условиях получается False.`,
        kk: `x = ${x} қоямыз: ${right.text} — True. Қалған шарттарда False шығады.`,
      },
    },
    right.text,
    falses.map((f) => ({ text: f.text, why: f.why })),
  );
}

// --- какая строка if записана правильно ---

function genEqLine(rand: Rand, level: Level, seed: number): ChoiceStep {
  const k = int(rand, 1, 50);
  const variant = int(rand, 0, 2);
  const noColon: L = { ru: "В конце строки с if нет двоеточия — это ошибка.", kk: "if бар жолдың соңында қос нүкте жоқ — бұл қате." };
  const hint: L = {
    ru: "Вспомни: для сравнения нужен особый знак, а строка с if заканчивается двоеточием.",
    kk: "Есіңе түсір: салыстыру үшін ерекше белгі керек, ал if бар жол қос нүктемен аяқталады.",
  };
  if (variant === 0) {
    return choice(
      rand,
      {
        id: `g:${SKILL}:eqline:eq-${k}:${seed}`,
        level,
        prompt: { ru: `Какая строка правильно проверяет, что x равно ${k}?`, kk: `Қай жол x пен ${k} тең екенін дұрыс тексереді?` },
        hint,
        explanation: {
          ru: `Для сравнения нужен двойной знак ==, а в конце строки с if ставится двоеточие: if x == ${k}:.`,
          kk: `Салыстыру үшін қосарланған == белгісі керек, ал if бар жолдың соңына қос нүкте қойылады: if x == ${k}:.`,
        },
      },
      `if x == ${k}:`,
      [
        { text: `if x = ${k}:`, why: { ru: "Один знак = — это присваивание, а не сравнение.", kk: "Бір = белгісі — меншіктеу, салыстыру емес." } },
        { text: `if x == ${k}`, why: noColon },
        { text: `if x === ${k}:`, why: { ru: "Знака === в Python нет — он из другого языка.", kk: "Python-да === белгісі жоқ — ол басқа тілден келген." } },
      ],
    );
  }
  if (variant === 1) {
    return choice(
      rand,
      {
        id: `g:${SKILL}:eqline:ne-${k}:${seed}`,
        level,
        prompt: { ru: `Какая строка правильно проверяет, что x не равно ${k}?`, kk: `Қай жол x пен ${k} тең емес екенін дұрыс тексереді?` },
        hint,
        explanation: {
          ru: `«Не равно» в Python записывается !=, а в конце строки ставится двоеточие: if x != ${k}:.`,
          kk: `Python-да «тең емес» != түрінде жазылады, ал жолдың соңына қос нүкте қойылады: if x != ${k}:.`,
        },
      },
      `if x != ${k}:`,
      [
        { text: `if x =! ${k}:`, why: { ru: "Записи =! в Python нет: знак пишется как !=.", kk: "Python-да =! жазбасы жоқ: белгі != түрінде жазылады." } },
        { text: `if x <> ${k}:`, why: { ru: "Знак <> был в Python 2, в Python 3 это ошибка.", kk: "<> белгісі Python 2-де болған, Python 3-те бұл — қате." } },
        { text: `if x != ${k}`, why: noColon },
      ],
    );
  }
  return choice(
    rand,
    {
      id: `g:${SKILL}:eqline:ge-${k}:${seed}`,
      level,
      prompt: { ru: `Какая строка правильно проверяет, что x больше или равно ${k}?`, kk: `Қай жол x мәні ${k} санынан үлкен немесе оған тең екенін дұрыс тексереді?` },
      hint,
      explanation: {
        ru: `«Больше или равно» записывается >= (сначала больше, потом равно) и в конце ставится двоеточие: if x >= ${k}:.`,
        kk: `«Үлкен немесе тең» >= түрінде жазылады (алдымен үлкен, содан кейін тең) және соңында қос нүкте қойылады: if x >= ${k}:.`,
      },
    },
    `if x >= ${k}:`,
    [
      { text: `if x => ${k}:`, why: { ru: "Знаки перепутаны: в Python пишут >=, а не =>.", kk: "Белгілердің реті шатастырылған: Python-да >= жазылады, => емес." } },
      { text: `if x > = ${k}:`, why: { ru: "Знак >= нельзя разрывать пробелом.", kk: ">= белгісін бос орынмен ажыратуға болмайды." } },
      { text: `if x >= ${k}`, why: noColon },
    ],
  );
}

// --- знак числа: if / elif / else ---

function genSign(rand: Rand, level: Level, seed: number): ChoiceStep {
  const x = int(rand, -9, 9);
  const out = x > 0 ? "plus" : x < 0 ? "minus" : "zero";
  const lines = [`x = ${x}`, "if x > 0:", '    print("plus")', "elif x < 0:", '    print("minus")', "else:", '    print("zero")'];
  const why = (word: string): L => {
    if (word === "plus") return { ru: `${x} > 0 — ${tf(x > 0)}, ветка plus ${x > 0 ? "сработала бы" : "не срабатывает"}.`, kk: `${x} > 0 — ${tf(x > 0)}, plus тармағы ${x > 0 ? "орындалар еді" : "орындалмайды"}.` };
    if (word === "minus") return { ru: `${x} < 0 — ${tf(x < 0)}, ветка minus ${x < 0 ? "сработала бы" : "не срабатывает"}.`, kk: `${x} < 0 — ${tf(x < 0)}, minus тармағы ${x < 0 ? "орындалар еді" : "орындалмайды"}.` };
    if (word === "zero") return { ru: `Ветка else нужна только при x = 0, а здесь x = ${x}.`, kk: `else тармағы тек x = 0 болғанда керек, ал мұнда x = ${x}.` };
    return { ru: "Какая-то ветка всегда сработает: else ловит все остальные случаи.", kk: "Қандай да бір тармақ әрдайым орындалады: else қалған барлық жағдайды ұстайды." };
  };
  const words = ["plus", "minus", "zero"];
  const wrong: Wrong[] = words.filter((w) => w !== out).map((w) => ({ text: w, why: why(w) }));
  wrong.push({ text: { ru: "Ничего", kk: "Ештеңе де шығармайды" }, why: why("none") });
  return choice(
    rand,
    {
      id: `g:${SKILL}:sign:${x}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(lines),
      hint: {
        ru: "Проверяй условия по порядку сверху вниз: сработает только первое верное.",
        kk: "Шарттарды жоғарыдан төмен қарай ретімен тексер: тек бірінші ақиқаты орындалады.",
      },
      explanation: {
        ru: `x = ${x}: условие x > 0 — ${tf(x > 0)}, x < 0 — ${tf(x < 0)}. Выводится ${out}.`,
        kk: `x = ${x}: x > 0 шарты — ${tf(x > 0)}, x < 0 шарты — ${tf(x < 0)}. ${out} шығады.`,
      },
    },
    out,
    wrong,
  );
}

// ======================================================================
// Уровень B: распознать модель, проанализировать
// ======================================================================

// --- цепочка elif: оценка по баллам ---

function genElifChain(rand: Rand, level: Level, seed: number): InputStep {
  const t1 = pick(rand, [70, 80, 90] as const);
  const t2 = t1 - pick(rand, [10, 20] as const);
  const t3 = t2 - pick(rand, [10, 20] as const);
  const vals = pick(rand, [[5, 4, 3, 2], [4, 3, 2, 1], [10, 7, 4, 1]] as const);
  const near = pick(rand, [t1, t2, t3] as const);
  const n = rand() < 0.5 ? near + pick(rand, [-1, 0, 1] as const) : int(rand, t3 - 20, 99);
  const checks: string[] = [];
  let out: number;
  let hit: string;
  if (n >= t1) {
    out = vals[0];
    hit = `n >= ${t1}`;
  } else {
    checks.push(`${n} >= ${t1} — False`);
    if (n >= t2) {
      out = vals[1];
      hit = `n >= ${t2}`;
    } else {
      checks.push(`${n} >= ${t2} — False`);
      if (n >= t3) {
        out = vals[2];
        hit = `n >= ${t3}`;
      } else {
        checks.push(`${n} >= ${t3} — False`);
        out = vals[3];
        hit = "else";
      }
    }
  }
  const lines = [
    `n = ${n}`,
    `if n >= ${t1}:`,
    `    print(${vals[0]})`,
    `elif n >= ${t2}:`,
    `    print(${vals[1]})`,
    `elif n >= ${t3}:`,
    `    print(${vals[2]})`,
    "else:",
    `    print(${vals[3]})`,
  ];
  const trail = checks.length ? `${checks.join("; ")}. ` : "";
  return numberInput(
    {
      id: `g:${SKILL}:elifchain:${n}-${t1}-${t2}-${t3}-${vals[0]}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(lines),
      hint: {
        ru: "Иди по условиям сверху вниз и остановись на первом верном — остальные не проверяются.",
        kk: "Шарттармен жоғарыдан төмен жүріп, бірінші ақиқатында тоқта — қалғандары тексерілмейді.",
      },
      explanation: {
        ru: `${trail}${hit === "else" ? "Все условия неверны — срабатывает else" : `Первое верное условие — «${hit}»`}, выводится ${out}.`,
        kk: `${trail}${hit === "else" ? "Барлық шарт жалған — else орындалады" : `Бірінші ақиқат шарт — «${hit}»`}, ${out} шығады.`,
      },
    },
    out,
  );
}

// --- отступ: какие print внутри if ---

function genIndent(rand: Rand, level: Level, seed: number): ChoiceStep {
  const t = int(rand, 3, 15);
  const cond = rand() < 0.35;
  const x = cond ? t + int(rand, 1, 4) : Math.max(1, t - int(rand, 0, 5));
  const bInside = rand() < 0.5;
  const lines = bInside
    ? [`x = ${x}`, `if x > ${t}:`, '    print("A")', '    print("B")', 'print("C")']
    : [`x = ${x}`, `if x > ${t}:`, '    print("A")', 'print("B")', 'print("C")'];
  const ok = x > t;
  const result: string[] = [];
  if (ok) result.push("A");
  if (ok || !bInside) result.push("B");
  result.push("C");
  const pool: string[][] = [["C"], ["B", "C"], ["A", "B", "C"], ["A", "C"], ["A", "B"]];
  const key = (l: string[]) => l.join("");
  const wrongSets = shuffle(pool.filter((p) => key(p) !== key(result)), rand);
  const reason = (w: string[]): L => {
    const extra = w.find((c) => !result.includes(c));
    if (extra === "A") return { ru: `Условие ${x} > ${t} неверно, строка print("A") внутри if пропускается.`, kk: `${x} > ${t} шарты жалған, if ішіндегі print("A") жолы өткізіліп кетеді.` };
    if (extra === "B") return { ru: `print("B") стоит внутри if (с отступом), а условие ${x} > ${t} неверно — B не выводится.`, kk: `print("B") if ішінде тұр (шегінісімен), ал ${x} > ${t} шарты жалған — B шықпайды.` };
    const missing = result.find((c) => !w.includes(c));
    if (missing === "A") return { ru: `Условие ${x} > ${t} верно, поэтому A выводится.`, kk: `${x} > ${t} шарты ақиқат, сондықтан A шығады.` };
    if (missing === "B") return bInside ? { ru: `Условие верно, значит print("B") внутри if выполняется.`, kk: `Шарт ақиқат, демек if ішіндегі print("B") орындалады.` } : { ru: `print("B") стоит без отступа — вне if, он выводится всегда.`, kk: `print("B") шегінісіз — if-тен тыс, ол әрдайым шығады.` };
    return { ru: `print("C") стоит без отступа — он выводится всегда.`, kk: `print("C") шегінісіз — ол әрдайым шығады.` };
  };
  return choice(
    rand,
    {
      id: `g:${SKILL}:indent:${x}-${t}-${bInside ? "in" : "out"}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(lines),
      hint: {
        ru: "Определи, верно ли условие, и посмотри на отступы: какие print стоят внутри if?",
        kk: "Шарттың ақиқат екенін анықта да, шегіністерге қара: қай print if ішінде тұр?",
      },
      explanation: {
        ru: `Условие ${x} > ${t} — ${tf(ok)}. Внутри if только строки с отступом; print без отступа выполняются всегда. Выводится: ${lettersLabel(result).ru}.`,
        kk: `${x} > ${t} шарты — ${tf(ok)}. if ішінде тек шегінісі бар жолдар тұр; шегінісіз print әрдайым орындалады. Шығады: ${lettersLabel(result).kk}.`,
      },
    },
    lettersLabel(result),
    wrongSets.map((w) => ({ text: lettersLabel(w), why: reason(w) })),
  );
}

// --- диапазон: YES / NO ---

function genRangeIn(rand: Rand, level: Level, seed: number): InputStep {
  const a = int(rand, 5, 30);
  const b = a + int(rand, 5, 25);
  const x = rand() < 0.5 ? pick(rand, [a, b, a - 1, b + 1] as const) : int(rand, a - 8, b + 8);
  const inside = a <= x && x <= b;
  const variant = int(rand, 0, 2);
  let lines: string[];
  let cond: string;
  if (variant === 0) {
    cond = `${a} <= x <= ${b}`;
    lines = [`x = ${x}`, `if ${cond}:`, '    print("YES")', "else:", '    print("NO")'];
  } else if (variant === 1) {
    cond = `x >= ${a} and x <= ${b}`;
    lines = [`x = ${x}`, `if ${cond}:`, '    print("YES")', "else:", '    print("NO")'];
  } else {
    cond = `x < ${a} or x > ${b}`;
    lines = [`x = ${x}`, `if ${cond}:`, '    print("NO")', "else:", '    print("YES")'];
  }
  const out = inside ? "YES" : "NO";
  const condValue = variant === 2 ? !inside : inside;
  return {
    type: "input",
    skill: SKILL,
    id: `g:${SKILL}:rangein:${x}-${a}-${b}-${variant}:${seed}`,
    level,
    prompt: PRINT_Q,
    scene: codeScene(lines),
    answers: [out],
    mode: "text",
    hint: {
      ru: "Проверь обе границы диапазона: x должен быть не меньше нижней и не больше верхней. Границы входят в диапазон.",
      kk: "Диапазонның екі шегін де тексер: x төменгі шектен кіші де, жоғарғы шектен үлкен де болмауы керек. Шеттері диапазонға кіреді.",
    },
    explanation: {
      ru: `x = ${x}, условие «${cond}» — ${tf(condValue)}. ${inside ? `Число ${x} лежит в диапазоне от ${a} до ${b}` : `Число ${x} вне диапазона от ${a} до ${b}`}, поэтому выводится ${out}.`,
      kk: `x = ${x}, «${cond}» шарты — ${tf(condValue)}. ${x} саны ${a} мен ${b} диапазонында ${inside ? "жатыр" : "жатпайды"}, сондықтан ${out} шығады.`,
    },
  };
}

// --- сколько чисел проходит условие ---

function genCountRange(rand: Rand, level: Level, seed: number): InputStep {
  const m = pick(rand, [3, 4, 5, 6] as const);
  const r = int(rand, 0, m - 1);
  const t = int(rand, 2, 12);
  const top = pick(rand, [20, 25, 30, 40] as const);
  let count = 0;
  const hits: number[] = [];
  for (let x = 1; x <= top; x++) {
    if (x % m === r && x > t) {
      count++;
      hits.push(x);
    }
  }
  const lines = ["x = int(input())", `if x % ${m} == ${r} and x > ${t}:`, '    print("YES")', "else:", '    print("NO")'];
  const list = hits.length ? hits.join(", ") : "—";
  return numberInput(
    {
      id: `g:${SKILL}:countrange:${m}-${r}-${t}-${top}:${seed}`,
      level,
      prompt: {
        ru: `Для скольких целых x от 1 до ${top} (включая границы) программа выведет YES?`,
        kk: `1 ≤ x ≤ ${top} аралығындағы неше бүтін x үшін программа YES шығарады?`,
      },
      scene: codeScene(lines),
      hint: {
        ru: "Сначала выпиши числа с нужным остатком, потом оставь из них те, что удовлетворяют второй части условия.",
        kk: "Алдымен қалдығы сәйкес сандарды жаз, содан кейін олардың ішінен шарттың екінші бөлігіне сәйкестерін қалдыр.",
      },
      explanation: {
        ru: `Условие верно, если x % ${m} == ${r} и одновременно x > ${t}. Подходят: ${list} — всего ${count}.`,
        kk: `Шарт x % ${m} == ${r} және бір мезгілде x > ${t} болғанда ақиқат. Сәйкес келеді: ${list} — барлығы ${count}.`,
      },
    },
    count,
  );
}

// ======================================================================
// Уровень C: несколько шагов, обратная задача
// ======================================================================

// --- при каком x программа выведет V ---

function genFindX(rand: Rand, level: Level, seed: number): ChoiceStep {
  const a = int(rand, 15, 40);
  const b = a - int(rand, 5, 10);
  const m = pick(rand, [2, 3, 5] as const);
  const run = (x: number) => (x > a ? 1 : x > b && x % m === 0 ? 2 : 3);
  const lines = ["x = int(input())", `if x > ${a}:`, "    print(1)", `elif x > ${b} and x % ${m} == 0:`, "    print(2)", "else:", "    print(3)"];
  const target = pick(rand, [1, 2, 3] as const);
  const pool: number[] = [];
  for (let x = Math.max(1, b - 6); x <= a + 8; x++) pool.push(x);
  const good = shuffle(pool.filter((x) => run(x) === target), rand);
  const bad = shuffle(pool.filter((x) => run(x) !== target), rand);
  // неверные варианты разного происхождения: по одному из каждой «чужой» ветки, если возможно
  const wrongPick: number[] = [];
  for (const out of [1, 2, 3]) {
    if (out === target) continue;
    const c = bad.find((x) => run(x) === out && !wrongPick.includes(x));
    if (c !== undefined) wrongPick.push(c);
  }
  for (const x of bad) if (wrongPick.length < 3 && !wrongPick.includes(x)) wrongPick.push(x);
  const right = good[0];
  const why = (x: number): L => {
    const o = run(x);
    const reason =
      o === 1
        ? { ru: `${x} > ${a} — первое условие верно, до elif дело не доходит`, kk: `${x} > ${a} — бірінші шарт ақиқат, elif-ке жол жетпейді` }
        : o === 2
          ? { ru: `${x} > ${b} и ${x} % ${m} == 0 — срабатывает elif`, kk: `${x} > ${b} және ${x} % ${m} == 0 — elif орындалады` }
          : { ru: `оба условия неверны, срабатывает else`, kk: `екі шарт та жалған, else орындалады` };
    return { ru: `При x = ${x}: ${reason.ru}, выводится ${o}.`, kk: `x = ${x} болғанда: ${reason.kk}, ${o} шығады.` };
  };
  const rightWhy: Record<number, L> = {
    1: { ru: `Единица выводится в первой ветке, значит нужно x > ${a}.`, kk: `Бірлік бірінші тармақта шығады, демек x > ${a} болуы керек.` },
    2: { ru: `Вывод 2 стоит в elif: нужно, чтобы x > ${a} было неверно, а x > ${b} и x кратно ${m} — верно.`, kk: `2 шығару elif тармағында тұр: x > ${a} жалған, ал x > ${b} және x ${m} санына еселі ақиқат болуы керек.` },
    3: { ru: `Тройка выводится в else: нужно, чтобы оба условия выше были неверны.`, kk: `Үштік else тармағында шығады: жоғарыдағы екі шарт та жалған болуы керек.` },
  };
  return choice(
    rand,
    {
      id: `g:${SKILL}:findx:${a}-${b}-${m}-${target}:${seed}`,
      level,
      prompt: { ru: `При каком значении x программа выведет ${target}?`, kk: `x-тің қай мәнінде программа ${target} шығарады?` },
      scene: codeScene(lines),
      hint: {
        ru: "Подставь каждый вариант в программу. Помни: первое сработавшее условие закрывает остальные ветки.",
        kk: "Әр нұсқаны программаға қой. Есіңде болсын: бірінші орындалған шарт қалған тармақтарды жабады.",
      },
      explanation: {
        ru: `${rightWhy[target].ru} Подходит x = ${right}. Остальные варианты: ${wrongPick.map((x) => `${x} → ${run(x)}`).join(", ")}.`,
        kk: `${rightWhy[target].kk} x = ${right} сәйкес келеді. Қалған нұсқалар: ${wrongPick.map((x) => `${x} → ${run(x)}`).join(", ")}.`,
      },
    },
    String(right),
    wrongPick.map((x) => ({ text: String(x), why: why(x) })),
  );
}

// --- несколько отдельных if и elif: накопление суммы ---

function genTwoIfs(rand: Rand, level: Level, seed: number): InputStep {
  const x = int(rand, 4, 30);
  const a = int(rand, 5, 20);
  const p = int(rand, 2, 9);
  const m = pick(rand, [2, 3, 4, 5] as const);
  const q = int(rand, 2, 9);
  const useElif = rand() < 0.5;
  const r = int(rand, 3, 12);
  let s = 0;
  const trace: string[] = [];
  const c1 = x > a;
  if (c1) {
    s += p;
    trace.push(`${x} > ${a} — True: s = ${s}`);
  } else trace.push(`${x} > ${a} — False: s = ${s}`);
  const c2 = x % m === 0;
  if (useElif && c1) {
    trace.push(`elif пропускается: if уже сработал`);
  } else if (c2) {
    s += q;
    trace.push(`${x} % ${m} == 0 — True: s = ${s}`);
  } else trace.push(`${x} % ${m} == 0 — False: s = ${s}`);
  if (s > r) {
    s -= 1;
    trace.push(`${s + 1} > ${r} — True: s = ${s}`);
  } else trace.push(`${s} > ${r} — False: s = ${s}`);
  const lines = [
    `x = ${x}`,
    "s = 0",
    `if x > ${a}:`,
    `    s = s + ${p}`,
    `${useElif ? "elif" : "if"} x % ${m} == 0:`,
    `    s = s + ${q}`,
    `if s > ${r}:`,
    "    s = s - 1",
    "print(s)",
  ];
  const trailRu = trace.join("; ");
  return numberInput(
    {
      id: `g:${SKILL}:twoifs:${x}-${a}-${p}-${m}-${q}-${r}-${useElif ? "e" : "i"}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(lines),
      hint: {
        ru: "Записывай значение s после каждой проверки. Отдельный if проверяется всегда, а elif — только если предыдущее условие неверно.",
        kk: "Әр тексеруден кейін s мәнін жазып отыр. Бөлек if әрдайым тексеріледі, ал elif — алдыңғы шарт жалған болғанда ғана.",
      },
      explanation: {
        ru: `x = ${x}. ${trailRu}. Выводится ${s}.`,
        kk: `x = ${x}. ${trace.map((t) => t.replace("elif пропускается: if уже сработал", "elif өткізіледі: if орындалып қойған")).join("; ")}. ${s} шығады.`,
      },
    },
    s,
  );
}

// --- вложенный if ---

function genNested(rand: Rand, level: Level, seed: number): InputStep {
  const a = int(rand, 5, 30);
  const b = int(rand, 5, 30);
  const outer = a > b;
  const evenA = a % 2 === 0;
  let out: number;
  let path: L;
  if (outer) {
    if (evenA) {
      out = a - b;
      path = {
        ru: `${a} > ${b} — True, заходим внутрь; ${a} % 2 == 0 — True: выводится a − b = ${out}.`,
        kk: `${a} > ${b} — True, ішке кіреміз; ${a} % 2 == 0 — True: a − b = ${out} шығады.`,
      };
    } else {
      out = a + b;
      path = {
        ru: `${a} > ${b} — True, заходим внутрь; ${a} % 2 == 0 — False: выводится a + b = ${out}.`,
        kk: `${a} > ${b} — True, ішке кіреміз; ${a} % 2 == 0 — False: a + b = ${out} шығады.`,
      };
    }
  } else {
    out = b - a;
    path = {
      ru: `${a} > ${b} — False, срабатывает внешний else: b − a = ${out}.`,
      kk: `${a} > ${b} — False, сыртқы else орындалады: b − a = ${out}.`,
    };
  }
  const lines = [
    `a = ${a}`,
    `b = ${b}`,
    "if a > b:",
    "    if a % 2 == 0:",
    "        print(a - b)",
    "    else:",
    "        print(a + b)",
    "else:",
    "    print(b - a)",
  ];
  return numberInput(
    {
      id: `g:${SKILL}:nested:${a}-${b}:${seed}`,
      level,
      prompt: PRINT_Q,
      scene: codeScene(lines),
      hint: {
        ru: "Сначала проверь внешнее условие, потом — внутреннее. Запиши, какая ветка сработала на каждом шаге.",
        kk: "Алдымен сыртқы шартты, содан кейін ішкі шартты тексер. Әр қадамда қай тармақ орындалғанын жазып отыр.",
      },
      explanation: path,
    },
    out,
  );
}

// --- какое условие нужно записать ---

interface CondTemplate {
  describe: L;
  right: string;
  wrong: { text: string; why: L }[];
  test: (x: number) => boolean[];
}

function condTemplate(rand: Rand): CondTemplate {
  const kind = int(rand, 0, 3);
  if (kind === 0) {
    const a = int(rand, 5, 40);
    return {
      describe: { ru: `x чётное и больше ${a}`, kk: `x жұп, әрі x > ${a}` },
      right: `x % 2 == 0 and x > ${a}`,
      wrong: [
        { text: `x % 2 == 0 or x > ${a}`, why: { ru: "С or подойдёт любое чётное и любое число больше границы, даже нечётное.", kk: "or болғанда кез келген жұп сан да, шектен үлкен кез келген сан да (тақ болса да) сәйкес келеді." } },
        { text: `x % 2 == 1 and x > ${a}`, why: { ru: "Остаток 1 означает нечётное число, а нужно чётное.", kk: "Қалдық 1 — тақ сан дегенді білдіреді, ал жұп сан керек." } },
        { text: `x % 2 == 0 and x < ${a}`, why: { ru: "Знак < выбирает числа меньше границы, а нужны больше.", kk: "< белгісі шектен кіші сандарды таңдайды, ал үлкені керек." } },
        { text: `x % 2 == 0 and x >= ${a}`, why: { ru: `Число ${a} при чётном ${a} подошло бы, хотя «больше ${a}» его исключает.`, kk: `${a} жұп болса, ол сәйкес келер еді, ал «x > ${a}» шарты оны қоспайды.` } },
      ],
      test: (x) => [x % 2 === 0 && x > a, x % 2 === 0 || x > a, x % 2 === 1 && x > a, x % 2 === 0 && x < a, x % 2 === 0 && x >= a],
    };
  }
  if (kind === 1) {
    const a = int(rand, 3, 20);
    const b = a + int(rand, 5, 25);
    return {
      describe: { ru: `x лежит строго между ${a} и ${b}`, kk: `x ${a} мен ${b} аралығында, шеттері кірмейді` },
      right: `${a} < x < ${b}`,
      wrong: [
        { text: `${a} <= x <= ${b}`, why: { ru: "Знаки <= включают границы, а «строго между» их исключает.", kk: "<= белгілері шектерді қосады, ал «қатаң аралығында» оларды қоспайды." } },
        { text: `x > ${a} or x < ${b}`, why: { ru: "С or условие верно для любого числа.", kk: "or болғанда шарт кез келген сан үшін ақиқат." } },
        { text: `x < ${a} and x > ${b}`, why: { ru: "Такого x не существует: число не может быть и меньше меньшей границы, и больше большей.", kk: "Мұндай x жоқ: сан кіші шектен кіші де, үлкен шектен үлкен де бола алмайды." } },
        { text: `x > ${a} and x <= ${b}`, why: { ru: `Верхняя граница ${b} включена, а должна быть исключена.`, kk: `Жоғарғы шек ${b} қосылған, ал ол қосылмауы керек.` } },
      ],
      test: (x) => [a < x && x < b, a <= x && x <= b, x > a || x < b, x < a && x > b, x > a && x <= b],
    };
  }
  if (kind === 2) {
    const m = pick(rand, [2, 3, 5] as const);
    const p = pick(rand, [4, 6, 7, 9, 10].filter((v) => v !== m) as readonly number[]);
    return {
      describe: { ru: `x кратно ${m}, но не кратно ${p}`, kk: `x ${m} санына еселі, бірақ ${p} санына еселі емес` },
      right: `x % ${m} == 0 and x % ${p} != 0`,
      wrong: [
        { text: `x % ${m} == 0 or x % ${p} != 0`, why: { ru: "С or подходят и числа, не кратные второму числу, хотя первое условие не выполнено.", kk: "or болғанда бірінші шарт орындалмаса да, екінші санға еселі емес сандар сәйкес келеді." } },
        { text: `x % ${m} == 0 and x % ${p} == 0`, why: { ru: `Это «кратно и ${m}, и ${p}», а нужно «не кратно ${p}».`, kk: `Бұл «${m} санына да, ${p} санына да еселі», ал «${p} санына еселі емес» керек.` } },
        { text: `x % ${m} != 0 and x % ${p} == 0`, why: { ru: "Условия поменяны местами: так выбираются кратные второму числу.", kk: "Шарттардың орындары ауыстырылған: бұлай екінші санға еселілер таңдалады." } },
        { text: `x % ${m} == 0 and x % ${p} == 1`, why: { ru: `Остаток 1 — лишнее требование: не кратное ${p} число может дать и другой остаток.`, kk: `Қалдық 1 — артық талап: ${p} санына еселі емес сан басқа қалдық та бере алады.` } },
      ],
      test: (x) => [x % m === 0 && x % p !== 0, x % m === 0 || x % p !== 0, x % m === 0 && x % p === 0, x % m !== 0 && x % p === 0, x % m === 0 && x % p === 1],
    };
  }
  const a = int(rand, 3, 30);
  const b = a + int(rand, 2, 15);
  return {
    describe: { ru: `x не равно ${a} и не равно ${b}`, kk: `x пен ${a} тең емес және x пен ${b} тең емес` },
    right: `x != ${a} and x != ${b}`,
    wrong: [
      { text: `x != ${a} or x != ${b}`, why: { ru: "С or условие верно для любого x: число не может равняться сразу обоим значениям.", kk: "or болғанда шарт кез келген x үшін ақиқат: сан екі мәнге бір мезгілде тең бола алмайды." } },
      { text: `x == ${a} and x == ${b}`, why: { ru: "Такое условие не выполняется никогда: x не может быть равен двум разным числам.", kk: "Мұндай шарт ешқашан орындалмайды: x екі түрлі санға тең бола алмайды." } },
      { text: `x == ${a} or x == ${b}`, why: { ru: "Это наоборот: условие верно, когда x равен одному из чисел, а нужно, чтобы не равнялся.", kk: "Бұл керісінше: шарт x сандардың біріне тең болғанда ақиқат, ал тең болмауы керек." } },
      { text: `x != ${a}`, why: { ru: `Второе число ${b} не учтено: при x = ${b} условие неверно сработает.`, kk: `Екінші сан ${b} ескерілмеген: x = ${b} болғанда шарт қате орындалады.` } },
    ],
    test: (x) => [x !== a && x !== b, x !== a || x !== b, x === a && x === b, x === a || x === b, x !== a],
  };
}

function genCondPick(rand: Rand, level: Level, seed: number): ChoiceStep {
  // Берём шаблон, пока неверные варианты действительно отличаются от верного на проверочном диапазоне.
  let tpl = condTemplate(rand);
  for (let attempt = 0; attempt < 20; attempt++) {
    tpl = condTemplate(rand);
    const keep = tpl.wrong.filter((w, i) => {
      for (let x = -20; x <= 150; x++) {
        const t = tpl.test(x);
        if (t[0] !== t[i + 1]) return true;
      }
      return false;
    });
    if (keep.length >= 3) {
      tpl = { ...tpl, wrong: keep, test: tpl.test };
      break;
    }
  }
  const key = tpl.right.replace(/\s/g, "");
  return choice(
    rand,
    {
      id: `g:${SKILL}:condpick:${key}:${seed}`,
      level,
      prompt: {
        ru: `Программа должна вывести YES, только если ${tpl.describe.ru}. Какое условие подходит?`,
        kk: `Программа тек мына жағдайда YES шығаруы керек: ${tpl.describe.kk}. Қай шарт сәйкес келеді?`,
      },
      hint: {
        ru: "Разбей описание на части и реши, как связаны части: «и» (and) или «или» (or). Проверь каждый вариант на пограничном значении.",
        kk: "Сипаттаманы бөліктерге бөл да, бөліктер қалай байланысқанын шеш: «және» (and) немесе «немесе» (or). Әр нұсқаны шектік мәнде тексер.",
      },
      explanation: {
        ru: `Нужно записать «${tpl.describe.ru}»: ${tpl.right}. В остальных вариантах перепутаны and и or, знаки сравнения или границы.`,
        kk: `«${tpl.describe.kk}» жазу керек: ${tpl.right}. Қалған нұсқаларда and мен or, салыстыру белгілері немесе шектер шатастырылған.`,
      },
    },
    tpl.right,
    tpl.wrong.map((w) => ({ text: w.text, why: w.why })),
  );
}

// ======================================================================
// Утверждения «верно / неверно»
// ======================================================================

const OPS = [">", "<", ">=", "<=", "==", "!="] as const;
type Op = (typeof OPS)[number];
const evalOp = (x: number, op: Op, k: number) => (op === ">" ? x > k : op === "<" ? x < k : op === ">=" ? x >= k : op === "<=" ? x <= k : op === "==" ? x === k : x !== k);

interface StaticStatement {
  level: Level;
  ru: string;
  kk: string;
  value: boolean;
  why: L;
}

const STATIC_STATEMENTS: StaticStatement[] = [
  { level: 1, ru: "Строка с if должна заканчиваться двоеточием", kk: "if бар жол қос нүктемен аяқталуы керек", value: true, why: { ru: "Да: после условия, как и после else, ставится двоеточие.", kk: "Иә: шарттан кейін, else сөзінен кейін сияқты, қос нүкте қойылады." } },
  { level: 1, ru: "Чтобы проверить равенство в условии, пишут один знак =", kk: "Шартта теңдікті тексеру үшін бір = белгісі жазылады", value: false, why: { ru: "Нет: один знак = присваивает значение, а сравнивает двойной ==.", kk: "Жоқ: бір = белгісі мән меншіктейді, ал салыстыруды қосарланған == жасайды." } },
  { level: 1, ru: "Ветка else выполняется, когда условие if неверно", kk: "else тармағы if шарты жалған болғанда орындалады", value: true, why: { ru: "Да: else — это «иначе», он срабатывает при False.", kk: "Иә: else — «әйтпесе», ол False болғанда орындалады." } },
  { level: 1, ru: "Результат сравнения в Python — всегда True или False", kk: "Python-да салыстыру нәтижесі әрдайым True немесе False болады", value: true, why: { ru: "Да: сравнение отвечает только «верно» или «неверно».", kk: "Иә: салыстыру тек «ақиқат» немесе «жалған» деп жауап береді." } },
  { level: 1, ru: "Строки внутри ветки if записывают без отступа", kk: "if тармағының ішіндегі жолдар шегінісіз жазылады", value: false, why: { ru: "Нет: тело ветки пишут с отступом в 4 пробела.", kk: "Жоқ: тармақтың ішіндегі жолдар 4 бос орын шегінісімен жазылады." } },
  { level: 1, ru: "Запись x != 5 означает «x не равно 5»", kk: "x != 5 жазбасы «x пен 5 тең емес» дегенді білдіреді", value: true, why: { ru: "Да: != — это «не равно».", kk: "Иә: != — «тең емес»." } },
  { level: 2, ru: "Ветку else нужно писать в каждом условном операторе", kk: "else тармағы әр шартты операторда жазылуы міндетті", value: false, why: { ru: "Нет: else можно не писать — тогда при неверном условии ничего не происходит.", kk: "Жоқ: else жазбауға болады — онда шарт жалған болса, ештеңе болмайды." } },
  { level: 2, ru: "В цепочке if–elif–else выполняется только одна ветка", kk: "if–elif–else тізбегінде тек бір тармақ орындалады", value: true, why: { ru: "Да: первая ветка с верным условием, остальные пропускаются.", kk: "Иә: шарты ақиқат бірінші тармақ, қалғандары өткізіліп кетеді." } },
  { level: 2, ru: "Условие elif проверяется, только если предыдущие условия неверны", kk: "elif шарты алдыңғы шарттар жалған болғанда ғана тексеріледі", value: true, why: { ru: "Да: elif — «а если», он нужен, когда выше ничего не сработало.", kk: "Иә: elif — «ал егер», ол жоғарыда ештеңе орындалмағанда керек." } },
  { level: 2, ru: "Запись 5 <= x <= 10 в Python допустима", kk: "Python-да 5 <= x <= 10 жазбасына рұқсат етіледі", value: true, why: { ru: "Да: Python понимает двойное сравнение как в математике.", kk: "Иә: Python қос салыстыруды математикадағыдай түсінеді." } },
  { level: 2, ru: "Запись x > 5 and < 10 в Python допустима", kk: "Python-да x > 5 and < 10 жазбасына рұқсат етіледі", value: false, why: { ru: "Нет: справа от and нужно полное условие: x > 5 and x < 10.", kk: "Жоқ: and сөзінен оң жақта толық шарт керек: x > 5 and x < 10." } },
  { level: 2, ru: "Если в цепочке if–elif сработал if, условие elif всё равно проверяется", kk: "if–elif тізбегінде if орындалса да, elif шарты бәрібір тексеріледі", value: false, why: { ru: "Нет: после сработавшей ветки остальные пропускаются.", kk: "Жоқ: бір тармақ орындалғаннан кейін қалғандары өткізіліп кетеді." } },
  { level: 3, ru: "В условии a or b and c сначала выполняется and", kk: "a or b and c шартында алдымен and орындалады", value: true, why: { ru: "Да: and выполняется раньше or, как умножение раньше сложения.", kk: "Иә: and or-дан бұрын орындалады, көбейту қосудан бұрын орындалатыны сияқты." } },
  { level: 3, ru: "Два отдельных if подряд проверяются оба, даже если первый сработал", kk: "Қатар тұрған екі бөлек if-тің екеуі де тексеріледі, біріншісі орындалса да", value: true, why: { ru: "Да: каждый отдельный if проверяется независимо.", kk: "Иә: әр бөлек if тәуелсіз тексеріледі." } },
  { level: 3, ru: "Условие x != 3 or x != 5 неверно при любом x", kk: "x != 3 or x != 5 шарты кез келген x үшін жалған", value: false, why: { ru: "Нет: оно верно при любом x, ведь число не может равняться и 3, и 5 сразу.", kk: "Жоқ: ол кез келген x үшін ақиқат, өйткені сан 3-ке де, 5-ке де бір мезгілде тең бола алмайды." } },
  { level: 3, ru: "Если поменять местами условия в цепочке elif, результат всегда останется тем же", kk: "elif тізбегіндегі шарттардың орнын ауыстырса, нәтиже әрдайым сол қалпында қалады", value: false, why: { ru: "Нет: порядок важен — срабатывает первое верное условие.", kk: "Жоқ: реттілік маңызды — бірінші ақиқат шарт орындалады." } },
  { level: 3, ru: "Выражение not (a and b) равносильно (not a) and (not b)", kk: "not (a and b) өрнегі (not a) and (not b) өрнегіне пара-пар", value: false, why: { ru: "Нет: по закону де Моргана not (a and b) равно (not a) or (not b).", kk: "Жоқ: де Морган заңы бойынша not (a and b) өрнегі (not a) or (not b) өрнегіне тең." } },
  { level: 3, ru: "Для целого x условие x % 2 == 1 верно для всех нечётных чисел, в том числе отрицательных", kk: "Бүтін x үшін x % 2 == 1 шарты барлық тақ сандар үшін, соның ішінде теріс сандар үшін де ақиқат", value: true, why: { ru: "Да: в Python остаток от деления на 2 неотрицателен, например (-3) % 2 = 1.", kk: "Иә: Python-да 2-ге бөлгендегі қалдық теріс емес, мысалы (-3) % 2 = 1." } },
];

function genStatement(rand: Rand, level: Level): Statement {
  if (rand() < 0.45) {
    const pool = STATIC_STATEMENTS.filter((s) => s.level === level);
    const s = pick(rand, pool);
    return { id: `s:${SKILL}:static:${s.ru.slice(0, 24)}`, skill: SKILL, level, text: { ru: s.ru, kk: s.kk }, value: s.value, explanation: s.why };
  }
  if (level === 1) {
    const x = int(rand, 1, 20);
    const op = pick(rand, OPS);
    const k = int(rand, 1, 20);
    const v = evalOp(x, op, k);
    return {
      id: `s:${SKILL}:cmp:${x}:${op}:${k}`,
      skill: SKILL,
      level,
      text: { ru: `При x = ${x} условие x ${op} ${k} верно`, kk: `x = ${x} болғанда x ${op} ${k} шарты ақиқат` },
      value: v,
      explanation: same(`${x} ${op} ${k} — ${tf(v)}`),
    };
  }
  if (level === 2) {
    const x = int(rand, 1, 40);
    if (rand() < 0.5) {
      const lo = int(rand, 5, 25);
      const hi = lo + int(rand, 3, 15);
      const v = lo <= x && x <= hi;
      return {
        id: `s:${SKILL}:range:${x}:${lo}:${hi}`,
        skill: SKILL,
        level,
        text: { ru: `При x = ${x} условие ${lo} <= x <= ${hi} верно`, kk: `x = ${x} болғанда ${lo} <= x <= ${hi} шарты ақиқат` },
        value: v,
        explanation: {
          ru: `Число ${x} ${v ? "лежит" : "не лежит"} между ${lo} и ${hi} (границы входят): ${tf(v)}.`,
          kk: `${x} саны ${lo} мен ${hi} аралығында ${v ? "жатыр" : "жатпайды"} (шеттері қоса): ${tf(v)}.`,
        },
      };
    }
    const m = pick(rand, [2, 3, 4, 5, 7] as const);
    const r = int(rand, 0, m - 1);
    const v = x % m === r;
    return {
      id: `s:${SKILL}:mod:${x}:${m}:${r}`,
      skill: SKILL,
      level,
      text: { ru: `При x = ${x} условие x % ${m} == ${r} верно`, kk: `x = ${x} болғанда x % ${m} == ${r} шарты ақиқат` },
      value: v,
      explanation: same(`${x} % ${m} = ${x % m}, в условии ${r}: ${tf(v)}`),
    };
  }
  // C: равносильные условия (сверка перебором)
  const a = int(rand, 3, 30);
  const b = a + int(rand, 3, 20);
  const variant = int(rand, 0, 2);
  const forms: { left: string; right: string; test: (x: number) => [boolean, boolean] }[] = [
    { left: `not (x > ${a})`, right: `x <= ${a}`, test: (x) => [!(x > a), x <= a] },
    { left: `not (x > ${a} and x < ${b})`, right: `x <= ${a} or x >= ${b}`, test: (x) => [!(x > a && x < b), x <= a || x >= b] },
    { left: `not (x == ${a})`, right: `x != ${a}`, test: (x) => [!(x === a), x !== a] },
  ];
  const f = forms[variant];
  const broken = rand() < 0.5;
  const rightText = broken ? (variant === 0 ? `x < ${a}` : variant === 1 ? `x <= ${a} and x >= ${b}` : `x > ${a}`) : f.right;
  const testBroken = (x: number): [boolean, boolean] =>
    variant === 0 ? [!(x > a), x < a] : variant === 1 ? [!(x > a && x < b), x <= a && x >= b] : [!(x === a), x > a];
  const t = broken ? testBroken : f.test;
  let equal = true;
  for (let x = -5; x <= b + 10; x++) {
    const [l, r] = t(x);
    if (l !== r) equal = false;
  }
  return {
    id: `s:${SKILL}:equiv:${a}:${b}:${variant}:${broken ? 1 : 0}`,
    skill: SKILL,
    level,
    text: {
      ru: `Условия «${f.left}» и «${rightText}» равносильны`,
      kk: `«${f.left}» және «${rightText}» шарттары пара-пар`,
    },
    value: equal,
    explanation: equal
      ? { ru: "Да: условие, записанное через not, даёт то же значение при любом x.", kk: "Иә: not арқылы жазылған шарт кез келген x үшін сол мәнді береді." }
      : { ru: "Нет: на некоторых значениях x условия дают разные результаты (например, на границе).", kk: "Жоқ: x-тің кейбір мәндерінде шарттар әртүрлі нәтиже береді (мысалы, шекте)." },
  };
}

// ======================================================================
// Пары «условие ↔ смысл»
// ======================================================================

const OP_MEANING: Record<string, L> = {
  "==": { ru: "равно", kk: "тең" },
  "!=": { ru: "не равно", kk: "тең емес" },
  "<": { ru: "меньше", kk: "кіші" },
  ">": { ru: "больше", kk: "үлкен" },
  "<=": { ru: "меньше или равно", kk: "кіші немесе тең" },
  ">=": { ru: "больше или равно", kk: "үлкен немесе тең" },
  and: { ru: "И: верны оба условия", kk: "ЖӘНЕ: екі шарт та ақиқат" },
  or: { ru: "ИЛИ: верно хотя бы одно", kk: "НЕМЕСЕ: кемінде біреуі ақиқат" },
  not: { ru: "НЕ: меняет True на False", kk: "ЕМЕС: True-ды False-қа ауыстырады" },
};

function genPair(rand: Rand, level: Level): Pair {
  if (level === 1) {
    const sym = pick(rand, ["==", "!=", "<", ">", "<=", ">="] as const);
    return { id: `p:${SKILL}:op:${sym}`, skill: SKILL, level, left: sym, right: OP_MEANING[sym] };
  }
  if (level === 2) {
    const kind = int(rand, 0, 4);
    if (kind === 0) return { id: `p:${SKILL}:even`, skill: SKILL, level, left: "x % 2 == 0", right: { ru: "x чётное", kk: "x жұп" } };
    if (kind === 1) return { id: `p:${SKILL}:odd`, skill: SKILL, level, left: "x % 2 == 1", right: { ru: "x нечётное", kk: "x тақ" } };
    if (kind === 2) {
      const m = pick(rand, [3, 4, 5, 7, 10] as const);
      return { id: `p:${SKILL}:mult:${m}`, skill: SKILL, level, left: `x % ${m} == 0`, right: { ru: `x кратно ${m}`, kk: `x ${m} санына еселі` } };
    }
    if (kind === 3) {
      const lo = int(rand, 1, 20);
      const hi = lo + int(rand, 3, 20);
      return { id: `p:${SKILL}:range:${lo}:${hi}`, skill: SKILL, level, left: `${lo} <= x <= ${hi}`, right: { ru: `x от ${lo} до ${hi}, границы входят`, kk: `x ${lo} мен ${hi} аралығында, шеттері қоса` } };
    }
    const c = int(rand, 1, 30);
    return { id: `p:${SKILL}:ne:${c}`, skill: SKILL, level, left: `x != ${c}`, right: { ru: `x не равно ${c}`, kk: `x пен ${c} тең емес` } };
  }
  const a = int(rand, 3, 30);
  const b = a + int(rand, 3, 20);
  const kind = int(rand, 0, 2);
  if (kind === 0) return { id: `p:${SKILL}:not:${a}`, skill: SKILL, level, left: `not (x > ${a})`, right: `x <= ${a}` };
  if (kind === 1) return { id: `p:${SKILL}:demorgan:${a}:${b}`, skill: SKILL, level, left: `not (x > ${a} and x < ${b})`, right: `x <= ${a} or x >= ${b}` };
  return { id: `p:${SKILL}:notin:${a}:${b}`, skill: SKILL, level, left: `not (${a} <= x <= ${b})`, right: `x < ${a} or x > ${b}` };
}

// ======================================================================
// Короткие вопросы
// ======================================================================

function genShort(rand: Rand, level: Level): ShortQuestion {
  if (level === 1) {
    const x = int(rand, 1, 30);
    const op = pick(rand, OPS);
    const k = int(rand, 1, 30);
    const v = evalOp(x, op, k);
    return {
      id: `q:${SKILL}:cmp:${x}:${op}:${k}`,
      skill: SKILL,
      level,
      prompt: { ru: `Значение выражения ${x} ${op} ${k}: True или False?`, kk: `${x} ${op} ${k} өрнегінің мәні: True ме, False па?` },
      answer: tf(v),
      mode: "text",
      explanation: same(`${x} ${op} ${k} — ${tf(v)}`),
    };
  }
  if (level === 2) {
    const x = int(rand, 5, 60);
    const m = pick(rand, [2, 3, 4, 5, 6, 7] as const);
    const r = int(rand, 0, m - 1);
    const t = int(rand, 5, 40);
    const v = x % m === r && x > t;
    return {
      id: `q:${SKILL}:mod:${x}:${m}:${r}:${t}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `x = ${x}. Значение условия x % ${m} == ${r} and x > ${t}: True или False?`,
        kk: `x = ${x}. x % ${m} == ${r} and x > ${t} шартының мәні: True ме, False па?`,
      },
      answer: tf(v),
      mode: "text",
      explanation: {
        ru: `${x} % ${m} = ${x % m} — ${tf(x % m === r)}; ${x} > ${t} — ${tf(x > t)}. and даёт ${tf(v)}.`,
        kk: `${x} % ${m} = ${x % m} — ${tf(x % m === r)}; ${x} > ${t} — ${tf(x > t)}. and ${tf(v)} береді.`,
      },
    };
  }
  const m = pick(rand, [2, 3, 4, 5] as const);
  const p = pick(rand, [6, 7, 9, 10] as const);
  const top = pick(rand, [20, 30, 40, 50] as const);
  let count = 0;
  for (let x = 1; x <= top; x++) if (x % m === 0 && x % p !== 0) count++;
  return {
    id: `q:${SKILL}:count:${m}:${p}:${top}`,
    skill: SKILL,
    level,
    prompt: {
      ru: `Сколько целых x от 1 до ${top} удовлетворяют условию x % ${m} == 0 and x % ${p} != 0?`,
      kk: `Бүтін x үшін 1 ≤ x ≤ ${top}. x % ${m} == 0 and x % ${p} != 0 шарты неше x үшін ақиқат?`,
    },
    answer: String(count),
    mode: "number",
    explanation: {
      ru: `Берём числа, кратные ${m}, и вычёркиваем те, что кратны ${p}. Остаётся ${count}.`,
      kk: `${m} санына еселі сандарды алып, ${p} санына еселілерін сызып тастаймыз. ${count} қалады.`,
    },
  };
}

// ======================================================================
// Банк навыка
// ======================================================================

type Gen = (rand: Rand, level: Level, seed: number) => ChoiceStep | InputStep;

const KINDS: Record<Level, Gen[]> = {
  1: [genParity, genThreshold, genWhichTrue, genEqLine, genSign],
  2: [genElifChain, genIndent, genRangeIn, genCountRange],
  3: [genFindX, genTwoIfs, genNested, genCondPick],
};

const ifBank: SkillBank = {
  skill: SKILL,
  question(level, seed) {
    const rand = seeded(seed);
    return pick(rand, KINDS[level])(rand, level, seed);
  },
  statement: (level, seed) => genStatement(seeded(seed), level),
  pair: (level, seed) => genPair(seeded(seed), level),
  short: (level, seed) => genShort(seeded(seed), level),
};

export const BANKS: SkillBank[] = [ifBank];
