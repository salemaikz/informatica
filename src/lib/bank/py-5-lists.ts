import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка py.lists: генератор программ со списками. Результат всегда считает код (мини-интерпретатор ниже
// повторяет логику программы), неверные варианты — типичные ошибки (append в начало, remove по индексу, b = a и т. д.).
// Тексты после переменных чисел — без падежных окончаний: код всегда показывается в сцене.

const SKILL = "py.lists";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });
const fmt = (a: readonly number[]) => `[${a.join(", ")}]`;
const code = (...lines: string[]): Scene => ({ kind: "code", lang: "python", lines });
const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

function randList(rand: Rand, n: number, lo: number, hi: number, unique = false): number[] {
  const out: number[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 1000) {
    const v = int(rand, lo, hi);
    if (unique && out.includes(v)) continue;
    out.push(v);
  }
  return out;
}

const OUT: L = { ru: "Что выведет программа?", kk: "Программа не шығарады?" };
const OUT_NUM: L = { ru: "Что выведет программа? Введи число.", kk: "Программа не шығарады? Санды енгіз." };

// ---------- Варианты ответа ----------

interface Cand {
  value: string;
  why: L;
}

/** Запасные неверные варианты, если кандидатов мало: числа ±1 или перестановки списка. */
function fallback(correct: string): Cand[] {
  if (/^-?\d+$/.test(correct)) {
    const n = Number(correct);
    const why: L = { ru: "Ошибка в счёте на один-два шага: пройди программу по строкам.", kk: "Санауда бір-екі қадамға қателесу: программаны жол-жолымен өткіз." };
    return [n + 1, n - 1, n + 2, n - 2, n * 2].filter((v) => v >= 0).map((v) => ({ value: String(v), why }));
  }
  if (correct.startsWith("[") && correct.length > 2) {
    const items = correct.slice(1, -1).split(", ");
    const lost: L = { ru: "Лишний или потерянный элемент: пройди программу по строкам.", kk: "Артық немесе жоғалған элемент: программаны жол-жолымен өткіз." };
    const order: L = { ru: "Нарушен порядок элементов.", kk: "Элементтер реті бұзылған." };
    return [
      { value: `[${items.slice(1).join(", ")}]`, why: lost },
      { value: `[${items.slice(0, -1).join(", ")}]`, why: lost },
      { value: `[${[...items].reverse().join(", ")}]`, why: order },
      { value: `[${[...items, items[0]].join(", ")}]`, why: lost },
      ...items.map((_, i) => ({
        value: `[${items.map((v, j) => (j === i ? String(Number(v) + 1) : v)).join(", ")}]`,
        why: { ru: "Один из элементов посчитан неверно: пройди программу по строкам.", kk: "Элементтердің бірі қате есептелген: программаны жол-жолымен өткіз." } as L,
      })),
    ];
  }
  return [];
}

/** Собирает варианты: верный + (total − 1) уникальных неверных с whyWrong, всё перемешано. */
function buildOptions(rand: Rand, correct: string, cands: Cand[], total = 4) {
  const seen = new Set<string>([correct]);
  const wrong: Cand[] = [];
  for (const c of [...shuffle(cands, rand), ...fallback(correct)]) {
    if (wrong.length >= total - 1) break;
    if (!c.value || seen.has(c.value)) continue;
    seen.add(c.value);
    wrong.push(c);
  }
  const all = shuffle([{ value: correct, why: null as L | null }, ...wrong], rand);
  return {
    options: all.map((x) => x.value),
    correct: all.findIndex((x) => x.value === correct),
    whyWrong: all.map((x) => x.why),
  };
}

interface QSpec {
  id: string;
  level: Level;
  scene: Scene;
  correct: string;
  cands: Cand[];
  hint: L;
  explanation: L;
  /** true — число можно спросить полем ввода (иначе только выбор). */
  numeric?: boolean;
}

/** Задание «что выведет программа»: выбор из 4; для чисел на уровнях B/C иногда — поле ввода. */
function makeQuestion(rand: Rand, spec: QSpec): QuestionStep {
  const asInput = spec.numeric && rand() < (spec.level === 1 ? 0.3 : 0.55);
  if (asInput) {
    return {
      id: spec.id,
      type: "input",
      skill: SKILL,
      level: spec.level,
      prompt: OUT_NUM,
      scene: spec.scene,
      answers: [spec.correct],
      mode: "number",
      hint: spec.hint,
      explanation: spec.explanation,
    } satisfies InputStep;
  }
  const o = buildOptions(rand, spec.correct, spec.cands);
  return {
    id: spec.id,
    type: "choice",
    skill: SKILL,
    level: spec.level,
    prompt: OUT,
    scene: spec.scene,
    ...o,
    hint: spec.hint,
    explanation: spec.explanation,
  } satisfies ChoiceStep;
}

// ---------- Мини-интерпретатор операций со списком ----------

type Op =
  | { k: "append"; x: number }
  | { k: "insert"; i: number; x: number }
  | { k: "pop" }
  | { k: "pop0" }
  | { k: "remove"; x: number }
  | { k: "set"; i: number; x: number };

const opCode = (op: Op): string => {
  switch (op.k) {
    case "append":
      return `a.append(${op.x})`;
    case "insert":
      return `a.insert(${op.i}, ${op.x})`;
    case "pop":
      return "a.pop()";
    case "pop0":
      return "a.pop(0)";
    case "remove":
      return `a.remove(${op.x})`;
    case "set":
      return `a[${op.i}] = ${op.x}`;
  }
};

function applyOp(a: number[], op: Op): number[] {
  const r = [...a];
  switch (op.k) {
    case "append":
      r.push(op.x);
      break;
    case "insert":
      r.splice(op.i, 0, op.x);
      break;
    case "pop":
      r.pop();
      break;
    case "pop0":
      r.shift();
      break;
    case "remove": {
      const j = r.indexOf(op.x);
      if (j >= 0) r.splice(j, 1);
      break;
    }
    case "set":
      r[op.i] = op.x;
      break;
  }
  return r;
}

/** Типичная ошибка при выполнении операции (что получится, если понять команду неверно). */
function applyWrong(a: number[], op: Op): number[] {
  const r = [...a];
  switch (op.k) {
    case "append":
      return [op.x, ...r];
    case "insert":
      r[op.i] = op.x;
      return r;
    case "pop":
      return r.slice(1);
    case "pop0":
      return r.slice(0, -1);
    case "remove":
      if (op.x < r.length) r.splice(op.x, 1);
      return r;
    case "set":
      r.splice(op.i, 0, op.x);
      return r;
  }
}

const WHY_OP: Record<Op["k"], L> = {
  append: { ru: "append добавляет элемент в конец списка, а не в начало.", kk: "append элементті тізімнің басына емес, соңына қосады." },
  insert: { ru: "insert вставляет новый элемент и сдвигает остальные вправо, а не заменяет старый.", kk: "insert жаңа элементті қойып, қалғандарын оңға жылжытады, ескісін ауыстырмайды." },
  pop: { ru: "pop() без аргумента убирает последний элемент, а не первый.", kk: "аргументсіз pop() бірінші емес, соңғы элементті алып тастайды." },
  pop0: { ru: "pop(0) убирает элемент с индексом 0, то есть первый, а не последний.", kk: "pop(0) 0-индексті, яғни бірінші элементті алып тастайды, соңғысын емес." },
  remove: { ru: "remove(x) убирает по значению x, а не по индексу x.", kk: "remove(x) x индексі бойынша емес, x мәні бойынша алып тастайды." },
  set: { ru: "Присваивание a[i] = x заменяет элемент, а не вставляет новый.", kk: "a[i] = x меншіктеуі элементті ауыстырады, жаңасын қоспайды." },
};

/** Случайная допустимая операция для текущего списка (pop — только если элементов больше одного). */
function randomOp(rand: Rand, cur: number[], allowed: Op["k"][]): Op {
  const kinds = allowed.filter((k) => !(k === "pop" || k === "pop0") || cur.length > 1).filter((k) => k !== "remove" || cur.length > 1);
  const k = pick(rand, kinds);
  const x = int(rand, 1, 9);
  switch (k) {
    case "append":
      return { k, x };
    case "insert":
      return { k, i: int(rand, 0, cur.length), x };
    case "set":
      return { k, i: int(rand, 0, cur.length - 1), x };
    case "remove":
      return { k, x: pick(rand, cur) };
    default:
      return { k } as Op;
  }
}

// ---------- Уровень A ----------

