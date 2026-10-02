import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка py.functions («Функции и рекурсия»): генератор небольших программ на Python.
// Правильный ответ всегда считает код: функции ниже повторяют логику программы, показанной в сцене.
// Тексты после переменных — без падежных окончаний (в казахском окончание зависит от числа).
// Сверка с реальным python3: scripts/out/py-6-functions/verify-bank.py.

const SKILL = "py.functions";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });
const w = (ru: string, kk: string): L => ({ ru, kk });
const code = (lines: string[]): Scene => ({ kind: "code", lang: "python", lines });

// ---------- Общие тексты ----------

const WHAT_PRINTS: L = { ru: "Что выведет программа?", kk: "Программа не шығарады?" };
const WHAT_PRINTS_LINES: L = {
  ru: "Что выведет программа? Выведенные строки записаны в вариантах через запятую.",
  kk: "Программа не шығарады? Шығарылған жолдар нұсқаларда үтір арқылы жазылған.",
};
const WHAT_RETURNS: L = { ru: "Чему равно значение, которое выведет программа?", kk: "Программа шығаратын мән неге тең?" };

const HINT_SUBST: L = {
  ru: "Подставь аргумент вместо параметра и выполни return по шагам. Помни: умножение выполняется раньше сложения и вычитания.",
  kk: "Параметр орнына аргументті қой да, return-ді қадамдап орында. Есіңде болсын: көбейту қосу мен алудан бұрын орындалады.",
};
const HINT_REC: L = {
  ru: "Начни с базового случая, где ответ известен, и поднимайся вверх: каждый ответ нужен для следующего вызова.",
  kk: "Жауап белгілі базалық жағдайдан баста да, жоғары көтеріл: әр жауап келесі шақыруға керек.",
};

const W_ORDER = w(
  "Нарушен порядок действий: умножение выполняется раньше сложения и вычитания.",
  "Амалдар реті бұзылған: көбейту қосу мен алудан бұрын орындалады.",
);
const W_FORGOT = w("Потеряна вторая часть выражения в return: учтено только умножение.", "return-дегі өрнектің екінші бөлігі жоғалған: тек көбейту ескерілген.");
const W_SIGN = w("Знак перед вторым слагаемым изменён на противоположный.", "Екінші қосылғыштың алдындағы таңба қарама-қарсыға өзгертілген.");
const W_PLUS = w("Умножение заменено сложением.", "Көбейту қосумен ауыстырылған.");
const W_OFF1 = w("Ошибка в вычислении: проверь каждый шаг.", "Есептеуде қате кеткен: әр қадамды тексер.");
const W_FIRST = w("Учтён только один из вызовов.", "Шақырулардың тек біреуі есепке алынған.");

// ---------- Сборка заданий ----------

interface Wrong {
  v: Text;
  why: L;
}

const key = (t: Text) => JSON.stringify(t);

/** Варианты: правильный + три разных неверных (с пояснением), недостающие добираются ошибкой на единицу. */
function makeOptions(rand: Rand, correct: Text, wrongs: Wrong[]): { options: Text[]; correct: number; whyWrong: (L | null)[] } {
  const seen = new Set<string>([key(correct)]);
  const list: { v: Text; why: L | null }[] = [{ v: correct, why: null }];
  for (const wr of wrongs) {
    if (list.length >= 4) break;
    if (seen.has(key(wr.v))) continue;
    seen.add(key(wr.v));
    list.push(wr);
  }
  const n = Number(correct);
  if (typeof correct === "string" && correct !== "" && Number.isFinite(n)) {
    for (const d of [1, -1, 2, -2, 3]) {
      if (list.length >= 4) break;
      const v = String(n + d);
      if (seen.has(key(v))) continue;
      seen.add(key(v));
      list.push({ v, why: W_OFF1 });
    }
  }
  if (list.length < 4) throw new Error(`py.functions: мало вариантов для ${key(correct)}`);
  const mixed = shuffle(list, rand);
  return { options: mixed.map((x) => x.v), correct: mixed.findIndex((x) => x.v === correct), whyWrong: mixed.map((x) => x.why) };
}

interface ChoiceArgs {
  id: string;
  level: Level;
  prompt: L;
  scene: Scene;
  correct: Text;
  wrongs: Wrong[];
  hint: L;
  explanation: L;
}

function choiceStep(rand: Rand, a: ChoiceArgs): ChoiceStep {
  const o = makeOptions(rand, a.correct, a.wrongs);
  return {
    id: a.id,
    type: "choice",
    skill: SKILL,
    level: a.level,
    prompt: a.prompt,
    scene: a.scene,
    ...o,
    hint: a.hint,
    explanation: a.explanation,
  };
}

/** Числовой ответ: выбор из вариантов (чаще на лёгких уровнях) или ввод (чаще на сложных). */
function numericStep(rand: Rand, a: Omit<ChoiceArgs, "correct"> & { value: number }, inputShare: number): QuestionStep {
  if (rand() < inputShare) {
    const input: InputStep = {
      id: a.id,
      type: "input",
      skill: SKILL,
      level: a.level,
      prompt: a.prompt,
      scene: a.scene,
      answers: [String(a.value)],
      mode: "number",
      hint: a.hint,
      explanation: a.explanation,
    };
    return input;
  }
  return choiceStep(rand, { ...a, correct: String(a.value) });
}

const SHARE: Record<Level, number> = { 1: 0, 2: 0.35, 3: 0.55 };

// ---------- Уровень 1 (A): применить функцию по образцу ----------

function tLin(rand: Rand, level: Level, seed: number): QuestionStep {
  const name = pick(rand, ["f", "g", "h"]);
  const a = int(rand, 2, 5);
  const b = int(rand, 1, 9);
  const k = int(rand, 2, 9);
  const minus = rand() < 0.4;
  const sign = minus ? "−" : "+";
  const asciiSign = minus ? "-" : "+";
  const sb = minus ? -b : b;
  const value = a * k + sb;
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:lin:${name}${a}_${asciiSign}${b}_${k}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code([`def ${name}(x):`, `    return ${a} * x ${asciiSign} ${b}`, "", `print(${name}(${k}))`]),
      value,
      hint: HINT_SUBST,
      explanation: {
        ru: `Вызов ${name}(${k}): x = ${k}. Умножение выполняется раньше ${minus ? "вычитания" : "сложения"}: ${a} * ${k} ${sign} ${b} = ${a * k} ${sign} ${b} = ${value}.`,
        kk: `${name}(${k}) шақыруы: x = ${k}. Көбейту ${minus ? "алудан" : "қосудан"} бұрын орындалады: ${a} * ${k} ${sign} ${b} = ${a * k} ${sign} ${b} = ${value}.`,
      },
      wrongs: [
        { v: String(a * (k + sb)), why: W_ORDER },
        { v: String(a * k), why: W_FORGOT },
        { v: String(a * k - sb), why: W_SIGN },
        { v: String(a + k + sb), why: W_PLUS },
      ],
    },
    SHARE[level],
  );
}

