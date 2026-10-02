import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка py.algos («Сортировка, поиск, файлы и графы»): генератор небольших программ, списков и графов.
// Правильный ответ всегда считает код: функции ниже повторяют логику программы, показанной в сцене.
// Тексты после переменных — без падежных окончаний (в казахском окончание зависит от числа).
// Сверка с реальным python3 и независимыми решателями графов: scripts/out/py-7-algos/verify_bank.py.

const SKILL = "py.algos";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });
const w = (ru: string, kk: string): L => ({ ru, kk });
const code = (lines: string[]): Scene => ({ kind: "code", lang: "python", lines });
const lst = (a: readonly (number | string)[]) => `[${a.join(", ")}]`;
const sup = (n: number) => String(n).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]);
const LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

/** Наименьшее k, при котором 2^k > n: наибольшее число сравнений двоичного поиска (для n не степени двойки совпадает с ⌈log₂ n⌉). */
function binWorst(n: number): number {
  let k = 0;
  while (2 ** k <= n) k++;
  return k;
}

function uniqueNums(rand: Rand, count: number, min: number, max: number): number[] {
  const pool = shuffle(Array.from({ length: max - min + 1 }, (_, i) => min + i), rand);
  return pool.slice(0, count);
}

const isAsc = (a: number[]) => a.every((x, i) => i === 0 || a[i - 1] <= x);
const isDesc = (a: number[]) => a.every((x, i) => i === 0 || a[i - 1] >= x);

// ---------- Общие тексты ----------

const WHAT_PRINTS: L = { ru: "Что выведет программа?", kk: "Программа не шығарады?" };

const HINT_BUBBLE: L = {
  ru: "Пройди слева направо по парам соседей: если левое число больше правого, поменяй их местами. Следующую пару берут уже в обновлённом списке.",
  kk: "Көрші жұптар бойынша солдан оңға қарай жүр: сол жақ сан оң жақтағыдан үлкен болса, орындарын ауыстыр. Келесі жұпты жаңартылған тізімнен алады.",
};
const HINT_BIN: L = {
  ru: "Каждое сравнение отбрасывает половину области поиска. Сколько раз можно поделить n пополам, пока не останется один элемент?",
  kk: "Әр салыстыру іздеу аймағының жартысын тастайды. Бір элемент қалғанша n санын неше рет екіге бөлуге болады?",
};
const HINT_FILE: L = {
  ru: "Посмотри на режим в open: 'w' стирает старое содержимое, 'a' дописывает в конец. Потом посчитай записанные строки.",
  kk: "open ішіндегі режимге қара: 'w' ескі мазмұнды өшіреді, 'a' соңына жалғайды. Содан кейін жазылған жолдарды сана.",
};
const HINT_GRAPH: L = {
  ru: "Выпиши пути из первой вершины в последнюю без повторов вершин и сложи длины дорог каждого пути. Выбери наименьшую сумму.",
  kk: "Бірінші төбеден соңғы төбеге төбелерді қайталамай жолдарды жазып, әр жолдың ұзындықтарын қос. Ең кіші қосындыны таңда.",
};
const HINT_PATHS: L = {
  ru: "Для каждой вершины сложи числа путей тех вершин, из которых в неё идут стрелки. Начни с первой вершины (там 1) и иди по порядку стрелок.",
  kk: "Әр төбе үшін оған көрсеткі келетін төбелердің маршрут сандарын қос. Бірінші төбеден (онда 1) бастап, көрсеткілер ретімен жүр.",
};

const W_OFF1 = w("Ошибка на единицу: проверь счёт по шагам.", "Бірге қателесу: есепті қадамдап тексер.");
const W_ORDER_OTHER = w("Элементы расставлены в другом порядке: сравни с результатом по шагам.", "Элементтер басқа ретпен орналасқан: нәтижені қадамдар бойынша салыстыр.");

// ---------- Сборка заданий ----------

interface Wrong {
  v: Text;
  why: L;
}

const key = (t: Text) => JSON.stringify(t);

/** Варианты: правильный + три разных неверных; недостающие добираются ошибкой на единицу (числа) или другим порядком (списки). */
function makeOptions(rand: Rand, correct: Text, wrongs: Wrong[], base?: number[]): { options: Text[]; correct: number; whyWrong: (L | null)[] } {
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
    for (const d of [1, -1, 2, -2, 3, -3]) {
      if (list.length >= 4) break;
      const v = String(n + d);
      if (Number(v) < 0 || seen.has(key(v))) continue;
      seen.add(key(v));
      list.push({ v, why: W_OFF1 });
    }
  }
  if (base) {
    for (let tries = 0; list.length < 4 && tries < 60; tries++) {
      const v = lst(shuffle(base, rand));
      if (seen.has(key(v))) continue;
      seen.add(key(v));
      list.push({ v, why: W_ORDER_OTHER });
    }
  }
  if (list.length < 4) throw new Error(`py.algos: мало вариантов для ${key(correct)}`);
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
  base?: number[];
}

function choiceStep(rand: Rand, a: ChoiceArgs): ChoiceStep {
  const o = makeOptions(rand, a.correct, a.wrongs, a.base);
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

// ---------- Сортировка: модели ----------

/** Состояние списка после `passes` проходов пузырька (проход i сравнивает пары до конца непросмотренной части). */
function bubblePasses(a: number[], passes: number): { list: number[]; swapsByPass: number[] } {
  const x = [...a];
  const swapsByPass: number[] = [];
  for (let p = 0; p < passes && p < x.length - 1; p++) {
    let s = 0;
    for (let i = 0; i < x.length - 1 - p; i++) {
      if (x[i] > x[i + 1]) {
        [x[i], x[i + 1]] = [x[i + 1], x[i]];
        s++;
      }
    }
    swapsByPass.push(s);
  }
  return { list: x, swapsByPass };
}

/** Программа из «стандартного» пузырька без сокращения внутреннего цикла: проход всегда идёт по всему списку (как в ЕНТ-заданиях). */
function bubbleFullPasses(a: number[], passes: number): number[] {
  const x = [...a];
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < x.length - 1; i++) {
      if (x[i] > x[i + 1]) [x[i], x[i + 1]] = [x[i + 1], x[i]];
    }
  }
  return x;
}

function selectionPasses(a: number[], passes: number): number[] {
  const x = [...a];
  for (let p = 0; p < passes && p < x.length - 1; p++) {
    let m = p;
    for (let j = p + 1; j < x.length; j++) if (x[j] < x[m]) m = j;
    [x[p], x[m]] = [x[m], x[p]];
  }
  return x;
}

const inversions = (a: number[]) => a.reduce((s, x, i) => s + a.slice(i + 1).filter((y) => y < x).length, 0);

const rowScene = (a: number[]): Scene => ({
  kind: "table",
  rows: [a.map(String)],
  caption: { ru: "Исходный список", kk: "Бастапқы тізім" },
});

// ---------- Уровень 1 (A): применить правило по образцу ----------

