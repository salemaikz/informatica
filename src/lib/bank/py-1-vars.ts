import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка py.vars: переменные, типы, арифметика, // и %, цифры числа, строки.
// Все ответы считает код (функции повторяют логику Python для неотрицательных чисел).
// Программа всегда показывается сценой code; в текстах после чисел нет падежных окончаний (казахский).

const SKILL = "py.vars";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });
const ln = (ru: string, kk: string): L => ({ ru, kk });

const WHAT_PRINTS: L = ln("Что выведет программа?", "Программа не шығарады?");

/** Вывод числа как в Python: целое — без точки, дробное — с точкой (деление на 2, 4, 5, 8 даёт короткую запись). */
const pyFloat = (v: number) => (Number.isInteger(v) ? `${v}.0` : String(v));

/** Схема «после ответа»: программа с финальными значениями переменных и выводом. */
function reveal(lines: string[], vars: [string, number | string][], output: string[]): Scene {
  return {
    kind: "code",
    lang: "python",
    lines,
    active: lines.length - 1,
    vars: vars.map(([name, value]) => ({ name, value: String(value) })),
    output,
  };
}

const code = (lines: string[]): Scene => ({ kind: "code", lang: "python", lines });

interface Wrong {
  text: string;
  why: L;
}

/** Выбор из 4: верный + три разных неверных (с разбором ошибки), варианты перемешаны. */
function choice(
  rand: Rand,
  p: { id: string; level: Level; prompt: L; scene?: Scene; reveal?: Scene; hint: L; explanation: L },
  correct: string,
  wrongs: Wrong[],
): ChoiceStep {
  const seen = new Set<string>([correct]);
  const picked: Wrong[] = [];
  for (const w of wrongs) {
    if (picked.length >= 3) break;
    if (!seen.has(w.text)) {
      seen.add(w.text);
      picked.push(w);
    }
  }
  if (picked.length < 3) throw new Error(`py-1-vars ${p.id}: не хватает неверных вариантов`);
  const all = shuffle<{ text: string; why: L | null }>([{ text: correct, why: null }, ...picked], rand);
  return {
    id: p.id,
    type: "choice",
    skill: SKILL,
    level: p.level,
    prompt: p.prompt,
    scene: p.scene,
    reveal: p.reveal,
    hint: p.hint,
    options: all.map((o): Text => o.text),
    correct: all.findIndex((o) => o.why === null),
    whyWrong: all.map((o) => o.why),
    explanation: p.explanation,
  };
}

function numInput(
  p: { id: string; level: Level; scene: Scene; reveal?: Scene; hint: L; explanation: L; prompt?: L },
  answer: string,
  mode: "number" | "text" = "number",
): InputStep {
  return {
    id: p.id,
    type: "input",
    skill: SKILL,
    level: p.level,
    prompt: p.prompt ?? WHAT_PRINTS,
    scene: p.scene,
    reveal: p.reveal,
    hint: p.hint,
    answers: [answer],
    mode,
    explanation: p.explanation,
  };
}

// ---------- Трассировка переменных ----------

