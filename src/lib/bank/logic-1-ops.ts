import type { ChoiceStep, InputStep, L, Level, Text } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка logic.ops: высказывания и логические операции. Выражения строит и считает код (дерево Expr),
// правильный ответ всегда вычисляется, а не записан вручную. Тексты после переменных чисел — без падежных
// окончаний (по-казахски окончание зависит от числа): пишем «A = 1, B = 0 болғанда», а не «1-де».
// Таблицы истинности целиком — тема следующего урока; здесь значения переменных всегда заданы.

const SKILL = "logic.ops";

// ---------- Дерево выражения ----------

type Bit = 0 | 1;
type Op = "and" | "or" | "imp" | "eqv";
type Env = Record<string, Bit>;
type Expr = { t: "v"; n: string } | { t: "not"; a: Expr } | { t: "bin"; op: Op; a: Expr; b: Expr };

const v = (n: string): Expr => ({ t: "v", n });
const not = (a: Expr): Expr => ({ t: "not", a });
const bin = (op: Op, a: Expr, b: Expr): Expr => ({ t: "bin", op, a, b });

const SYM: Record<Op, string> = { and: "∧", or: "∨", imp: "→", eqv: "↔" };
const PREC: Record<Op, number> = { and: 4, or: 3, imp: 2, eqv: 1 };
const OPS: Op[] = ["and", "or", "imp", "eqv"];

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });
const bit = (rand: Rand): Bit => (rand() < 0.5 ? 0 : 1);

function applyOp(op: Op, a: Bit, b: Bit): Bit {
  switch (op) {
    case "and":
      return a === 1 && b === 1 ? 1 : 0;
    case "or":
      return a === 1 || b === 1 ? 1 : 0;
    case "imp":
      return a === 1 && b === 0 ? 0 : 1;
    case "eqv":
      return a === b ? 1 : 0;
  }
}

function ev(e: Expr, env: Env): Bit {
  if (e.t === "v") return env[e.n];
  if (e.t === "not") return ev(e.a, env) === 1 ? 0 : 1;
  return applyOp(e.op, ev(e.a, env), ev(e.b, env));
}

/** Запись выражения: только по приоритету (¬, ∧, ∨, →, ↔); у → и ↔ вложенные операции всегда в скобках. */
function show(e: Expr): string {
  if (e.t === "v") return e.n;
  if (e.t === "not") return e.a.t === "bin" ? `¬(${show(e.a)})` : `¬${show(e.a)}`;
  const wrap = (c: Expr): string => {
    const s = show(c);
    if (c.t !== "bin") return s;
    const need = PREC[c.op] < PREC[e.op] || (PREC[c.op] === PREC[e.op] && (e.op === "imp" || e.op === "eqv"));
    return need ? `(${s})` : s;
  };
  return `${wrap(e.a)} ${SYM[e.op]} ${wrap(e.b)}`;
}

/** Переменные выражения в алфавитном порядке. */
function varsOf(e: Expr, acc = new Set<string>()): string[] {
  if (e.t === "v") acc.add(e.n);
  else if (e.t === "not") varsOf(e.a, acc);
  else {
    varsOf(e.a, acc);
    varsOf(e.b, acc);
  }
  return [...acc].sort();
}

/** Подстановка значений: «A = 1, B = 0». */
const envText = (names: string[], env: Env) => names.map((n) => `${n} = ${env[n]}`).join(", ");

/** Шаги вычисления (в порядке выполнения): «¬A = 0; B ∧ C = 0; ¬A ∨ B ∧ C = 0». */
function stepsOf(e: Expr, env: Env): string {
  const out: string[] = [];
  const walk = (x: Expr) => {
    if (x.t === "v") return;
    if (x.t === "not") walk(x.a);
    else {
      walk(x.a);
      walk(x.b);
    }
    const line = `${show(x)} = ${ev(x, env)}`;
    if (!out.includes(line)) out.push(line);
  };
  walk(e);
  return out.join("; ");
}

const xa = v("A");
const xb = v("B");
const xc = v("C");

/** Выражения уровня B: до трёх переменных, ¬, ∧, ∨ (есть случаи, где важен приоритет). */
const T2: Expr[] = [
  bin("or", not(xa), xb),
  bin("and", xa, not(xb)),
  not(bin("and", xa, xb)),
  not(bin("or", xa, xb)),
  bin("and", bin("or", xa, xb), xc),
  bin("or", xa, bin("and", xb, xc)),
  bin("or", bin("and", xa, xb), xc),
  bin("and", not(xa), not(xb)),
  bin("or", not(xa), bin("and", xb, xc)),
  bin("and", xa, bin("or", xb, xc)),
  bin("or", bin("and", xa, not(xb)), xc),
  bin("and", bin("or", xa, not(xb)), xc),
];

/** Выражения уровня C: добавляются → и ↔. */
const T3: Expr[] = [
  bin("imp", xa, bin("or", xb, xc)),
  bin("imp", bin("and", xa, xb), xc),
  bin("imp", not(xa), xb),
  bin("eqv", xa, not(xb)),
  bin("and", bin("imp", xa, xb), bin("imp", xb, xc)),
  bin("imp", bin("or", xa, xb), xc),
  bin("eqv", bin("and", xa, xb), xc),
  bin("or", bin("imp", xa, xb), xc),
  bin("imp", xa, bin("and", xb, xc)),
  bin("eqv", bin("or", xa, xb), not(xc)),
  bin("imp", xa, bin("imp", xb, xc)),
  bin("and", bin("eqv", xa, xb), xc),
  not(bin("imp", xa, xb)),
  bin("or", bin("eqv", xa, xb), not(xc)),
];

/** Выражения от двух переменных для задач «известно, что… — найди значение». */
const T2V: Expr[] = [
  bin("eqv", xa, xb),
  bin("and", xa, not(xb)),
  bin("or", not(xa), xb),
  bin("imp", xb, xa),
  not(bin("or", xa, xb)),
  bin("and", not(xa), xb),
  bin("eqv", xa, not(xb)),
  bin("imp", xa, not(xb)),
  bin("or", xa, not(xb)),
];