function tSorted(rand: Rand, level: Level, seed: number): QuestionStep {
  const n = int(rand, 3, 4);
  let a = uniqueNums(rand, n, 1, 9);
  for (let i = 0; i < 30 && (isAsc(a) || isDesc(a)); i++) a = uniqueNums(rand, n, 1, 9);
  const asc = [...a].sort((x, y) => x - y);
  const desc = [...asc].reverse();
  const kind = pick(rand, ["sorted", "sortdesc", "keep", "none"] as const);
  const head = `a = ${lst(a)}`;
  const tag = a.join("");
  const swapAdj = [...asc];
  [swapAdj[0], swapAdj[1]] = [swapAdj[1], swapAdj[0]];
  const wAsc = w("Список отсортирован по возрастанию, а в программе это не так.", "Тізім өсу ретімен сұрыпталған, ал бағдарламада олай емес.");
  const wDesc = w("Список отсортирован по убыванию, а в программе это не так.", "Тізім кему ретімен сұрыпталған, ал бағдарламада олай емес.");
  const wOrig = w("Исходный порядок сохранён: сортировка здесь не меняет выводимый список.", "Бастапқы реттілік сақталған: сұрыптау шығарылатын тізімді мұнда өзгертпейді.");
  const wSwap = w("Отсортированы не все элементы: проверь порядок всего списка.", "Барлық элементтер сұрыпталмаған: бүкіл тізімнің ретін тексер.");
  if (kind === "sorted") {
    return choiceStep(rand, {
      id: `g:${SKILL}:sorted:${tag}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code([head, "print(sorted(a))"]),
      correct: lst(asc),
      wrongs: [
        { v: lst(a), why: wOrig },
        { v: lst(desc), why: w("Это порядок по убыванию: sorted без reverse=True сортирует по возрастанию.", "Бұл кему реті: reverse=True жоқ sorted өсу ретімен сұрыптайды.") },
        { v: lst(swapAdj), why: wSwap },
      ],
      base: a,
      hint: { ru: "sorted(a) возвращает новый список, упорядоченный по возрастанию. Расставь числа от меньшего к большему.", kk: "sorted(a) өсу ретімен реттелген жаңа тізім қайтарады. Сандарды кішіден үлкенге қарай орналастыр." },
      explanation: {
        ru: `sorted(a) возвращает новый список, упорядоченный по возрастанию: ${lst(asc)}. Его и печатает print.`,
        kk: `sorted(a) өсу ретімен реттелген жаңа тізім қайтарады: ${lst(asc)}. Оны print шығарады.`,
      },
    });
  }
  if (kind === "sortdesc") {
    return choiceStep(rand, {
      id: `g:${SKILL}:sortdesc:${tag}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code([head, "a.sort(reverse=True)", "print(a)"]),
      correct: lst(desc),
      wrongs: [
        { v: lst(asc), why: w("Это порядок по возрастанию: reverse=True включает сортировку по убыванию.", "Бұл өсу реті: reverse=True кему ретімен сұрыптауды қосады.") },
        { v: lst(a), why: wOrig },
        { v: "None", why: w("None возвращает сам метод sort(), но печатается список a, который он изменил.", "None-ды sort() әдісінің өзі қайтарады, бірақ ол өзгерткен a тізімі шығарылады.") },
      ],
      base: a,
      hint: { ru: "Метод sort() меняет сам список. Параметр reverse=True означает порядок от большего к меньшему.", kk: "sort() әдісі тізімнің өзін өзгертеді. reverse=True параметрі үлкеннен кішіге қарай ретті білдіреді." },
      explanation: {
        ru: `a.sort(reverse=True) сортирует сам список по убыванию, поэтому print(a) выводит ${lst(desc)}.`,
        kk: `a.sort(reverse=True) тізімнің өзін кему ретімен сұрыптайды, сондықтан print(a) ${lst(desc)} шығарады.`,
      },
    });
  }
  if (kind === "keep") {
    return choiceStep(rand, {
      id: `g:${SKILL}:keep:${tag}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code([head, "b = sorted(a)", "print(a)"]),
      correct: lst(a),
      wrongs: [
        { v: lst(asc), why: w("sorted(a) создаёт новый список b, а сам a не меняет: печатается a.", "sorted(a) жаңа b тізімін жасайды, a-ны өзгертпейді: a шығарылады.") },
        { v: lst(desc), why: wDesc },
        { v: "None", why: w("None даёт метод sort(), а здесь вызвана функция sorted, и печатается список a.", "None-ды sort() әдісі береді, ал мұнда sorted функциясы шақырылған және a тізімі шығарылады.") },
      ],
      base: a,
      hint: { ru: "Функция sorted не меняет исходный список, а создаёт новый. Что печатает print(a)?", kk: "sorted функциясы бастапқы тізімді өзгертпейді, жаңасын жасайды. print(a) не шығарады?" },
      explanation: {
        ru: `sorted(a) возвращает новый отсортированный список и записывает его в b. Сам a не изменился, поэтому print(a) выводит ${lst(a)}.`,
        kk: `sorted(a) жаңа сұрыпталған тізім қайтарып, оны b-ға жазады. a өзі өзгермеді, сондықтан print(a) ${lst(a)} шығарады.`,
      },
    });
  }
  return choiceStep(rand, {
    id: `g:${SKILL}:none:${tag}:${seed}`,
    level,
    prompt: WHAT_PRINTS,
    scene: code([head, "a = a.sort()", "print(a)"]),
    correct: "None",
    wrongs: [
      { v: lst(asc), why: w("Метод sort() сортирует список, но возвращает None, и присваивание затирает a значением None.", "sort() әдісі тізімді сұрыптайды, бірақ None қайтарады, ал меншіктеу a-ны None мәнімен ауыстырады.") },
      { v: lst(a), why: wOrig },
      { v: { ru: "Ошибка", kk: "Қате" }, why: w("Ошибки нет: строка выполняется, просто в a попадает значение None.", "Қате жоқ: жол орындалады, тек a-ға None мәні түседі.") },
      { v: lst(desc), why: wDesc },
    ],
    hint: { ru: "Что возвращает метод sort()? И что окажется в a после присваивания?", kk: "sort() әдісі не қайтарады? Меншіктеуден кейін a ішінде не болады?" },
    explanation: {
      ru: "Метод sort() сортирует список на месте и возвращает None. Присваивание a = a.sort() записывает в a значение None, поэтому print(a) выводит None.",
      kk: "sort() әдісі тізімді орнында сұрыптап, None қайтарады. a = a.sort() меншіктеуі a-ға None мәнін жазады, сондықтан print(a) None шығарады.",
    },
  });
}

function tLinear(rand: Rand, level: Level, seed: number): QuestionStep {
  const n = int(rand, 8, 40);
  const absent = rand() < 0.4;
  const k = int(rand, 2, n - 1);
  if (absent) {
    return numericStep(
      rand,
      {
        id: `g:${SKILL}:linabsent:${n}:${seed}`,
        level,
        prompt: {
          ru: `В неотсортированном списке n = ${n} элементов. Искомого элемента в списке нет. Сколько сравнений выполнит линейный поиск, чтобы в этом убедиться?`,
          kk: `Сұрыпталмаған тізімде n = ${n} элемент бар. Іздеген элемент тізімде жоқ. Бұған көз жеткізу үшін сызықтық іздеу неше салыстыру жасайды?`,
        },
        scene: { kind: "cards", items: [{ icon: "search", title: { ru: "Линейный поиск", kk: "Сызықтық іздеу" }, text: { ru: "Смотрим элементы по одному", kk: "Элементтерді бір-бірлеп қараймыз" } }] },
        value: n,
        hint: { ru: "Линейный поиск смотрит элементы по одному. Если нужного нет, сколько из них придётся просмотреть?", kk: "Сызықтық іздеу элементтерді бір-бірлеп қарайды. Керегі болмаса, олардың қаншасын қарау керек?" },
        explanation: {
          ru: `Если элемента нет, придётся сравнить его со всеми элементами списка: n = ${n} сравнений.`,
          kk: `Элемент жоқ болса, оны тізімнің барлық элементімен салыстыру керек: n = ${n} салыстыру.`,
        },
        wrongs: [
          { v: String(n - 1), why: w("Один элемент пропущен: убедиться, что элемента нет, можно только просмотрев все.", "Бір элемент өткізіліп кеткен: элементтің жоқтығына барлығын қарап шыққанда ғана көз жеткізуге болады.") },
          { v: String(Math.ceil(n / 2)), why: w("Половину списка просматривает только двоичный поиск и только в отсортированном списке.", "Тізімнің жартысын тек екілік іздеу қарайды, ол да тек сұрыпталған тізімде.") },
          { v: String(binWorst(n)), why: w("Это число сравнений двоичного поиска, а список не отсортирован, поэтому он не применим.", "Бұл екілік іздеудің салыстыру саны, ал тізім сұрыпталмаған, сондықтан ол қолданылмайды.") },
        ],
      },
      SHARE[level],
    );
  }
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:linpos:${n}_${k}:${seed}`,
      level,
      prompt: {
        ru: `В неотсортированном списке n = ${n} элементов. Искомый элемент стоит на месте с номером k = ${k} (счёт с 1). Сколько сравнений выполнит линейный поиск?`,
        kk: `Сұрыпталмаған тізімде n = ${n} элемент бар. Іздеген элемент орнының нөмірі k = ${k} (санау 1-ден басталады). Сызықтық іздеу неше салыстыру жасайды?`,
      },
      scene: { kind: "cards", items: [{ icon: "search", title: { ru: "Линейный поиск", kk: "Сызықтық іздеу" }, text: { ru: "Смотрим элементы по одному", kk: "Элементтерді бір-бірлеп қараймыз" } }] },
      value: k,
      hint: { ru: "Линейный поиск идёт с начала и останавливается, когда находит элемент. Сколько элементов он успеет просмотреть?", kk: "Сызықтық іздеу басынан басталып, элементті тапқанда тоқтайды. Ол қанша элемент қарап үлгереді?" },
      explanation: {
        ru: `Поиск идёт с начала и останавливается на нужном элементе: просмотрено ${k} элементов, значит ${k} сравнений.`,
        kk: `Іздеу басынан басталып, керекті элементте тоқтайды: ${k} элемент қаралды, демек ${k} салыстыру.`,
      },
      wrongs: [
        { v: String(k - 1), why: w("Сам найденный элемент тоже сравнивается с искомым: его нельзя не считать.", "Табылған элементтің өзі де ізделіп жатқанмен салыстырылады: оны санамауға болмайды.") },
        { v: String(n), why: w("Поиск останавливается сразу, как только элемент найден, и не доходит до конца списка.", "Іздеу элемент табылғаннан кейін бірден тоқтайды және тізімнің соңына дейін бармайды.") },
        { v: String(n - k + 1), why: w("Поиск идёт с начала списка, а не с конца.", "Іздеу тізімнің басынан басталады, соңынан емес.") },
        { v: String(binWorst(n)), why: w("Это число сравнений двоичного поиска, а список не отсортирован.", "Бұл екілік іздеудің салыстыру саны, ал тізім сұрыпталмаған.") },
      ],
    },
    SHARE[level],
  );
}

function tFileCount(rand: Rand, level: Level, seed: number): QuestionStep {
  const before = int(rand, 2, 6);
  const mode = rand() < 0.5 ? "w" : "a";
  const writes = int(rand, 1, 3);
  const lines = ['f = open("notes.txt", "' + mode + '", encoding="utf-8")'];
  for (let i = 1; i <= writes; i++) lines.push(`f.write("line ${i}\\n")`);
  lines.push("f.close()");
  const value = mode === "w" ? writes : before + writes;
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:file:${mode}${before}_${writes}:${seed}`,
      level,
      prompt: {
        ru: `До запуска программы в файле notes.txt было ${before} строк. Сколько строк будет в файле после её выполнения?`,
        kk: `Бағдарлама іске қосылғанға дейін notes.txt файлында ${before} жол болған. Ол орындалғаннан кейін файлда неше жол болады?`,
      },
      scene: code(lines),
      value,
      hint: HINT_FILE,
      explanation: {
        ru: mode === "w"
          ? `Режим 'w' стирает старое содержимое: ${before} прежних строк исчезают. Записано ${writes}, значит в файле ${value}.`
          : `Режим 'a' дописывает в конец и сохраняет старые строки: ${before} + ${writes} = ${value}.`,
        kk: mode === "w"
          ? `'w' режимі ескі мазмұнды өшіреді: бұрынғы ${before} жол жоғалады. ${writes} жол жазылды, демек файлда ${value}.`
          : `'a' режимі соңына жалғайды және ескі жолдарды сақтайды: ${before} + ${writes} = ${value}.`,
      },
      wrongs:
        mode === "w"
          ? [
              { v: String(before + writes), why: w("Так получилось бы в режиме 'a'. Режим 'w' сначала стирает файл.", "Бұлай 'a' режимінде болар еді. 'w' режимі алдымен файлды өшіреді.") },
              { v: String(before), why: w("Старые строки в режиме 'w' не сохраняются, а новые записываются.", "'w' режимінде ескі жолдар сақталмайды, ал жаңалары жазылады.") },
              { v: String(writes + 1), why: w("Лишняя строка: пустых строк программа не пишет.", "Артық жол: бағдарлама бос жолдарды жазбайды.") },
            ]
          : [
              { v: String(writes), why: w("Так получилось бы в режиме 'w' (он стирает файл). Режим 'a' сохраняет старое.", "Бұлай 'w' режимінде болар еді (ол файлды өшіреді). 'a' режимі ескіні сақтайды.") },
              { v: String(before), why: w("Новые строки тоже записываются: их нужно добавить к старым.", "Жаңа жолдар да жазылады: оларды ескілерге қосу керек.") },
              { v: String(before + writes - 1), why: w("Одна записанная строка потеряна при счёте.", "Жазылған бір жол санау кезінде жоғалған.") },
            ],
    },
    SHARE[level],
  );
}

// ---------- Уровни 1–3: пузырёк и выбор ----------

/** Список из n различных чисел, у которого после `passes` проходов список ещё не отсортирован и отличается от исходного. */
function bubbleCase(rand: Rand, n: number, passes: number): number[] {
  for (let i = 0; i < 200; i++) {
    const a = uniqueNums(rand, n, 1, 9);
    const r = bubblePasses(a, passes).list;
    const full = [...a].sort((x, y) => x - y);
    const prev = bubblePasses(a, passes - 1).list;
    const sel = selectionPasses(a, passes);
    if (r.join() !== full.join() && r.join() !== a.join() && r.join() !== prev.join() && r.join() !== sel.join()) return a;
  }
  return [4, 2, 5, 1, 3, 6].slice(0, n);
}

function tBubble(rand: Rand, level: Level, seed: number, n: number, passes: number): QuestionStep {
  const a = bubbleCase(rand, n, passes);
  const res = bubblePasses(a, passes).list;
  const full = [...a].sort((x, y) => x - y);
  const prev = bubblePasses(a, passes - 1).list;
  const next = bubblePasses(a, passes + 1).list;
  const sel = selectionPasses(a, passes);
  const firstSwap = (() => {
    const x = [...a];
    if (x[0] > x[1]) [x[0], x[1]] = [x[1], x[0]];
    return x;
  })();
  const passWord = passes === 1 ? { ru: "1-го прохода", kk: "1-өтуден" } : { ru: `${passes} проходов`, kk: `${passes} өтуден` };
  const wrongs: Wrong[] = [
    { v: lst(full), why: w("Это полностью отсортированный список: за указанное число проходов пузырёк не успевает отсортировать всё.", "Бұл толық сұрыпталған тізім: көрсетілген өту санында көпіршік бәрін сұрыптап үлгермейді.") },
    { v: lst(prev), why: passes === 1 ? w("Это исходный список: проход его меняет.", "Бұл бастапқы тізім: өту оны өзгертеді.") : w("Это список после меньшего числа проходов: один проход пропущен.", "Бұл өту саны аз тізім: бір өту өткізіліп кеткен.") },
    { v: lst(sel), why: w("Так выглядит список после сортировки выбором, а здесь пузырёк.", "Тізім таңдау арқылы сұрыптаудан кейін осылай көрінеді, ал мұнда — көпіршік.") },
    { v: lst(next), why: w("Выполнен лишний проход.", "Артық өту орындалған.") },
    { v: lst(firstSwap), why: w("Выполнено только первое сравнение пары: проход идёт до конца списка.", "Тек жұптың бірінші салыстыруы орындалған: өту тізімнің соңына дейін жүреді.") },
  ];
  const passesText = passes === 1
    ? bubblePasses(a, 1).swapsByPass[0]
    : bubblePasses(a, passes).swapsByPass.join(" + ");
  const steps = Array.from({ length: passes }, (_, i) => `${i + 1}-й проход → ${lst(bubblePasses(a, i + 1).list)}`).join("; ");
  const stepsKk = Array.from({ length: passes }, (_, i) => `${i + 1}-өту → ${lst(bubblePasses(a, i + 1).list)}`).join("; ");
  return choiceStep(rand, {
    id: `g:${SKILL}:bub:${n}p${passes}_${a.join("")}:${seed}`,
    level,
    prompt: {
      ru: `Список сортируют пузырьком по возрастанию. Каким станет список после ${passWord.ru}?`,
      kk: `Тізім өсу ретімен көпіршікпен сұрыпталады. ${passWord.kk} кейін тізім қандай болады?`,
    },
    scene: rowScene(a),
    correct: lst(res),
    wrongs,
    base: res,
    hint: HINT_BUBBLE,
    explanation: {
      ru: `Сравниваем соседей слева направо и меняем, если левый больше. ${steps}. После ${passWord.ru} получается ${lst(res)} (обменов: ${passesText}).`,
      kk: `Көршілерді солдан оңға қарай салыстырып, сол жақтағысы үлкен болса ауыстырамыз. ${stepsKk}. ${passWord.kk} кейін ${lst(res)} шығады (алмасулар: ${passesText}).`,
    },
  });
}

/** То же с программой: внешний цикл range(p), внутренний идёт по всему списку (сцена-код). */
function tBubbleCode(rand: Rand, level: Level, seed: number): QuestionStep {
  const n = int(rand, 5, 6);
  const passes = int(rand, 2, 3);
  let a = uniqueNums(rand, n, 1, 9);
  for (let i = 0; i < 200; i++) {
    const r = bubbleFullPasses(a, passes);
    const full = [...a].sort((x, y) => x - y);
    if (r.join() !== full.join() && r.join() !== bubbleFullPasses(a, passes - 1).join() && r.join() !== selectionPasses(a, passes).join()) break;
    a = uniqueNums(rand, n, 1, 9);
  }
  const res = bubbleFullPasses(a, passes);
  const full = [...a].sort((x, y) => x - y);
  const wrongs: Wrong[] = [
    { v: lst(bubbleFullPasses(a, passes - 1)), why: w(`Это результат на один проход меньше: внешний цикл выполняется ${passes} раза.`, `Бұл бір өтуге аз нәтиже: сыртқы цикл ${passes} рет орындалады.`) },
    { v: lst(selectionPasses(a, passes)), why: w("Так выглядит список после сортировки выбором, а в программе — пузырёк.", "Тізім таңдау арқылы сұрыптаудан кейін осылай көрінеді, ал бағдарламада — көпіршік.") },
    { v: lst(full), why: w("Список полностью отсортирован, но для этого указанного числа проходов мало.", "Тізім толық сұрыпталған, бірақ ол үшін көрсетілген өту саны аз.") },
    { v: lst(bubbleFullPasses(a, passes + 1)), why: w("Выполнен лишний проход.", "Артық өту орындалған.") },
  ];
  const steps = Array.from({ length: passes }, (_, i) => `${i + 1}: ${lst(bubbleFullPasses(a, i + 1))}`).join("; ");
  return choiceStep(rand, {
    id: `g:${SKILL}:bubcode:${n}p${passes}_${a.join("")}:${seed}`,
    level,
    prompt: WHAT_PRINTS,
    scene: code([
      `a = ${lst(a)}`,
      `for p in range(${passes}):`,
      "    for i in range(len(a) - 1):",
      "        if a[i] > a[i + 1]:",
      "            a[i], a[i + 1] = a[i + 1], a[i]",
      "print(a)",
    ]),
    correct: lst(res),
    wrongs,
    base: res,
    hint: {
      ru: "Внутренний цикл — один проход по всем парам соседей. Выполни его столько раз, сколько указано в range, каждый раз начиная с обновлённого списка.",
      kk: "Ішкі цикл — барлық көрші жұптар бойынша бір өту. Оны range ішінде көрсетілген рет орында, әр жолы жаңартылған тізімнен бастап.",
    },
    explanation: {
      ru: `Внешний цикл повторяет проход ${passes} раза. После каждого прохода: ${steps}. Выводится ${lst(res)}.`,
      kk: `Сыртқы цикл өтуді ${passes} рет қайталайды. Әр өтуден кейін: ${steps}. ${lst(res)} шығады.`,
    },
  });
}

function tSelPass(rand: Rand, level: Level, seed: number): QuestionStep {
  const passes = int(rand, 1, 2);
  let a = uniqueNums(rand, 5, 1, 9);
  for (let i = 0; i < 200; i++) {
    const r = selectionPasses(a, passes);
    if (r.join() !== a.join() && r.join() !== bubblePasses(a, passes).list.join() && r.join() !== [...a].sort((x, y) => x - y).join()) break;
    a = uniqueNums(rand, 5, 1, 9);
  }
  const res = selectionPasses(a, passes);
  const word = passes === 1 ? { ru: "1-го прохода", kk: "1-өтуден" } : { ru: "2 проходов", kk: "2 өтуден" };
  const trace = Array.from({ length: passes }, (_, i) => `${i + 1}-й проход → ${lst(selectionPasses(a, i + 1))}`).join("; ");
  const traceKk = Array.from({ length: passes }, (_, i) => `${i + 1}-өту → ${lst(selectionPasses(a, i + 1))}`).join("; ");
  return choiceStep(rand, {
    id: `g:${SKILL}:sel:${passes}_${a.join("")}:${seed}`,
    level,
    prompt: {
      ru: `Список сортируют выбором по возрастанию: на каждом проходе наименьшее из оставшихся чисел ставят на своё место. Каким станет список после ${word.ru}?`,
      kk: `Тізім өсу ретімен таңдау арқылы сұрыпталады: әр өтуде қалған сандардың ең кішісін өз орнына қояды. ${word.kk} кейін тізім қандай болады?`,
    },
    scene: rowScene(a),
    correct: lst(res),
    wrongs: [
      { v: lst(bubblePasses(a, passes).list), why: w("Так выглядит список после пузырька, а здесь сортировка выбором.", "Тізім көпіршіктен кейін осылай көрінеді, ал мұнда — таңдау арқылы сұрыптау.") },
      { v: lst(selectionPasses(a, passes - 1)), why: passes === 1 ? w("Это исходный список: проход его меняет.", "Бұл бастапқы тізім: өту оны өзгертеді.") : w("Это результат после меньшего числа проходов.", "Бұл өту саны аз болғандағы нәтиже.") },
      { v: lst([...a].sort((x, y) => x - y)), why: w("Это полностью отсортированный список: так быстро он не получается.", "Бұл толық сұрыпталған тізім: ол мұншалықты тез шықпайды.") },
      { v: lst(selectionPasses(a, passes + 1)), why: w("Выполнен лишний проход.", "Артық өту орындалған.") },
    ],
    base: res,
    hint: {
      ru: "На каждом проходе найди наименьшее из ещё не стоящих на месте чисел и поменяй его местами с числом, которое занимает его будущее место.",
      kk: "Әр өтуде өз орнында тұрмаған сандардың ең кішісін тауып, оны болашақ орнындағы санмен ауыстыр.",
    },
    explanation: {
      ru: `Ищем наименьшее из оставшихся и меняем с первым из них. ${trace}. После ${word.ru} получается ${lst(res)}.`,
      kk: `Қалғанының ең кішісін тауып, оны солардың біріншісімен ауыстырамыз. ${traceKk}. ${word.kk} кейін ${lst(res)} шығады.`,
    },
  });
}

function tSwaps(rand: Rand, level: Level, seed: number): QuestionStep {
  const n = int(rand, 5, 6);
  let a = uniqueNums(rand, n, 1, 9);
  for (let i = 0; i < 100 && (inversions(a) < 3 || inversions(a) > 10); i++) a = uniqueNums(rand, n, 1, 9);
  const value = inversions(a);
  const comparisons = (n * (n - 1)) / 2;
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:swaps:${n}_${a.join("")}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code([
        `a = ${lst(a)}`,
        "k = 0",
        "for p in range(len(a) - 1):",
        "    for i in range(len(a) - 1 - p):",
        "        if a[i] > a[i + 1]:",
        "            a[i], a[i + 1] = a[i + 1], a[i]",
        "            k += 1",
        "print(k)",
      ]),
      value,
      hint: {
        ru: "k считает обмены. Выполни сортировку по проходам и записывай, сколько обменов произошло в каждом проходе.",
        kk: "k алмасуларды санайды. Сұрыптауды өтулер бойынша орындап, әр өтуде неше алмасу болғанын жаз.",
      },
      explanation: {
        ru: `Переменная k считает обмены. По проходам: ${bubblePasses(a, n - 1).swapsByPass.join(" + ")} = ${value}. Это число пар, где большее число стоит левее меньшего.`,
        kk: `k айнымалысы алмасуларды санайды. Өтулер бойынша: ${bubblePasses(a, n - 1).swapsByPass.join(" + ")} = ${value}. Бұл үлкен сан кішіден сол жақта тұрған жұптар саны.`,
      },
      wrongs: [
        { v: String(comparisons), why: w("Это число всех сравнений, а k растёт только при обмене.", "Бұл барлық салыстырулар саны, ал k тек алмасу болғанда өседі.") },
        { v: String(n - 1), why: w("Это число проходов, а не обменов: в одном проходе обменов может быть несколько.", "Бұл өтулер саны, алмасулар емес: бір өтуде бірнеше алмасу болуы мүмкін.") },
        { v: String(value + 1), why: W_OFF1 },
        { v: String(value - 1), why: W_OFF1 },
      ],
    },
    SHARE[level],
  );
}

// ---------- Двоичный поиск ----------

function tBinCount(rand: Rand, level: Level, seed: number): QuestionStep {
  const n = pick(rand, [20, 30, 50, 100, 150, 200, 300, 500, 700, 1000, 2000, 5000, 10000]);
  const value = binWorst(n);
  const chain: number[] = [];
  for (let s = n; s >= 1; s = Math.floor(s / 2)) chain.push(s);
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:bincount:${n}:${seed}`,
      level,
      prompt: {
        ru: `Отсортированный список содержит n = ${n} элементов. Какое наибольшее число сравнений нужно двоичному поиску?`,
        kk: `Сұрыпталған тізімде n = ${n} элемент бар. Екілік іздеуге ең көп дегенде неше салыстыру керек?`,
      },
      scene: { kind: "cards", items: [{ icon: "split", title: { ru: "Двоичный поиск", kk: "Екілік іздеу" }, text: { ru: "Каждый раз отбрасываем половину", kk: "Әр жолы жартысын тастаймыз" } }] },
      value,
      hint: HINT_BIN,
      explanation: {
        ru: `Каждое сравнение сокращает область вдвое: ${chain.join(" → ")}, то есть ${value} сравнений. Через степени двойки: 2${sup(value - 1)} = ${2 ** (value - 1)} ≤ ${n} < ${2 ** value} = 2${sup(value)}, поэтому ${value}.`,
        kk: `Әр салыстыру аймақты екі есе қысқартады: ${chain.join(" → ")}, яғни ${value} салыстыру. Екінің дәрежелері арқылы: 2${sup(value - 1)} = ${2 ** (value - 1)} ≤ ${n} < ${2 ** value} = 2${sup(value)}, сондықтан ${value}.`,
      },
      wrongs: [
        { v: String(n), why: w("Это число сравнений линейного поиска. Двоичный поиск отбрасывает половину за раз.", "Бұл сызықтық іздеудің салыстыру саны. Екілік іздеу бір рет жартысын тастайды.") },
        { v: String(Math.floor(n / 2)), why: w("Это половина списка: двоичный поиск делит область пополам снова и снова, а не один раз.", "Бұл тізімнің жартысы: екілік іздеу аймақты қайта-қайта екіге бөледі, бір рет емес.") },
        { v: String(value - 1), why: w("Потерян один шаг: последнее сравнение, когда остаётся один элемент, тоже считается.", "Бір қадам жоғалған: бір элемент қалғандағы соңғы салыстыру да есептеледі.") },
        { v: String(value + 1), why: w("Один шаг лишний: ближайшая сверху степень двойки уже даёт нужное число.", "Бір қадам артық: жоғарыдан ең жақын екінің дәрежесі керекті санды береді.") },
      ],
    },
    SHARE[level],
  );
}