/** a[k] и отрицательные индексы. */
function genGet(rand: Rand, seed: number): QuestionStep {
  const n = int(rand, 4, 6);
  const a = randList(rand, n, 10, 99, true);
  const neg = rand() < 0.4;
  const k = neg ? -int(rand, 1, 3) : int(rand, 1, n - 2);
  const idx = neg ? n + k : k;
  const value = a[idx];
  const cands: Cand[] = neg
    ? [
        { value: String(a[-k - 1]), why: { ru: "Отрицательный индекс считается с конца: a[-1] — последний элемент, а не первый.", kk: "Теріс индекс соңынан санайды: a[-1] — бірінші емес, соңғы элемент." } },
        { value: String(a[idx - 1]), why: { ru: "Ошибка на один элемент: a[-1] — последний, a[-2] — предпоследний, и так далее.", kk: "Бір элементке қателесу: a[-1] — соңғы, a[-2] — соңғысының алдындағысы, т.с.с." } },
        { value: String(a[idx + 1]), why: { ru: "Ошибка на один элемент: a[-1] — последний, a[-2] — предпоследний, и так далее.", kk: "Бір элементке қателесу: a[-1] — соңғы, a[-2] — соңғысының алдындағысы, т.с.с." } },
        { value: String(a[0]), why: { ru: "Первый элемент — это a[0]. Отрицательный индекс считается с конца.", kk: "Бірінші элемент — a[0]. Теріс индекс соңынан санайды." } },
      ]
    : [
        { value: String(a[k - 1]), why: { ru: "Нумерация идёт с нуля: a[1] — второй элемент, а не первый.", kk: "Нөмірлеу нөлден басталады: a[1] — бірінші емес, екінші элемент." } },
        { value: String(a[k + 1]), why: { ru: "Ошибка на один элемент вправо: проверь, с какого индекса начинается счёт.", kk: "Оңға қарай бір элементке қателесу: санау қай индекстен басталатынын тексер." } },
        { value: String(k), why: { ru: "Это сам индекс, а нужно значение элемента под этим индексом.", kk: "Бұл индекстің өзі, ал керегі — сол индекстегі элементтің мәні." } },
        { value: String(a[n - 1]), why: { ru: "Это последний элемент, а в программе указан другой индекс.", kk: "Бұл — соңғы элемент, ал программада басқа индекс көрсетілген." } },
      ];
  const table = a.map((v, i) => `a[${i}] = ${v}`).join(", ");
  return makeQuestion(rand, {
    id: `g:${SKILL}:get:${a.join("-")}~${k}:${seed}`,
    level: 1,
    scene: code(`a = ${fmt(a)}`, `print(a[${k}])`),
    correct: String(value),
    cands,
    numeric: true,
    hint: { ru: "Индексы идут с нуля. Выпиши элементы с номерами: a[0], a[1], … — и найди нужный.", kk: "Индекстер нөлден басталады. Элементтерді нөмірімен жаз: a[0], a[1], … — сосын керегін тап." },
    explanation: {
      ru: `Индексы идут с нуля: ${table}.${neg ? " Отрицательный индекс считается с конца: a[-1] — последний элемент." : ""} Значит, a[${k}] = ${value}.`,
      kk: `Индекстер нөлден басталады: ${table}.${neg ? " Теріс индекс соңынан санайды: a[-1] — соңғы элемент." : ""} Демек, a[${k}] = ${value}.`,
    },
  });
}

/** Длина списка после нескольких изменений. */
function genLen(rand: Rand, seed: number): QuestionStep {
  const a = randList(rand, int(rand, 3, 5), 1, 9);
  const ops: Op[] = [];
  let cur = a;
  const count = int(rand, 2, 3);
  for (let i = 0; i < count; i++) {
    const op = randomOp(rand, cur, ["append", "insert", "pop"]);
    ops.push(op);
    cur = applyOp(cur, op);
  }
  const adds = ops.filter((o) => o.k === "append" || o.k === "insert").length;
  const pops = ops.length - adds;
  const answer = cur.length;
  const trail = ops.map((o, i) => `${opCode(o)} → ${fmt(ops.slice(0, i + 1).reduce((acc, op2) => applyOp(acc, op2), a))}`).join("; ");
  return makeQuestion(rand, {
    id: `g:${SKILL}:len:${a.join("-")}-${ops.map((o) => o.k).join("-")}:${seed}`,
    level: 1,
    scene: code(`a = ${fmt(a)}`, ...ops.map(opCode), "print(len(a))"),
    correct: String(answer),
    numeric: true,
    cands: [
      { value: String(a.length), why: { ru: "Это длина исходного списка: изменения списка не учтены.", kk: "Бұл бастапқы тізімнің ұзындығы: тізімнің өзгерістері ескерілмеген." } },
      { value: String(a.length + ops.length), why: { ru: "Все команды посчитаны как добавление, но pop() убирает элемент.", kk: "Барлық команда қосу деп есептелген, бірақ pop() элементті алып тастайды." } },
      { value: String(a.length + adds), why: { ru: "Не учтено, что pop() уменьшает список.", kk: "pop() тізімді қысқартатыны ескерілмеген." } },
      { value: String(a.length - pops), why: { ru: "Не учтено, что append и insert увеличивают список.", kk: "append және insert тізімді ұлғайтатыны ескерілмеген." } },
    ],
    hint: { ru: "Следи за длиной: append и insert добавляют по одному элементу, pop() убирает один.", kk: "Ұзындықты қадағала: append және insert біреуден қосады, pop() біреуін алып тастайды." },
    explanation: {
      ru: `Список после каждой команды: ${fmt(a)}; ${trail}. В конце ${answer} элементов, len(a) = ${answer}.`,
      kk: `Әр командадан кейінгі тізім: ${fmt(a)}; ${trail}. Соңында ${answer} элемент бар, len(a) = ${answer}.`,
    },
  });
}

/** sum / min / max. */
function genAgg(rand: Rand, seed: number): QuestionStep {
  const a = randList(rand, int(rand, 4, 5), 1, 20, true);
  const kind = pick(rand, ["sum", "maxmin", "min"] as const);
  const mx = Math.max(...a);
  const mn = Math.min(...a);
  const first = a[0];
  const base = { level: 1 as Level, numeric: true };
  if (kind === "sum") {
    return makeQuestion(rand, {
      ...base,
      id: `g:${SKILL}:agg-sum:${a.join("-")}:${seed}`,
      scene: code(`a = ${fmt(a)}`, "print(sum(a))"),
      correct: String(sum(a)),
      cands: [
        { value: String(mx), why: { ru: "Это max(a), а нужна сумма всех элементов sum(a).", kk: "Бұл max(a), ал керегі — барлық элементтердің қосындысы sum(a)." } },
        { value: String(sum(a) - first), why: { ru: "Один элемент потерян при сложении: sum складывает все.", kk: "Қосқанда бір элемент жоғалған: sum барлығын қосады." } },
        { value: String(a.length), why: { ru: "Это число элементов len(a), а не их сумма.", kk: "Бұл элементтер саны len(a), қосындысы емес." } },
      ],
      hint: { ru: "sum(a) складывает все элементы списка. Сложи их по очереди.", kk: "sum(a) тізімнің барлық элементін қосады. Оларды кезекпен қос." },
      explanation: { ru: `sum(a) = ${a.join(" + ")} = ${sum(a)}.`, kk: `sum(a) = ${a.join(" + ")} = ${sum(a)}.` },
    });
  }
  if (kind === "maxmin") {
    return makeQuestion(rand, {
      ...base,
      id: `g:${SKILL}:agg-maxmin:${a.join("-")}:${seed}`,
      scene: code(`a = ${fmt(a)}`, "print(max(a) - min(a))"),
      correct: String(mx - mn),
      cands: [
        { value: String(mx + mn), why: { ru: "В программе разность, а не сумма: max(a) - min(a).", kk: "Программада қосынды емес, айырма: max(a) - min(a)." } },
        { value: String(mx), why: { ru: "Забыто вычитание: из максимума нужно вычесть минимум.", kk: "Азайту ұмытылған: максимумнан минимумды алу керек." } },
        { value: String(mn), why: { ru: "Это min(a); нужна разность максимума и минимума.", kk: "Бұл min(a); керегі — максимум мен минимумның айырмасы." } },
      ],
      hint: { ru: "Найди в списке наибольшее и наименьшее число, затем вычти.", kk: "Тізімдегі ең үлкен және ең кіші санды тап, сосын азайт." },
      explanation: { ru: `max(a) = ${mx}, min(a) = ${mn}. Разность: ${mx} - ${mn} = ${mx - mn}.`, kk: `max(a) = ${mx}, min(a) = ${mn}. Айырмасы: ${mx} - ${mn} = ${mx - mn}.` },
    });
  }
  return makeQuestion(rand, {
    ...base,
    id: `g:${SKILL}:agg-min:${a.join("-")}:${seed}`,
    scene: code(`a = ${fmt(a)}`, "print(min(a))"),
    correct: String(mn),
    cands: [
      { value: String(first), why: { ru: "Это первый элемент a[0]. Он не обязательно наименьший.", kk: "Бұл — бірінші элемент a[0]. Ол міндетті түрде ең кіші емес." } },
      { value: String(mx), why: { ru: "Это max(a), а нужен минимум.", kk: "Бұл max(a), ал керегі — минимум." } },
      { value: String(a[a.length - 1]), why: { ru: "Это последний элемент a[-1]. Он не обязательно наименьший.", kk: "Бұл — соңғы элемент a[-1]. Ол міндетті түрде ең кіші емес." } },
    ],
    hint: { ru: "min(a) — наименьшее значение во всём списке, а не первое по порядку.", kk: "min(a) — бүкіл тізімдегі ең кіші мән, реті бойынша бірінші емес." },
    explanation: { ru: `Из чисел ${a.join(", ")} наименьшее — ${mn}, значит min(a) = ${mn}.`, kk: `${a.join(", ")} сандарының ішіндегі ең кішісі — ${mn}, демек min(a) = ${mn}.` },
  });
}