const ENVS3: Env[] = [];
for (let i = 0; i < 8; i++) ENVS3.push({ A: ((i >> 2) & 1) as Bit, B: ((i >> 1) & 1) as Bit, C: (i & 1) as Bit });
/** Все наборы значений для списка переменных (двоичный счёт). */
function envsFor(names: string[]): Env[] {
  const out: Env[] = [];
  for (let i = 0; i < 2 ** names.length; i++) {
    const env: Env = {};
    names.forEach((n, k) => (env[n] = ((i >> (names.length - 1 - k)) & 1) as Bit));
    out.push(env);
  }
  return out;
}
const randEnv = (rand: Rand): Env => ({ A: bit(rand), B: bit(rand), C: bit(rand) });
const envKey = (names: string[], env: Env) => names.map((n) => env[n]).join("");

// ---------- Общие тексты и подсказки ----------

const HINT_SPECIAL: L = {
  ru: "У каждой операции есть особый случай: ∧ равно 1 только при 1 и 1, ∨ равно 0 только при 0 и 0, → равно 0 только при 1 → 0. Сравни с ним.",
  kk: "Әр амалдың ерекше жағдайы бар: ∧ тек 1 және 1 болғанда 1, ∨ тек 0 және 0 болғанда 0, → тек 1 → 0 болғанда 0 болады. Осымен салыстыр.",
};
const HINT_PRIORITY: L = {
  ru: "Считай по приоритету: сначала скобки, потом ¬, затем ∧, затем ∨, затем →, затем ↔. Записывай значение над каждым знаком.",
  kk: "Басымдық бойынша есепте: алдымен жақшалар, сосын ¬, одан кейін ∧, ∨, →, ↔. Әр белгінің үстіне мәнін жаз.",
};
const HINT_CHECK_EACH: L = {
  ru: "Подставляй значения в каждое выражение по очереди и считай по приоритету. Помни особые случаи: ∧ равно 1 только при 1 и 1, ∨ равно 0 только при 0 и 0, → равно 0 только при 1 → 0.",
  kk: "Мәндерді әр өрнекке кезекпен қойып, басымдық бойынша есепте. Ерекше жағдайларды еске түсір: ∧ тек 1 және 1 болғанда 1, ∨ тек 0 және 0 болғанда 0, → тек 1 → 0 болғанда 0 болады.",
};
const HINT_FIND: L = {
  ru: "Проверь каждый вариант: подставь значения и посчитай по приоритету. Можно идти от результата: при каких значениях главная (последняя) операция даёт нужное значение?",
  kk: "Әр нұсқаны тексер: мәндерді қойып, басымдық бойынша есепте. Нәтижеден де бастауға болады: қай мәндерде басты (соңғы) амал қажетті мәнді береді?",
};
const HINT_COND: L = {
  ru: "Сначала найди A и B из условия: у какой операции есть особый случай, подходящий к условию? Потом подставь значения в выражение.",
  kk: "Алдымен шарттан A мен B мәндерін тап: қай амалдың ерекше жағдайы шартқа сәйкес келеді? Содан кейін мәндерді өрнекке қой.",
};
const HINT_STMT: L = {
  ru: "Про высказывание можно сказать «это правда» или «это неправда». Про вопрос и команду так сказать нельзя.",
  kk: "Пікір туралы «бұл рас» немесе «бұл рас емес» деп айтуға болады. Сұрақ пен бұйрық туралы олай айту мүмкін емес.",
};
const HINT_PROP: L = {
  ru: "У каждой операции свой особый случай. Сравни описание со столбцами результатов ∧, ∨, →, ↔ при наборах 00, 01, 10, 11.",
  kk: "Әр амалдың өз ерекше жағдайы бар. Сипаттаманы ∧, ∨, →, ↔ амалдарының 00, 01, 10, 11 жиындарындағы нәтиже бағандарымен салыстыр.",
};

const OP_HINT: Record<Op | "not", L> = {
  not: { ru: "¬ переворачивает значение: 1 становится 0, а 0 становится 1.", kk: "¬ мәнді керісінше өзгертеді: 1 мәні 0-ге, 0 мәні 1-ге айналады." },
  and: { ru: "У И единственная единица: она получается, только если оба значения равны 1.", kk: "ЖӘНЕ амалының жалғыз бірлігі бар: ол тек екі мән де 1 болғанда шығады." },
  or: { ru: "У ИЛИ единственный ноль: он получается, только если оба значения равны 0.", kk: "НЕМЕСЕ амалының жалғыз нөлі бар: ол тек екі мән де 0 болғанда шығады." },
  imp: { ru: "Импликация ложна в единственном случае 1 → 0 (условие выполнено, а следствие нет). Во всех остальных она истинна.", kk: "Импликация жалғыз 1 → 0 жағдайында жалған (шарт орындалған, ал салдар орындалмаған). Қалған барлық жағдайда ақиқат." },
  eqv: { ru: "Эквиваленция равна 1, если значения одинаковы (0 и 0 или 1 и 1), и 0, если разные.", kk: "Эквиваленция мәндер бірдей болса (0 және 0 немесе 1 және 1) 1-ге тең, әртүрлі болса 0-ге тең." },
};

const OP_RULE: Record<Op, (x: Bit, y: Bit, r: Bit) => L> = {
  and: (x, y, r) => ({
    ru: `И равно 1 только при 1 и 1: ${x} ∧ ${y} = ${r}.`,
    kk: `ЖӘНЕ тек 1 және 1 болғанда 1-ге тең: ${x} ∧ ${y} = ${r}.`,
  }),
  or: (x, y, r) => ({
    ru: `ИЛИ равно 0 только при 0 и 0: ${x} ∨ ${y} = ${r}.`,
    kk: `НЕМЕСЕ тек 0 және 0 болғанда 0-ге тең: ${x} ∨ ${y} = ${r}.`,
  }),
  imp: (x, y, r) => ({
    ru: `Импликация ложна только при 1 → 0: ${x} → ${y} = ${r}.`,
    kk: `Импликация тек 1 → 0 болғанда жалған: ${x} → ${y} = ${r}.`,
  }),
  eqv: (x, y, r) => ({
    ru: `Эквиваленция истинна, когда значения одинаковы: ${x} ↔ ${y} = ${r}.`,
    kk: `Эквиваленция мәндер бірдей болғанда ақиқат: ${x} ↔ ${y} = ${r}.`,
  }),
};