function genTrace(rand: Rand, level: Level, seed: number) {
  if (level === 1) {
    const A = int(rand, 2, 9);
    const B = int(rand, 2, 9);
    const C = int(rand, 2, 4);
    const v = int(rand, 0, 2);
    let lines: string[];
    let value: number;
    let trail: string;
    if (v === 0) {
      lines = [`x = ${A}`, `x = x + ${B}`, `x = x * ${C}`, "print(x)"];
      value = (A + B) * C;
      trail = `${A} → ${A} + ${B} = ${A + B} → ${A + B} * ${C} = ${value}`;
    } else if (v === 1) {
      lines = [`x = ${A}`, `x = x * ${C}`, `x = x + ${B}`, "print(x)"];
      value = A * C + B;
      trail = `${A} → ${A} * ${C} = ${A * C} → ${A * C} + ${B} = ${value}`;
    } else {
      lines = [`x = ${A + B}`, `x = x - ${B}`, `x = x * ${C}`, "print(x)"];
      value = A * C;
      trail = `${A + B} → ${A + B} - ${B} = ${A} → ${A} * ${C} = ${value}`;
    }
    return numInput(
      {
        id: `g:py.vars:trace1:${v}-${A}-${B}-${C}:${seed}`,
        level,
        scene: code(lines),
        reveal: reveal(lines, [["x", value]], [String(value)]),
        hint: ln("Идём строка за строкой: каждая строка меняет значение x.", "Жолдан жолға жүреміз: әр жол x мәнін өзгертеді."),
        explanation: ln(`Следим за x сверху вниз: ${trail}. Выведется ${value}.`, `x мәнін жоғарыдан төмен қарай бақылаймыз: ${trail}. ${value} шығады.`),
      },
      String(value),
    );
  }

  const A = int(rand, 2, 9);
  let B = int(rand, 2, 9);
  if (B === A) B = A === 9 ? 2 : A + 1;
  const K = int(rand, 2, 4);

  if (level === 2) {
    const v = int(rand, 0, 2);
    const id = `g:py.vars:trace2:${v}-${A}-${B}-${K}:${seed}`;
    const hint = ln("Запиши значения a и b после каждой строки: каждая строка меняет только одну переменную.", "Әр жолдан кейін a және b мәндерін жаз: әр жол тек бір айнымалыны өзгертеді.");
    let lines: string[];
    let res: [number, number];
    let wrongs: [number, number, L][];
    let expl: L;
    if (v === 0) {
      lines = [`a = ${A}`, `b = ${B}`, "a = a + b", "b = a - b", "print(a, b)"];
      res = [A + B, A];
      wrongs = [
        [A + B, B, ln("Значение b меняется в строке 4: b = a − b.", "b мәні 4-жолда өзгереді: b = a − b.")],
        [A, B, ln("Это значения до строк 3 и 4.", "Бұл 3 және 4-жолдарға дейінгі мәндер.")],
        [B, A + B, ln("Порядок перепутан: сначала печатается a, потом b.", "Реті шатасқан: алдымен a, содан кейін b басылады.")],
        [A + B, A + B, ln("В строке 4 в b кладётся a − b, а не a.", "4-жолда b ішіне a емес, a − b салынады.")],
      ];
      expl = ln(
        `Строка 3: a = ${A} + ${B} = ${A + B}. Строка 4: b = ${A + B} − ${B} = ${A}. Выведется ${A + B} ${A}.`,
        `3-жол: a = ${A} + ${B} = ${A + B}. 4-жол: b = ${A + B} − ${B} = ${A}. ${A + B} ${A} шығады.`,
      );
    } else if (v === 1) {
      lines = [`a = ${A}`, `b = ${B}`, `b = b * ${K}`, "a = a + b", "print(a, b)"];
      res = [A + B * K, B * K];
      wrongs = [
        [A + B, B * K, ln("В строке 4 прибавляется уже новое b (после умножения), а не старое.", "4-жолда b-ның ескі мәні емес, көбейтуден кейінгі жаңа мәні қосылады.")],
        [A + B * K, B, ln("В строке 3 b умножается и сохраняет новое значение.", "3-жолда b көбейтіліп, жаңа мәнін сақтайды.")],
        [(A + B) * K, B * K, ln("Умножается только b, а не сумма a + b.", "Тек b көбейтіледі, a + b қосындысы емес.")],
        [B * K, A + B * K, ln("Порядок перепутан: сначала печатается a, потом b.", "Реті шатасқан: алдымен a, содан кейін b басылады.")],
      ];
      expl = ln(
        `Строка 3: b = ${B} * ${K} = ${B * K}. Строка 4: a = ${A} + ${B * K} = ${A + B * K}. Выведется ${A + B * K} ${B * K}.`,
        `3-жол: b = ${B} * ${K} = ${B * K}. 4-жол: a = ${A} + ${B * K} = ${A + B * K}. ${A + B * K} ${B * K} шығады.`,
      );
    } else {
      lines = [`a = ${A}`, `b = a + ${B}`, `a = b * ${K}`, "print(a, b)"];
      res = [(A + B) * K, A + B];
      wrongs = [
        [A * K, A + B, ln("В строке 3 умножается новое значение b, а не старое a.", "3-жолда ескі a емес, b-ның жаңа мәні көбейтіледі.")],
        [A + B, (A + B) * K, ln("Порядок перепутан: сначала печатается a, потом b.", "Реті шатасқан: алдымен a, содан кейін b басылады.")],
        [(A + B) * K, A, ln("b меняется в строке 2: b = a + число.", "b 2-жолда өзгереді: b = a + сан.")],
        [A * K, B, ln("Обе переменные пересчитываются: b в строке 2, a в строке 3.", "Екі айнымалы да қайта есептеледі: b — 2-жолда, a — 3-жолда.")],
      ];
      expl = ln(
        `Строка 2: b = ${A} + ${B} = ${A + B}. Строка 3: a = ${A + B} * ${K} = ${(A + B) * K}. Выведется ${(A + B) * K} ${A + B}.`,
        `2-жол: b = ${A} + ${B} = ${A + B}. 3-жол: a = ${A + B} * ${K} = ${(A + B) * K}. ${(A + B) * K} ${A + B} шығады.`,
      );
    }
    return choice(
      rand,
      { id, level, prompt: WHAT_PRINTS, scene: code(lines), reveal: reveal(lines, [["a", res[0]], ["b", res[1]]], [`${res[0]} ${res[1]}`]), hint, explanation: expl },
      `${res[0]} ${res[1]}`,
      wrongs.map(([x, y, why]) => ({ text: `${x} ${y}`, why })),
    );
  }

  // C: обмен значений и одновременное присваивание
  const v = int(rand, 0, 2);
  const id = `g:py.vars:trace3:${v}-${A}-${B}:${seed}`;
  const hint = ln("Запиши a и b после каждой строки. Помни: в a, b = ..., ... правая часть вычисляется целиком до присваивания.", "Әр жолдан кейін a және b жаз. Есіңде болсын: a, b = ..., ... жазбасында оң жағы меншіктеуге дейін толық есептеледі.");
  let lines: string[];
  let res: [number, number];
  let wrongs: [number, number, L][];
  let expl: L;
  if (v === 0) {
    lines = [`a = ${A}`, `b = ${B}`, "a = a + b", "b = a - b", "a = a - b", "print(a, b)"];
    res = [B, A];
    wrongs = [
      [A, B, ln("Это значения до строк 3–5: они как раз меняют a и b местами.", "Бұл 3–5-жолдарға дейінгі мәндер: олар a мен b-ны дәл ауыстырады.")],
      [A + B, A, ln("Это значения после строки 4, но строка 5 ещё меняет a.", "Бұл 4-жолдан кейінгі мәндер, бірақ 5-жол a-ны тағы өзгертеді.")],
      [B, B, ln("После строки 4 в b лежит старое a, а не b.", "4-жолдан кейін b ішінде b емес, ескі a жатыр.")],
      [A + B, B, ln("Строки 4 и 5 меняют обе переменные.", "4 және 5-жолдар екі айнымалыны да өзгертеді.")],
    ];
    expl = ln(
      `Строка 3: a = ${A + B}. Строка 4: b = ${A + B} − ${B} = ${A}. Строка 5: a = ${A + B} − ${A} = ${B}. Выведется ${B} ${A}: значения поменялись местами.`,
      `3-жол: a = ${A + B}. 4-жол: b = ${A + B} − ${B} = ${A}. 5-жол: a = ${A + B} − ${A} = ${B}. ${B} ${A} шығады: мәндер орын ауыстырды.`,
    );
  } else if (v === 1) {
    lines = [`a = ${A}`, `b = ${B}`, "a, b = b, a + b", "print(a, b)"];
    res = [B, A + B];
    wrongs = [
      [B, 2 * B, ln("Правая часть вычисляется целиком по старым значениям: a + b = старое a + старое b.", "Оң жағы ескі мәндер бойынша толық есептеледі: a + b = ескі a + ескі b.")],
      [A, A + B, ln("В a кладётся старое b, а не a.", "a ішіне a емес, ескі b салынады.")],
      [A + B, B, ln("Порядок перепутан: слева направо a получает b, b получает a + b.", "Реті шатасқан: солдан оңға a — b мәнін, b — a + b мәнін алады.")],
      [B, A, ln("В b кладётся сумма a + b, а не старое a.", "b ішіне ескі a емес, a + b қосындысы салынады.")],
    ];
    expl = ln(
      `Правая часть считается по старым значениям: (${B}, ${A} + ${B} = ${A + B}). Потом a = ${B}, b = ${A + B}. Выведется ${B} ${A + B}.`,
      `Оң жағы ескі мәндер бойынша есептеледі: (${B}, ${A} + ${B} = ${A + B}). Содан кейін a = ${B}, b = ${A + B}. ${B} ${A + B} шығады.`,
    );
  } else {
    lines = [`a = ${A}`, `b = ${B}`, "a, b = b, a + b", "a, b = b, a + b", "print(a, b)"];
    res = [A + B, A + 2 * B];
    wrongs = [
      [B, A + B, ln("Выполнена только одна из двух строк с обменом.", "Алмастыру жазылған екі жолдың тек біреуі орындалған.")],
      [A + 2 * B, A + B, ln("Порядок перепутан: сначала печатается a, потом b.", "Реті шатасқан: алдымен a, содан кейін b басылады.")],
      [A + B, A + B, ln("Во второй строке b = a + b: прибавляется старое значение a.", "Екінші жолда b = a + b: a-ның ескі мәні қосылады.")],
      [A + 2 * B, A + 2 * B, ln("Во второй строке a получает старое b, а не новую сумму.", "Екінші жолда a жаңа қосындыны емес, b-ның ескі мәнін алады.")],
    ];
    expl = ln(
      `После первого обмена: a = ${B}, b = ${A + B}. После второго: a = ${A + B}, b = ${B} + ${A + B} = ${A + 2 * B}. Выведется ${A + B} ${A + 2 * B}.`,
      `Бірінші алмастырудан кейін: a = ${B}, b = ${A + B}. Екіншіден кейін: a = ${A + B}, b = ${B} + ${A + B} = ${A + 2 * B}. ${A + B} ${A + 2 * B} шығады.`,
    );
  }
  return choice(
    rand,
    { id, level, prompt: WHAT_PRINTS, scene: code(lines), reveal: reveal(lines, [["a", res[0]], ["b", res[1]]], [`${res[0]} ${res[1]}`]), hint, explanation: expl },
    `${res[0]} ${res[1]}`,
    wrongs.map(([x, y, why]) => ({ text: `${x} ${y}`, why })),
  );
}

// ---------- Деление: / // % ----------