/** Подсчёт по условию в цикле. */
function genCount(rand: Rand, level: Level, seed: number): QuestionStep {
  const lvl = level;
  if (lvl === 3) {
    const a = randList(rand, int(rand, 5, 7), 1, 9);
    let asc = 0;
    for (let i = 1; i < a.length; i++) if (a[i] > a[i - 1]) asc++;
    const desc = a.filter((_, i) => i > 0 && a[i] < a[i - 1]).length;
    return makeQuestion(rand, {
      id: `g:${SKILL}:count-asc:${a.join("-")}:${seed}`,
      level: 3,
      numeric: true,
      scene: code(`a = ${fmt(a)}`, "c = 0", "for i in range(1, len(a)):", "    if a[i] > a[i - 1]:", "        c += 1", "print(c)"),
      correct: String(asc),
      cands: [
        { value: String(desc), why: { ru: "Посчитаны пары, где элемент меньше предыдущего, а нужны те, где больше.", kk: "Элемент алдыңғысынан кіші жұптар есептелген, ал керегі — үлкендері." } },
        { value: String(a.length - 1), why: { ru: "Посчитаны все пары соседей. Но c растёт только при a[i] > a[i - 1].", kk: "Көрші жұптардың бәрі есептелген. Бірақ c тек a[i] > a[i - 1] болғанда артады." } },
        { value: String(a.length), why: { ru: "Это число элементов; цикл идёт с индекса 1, пар на одну меньше, и считаются не все.", kk: "Бұл элементтер саны; цикл 1-индекстен басталады, жұп біреуге аз, әрі бәрі есептелмейді." } },
      ],
      hint: { ru: "Цикл сравнивает каждый элемент с предыдущим. Для каждой пары соседей запиши, верно ли a[i] > a[i - 1].", kk: "Цикл әр элементті алдыңғысымен салыстырады. Көрші жұптардың әрқайсысы үшін a[i] > a[i - 1] орындала ма, жаз." },
      explanation: {
        ru: `Сравниваем соседей: ${a.slice(1).map((v, i) => `${a[i]} → ${v}: ${v > a[i] ? "больше, c растёт" : "не больше"}`).join("; ")}. Итого c = ${asc}.`,
        kk: `Көршілерді салыстырамыз: ${a.slice(1).map((v, i) => `${a[i]} → ${v}: ${v > a[i] ? "үлкен, c артады" : "үлкен емес"}`).join("; ")}. Барлығы c = ${asc}.`,
      },
    });
  }
  if (lvl === 2) {
    const m = pick(rand, [2, 3, 5]);
    const a = randList(rand, int(rand, 5, 7), 1, 30);
    const mult = a.filter((x) => x % m === 0);
    return makeQuestion(rand, {
      id: `g:${SKILL}:count-mod:${a.join("-")}~${m}:${seed}`,
      level: 2,
      numeric: true,
      scene: code(`a = ${fmt(a)}`, "c = 0", "for x in a:", `    if x % ${m} == 0:`, "        c += 1", "print(c)"),
      correct: String(mult.length),
      cands: [
        { value: String(a.length - mult.length), why: { ru: "Посчитаны числа, которые НЕ делятся нацело, а условие x % m == 0 выбирает делящиеся.", kk: "Бөлінбейтін сандар есептелген, ал x % m == 0 шарты бөлінетіндерін таңдайды." } },
        { value: String(sum(mult)), why: { ru: "Это сумма подходящих чисел, а c считает их количество (c += 1).", kk: "Бұл сәйкес сандардың қосындысы, ал c олардың санын есептейді (c += 1)." } },
        { value: String(a.length), why: { ru: "Посчитаны все элементы, но c растёт только когда условие верно.", kk: "Барлық элемент есептелген, бірақ c шарт орындалғанда ғана артады." } },
      ],
      hint: { ru: "x % m == 0 верно, когда x делится на m без остатка. Отметь такие числа в списке и посчитай их.", kk: "x % m == 0 x саны m санына қалдықсыз бөлінгенде орындалады. Тізімдегі осындай сандарды белгілеп, санап шық." },
      explanation: {
        ru: `Условие x % ${m} == 0 верно для чисел: ${mult.length ? mult.join(", ") : "таких нет"}. Их ${mult.length}, значит c = ${mult.length}.`,
        kk: `x % ${m} == 0 шарты мына сандар үшін орындалады: ${mult.length ? mult.join(", ") : "ондайлар жоқ"}. Олардың саны ${mult.length}, демек c = ${mult.length}.`,
      },
    });
  }
  // A: x > t, причём один элемент равен порогу (ловушка строгого неравенства).
  const a = randList(rand, int(rand, 5, 6), 1, 30, true);
  const t = pick(rand, a);
  const gt = a.filter((x) => x > t).length;
  const ge = a.filter((x) => x >= t).length;
  const lt = a.filter((x) => x < t).length;
  return makeQuestion(rand, {
    id: `g:${SKILL}:count-gt:${a.join("-")}~${t}:${seed}`,
    level: 1,
    numeric: true,
    scene: code(`a = ${fmt(a)}`, "c = 0", "for x in a:", `    if x > ${t}:`, "        c += 1", "print(c)"),
    correct: String(gt),
    cands: [
      { value: String(ge), why: { ru: "Условие строгое: x > t не включает x = t. Равный элемент не считается.", kk: "Шарт қатаң: x > t шарты x = t мәнін қоспайды. Тең элемент есептелмейді." } },
      { value: String(lt), why: { ru: "Посчитаны элементы меньше порога, а условие выбирает большие.", kk: "Шектен кіші элементтер есептелген, ал шарт үлкендерін таңдайды." } },
      { value: String(a.length), why: { ru: "Посчитаны все элементы, но c растёт только когда условие верно.", kk: "Барлық элемент есептелген, бірақ c шарт орындалғанда ғана артады." } },
    ],
    hint: { ru: "Для каждого x проверь x > порога. Равное порогу число условие не выполняет.", kk: "Әр x үшін x > шек екенін тексер. Шекке тең сан шартты орындамайды." },
    explanation: {
      ru: `Порог ${t}. Больше него: ${a.filter((x) => x > t).join(", ") || "ничего"}. Число ${t} не больше самого себя, поэтому не считается. c = ${gt}.`,
      kk: `Шек ${t}. Одан үлкендері: ${a.filter((x) => x > t).join(", ") || "ештеңе"}. ${t} саны өзінен үлкен емес, сондықтан есептелмейді. c = ${gt}.`,
    },
  });
}

// ---------- Операции: трассировка ----------

function genTrace(rand: Rand, level: Level, seed: number): QuestionStep {
  const count = level === 1 ? 1 : level === 2 ? 3 : 4;
  const a = randList(rand, int(rand, 3, 4), 1, 9);
  const kinds: Op["k"][] = level === 3 ? ["append", "insert", "pop", "pop0", "remove", "set"] : ["append", "insert", "pop", "remove", "set"];
  const ops: Op[] = [];
  let cur = a;
  for (let i = 0; i < count; i++) {
    const op = randomOp(rand, cur, kinds);
    ops.push(op);
    cur = applyOp(cur, op);
  }
  const trail: string[] = [];
  let acc = a;
  for (const op of ops) {
    acc = applyOp(acc, op);
    trail.push(`${opCode(op)} → ${fmt(acc)}`);
  }
  const cands: Cand[] = ops.map((op, j) => {
    let w = a;
    ops.forEach((o, i) => {
      w = i === j ? applyWrong(w, o) : applyOp(w, o);
    });
    return { value: fmt(w), why: WHY_OP[op.k] };
  });
  return makeQuestion(rand, {
    id: `g:${SKILL}:trace:${a.join("-")}-${ops.map((o) => o.k).join("-")}-${ops.map((o) => ("x" in o ? o.x : "i" in o ? o.i : "")).join("")}:${seed}`,
    level,
    scene: code(`a = ${fmt(a)}`, ...ops.map(opCode), "print(a)"),
    correct: fmt(cur),
    cands,
    hint: { ru: "Выписывай список после каждой строки. Помни: append — в конец, insert(i, x) — на место i, pop() — последний, remove(x) — по значению.", kk: "Әр жолдан кейін тізімді жаз. Есте сақта: append — соңына, insert(i, x) — i орнына, pop() — соңғысын, remove(x) — мәні бойынша." },
    explanation: {
      ru: `Список после каждой строки: ${fmt(a)}; ${trail.join("; ")}. Ответ: ${fmt(cur)}.`,
      kk: `Әр жолдан кейінгі тізім: ${fmt(a)}; ${trail.join("; ")}. Жауабы: ${fmt(cur)}.`,
    },
  });
}

// ---------- Уровень B ----------