/** Двоичный поиск: сколько раз выполнится тело цикла (число сравнений с a[m]). */
function binTrace(a: number[], x: number): number {
  let l = 0;
  let r = a.length - 1;
  let k = 0;
  while (l <= r) {
    const m = Math.floor((l + r) / 2);
    k++;
    if (a[m] === x) break;
    if (a[m] < x) l = m + 1;
    else r = m - 1;
  }
  return k;
}

function tBinTrace(rand: Rand, level: Level, seed: number, absent: boolean): QuestionStep {
  const n = int(rand, 7, 10);
  const a: number[] = [];
  let cur = int(rand, 1, 6);
  for (let i = 0; i < n; i++) {
    a.push(cur);
    cur += int(rand, 2, 7);
  }
  let x: number;
  if (absent) {
    // Число, которого нет: между элементами (или за краем).
    const gap = int(rand, 0, n);
    x = gap === 0 ? a[0] - 1 : gap === n ? a[n - 1] + 1 : a[gap - 1] + 1;
    if (a.includes(x)) x = a[gap - 1] + 1;
  } else {
    const idx = int(rand, 0, n - 1);
    x = a[idx];
  }
  const value = binTrace(a, x);
  const idx = a.indexOf(x);
  const linear = idx >= 0 ? idx + 1 : n;
  const lines = [
    `a = ${lst(a)}`,
    `x = ${x}`,
    "l = 0",
    "r = len(a) - 1",
    "k = 0",
    "while l <= r:",
    "    m = (l + r) // 2",
    "    k += 1",
    "    if a[m] == x:",
    "        break",
    "    if a[m] < x:",
    "        l = m + 1",
    "    else:",
    "        r = m - 1",
    "print(k)",
  ];
  // Разбор по шагам: какие индексы просмотрены.
  const seq: string[] = [];
  {
    let l = 0;
    let r = n - 1;
    while (l <= r) {
      const m = Math.floor((l + r) / 2);
      seq.push(`m = ${m} (a[m] = ${a[m]})`);
      if (a[m] === x) break;
      if (a[m] < x) l = m + 1;
      else r = m - 1;
    }
  }
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:bintrace:${absent ? "no" : "yes"}${n}_${x}_${a[0]}${a[n - 1]}:${seed}`,
      level,
      prompt: WHAT_PRINTS,
      scene: code(lines),
      value,
      hint: {
        ru: "Выполни цикл по шагам: на каждом витке считай m, увеличивай k и сравнивай a[m] с x, чтобы понять, какая половина останется.",
        kk: "Циклді қадамдап орында: әр айналымда m-ді есепте, k-ны арттыр және қай жартысы қалатынын білу үшін a[m] мен x-ті салыстыр.",
      },
      explanation: {
        ru: `Цикл повторяется, пока область поиска не пуста и элемент не найден. Просмотрено: ${seq.join("; ")}. Итого k = ${value}.`,
        kk: `Цикл іздеу аймағы бос емес және элемент табылмаған кезде қайталанады. Қаралғаны: ${seq.join("; ")}. Барлығы k = ${value}.`,
      },
      wrongs: [
        { v: String(linear), why: w(absent ? "Это число сравнений линейного поиска: он просматривает весь список." : "Это число сравнений линейного поиска, а программа ищет двоичным способом.", absent ? "Бұл сызықтық іздеудің салыстыру саны: ол бүкіл тізімді қарайды." : "Бұл сызықтық іздеудің салыстыру саны, ал бағдарлама екілік тәсілмен іздейді.") },
        { v: String(value + 1), why: w("Один виток цикла посчитан лишний.", "Цикл бір айналымы артық саналған.") },
        { v: String(value - 1), why: w("Один виток цикла потерян: последний виток тоже увеличивает k.", "Цикл бір айналымы жоғалған: соңғы айналым да k-ны арттырады.") },
        { v: String(n), why: w("n — это длина списка, а цикл просматривает лишь часть элементов.", "n — тізімнің ұзындығы, ал цикл элементтердің тек бір бөлігін қарайды.") },
      ],
    },
    SHARE[level],
  );
}

// ---------- Файлы ----------

function tFileSum(rand: Rand, level: Level, seed: number): QuestionStep {
  const count = int(rand, 3, 4);
  const nums = Array.from({ length: count }, () => int(rand, 2, 15));
  const numsText = nums.join(", ");
  const kind = pick(rand, ["sum", "prod", "count"] as const);
  const prompt: L = {
    ru: `В файле data.txt записаны числа ${numsText}, каждое на отдельной строке. Что выведет программа?`,
    kk: `data.txt файлында ${numsText} сандары жазылған, әрқайсысы бөлек жолда. Программа не шығарады?`,
  };
  if (kind === "sum") {
    const value = nums.reduce((s, x) => s + x, 0);
    return numericStep(
      rand,
      {
        id: `g:${SKILL}:filesum:${nums.join("_")}:${seed}`,
        level,
        prompt,
        scene: code(["s = 0", 'f = open("data.txt", "r", encoding="utf-8")', "for line in f:", "    s += int(line)", "f.close()", "print(s)"]),
        value,
        hint: { ru: "Цикл for line in f проходит по всем строкам файла. Что прибавляется к s на каждой строке?", kk: "for line in f циклі файлдың барлық жолдары бойынша жүреді. Әр жолда s-ке не қосылады?" },
        explanation: {
          ru: `Цикл берёт файл по строкам и прибавляет каждое число к s: ${nums.join(" + ")} = ${value}.`,
          kk: `Цикл файлды жолма-жол алып, әр санды s-ке қосады: ${nums.join(" + ")} = ${value}.`,
        },
        wrongs: [
          { v: String(value - nums[0]), why: w("Первая строка пропущена: цикл читает файл с первой строки.", "Бірінші жол өткізіліп кеткен: цикл файлды бірінші жолдан оқиды.") },
          { v: String(value - nums[nums.length - 1]), why: w("Последняя строка пропущена: цикл читает файл до конца.", "Соңғы жол өткізіліп кеткен: цикл файлды соңына дейін оқиды.") },
          { v: String(nums.reduce((s, x) => s * x, 1)), why: w("Числа перемножены, а в программе стоит сложение.", "Сандар көбейтілген, ал бағдарламада қосу тұр.") },
          { v: String(count), why: w("Это количество строк, а не их сумма.", "Бұл жолдар саны, олардың қосындысы емес.") },
        ],
      },
      SHARE[level],
    );
  }
  if (kind === "prod") {
    const value = nums[0] * nums[1];
    return numericStep(
      rand,
      {
        id: `g:${SKILL}:fileprod:${nums.join("_")}:${seed}`,
        level,
        prompt,
        scene: code(['f = open("data.txt", "r", encoding="utf-8")', "a = int(f.readline())", "b = int(f.readline())", "f.close()", "print(a * b)"]),
        value,
        hint: { ru: "Каждый вызов readline() читает одну следующую строку. Какие две строки будут прочитаны?", kk: "readline() әр шақырылғанда келесі бір жолды оқиды. Қандай екі жол оқылады?" },
        explanation: {
          ru: `Первый readline() читает ${nums[0]}, второй — ${nums[1]}; остальные строки не читаются. Выводится ${nums[0]} * ${nums[1]} = ${value}.`,
          kk: `Бірінші readline() ${nums[0]} санын оқиды, екіншісі — ${nums[1]}; қалған жолдар оқылмайды. ${nums[0]} * ${nums[1]} = ${value} шығады.`,
        },
        wrongs: [
          { v: String(nums[0] + nums[1]), why: w("Числа складываются, а в print стоит умножение.", "Сандар қосылады, ал print ішінде көбейту тұр.") },
          { v: String(nums[nums.length - 2] * nums[nums.length - 1]), why: w("Читаются первые две строки, а не последние.", "Соңғы екі жол емес, алғашқы екі жол оқылады.") },
          { v: String(nums.reduce((s, x) => s * x, 1)), why: w("Читаются только две строки, а не все числа файла.", "Тек екі жол оқылады, файлдың барлық саны емес.") },
          { v: String(nums[0] * nums[2]), why: w("Вторая прочитанная строка — это второе число, а не третье.", "Екінші оқылған жол — екінші сан, үшіншісі емес.") },
        ],
      },
      SHARE[level],
    );
  }
  const t = int(rand, 5, 9);
  const value = nums.filter((x) => x > t).length;
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:filecount:${nums.join("_")}_${t}:${seed}`,
      level,
      prompt,
      scene: code(["k = 0", 'with open("data.txt", "r", encoding="utf-8") as f:', "    for line in f:", `        if int(line) > ${t}:`, "            k += 1", "print(k)"]),
      value,
      hint: { ru: "Для каждой строки проверь условие int(line) > t. Сколько чисел его выполняют?", kk: "Әр жол үшін int(line) > t шартын тексер. Қанша сан оны қанағаттандырады?" },
      explanation: {
        ru: `k считает числа больше ${t}. Из ${numsText} такими являются ${value}: k = ${value}.`,
        kk: `k ${t} санынан үлкен сандарды санайды. ${numsText} ішінен ондайлар ${value}: k = ${value}.`,
      },
      wrongs: [
        { v: String(nums.filter((x) => x >= t).length), why: w("Условие строгое: > не включает само число из условия.", "Шарт қатаң: > шарттағы санның өзін қоспайды.") },
        { v: String(nums.filter((x) => x < t).length), why: w("Посчитаны числа меньше, а в условии стоит «больше».", "Кіші сандар саналған, ал шартта «үлкен» тұр.") },
        { v: String(count), why: w("Посчитаны все строки, а k растёт только при выполнении условия.", "Барлық жолдар саналған, ал k тек шарт орындалғанда өседі.") },
        { v: String(nums.filter((x) => x > t).reduce((s, x) => s + x, 0)), why: w("k прибавляет по 1, а не само число.", "k санның өзін емес, 1-ді қосады.") },
      ],
    },
    SHARE[level],
  );
}