function tOrder(rand: Rand, level: Level, seed: number): QuestionStep {
  const p = int(rand, 2, 9);
  let q = int(rand, 2, 9);
  if (q === p) q = q === 9 ? 2 : q + 1;
  const ten = rand() < 0.5;
  const body = ten ? "a * 10 + b" : "a - b";
  const calc = (x: number, y: number) => (ten ? x * 10 + y : x - y);
  const value = calc(p, q);
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:order:${ten ? "ten" : "sub"}${p}_${q}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code(["def d(a, b):", `    return ${body}`, "", `print(d(${p}, ${q}))`]),
      value,
      hint: {
        ru: "Аргументы попадают в параметры по порядку: первый — в a, второй — в b. Потом выполни return.",
        kk: "Аргументтер параметрлерге ретімен түседі: біріншісі — a-ға, екіншісі — b-ға. Содан кейін return-ді орында.",
      },
      explanation: {
        ru: `Вызов d(${p}, ${q}): a = ${p}, b = ${q}. Функция возвращает ${body} = ${value}.`,
        kk: `d(${p}, ${q}) шақыруы: a = ${p}, b = ${q}. Функция ${body} = ${value} қайтарады.`,
      },
      wrongs: [
        { v: String(calc(q, p)), why: w("Аргументы перепутаны местами: a и b поменялись.", "Аргументтер орнымен ауысқан: a мен b алмасқан.") },
        { v: String(ten ? p - q : p * 10 + q), why: w("Взято не то действие: нужно выполнить то, что записано после return.", "Басқа амал алынған: return-нен кейін жазылғанды орындау керек.") },
        { v: String(p + q), why: w("Аргументы просто сложены, а return не выполнен.", "Аргументтер жай қосылған, return орындалмаған.") },
        { v: String(p * q), why: w("Аргументы перемножены, а return не выполнен.", "Аргументтер көбейтілген, return орындалмаған.") },
      ],
    },
    SHARE[level],
  );
}

function tNone(rand: Rand, level: Level, seed: number): QuestionStep {
  const a = int(rand, 2, 6);
  const k = int(rand, 2, 9);
  const name = pick(rand, ["f", "g", "h"]);
  return choiceStep(rand, {
    id: `g:${SKILL}:none:${name}${a}_${k}:${seed}`,
    level,
    prompt: WHAT_PRINTS,
    scene: code([`def ${name}(x):`, `    y = x * ${a}`, "", `print(${name}(${k}))`]),
    correct: "None",
    wrongs: [
      { v: String(a * k), why: w("Значение y вычисляется, но без return функция его не отдаёт.", "y мәні есептеледі, бірақ return болмаса, функция оны бермейді.") },
      { v: String(k), why: w("print выводит результат функции, а не её аргумент.", "print функцияның аргументін емес, нәтижесін шығарады.") },
      { v: { ru: "Ошибка", kk: "Қате" }, why: w("Ошибки нет: функция может не возвращать значение, тогда её результат — None.", "Қате жоқ: функция мән қайтармауы мүмкін, онда оның нәтижесі — None.") },
    ],
    hint: {
      ru: "Найди в функции команду return. Что возвращает функция, если return нет?",
      kk: "Функциядан return командасын тап. return болмаса, функция не қайтарады?",
    },
    explanation: {
      ru: `В функции ${name} нет return, поэтому она возвращает None. Выражение y = x * ${a} только запоминает значение внутри функции. print(${name}(${k})) выводит None.`,
      kk: `${name} функциясында return жоқ, сондықтан ол None қайтарады. y = x * ${a} өрнегі мәнді функция ішінде ғана есте сақтайды. print(${name}(${k})) None шығарады.`,
    },
  });
}

function tTwoCalls(rand: Rand, level: Level, seed: number): QuestionStep {
  const p = int(rand, 2, 6);
  let q = int(rand, 2, 6);
  if (q === p) q = q === 6 ? 2 : q + 1;
  const value = p * p + q * q;
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:twocalls:${p}_${q}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code(["def sq(x):", "    return x * x", "", `print(sq(${p}) + sq(${q}))`]),
      value,
      hint: {
        ru: "Сначала вычисли оба вызова по отдельности, потом сложи результаты.",
        kk: "Алдымен екі шақыруды бөлек есепте, содан кейін нәтижелерін қос.",
      },
      explanation: {
        ru: `sq(${p}) = ${p * p}, sq(${q}) = ${q * q}. Сумма ${p * p} + ${q * q} = ${value}.`,
        kk: `sq(${p}) = ${p * p}, sq(${q}) = ${q * q}. Қосынды ${p * p} + ${q * q} = ${value}.`,
      },
      wrongs: [
        { v: String((p + q) * (p + q)), why: w(`Сначала сложены аргументы, а функция применена один раз: sq(${p + q}).`, `Алдымен аргументтер қосылып, функция бір рет қолданылған: sq(${p + q}).`) },
        { v: String(p + q), why: w("Функция sq не применена: сложены сами аргументы.", "sq функциясы қолданылмаған: аргументтердің өздері қосылған.") },
        { v: String(p * p * q * q), why: w("Результаты вызовов перемножены, а в программе стоит знак +.", "Шақыру нәтижелері көбейтілген, ал программада + таңбасы тұр.") },
        { v: String(p * p), why: W_FIRST },
      ],
    },
    SHARE[level],
  );
}

// ---------- Уровень 2 (B): распознать модель, сравнить ----------

function tCond(rand: Rand, level: Level, seed: number): QuestionStep {
  const t = int(rand, 4, 8);
  const c = int(rand, 1, 5);
  const u = t + int(rand, 1, 5);
  const wv = int(rand, 2, t);
  const f = (x: number) => (x > t ? x - c : x * 2);
  const value = f(u) + f(wv);
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:cond:${t}_${c}_${u}_${wv}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code(["def f(x):", `    if x > ${t}:`, `        return x - ${c}`, "    return x * 2", "", `print(f(${u}) + f(${wv}))`]),
      value,
      hint: {
        ru: "Для каждого вызова отдельно проверь условие в if: какая из двух строк return сработает?",
        kk: "Әр шақыру үшін if ішіндегі шартты бөлек тексер: екі return жолының қайсысы орындалады?",
      },
      explanation: {
        ru: `f(${u}): ${u} > ${t} — истинно, возвращается ${u} − ${c} = ${f(u)}. f(${wv}): ${wv} > ${t} — ложно, return внутри if пропускается, возвращается ${wv} * 2 = ${f(wv)}. Сумма ${f(u)} + ${f(wv)} = ${value}.`,
        kk: `f(${u}): ${u} > ${t} — ақиқат, ${u} − ${c} = ${f(u)} қайтарылады. f(${wv}): ${wv} > ${t} — жалған, if ішіндегі return өткізіледі, ${wv} * 2 = ${f(wv)} қайтарылады. Қосынды ${f(u)} + ${f(wv)} = ${value}.`,
      },
      wrongs: [
        { v: String((u * 2) + (wv - c)), why: w(`Ветки перепутаны: для f(${u}) взята строка x * 2, а для f(${wv}) — x - ${c}.`, `Тармақтар шатастырылған: f(${u}) үшін x * 2 жолы, ал f(${wv}) үшін x - ${c} жолы алынған.`) },
        { v: String(u - c + wv - c), why: w(`Для f(${wv}) условие не проверено: взята строка x - ${c}, а ${wv} > ${t} — ложно.`, `f(${wv}) үшін шарт тексерілмеген: x - ${c} жолы алынған, ал ${wv} > ${t} — жалған.`) },
        { v: String(u * 2 + wv * 2), why: w(`Для f(${u}) условие не проверено: взята строка x * 2, а ${u} > ${t} — истинно.`, `f(${u}) үшін шарт тексерілмеген: x * 2 жолы алынған, ал ${u} > ${t} — ақиқат.`) },
        { v: String(u + wv), why: w("Функция не применена: сложены сами аргументы.", "Функция қолданылмаған: аргументтердің өздері қосылған.") },
      ],
    },
    SHARE[level],
  );
}