/** sort / sorted / reverse: что возвращают и что меняют. */
function genSortNone(rand: Rand, seed: number): QuestionStep {
  const a = randList(rand, int(rand, 3, 4), 1, 9, true);
  const sorted = [...a].sort((x, y) => x - y);
  if (sorted.every((v, i) => v === a[i])) return genSortNone(rand, seed + 1);
  const rev = [...a].reverse();
  const kind = pick(rand, ["sort-none", "sorted-keep", "sort-print", "reverse-none", "reverse-print"] as const);
  let lines: string[];
  let correct: string;
  switch (kind) {
    case "sort-none":
      lines = [`a = ${fmt(a)}`, "b = a.sort()", "print(b)"];
      correct = "None";
      break;
    case "sorted-keep":
      lines = [`a = ${fmt(a)}`, "b = sorted(a)", "print(a)"];
      correct = fmt(a);
      break;
    case "sort-print":
      lines = [`a = ${fmt(a)}`, "a.sort()", "print(a)"];
      correct = fmt(sorted);
      break;
    case "reverse-none":
      lines = [`a = ${fmt(a)}`, "b = a.reverse()", "print(b)"];
      correct = "None";
      break;
    default:
      lines = [`a = ${fmt(a)}`, "a.reverse()", "print(a)"];
      correct = fmt(rev);
      break;
  }
  const mName = kind.startsWith("sort") ? "sort()" : "reverse()";
  const wNoneRet: L = { ru: `Метод ${mName} возвращает None, а не список: в b попадает None.`, kk: `${mName} әдісі тізімді емес, None қайтарады: b ішіне None түседі.` };
  const wNoneShown: L = { ru: "None возвращает сам метод, но здесь выводится не его результат, а список a.", kk: "None-ды әдістің өзі қайтарады, бірақ мұнда оның нәтижесі емес, a тізімі шығарылады." };
  const wSortedKeep: L = { ru: "sorted(a) отдаёт новый список в b, а сам a остаётся прежним.", kk: "sorted(a) жаңа тізімді b ішіне береді, ал a өзгермей қалады." };
  const wChanged: L = { ru: "Метод изменил a на месте, поэтому список уже не прежний.", kk: "Әдіс a тізімін орнында өзгертті, сондықтан тізім бұрынғы күйінде емес." };
  const wNotSorted: L = { ru: "reverse() не сортирует, а переворачивает порядок элементов.", kk: "reverse() сұрыптамайды, элементтер ретін төңкереді." };
  const wNotReversed: L = { ru: "sort() упорядочивает по возрастанию, а не переворачивает порядок.", kk: "sort() өсу ретімен реттейді, ретін төңкермейді." };
  let cands: Cand[];
  if (kind === "sort-none" || kind === "reverse-none") {
    cands = [
      { value: fmt(sorted), why: wNoneRet },
      { value: fmt(a), why: wNoneRet },
      { value: fmt(rev), why: wNoneRet },
    ];
  } else if (kind === "sorted-keep") {
    cands = [
      { value: fmt(sorted), why: wSortedKeep },
      { value: "None", why: wNoneShown },
      { value: fmt(rev), why: wSortedKeep },
    ];
  } else if (kind === "sort-print") {
    cands = [
      { value: "None", why: wNoneShown },
      { value: fmt(a), why: wChanged },
      { value: fmt(rev), why: wNotReversed },
    ];
  } else {
    cands = [
      { value: "None", why: wNoneShown },
      { value: fmt(a), why: wChanged },
      { value: fmt(sorted), why: wNotSorted },
    ];
  }
  const explain: Record<typeof kind, L> = {
    "sort-none": { ru: `a.sort() сортирует сам список a и возвращает None. Поэтому b = None, и print(b) выводит None.`, kk: `a.sort() a тізімінің өзін сұрыптайды және None қайтарады. Сондықтан b = None, ал print(b) None шығарады.` },
    "sorted-keep": { ru: `sorted(a) возвращает новый отсортированный список в b, а a не меняется. print(a) выводит ${fmt(a)}.`, kk: `sorted(a) b ішіне жаңа сұрыпталған тізім қайтарады, ал a өзгермейді. print(a) ${fmt(a)} шығарады.` },
    "sort-print": { ru: `a.sort() сортирует a на месте по возрастанию: ${fmt(sorted)}. print(a) выводит уже отсортированный список.`, kk: `a.sort() a тізімін орнында өсу ретімен сұрыптайды: ${fmt(sorted)}. print(a) сұрыпталған тізімді шығарады.` },
    "reverse-none": { ru: `a.reverse() разворачивает a на месте и возвращает None. Поэтому b = None.`, kk: `a.reverse() a тізімін орнында төңкеріп, None қайтарады. Сондықтан b = None.` },
    "reverse-print": { ru: `a.reverse() разворачивает список на месте: ${fmt(rev)}.`, kk: `a.reverse() тізімді орнында төңкереді: ${fmt(rev)}.` },
  };
  return makeQuestion(rand, {
    id: `g:${SKILL}:${kind}:${a.join("-")}:${seed}`,
    level: 2,
    scene: code(...lines),
    correct,
    cands,
    hint: { ru: "Спроси себя: этот метод меняет сам список или возвращает новый? Что он возвращает, если меняет на месте?", kk: "Өзіңе сұра: бұл әдіс тізімнің өзін өзгертеді ме, әлде жаңасын қайтара ма? Орнында өзгертсе, ол не қайтарады?" },
    explanation: explain[kind],
  });
}

/** Индекс максимума (первого из равных). */
function genMaxIdx(rand: Rand, seed: number): QuestionStep {
  const n = int(rand, 5, 6);
  const a = randList(rand, n, 1, 8);
  if (rand() < 0.6) {
    // Гарантируем повтор максимума — тогда видна разница между > и >=.
    const mx = Math.max(...a);
    const j = int(rand, 0, n - 1);
    if (a[j] !== mx) a[j] = mx;
  }
  const mx = Math.max(...a);
  const first = a.indexOf(mx);
  const last = a.lastIndexOf(mx);
  return makeQuestion(rand, {
    id: `g:${SKILL}:maxidx:${a.join("-")}:${seed}`,
    level: 2,
    numeric: true,
    scene: code(`a = ${fmt(a)}`, "m = a[0]", "k = 0", "for i in range(len(a)):", "    if a[i] > m:", "        m = a[i]", "        k = i", "print(k)"),
    correct: String(first),
    cands: [
      { value: String(last), why: { ru: "Так было бы при условии a[i] >= m. При строгом > равный максимум не запоминается.", kk: "Бұл a[i] >= m шарты болғанда шығар еді. Қатаң > болғанда тең максимум есте сақталмайды." } },
      { value: String(mx), why: { ru: "Это значение максимума m, а выводится его индекс k.", kk: "Бұл m максимумының мәні, ал оның k индексі шығарылады." } },
      { value: String(n - 1), why: { ru: "Это последний индекс. Он совпадает с k, только если максимум стоит последним.", kk: "Бұл — соңғы индекс. Ол максимум соңында тұрғанда ғана k-ға тең." } },
      { value: String(a.indexOf(Math.min(...a))), why: { ru: "Это индекс наименьшего элемента, а программа ищет наибольший.", kk: "Бұл ең кіші элементтің индексі, ал программа ең үлкенін іздейді." } },
    ],
    hint: { ru: "Пройди цикл: m запоминает наибольшее значение, k — индекс, где оно впервые найдено. Равное значение условие > не обновит.", kk: "Циклді өткіз: m ең үлкен мәнді, k оның алғаш табылған индексін есте сақтайды. Тең мәнді > шарты жаңартпайды." },
    explanation: {
      ru: `Наибольший элемент — ${mx}. Он впервые встречается на индексе ${first}. Условие a[i] > m строгое, поэтому более поздние равные значения k не меняют. Ответ: ${first}.`,
      kk: `Ең үлкен элемент — ${mx}. Ол алғаш ${first}-индексте кездеседі. a[i] > m шарты қатаң, сондықтан кейінгі тең мәндер k-ны өзгертпейді. Жауабы: ${first}.`,
    },
  });
}