/** Варианты ответа: первый — верный. Перемешиваются вместе с пояснениями. */
function mixed(rand: Rand, correct: Text, wrong: { value: Text; why: L }[]): { options: Text[]; correct: number; whyWrong: (L | null)[] } {
  const items = [{ value: correct, why: null as L | null }, ...wrong.map((w) => ({ value: w.value, why: w.why as L | null }))];
  const list = shuffle(items, rand);
  return { options: list.map((i) => i.value), correct: list.findIndex((i) => i.why === null), whyWrong: list.map((i) => i.why) };
}

const joinNames = (names: string[], and: string) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`);

// ---------- Статичные пулы: высказывания и пары ----------

/** Высказывания (истинные и ложные) — для вопроса «что из этого высказывание». */
const STATEMENTS: { text: L; truth: boolean }[] = [
  { text: { ru: "Число 12 делится на 4", kk: "12 саны 4-ке бөлінеді" }, truth: true },
  { text: { ru: "Астана — столица Казахстана", kk: "Астана — Қазақстанның астанасы" }, truth: true },
  { text: { ru: "2 + 2 = 5", kk: "2 + 2 = 5" }, truth: false },
  { text: { ru: "Озеро Балхаш находится в Казахстане", kk: "Балқаш көлі Қазақстанда орналасқан" }, truth: true },
  { text: { ru: "Число 7 чётное", kk: "7 саны жұп" }, truth: false },
  { text: { ru: "Земля вращается вокруг Солнца", kk: "Жер Күнді айналады" }, truth: true },
  { text: { ru: "Любое двоичное число состоит из цифр 0 и 1", kk: "Кез келген екілік сан 0 және 1 цифрларынан тұрады" }, truth: true },
  { text: { ru: "Python — язык программирования", kk: "Python — программалау тілі" }, truth: true },
  { text: { ru: "Килобайт больше мегабайта", kk: "Килобайт мегабайттан үлкен" }, truth: false },
];

/** Предложения, не являющиеся высказываниями: вопросы и команды. */
const NON_STATEMENTS: { text: L; kind: "question" | "command" }[] = [
  { text: { ru: "Который час?", kk: "Сағат неше?" }, kind: "question" },
  { text: { ru: "Как тебя зовут?", kk: "Сенің атың кім?" }, kind: "question" },
  { text: { ru: "Сколько минут в часе?", kk: "Бір сағатта неше минут бар?" }, kind: "question" },
  { text: { ru: "Какой сегодня день недели?", kk: "Бүгін аптаның қай күні?" }, kind: "question" },
  { text: { ru: "Почему небо голубое?", kk: "Аспан неге көк?" }, kind: "question" },
  { text: { ru: "Закрой окно!", kk: "Терезені жап!" }, kind: "command" },
  { text: { ru: "Реши задачу номер пять", kk: "Бесінші есепті шеш" }, kind: "command" },
  { text: { ru: "Включи компьютер", kk: "Компьютерді қос" }, kind: "command" },
  { text: { ru: "Не опаздывай на урок!", kk: "Сабаққа кешікпе!" }, kind: "command" },
  { text: { ru: "Запиши число в двоичной системе", kk: "Санды екілік жүйеде жаз" }, kind: "command" },
];

const WHY_NON: Record<"question" | "command", L> = {
  question: { ru: "Это вопрос: про него нельзя сказать «истина» или «ложь».", kk: "Бұл сұрақ: ол туралы «ақиқат» немесе «жалған» деп айту мүмкін емес." },
  command: { ru: "Это команда: её выполняют, а не оценивают как истину или ложь.", kk: "Бұл бұйрық: оны орындайды, ақиқат не жалған деп бағаламайды." },
};

/** n разных элементов в случайном порядке. */
function pickDistinct<T>(rand: Rand, arr: readonly T[], n: number): T[] {
  return shuffle(arr, rand).slice(0, n);
}

/** «вопросы», «команды» или «вопросы и команды» — по тому, что реально попало в варианты. */
function restKinds(list: { kind: "question" | "command" }[]): L {
  const q = list.some((x) => x.kind === "question");
  const c = list.some((x) => x.kind === "command");
  if (q && c) return { ru: "вопросы и команды", kk: "сұрақтар мен бұйрықтар" };
  return q ? { ru: "вопросы", kk: "сұрақтар" } : { ru: "команды", kk: "бұйрықтар" };
}

// ---------- Задания ----------

function qStatement(rand: Rand, seed: number, level: Level, notVariant: boolean): ChoiceStep {
  if (!notVariant) {
    // Одно высказывание среди трёх вопросов/команд.
    const good = pick(rand, STATEMENTS);
    const bad = pickDistinct(rand, NON_STATEMENTS, 3);
    const o = mixed(
      rand,
      good.text,
      bad.map((x) => ({ value: x.text, why: WHY_NON[x.kind] })),
    );
    return {
      id: `g:${SKILL}:stmt:${STATEMENTS.indexOf(good)}:${seed}`,
      type: "choice",
      skill: SKILL,
      level,
      prompt: { ru: "Какое из предложений является высказыванием?", kk: "Қай сөйлем пікір болып табылады?" },
      ...o,
      explanation: {
        ru: `Высказывание — утверждение, которое истинно или ложно. «${good.text.ru}» — ${good.truth ? "истина" : "ложь"}. Остальные предложения — ${restKinds(bad).ru}.`,
        kk: `Пікір — ақиқат немесе жалған болатын тұжырым. «${good.text.kk}» — ${good.truth ? "ақиқат" : "жалған"}. Қалған сөйлемдер — ${restKinds(bad).kk}.`,
      },
      hint: HINT_STMT,
    };
  }
  // Три высказывания и одно предложение, не являющееся высказыванием.
  const non = pick(rand, NON_STATEMENTS);
  const good = pickDistinct(rand, STATEMENTS, 3);
  const o = mixed(
    rand,
    non.text,
    good.map((x) => ({
      value: x.text,
      why: {
        ru: `Это высказывание: оно ${x.truth ? "истинно" : "ложно"}.`,
        kk: `Бұл пікір: ол ${x.truth ? "ақиқат" : "жалған"}.`,
      },
    })),
  );
  return {
    id: `g:${SKILL}:stmtnot:${NON_STATEMENTS.indexOf(non)}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: { ru: "Какое из предложений НЕ является высказыванием?", kk: "Қай сөйлем пікір болып табылмайды?" },
    ...o,
    explanation: {
      ru: `«${non.text.ru}» — ${non.kind === "question" ? "вопрос" : "команда"}: про него нельзя сказать «истина» или «ложь». Остальные три предложения — высказывания (истинные или ложные).`,
      kk: `«${non.text.kk}» — ${non.kind === "question" ? "сұрақ" : "бұйрық"}: ол туралы «ақиқат» немесе «жалған» деп айту мүмкін емес. Қалған үш сөйлем — пікірлер (ақиқат немесе жалған).`,
    },
    hint: HINT_STMT,
  };
}