function tPrintRet(rand: Rand, level: Level, seed: number): QuestionStep {
  const a = int(rand, 2, 6);
  const k = int(rand, 2, 9);
  const both = rand() < 0.5;
  const j = (xs: (number | string)[]) => xs.join(", ");
  if (!both) {
    // print внутри, return нет: на экране число и None.
    const correct = j([a * k, "None"]);
    return choiceStep(rand, {
      id: `g:${SKILL}:printret:p${a}_${k}:${seed}`,
      level,
      prompt: WHAT_PRINTS_LINES,
      scene: code(["def g(x):", `    print(x * ${a})`, "", `r = g(${k})`, "print(r)"]),
      correct,
      wrongs: [
        { v: String(a * k), why: w("Забыто, что у функции нет return: вторая строка вывода — None.", "Функцияда return жоқ екені ұмытылған: шығарудың екінші жолы — None.") },
        { v: "None", why: w("Забыт print внутри функции: он тоже выводит число при вызове g.", "Функция ішіндегі print ұмытылған: ол да g шақырылғанда санды шығарады.") },
        { v: j([a * k, a * k]), why: w("print внутри функции не делает число её результатом: в r попадает None.", "Функция ішіндегі print санды оның нәтижесі етпейді: r айнымалысына None түседі.") },
        { v: j(["None", a * k]), why: w("Порядок вывода обратный: сначала print внутри g, потом print(r).", "Шығару реті керісінше: алдымен g ішіндегі print, содан кейін print(r).") },
      ],
      hint: {
        ru: "Выполняй по строкам: сначала вызов g (что он выводит и что возвращает?), потом print(r).",
        kk: "Жолдар бойынша орында: алдымен g шақыруы (ол не шығарады және не қайтарады?), содан кейін print(r).",
      },
      explanation: {
        ru: `Вызов g(${k}) печатает ${a * k}, но return нет, поэтому r = None. Затем print(r) выводит None. На экране: ${correct}.`,
        kk: `g(${k}) шақыруы ${a * k} шығарады, бірақ return жоқ, сондықтан r = None. Содан кейін print(r) None шығарады. Экранда: ${correct}.`,
      },
    });
  }
  // и print, и return: сначала печатается x, потом r + 1.
  const correct = j([k, a * k + 1]);
  return choiceStep(rand, {
    id: `g:${SKILL}:printret:b${a}_${k}:${seed}`,
    level,
    prompt: WHAT_PRINTS_LINES,
    scene: code(["def g(x):", "    print(x)", `    return x * ${a}`, "", `r = g(${k})`, "print(r + 1)"]),
    correct,
    wrongs: [
      { v: String(a * k + 1), why: w("Забыто, что print внутри функции тоже выводит число при вызове.", "Функция ішіндегі print те шақырылғанда санды шығаратыны ұмытылған.") },
      { v: String(k), why: w("Забыт последний print(r + 1).", "Соңғы print(r + 1) ұмытылған.") },
      { v: j([k, a * k]), why: w("В последней строке выводится r + 1, а не r.", "Соңғы жолда r емес, r + 1 шығады.") },
      { v: j([a * k + 1, k]), why: w("Порядок вывода обратный: сначала print внутри g, потом print(r + 1).", "Шығару реті керісінше: алдымен g ішіндегі print, содан кейін print(r + 1).") },
    ],
    hint: {
      ru: "Вызов g и печатает, и возвращает значение. Отследи по порядку, что оказалось на экране и что записано в r.",
      kk: "g шақыруы мәнді әрі шығарады, әрі қайтарады. Экранда не пайда болғанын және r айнымалысына не жазылғанын ретімен қадағала.",
    },
    explanation: {
      ru: `Вызов g(${k}): print выводит ${k}, return отдаёт ${k} * ${a} = ${a * k}, значит r = ${a * k}. Затем print(r + 1) выводит ${a * k + 1}. На экране: ${correct}.`,
      kk: `g(${k}) шақыруы: print ${k} шығарады, return ${k} * ${a} = ${a * k} береді, демек r = ${a * k}. Содан кейін print(r + 1) ${a * k + 1} шығарады. Экранда: ${correct}.`,
    },
  });
}

function tNested(rand: Rand, level: Level, seed: number): QuestionStep {
  const a = int(rand, 2, 3);
  const b = int(rand, 1, 4);
  const k = int(rand, 1, 4);
  const f = (x: number) => a * x + b;
  const inner = f(k);
  const value = f(inner);
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:nested:${a}_${b}_${k}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code(["def f(x):", `    return ${a} * x + ${b}`, "", `print(f(f(${k})))`]),
      value,
      hint: {
        ru: "Сначала вычисли внутренний вызов f, а его результат подставь в качестве аргумента во внешний.",
        kk: "Алдымен ішкі f шақыруын есепте, ал оның нәтижесін сыртқы шақыруға аргумент етіп қой.",
      },
      explanation: {
        ru: `Внутренний вызов: f(${k}) = ${a} * ${k} + ${b} = ${inner}. Внешний: f(${inner}) = ${a} * ${inner} + ${b} = ${value}.`,
        kk: `Ішкі шақыру: f(${k}) = ${a} * ${k} + ${b} = ${inner}. Сыртқы шақыру: f(${inner}) = ${a} * ${inner} + ${b} = ${value}.`,
      },
      wrongs: [
        { v: String(inner), why: w("Выполнен только внутренний вызов, внешний f пропущен.", "Тек ішкі шақыру орындалған, сыртқы f өткізіліп кеткен.") },
        { v: String(a * a * k + b), why: w(`Во внутреннем вызове потеряно слагаемое + ${b}.`, `Ішкі шақыруда + ${b} қосылғышы жоғалған.`) },
        { v: String(a * inner), why: w(`Во внешнем вызове потеряно слагаемое + ${b}.`, `Сыртқы шақыруда + ${b} қосылғышы жоғалған.`) },
        { v: String(2 * inner), why: w("Результат внутреннего вызова просто удвоен, а внешний вызов f не выполнен по формуле.", "Ішкі шақыру нәтижесі жай ғана екі еселенген, ал сыртқы f шақыруы формула бойынша орындалмаған.") },
      ],
    },
    SHARE[level],
  );
}