function genDivmod(rand: Rand, level: Level, seed: number) {
  if (level === 1) {
    const b = int(rand, 3, 9);
    const a = int(rand, 10, 59);
    const r = a % b;
    const q = Math.floor(a / b);
    const op = r === 0 ? "//" : pick(rand, ["//", "%"] as const);
    const value = op === "//" ? q : r;
    const lines = [`print(${a} ${op} ${b})`];
    return numInput(
      {
        id: `g:py.vars:divmod1:${a}${op === "//" ? "q" : "r"}${b}:${seed}`,
        level,
        scene: code(lines),
        reveal: reveal(lines, [], [String(value)]),
        hint:
          op === "//"
            ? ln("// — целая часть деления: сколько раз второе число полностью помещается в первом.", "// — бөлудің бүтін бөлігі: екінші сан біріншіге неше рет толық сыяды.")
            : ln("% — остаток: что остаётся после того, как отложены полные группы.", "% — қалдық: толық топтар бөлініп алынған соң не қалады."),
        explanation:
          op === "//"
            ? ln(`${b} * ${q} = ${b * q} ≤ ${a}, а ${b} * ${q + 1} = ${b * (q + 1)} > ${a}. Значит, ${a} // ${b} = ${q}.`, `${b} * ${q} = ${b * q} ≤ ${a}, ал ${b} * ${q + 1} = ${b * (q + 1)} > ${a}. Демек, ${a} // ${b} = ${q}.`)
            : ln(`${a} // ${b} = ${q}, остаток: ${a} − ${b} * ${q} = ${a} − ${b * q} = ${r}.`, `${a} // ${b} = ${q}, қалдық: ${a} − ${b} * ${q} = ${a} − ${b * q} = ${r}.`),
      },
      String(value),
    );
  }

  if (level === 2) {
    const b = pick(rand, [2, 4, 5, 8] as const);
    let a = int(rand, 20, 99);
    if (a % b === 0) a += 1;
    const q = Math.floor(a / b);
    const r = a % b;
    const exact = pyFloat(a / b);
    const frac = exact.split(".")[1];
    const lines = [`a = ${a}`, `b = ${b}`, "print(a // b, a % b)"];
    return choice(
      rand,
      {
        id: `g:py.vars:divmod2:${a}-${b}:${seed}`,
        level,
        prompt: WHAT_PRINTS,
        scene: code(lines),
        reveal: reveal(lines, [["a", a], ["b", b]], [`${q} ${r}`]),
        hint: ln("Сначала найди целую часть деления, потом остаток: остаток = a минус полные группы по b.", "Алдымен бөлудің бүтін бөлігін, сосын қалдықты тап: қалдық = a минус b-дан тұратын толық топтар."),
        explanation: ln(
          `${a} // ${b} = ${q} (${b} * ${q} = ${b * q}), ${a} % ${b} = ${a} − ${b * q} = ${r}. Выведется ${q} ${r}.`,
          `${a} // ${b} = ${q} (${b} * ${q} = ${b * q}), ${a} % ${b} = ${a} − ${b * q} = ${r}. ${q} ${r} шығады.`,
        ),
      },
      `${q} ${r}`,
      [
        { text: `${r} ${q}`, why: ln("Порядок перепутан: сначала печатается a // b, потом a % b.", "Реті шатасқан: алдымен a // b, содан кейін a % b басылады.") },
        { text: `${exact} ${r}`, why: ln("Это результат обычного деления /, а в программе стоит //.", "Бұл қарапайым бөлу / нәтижесі, ал программада // тұр.") },
        { text: `${q} ${frac}`, why: ln("Цифры после точки в a / b — не остаток от деления.", "a / b ішіндегі нүктеден кейінгі цифрлар — бөлгендегі қалдық емес.") },
        { text: `${exact} ${q}`, why: ln("Ни одна из операций не даёт дробное число: // и % работают с целыми.", "Ешбір амал бөлшек сан бермейді: // және % бүтін сандармен жұмыс істейді.") },
        { text: `${q + 1} ${r}`, why: ln("// не округляет вверх: лишние конфеты не образуют ещё одну полную группу.", "// жоғары қарай дөңгелектемейді: артық бөлік тағы бір толық топ құрамайды.") },
        { text: `${q} ${b - r}`, why: ln("Остаток — это то, что осталось после полных групп, а не то, чего не хватает до следующей.", "Қалдық — толық топтардан кейін қалғаны, келесі топқа жетпейтіні емес.") },
      ],
    );
  }

  // C: обратная задача — найти делимое по неполному частному и остатку
  const b = int(rand, 4, 9);
  const q = int(rand, 3, 15);
  const r = int(rand, 1, b - 1);
  const n = q * b + r;
  return {
    id: `g:py.vars:divmod3:${b}-${q}-${r}:${seed}`,
    type: "input" as const,
    skill: SKILL,
    level,
    prompt: ln(`Известно: n // ${b} = ${q} и n % ${b} = ${r}. Чему равно n?`, `Белгілі: n // ${b} = ${q} және n % ${b} = ${r}. n неге тең?`),
    answers: [String(n)],
    mode: "number" as const,
    hint: ln("Из частного и остатка число собирается так: делитель умножить на неполное частное и прибавить остаток.", "Бөлінді мен қалдықтан сан былай құралады: бөлгішті бөліндіге көбейтіп, қалдықты қосады."),
    explanation: ln(
      `n = ${b} * ${q} + ${r} = ${b * q} + ${r} = ${n}. Проверка: ${n} // ${b} = ${q}, ${n} % ${b} = ${r}.`,
      `n = ${b} * ${q} + ${r} = ${b * q} + ${r} = ${n}. Тексеру: ${n} // ${b} = ${q}, ${n} % ${b} = ${r}.`,
    ),
  };
}

// ---------- Значение выражения (приоритет операций) ----------