/** Цикл по значениям не меняет список; цикл по индексам — меняет. */
function genLoopAssign(rand: Rand, seed: number): QuestionStep {
  const a = randList(rand, int(rand, 3, 4), 1, 9);
  const k = int(rand, 2, 5);
  const byIndex = rand() < 0.5;
  const plus = rand() < 0.4;
  const expr = (v: string) => (plus ? `${v} + ${k}` : `${v} * ${k}`);
  const mapped = a.map((v) => (plus ? v + k : v * k));
  const lines = byIndex
    ? [`a = ${fmt(a)}`, "for i in range(len(a)):", `    a[i] = ${expr("a[i]")}`, "print(a)"]
    : [`a = ${fmt(a)}`, "for x in a:", `    x = ${expr("x")}`, "print(a)"];
  const correct = byIndex ? fmt(mapped) : fmt(a);
  const wrongKeep: Cand = { value: fmt(a), why: { ru: "Здесь элементы меняются по индексу: a[i] = …, поэтому список меняется.", kk: "Мұнда элементтер индекс бойынша өзгереді: a[i] = …, сондықтан тізім өзгереді." } };
  const wrongAll: Cand = { value: fmt(mapped), why: { ru: "В цикле for x in a присваивание x = … меняет только переменную x, но не элемент списка.", kk: "for x in a циклінде x = … меншіктеуі тек x айнымалысын өзгертеді, тізім элементін емес." } };
  const first = [...a];
  first[0] = mapped[0];
  const lastOnly = [...a];
  lastOnly[a.length - 1] = mapped[a.length - 1];
  const cands: Cand[] = byIndex
    ? [wrongKeep, { value: fmt(first), why: { ru: "Цикл проходит все индексы, а не только нулевой.", kk: "Цикл тек нөлдік емес, барлық индекстерді өтеді." } }, { value: fmt(lastOnly), why: { ru: "Цикл проходит все индексы, а не только последний.", kk: "Цикл тек соңғысын емес, барлық индекстерді өтеді." } }]
    : [wrongAll, { value: fmt(lastOnly), why: { ru: "Список не меняется вовсе: x — копия значения, а не сам элемент.", kk: "Тізім мүлде өзгермейді: x — мәннің көшірмесі, элементтің өзі емес." } }, { value: fmt(first), why: { ru: "Список не меняется вовсе: x — копия значения, а не сам элемент.", kk: "Тізім мүлде өзгермейді: x — мәннің көшірмесі, элементтің өзі емес." } }];
  return makeQuestion(rand, {
    id: `g:${SKILL}:loop-${byIndex ? "idx" : "val"}:${a.join("-")}~${plus ? "p" : "m"}${k}:${seed}`,
    level: 2,
    scene: code(...lines),
    correct,
    cands,
    hint: { ru: "Спроси себя: в цикле меняется элемент списка a[i] или только переменная x?", kk: "Өзіңе сұра: циклде тізімнің a[i] элементі өзгере ме, әлде тек x айнымалысы ма?" },
    explanation: byIndex
      ? { ru: `В цикле по индексам a[i] = ${expr("a[i]")} записывает новое значение прямо в список. Каждый элемент меняется: ${fmt(mapped)}.`, kk: `Индекстер бойынша циклде a[i] = ${expr("a[i]")} жаңа мәнді тізімнің өзіне жазады. Әр элемент өзгереді: ${fmt(mapped)}.` }
      : { ru: `В цикле for x in a переменная x — лишь копия очередного значения. Присваивание x = ${expr("x")} меняет x, но не список a. Список остаётся ${fmt(a)}.`, kk: `for x in a циклінде x айнымалысы — кезекті мәннің көшірмесі ғана. x = ${expr("x")} меншіктеуі x-ті өзгертеді, a тізімін емес. Тізім ${fmt(a)} күйінде қалады.` },
  });
}

/** Срезы. */
function genSlice(rand: Rand, seed: number): QuestionStep {
  const n = int(rand, 6, 7);
  const a = randList(rand, n, 1, 9, true);
  const kind = pick(rand, ["mid", "head", "tail"] as const);
  let expr: string;
  let from: number;
  let to: number;
  if (kind === "mid") {
    from = int(rand, 1, 2);
    to = from + int(rand, 2, 3);
    expr = `a[${from}:${to}]`;
  } else if (kind === "head") {
    from = 0;
    to = int(rand, 2, 4);
    expr = `a[:${to}]`;
  } else {
    const k = int(rand, 2, 3);
    from = n - k;
    to = n;
    expr = `a[-${k}:]`;
  }
  const res = a.slice(from, to);
  const cands: Cand[] = [
    { value: fmt(a.slice(from, to + 1)), why: { ru: "Конец среза не входит: a[i:j] берёт элементы до индекса j - 1.", kk: "Тілімнің соңы кірмейді: a[i:j] j - 1 индексіне дейінгі элементтерді алады." } },
    { value: fmt(a.slice(Math.max(0, from - 1), to - 1)), why: { ru: "Сдвиг на один элемент: проверь, что индексы идут с нуля.", kk: "Бір элементке жылжу: индекстер нөлден басталатынын тексер." } },
    { value: fmt(a.slice(Math.max(0, from - 1), to)), why: { ru: "Начало среза включается: a[i:j] начинается именно с индекса i.", kk: "Тілімнің басы кіреді: a[i:j] дәл i индексінен басталады." } },
    { value: fmt(a.slice(from, to - 1)), why: { ru: "Потерян последний элемент среза: конец j не входит, но элемент j - 1 входит.", kk: "Тілімнің соңғы элементі жоғалған: j соңы кірмейді, бірақ j - 1 элементі кіреді." } },
  ];
  return makeQuestion(rand, {
    id: `g:${SKILL}:slice:${a.join("-")}~${kind}${from}${to}:${seed}`,
    level: 2,
    scene: code(`a = ${fmt(a)}`, `print(${expr})`),
    correct: fmt(res),
    cands,
    hint: { ru: "Срез берёт элементы от начального индекса до конечного, но конечный не включает. Для a[-k:] — последние k элементов.", kk: "Тілім бастапқы индекстен соңғы индекске дейінгі элементтерді алады, бірақ соңғысы кірмейді. a[-k:] — соңғы k элемент." },
    explanation: {
      ru: `Индексы: ${a.map((v, i) => `${i}: ${v}`).join(", ")}. ${expr} берёт элементы с индексом от ${from} до ${to - 1} включительно: ${fmt(res)}.`,
      kk: `Индекстер: ${a.map((v, i) => `${i}: ${v}`).join(", ")}. ${expr} ${from}-ден ${to - 1}-ге дейінгі (қоса алғанда) индексті элементтерді алады: ${fmt(res)}.`,
    },
  });
}

/** Генератор списка. */
function genCompr(rand: Rand, seed: number): QuestionStep {
  const a = randList(rand, int(rand, 5, 6), 1, 12, true);
  const t = pick(rand, a);
  const k = int(rand, 2, 3);
  const res = a.filter((x) => x > t).map((x) => x * k);
  if (!res.length) return genCompr(rand, seed + 1);
  const cands: Cand[] = [
    { value: fmt(a.map((x) => x * k)), why: { ru: "Условие if пропущено: в список попали все элементы, а не только большие.", kk: "if шарты ескерілмеген: тізімге үлкендері ғана емес, барлық элемент түскен." } },
    { value: fmt(a.filter((x) => x > t)), why: { ru: "Забыто умножение: в списке должны лежать значения x * k, а не x.", kk: "Көбейту ұмытылған: тізімде x емес, x * k мәндері болуы керек." } },
    { value: fmt(a.filter((x) => x <= t).map((x) => x * k)), why: { ru: "Условие перевёрнуто: нужны элементы больше порога, а выбраны не большие.", kk: "Шарт керісінше алынған: шектен үлкен элементтер керек, ал үлкен еместері таңдалған." } },
    { value: fmt(a.filter((x) => x >= t).map((x) => x * k)), why: { ru: "Условие строгое: x > t не включает x = t.", kk: "Шарт қатаң: x > t шарты x = t мәнін қоспайды." } },
  ];
  return makeQuestion(rand, {
    id: `g:${SKILL}:compr:${a.join("-")}~${t}-${k}:${seed}`,
    level: 2,
    scene: code(`a = ${fmt(a)}`, `b = [x * ${k} for x in a if x > ${t}]`, "print(b)"),
    correct: fmt(res),
    cands,
    hint: { ru: "Читай так: возьми каждый x из a, оставь только те, для которых условие верно, и положи x, умноженное на число.", kk: "Былай оқы: a ішіндегі әр x мәнін ал, шарты орындалатындарын ғана қалдыр да, x-ті санға көбейтіп сал." },
    explanation: {
      ru: `Условие x > ${t} проходят: ${a.filter((x) => x > t).join(", ")}. Умножаем каждый на ${k}: ${fmt(res)}.`,
      kk: `x > ${t} шартына сәйкес келетіндер: ${a.filter((x) => x > t).join(", ")}. Әрқайсысын ${k} санына көбейтеміз: ${fmt(res)}.`,
    },
  });
}

// ---------- Уровень C ----------