function tLoop(rand: Rand, level: Level, seed: number): QuestionStep {
  const c = int(rand, 1, 3);
  const m = int(rand, 3, 5);
  const f = (x: number) => x * x - c;
  const sum = (from: number, to: number) => {
    let s = 0;
    for (let i = from; i <= to; i++) s += f(i);
    return s;
  };
  const value = sum(1, m);
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:loop:${c}_${m}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code(["def f(x):", `    return x * x - ${c}`, "", "s = 0", `for i in range(1, ${m + 1}):`, "    s = s + f(i)", "print(s)"]),
      value,
      hint: {
        ru: "Выпиши значения i, которые принимает цикл (последнее число range не входит), и сложи f(i).",
        kk: "Цикл қабылдайтын i мәндерін жаз (range-тің соңғы саны кірмейді) да, f(i) мәндерін қос.",
      },
      explanation: {
        ru: `Цикл идёт от 1 до ${m}: ${Array.from({ length: m }, (_, i) => `f(${i + 1}) = ${f(i + 1)}`).join(", ")}. Сумма равна ${value}.`,
        kk: `Циклдегі i мәндері: 1, 2, …, ${m}. Шақырулар: ${Array.from({ length: m }, (_, i) => `f(${i + 1}) = ${f(i + 1)}`).join(", ")}. Қосынды ${value}.`,
      },
      wrongs: [
        { v: String(sum(1, m - 1)), why: w("Последнее значение i пропущено: range(1, N) не доходит до N.", "i-дің соңғы мәні өткізіліп кеткен: range(1, N) N-ге жетпейді.") },
        { v: String(sum(0, m)), why: w("Добавлено значение i = 0: цикл начинается с 1.", "i = 0 мәні қосылған: цикл 1-ден басталады.") },
        { v: String(value + c * m), why: w("Не вычтено число из return: просуммированы только квадраты.", "return-дегі сан алынбаған: тек квадраттар қосылған.") },
        { v: String(f(m)), why: w("Учтён только последний вызов, а нужна сумма всех.", "Тек соңғы шақыру есепке алынған, ал барлығының қосындысы керек.") },
      ],
    },
    SHARE[level],
  );
}

function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

function tFact(rand: Rand, level: Level, seed: number): QuestionStep {
  const m = int(rand, 3, 5);
  const value = factorial(m);
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:fact:${m}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code(["def fact(n):", "    if n == 1:", "        return 1", "    return n * fact(n - 1)", "", `print(fact(${m}))`]),
      value,
      hint: HINT_REC,
      explanation: {
        ru: `fact(${m}) = ${Array.from({ length: m }, (_, i) => m - i).join(" * ")} = ${value}. Базовый случай n == 1 возвращает 1, остальные вызовы умножают n на ответ следующего.`,
        kk: `fact(${m}) = ${Array.from({ length: m }, (_, i) => m - i).join(" * ")} = ${value}. n == 1 базалық жағдайы 1 қайтарады, қалған шақырулар n санын келесі жауапқа көбейтеді.`,
      },
      wrongs: [
        { v: String(factorial(m - 1)), why: w("Это на один шаг рекурсии меньше: последний множитель потерян.", "Бұл рекурсияның бір қадамына кем: соңғы көбейткіш жоғалған.") },
        { v: String(factorial(m + 1)), why: w("Это на один шаг рекурсии больше, чем нужно.", "Бұл керектіден рекурсияның бір қадамына артық.") },
        { v: String((m * (m + 1)) / 2), why: w("Умножение заменено сложением: получена сумма 1 + 2 + … + n.", "Көбейту қосумен ауыстырылған: 1 + 2 + … + n қосындысы шыққан.") },
        { v: String(m * (m - 1)), why: w("Выполнены только два множителя: n * (n − 1), остальные вызовы потеряны.", "Тек екі көбейткіш орындалған: n * (n − 1), қалған шақырулар жоғалған.") },
      ],
    },
    SHARE[level],
  );
}

type RecKind = "plus" | "double" | "sum";

/** Линейная рекурсия: f(1) = b, дальше f(n − 1) + k, f(n − 1) * 2 или f(n − 1) + n. */
function tRecLin(rand: Rand, level: Level, seed: number): QuestionStep {
  const kind = pick(rand, ["plus", "double", "sum"] as const) as RecKind;
  const b = int(rand, 1, 5);
  const k = int(rand, 2, 5);
  const m = level === 2 ? int(rand, 3, 4) : int(rand, 4, 6);
  const step = (prev: number, n: number) => (kind === "plus" ? prev + k : kind === "double" ? prev * 2 : prev + n);
  const f = (n: number): number => (n === 1 ? b : step(f(n - 1), n));
  const value = f(m);
  const ret = kind === "plus" ? `f(n - 1) + ${k}` : kind === "double" ? "f(n - 1) * 2" : "f(n - 1) + n";
  const chain = Array.from({ length: m }, (_, i) => `f(${i + 1}) = ${f(i + 1)}`).join(", ");
  // Неверные: «базовый случай потерян» (отсчёт от 0), на шаг меньше / больше, операция применена m раз.
  const noBase = (() => {
    const g = (n: number): number => (n === 1 ? 0 : step(g(n - 1), n));
    return g(m);
  })();
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:reclin:${kind}${b}_${k}_${m}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code(["def f(n):", "    if n == 1:", `        return ${b}`, `    return ${ret}`, "", `print(f(${m}))`]),
      value,
      hint: HINT_REC,
      explanation: {
        ru: `Идём от базового случая: ${chain}. Ответ: ${value}.`,
        kk: `Базалық жағдайдан бастаймыз: ${chain}. Жауабы: ${value}.`,
      },
      wrongs: [
        { v: String(f(m - 1)), why: w("Это значение на один шаг рекурсии меньше: последний вызов пропущен.", "Бұл мән рекурсияның бір қадамына кем: соңғы шақыру өткізіліп кеткен.") },
        { v: String(f(m + 1)), why: w("Это значение на один шаг рекурсии больше, чем нужно.", "Бұл мән керектіден рекурсияның бір қадамына артық.") },
        { v: String(noBase), why: w("Базовый случай потерян: вместо f(1) принят 0.", "Базалық жағдай жоғалған: f(1) орнына 0 алынған.") },
      ],
    },
    SHARE[level],
  );
}

// ---------- Уровень 3 (C): несколько шагов, рекурсия, порядок вывода ----------

function digitsOf(n: number): number[] {
  return String(n).split("").map(Number);
}