function genExpr(rand: Rand, level: Level, seed: number) {
  const hintPrec = ln("Порядок действий: скобки, затем **, затем * / // %, затем + и −.", "Амалдар реті: жақша, содан кейін **, сосын * / // %, одан кейін + және −.");
  const mkInput = (kind: string, params: number[], expr: string, value: number, steps: string) =>
    numInput(
      {
        id: `g:py.vars:expr${level}:${kind}-${params.join("-")}:${seed}`,
        level,
        scene: code([`print(${expr})`]),
        hint: hintPrec,
        explanation: ln(`${steps}. Выведется ${value}.`, `${steps}. ${value} шығады.`),
      },
      String(value),
    );

  if (level === 1) {
    const a = int(rand, 2, 9);
    const b = int(rand, 2, 9);
    const c = int(rand, 2, 5);
    const t = int(rand, 0, 2);
    if (t === 0) return mkInput("a", [a, b, c], `${a} + ${b} * ${c}`, a + b * c, `Сначала умножение: ${b} * ${c} = ${b * c}, потом сложение: ${a} + ${b * c} = ${a + b * c}`);
    if (t === 1) return mkInput("b", [a, b, c], `(${a} + ${b}) * ${c}`, (a + b) * c, `Скобки первыми: ${a} + ${b} = ${a + b}, потом ${a + b} * ${c} = ${(a + b) * c}`);
    const x = a * b > c ? a * b - c : a * b + c;
    const op = a * b > c ? "-" : "+";
    return mkInput("c", [a, b, c], `${a} * ${b} ${op} ${c}`, x, `Сначала умножение: ${a} * ${b} = ${a * b}, потом ${a * b} ${op} ${c} = ${x}`);
  }

  if (level === 2) {
    const t = int(rand, 0, 4);
    const a = int(rand, 3, 30);
    const b = int(rand, 2, 6);
    const c = int(rand, 2, 7);
    if (t === 0) return mkInput("a", [a, b], `${a} + ${b} ** 2`, a + b * b, `Степень первой: ${b} ** 2 = ${b * b}, потом ${a} + ${b * b} = ${a + b * b}`);
    if (t === 1) return mkInput("b", [a, b, c], `${a} * ${b} % ${c}`, (a * b) % c, `Слева направо: ${a} * ${b} = ${a * b}, потом ${a * b} % ${c} = ${(a * b) % c}`);
    if (t === 2) return mkInput("c", [a, b], `${a} // ${b} + ${a} % ${b}`, Math.floor(a / b) + (a % b), `${a} // ${b} = ${Math.floor(a / b)}, ${a} % ${b} = ${a % b}, сумма ${Math.floor(a / b) + (a % b)}`);
    if (t === 3) return mkInput("d", [a, b], `(${a} + ${b}) ** 2`, (a + b) ** 2, `Скобки: ${a} + ${b} = ${a + b}, потом ${a + b} ** 2 = ${(a + b) ** 2}`);
    const m = a + 40;
    return mkInput("e", [m, b, c], `${m} - ${b} ** 2 * ${c}`, m - b * b * c, `Сначала степень: ${b} ** 2 = ${b * b}, потом ${b * b} * ${c} = ${b * b * c}, потом ${m} − ${b * b * c} = ${m - b * b * c}`);
  }

  // C: выбор из 4; неверные варианты — типичные ошибки приоритета
  const t = int(rand, 0, 2);
  for (let attempt = 0; attempt < 60; attempt++) {
    const a = int(rand, 3, 15);
    const b = int(rand, 3, 9);
    const c = int(rand, 2, 6);
    const d = int(rand, 3, 9);
    if (t === 1 && c % d === 0) continue;
    let expr: string;
    let value: number;
    let wrong: [number, L][];
    let steps: string;
    if (t === 0) {
      expr = `${a} + ${b} * ${c} ** 2 // ${d}`;
      value = a + Math.floor((b * c ** 2) / d);
      steps = `${c} ** 2 = ${c ** 2}; ${b} * ${c ** 2} = ${b * c ** 2}; ${b * c ** 2} // ${d} = ${Math.floor((b * c ** 2) / d)}; ${a} + ${Math.floor((b * c ** 2) / d)} = ${value}`;
      wrong = [
        [Math.floor(((a + b) * c ** 2) / d), ln("Сложение выполнено раньше умножения.", "Қосу көбейтуден бұрын орындалған.")],
        [a + b * Math.floor(c ** 2 / d), ln("// выполнено раньше *, хотя они равны по приоритету и идут слева направо.", "// амалы * амалынан бұрын орындалған, ал олардың басымдығы тең және солдан оңға орындалады.")],
        [a + b * c ** 2, ln("Пропущено деление // на последнем шаге.", "Соңғы қадамдағы // бөлу өткізіп жіберілген.")],
        [Math.floor((a + b * c) ** 2 / d), ln("Степень применена ко всей сумме, а не только к c.", "Дәреже тек c-ға емес, бүкіл қосындыға қолданылған.")],
        [a + Math.floor((b * c * 2) / d), ln("Степень c ** 2 принята за удвоение c * 2.", "c ** 2 дәрежесі c * 2 екі еселеу деп алынған.")],
      ];
    } else if (t === 1) {
      expr = `${a} * ${b} // ${c} % ${d}`;
      value = Math.floor((a * b) / c) % d;
      steps = `слева направо: ${a} * ${b} = ${a * b}; ${a * b} // ${c} = ${Math.floor((a * b) / c)}; ${Math.floor((a * b) / c)} % ${d} = ${value}`;
      wrong = [
        [a * (Math.floor(b / c) % d), ln("Скобки поставлены не там: операции идут слева направо.", "Жақша қате қойылған: амалдар солдан оңға орындалады.")],
        [Math.floor((a * b) / (c % d)), ln("Сначала выполнено %, хотя оно стоит правее //.", "% бұрын орындалған, ал ол // амалының оң жағында тұр.")],
        [Math.floor((a * b) / c), ln("Пропущено действие % на последнем шаге.", "Соңғы қадамдағы % амалы өткізіп жіберілген.")],
        [(a * b) % d, ln("Пропущено деление // на c.", "c-ға // бөлу өткізіп жіберілген.")],
        [(Math.floor(a / c) * b) % d, ln("Деление a // c выполнено раньше умножения a * b.", "a // c бөлуі a * b көбейтуінен бұрын орындалған.")],
      ];
    } else {
      expr = `(${a} + ${b}) ** 2 // ${c} + ${d}`;
      value = Math.floor((a + b) ** 2 / c) + d;
      steps = `${a} + ${b} = ${a + b}; ${a + b} ** 2 = ${(a + b) ** 2}; ${(a + b) ** 2} // ${c} = ${Math.floor((a + b) ** 2 / c)}; + ${d} = ${value}`;
      wrong = [
        [Math.floor((a + b) ** 2 / (c + d)), ln("Деление выполнено после сложения: // и + стоят по приоритету не так.", "Бөлу қосудан кейін орындалған: // және + басымдығы олай емес.")],
        [a + Math.floor(b ** 2 / c) + d, ln("Скобки проигнорированы: степень применена только к b.", "Жақша ескерілмеген: дәреже тек b-ға қолданылған.")],
        [(a + b) ** 2 + d, ln("Пропущено деление // на c.", "c-ға // бөлу өткізіп жіберілген.")],
        [Math.floor((a + b) ** 2 / c), ln("Забыто последнее слагаемое.", "Соңғы қосылғыш ұмытылған.")],
        [Math.floor(((a + b) * 2) / c) + d, ln("Степень ** 2 принята за удвоение.", "** 2 дәрежесі екі еселеу деп алынған.")],
      ];
    }
    const texts = new Set<number>([value]);
    const usable = wrong.filter(([v]) => Number.isFinite(v) && !texts.has(v) && texts.add(v));
    if (usable.length < 3) continue;
    return choice(
      rand,
      {
        id: `g:py.vars:expr3:${t}-${a}-${b}-${c}-${d}:${seed}`,
        level,
        prompt: WHAT_PRINTS,
        scene: code([`print(${expr})`]),
        hint: hintPrec,
        explanation: ln(`Порядок действий: ${steps}. Выведется ${value}.`, `Амалдар реті: ${steps}. ${value} шығады.`),
      },
      String(value),
      usable.map(([v, why]) => ({ text: String(v), why })),
    );
  }
  throw new Error("py-1-vars: не удалось собрать задание expr3");
}

// ---------- Цифры числа ----------