/** Уровень A: значение одной операции на заданных значениях (ввод 0 или 1). */
function qVal(rand: Rand, seed: number, level: Level): InputStep {
  const isNot = rand() < 0.2;
  if (isNot) {
    const x = bit(rand);
    const r = (x === 1 ? 0 : 1) as Bit;
    return {
      id: `g:${SKILL}:val:not${x}:${seed}`,
      type: "input",
      skill: SKILL,
      level,
      prompt: { ru: `Чему равно ¬${x}?`, kk: `¬${x} мәні неге тең?` },
      answers: [String(r)],
      mode: "number",
      explanation: { ru: `¬ переворачивает значение: ¬${x} = ${r}.`, kk: `¬ мәнді керісінше өзгертеді: ¬${x} = ${r}.` },
      hint: OP_HINT.not,
    };
  }
  const op = pick(rand, OPS);
  const x = bit(rand);
  const y = bit(rand);
  const r = applyOp(op, x, y);
  return {
    id: `g:${SKILL}:val:${x}${op}${y}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: { ru: `Чему равно ${x} ${SYM[op]} ${y}?`, kk: `${x} ${SYM[op]} ${y} мәні неге тең?` },
    answers: [String(r)],
    mode: "number",
    explanation: OP_RULE[op](x, y, r),
    hint: OP_HINT[op],
  };
}

const PROPS: { ru: string; kk: string; col: string }[] = [
  { ru: "даёт 1, только если A = 1 и B = 1", kk: "тек A = 1 және B = 1 болғанда 1 береді", col: "0001" },
  { ru: "даёт 0, только если A = 0 и B = 0", kk: "тек A = 0 және B = 0 болғанда 0 береді", col: "0111" },
  { ru: "даёт 0, только если A = 1 и B = 0", kk: "тек A = 1 және B = 0 болғанда 0 береді", col: "1101" },
  { ru: "даёт 1, только если A и B одинаковы", kk: "тек A мен B бірдей болғанда 1 береді", col: "1001" },
];

/** Столбец результата операции для наборов 00, 01, 10, 11. */
const opColumn = (op: Op): string =>
  ([[0, 0], [0, 1], [1, 0], [1, 1]] as [Bit, Bit][]).map(([x, y]) => applyOp(op, x, y)).join("");

/** Уровень A: какая операция обладает свойством (свойство проверяется по вычисленному столбцу). */
function qWhichOp(rand: Rand, seed: number, level: Level): ChoiceStep {
  const prop = pick(rand, PROPS);
  const right = OPS.filter((op) => opColumn(op) === prop.col);
  if (right.length !== 1) throw new Error(`logic.ops: свойство ${prop.col} подходит ${right.length} операциям`);
  const correct = right[0];
  const wrong = OPS.filter((op) => op !== correct).map((op) => ({
    value: `A ${SYM[op]} B` as Text,
    why: {
      ru: `Для ${SYM[op]} столбец результатов (наборы 00, 01, 10, 11): ${opColumn(op)}. Это не то свойство.`,
      kk: `${SYM[op]} үшін нәтиже бағаны (00, 01, 10, 11 жиындары): ${opColumn(op)}. Бұл басқа қасиет.`,
    },
  }));
  const o = mixed(rand, `A ${SYM[correct]} B`, wrong);
  return {
    id: `g:${SKILL}:whichop:${prop.col}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: { ru: `Какая операция ${prop.ru}?`, kk: `Қай амал ${prop.kk}?` },
    ...o,
    explanation: {
      ru: `Столбец результатов у ${SYM[correct]} для наборов 00, 01, 10, 11 — ${prop.col}: это и есть нужное свойство.`,
      kk: `${SYM[correct]} амалының 00, 01, 10, 11 жиындарындағы нәтиже бағаны — ${prop.col}: қажетті қасиет осы.`,
    },
    hint: HINT_PROP,
  };
}