function tDigits(rand: Rand, level: Level, seed: number): QuestionStep {
  const count = int(rand, 3, 4);
  let n = 0;
  for (let i = 0; i < count; i++) n = n * 10 + int(rand, 1, 9);
  const ds = digitsOf(n);
  const total = ds.reduce((x, y) => x + y, 0);
  const counting = rand() < 0.35;
  if (counting) {
    const value = ds.length;
    return numericStep(
      rand,
      {
        id: `g:${SKILL}:digcount:${n}:${seed}`,
        level,
        prompt: WHAT_PRINTS,
        scene: code(["def c(n):", "    if n < 10:", "        return 1", "    return 1 + c(n // 10)", "", `print(c(${n}))`]),
        value,
        hint: {
          ru: "Каждый вызов отбрасывает последнюю цифру (n // 10) и добавляет 1. Сколько раз это можно сделать, пока не останется одна цифра?",
          kk: "Әр шақыру соңғы цифрды тастайды (n // 10) және 1 қосады. Бір цифр қалғанша мұны неше рет істеуге болады?",
        },
        explanation: {
          ru: `Функция считает цифры числа: каждый вызов убирает одну цифру и добавляет 1, а при n < 10 возвращается 1. В числе ${n} цифр: ${value}.`,
          kk: `Функция санның цифрларын санайды: әр шақыру бір цифрды алып тастап, 1 қосады, ал n < 10 болғанда 1 қайтарылады. ${n} санында ${value} цифр бар.`,
        },
        wrongs: [
          { v: String(value - 1), why: w("Базовый случай n < 10 тоже возвращает 1 — его нельзя потерять.", "n < 10 базалық жағдайы да 1 қайтарады — оны жоғалтуға болмайды.") },
          { v: String(value + 1), why: w("Одна цифра посчитана лишний раз.", "Бір цифр артық саналған.") },
          { v: "1", why: w("Это только ответ базового случая, а рекурсия добавляет ещё единицы.", "Бұл тек базалық жағдайдың жауабы, ал рекурсия тағы бірліктерді қосады.") },
          { v: String(total), why: w("Сложены сами цифры, а функция считает их количество.", "Цифрлардың өздері қосылған, ал функция олардың санын санайды.") },
        ],
      },
      SHARE[level],
    );
  }
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:digsum:${n}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code(["def s(n):", "    if n < 10:", "        return n", "    return n % 10 + s(n // 10)", "", `print(s(${n}))`]),
      value: total,
      hint: {
        ru: "n % 10 — последняя цифра числа, n // 10 — число без последней цифры. Выпиши цифры по очереди.",
        kk: "n % 10 — санның соңғы цифры, n // 10 — соңғы цифрсыз сан. Цифрларды кезегімен жаз.",
      },
      explanation: {
        ru: `Каждый вызов берёт последнюю цифру и вызывает себя для остального числа. Цифры числа ${n}: ${ds.join(" + ")} = ${total}.`,
        kk: `Әр шақыру соңғы цифрды алып, қалған сан үшін өзін шақырады. ${n} санының цифрлары: ${ds.join(" + ")} = ${total}.`,
      },
      wrongs: [
        { v: String(total - ds[ds.length - 1]), why: w("Потеряна последняя цифра: её добавляет n % 10 в первом вызове.", "Соңғы цифр жоғалған: оны бірінші шақырудағы n % 10 қосады.") },
        { v: String(total - ds[0]), why: w("Потеряна первая цифра: базовый случай n < 10 должен вернуть саму n.", "Бірінші цифр жоғалған: n < 10 базалық жағдайы n-нің өзін қайтаруы керек.") },
        { v: String(ds[ds.length - 1]), why: w("Это только n % 10 из первого вызова, остальные цифры добавляет рекурсия.", "Бұл тек бірінші шақырудағы n % 10, қалған цифрларды рекурсия қосады.") },
        { v: String(ds.reduce((x, y) => x * y, 1)), why: w("Цифры перемножены, а в return стоит сложение.", "Цифрлар көбейтілген, ал return-де қосу тұр.") },
      ],
    },
    SHARE[level],
  );
}

/** Вывод рекурсивной функции с print до и/или после вызова; шаг уменьшения 1 или 2. */
function simulatePrint(n: number, stepBy: number, mode: "before" | "after" | "both"): number[] {
  const out: number[] = [];
  const f = (x: number) => {
    if (x <= 0) return;
    if (mode !== "after") out.push(x);
    f(x - stepBy);
    if (mode !== "before") out.push(x);
  };
  f(n);
  return out;
}

function tPrintOrder(rand: Rand, level: Level, seed: number): QuestionStep {
  const stepBy = pick(rand, [1, 1, 2] as const);
  const n = stepBy === 1 ? int(rand, 3, 5) : int(rand, 5, 7);
  const mode = pick(rand, ["before", "after", "both"] as const);
  const j = (xs: number[]) => xs.join(", ");
  const seq = simulatePrint(n, stepBy, mode);
  const lines = [
    "def f(n):",
    "    if n > 0:",
    ...(mode !== "after" ? ["        print(n)"] : []),
    `        f(n - ${stepBy})`,
    ...(mode !== "before" ? ["        print(n)"] : []),
    "",
    `f(${n})`,
  ];
  const before = simulatePrint(n, stepBy, "before");
  const after = simulatePrint(n, stepBy, "after");
  const both = simulatePrint(n, stepBy, "both");
  const label: Record<string, L> = {
    before: w("print стоит до рекурсивного вызова, поэтому числа выводятся при спуске вниз.", "print рекурсивті шақыруға дейін тұр, сондықтан сандар төмен түсу кезінде шығады."),
    after: w("print стоит после рекурсивного вызова, поэтому числа выводятся при возврате.", "print рекурсивті шақырудан кейін тұр, сондықтан сандар оралу кезінде шығады."),
    both: w("print стоит и до, и после вызова: числа выводятся при спуске и при возврате.", "print шақыруға дейін де, одан кейін де тұр: сандар төмен түскенде де, оралғанда да шығады."),
  };
  const wrongs: Wrong[] = [];
  if (mode !== "before") wrongs.push({ v: j(before), why: w("Учтены только числа при спуске вниз; печать после возврата пропущена или поставлена не туда.", "Тек төмен түсу кезіндегі сандар ескерілген; оралғаннан кейінгі шығару өткізілген немесе басқа жерге қойылған.") });
  if (mode !== "after") wrongs.push({ v: j(after), why: w("Учтены только числа при возврате; печать до вызова пропущена.", "Тек оралу кезіндегі сандар ескерілген; шақыруға дейінгі шығару өткізілген.") });
  if (mode !== "both") wrongs.push({ v: j(both), why: w("print в программе один — выведено вдвое больше чисел.", "Программада print біреу — сандар екі есе көп шығарылған.") });
  wrongs.push({ v: j([...seq].slice(0, -1)), why: w("Потеряно последнее выведенное число.", "Соңғы шығарылған сан жоғалған.") });
  wrongs.push({ v: j([...seq, 0]), why: w("0 не печатается: для n ≤ 0 условие n > 0 ложно, и функция ничего не делает.", "0 шығарылмайды: n ≤ 0 болғанда n > 0 шарты жалған, функция ештеңе істемейді.") });
  return choiceStep(rand, {
    id: `g:${SKILL}:printorder:${mode}${stepBy}_${n}:${seed}`,
    level,
    prompt: WHAT_PRINTS_LINES,
    scene: code(lines),
    correct: j(seq),
    wrongs,
    hint: {
      ru: "Выпиши вызовы вниз: f(n), f(n − шаг), … до условия остановки. Что печатается до каждого вызова, а что — после возврата?",
      kk: "Төмен қарай шақыруларды жаз: f(n), f(n − қадам), … тоқтау шартына дейін. Әр шақыруға дейін не шығады, ал оралғаннан кейін не шығады?",
    },
    explanation: {
      ru: `Вызовы идут вниз: ${Array.from({ length: Math.ceil(n / stepBy) }, (_, i) => `f(${n - i * stepBy})`).join(", ")}. ${label[mode].ru} Вывод: ${j(seq)}.`,
      kk: `Шақырулар төмен жүреді: ${Array.from({ length: Math.ceil(n / stepBy) }, (_, i) => `f(${n - i * stepBy})`).join(", ")}. ${label[mode].kk} Шығыс: ${j(seq)}.`,
    },
  });
}

/** Число вызовов функции Фибоначчи: calls(n) = 1 + calls(n − 1) + calls(n − 2). */
function fibCalls(n: number, base: number): number {
  return n <= base ? 1 : 1 + fibCalls(n - 1, base) + fibCalls(n - 2, base);
}
function fibValue(n: number, base: number): number {
  return n <= base ? 1 : fibValue(n - 1, base) + fibValue(n - 2, base);
}