function genDigits(rand: Rand, level: Level, seed: number) {
  if (level === 1) {
    const n = int(rand, 21, 98);
    const t = int(rand, 0, 2);
    const a = Math.floor(n / 10);
    const b = n % 10;
    const expr = t === 0 ? "n // 10" : t === 1 ? "n % 10" : "n // 10 + n % 10";
    const value = t === 0 ? a : t === 1 ? b : a + b;
    const lines = [`n = ${n}`, `print(${expr})`];
    return numInput(
      {
        id: `g:py.vars:digits1:${n}-${t}:${seed}`,
        level,
        scene: code(lines),
        reveal: reveal(lines, [["n", n]], [String(value)]),
        hint: ln("n % 10 — последняя цифра числа, n // 10 — число без последней цифры.", "n % 10 — санның соңғы цифры, n // 10 — соңғы цифрсыз сан."),
        explanation: ln(
          `${n} // 10 = ${a} (цифра десятков), ${n} % 10 = ${b} (цифра единиц).${t === 2 ? ` Сумма: ${a} + ${b} = ${a + b}.` : ""} Выведется ${value}.`,
          `${n} // 10 = ${a} (ондықтар цифры), ${n} % 10 = ${b} (бірліктер цифры).${t === 2 ? ` Қосынды: ${a} + ${b} = ${a + b}.` : ""} ${value} шығады.`,
        ),
      },
      String(value),
    );
  }

  if (level === 2) {
    const t = int(rand, 0, 2);
    if (t === 2) {
      const a = int(rand, 1, 9);
      const b = int(rand, 1, 9);
      const n = a * 10 + b;
      const lines = [`n = ${n}`, "a = n // 10", "b = n % 10", "n = b * 10 + a", "print(n)"];
      const value = b * 10 + a;
      return numInput(
        {
          id: `g:py.vars:digits2:r-${n}:${seed}`,
          level,
          scene: code(lines),
          reveal: reveal(lines, [["n", value], ["a", a], ["b", b]], [String(value)]),
          hint: ln("Сначала найди a и b — это цифры числа. Потом посмотри, в каком порядке они собираются заново.", "Алдымен a және b мәндерін тап — олар санның цифрлары. Содан кейін олардың қандай ретпен қайта жиналатынын қара."),
          explanation: ln(`a = ${a}, b = ${b}. Новое n = ${b} * 10 + ${a} = ${value}: цифры поменялись местами.`, `a = ${a}, b = ${b}. Жаңа n = ${b} * 10 + ${a} = ${value}: цифрлар орын ауыстырды.`),
        },
        String(value),
      );
    }
    const n = int(rand, 101, 999);
    const h = Math.floor(n / 100);
    const tn = Math.floor(n / 10) % 10;
    const u = n % 10;
    if (t === 0) {
      const lines = [`n = ${n}`, "s = n // 100 + n // 10 % 10 + n % 10", "print(s)"];
      return numInput(
        {
          id: `g:py.vars:digits2:s-${n}:${seed}`,
          level,
          scene: code(lines),
          reveal: reveal(lines, [["n", n], ["s", h + tn + u]], [String(h + tn + u)]),
          hint: ln("Три слагаемых — это сотни, десятки и единицы числа. Найди каждую цифру отдельно.", "Үш қосылғыш — санның жүздіктері, ондықтары және бірліктері. Әр цифрды бөлек тап."),
          explanation: ln(
            `${n} // 100 = ${h}; ${n} // 10 % 10 = ${Math.floor(n / 10)} % 10 = ${tn}; ${n} % 10 = ${u}. Сумма цифр: ${h} + ${tn} + ${u} = ${h + tn + u}.`,
            `${n} // 100 = ${h}; ${n} // 10 % 10 = ${Math.floor(n / 10)} % 10 = ${tn}; ${n} % 10 = ${u}. Цифрлар қосындысы: ${h} + ${tn} + ${u} = ${h + tn + u}.`,
          ),
        },
        String(h + tn + u),
      );
    }
    const lines = [`n = ${n}`, "print(n // 10 % 10)"];
    return numInput(
      {
        id: `g:py.vars:digits2:t-${n}:${seed}`,
        level,
        scene: code(lines),
        reveal: reveal(lines, [["n", n]], [String(tn)]),
        hint: ln("Действия идут слева направо: сначала // 10, потом % 10 от результата.", "Амалдар солдан оңға қарай орындалады: алдымен // 10, сосын нәтижеге % 10."),
        explanation: ln(`${n} // 10 = ${Math.floor(n / 10)}, потом ${Math.floor(n / 10)} % 10 = ${tn} — цифра десятков.`, `${n} // 10 = ${Math.floor(n / 10)}, содан кейін ${Math.floor(n / 10)} % 10 = ${tn} — ондықтар цифры.`),
      },
      String(tn),
    );
  }

  // C: сборка нового числа из цифр
  const a = int(rand, 1, 9);
  const b = int(rand, 0, 9);
  const c = int(rand, 1, 9);
  const n = a * 100 + b * 10 + c;
  const t = int(rand, 0, 1);
  if (t === 0) {
    const value = c * 100 + b * 10 + a;
    const lines = [`n = ${n}`, "a = n // 100", "b = n // 10 % 10", "c = n % 10", "print(c * 100 + b * 10 + a)"];
    return numInput(
      {
        id: `g:py.vars:digits3:r-${n}:${seed}`,
        level,
        scene: code(lines),
        reveal: reveal(lines, [["n", n], ["a", a], ["b", b], ["c", c]], [String(value)]),
        hint: ln("Найди сотни a, десятки b и единицы c. В печатаемом числе c стоит на месте сотен.", "Жүздіктер a, ондықтар b және бірліктер c мәндерін тап. Басылатын санда c жүздіктер орнында тұр."),
        explanation: ln(`a = ${a}, b = ${b}, c = ${c}. Выведется c * 100 + b * 10 + a = ${c * 100} + ${b * 10} + ${a} = ${value}: число записано наоборот.`, `a = ${a}, b = ${b}, c = ${c}. c * 100 + b * 10 + a = ${c * 100} + ${b * 10} + ${a} = ${value} шығады: сан кері жазылған.`),
      },
      String(value),
    );
  }
  const value = (a + c) * 10 + b;
  const lines = [`n = ${n}`, "x = n // 100 + n % 10", "y = n // 10 % 10", "print(x * 10 + y)"];
  return numInput(
    {
      id: `g:py.vars:digits3:m-${n}:${seed}`,
      level,
      scene: code(lines),
      reveal: reveal(lines, [["n", n], ["x", a + c], ["y", b]], [String(value)]),
      hint: ln("x — сумма крайних цифр числа, y — средняя цифра. Потом собери x * 10 + y.", "x — санның шеткі цифрларының қосындысы, y — ортаңғы цифр. Содан кейін x * 10 + y жина."),
      explanation: ln(`x = ${a} + ${c} = ${a + c}, y = ${b}. Выведется ${a + c} * 10 + ${b} = ${value}.`, `x = ${a} + ${c} = ${a + c}, y = ${b}. ${a + c} * 10 + ${b} = ${value} шығады.`),
    },
    String(value),
  );
}

// ---------- Типы значений ----------

interface TypeCase {
  expr: string;
  type: "int" | "float" | "str" | "bool";
  level: Level;
  trap?: { type: "int" | "float" | "str" | "bool"; why: L };
}

const TYPES = ["int", "float", "str", "bool"] as const;

const NOT_THIS: Record<(typeof TYPES)[number], L> = {
  int: ln("Это не int: результат не целое число без кавычек.", "Бұл int емес: нәтиже тырнақсыз бүтін сан емес."),
  float: ln("Это не float: результат не дробное число.", "Бұл float емес: нәтиже бөлшек сан емес."),
  str: ln("Это не str: результат не текст (строка).", "Бұл str емес: нәтиже мәтін (жол) емес."),
  bool: ln("Это не bool: результат не True и не False.", "Бұл bool емес: нәтиже True да, False та емес."),
};