/** Уровень B: какое из четырёх выражений истинно/ложно при заданных значениях (ровно одно подходит). */
function qPick(rand: Rand, seed: number, level: Level): ChoiceStep {
  const target: Bit = bit(rand);
  let env = randEnv(rand);
  let good: Expr[] = [];
  let bad: Expr[] = [];
  for (let tries = 0; tries < 40; tries++) {
    good = T2.filter((e) => ev(e, env) === target);
    bad = T2.filter((e) => ev(e, env) !== target);
    if (good.length >= 1 && bad.length >= 3) break;
    env = tries < 20 ? randEnv(rand) : ENVS3[tries % 8];
  }
  const right = pick(rand, good);
  const wrongs = pickDistinct(rand, bad, 3);
  const envStr = envText(["A", "B", "C"], env);
  const word = (t: Bit) => (t === 1 ? { ru: "истинно", kk: "ақиқат" } : { ru: "ложно", kk: "жалған" });
  const o = mixed(
    rand,
    show(right),
    wrongs.map((w) => ({
      value: show(w),
      why: {
        ru: `При ${envStr} это выражение ${target === 1 ? "ложно" : "истинно"}: ${stepsOf(w, env)}.`,
        kk: `${envStr} болғанда бұл өрнек ${target === 1 ? "жалған" : "ақиқат"}: ${stepsOf(w, env)}.`,
      },
    })),
  );
  const key = `${envKey(["A", "B", "C"], env)}${target}-${T2.indexOf(right)}`;
  return {
    id: `g:${SKILL}:pick:${key}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: {
      ru: `${envStr}. Какое из выражений ${word(target).ru}?`,
      kk: `${envStr}. Қай өрнек ${word(target).kk}?`,
    },
    ...o,
    explanation: {
      ru: `Считаем по приоритету: ${stepsOf(right, env)}. Выражение ${word(target).ru} только здесь, остальные при этих значениях ${target === 1 ? "ложны" : "истинны"}.`,
      kk: `Басымдық бойынша есептейміз: ${stepsOf(right, env)}. Өрнек тек осында ${word(target).kk}, қалғандары осы мәндерде ${target === 1 ? "жалған" : "ақиқат"}.`,
    },
    hint: HINT_CHECK_EACH,
  };
}

/** Уровень B: сколько из четырёх операций дают 1 при заданных A и B. */
function qCount(rand: Rand, seed: number, level: Level): InputStep {
  const x = bit(rand);
  const y = bit(rand);
  const results = OPS.map((op) => applyOp(op, x, y));
  const count = results.reduce<number>((s, r) => s + r, 0);
  const detail = OPS.map((op, i) => `${x} ${SYM[op]} ${y} = ${results[i]}`).join("; ");
  return {
    id: `g:${SKILL}:count:${x}${y}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `A = ${x}, B = ${y}. Сколько из четырёх выражений A ∧ B, A ∨ B, A → B, A ↔ B равны 1?`,
      kk: `A = ${x}, B = ${y}. A ∧ B, A ∨ B, A → B, A ↔ B төрт өрнектің нешеуі 1-ге тең?`,
    },
    answers: [String(count)],
    mode: "number",
    explanation: {
      ru: `Считаем каждое: ${detail}. Единиц получилось: ${count}.`,
      kk: `Әрқайсысын есептейміз: ${detail}. Бірліктер саны: ${count}.`,
    },
    hint: HINT_SPECIAL,
  };
}

/** Значение выражения при заданных значениях (ввод 0 или 1). */
function qEval(rand: Rand, seed: number, level: Level, pool: Expr[]): InputStep {
  const e = pick(rand, pool);
  const env = randEnv(rand);
  const names = varsOf(e);
  const r = ev(e, env);
  return {
    id: `g:${SKILL}:eval:${pool.indexOf(e)}-${envKey(names, env)}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `${envText(names, env)}. Чему равно значение выражения ${show(e)}? Запиши 0 или 1.`,
      kk: `${envText(names, env)}. ${show(e)} өрнегінің мәні неге тең? 0 немесе 1 деп жаз.`,
    },
    answers: [String(r)],
    mode: "number",
    explanation: {
      ru: `Считаем по приоритету: ${stepsOf(e, env)}. Ответ: ${r}.`,
      kk: `Басымдық бойынша есептейміз: ${stepsOf(e, env)}. Жауабы: ${r}.`,
    },
    hint: HINT_PRIORITY,
  };
}

/** Уровень C: по какому набору значений выражение принимает нужное значение (ровно один подходящий вариант). */
function qFind(rand: Rand, seed: number, level: Level): ChoiceStep {
  const target: Bit = bit(rand);
  const order = shuffle(T3, rand);
  let e = order[0];
  let good: Env[] = [];
  let bad: Env[] = [];
  for (const cand of order) {
    const all = envsFor(varsOf(cand));
    const g = all.filter((env) => ev(cand, env) === target);
    const bd = all.filter((env) => ev(cand, env) !== target);
    if (g.length >= 1 && bd.length >= 3) {
      e = cand;
      good = g;
      bad = bd;
      break;
    }
  }
  const names = varsOf(e);
  const right = pick(rand, good);
  const wrongs = pickDistinct(rand, bad, 3);
  const word = (t: Bit) => (t === 1 ? { ru: "истинно", kk: "ақиқат" } : { ru: "ложно", kk: "жалған" });
  const o = mixed(
    rand,
    envText(names, right),
    wrongs.map((w) => ({
      value: envText(names, w),
      why: {
        ru: `При этих значениях выражение ${target === 1 ? "ложно" : "истинно"}: ${stepsOf(e, w)}.`,
        kk: `Осы мәндерде өрнек ${target === 1 ? "жалған" : "ақиқат"}: ${stepsOf(e, w)}.`,
      },
    })),
  );
  return {
    id: `g:${SKILL}:find:${T3.indexOf(e)}-${target}-${envKey(names, right)}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: {
      ru: `При каких значениях ${joinNames(names, "и")} выражение ${show(e)} ${word(target).ru}?`,
      kk: `${joinNames(names, "және")} айнымалыларының қандай мәндерінде ${show(e)} өрнегі ${word(target).kk} болады?`,
    },
    ...o,
    explanation: {
      ru: `Подставим подходящий набор: ${envText(names, right)}. Считаем по приоритету: ${stepsOf(e, right)}. Выражение ${word(target).ru}; в остальных вариантах оно ${target === 1 ? "ложно" : "истинно"}.`,
      kk: `Сәйкес мәндерді қоямыз: ${envText(names, right)}. Басымдық бойынша есептейміз: ${stepsOf(e, right)}. Өрнек ${word(target).kk}; қалған нұсқаларда ол ${target === 1 ? "жалған" : "ақиқат"}.`,
    },
    hint: HINT_FIND,
  };
}

/** Условия вида «A ∧ B = 1», однозначно определяющие A и B. */
const CONDS: { text: string; env: Env }[] = [
  { text: "A ∧ B = 1", env: { A: 1, B: 1 } },
  { text: "A ∨ B = 0", env: { A: 0, B: 0 } },
  { text: "A → B = 0", env: { A: 1, B: 0 } },
  { text: "¬A ∨ ¬B = 0", env: { A: 1, B: 1 } },
  { text: "¬A → B = 0", env: { A: 0, B: 0 } },
  { text: "A ∧ ¬B = 1", env: { A: 1, B: 0 } },
];