function tCalls(rand: Rand, level: Level, seed: number): QuestionStep {
  const base = pick(rand, [1, 2] as const);
  const n = base === 2 ? int(rand, 4, 6) : int(rand, 3, 5);
  const value = fibCalls(n, base);
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:calls:${base}_${n}:${seed}`,
      level,
      prompt: {
        ru: "Сколько всего раз будет вызвана функция f при выполнении программы? Считай и первый вызов.",
        kk: "Программа орындалғанда f функциясы барлығы неше рет шақырылады? Бірінші шақыруды да есепте.",
      },
      scene: code(["def f(n):", `    if n <= ${base}:`, "        return 1", "    return f(n - 1) + f(n - 2)", "", `print(f(${n}))`]),
      value,
      hint: {
        ru: "Нарисуй дерево вызовов: каждый вызов с большим n порождает два новых, а вызовы с малым n — базовые, они ничего не вызывают.",
        kk: "Шақырулар ағашын сыз: n үлкен әр шақыру екі жаңа шақыру тудырады, ал n кіші шақырулар — базалық, олар ештеңе шақырмайды.",
      },
      explanation: {
        ru: `Число вызовов C(n) = 1 + C(n − 1) + C(n − 2); для n ≤ ${base} вызов один. Считаем снизу: ${Array.from({ length: n - (base - 1) }, (_, i) => `C(${i + base}) = ${fibCalls(i + base, base)}`).join(", ")}. Всего вызовов: ${value}.`,
        kk: `Шақырулар саны C(n) = 1 + C(n − 1) + C(n − 2); n ≤ ${base} үшін шақыру біреу. Төменнен санаймыз: ${Array.from({ length: n - (base - 1) }, (_, i) => `C(${i + base}) = ${fibCalls(i + base, base)}`).join(", ")}. Барлық шақыру: ${value}.`,
      },
      wrongs: [
        { v: String(fibValue(n, base)), why: w("Это значение f(n), а не число вызовов.", "Бұл f(n) мәні, шақырулар саны емес.") },
        { v: String(value - 1), why: w("Первый вызов f не посчитан.", "Бірінші f шақыруы саналмаған.") },
        { v: String(value + 1), why: w("Один вызов посчитан лишний.", "Бір шақыру артық саналған.") },
        { v: String(n), why: w("n — это аргумент, а не число вызовов: каждый вызов порождает ещё два.", "n — бұл аргумент, шақырулар саны емес: әр шақыру тағы екеуін тудырады.") },
      ],
    },
    SHARE[level],
  );
}

function tPower(rand: Rand, level: Level, seed: number): QuestionStep {
  const a = int(rand, 2, 4);
  const n = int(rand, 3, 5);
  const value = a ** n;
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:power:${a}_${n}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code(["def p(a, n):", "    if n == 0:", "        return 1", "    return a * p(a, n - 1)", "", `print(p(${a}, ${n}))`]),
      value,
      hint: HINT_REC,
      explanation: {
        ru: `p(${a}, 0) = 1, дальше каждый вызов умножает на ${a}: ${Array.from({ length: n + 1 }, (_, i) => `p(${a}, ${i}) = ${a ** i}`).join(", ")}. Функция возводит a в степень n: ${value}.`,
        kk: `p(${a}, 0) = 1, одан әрі әр шақыру ${a} санына көбейтеді: ${Array.from({ length: n + 1 }, (_, i) => `p(${a}, ${i}) = ${a ** i}`).join(", ")}. Функция a санын n дәрежесіне шығарады: ${value}.`,
      },
      wrongs: [
        { v: String(a * n), why: w("Степень заменена умножением: a * n.", "Дәреже көбейтумен ауыстырылған: a * n.") },
        { v: String(a ** (n - 1)), why: w("Это на один шаг рекурсии меньше: потерян один множитель.", "Бұл рекурсияның бір қадамына кем: бір көбейткіш жоғалған.") },
        { v: String(a ** (n + 1)), why: w("Это на один шаг рекурсии больше, чем нужно.", "Бұл керектіден рекурсияның бір қадамына артық.") },
        { v: String(n ** a), why: w("Основание и показатель степени перепутаны местами.", "Негіз бен дәреже көрсеткіші орындары ауысқан.") },
      ],
    },
    SHARE[level],
  );
}

function tMulAdd(rand: Rand, level: Level, seed: number): QuestionStep {
  const a = int(rand, 3, 9);
  const b = int(rand, 2, 5);
  const value = a * b;
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:muladd:${a}_${b}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code(["def f(a, b):", "    if b == 0:", "        return 0", "    return a + f(a, b - 1)", "", `print(f(${a}, ${b}))`]),
      value,
      hint: {
        ru: "Выпиши цепочку вызовов: сколько раз выполнится строка return a + … до базового случая b == 0?",
        kk: "Шақырулар тізбегін жаз: b == 0 базалық жағдайына дейін return a + … жолы неше рет орындалады?",
      },
      explanation: {
        ru: `Базовый случай b == 0 возвращает 0, а каждый вызов добавляет a. Вызовов с добавлением ровно ${b}, значит ${Array.from({ length: b }, () => a).join(" + ")} = ${value}. Функция умножает a на b сложением.`,
        kk: `b == 0 базалық жағдайы 0 қайтарады, ал әр шақыру a санын қосады. Қосу бар шақырулар дәл ${b}, демек ${Array.from({ length: b }, () => a).join(" + ")} = ${value}. Функция a санын b санына қосу арқылы көбейтеді.`,
      },
      wrongs: [
        { v: String(a + b), why: w("Сложены сами a и b, а функция добавляет a ровно b раз.", "a мен b сандарының өздері қосылған, ал функция a санын дәл b рет қосады.") },
        { v: String(a * (b + 1)), why: w("Лишнее слагаемое: a берётся b раз, а не b + 1 раз.", "Артық қосылғыш: a саны b + 1 рет емес, b рет алынады.") },
        { v: String(a * (b - 1)), why: w("Потеряно одно слагаемое: a берётся b раз.", "Бір қосылғыш жоғалған: a саны дәл b рет алынады.") },
        { v: String(a ** b), why: w("Функция складывает, а не возводит в степень.", "Функция қосады, дәрежеге шығармайды.") },
      ],
    },
    SHARE[level],
  );
}

type Template = (rand: Rand, level: Level, seed: number) => QuestionStep;

const TEMPLATES: Record<Level, Template[]> = {
  1: [tLin, tOrder, tNone, tTwoCalls, tLin],
  2: [tCond, tPrintRet, tNested, tLoop, tFact, tRecLin],
  3: [tRecLin, tDigits, tPrintOrder, tCalls, tPower, tMulAdd, tPrintOrder],
};

// ---------- Утверждения «верно / неверно» ----------

interface StaticStatement {
  level: Level;
  text: L;
  value: boolean;
  explanation: L;
}

const STATEMENTS: StaticStatement[] = [
  { level: 1, value: true, text: w("Функция без команды return возвращает None", "return командасы жоқ функция None қайтарады"), explanation: w("Если return нет, результат вызова — особое значение None.", "return болмаса, шақыру нәтижесі — ерекше None мәні.") },
  { level: 1, value: false, text: w("Команда def запускает функцию", "def командасы функцияны іске қосады"), explanation: w("def только записывает функцию. Запускает её вызов, например f(3).", "def функцияны тек жазып қояды. Оны шақыру іске қосады, мысалы f(3).") },
  { level: 1, value: false, text: w("print и return делают одно и то же", "print және return бірдей іс атқарады"), explanation: w("print показывает значение на экране, а return отдаёт результат функции.", "print мәнді экранға көрсетеді, ал return функцияның нәтижесін береді.") },
  { level: 1, value: true, text: w("Значение, которое передают функции при вызове, называется аргументом", "Функцияға шақыру кезінде берілетін мән аргумент деп аталады"), explanation: w("В вызове f(3) число 3 — аргумент, а в def f(x) имя x — параметр.", "f(3) шақыруында 3 саны — аргумент, ал def f(x) ішіндегі x аты — параметр.") },
  { level: 1, value: false, text: w("Переменная, созданная внутри функции, видна во всей программе", "Функция ішінде жасалған айнымалы бүкіл программада көрінеді"), explanation: w("Такая переменная локальная: она существует только внутри функции.", "Мұндай айнымалы жергілікті: ол тек функция ішінде бар.") },
  { level: 1, value: true, text: w("Строки внутри функции пишутся с отступом", "Функция ішіндегі жолдар шегініспен жазылады"), explanation: w("Отступ (4 пробела) показывает, какие строки входят в тело функции.", "Шегініс (4 бос орын) қай жолдардың функция денесіне кіретінін көрсетеді.") },
  { level: 2, value: true, text: w("После выполнения return оставшиеся строки функции не выполняются", "return орындалғаннан кейін функцияның қалған жолдары орындалмайды"), explanation: w("return завершает функцию сразу, поэтому строки после него недостижимы.", "return функцияны бірден аяқтайды, сондықтан одан кейінгі жолдарға жету мүмкін емес.") },
  { level: 2, value: false, text: w("Если функция только печатает число, то после a = f(1) в переменной a будет это число", "Функция тек санды шығарса, a = f(1) орындалғаннан кейін a айнымалысында сол сан болады"), explanation: w("print не возвращает значение, поэтому в a попадёт None.", "print мән қайтармайды, сондықтан a-ға None түседі.") },
  { level: 2, value: true, text: w("Параметры функции перечисляются в скобках после её имени", "Функция параметрлері оның атынан кейін жақшада тізіледі"), explanation: w("Например, def f(a, b): — у функции два параметра.", "Мысалы, def f(a, b): — функцияның екі параметрі бар.") },
  { level: 2, value: true, text: w("Одну функцию можно вызывать много раз с разными аргументами", "Бір функцияны әртүрлі аргументтермен көп рет шақыруға болады"), explanation: w("Именно для этого функции и нужны: правило записано один раз, а используется многократно.", "Функциялар дәл осы үшін керек: ереже бір рет жазылады, ал көп рет қолданылады.") },
  { level: 2, value: false, text: w("Вызов f(f(2)) сначала выполняет внешний f", "f(f(2)) шақыруы алдымен сыртқы f орындайды"), explanation: w("Сначала вычисляется внутренний вызов f(2), а его результат передаётся во внешний f.", "Алдымен ішкі f(2) шақыруы есептеледі, оның нәтижесі сыртқы f шақыруына беріледі.") },
  { level: 3, value: true, text: w("Рекурсивная функция должна иметь базовый случай", "Рекурсивті функцияның базалық жағдайы болуы керек"), explanation: w("Базовый случай останавливает цепочку вызовов.", "Базалық жағдай шақырулар тізбегін тоқтатады.") },
  { level: 3, value: false, text: w("Рекурсия без базового случая завершится сама", "Базалық жағдайсыз рекурсия өздігінен аяқталады"), explanation: w("Вызовы идут бесконечно, пока Python не прервёт программу ошибкой RecursionError.", "Шақырулар шексіз жүреді, Python программаны RecursionError қатесімен тоқтатқанша.") },
  { level: 3, value: true, text: w("Если print стоит после рекурсивного вызова, числа выводятся при возврате из вызовов", "print рекурсивті шақырудан кейін тұрса, сандар шақырулардан оралғанда шығады"), explanation: w("Строка после вызова выполняется только тогда, когда вложенные вызовы уже завершились.", "Шақырудан кейінгі жол ішкі шақырулар аяқталған кезде ғана орындалады.") },
  { level: 3, value: false, text: w("В рекурсивном шаге функция вызывает себя с тем же аргументом", "Рекурсия қадамында функция өзін сол аргументпен шақырады"), explanation: w("Аргумент должен приближаться к базовому случаю (например, n − 1), иначе вызовы не закончатся.", "Аргумент базалық жағдайға жақындауы керек (мысалы, n − 1), әйтпесе шақырулар аяқталмайды.") },
];

function valueStatement(rand: Rand, level: Level): Statement {
  if (level === 3) {
    const m = int(rand, 3, 6);
    const value = rand() < 0.5;
    const real = factorial(m);
    const claim = value ? real : pick(rand, [factorial(m - 1), factorial(m + 1), (m * (m + 1)) / 2]);
    return {
      id: `s:${SKILL}:fact:${m}_${claim}`,
      skill: SKILL,
      level,
      text: {
        ru: `fact(n) = n * fact(n − 1), fact(1) = 1, значит fact(${m}) = ${claim}`,
        kk: `fact(n) = n * fact(n − 1), fact(1) = 1 болса, fact(${m}) = ${claim}`,
      },
      value: claim === real,
      explanation: same(`fact(${m}) = ${Array.from({ length: m }, (_, i) => m - i).join(" * ")} = ${real}`),
    };
  }
  const a = int(rand, 2, 5);
  const b = int(rand, 1, 9);
  const k = int(rand, 2, 9);
  const real = a * k + b;
  const value = rand() < 0.5;
  const claim = value ? real : pick(rand, [a * (k + b), a * k, real + 1, real - 1, a + k + b].filter((v) => v !== real));
  return {
    id: `s:${SKILL}:val:${a}_${b}_${k}_${claim}`,
    skill: SKILL,
    level,
    text: {
      ru: `f(x) = ${a} * x + ${b}, значит f(${k}) = ${claim}`,
      kk: `f(x) = ${a} * x + ${b} болса, f(${k}) = ${claim}`,
    },
    value: claim === real,
    explanation: same(`f(${k}) = ${a} * ${k} + ${b} = ${a * k} + ${b} = ${real}`),
  };
}

// ---------- Пары «понятие — значение» ----------

interface StaticPair {
  level: Level;
  left: Text;
  right: Text;
}

const PAIRS: StaticPair[] = [
  { level: 1, left: "def", right: w("создаёт (определяет) функцию", "функцияны жасайды (анықтайды)") },
  { level: 1, left: "return", right: w("возвращает результат и завершает функцию", "нәтижені қайтарады және функцияны аяқтайды") },
  { level: 1, left: w("Параметр", "Параметр"), right: w("имя в скобках при определении функции", "функция анықтамасындағы жақшаның ішіндегі ат") },
  { level: 1, left: w("Аргумент", "Аргумент"), right: w("значение, которое передают при вызове", "шақыру кезінде берілетін мән") },
  { level: 1, left: "None", right: w("результат функции без return", "return жоқ функцияның нәтижесі") },
  { level: 2, left: "print", right: w("показывает значение на экране", "мәнді экранға көрсетеді") },
  { level: 2, left: w("Локальная переменная", "Жергілікті айнымалы"), right: w("существует только внутри функции", "тек функция ішінде бар") },
  { level: 2, left: "f(3)", right: w("вызов функции f с аргументом 3", "f функциясын 3 аргументімен шақыру") },
  { level: 2, left: w("Тело функции", "Функция денесі"), right: w("строки с отступом после def", "def-тен кейінгі шегінісі бар жолдар") },
  { level: 3, left: w("Базовый случай", "Базалық жағдай"), right: w("условие остановки рекурсии", "рекурсияны тоқтату шарты") },
  { level: 3, left: w("Шаг рекурсии", "Рекурсия қадамы"), right: w("функция вызывает себя с меньшим аргументом", "функцияның өзін кішірек аргументпен шақыруы") },
  { level: 3, left: "RecursionError", right: w("рекурсия без остановки", "тоқтамайтын рекурсия") },
  { level: 3, left: w("Стек вызовов", "Шақырулар стегі"), right: w("цепочка вызовов, ожидающих ответ", "жауап күтіп тұрған шақырулар тізбегі") },
];

function valuePair(rand: Rand, level: Level): Pair {
  if (level === 3) {
    const m = int(rand, 3, 6);
    return { id: `p:${SKILL}:fact:${m}`, skill: SKILL, level, left: `fact(${m})`, right: String(factorial(m)) };
  }
  const a = int(rand, 2, 5);
  const b = int(rand, 1, 9);
  const k = int(rand, 2, 9);
  return { id: `p:${SKILL}:val:${a}_${b}_${k}`, skill: SKILL, level, left: `${a} * x + ${b}, x = ${k}`, right: String(a * k + b) };
}

function byLevel<T extends { level: Level }>(items: T[], level: Level): T[] {
  for (const d of [0, -1, 1, -2, 2]) {
    const found = items.filter((x) => x.level === level + d);
    if (found.length) return found;
  }
  return items;
}

// ---------- Короткие вопросы ----------

function shortQuestion(rand: Rand, level: Level): ShortQuestion {
  if (level === 1) {
    if (rand() < 0.3) {
      return {
        id: `q:${SKILL}:none`,
        skill: SKILL,
        level,
        prompt: {
          ru: "Что возвращает функция, в которой нет команды return? Ответ — одним словом.",
          kk: "return командасы жоқ функция не қайтарады? Жауабы — бір сөз.",
        },
        answer: "None",
        mode: "text",
        explanation: w("Без return результат вызова — особое значение None.", "return болмаса, шақыру нәтижесі — ерекше None мәні."),
      };
    }
    const a = int(rand, 2, 5);
    const b = int(rand, 1, 9);
    const k = int(rand, 2, 9);
    return {
      id: `q:${SKILL}:lin:${a}_${b}_${k}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `Функция возвращает ${a} * x + ${b}. Чему равно значение функции при x = ${k}?`,
        kk: `Функция ${a} * x + ${b} мәнін қайтарады. x = ${k} болғанда функцияның мәні неге тең?`,
      },
      answer: String(a * k + b),
      mode: "number",
      explanation: same(`${a} * ${k} + ${b} = ${a * k} + ${b} = ${a * k + b}`),
    };
  }
  if (level === 2) {
    if (rand() < 0.5) {
      const m = int(rand, 3, 6);
      const f = (n: number): number => (n === 1 ? 1 : n + f(n - 1));
      return {
        id: `q:${SKILL}:sumrec:${m}`,
        skill: SKILL,
        level,
        prompt: {
          ru: `f(1) = 1, f(n) = n + f(n − 1). Найди f(${m}).`,
          kk: `f(1) = 1, f(n) = n + f(n − 1). f(${m}) мәнін тап.`,
        },
        answer: String(f(m)),
        mode: "number",
        explanation: same(`${Array.from({ length: m }, (_, i) => i + 1).join(" + ")} = ${f(m)}`),
      };
    }
    const m = int(rand, 3, 6);
    return {
      id: `q:${SKILL}:fact:${m}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `fact(1) = 1, fact(n) = n * fact(n − 1). Найди fact(${m}).`,
        kk: `fact(1) = 1, fact(n) = n * fact(n − 1). fact(${m}) мәнін тап.`,
      },
      answer: String(factorial(m)),
      mode: "number",
      explanation: same(`${Array.from({ length: m }, (_, i) => m - i).join(" * ")} = ${factorial(m)}`),
    };
  }
  if (rand() < 0.5) {
    const n = int(rand, 4, 6);
    return {
      id: `q:${SKILL}:calls:${n}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `f(n) = f(n − 1) + f(n − 2) при n > 2, f(1) = f(2) = 1. Сколько всего вызовов f произойдёт при вычислении f(${n})? Считай и первый вызов.`,
        kk: `n > 2 болғанда f(n) = f(n − 1) + f(n − 2), f(1) = f(2) = 1. f(${n}) есептелгенде f барлығы неше рет шақырылады? Бірінші шақыруды да есепте.`,
      },
      answer: String(fibCalls(n, 2)),
      mode: "number",
      explanation: same(`C(n) = 1 + C(n − 1) + C(n − 2): ${Array.from({ length: n - 1 }, (_, i) => `C(${i + 2}) = ${fibCalls(i + 2, 2)}`).join(", ")}`),
    };
  }
  const count = int(rand, 3, 4);
  let n = 0;
  for (let i = 0; i < count; i++) n = n * 10 + int(rand, 1, 9);
  const ds = digitsOf(n);
  return {
    id: `q:${SKILL}:digsum:${n}`,
    skill: SKILL,
    level,
    prompt: {
      ru: `s(n) = n, если n < 10, иначе s(n) = n % 10 + s(n // 10). Найди s(${n}).`,
      kk: `n < 10 болса, s(n) = n, әйтпесе s(n) = n % 10 + s(n // 10). s(${n}) мәнін тап.`,
    },
    answer: String(ds.reduce((x, y) => x + y, 0)),
    mode: "number",
    explanation: same(`${ds.join(" + ")} = ${ds.reduce((x, y) => x + y, 0)}`),
  };
}

// ---------- Банк навыка ----------

const functions: SkillBank = {
  skill: SKILL,
  question(level, seed) {
    const rand = seeded(seed);
    const make = pick(rand, TEMPLATES[level]);
    return { ...make(rand, level, seed), level };
  },
  statement(level, seed) {
    const rand = seeded(seed);
    if (rand() < 0.65) {
      const st = pick(rand, byLevel(STATEMENTS, level));
      return { id: `s:${SKILL}:st:${st.text.ru.slice(0, 40)}`, skill: SKILL, level: st.level, text: st.text, value: st.value, explanation: st.explanation };
    }
    return valueStatement(rand, level);
  },
  pair(level, seed) {
    const rand = seeded(seed);
    if (level > 1 && rand() < 0.4) return valuePair(rand, level);
    const p = pick(rand, byLevel(PAIRS, level));
    return { id: `p:${SKILL}:t:${typeof p.left === "string" ? p.left : p.left.ru}`, skill: SKILL, level: p.level, left: p.left, right: p.right };
  },
  short(level, seed) {
    return shortQuestion(seeded(seed), level);
  },
};

export const BANKS: SkillBank[] = [functions];