const TYPE_CASES: TypeCase[] = [
  { expr: "7 / 2", type: "float", level: 1, trap: { type: "int", why: ln("Деление / всегда даёт float.", "/ бөлуі әрқашан float береді.") } },
  { expr: "7 // 2", type: "int", level: 1, trap: { type: "float", why: ln("Целочисленное деление // даёт int.", "Бүтін бөлу // int береді.") } },
  { expr: "'7' + '2'", type: "str", level: 1, trap: { type: "int", why: ln("Числа в кавычках — это текст, '7' + '2' склеивается в '72'.", "Тырнақшадағы сандар — мәтін, '7' + '2' жалғанып '72' болады.") } },
  { expr: "7 > 2", type: "bool", level: 1, trap: { type: "int", why: ln("Сравнение даёт логическое значение True или False.", "Салыстыру True немесе False логикалық мәнін береді.") } },
  { expr: "2 ** 3", type: "int", level: 1 },
  { expr: "7 * 1.5", type: "float", level: 1, trap: { type: "int", why: ln("Один из множителей дробный, значит, результат float.", "Көбейткіштердің бірі бөлшек, демек нәтиже float.") } },
  { expr: "'abc'", type: "str", level: 1 },
  { expr: "True", type: "bool", level: 1 },
  { expr: "6 / 2", type: "float", level: 2, trap: { type: "int", why: ln("6 / 2 даёт 3.0 — это float, хотя деление без остатка.", "6 / 2 нәтижесі 3.0 — қалдықсыз бөлінсе де, бұл float.") } },
  { expr: "'3' * 2", type: "str", level: 2, trap: { type: "int", why: ln("Строка, умноженная на число, остаётся строкой: '33'.", "Санға көбейтілген жол жол болып қалады: '33'.") } },
  { expr: "int('7') + 1", type: "int", level: 2, trap: { type: "str", why: ln("int('7') превращает строку в число, поэтому сумма — число.", "int('7') жолды санға айналдырады, сондықтан қосынды — сан.") } },
  { expr: "10 % 4", type: "int", level: 2 },
  { expr: "2.0 * 3", type: "float", level: 2, trap: { type: "int", why: ln("Множитель 2.0 дробный, поэтому результат 6.0 — float.", "2.0 көбейткіші бөлшек, сондықтан нәтиже 6.0 — float.") } },
  { expr: "str(42)", type: "str", level: 2, trap: { type: "int", why: ln("str() превращает число в строку.", "str() санды жолға айналдырады.") } },
  { expr: "5 < 3", type: "bool", level: 2 },
  { expr: "7 // 2.0", type: "float", level: 3, trap: { type: "int", why: ln("Если одно из чисел дробное, результат // тоже дробный: 3.0.", "Сандардың бірі бөлшек болса, // нәтижесі де бөлшек: 3.0.") } },
  { expr: "'5' + str(5)", type: "str", level: 3, trap: { type: "int", why: ln("Обе части — строки, они склеиваются: '55'.", "Екі бөлік те — жолдар, олар жалғанады: '55'.") } },
  { expr: "int('2') * 3", type: "int", level: 3, trap: { type: "str", why: ln("int('2') — число, поэтому произведение — число 6.", "int('2') — сан, сондықтан көбейтінді — 6 саны.") } },
  { expr: "10 / 5", type: "float", level: 3, trap: { type: "int", why: ln("10 / 5 даёт 2.0 — float, а не 2.", "10 / 5 нәтижесі 2.0 — float, 2 емес.") } },
  { expr: "float(4)", type: "float", level: 3, trap: { type: "int", why: ln("float() превращает число в дробное: 4.0.", "float() санды бөлшекке айналдырады: 4.0.") } },
  { expr: "2 ** 0.5", type: "float", level: 3 },
];

function genType(rand: Rand, level: Level, seed: number) {
  const cases = TYPE_CASES.map((c, i) => ({ c, i })).filter((x) => x.c.level === level);
  const { c, i } = pick(rand, cases);
  const lines = [`x = ${c.expr}`];
  const wrongs: Wrong[] = TYPES.filter((t) => t !== c.type).map((t) => ({
    text: t,
    why: c.trap && c.trap.type === t ? c.trap.why : NOT_THIS[t],
  }));
  // Типичную ловушку ставим первой, чтобы она точно попала в варианты.
  wrongs.sort((a) => (c.trap && a.text === c.trap.type ? -1 : 1));
  const opts = choice(
    rand,
    {
      id: `g:py.vars:type:${level}c${i}:${seed}`,
      level,
      prompt: ln("Какой тип имеет значение x?", "x мәні қандай типке жатады?"),
      scene: code(lines),
      hint: ln("int — целое число, float — дробное, str — текст в кавычках, bool — True или False. Посмотри на знак операции и на кавычки.", "int — бүтін сан, float — бөлшек сан, str — тырнақшадағы мәтін, bool — True немесе False. Амал белгісі мен тырнақшаға қара."),
      explanation: ln(`Выражение ${c.expr} имеет тип ${c.type}.`, `${c.expr} өрнегінің типі — ${c.type}.`),
    },
    c.type,
    wrongs,
  );
  // Типы всегда идут в одном и том же порядке — так проще сравнивать.
  const order = [...TYPES] as string[];
  const rank = opts.options.map((o, k) => ({ o: o as string, w: opts.whyWrong![k], right: k === opts.correct }));
  rank.sort((p, q) => order.indexOf(p.o) - order.indexOf(q.o));
  return { ...opts, options: rank.map((r) => r.o), whyWrong: rank.map((r) => r.w), correct: rank.findIndex((r) => r.right) };
}

// ---------- Строки ----------

function genString(rand: Rand, level: Level, seed: number) {
  if (level <= 2) {
    const t = int(rand, 0, 1);
    if (t === 0) {
      const s = pick(rand, ["ab", "xy", "la", "ha", "ok", "5", "7", "12"] as const);
      const k = int(rand, 2, 4);
      const value = s.repeat(k);
      return numInput(
        {
          id: `g:py.vars:string:r-${s}-${k}:${seed}`,
          level: 2,
          scene: code([`print('${s}' * ${k})`]),
          hint: ln("Строку можно умножить на число: она повторится столько раз.", "Жолды санға көбейтуге болады: ол сонша рет қайталанады."),
          explanation: ln(`Умножение строки на число повторяет её: '${s}' * ${k} = ${value}.`, `Жолды санға көбейту оны қайталайды: '${s}' * ${k} = ${value}.`),
        },
        value,
        "text",
      );
    }
    const a = int(rand, 1, 9);
    const b = int(rand, 10, 99);
    const value = `${a}${b}`;
    return numInput(
      {
        id: `g:py.vars:string:c-${a}-${b}:${seed}`,
        level: 2,
        scene: code([`print('${a}' + '${b}')`]),
        hint: ln("Числа в кавычках — это строки. Что делает + со строками?", "Тырнақшадағы сандар — жолдар. + амалы жолдармен не істейді?"),
        explanation: ln(`'${a}' и '${b}' — строки, + склеивает их: ${value}. Сложения чисел нет.`, `'${a}' және '${b}' — жолдар, + оларды жалғайды: ${value}. Сандарды қосу болмайды.`),
      },
      value,
      "text",
    );
  }
  const a = int(rand, 2, 8);
  const b = int(rand, 2, 8);
  const value = `${a}${b} ${a + b}`;
  const lines = [`a = '${a}'`, `b = '${b}'`, "print(a + b, int(a) + int(b))"];
  return {
    ...numInput(
      {
        id: `g:py.vars:string:m-${a}-${b}:${seed}`,
        level,
        scene: code(lines),
        reveal: reveal(lines, [["a", `'${a}'`], ["b", `'${b}'`]], [value]),
        hint: ln("Первое выражение складывает строки, второе — числа после int().", "Бірінші өрнек жолдарды қосады, екіншісі — int()-тен кейінгі сандарды."),
        explanation: ln(`a + b склеивает строки: '${a}' + '${b}' = ${a}${b}. int(a) + int(b) = ${a} + ${b} = ${a + b}. Через пробел: ${value}.`, `a + b жолдарды жалғайды: '${a}' + '${b}' = ${a}${b}. int(a) + int(b) = ${a} + ${b} = ${a + b}. Бос орын арқылы: ${value}.`),
      },
      value,
      "text",
    ),
  };
}