/** Уровень C: из условия найти A и B, затем вычислить выражение. Ответ считает код. */
function qCond(rand: Rand, seed: number, level: Level): InputStep {
  const idx = int(rand, 0, CONDS.length - 1);
  const cond = CONDS[idx];
  const gi = int(rand, 0, T2V.length - 1);
  const g = T2V[gi];
  const r = ev(g, cond.env);
  return {
    id: `g:${SKILL}:cond:${idx}-${gi}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `Известно, что ${cond.text}. Чему равно значение выражения ${show(g)}? Запиши 0 или 1.`,
      kk: `${cond.text} екені белгілі. ${show(g)} өрнегінің мәні неге тең? 0 немесе 1 деп жаз.`,
    },
    answers: [String(r)],
    mode: "number",
    explanation: {
      ru: `Из условия получаем ${envText(["A", "B"], cond.env)}. Подставляем: ${stepsOf(g, cond.env)}. Ответ: ${r}.`,
      kk: `Шарттан ${envText(["A", "B"], cond.env)} шығады. Қоямыз: ${stepsOf(g, cond.env)}. Жауабы: ${r}.`,
    },
    hint: HINT_COND,
  };
}

// ---------- Утверждения «верно / неверно» ----------

const STMT_POOL: { level: Level; text: L; value: boolean; why: L; hint: L }[] = [
  {
    level: 1,
    text: { ru: "Конъюнкция A ∧ B истинна, только когда A и B оба истинны", kk: "A ∧ B конъюнкциясы A мен B екеуі де ақиқат болғанда ғана ақиқат" },
    value: true,
    why: { ru: "Конъюнкция (И) равна 1 только при 1 и 1.", kk: "Конъюнкция (ЖӘНЕ) тек 1 және 1 болғанда 1-ге тең." },
    hint: OP_HINT.and,
  },
  {
    level: 1,
    text: { ru: "Дизъюнкция A ∨ B ложна, только когда A и B оба ложны", kk: "A ∨ B дизъюнкциясы A мен B екеуі де жалған болғанда ғана жалған" },
    value: true,
    why: { ru: "Дизъюнкция (ИЛИ) равна 0 только при 0 и 0.", kk: "Дизъюнкция (НЕМЕСЕ) тек 0 және 0 болғанда 0-ге тең." },
    hint: OP_HINT.or,
  },
  {
    level: 1,
    text: { ru: "Импликация A → B ложна при A = 1, B = 0", kk: "A → B импликациясы A = 1, B = 0 болғанда жалған" },
    value: true,
    why: { ru: "Это единственный случай: условие выполнено, а следствие нет.", kk: "Бұл жалғыз жағдай: шарт орындалған, ал салдар орындалмаған." },
    hint: OP_HINT.imp,
  },
  {
    level: 1,
    text: { ru: "Вопрос «Который час?» является высказыванием", kk: "«Сағат неше?» сұрағы пікір болып табылады" },
    value: false,
    why: { ru: "Про вопрос нельзя сказать «истина» или «ложь», значит, это не высказывание.", kk: "Сұрақ туралы «ақиқат» немесе «жалған» деп айту мүмкін емес, демек, бұл пікір емес." },
    hint: HINT_STMT,
  },
  {
    level: 1,
    text: { ru: "«2 + 2 = 5» является высказыванием", kk: "«2 + 2 = 5» пікір болып табылады" },
    value: true,
    why: { ru: "Высказывание может быть ложным: здесь про него можно сказать «ложь».", kk: "Пікір жалған болуы мүмкін: мұнда оның жалған екенін айтуға болады." },
    hint: HINT_STMT,
  },
  {
    level: 1,
    text: same("1 ∨ 1 = 1"),
    value: true,
    why: { ru: "ИЛИ равно 0 только при 0 и 0, а при 1 и 1 получается 1 (а не 2).", kk: "НЕМЕСЕ тек 0 және 0 болғанда 0, ал 1 және 1 болғанда 1 шығады (2 емес)." },
    hint: OP_HINT.or,
  },
  {
    level: 1,
    text: { ru: "¬A = 1 при A = 1", kk: "A = 1 болғанда ¬A = 1" },
    value: false,
    why: { ru: "¬ переворачивает значение: при A = 1 получается ¬A = 0.", kk: "¬ мәнді керісінше өзгертеді: A = 1 болғанда ¬A = 0 шығады." },
    hint: OP_HINT.not,
  },
  {
    level: 2,
    text: { ru: "Эквиваленция A ↔ B истинна, когда A и B одинаковы", kk: "A мен B бірдей болғанда A ↔ B эквиваленциясы ақиқат" },
    value: true,
    why: { ru: "Эквиваленция равна 1 при 00 и 11.", kk: "Эквиваленция 00 және 11 болғанда 1-ге тең." },
    hint: OP_HINT.eqv,
  },
  {
    level: 2,
    text: { ru: "В Python логическому ИЛИ соответствует слово or", kk: "Python-да логикалық НЕМЕСЕ амалына or сөзі сәйкес келеді" },
    value: true,
    why: { ru: "В Python: and — И, or — ИЛИ, not — НЕ.", kk: "Python-да: and — ЖӘНЕ, or — НЕМЕСЕ, not — ЕМЕС." },
    hint: { ru: "В Python логические операции — английские слова: and, or, not. Какое слово какой операции соответствует?", kk: "Python-да логикалық амалдар — ағылшын сөздері: and, or, not. Қай сөз қай амалға сәйкес келеді?" },
  },
  {
    level: 2,
    text: { ru: "В Python логическому НЕ соответствует слово and", kk: "Python-да логикалық ЕМЕС амалына and сөзі сәйкес келеді" },
    value: false,
    why: { ru: "and — это И. Отрицанию НЕ соответствует слово not.", kk: "and — бұл ЖӘНЕ. ЕМЕС терістеуіне not сөзі сәйкес келеді." },
    hint: { ru: "В Python логические операции — английские слова: and, or, not. Какое слово какой операции соответствует?", kk: "Python-да логикалық амалдар — ағылшын сөздері: and, or, not. Қай сөз қай амалға сәйкес келеді?" },
  },
  {
    level: 2,
    text: { ru: "Импликация A → B ложна при A = 0, B = 1", kk: "A → B импликациясы A = 0, B = 1 болғанда жалған" },
    value: false,
    why: { ru: "0 → 1 = 1: если условие не выполнено, обещание не нарушено. Ложна только 1 → 0.", kk: "0 → 1 = 1: шарт орындалмаса, уәде бұзылмайды. Тек 1 → 0 жалған." },
    hint: OP_HINT.imp,
  },
  {
    level: 2,
    text: { ru: "A ∧ B = 1, если хотя бы одно из A, B равно 1", kk: "A мен B екеуінің кемінде біреуі 1-ге тең болса, A ∧ B = 1" },
    value: false,
    why: { ru: "Для ∧ нужны оба значения, равные 1. «Хотя бы одно» — это условие для ∨.", kk: "∧ үшін екі мән де 1 болуы керек. «Кемінде біреуі» — бұл ∨ үшін шарт." },
    hint: OP_HINT.and,
  },
  {
    level: 3,
    text: { ru: "В выражении A ∨ B ∧ C первой выполняется операция ∨", kk: "A ∨ B ∧ C өрнегінде бірінші ∨ амалы орындалады" },
    value: false,
    why: { ru: "∧ старше ∨, поэтому сначала считается B ∧ C.", kk: "∧ амалының басымдығы ∨ амалынан жоғары, сондықтан алдымен B ∧ C есептеледі." },
    hint: HINT_PRIORITY,
  },
  {
    level: 3,
    text: { ru: "В выражении A ∨ B ∧ C первой выполняется операция ∧", kk: "A ∨ B ∧ C өрнегінде бірінші ∧ амалы орындалады" },
    value: true,
    why: { ru: "Приоритет: ¬, ∧, ∨, →, ↔. ∧ выполняется раньше ∨.", kk: "Басымдық: ¬, ∧, ∨, →, ↔. ∧ амалы ∨ амалынан бұрын орындалады." },
    hint: HINT_PRIORITY,
  },
  {
    level: 3,
    text: { ru: "Приоритет операции → выше, чем у операции ∧", kk: "→ амалының басымдығы ∧ амалынан жоғары" },
    value: false,
    why: { ru: "Порядок приоритета: ¬, ∧, ∨, →, ↔. Импликация выполняется позже конъюнкции.", kk: "Басымдық реті: ¬, ∧, ∨, →, ↔. Импликация конъюнкциядан кейін орындалады." },
    hint: HINT_PRIORITY,
  },
  {
    level: 3,
    text: { ru: "Если A → B ложно, то A = 1 и B = 0", kk: "A → B жалған болса, онда A = 1 және B = 0" },
    value: true,
    why: { ru: "Импликация ложна в единственном случае: 1 → 0.", kk: "Импликация жалғыз жағдайда жалған: 1 → 0." },
    hint: HINT_COND,
  },
  {
    level: 3,
    text: { ru: "Если A ∨ B = 0, то A = 0 и B = 0", kk: "A ∨ B = 0 болса, онда A = 0 және B = 0" },
    value: true,
    why: { ru: "ИЛИ равно 0 только при 0 и 0.", kk: "НЕМЕСЕ тек 0 және 0 болғанда 0-ге тең." },
    hint: HINT_COND,
  },
  {
    level: 3,
    text: { ru: "Если A ∧ B = 0, то A = 0 и B = 0", kk: "A ∧ B = 0 болса, онда A = 0 және B = 0" },
    value: false,
    why: { ru: "∧ равно 0, если хотя бы одно значение равно 0: например, при A = 1, B = 0.", kk: "∧ кемінде бір мән 0 болса, 0-ге тең: мысалы, A = 1, B = 0 болғанда." },
    hint: HINT_COND,
  },
];

function stmtByLevel(level: Level): typeof STMT_POOL {
  for (const d of [0, -1, 1, -2, 2]) {
    const found = STMT_POOL.filter((s) => s.level === level + d);
    if (found.length) return found;
  }
  return STMT_POOL;
}

// ---------- Пары ----------

const PAIR_POOL: { level: Level; left: Text; right: Text }[] = [
  { level: 1, left: "¬", right: { ru: "НЕ (инверсия)", kk: "ЕМЕС (инверсия)" } },
  { level: 1, left: "∧", right: { ru: "И (конъюнкция)", kk: "ЖӘНЕ (конъюнкция)" } },
  { level: 1, left: "∨", right: { ru: "ИЛИ (дизъюнкция)", kk: "НЕМЕСЕ (дизъюнкция)" } },
  { level: 1, left: "→", right: { ru: "«если…, то…»", kk: "«егер…, онда…»" } },
  { level: 1, left: "↔", right: { ru: "«тогда и только тогда»", kk: "«сонда және тек сонда ғана»" } },
  { level: 2, left: "not A", right: "¬A" },
  { level: 2, left: "A and B", right: "A ∧ B" },
  { level: 2, left: "A or B", right: "A ∨ B" },
  { level: 2, left: { ru: "логическое умножение", kk: "логикалық көбейту" }, right: { ru: "конъюнкция", kk: "конъюнкция" } },
  { level: 2, left: { ru: "логическое сложение", kk: "логикалық қосу" }, right: { ru: "дизъюнкция", kk: "дизъюнкция" } },
  { level: 3, left: "1 → 0", right: "0" },
  { level: 3, left: { ru: "ложна только при 1 → 0", kk: "тек 1 → 0 болғанда жалған" }, right: { ru: "импликация", kk: "импликация" } },
  { level: 3, left: { ru: "истинна, когда значения одинаковы", kk: "мәндер бірдей болғанда ақиқат" }, right: { ru: "эквиваленция", kk: "эквиваленция" } },
  { level: 3, left: { ru: "порядок: ¬, ∧, ∨, →, ↔", kk: "реті: ¬, ∧, ∨, →, ↔" }, right: { ru: "приоритет операций", kk: "амалдар басымдығы" } },
];

// ---------- Банк навыка ----------

const logicOps: SkillBank = {
  skill: SKILL,
  question(level, seed) {
    const rand = seeded(seed);
    if (level === 1) {
      const kind = pick(rand, ["val", "val", "stmt", "which"] as const);
      if (kind === "stmt") return qStatement(rand, seed, level, false);
      if (kind === "which") return qWhichOp(rand, seed, level);
      return qVal(rand, seed, level);
    }
    if (level === 2) {
      const kind = pick(rand, ["pick", "pick", "count", "eval", "stmtnot"] as const);
      if (kind === "count") return qCount(rand, seed, level);
      if (kind === "eval") return qEval(rand, seed, level, T2);
      if (kind === "stmtnot") return qStatement(rand, seed, level, true);
      return qPick(rand, seed, level);
    }
    const kind = pick(rand, ["find", "find", "cond", "eval"] as const);
    if (kind === "cond") return qCond(rand, seed, level);
    if (kind === "eval") return qEval(rand, seed, level, T3);
    return qFind(rand, seed, level);
  },
  statement(level, seed): Statement {
    const rand = seeded(seed);
    if (rand() < 0.5) {
      const pool = stmtByLevel(level);
      const i = int(rand, 0, pool.length - 1);
      const s = pool[i];
      return { id: `s:${SKILL}:pool:${STMT_POOL.indexOf(s)}`, skill: SKILL, level, text: s.text, value: s.value, explanation: s.why, hint: s.hint };
    }
    if (level === 1) {
      const op = pick(rand, OPS);
      const x = bit(rand);
      const y = bit(rand);
      const r = applyOp(op, x, y);
      const claim: Bit = rand() < 0.5 ? r : ((1 - r) as Bit);
      return {
        id: `s:${SKILL}:val:${x}${op}${y}:${claim}`,
        skill: SKILL,
        level,
        text: same(`${x} ${SYM[op]} ${y} = ${claim}`),
        value: claim === r,
        explanation: OP_RULE[op](x, y, r),
        hint: OP_HINT[op],
      };
    }
    const pool = level === 2 ? T2 : T3;
    const e = pick(rand, pool);
    const env = randEnv(rand);
    const names = varsOf(e);
    const r = ev(e, env);
    const claim: Bit = rand() < 0.5 ? r : ((1 - r) as Bit);
    return {
      id: `s:${SKILL}:expr:${level}-${pool.indexOf(e)}-${envKey(names, env)}:${claim}`,
      skill: SKILL,
      level,
      text: { ru: `При ${envText(names, env)}: ${show(e)} = ${claim}`, kk: `${envText(names, env)} болғанда: ${show(e)} = ${claim}` },
      value: claim === r,
      explanation: {
        ru: `Считаем по приоритету: ${stepsOf(e, env)}. Значит, выражение равно ${r}.`,
        kk: `Басымдық бойынша есептейміз: ${stepsOf(e, env)}. Демек, өрнектің мәні: ${r}.`,
      },
      hint: HINT_PRIORITY,
    };
  },
  pair(level, seed): Pair {
    const rand = seeded(seed);
    let pool = PAIR_POOL.filter((p) => p.level === level);
    if (!pool.length) pool = PAIR_POOL;
    const p = pick(rand, pool);
    return { id: `p:${SKILL}:${PAIR_POOL.indexOf(p)}`, skill: SKILL, level, left: p.left, right: p.right };
  },
  short(level, seed): ShortQuestion {
    const rand = seeded(seed);
    if (level === 1) {
      const op = pick(rand, OPS);
      const x = bit(rand);
      const y = bit(rand);
      const r = applyOp(op, x, y);
      return {
        id: `q:${SKILL}:val:${x}${op}${y}`,
        skill: SKILL,
        level,
        prompt: same(`${x} ${SYM[op]} ${y} = ?`),
        answer: String(r),
        mode: "number",
        explanation: OP_RULE[op](x, y, r),
        hint: OP_HINT[op],
      };
    }
    if (level === 2) {
      const x = bit(rand);
      const y = bit(rand);
      const count = OPS.reduce<number>((s, op) => s + applyOp(op, x, y), 0);
      return {
        id: `q:${SKILL}:count:${x}${y}`,
        skill: SKILL,
        level,
        prompt: {
          ru: `A = ${x}, B = ${y}. Сколько из A ∧ B, A ∨ B, A → B, A ↔ B равны 1?`,
          kk: `A = ${x}, B = ${y}. A ∧ B, A ∨ B, A → B, A ↔ B өрнектерінің нешеуі 1-ге тең?`,
        },
        answer: String(count),
        mode: "number",
        explanation: {
          ru: OPS.map((op) => `${x} ${SYM[op]} ${y} = ${applyOp(op, x, y)}`).join("; ") + `. Единиц: ${count}.`,
          kk: OPS.map((op) => `${x} ${SYM[op]} ${y} = ${applyOp(op, x, y)}`).join("; ") + `. Бірліктер саны: ${count}.`,
        },
        hint: HINT_SPECIAL,
      };
    }
    const idx = int(rand, 0, CONDS.length - 1);
    const cond = CONDS[idx];
    const gi = int(rand, 0, T2V.length - 1);
    const g = T2V[gi];
    const r = ev(g, cond.env);
    return {
      id: `q:${SKILL}:cond:${idx}-${gi}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `Известно, что ${cond.text}. Чему равно ${show(g)}?`,
        kk: `${cond.text} екені белгілі. ${show(g)} неге тең?`,
      },
      answer: String(r),
      mode: "number",
      explanation: {
        ru: `Из условия: ${envText(["A", "B"], cond.env)}. Считаем: ${stepsOf(g, cond.env)}. Ответ: ${r}.`,
        kk: `Шарттан: ${envText(["A", "B"], cond.env)}. Есептейміз: ${stepsOf(g, cond.env)}. Жауабы: ${r}.`,
      },
      hint: HINT_COND,
    };
  },
};

export const BANKS: SkillBank[] = [logicOps];