/** b = a — второе имя; copy / [:] — независимая копия. */
function genAlias(rand: Rand, seed: number): QuestionStep {
  const a = randList(rand, 3, 1, 9);
  const mode = pick(rand, ["alias", "alias", "slice", "copy"] as const);
  const alias = mode === "alias";
  const ops: Op[] = [];
  let cur = a;
  const count = int(rand, 1, 2);
  for (let i = 0; i < count; i++) {
    const op = randomOp(rand, cur, ["append", "set"]);
    ops.push({ ...op });
    cur = applyOp(cur, op);
  }
  if (fmt(cur) === fmt(a)) return genAlias(rand, seed + 1);
  const bOps = ops.map((o) => opCode(o).replace(/^a/, "b"));
  const link = mode === "alias" ? "b = a" : mode === "slice" ? "b = a[:]" : "b = a.copy()";
  const correct = alias ? fmt(cur) : fmt(a);
  const half = applyOp(a, ops[0]);
  const cands: Cand[] = alias
    ? [
        { value: fmt(a), why: { ru: "Так было бы, если бы b была отдельной копией. Но `b = a` копии не делает.", kk: "b бөлек көшірме болса, солай болар еді. Бірақ `b = a` көшірме жасамайды." } },
        { value: fmt(half), why: { ru: "Применена только первая из команд над b. Но изменения a вызывают все.", kk: "b үстіндегі командалардың тек біріншісі қолданылған. Ал a-ға барлық команданың әсері тиеді." } },
      ]
    : [
        { value: fmt(cur), why: { ru: "Так было бы при `b = a`. Но здесь b — независимая копия, и изменения b не затрагивают a.", kk: "`b = a` болса, солай болар еді. Бірақ мұнда b — тәуелсіз көшірме, b-ның өзгерісі a-ға әсер етпейді." } },
        { value: fmt(half), why: { ru: "b — независимая копия: ни одна из команд над b не меняет a.", kk: "b — тәуелсіз көшірме: b үстіндегі ешбір команда a-ны өзгертпейді." } },
      ];
  cands.push(
    { value: fmt([...cur].reverse()), why: { ru: "Порядок элементов нарушен: команды не переворачивают список.", kk: "Элементтер реті бұзылған: командалар тізімді төңкермейді." } },
    { value: fmt(cur.slice(0, -1)), why: { ru: "Потерян элемент: пройди команды по строкам.", kk: "Элемент жоғалған: командаларды жол-жолымен өткіз." } },
  );
  return makeQuestion(rand, {
    id: `g:${SKILL}:alias-${mode}:${a.join("-")}-${bOps.join("").replace(/\W/g, "")}:${seed}`,
    level: 3,
    scene: code(`a = ${fmt(a)}`, link, ...bOps, "print(a)"),
    correct,
    cands,
    hint: { ru: "Подумай, что делает строка с b: создаёт независимую копию или даёт второе имя тому же списку?", kk: "b жолы не істейтінін ойлан: тәуелсіз көшірме жасай ма, әлде сол тізімге екінші ат бере ме?" },
    explanation: alias
      ? { ru: `\`b = a\` не копирует список, а даёт ему второе имя: a и b — один и тот же список. Команды над b меняют и a. Результат: ${fmt(cur)}.`, kk: `\`b = a\` тізімді көшірмейді, оған екінші ат береді: a және b — бір тізім. b үстіндегі командалар a-ны да өзгертеді. Нәтиже: ${fmt(cur)}.` }
      : { ru: `\`${link}\` создаёт независимую копию. Команды над b меняют только b, а a остаётся ${fmt(a)}.`, kk: `\`${link}\` тәуелсіз көшірме жасайды. b үстіндегі командалар тек b-ны өзгертеді, ал a ${fmt(a)} күйінде қалады.` },
  });
}

/** Сдвиги элементов. */
function genShift(rand: Rand, seed: number): QuestionStep {
  const n = int(rand, 4, 5);
  const a = randList(rand, n, 1, 9, true);
  const kind = pick(rand, ["left", "left0", "right-bug", "right-ok", "rotate"] as const);
  let lines: string[];
  let res: number[];
  const r = [...a];
  switch (kind) {
    case "left":
      lines = [`a = ${fmt(a)}`, "for i in range(len(a) - 1):", "    a[i] = a[i + 1]", "print(a)"];
      for (let i = 0; i < n - 1; i++) r[i] = r[i + 1];
      res = r;
      break;
    case "left0":
      lines = [`a = ${fmt(a)}`, "for i in range(len(a) - 1):", "    a[i] = a[i + 1]", "a[-1] = 0", "print(a)"];
      for (let i = 0; i < n - 1; i++) r[i] = r[i + 1];
      r[n - 1] = 0;
      res = r;
      break;
    case "right-bug":
      lines = [`a = ${fmt(a)}`, "for i in range(1, len(a)):", "    a[i] = a[i - 1]", "print(a)"];
      for (let i = 1; i < n; i++) r[i] = r[i - 1];
      res = r;
      break;
    case "right-ok":
      lines = [`a = ${fmt(a)}`, "for i in range(len(a) - 1, 0, -1):", "    a[i] = a[i - 1]", "print(a)"];
      for (let i = n - 1; i > 0; i--) r[i] = r[i - 1];
      res = r;
      break;
    default:
      lines = [`a = ${fmt(a)}`, "x = a.pop(0)", "a.append(x)", "print(a)"];
      res = [...a.slice(1), a[0]];
      break;
  }
  const rotL = [...a.slice(1), a[0]];
  const rotR = [a[n - 1], ...a.slice(0, -1)];
  const leftDup = [...a.slice(1), a[n - 1]];
  const rightDup = [a[0], ...a.slice(0, -1)];
  const allFirst = a.map(() => a[0]);
  const cands: Cand[] = [
    { value: fmt(a), why: { ru: "Список не остаётся прежним: присваивания меняют его элементы.", kk: "Тізім бұрынғы күйінде қалмайды: меншіктеулер оның элементтерін өзгертеді." } },
    { value: fmt(rotL), why: { ru: "Это циклический сдвиг влево, но в программе первый элемент не переносится в конец.", kk: "Бұл солға циклдік жылжу, бірақ программада бірінші элемент соңына көшірілмейді." } },
    { value: fmt(rotR), why: { ru: "Это сдвиг вправо по кругу; в программе последний элемент в начало не переносится.", kk: "Бұл оңға циклдік жылжу; программада соңғы элемент басына көшірілмейді." } },
    { value: fmt(leftDup), why: { ru: "Это сдвиг влево с повтором последнего элемента — в этой программе так не получается.", kk: "Бұл соңғы элемент қайталанатын солға жылжу — бұл программада олай болмайды." } },
    { value: fmt(rightDup), why: { ru: "Так выглядит верный сдвиг вправо с проходом с конца; здесь работает другая программа.", kk: "Соңынан өтетін дұрыс оңға жылжу осылай көрінеді; мұнда басқа программа жұмыс істейді." } },
    { value: fmt(allFirst), why: { ru: "Так получается, когда присваивание идёт слева направо: значение первого элемента «растекается» по всему списку.", kk: "Меншіктеу солдан оңға жүргенде осылай шығады: бірінші элементтің мәні бүкіл тізімге тарап кетеді." } },
  ];
  const trail = (() => {
    if (kind === "rotate") return `pop(0) убирает ${a[0]}: ${fmt(a.slice(1))}; append(${a[0]}) добавляет его в конец`;
    const t = [...a];
    const parts: string[] = [];
    if (kind === "right-ok") {
      for (let i = n - 1; i > 0; i--) {
        t[i] = t[i - 1];
        parts.push(`i = ${i}: ${fmt(t)}`);
      }
    } else if (kind === "right-bug") {
      for (let i = 1; i < n; i++) {
        t[i] = t[i - 1];
        parts.push(`i = ${i}: ${fmt(t)}`);
      }
    } else {
      for (let i = 0; i < n - 1; i++) {
        t[i] = t[i + 1];
        parts.push(`i = ${i}: ${fmt(t)}`);
      }
    }
    return parts.join("; ");
  })();
  const trailKk = kind === "rotate" ? `pop(0) ${a[0]} элементін алып тастайды: ${fmt(a.slice(1))}; append(${a[0]}) оны соңына қосады` : trail;
  return makeQuestion(rand, {
    id: `g:${SKILL}:shift-${kind}:${a.join("-")}:${seed}`,
    level: 3,
    scene: code(...lines),
    correct: fmt(res),
    cands,
    hint: { ru: "Выпиши список после каждого шага цикла. Помни: присваивание a[i] = … затирает прежнее значение, и дальше цикл видит уже новое.", kk: "Цикл қадамының әрқайсысынан кейін тізімді жаз. Есте сақта: a[i] = … алдыңғы мәнді өшіреді, цикл әрі қарай жаңа мәнді көреді." },
    explanation: {
      ru: `Список после каждого шага: ${trail}. Ответ: ${fmt(res)}.`,
      kk: `Әр қадамнан кейінгі тізім: ${trailKk}. Жауабы: ${fmt(res)}.`,
    },
  });
}

/** Сумма индексов элементов, удовлетворяющих условию. */
function genIdxSum(rand: Rand, seed: number): QuestionStep {
  const m = pick(rand, [2, 3]);
  const a = randList(rand, int(rand, 5, 7), 1, 20);
  const idxs = a.map((_, i) => i).filter((i) => a[i] % m === 0);
  if (!idxs.length) return genIdxSum(rand, seed + 1);
  const idxSum = sum(idxs);
  const valSum = sum(idxs.map((i) => a[i]));
  const otherIdx = sum(a.map((_, i) => i).filter((i) => a[i] % m !== 0));
  return makeQuestion(rand, {
    id: `g:${SKILL}:idxsum:${a.join("-")}~${m}:${seed}`,
    level: 3,
    numeric: true,
    scene: code(`a = ${fmt(a)}`, "s = 0", "for i in range(len(a)):", `    if a[i] % ${m} == 0:`, "        s += i", "print(s)"),
    correct: String(idxSum),
    cands: [
      { value: String(valSum), why: { ru: "Сложены сами значения a[i], а в программе к s прибавляется индекс i.", kk: "a[i] мәндерінің өзі қосылған, ал программада s-ке i индексі қосылады." } },
      { value: String(idxs.length), why: { ru: "Это количество подходящих элементов, а s складывает их индексы.", kk: "Бұл сәйкес элементтер саны, ал s олардың индекстерін қосады." } },
      { value: String(otherIdx), why: { ru: "Сложены индексы элементов, для которых условие НЕ выполняется.", kk: "Шарт орындалмайтын элементтердің индекстері қосылған." } },
      { value: String(idxSum + idxs[0] + 1), why: { ru: "Индексы посчитаны с единицы вместо нуля.", kk: "Индекстер нөлден емес, бірден есептелген." } },
    ],
    hint: { ru: "Выпиши индексы 0, 1, 2, … и отметь те, где a[i] делится на число из условия. Сложи именно индексы.", kk: "0, 1, 2, … индекстерін жазып, a[i] шарттағы санға бөлінетіндерін белгіле. Дәл индекстерді қос." },
    explanation: {
      ru: `Условие a[i] % ${m} == 0 верно на индексах: ${idxs.join(", ")} (значения ${idxs.map((i) => a[i]).join(", ")}). s складывает индексы: ${idxs.join(" + ")} = ${idxSum}.`,
      kk: `a[i] % ${m} == 0 шарты мына индекстерде орындалады: ${idxs.join(", ")} (мәндері ${idxs.map((i) => a[i]).join(", ")}). s индекстерді қосады: ${idxs.join(" + ")} = ${idxSum}.`,
    },
  });
}