// ---------- Навык: py.vars ----------

function question(level: Level, seed: number) {
  const rand = seeded(seed);
  const kinds: Record<Level, (() => QuestionStep)[]> = {
    1: [() => genTrace(rand, 1, seed), () => genDivmod(rand, 1, seed), () => genExpr(rand, 1, seed), () => genDigits(rand, 1, seed), () => genType(rand, 1, seed)],
    2: [
      () => genTrace(rand, 2, seed),
      () => genDivmod(rand, 2, seed),
      () => genExpr(rand, 2, seed),
      () => genDigits(rand, 2, seed),
      () => genType(rand, 2, seed),
      () => genString(rand, 2, seed),
    ],
    3: [() => genTrace(rand, 3, seed), () => genDivmod(rand, 3, seed), () => genExpr(rand, 3, seed), () => genDigits(rand, 3, seed), () => genType(rand, 3, seed), () => genString(rand, 3, seed)],
  };
  return pick(rand, kinds[level])();
}

// ---------- Утверждения, пары, короткие вопросы ----------

interface Fact {
  level: Level;
  text: L;
  value: boolean;
  explanation: L;
}

const FACTS: Fact[] = [
  { level: 1, text: ln("Знак = в Python означает «положить значение в переменную»", "Python-да = белгісі «мәнді айнымалыға салу» дегенді білдіреді"), value: true, explanation: ln("Слева стоит имя переменной, справа — значение, которое в неё кладут.", "Сол жақта айнымалының атауы, оң жақта — оған салынатын мән тұрады.") },
  { level: 1, text: ln("Новое значение переменной не стирает старое", "Айнымалының жаңа мәні ескісін өшірмейді"), value: false, explanation: ln("В переменной всегда лежит одно значение: новое заменяет старое.", "Айнымалыда әрқашан бір мән жатады: жаңасы ескісінің орнын басады.") },
  { level: 1, text: ln("Имя переменной может начинаться с цифры", "Айнымалының атауы цифрдан басталуы мүмкін"), value: false, explanation: ln("Имя пишется латиницей без пробелов и не начинается с цифры: x1 можно, 1x нельзя.", "Атау латын әріптерімен, бос орынсыз жазылады және цифрдан басталмайды: x1 болады, 1x болмайды.") },
  { level: 1, text: ln("Операция % даёт остаток от деления", "% амалы бөлгендегі қалдықты береді"), value: true, explanation: ln("Например, 17 % 5 = 2.", "Мысалы, 17 % 5 = 2.") },
  { level: 1, text: ln("Операция // даёт остаток от деления", "// амалы бөлгендегі қалдықты береді"), value: false, explanation: ln("// даёт целую часть деления, а остаток даёт %.", "// бөлудің бүтін бөлігін береді, ал қалдықты % береді.") },
  { level: 1, text: ln("Знак ** в Python означает степень", "Python-да ** белгісі дәрежені білдіреді"), value: true, explanation: ln("2 ** 3 = 8.", "2 ** 3 = 8.") },
  { level: 1, text: ln("print(a, b) выводит значения через пробел", "print(a, b) мәндерді бос орын арқылы шығарады"), value: true, explanation: ln("Чтобы вывести слитно, пишут print(a, b, sep='').", "Тұтас шығару үшін print(a, b, sep='') деп жазады.") },
  { level: 2, text: ln("input() возвращает число", "input() сан қайтарады"), value: false, explanation: ln("input() всегда возвращает строку; число получают так: int(input()).", "input() әрқашан жол қайтарады; санды былай алады: int(input()).") },
  { level: 2, text: ln("int(input()) превращает введённую строку в целое число", "int(input()) енгізілген жолды бүтін санға айналдырады"), value: true, explanation: ln("input() читает строку, а int() переводит её в число.", "input() жолды оқиды, ал int() оны санға айналдырады.") },
  { level: 2, text: ln("Результат операции / всегда имеет тип float", "/ амалының нәтижесі әрқашан float типті болады"), value: true, explanation: ln("Даже 6 / 2 даёт 3.0, а не 3.", "Тіпті 6 / 2 нәтижесі де 3 емес, 3.0.") },
  { level: 2, text: ln("'5' + '5' даёт строку '55'", "'5' + '5' нәтижесі '55' жолы болады"), value: true, explanation: ln("Строки при сложении склеиваются.", "Жолдарды қосқанда олар жалғанады.") },
  { level: 2, text: ln("type(3.5) — это int", "type(3.5) — бұл int"), value: false, explanation: ln("3.5 — дробное число, тип float.", "3.5 — бөлшек сан, типі float.") },
  { level: 3, text: ln("После a, b = b, a значения a и b меняются местами", "a, b = b, a орындалғаннан кейін a және b мәндері орын ауыстырады"), value: true, explanation: ln("Правая часть вычисляется целиком, затем значения кладутся в переменные.", "Оң жағы толық есептеледі, содан кейін мәндер айнымалыларға салынады.") },
  { level: 3, text: ln("Последнюю цифру числа n можно получить как n // 10", "n санының соңғы цифрын n // 10 арқылы алуға болады"), value: false, explanation: ln("n // 10 — число без последней цифры; последняя цифра — n % 10.", "n // 10 — соңғы цифрсыз сан; соңғы цифр — n % 10.") },
  { level: 3, text: ln("Для трёхзначного n цифру десятков даёт выражение n // 10 % 10", "Үш таңбалы n үшін ондықтар цифрын n // 10 % 10 өрнегі береді"), value: true, explanation: ln("Сначала убираем единицы (n // 10), потом берём последнюю цифру (% 10).", "Алдымен бірліктерді алып тастаймыз (n // 10), сосын соңғы цифрды аламыз (% 10).") },
  { level: 3, text: ln("Выражение 2 + 3 * 4 равно 20", "2 + 3 * 4 өрнегі 20-ға тең"), value: false, explanation: ln("Умножение выполняется раньше сложения: 2 + 12 = 14.", "Көбейту қосудан бұрын орындалады: 2 + 12 = 14.") },
];