// ---------- Графы: таблица расстояний ----------

interface GraphCase {
  n: number;
  /** w[i][j] — длина дороги (0 — дороги нет). */
  w: number[][];
}

interface PathInfo {
  len: number;
  hops: number;
  path: number[];
}

function simplePaths(g: GraphCase, from: number, to: number): PathInfo[] {
  const res: PathInfo[] = [];
  const dfs = (u: number, seen: Set<number>, len: number, path: number[]) => {
    if (u === to) {
      res.push({ len, hops: path.length - 1, path });
      return;
    }
    for (let v = 0; v < g.n; v++) {
      if (g.w[u][v] > 0 && !seen.has(v)) dfs(v, new Set([...seen, v]), len + g.w[u][v], [...path, v]);
    }
  };
  dfs(from, new Set([from]), 0, [from]);
  return res;
}

function randomGraph(rand: Rand, n: number): GraphCase {
  const m = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let v = 1; v < n; v++) {
    const u = int(rand, 0, v - 1);
    const wt = int(rand, 1, 9);
    m[u][v] = wt;
    m[v][u] = wt;
  }
  for (let u = 0; u < n; u++) {
    for (let v = u + 1; v < n; v++) {
      if (m[u][v] === 0 && rand() < (n === 4 ? 0.4 : 0.32)) {
        const wt = int(rand, 1, 9);
        m[u][v] = wt;
        m[v][u] = wt;
      }
    }
  }
  return { n, w: m };
}