/** sorted + срез + генератор с условием. */
function genCombo(rand: Rand, seed: number): QuestionStep {
  const n = int(rand, 4, 5);
  const a = randList(rand, n, 1, 9, true);
  const b = [...a].sort((x, y) => x - y);
  if (a.every((v, i) => v === b[i])) return genCombo(rand, seed + 1);
  const cut = pick(rand, ["head", "tail"] as const);
  const slice = cut === "head" ? "[1:]" : "[:-1]";
  const cutFn = (l: number[]) => (cut === "head" ? l.slice(1) : l.slice(0, -1));
  const odd = rand() < 0.5;
  const t = pick(rand, b);
  const cond = odd ? "x % 2 == 1" : `x > ${t}`;
  const test = (x: number) => (odd ? x % 2 === 1 : x > t);
  const res = cutFn(b).filter(test);
  if (!res.length) return genCombo(rand, seed + 1);
  const cands: Cand[] = [
    { value: fmt(cutFn(a).filter(test)), why: { ru: "Срез и условие применены к исходному a, а в программе — к отсортированному b.", kk: "Тілім мен шарт бастапқы a-ға қолданылған, ал программада — сұрыпталған b-ға." } },
    { value: fmt(cutFn(b)), why: { ru: "Условие if пропущено: в список попали все элементы среза.", kk: "if шарты ескерілмеген: тізімге тілімнің барлық элементі түскен." } },
    { value: fmt(b.filter(test)), why: { ru: "Срез пропущен: условие применено ко всему b.", kk: "Тілім ескерілмеген: шарт бүкіл b-ға қолданылған." } },
    { value: fmt(cutFn(b).filter((x) => !test(x))), why: { ru: "Условие понято наоборот: выбраны элементы, для которых оно неверно.", kk: "Шарт керісінше түсінілген: ол орындалмайтын элементтер таңдалған." } },
  ];
  return makeQuestion(rand, {
    id: `g:${SKILL}:combo:${a.join("-")}~${cut}${odd ? "o" : t}:${seed}`,
    level: 3,
    scene: code(`a = ${fmt(a)}`, "b = sorted(a)", `c = [x for x in b${slice} if ${cond}]`, "print(c)"),
    correct: fmt(res),
    cands,
    hint: { ru: "Иди по строкам: сначала что в b после sorted(a), затем что даёт срез, потом какие элементы проходят условие.", kk: "Жолдар бойынша жүр: алдымен sorted(a)-дан кейін b-да не бар, сосын тілім не береді, содан кейін қай элементтер шартты өтеді." },
    explanation: {
      ru: `sorted(a) даёт b = ${fmt(b)}. Срез b${slice}: ${fmt(cutFn(b))}. Условие ${cond} оставляет: ${fmt(res)}. Список a не меняется.`,
      kk: `sorted(a) b = ${fmt(b)} береді. b${slice} тілімі: ${fmt(cutFn(b))}. ${cond} шарты мынаны қалдырады: ${fmt(res)}. a тізімі өзгермейді.`,
    },
  });
}

// ---------- Выбор генератора ----------

function question(level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  let step: QuestionStep;
  if (level === 1) {
    const kind = pick(rand, ["get", "get", "len", "agg", "count", "trace"] as const);
    step = kind === "get" ? genGet(rand, seed) : kind === "len" ? genLen(rand, seed) : kind === "agg" ? genAgg(rand, seed) : kind === "count" ? genCount(rand, 1, seed) : genTrace(rand, 1, seed);
  } else if (level === 2) {
    const kind = pick(rand, ["trace", "trace", "sort", "maxidx", "loop", "slice", "compr", "count"] as const);
    step =
      kind === "trace" ? genTrace(rand, 2, seed)
      : kind === "sort" ? genSortNone(rand, seed)
      : kind === "maxidx" ? genMaxIdx(rand, seed)
      : kind === "loop" ? genLoopAssign(rand, seed)
      : kind === "slice" ? genSlice(rand, seed)
      : kind === "compr" ? genCompr(rand, seed)
      : genCount(rand, 2, seed);
  } else {
    const kind = pick(rand, ["alias", "alias", "shift", "idxsum", "combo", "count", "trace"] as const);
    step =
      kind === "alias" ? genAlias(rand, seed)
      : kind === "shift" ? genShift(rand, seed)
      : kind === "idxsum" ? genIdxSum(rand, seed)
      : kind === "combo" ? genCombo(rand, seed)
      : kind === "count" ? genCount(rand, 3, seed)
      : genTrace(rand, 3, seed);
  }
  return { ...step, level };
}

// ---------- Утверждения «верно / неверно» ----------

const st = (id: string, level: Level, ru: string, kk: string, value: boolean, expRu: string, expKk: string): Statement => ({
  id: `s:${SKILL}:${id}`,
  skill: SKILL,
  level,
  text: { ru, kk },
  value,
  explanation: { ru: expRu, kk: expKk },
});

const STATEMENTS: Statement[] = [
  st("get1", 1, "В списке a = [4, 7, 9] элемент a[1] равен 7", "a = [4, 7, 9] тізімінде a[1] элементі 7-ге тең", true, "Индексы идут с нуля: a[0] = 4, a[1] = 7, a[2] = 9.", "Индекстер нөлден басталады: a[0] = 4, a[1] = 7, a[2] = 9."),
  st("get3", 1, "В списке a = [4, 7, 9] элемент a[3] равен 9", "a = [4, 7, 9] тізімінде a[3] элементі 9-ға тең", false, "В списке три элемента, индексы 0, 1, 2. a[3] не существует (IndexError), а 9 стоит на a[2].", "Тізімде үш элемент бар, индекстері 0, 1, 2. a[3] жоқ (IndexError), ал 9 саны a[2]-де тұр."),
  st("len", 1, "len([5, 2, 8, 3]) равно 4", "len([5, 2, 8, 3]) мәні 4-ке тең", true, "len возвращает число элементов: их четыре.", "len элементтер санын қайтарады: олар төртеу."),
  st("last", 1, "a[-1] — последний элемент списка", "a[-1] — тізімнің соңғы элементі", true, "Отрицательный индекс считается с конца: a[-1] — последний, a[-2] — предпоследний.", "Теріс индекс соңынан санайды: a[-1] — соңғы, a[-2] — соңғысының алдындағысы."),
  st("from1", 1, "Индексы элементов списка начинаются с 1", "Тізім элементтерінің индекстері 1-ден басталады", false, "Нумерация идёт с нуля: первый элемент — a[0].", "Нөмірлеу нөлден басталады: бірінші элемент — a[0]."),
  st("append", 1, "Метод append добавляет элемент в конец списка", "append әдісі элементті тізімнің соңына қосады", true, "append(x) всегда добавляет x в конец.", "append(x) x мәнін әрқашан соңына қосады."),
  st("sortnone", 2, "Метод sort() возвращает новый отсортированный список", "sort() әдісі жаңа сұрыпталған тізімді қайтарады", false, "sort() сортирует список на месте и возвращает None. Новый список даёт функция sorted().", "sort() тізімді орнында сұрыптап, None қайтарады. Жаңа тізімді sorted() функциясы береді."),
  st("sorted", 2, "Функция sorted(a) не меняет список a", "sorted(a) функциясы a тізімін өзгертпейді", true, "sorted возвращает новый отсортированный список, а a остаётся прежним.", "sorted жаңа сұрыпталған тізім қайтарады, ал a бұрынғыдай қалады."),
  st("pop", 2, "Метод pop() убирает последний элемент и возвращает его", "pop() әдісі соңғы элементті алып тастап, оны қайтарады", true, "pop() без аргумента удаляет последний элемент и возвращает его значение.", "Аргументсіз pop() соңғы элементті жойып, оның мәнін қайтарады."),
  st("remove", 2, "Метод remove(x) убирает элемент с индексом x", "remove(x) әдісі x индексті элементті алып тастайды", false, "remove(x) убирает первое значение, равное x. По индексу убирает pop(i).", "remove(x) x мәніне тең бірінші мәнді алып тастайды. Индекс бойынша pop(i) алып тастайды."),
  st("slice", 2, "Срез a[1:3] содержит элементы с индексами 1, 2 и 3", "a[1:3] тілімінде 1, 2 және 3 индексті элементтер бар", false, "Конец среза не входит: a[1:3] — только индексы 1 и 2.", "Тілімнің соңы кірмейді: a[1:3] — тек 1 және 2 индекстер."),
  st("loopx", 2, "В цикле for x in a присваивание x = x * 2 меняет элементы списка a", "for x in a циклінде x = x * 2 меншіктеуі a тізімінің элементтерін өзгертеді", false, "x — лишь копия очередного значения. Чтобы изменить список, нужно писать a[i] = …", "x — кезекті мәннің көшірмесі ғана. Тізімді өзгерту үшін a[i] = … деп жазу керек."),
  st("alias", 3, "После b = a изменение b[0] меняет и a[0]", "b = a жолынан кейін b[0] өзгерсе, a[0] де өзгереді", true, "b = a не копирует список: a и b — два имени одного списка.", "b = a тізімді көшірмейді: a және b — бір тізімнің екі аты."),
  st("copy", 3, "a.copy() создаёт независимую копию списка", "a.copy() тізімнің тәуелсіз көшірмесін жасайды", true, "После b = a.copy() изменения b не затрагивают a. Так же работает a[:].", "b = a.copy() кейін b-ның өзгерісі a-ға әсер етпейді. a[:] да солай жұмыс істейді."),
  st("sortassign", 3, "После a = [1, 2, 3]; b = a.sort() переменная b равна [1, 2, 3]", "a = [1, 2, 3]; b = a.sort() кейін b айнымалысы [1, 2, 3] болады", false, "sort() возвращает None, поэтому b = None (даже если список уже отсортирован).", "sort() None қайтарады, сондықтан b = None (тізім бұрыннан сұрыпталған болса да)."),
  st("lenidx", 3, "a[len(a)] — последний элемент списка", "a[len(a)] — тізімнің соңғы элементі", false, "Последний индекс равен len(a) - 1. Обращение к a[len(a)] — ошибка IndexError.", "Соңғы индекс len(a) - 1 санына тең. a[len(a)] элементіне жүгіну — IndexError қатесі."),
  st("compr", 3, "[x for x in [1, 2, 3, 4] if x % 2 == 0] равно [2, 4]", "[x for x in [1, 2, 3, 4] if x % 2 == 0] мәні [2, 4]-ке тең", true, "Условие x % 2 == 0 оставляет чётные: 2 и 4.", "x % 2 == 0 шарты жұптарын қалдырады: 2 және 4."),
  st("reverse", 3, "Если a = [3, 1, 2], то после a.reverse() получится [1, 2, 3]", "a = [3, 1, 2] болса, a.reverse() кейін [1, 2, 3] шығады", false, "reverse() не сортирует, а разворачивает: получится [2, 1, 3].", "reverse() сұрыптамайды, төңкереді: [2, 1, 3] шығады."),
];