/** Числовое утверждение: «print(выражение) выведет значение» (верное или с типичной ошибкой). */
function numericStatement(rand: Rand, level: Level): Statement {
  const value = rand() < 0.5;
  const mk = (expr: string, truth: string, wrongs: string[], why: L): Statement => {
    const claim = value ? truth : pick(rand, wrongs.filter((w) => w !== truth));
    return {
      id: `s:py.vars:${expr.replace(/\s+/g, "")}:${claim}`,
      skill: SKILL,
      level,
      text: ln(`print(${expr}) выведет ${claim}`, `print(${expr}) мынаны шығарады: ${claim}`),
      value: claim === truth,
      explanation: ln(`${expr} = ${truth}. ${why.ru}`, `${expr} = ${truth}. ${why.kk}`),
    };
  };
  if (level === 1) {
    const b = int(rand, 3, 9);
    const a = int(rand, 10, 59);
    const q = Math.floor(a / b);
    const r = a % b;
    if (rand() < 0.5) return mk(`${a} // ${b}`, String(q), [String(q + 1), String(r), String(q - 1)], ln("// — целая часть деления.", "// — бөлудің бүтін бөлігі."));
    return mk(`${a} % ${b}`, String(r), [String(q), String(r + 1), pyFloat(a / b)], ln("% — остаток от деления.", "% — бөлгендегі қалдық."));
  }
  if (level === 2) {
    const b = pick(rand, [2, 4, 5] as const);
    const a = b * int(rand, 2, 12);
    const exact = pyFloat(a / b);
    return mk(`${a} / ${b}`, exact, [String(a / b), String(a % b), String(a * b)], ln("/ всегда даёт дробное число (float), даже если делится нацело.", "/ әрқашан бөлшек сан (float) береді, тіпті қалдықсыз бөлінсе де."));
  }
  const n = int(rand, 101, 999);
  const tn = Math.floor(n / 10) % 10;
  return mk(`${n} // 10 % 10`, String(tn), [String(Math.floor(n / 10)), String(n % 10), String(Math.floor(n / 100))], ln("Сначала // 10, потом % 10 — получается цифра десятков.", "Алдымен // 10, сосын % 10 — ондықтар цифры шығады.")) as Statement;
}

function statement(level: Level, seed: number): Statement {
  const rand = seeded(seed);
  if (rand() < 0.5) {
    const facts = FACTS.filter((f) => f.level === level);
    const f = pick(rand, facts);
    return { id: `s:py.vars:fact:${FACTS.indexOf(f)}`, skill: SKILL, level, text: f.text, value: f.value, explanation: f.explanation };
  }
  return numericStatement(rand, level);
}

const STATIC_PAIRS: { level: Level; left: Text; right: Text }[] = [
  { level: 1, left: "int", right: ln("целое число", "бүтін сан") },
  { level: 1, left: "float", right: ln("дробное число", "бөлшек сан") },
  { level: 1, left: "str", right: ln("текст (строка)", "мәтін (жол)") },
  { level: 1, left: "bool", right: ln("True или False", "True немесе False") },
  { level: 1, left: "//", right: ln("целая часть деления", "бөлудің бүтін бөлігі") },
  { level: 1, left: "%", right: ln("остаток от деления", "бөлгендегі қалдық") },
  { level: 1, left: "**", right: ln("степень", "дәреже") },
  { level: 2, left: "/", right: ln("обычное деление (всегда float)", "қарапайым бөлу (әрқашан float)") },
  { level: 2, left: "input()", right: ln("читает строку с клавиатуры", "пернетақтадан жолды оқиды") },
  { level: 2, left: "int()", right: ln("превращает строку в целое число", "жолды бүтін санға айналдырады") },
  { level: 2, left: "type()", right: ln("показывает тип значения", "мәннің типін көрсетеді") },
  { level: 3, left: "n % 10", right: ln("последняя цифра числа", "санның соңғы цифры") },
  { level: 3, left: "n // 10", right: ln("число без последней цифры", "соңғы цифрсыз сан") },
  { level: 3, left: "a, b = b, a", right: ln("обмен значений двух переменных", "екі айнымалының мәндерін ауыстыру") },
];

function pair(level: Level, seed: number): Pair {
  const rand = seeded(seed);
  if (rand() < 0.4) {
    const list = STATIC_PAIRS.filter((p) => p.level === level);
    const p = pick(rand, list);
    return { id: `p:py.vars:static:${STATIC_PAIRS.indexOf(p)}`, skill: SKILL, level, left: p.left, right: p.right };
  }
  if (level === 1) {
    const b = int(rand, 3, 9);
    const a = int(rand, 10, 59);
    const useMod = rand() < 0.5;
    return { id: `p:py.vars:${a}${useMod ? "m" : "d"}${b}`, skill: SKILL, level, left: `${a} ${useMod ? "%" : "//"} ${b}`, right: String(useMod ? a % b : Math.floor(a / b)) };
  }
  if (level === 2) {
    const a = int(rand, 2, 9);
    const b = int(rand, 2, 5);
    return { id: `p:py.vars:${a}p${b}`, skill: SKILL, level, left: `${a} ** ${b}`, right: String(a ** b) };
  }
  const n = int(rand, 101, 999);
  return { id: `p:py.vars:t${n}`, skill: SKILL, level, left: `${n} // 10 % 10`, right: String(Math.floor(n / 10) % 10) };
}

function short(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  if (level === 1) {
    const b = int(rand, 3, 9);
    const a = int(rand, 10, 59);
    const useMod = rand() < 0.5;
    const value = useMod ? a % b : Math.floor(a / b);
    return {
      id: `q:py.vars:${a}${useMod ? "m" : "d"}${b}`,
      skill: SKILL,
      level,
      prompt: same(`${a} ${useMod ? "%" : "//"} ${b} = ?`),
      answer: String(value),
      mode: "number",
      explanation: ln(
        useMod ? `${a} // ${b} = ${Math.floor(a / b)}, остаток ${a} − ${b * Math.floor(a / b)} = ${value}` : `${b} * ${value} = ${b * value} ≤ ${a} < ${b * (value + 1)}`,
        useMod ? `${a} // ${b} = ${Math.floor(a / b)}, қалдық ${a} − ${b * Math.floor(a / b)} = ${value}` : `${b} * ${value} = ${b * value} ≤ ${a} < ${b * (value + 1)}`,
      ),
    };
  }
  if (level === 2) {
    const a = int(rand, 3, 30);
    const b = int(rand, 2, 6);
    const c = int(rand, 2, 7);
    const t = int(rand, 0, 1);
    const expr = t === 0 ? `${a} + ${b} ** 2` : `${a} // ${b} + ${a} % ${b}`;
    const value = t === 0 ? a + b * b : Math.floor(a / b) + (a % b);
    return { id: `q:py.vars:e${t}-${a}-${b}`, skill: SKILL, level, prompt: same(`${expr} = ?`), answer: String(value), mode: "number", explanation: ln(`Порядок действий: ${expr} = ${value}.`, `Амалдар реті: ${expr} = ${value}.`) };
  }
  const n = int(rand, 101, 999);
  const value = Math.floor(n / 10) % 10;
  return {
    id: `q:py.vars:t${n}`,
    skill: SKILL,
    level,
    prompt: same(`${n} // 10 % 10 = ?`),
    answer: String(value),
    mode: "number",
    explanation: ln(`${n} // 10 = ${Math.floor(n / 10)}, потом ${Math.floor(n / 10)} % 10 = ${value}.`, `${n} // 10 = ${Math.floor(n / 10)}, содан кейін ${Math.floor(n / 10)} % 10 = ${value}.`),
  };
}

export const BANKS: SkillBank[] = [{ skill: SKILL, question, statement, pair, short }];