const FALLBACK_GRAPH: GraphCase = {
  n: 4,
  w: [
    [0, 2, 6, 0],
    [2, 0, 3, 7],
    [6, 3, 0, 2],
    [0, 7, 2, 0],
  ],
};

/** Жадный маршрут: из текущей вершины всегда по самой короткой дороге в ещё не посещённую вершину. */
function greedyLength(g: GraphCase, from: number, to: number): number | null {
  let u = from;
  const seen = new Set([u]);
  let len = 0;
  for (let step = 0; step < g.n; step++) {
    if (u === to) return len;
    let best = -1;
    for (let v = 0; v < g.n; v++) if (g.w[u][v] > 0 && !seen.has(v) && (best < 0 || g.w[u][v] < g.w[u][best])) best = v;
    if (best < 0) return null;
    len += g.w[u][best];
    seen.add(best);
    u = best;
  }
  return u === to ? len : null;
}

function tShortest(rand: Rand, level: Level, seed: number, n: number): QuestionStep {
  let g = FALLBACK_GRAPH;
  let found = false;
  for (let i = 0; i < 400 && !found; i++) {
    const cand = randomGraph(rand, n);
    const paths = simplePaths(cand, 0, n - 1);
    if (paths.length < 2) continue;
    const best = Math.min(...paths.map((p) => p.len));
    const minHops = Math.min(...paths.map((p) => p.hops));
    const hopBest = Math.min(...paths.filter((p) => p.hops === minHops).map((p) => p.len));
    const lens = new Set(paths.map((p) => p.len));
    if (hopBest > best && lens.size >= 3 && (n === 4 ? paths.length <= 6 : paths.length <= 14)) {
      g = cand;
      found = true;
    }
  }
  const gn = g.n;
  const last = LETTERS[gn - 1];
  const paths = simplePaths(g, 0, gn - 1);
  const best = Math.min(...paths.map((p) => p.len));
  const bestPath = paths.filter((p) => p.len === best)[0];
  const minHops = Math.min(...paths.map((p) => p.hops));
  const hopPath = paths.filter((p) => p.hops === minHops).sort((x, y) => x.len - y.len)[0];
  const greedy = greedyLength(g, 0, gn - 1);
  const others = [...new Set(paths.map((p) => p.len))].filter((v) => v > best).sort((x, y) => x - y);
  const wrongs: Wrong[] = [];
  if (hopPath.len !== best) wrongs.push({ v: String(hopPath.len), why: w("Выбран путь с наименьшим числом дорог, но он не самый короткий по сумме длин.", "Жол саны ең аз маршрут таңдалған, бірақ ол ұзындықтар қосындысы бойынша ең қысқа емес.") });
  if (greedy !== null && greedy !== best) wrongs.push({ v: String(greedy), why: w("Каждый раз выбиралась самая короткая дорога из текущего пункта, но такой путь не обязательно кратчайший.", "Әр жолы ағымдағы пункттен ең қысқа жол таңдалған, бірақ мұндай жол міндетті түрде ең қысқа емес.") });
  for (const v of others.slice(0, 3)) wrongs.push({ v: String(v), why: w("Это длина другого пути: есть путь короче.", "Бұл басқа жолдың ұзындығы: одан қысқа жол бар.") });
  wrongs.push({ v: String(best + 1), why: W_OFF1 });
  const sig = g.w.flatMap((row, i) => row.slice(i + 1).map((x, j) => (x ? `${LETTERS[i]}${LETTERS[i + 1 + j]}${x}` : ""))).join("");
  const pathStr = (p: number[]) => p.map((i) => LETTERS[i]).join("–");
  const sumStr = (p: number[]) => p.slice(1).map((v, i) => g.w[p[i]][v]).join(" + ");
  const scene: Scene = {
    kind: "table",
    columns: ["", ...LETTERS.slice(0, gn)],
    rows: g.w.map((row, i) => [LETTERS[i], ...row.map((x) => (x ? String(x) : "–"))]),
    mono: true,
  };
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:short:${gn}v_${sig}:${seed}`,
      level,
      prompt: {
        ru: `В таблице указаны длины дорог между пунктами (прочерк — прямой дороги нет). Какова длина кратчайшего пути из A в ${last}?`,
        kk: `Кестеде пункттер арасындағы жолдардың ұзындығы көрсетілген (сызықша — тікелей жол жоқ). A-дан ${last}-ға дейінгі ең қысқа жолдың ұзындығы қанша?`,
      },
      scene,
      value: best,
      hint: HINT_GRAPH,
      explanation: {
        ru: `Выписываем все пути из A в ${last} (их ${paths.length}) и находим суммы. Кратчайший ${pathStr(bestPath.path)}: ${sumStr(bestPath.path)} = ${best}.${hopPath.len !== best ? ` Путь с наименьшим числом дорог ${pathStr(hopPath.path)} длиннее: ${hopPath.len}.` : ""}`,
        kk: `A-дан ${last}-ға барлық жолдарды жазып (олар ${paths.length}), қосындыларын табамыз. Ең қысқасы ${pathStr(bestPath.path)}: ${sumStr(bestPath.path)} = ${best}.${hopPath.len !== best ? ` Жол саны ең аз маршрут ${pathStr(hopPath.path)} ұзынырақ: ${hopPath.len}.` : ""}`,
      },
      wrongs,
    },
    SHARE[level],
  );
}

// ---------- Графы: число путей ----------

interface DagTemplate {
  name: string;
  nodes: { id: string; x: number; y: number }[];
  /** Обязательные стрелки. */
  fixed: [string, string][];
  /** Горизонтальные связи: состояние 0 — нет, 1 — слева направо (первый → второй), 2 — справа налево. */
  horizontal: [string, string][];
  target: string;
}

const DAG_TEMPLATES: DagTemplate[] = [
  {
    name: "t1",
    nodes: [
      { id: "A", x: 2, y: 0 },
      { id: "B", x: 1, y: 1 },
      { id: "C", x: 3, y: 1 },
      { id: "D", x: 1, y: 2 },
      { id: "E", x: 3, y: 2 },
      { id: "F", x: 2, y: 3 },
    ],
    fixed: [["A", "B"], ["A", "C"], ["B", "D"], ["C", "E"], ["D", "F"], ["E", "F"]],
    horizontal: [["B", "C"], ["D", "E"]],
    target: "F",
  },
  {
    name: "t4",
    nodes: [
      { id: "A", x: 2, y: 0 },
      { id: "B", x: 1, y: 1 },
      { id: "C", x: 3, y: 1 },
      { id: "D", x: 0, y: 2 },
      { id: "E", x: 2, y: 2 },
      { id: "F", x: 4, y: 2 },
      { id: "G", x: 2, y: 3 },
    ],
    fixed: [["A", "B"], ["A", "C"], ["B", "D"], ["B", "E"], ["C", "E"], ["C", "F"], ["E", "G"]],
    horizontal: [["B", "C"], ["D", "E"], ["E", "F"]],
    target: "G",
  },
];

function dagEdges(t: DagTemplate, states: number[]): [string, string][] {
  const edges = [...t.fixed];
  t.horizontal.forEach(([a, b], i) => {
    if (states[i] === 1) edges.push([a, b]);
    if (states[i] === 2) edges.push([b, a]);
  });
  return edges;
}

/** Число путей из A до каждой вершины (граф без циклов). */
function pathCounts(edges: [string, string][]): Record<string, number> {
  const memo: Record<string, number> = { A: 1 };
  const f = (v: string): number => {
    if (memo[v] !== undefined) return memo[v];
    memo[v] = edges.filter(([, b]) => b === v).reduce((s, [a]) => s + f(a), 0);
    return memo[v];
  };
  for (const [a, b] of edges) {
    f(a);
    f(b);
  }
  return memo;
}

/** Порядок обработки вершин для текста разбора: сверху вниз, слева направо, но только когда обработаны все предшественники. */
function topoOrder(nodes: { id: string; x: number; y: number }[], edges: [string, string][]): string[] {
  const done = new Set<string>();
  const out: string[] = [];
  const rest = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  while (rest.length) {
    const i = rest.findIndex((n) => edges.filter(([, b]) => b === n.id).every(([a]) => done.has(a)));
    const [n] = rest.splice(i < 0 ? 0 : i, 1);
    done.add(n.id);
    out.push(n.id);
  }
  return out;
}

/** Вершины, из которых можно дойти до target (только они нужны в разборе). */
function ancestors(target: string, edges: [string, string][]): Set<string> {
  const res = new Set([target]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const [a, b] of edges) if (res.has(b) && !res.has(a)) res.add(a), (changed = true);
  }
  return res;
}

function tPaths(rand: Rand, level: Level, seed: number): QuestionStep {
  let t = pick(rand, DAG_TEMPLATES);
  let states = t.horizontal.map(() => int(rand, 0, 2));
  for (let i = 0; i < 100; i++) {
    t = pick(rand, DAG_TEMPLATES);
    states = t.horizontal.map(() => int(rand, 0, 2));
    const c = pathCounts(dagEdges(t, states))[t.target] ?? 0;
    if (c >= 3 && c <= 9) break;
  }
  const edges = dagEdges(t, states);
  const counts = pathCounts(edges);
  const value = counts[t.target];
  const ids = t.nodes.map((n) => n.id);
  const useful = ancestors(t.target, edges);
  const order = topoOrder(t.nodes, edges);
  const parts = order
    .filter((v) => v !== "A" && useful.has(v))
    .map((v) => {
      const preds = edges.filter(([, b]) => b === v).map(([a]) => a);
      return preds.length === 1 ? `${v} = ${preds[0]} = ${counts[v]}` : `${v} = ${preds.join(" + ")} = ${preds.map((p) => counts[p]).join(" + ")} = ${counts[v]}`;
    });
  const fixedCount = pathCounts(t.fixed)[t.target];
  const wrongs: Wrong[] = [
    { v: String(edges.length), why: w("Посчитаны стрелки (рёбра), а нужно число путей.", "Көрсеткілер (қабырғалар) саналған, ал маршруттар саны керек.") },
    { v: String(value + 1), why: w("Один путь посчитан лишний.", "Бір маршрут артық саналған.") },
    { v: String(value - 1), why: w("Один путь потерян: проверь суммы по вершинам.", "Бір маршрут жоғалған: төбелер бойынша қосындыларды тексер.") },
    { v: String(ids.length), why: w("Это число вершин, а не число путей.", "Бұл төбелер саны, маршруттар саны емес.") },
  ];
  if (fixedCount !== value) wrongs.unshift({ v: String(fixedCount), why: w("Не учтены стрелки между вершинами одного уровня: по ним тоже можно идти.", "Бір деңгейдегі төбелер арасындағы көрсеткілер ескерілмеген: олармен де жүруге болады.") });
  const scene: Scene = {
    kind: "flow",
    nodes: t.nodes.map((n) => ({ id: n.id, shape: "box" as const, label: n.id, x: n.x, y: n.y })),
    edges: edges.map(([from, to]) => ({ from, to })),
  };
  return numericStep(
    rand,
    {
      id: `g:${SKILL}:paths:${t.name}_${states.join("")}:${seed}`,
      level,
      prompt: {
        ru: `Сколько существует различных путей из A в ${t.target}? Идти можно только по стрелкам.`,
        kk: `A төбесінен ${t.target} төбесіне неше түрлі маршрут бар? Тек көрсеткілер бойынша жүруге болады.`,
      },
      scene,
      value,
      hint: HINT_PATHS,
      explanation: {
        ru: `Считаем по вершинам: A = 1; ${parts.join("; ")}. Всего путей из A в ${t.target}: ${value}.`,
        kk: `Төбелер бойынша санаймыз: A = 1; ${parts.join("; ")}. A-дан ${t.target}-ға барлығы ${value} маршрут.`,
      },
      wrongs,
    },
    SHARE[level],
  );
}

// ---------- Сортировка по ключу ----------

function tSortKey(rand: Rand, level: Level, seed: number): QuestionStep {
  const pool = ["tea", "egg", "cat", "milk", "bread", "apple", "rice", "fig", "kiwi", "plum", "nut", "pear", "melon", "oat", "cake"];
  let ws: string[] = [];
  for (let i = 0; i < 100; i++) {
    ws = shuffle(pool, rand).slice(0, 5);
    const lens = new Set(ws.map((x) => x.length));
    if (lens.size >= 3 && lens.size < 5) break;
  }
  const desc = rand() < 0.5;
  const stable = (arr: string[], d: boolean) => [...arr].sort((a, b) => (d ? b.length - a.length : a.length - b.length));
  const res = stable(ws, desc);
  const py = (arr: string[]) => `[${arr.map((s) => `'${s}'`).join(", ")}]`;
  const alpha = [...ws].sort();
  const opposite = stable(ws, !desc);
  const lines = [`w = ${py(ws)}`, desc ? "w.sort(key=len, reverse=True)" : "w.sort(key=len)", "print(w)"];
  const wrongs: Wrong[] = [
    { v: py(opposite), why: w(desc ? "Это порядок по возрастанию длины: reverse=True даёт убывание." : "Это порядок по убыванию длины: без reverse=True длины растут.", desc ? "Бұл ұзындықтың өсу реті: reverse=True кемуді береді." : "Бұл ұзындықтың кему реті: reverse=True болмаса, ұзындықтар өседі.") },
    { v: py(alpha), why: w("Это алфавитный порядок, а key=len сортирует по длине слова.", "Бұл әліпби реті, ал key=len сөздің ұзындығы бойынша сұрыптайды.") },
    { v: py(ws), why: w("Исходный порядок: sort() меняет сам список, поэтому порядок слов меняется.", "Бастапқы рет: sort() тізімнің өзін өзгертеді, сондықтан сөздер реті өзгереді.") },
    { v: py([...opposite].reverse()), why: w("Слова с равной длиной остаются в исходном порядке: сортировка устойчивая, их порядок не переворачивается.", "Ұзындығы тең сөздер бастапқы ретімен қалады: сұрыптау орнықты, олардың реті аударылмайды.") },
    { v: py([...res].reverse()), why: w("Список выведен в обратном порядке.", "Тізім кері ретпен шығарылған.") },
  ];
  const lenText = ws.map((s) => `${s} — ${s.length}`).join(", ");
  return choiceStep(rand, {
    id: `g:${SKILL}:key:${desc ? "d" : "a"}_${ws.join("")}:${seed}`,
    level,
    prompt: WHAT_PRINTS,
    scene: code(lines),
    correct: py(res),
    wrongs,
    hint: {
      ru: "key=len сортирует по длине слова. Слова с одинаковой длиной остаются в том же порядке, в каком были в списке.",
      kk: "key=len сөздің ұзындығы бойынша сұрыптайды. Ұзындығы бірдей сөздер тізімдегі ретімен қалады.",
    },
    explanation: {
      ru: `Длины слов: ${lenText}. Сортировка по ${desc ? "убыванию" : "возрастанию"} длины, слова с равной длиной остаются в исходном порядке: ${py(res)}.`,
      kk: `Сөздердің ұзындығы: ${lenText}. Ұзындық бойынша ${desc ? "кему" : "өсу"} ретімен сұрыптау, ұзындығы тең сөздер бастапқы ретімен қалады: ${py(res)}.`,
    },
  });
}

type Template = (rand: Rand, level: Level, seed: number) => QuestionStep;

const TEMPLATES: Record<Level, Template[]> = {
  1: [tSorted, tLinear, tFileCount, (r, l, s) => tBubble(r, l, s, 4, 1), tSorted, tFileCount, tLinear],
  2: [
    tBinCount,
    (r, l, s) => tBinTrace(r, l, s, false),
    (r, l, s) => tBubble(r, l, s, 5, 1),
    tSelPass,
    tFileSum,
    (r, l, s) => tShortest(r, l, s, 4),
    tBinCount,
    tFileSum,
  ],
  3: [
    (r, l, s) => tShortest(r, l, s, pick(r, [5, 6] as const)),
    tPaths,
    tBubbleCode,
    tSortKey,
    (r, l, s) => tBinTrace(r, l, s, true),
    tSwaps,
    tPaths,
    (r, l, s) => tBubble(r, l, s, 6, 2),
  ],
};

// ---------- Утверждения «верно / неверно» ----------

interface StaticStatement {
  level: Level;
  text: L;
  value: boolean;
  explanation: L;
}

const STATEMENTS: StaticStatement[] = [
  { level: 1, value: true, text: w("Линейный поиск просматривает элементы по одному", "Сызықтық іздеу элементтерді бір-бірлеп қарайды"), explanation: w("Он идёт от начала списка и сравнивает каждый элемент с искомым.", "Ол тізімнің басынан бастап әр элементті ізделіп жатқанмен салыстырады.") },
  { level: 1, value: false, text: w("Двоичный поиск работает в любом списке", "Екілік іздеу кез келген тізімде жұмыс істейді"), explanation: w("Список должен быть отсортирован: иначе по одному сравнению нельзя отбросить половину.", "Тізім сұрыпталған болуы керек: әйтпесе бір салыстырумен жартысын тастауға болмайды.") },
  { level: 1, value: true, text: w("Режим 'a' дописывает данные в конец файла", "'a' режимі деректерді файлдың соңына жалғайды"), explanation: w("Буква a — от append («добавить»): старое содержимое сохраняется.", "a әрпі — append («қосу») сөзінен: ескі мазмұн сақталады.") },
  { level: 1, value: false, text: w("Режим 'w' сохраняет старое содержимое файла", "'w' режимі файлдың ескі мазмұнын сақтайды"), explanation: w("Режим 'w' стирает файл и пишет с нуля.", "'w' режимі файлды өшіріп, басынан жазады.") },
  { level: 1, value: true, text: w("Функция sorted(a) не изменяет список a", "sorted(a) функциясы a тізімін өзгертпейді"), explanation: w("sorted создаёт новый отсортированный список, а исходный оставляет как был.", "sorted жаңа сұрыпталған тізім жасайды, ал бастапқысын өзгеріссіз қалдырады.") },
  { level: 1, value: false, text: w("В графе вершины — это линии между точками", "Графта төбелер — нүктелер арасындағы сызықтар"), explanation: w("Вершины — это точки (пункты), а линии между ними называются рёбрами.", "Төбелер — нүктелер (пункттер), ал олардың арасындағы сызықтар қабырғалар деп аталады.") },
  { level: 1, value: true, text: w("Вес ребра графа может обозначать длину дороги", "Граф қабырғасының салмағы жолдың ұзындығын білдіре алады"), explanation: w("Вес — число на ребре: длина, время или цена.", "Салмақ — қабырғадағы сан: ұзындық, уақыт немесе баға.") },
  { level: 2, value: true, text: w("После 1-го прохода пузырька наибольший элемент стоит в конце списка", "Көпіршіктің 1-өтуінен кейін ең үлкен элемент тізімнің соңында тұрады"), explanation: w("За проход самый большой элемент «всплывает» в конец, обменявшись со всеми соседями.", "Бір өтуде ең үлкен элемент барлық көршілерімен алмасып, соңына «қалқып» шығады.") },
  { level: 2, value: false, text: w("Одного прохода пузырька всегда хватает, чтобы отсортировать список", "Көпіршіктің бір өтуі тізімді сұрыптау үшін әрқашан жетеді"), explanation: w("Один проход ставит на место только наибольший элемент. Остальные могут остаться не по порядку.", "Бір өту тек ең үлкен элементті орнына қояды. Қалғандары ретсіз қалуы мүмкін.") },
  { level: 2, value: true, text: w("Метод a.sort() сортирует сам список и возвращает None", "a.sort() әдісі тізімнің өзін сұрыптайды және None қайтарады"), explanation: w("Поэтому запись a = a.sort() оставит в a значение None.", "Сондықтан a = a.sort() жазбасы a ішінде None мәнін қалдырады.") },
  { level: 2, value: false, text: w("Метод strip() добавляет символ конца строки", "strip() әдісі жол соңы таңбасын қосады"), explanation: w("strip() убирает пробелы и символ \\n по краям строки.", "strip() жолдың шеттеріндегі бос орындар мен \\n таңбасын алып тастайды.") },
  { level: 2, value: true, text: w("Конструкция with open(...) as f закрывает файл автоматически", "with open(...) as f құрылымы файлды автоматты түрде жабады"), explanation: w("Когда блок with заканчивается, файл закрывается сам.", "with блогы аяқталғанда файл өзі жабылады.") },
  { level: 2, value: false, text: w("Строка из файла, прочитанная циклом for line in f, не содержит символа конца строки", "for line in f циклімен оқылған файл жолында жол соңы таңбасы болмайды"), explanation: w("Строка включает \\n в конце, поэтому для int(...) или сравнения часто применяют strip().", "Жолдың соңында \\n бар, сондықтан int(...) немесе салыстыру үшін жиі strip() қолданады.") },
  { level: 2, value: true, text: w("Кратчайший путь в графе не обязательно имеет наименьшее число дорог", "Графтағы ең қысқа жолдың жол саны міндетті түрде ең аз болмайды"), explanation: w("Кратчайший — по сумме длин. Короткий по числу дорог путь может состоять из длинных дорог.", "Ең қысқасы — ұзындықтар қосындысы бойынша. Жол саны аз маршрут ұзын жолдардан тұруы мүмкін.") },
  { level: 3, value: true, text: w("В графе без циклов число путей в вершину равно сумме чисел путей в её предшественников", "Циклсіз графта төбеге баратын маршруттар саны оның алдыңғы төбелеріне баратын маршруттар сандарының қосындысына тең"), explanation: w("Любой путь в вершину кончается стрелкой из одного из предшественников, поэтому пути складываются.", "Төбеге баратын кез келген маршрут алдыңғы төбенің біреуінен шыққан көрсеткімен аяқталады, сондықтан маршруттар қосылады.") },
  { level: 3, value: false, text: w("Сортировка по key=len ставит слова в алфавитном порядке", "key=len бойынша сұрыптау сөздерді әліпби ретімен қояды"), explanation: w("Ключ — длина слова: сортировка идёт по длине, а не по алфавиту.", "Кілт — сөздің ұзындығы: сұрыптау ұзындық бойынша жүреді, әліпби бойынша емес.") },
  { level: 3, value: true, text: w("При сортировке по key=len слова равной длины сохраняют исходный порядок", "key=len бойынша сұрыптағанда ұзындығы тең сөздер бастапқы ретін сақтайды"), explanation: w("Сортировка в Python устойчивая: равные ключи не переставляются.", "Python-дағы сұрыптау орнықты: тең кілттер ауыспайды.") },
  { level: 3, value: false, text: w("Двоичный поиск в списке из 100 элементов делает не более 100 сравнений, поэтому он не лучше линейного", "100 элементті тізімде екілік іздеу ең көбі 100 салыстыру жасайды, сондықтан ол сызықтықтан артық емес"), explanation: w("Двоичному поиску достаточно 7 сравнений (2⁷ = 128 > 100), а линейному в худшем случае нужно 100.", "Екілік іздеуге 7 салыстыру жеткілікті (2⁷ = 128 > 100), ал сызықтыққа ең нашар жағдайда 100 керек.") },
  { level: 3, value: true, text: w("Для двоичного поиска важно, чтобы список был отсортирован", "Екілік іздеу үшін тізімнің сұрыпталған болуы маңызды"), explanation: w("Сравнение со средним элементом позволяет отбросить половину только в упорядоченном списке.", "Орташа элементпен салыстыру жартысын тек реттелген тізімде тастауға мүмкіндік береді.") },
  { level: 3, value: false, text: w("Если в таблице расстояний стоит прочерк, расстояние между пунктами равно 0", "Қашықтық кестесінде сызықша тұрса, пункттер арасындағы қашықтық 0-ге тең"), explanation: w("Прочерк означает, что прямой дороги нет, а не что она нулевой длины.", "Сызықша тікелей жол жоқ дегенді білдіреді, ұзындығы нөл деген емес.") },
];

function valueStatement(rand: Rand, level: Level): Statement {
  if (level === 3 && rand() < 0.5) {
    const p = int(rand, 2, 5);
    const q = int(rand, 2, 5);
    const real = p + q;
    const value = rand() < 0.5;
    const claim = value ? real : pick(rand, [p * q, real + 1, real - 1].filter((v) => v !== real));
    return {
      id: `s:${SKILL}:sumpaths:${p}_${q}_${claim}`,
      skill: SKILL,
      level,
      text: {
        ru: `В вершину D ведут стрелки только из B и из C. Из A в B ведут ${p} пути, из A в C — ${q}. Значит, из A в D ведут ${claim} путей`,
        kk: `D төбесіне көрсеткілер тек B және C төбелерінен келеді. A-дан B-ға ${p} маршрут, A-дан C-ға ${q} маршрут барады. Демек, A-дан D-ға ${claim} маршрут барады`,
      },
      value: claim === real,
      explanation: same(`${p} + ${q} = ${real}`),
      hint: HINT_PATHS,
    };
  }
  const pickN = pick(rand, level === 1 ? [8, 100, 1000] : [30, 50, 100, 300, 1000, 5000]);
  const real = binWorst(pickN);
  const value = rand() < 0.5;
  const claim = value ? real : pick(rand, [real - 1, real + 1, pickN].filter((v) => v !== real && v > 0));
  return {
    id: `s:${SKILL}:bin:${pickN}_${claim}`,
    skill: SKILL,
    level: level === 1 ? 2 : level,
    text: {
      ru: `В отсортированном списке из ${pickN} элементов двоичный поиск делает не более ${claim} сравнений`,
      kk: `${pickN} элементі бар сұрыпталған тізімде екілік іздеу ең көбі ${claim} салыстыру жасайды`,
    },
    value: claim === real,
    explanation: {
      ru: `Наименьшее k, при котором 2${sup(real)} > ${pickN}, — это ${real} (2${sup(real)} = ${2 ** real}). Значит, достаточно ${real} сравнений.`,
      kk: `2${sup(real)} > ${pickN} болатын ең кіші k — ${real} (2${sup(real)} = ${2 ** real}). Демек, ${real} салыстыру жеткілікті.`,
    },
    hint: HINT_BIN,
  };
}

// ---------- Пары «понятие — значение» ----------

interface StaticPair {
  level: Level;
  left: Text;
  right: Text;
}

const PAIRS: StaticPair[] = [
  { level: 1, left: "'r'", right: w("чтение файла", "файлды оқу") },
  { level: 1, left: "'w'", right: w("запись с очисткой файла", "файлды тазалап жазу") },
  { level: 1, left: "'a'", right: w("запись в конец файла", "файлдың соңына жазу") },
  { level: 1, left: w("Линейный поиск", "Сызықтық іздеу"), right: w("просмотр элементов по одному", "элементтерді бір-бірлеп қарау") },
  { level: 1, left: w("Двоичный поиск", "Екілік іздеу"), right: w("деление отсортированного списка пополам", "сұрыпталған тізімді екіге бөлу") },
  { level: 1, left: w("Вершина", "Төбе"), right: w("точка графа", "графтың нүктесі") },
  { level: 1, left: w("Ребро", "Қабырға"), right: w("линия между вершинами", "төбелер арасындағы сызық") },
  { level: 2, left: "sorted(a)", right: w("новый отсортированный список", "жаңа сұрыпталған тізім") },
  { level: 2, left: "a.sort()", right: w("сортирует сам список и возвращает None", "тізімнің өзін сұрыптайды және None қайтарады") },
  { level: 2, left: "f.readline()", right: w("читает одну строку", "бір жолды оқиды") },
  { level: 2, left: "f.read()", right: w("читает всё содержимое, что осталось", "қалған бүкіл мазмұнды оқиды") },
  { level: 2, left: "strip()", right: w("убирает пробелы и \\n по краям", "шеттегі бос орындар мен \\n таңбасын алып тастайды") },
  { level: 2, left: "with open(...) as f", right: w("файл закроется автоматически", "файл автоматты түрде жабылады") },
  { level: 2, left: w("Пузырёк", "Көпіршік"), right: w("сравнение соседей, наибольший всплывает в конец", "көршілерді салыстыру, ең үлкені соңына қалқып шығады") },
  { level: 2, left: w("Сортировка выбором", "Таңдау арқылы сұрыптау"), right: w("поиск наименьшего из оставшихся", "қалғанының ең кішісін іздеу") },
  { level: 3, left: "key=len", right: w("сортировка по длине слова", "сөздің ұзындығы бойынша сұрыптау") },
  { level: 3, left: "reverse=True", right: w("порядок по убыванию", "кему реті") },
  { level: 3, left: w("Вес ребра", "Қабырға салмағы"), right: w("число на ребре: длина, время, цена", "қабырғадағы сан: ұзындық, уақыт, баға") },
  { level: 3, left: w("Граф без циклов", "Циклсіз граф"), right: w("число путей считают по вершинам", "маршруттар санын төбелер бойынша санайды") },
  { level: 3, left: w("Таблица расстояний", "Қашықтық кестесі"), right: w("строка — откуда, столбец — куда", "жол — қайдан, баған — қайда") },
];

function byLevel<T extends { level: Level }>(items: T[], level: Level): T[] {
  for (const d of [0, -1, 1, -2, 2]) {
    const found = items.filter((x) => x.level === level + d);
    if (found.length) return found;
  }
  return items;
}

function valuePair(rand: Rand, level: Level): Pair {
  // Значения подобраны так, чтобы ответы (правая часть пары) не повторялись: 5, 6, 7, 8, 9, 10, 11, 13.
  const n = pick(rand, [30, 50, 100, 200, 300, 1000, 2000, 5000]);
  return {
    id: `p:${SKILL}:bin:${n}`,
    skill: SKILL,
    level: level < 2 ? 2 : level,
    left: { ru: `Двоичный поиск, n = ${n}`, kk: `Екілік іздеу, n = ${n}` },
    right: String(binWorst(n)),
  };
}

// ---------- Короткие вопросы ----------

function shortQuestion(rand: Rand, level: Level): ShortQuestion {
  if (level === 1) {
    const r = rand();
    if (r < 0.34) {
      const before = int(rand, 2, 6);
      const mode = rand() < 0.5 ? "w" : "a";
      const writes = int(rand, 1, 3);
      return {
        id: `q:${SKILL}:file:${mode}${before}_${writes}`,
        skill: SKILL,
        level,
        prompt: {
          ru: `В файле было ${before} строк. Программа открывает его в режиме '${mode}' и записывает ${writes} новых строк. Сколько строк в файле теперь?`,
          kk: `Файлда ${before} жол болған. Бағдарлама оны '${mode}' режимімен ашып, ${writes} жаңа жол жазады. Енді файлда неше жол бар?`,
        },
        answer: String(mode === "w" ? writes : before + writes),
        mode: "number",
        explanation: w(
          mode === "w" ? "Режим 'w' стирает старое содержимое: остаются только новые строки." : "Режим 'a' дописывает в конец: старые строки + новые.",
          mode === "w" ? "'w' режимі ескі мазмұнды өшіреді: тек жаңа жолдар қалады." : "'a' режимі соңына жалғайды: ескі жолдар + жаңа жолдар.",
        ),
        hint: HINT_FILE,
      };
    }
    if (r < 0.68) {
      const a = uniqueNums(rand, 4, 1, 9);
      return {
        id: `q:${SKILL}:min:${a.join("")}`,
        skill: SKILL,
        level,
        prompt: {
          ru: `a = ${lst(a)}. После команды a.sort() чему равен a[0]?`,
          kk: `a = ${lst(a)}. a.sort() командасынан кейін a[0] неге тең?`,
        },
        answer: String(Math.min(...a)),
        mode: "number",
        explanation: w("После a.sort() список упорядочен по возрастанию, и первым стоит наименьший элемент.", "a.sort() кейін тізім өсу ретімен реттеледі, ал бірінші орында ең кіші элемент тұрады."),
        hint: { ru: "Метод sort() упорядочивает список по возрастанию. Какой элемент окажется первым?", kk: "sort() әдісі тізімді өсу ретімен реттейді. Қай элемент бірінші болады?" },
      };
    }
    const n = int(rand, 10, 60);
    const k = int(rand, 2, n - 1);
    return {
      id: `q:${SKILL}:linpos:${n}_${k}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `Линейный поиск ищет элемент, который в списке из n = ${n} элементов стоит на месте с номером ${k}. Сколько сравнений он выполнит?`,
        kk: `Сызықтық іздеу n = ${n} элементі бар тізімде орнының нөмірі ${k} болатын элементті іздейді. Ол неше салыстыру жасайды?`,
      },
      answer: String(k),
      mode: "number",
      explanation: w("Поиск идёт с начала и останавливается на найденном элементе: сравнений столько, каков его номер.", "Іздеу басынан басталып, табылған элементте тоқтайды: салыстыру саны оның нөміріндей."),
      hint: { ru: "Линейный поиск останавливается, как только нашёл элемент. Сколько элементов он успел просмотреть?", kk: "Сызықтық іздеу элементті тапқанда тоқтайды. Ол қанша элемент қарап үлгерді?" },
    };
  }
  if (level === 2) {
    const r = rand();
    if (r < 0.5) {
      const n = pick(rand, [20, 30, 50, 100, 200, 500, 1000, 4000]);
      return {
        id: `q:${SKILL}:bin:${n}`,
        skill: SKILL,
        level,
        prompt: {
          ru: `Сколько сравнений в худшем случае нужно двоичному поиску в отсортированном списке из n = ${n} элементов?`,
          kk: `n = ${n} элементі бар сұрыпталған тізімде екілік іздеуге ең нашар жағдайда неше салыстыру керек?`,
        },
        answer: String(binWorst(n)),
        mode: "number",
        explanation: same(`2${sup(binWorst(n))} = ${2 ** binWorst(n)} > ${n} ≥ ${2 ** (binWorst(n) - 1)} → ${binWorst(n)}`),
        hint: HINT_BIN,
      };
    }
    if (r < 0.75) {
      const a = uniqueNums(rand, 5, 1, 9);
      const swaps = bubblePasses(a, 1).swapsByPass[0];
      return {
        id: `q:${SKILL}:pass1:${a.join("")}`,
        skill: SKILL,
        level,
        prompt: {
          ru: `Список ${lst(a)} сортируют пузырьком по возрастанию. Сколько обменов произойдёт в 1-м проходе?`,
          kk: `${lst(a)} тізімі өсу ретімен көпіршікпен сұрыпталады. 1-өтуде неше алмасу болады?`,
        },
        answer: String(swaps),
        mode: "number",
        explanation: same(`${lst(a)} → ${lst(bubblePasses(a, 1).list)}: ${swaps}`),
        hint: HINT_BUBBLE,
      };
    }
    const p = int(rand, 2, 6);
    const q = int(rand, 2, 6);
    return {
      id: `q:${SKILL}:sumpaths:${p}_${q}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `В вершину D ведут стрелки только из B и из C. Из A в B ведут ${p} пути, из A в C — ${q}. Сколько путей из A в D?`,
        kk: `D төбесіне көрсеткілер тек B және C төбелерінен келеді. A-дан B-ға ${p} маршрут, A-дан C-ға ${q} маршрут барады. A-дан D-ға неше маршрут бар?`,
      },
      answer: String(p + q),
      mode: "number",
      explanation: same(`${p} + ${q} = ${p + q}`),
      hint: HINT_PATHS,
    };
  }
  const r = rand();
  if (r < 0.5) {
    const a = uniqueNums(rand, int(rand, 5, 6), 1, 9);
    return {
      id: `q:${SKILL}:inv:${a.join("")}`,
      skill: SKILL,
      level,
      prompt: {
        ru: `Список ${lst(a)} полностью сортируют пузырьком по возрастанию. Сколько всего обменов будет?`,
        kk: `${lst(a)} тізімі өсу ретімен көпіршікпен толық сұрыпталады. Барлығы неше алмасу болады?`,
      },
      answer: String(inversions(a)),
      mode: "number",
      explanation: same(`${bubblePasses(a, a.length - 1).swapsByPass.join(" + ")} = ${inversions(a)}`),
      hint: HINT_BUBBLE,
    };
  }
  const p = int(rand, 1, 4);
  const q = int(rand, 2, 5);
  const s = int(rand, 1, 4);
  return {
    id: `q:${SKILL}:sum3:${p}_${q}_${s}`,
    skill: SKILL,
    level,
    prompt: {
      ru: `В вершину D ведут стрелки из B, из C и из E. Из A в B ведут ${p} пути, в C — ${q}, в E — ${s}. Сколько путей из A в D?`,
      kk: `D төбесіне көрсеткілер B, C және E төбелерінен келеді. A-дан B-ға ${p} маршрут, C-ға ${q} маршрут, E-ге ${s} маршрут барады. A-дан D-ға неше маршрут бар?`,
    },
    answer: String(p + q + s),
    mode: "number",
    explanation: same(`${p} + ${q} + ${s} = ${p + q + s}`),
    hint: HINT_PATHS,
  };
}

// ---------- Банк навыка ----------

const algos: SkillBank = {
  skill: SKILL,
  question(level, seed) {
    const rand = seeded(seed);
    const make = pick(rand, TEMPLATES[level]);
    return { ...make(rand, level, seed), level };
  },
  statement(level, seed) {
    const rand = seeded(seed);
    if (rand() < 0.7) {
      const st = pick(rand, byLevel(STATEMENTS, level));
      return { id: `s:${SKILL}:st:${st.text.ru.slice(0, 40)}`, skill: SKILL, level: st.level, text: st.text, value: st.value, explanation: st.explanation };
    }
    return valueStatement(rand, level);
  },
  pair(level, seed) {
    const rand = seeded(seed);
    if (level > 1 && rand() < 0.2) return valuePair(rand, level);
    const p = pick(rand, byLevel(PAIRS, level));
    return { id: `p:${SKILL}:t:${typeof p.left === "string" ? p.left : p.left.ru}`, skill: SKILL, level: p.level, left: p.left, right: p.right };
  },
  short(level, seed) {
    return shortQuestion(seeded(seed), level);
  },
};

export const BANKS: SkillBank[] = [algos];