// ---------- Пары «команда ↔ смысл» ----------

const pr = (id: string, level: Level, left: string, ru: string, kk: string): Pair => ({ id: `p:${SKILL}:${id}`, skill: SKILL, level, left, right: { ru, kk } });

const PAIRS: Pair[] = [
  pr("append", 1, "a.append(x)", "добавить x в конец", "x мәнін соңына қосу"),
  pr("pop", 1, "a.pop()", "убрать последний элемент и вернуть его", "соңғы элементті алып тастап, қайтару"),
  pr("remove", 1, "a.remove(x)", "убрать первое значение x", "x мәнінің бірінші кездесуін алып тастау"),
  pr("len", 1, "len(a)", "число элементов", "элементтер саны"),
  pr("count", 1, "a.count(x)", "сколько раз встречается x", "x қанша рет кездеседі"),
  pr("index", 1, "a.index(x)", "индекс первого x", "бірінші x индексі"),
  pr("insert", 2, "a.insert(i, x)", "вставить x на место i", "x мәнін i орнына қою"),
  pr("sort", 2, "a.sort()", "отсортировать на месте, вернуть None", "орнында сұрыптау, None қайтару"),
  pr("sorted", 2, "sorted(a)", "новый отсортированный список", "жаңа сұрыпталған тізім"),
  pr("reverse", 2, "a.reverse()", "развернуть список на месте", "тізімді орнында төңкеру"),
  pr("slice", 2, "a[1:3]", "элементы с индексами 1 и 2", "1 және 2 индексті элементтер"),
  pr("last", 2, "a[-1]", "последний элемент", "соңғы элемент"),
  pr("alias", 3, "b = a", "второе имя того же списка", "сол тізімнің екінші аты"),
  pr("copy", 3, "b = a.copy()", "независимая копия списка", "тізімнің тәуелсіз көшірмесі"),
  pr("compr", 3, "[x * 2 for x in a]", "новый список с удвоенными элементами", "элементтері екі есе үлкен жаңа тізім"),
];

// ---------- Короткие вопросы с однозначным ответом ----------

function short(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  const mk = (id: string, prompt: string, answer: string, mode: "number" | "text", exp: L): ShortQuestion => ({
    id: `q:${SKILL}:${id}`,
    skill: SKILL,
    level,
    prompt: same(`${prompt}  → ?`),
    answer,
    mode,
    explanation: exp,
  });
  if (level === 1) {
    const a = randList(rand, int(rand, 4, 5), 1, 30, true);
    const kind = pick(rand, ["get", "last", "len", "sum", "max"] as const);
    const list = `a = ${fmt(a)}`;
    const key = a.join("-");
    if (kind === "get") {
      const k = int(rand, 0, a.length - 1);
      return mk(`get:${key}:${k}`, `${list}; print(a[${k}])`, String(a[k]), "number", same(`a[${k}] = ${a[k]}`));
    }
    if (kind === "last") return mk(`last:${key}`, `${list}; print(a[-1])`, String(a[a.length - 1]), "number", same(`a[-1] = ${a[a.length - 1]}`));
    if (kind === "len") return mk(`len:${key}`, `${list}; print(len(a))`, String(a.length), "number", same(`len(a) = ${a.length}`));
    if (kind === "sum") return mk(`sum:${key}`, `${list}; print(sum(a))`, String(sum(a)), "number", same(`${a.join(" + ")} = ${sum(a)}`));
    return mk(`max:${key}`, `${list}; print(max(a))`, String(Math.max(...a)), "number", same(`max(a) = ${Math.max(...a)}`));
  }
  if (level === 2) {
    const a = randList(rand, 4, 1, 9);
    const key = a.join("-");
    const kind = pick(rand, ["append", "count", "index", "pop", "slice"] as const);
    const list = `a = ${fmt(a)}`;
    if (kind === "append") {
      const x = int(rand, 1, 9);
      return mk(`append:${key}:${x}`, `${list}; a.append(${x}); print(a[-1] + len(a))`, String(x + a.length + 1), "number", same(`a → ${fmt([...a, x])}; ${x} + ${a.length + 1} = ${x + a.length + 1}`));
    }
    if (kind === "count") {
      const x = pick(rand, a);
      return mk(`count:${key}:${x}`, `${list}; print(a.count(${x}))`, String(a.filter((v) => v === x).length), "number", same(`a.count(${x}) = ${a.filter((v) => v === x).length}`));
    }
    if (kind === "index") {
      const x = pick(rand, a);
      return mk(`index:${key}:${x}`, `${list}; print(a.index(${x}))`, String(a.indexOf(x)), "number", same(`a.index(${x}) = ${a.indexOf(x)}`));
    }
    if (kind === "pop") {
      const r = a[a.length - 1];
      return mk(`pop:${key}`, `${list}; print(a.pop())`, String(r), "number", same(`pop() → ${r}`));
    }
    const i = int(rand, 0, 1);
    const j = i + 2;
    return mk(`slice:${key}:${i}`, `${list}; print(a[${i}:${j}])`, fmt(a.slice(i, j)), "text", same(`a[${i}:${j}] = ${fmt(a.slice(i, j))}`));
  }
  const a = randList(rand, 3, 1, 9);
  const key = a.join("-");
  const kind = pick(rand, ["alias", "copy", "none", "sorted"] as const);
  const list = `a = ${fmt(a)}`;
  const x = int(rand, 1, 9);
  if (kind === "alias") return mk(`alias:${key}:${x}`, `${list}; b = a; b.append(${x}); print(len(a))`, String(a.length + 1), "number", same(`b is a → a = ${fmt([...a, x])}`));
  if (kind === "copy") return mk(`copy:${key}:${x}`, `${list}; b = a[:]; b.append(${x}); print(len(a))`, String(a.length), "number", same(`b = a[:] → a = ${fmt(a)}`));
  if (kind === "none") return mk(`none:${key}`, `${list}; print(a.sort())`, "None", "text", same("a.sort() → None"));
  const s = [...a].sort((p, q) => p - q);
  return mk(`sorted:${key}`, `${list}; b = sorted(a); print(a[0] == b[0])`, a[0] === s[0] ? "True" : "False", "text", same(`a = ${fmt(a)}, b = ${fmt(s)}`));
}

// ---------- Банк ----------

function pickBy<T extends { level: Level }>(items: T[], level: Level, seed: number): T {
  const exact = items.filter((x) => x.level === level);
  const pool = exact.length ? exact : items;
  return pool[Math.floor(seeded(seed)() * pool.length)];
}

export const BANKS: SkillBank[] = [
  {
    skill: SKILL,
    question,
    statement: (level, seed) => pickBy(STATEMENTS, level, seed),
    pair: (level, seed) => pickBy(PAIRS, level, seed),
    short,
  },
];
