import type { ChoiceStep, InputStep, L, Level, Scene } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка sheets.refs: что происходит со ссылками при копировании формулы (относительные, абсолютные,
// смешанные), диапазоны, проценты и функции ЕСЛИ / СЧЁТЕСЛИ / СУММЕСЛИ.
// Правильный ответ всегда считает код (сдвиг ссылок и значения формул). Параметры задания зашиты в id:
// g:sheets.refs:<вид>:<параметры>:<seed> — по ним ответы перепроверены независимым расчётом
// (scripts/out/data-2-refs/verify_bank.py).
// Казахские тексты — без падежных окончаний после имён ячеек и чисел: «C2 ұяшығындағы формула», «C2 → E5: ...».

const SKILL = "sheets.refs";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const lk = (ru: string, kk: string): L => ({ ru, kk });

// ---------- Модель ссылок и формул ----------

interface Ref {
  col: number;
  row: number;
  /** $ перед буквой столбца. */
  ac: boolean;
  /** $ перед номером строки. */
  ar: boolean;
}
type Tok = string | Ref;
type Formula = Tok[];

const colName = (c: number) => String.fromCharCode(65 + c);
const cellName = (col: number, row: number) => `${colName(col)}${row}`;
const refStr = (r: Ref) => `${r.ac ? "$" : ""}${colName(r.col)}${r.ar ? "$" : ""}${r.row}`;
const fStr = (f: Formula) => `=${f.map((t) => (typeof t === "string" ? t : refStr(t))).join("")}`;
const validRef = (r: Ref) => r.col >= 0 && r.col < 26 && r.row >= 1 && r.row <= 99;
const validF = (f: Formula) => f.every((t) => typeof t === "string" || validRef(t));
const refs = (f: Formula) => f.filter((t): t is Ref => typeof t !== "string");

/** Правильный сдвиг: закреплённые знаком $ части не меняются. */
const shiftRef = (r: Ref, dc: number, dr: number): Ref => ({ ...r, col: r.ac ? r.col : r.col + dc, row: r.ar ? r.row : r.row + dr });
const mapRefs = (f: Formula, fn: (r: Ref, i: number) => Ref): Formula => {
  let i = -1;
  return f.map((t) => (typeof t === "string" ? t : fn(t, ++i)));
};
const shiftF = (f: Formula, dc: number, dr: number): Formula => mapRefs(f, (r) => shiftRef(r, dc, dr));

/** Типичные ошибки при копировании (для неверных вариантов). */
type Mistake = "unchanged" | "ignore" | "invert" | "onlyCol" | "onlyRow" | "opposite" | "partial" | "transposed";

function applyMistake(f: Formula, m: Mistake, dc: number, dr: number, part: number): Formula {
  switch (m) {
    case "unchanged":
      return f;
    case "ignore":
      return mapRefs(f, (r) => ({ ...r, col: r.col + dc, row: r.row + dr }));
    case "invert":
      return mapRefs(f, (r) => ({ ...r, col: r.ac ? r.col + dc : r.col, row: r.ar ? r.row + dr : r.row }));
    case "onlyCol":
      return mapRefs(f, (r) => ({ ...r, col: r.ac ? r.col : r.col + dc }));
    case "onlyRow":
      return mapRefs(f, (r) => ({ ...r, row: r.ar ? r.row : r.row + dr }));
    case "opposite":
      return mapRefs(f, (r) => shiftRef(r, -dc, -dr));
    case "partial":
      return mapRefs(f, (r, i) => (i === part ? shiftRef(r, dc, dr) : r));
    case "transposed":
      return mapRefs(f, (r) => shiftRef(r, dr, dc));
  }
}

const WHY: Record<Mistake, L> = {
  unchanged: lk(
    "Формула осталась без изменений, а незакреплённые части ссылок (без знака $ перед ними) при копировании сдвигаются.",
    "Формула өзгеріссіз қалған, ал сілтемелердің бекітілмеген бөліктері (алдында $ белгісі жоқ) көшіргенде жылжиды.",
  ),
  ignore: lk(
    "Знаки $ не учтены: закреплённая часть ссылки при копировании не меняется.",
    "$ белгілері ескерілмеген: сілтеменің бекітілген бөлігі көшіргенде өзгермейді.",
  ),
  invert: lk(
    "Всё наоборот: сдвинуто то, что закреплено знаком $, а свободная часть осталась на месте.",
    "Керісінше болған: $ белгісімен бекітілгені жылжытылған, ал еркін бөлік орнында қалған.",
  ),
  onlyCol: lk(
    "Сдвинуты только столбцы, а формулу сдвинули и по строкам: строки тоже должны измениться.",
    "Тек бағандар жылжытылған, ал формула жолдар бойынша да жылжыған: жолдар да өзгеруі керек.",
  ),
  onlyRow: lk(
    "Сдвинуты только строки, а формулу сдвинули и по столбцам: буквы столбцов тоже должны измениться.",
    "Тек жолдар жылжытылған, ал формула бағандар бойынша да жылжыған: баған әріптері де өзгеруі керек.",
  ),
  opposite: lk(
    "Сдвиг сделан в обратную сторону: вправо буквы столбцов идут дальше по алфавиту, вниз номера строк растут.",
    "Жылжу кері бағытта жасалған: оңға баған әріптері әліпби бойынша ілгері жүреді, төмен жол нөмірлері өседі.",
  ),
  partial: lk(
    "Сдвинута только одна ссылка, а нужно сдвигать все ссылки формулы (кроме закреплённых частей).",
    "Тек бір сілтеме жылжытылған, ал формуладағы барлық сілтемені жылжыту керек (бекітілген бөліктерден басқасын).",
  ),
  transposed: lk(
    "Перепутаны столбцы и строки: сдвиг по столбцам применён к строкам, а по строкам — к столбцам.",
    "Бағандар мен жолдар шатастырылған: баған бойынша жылжу жолға, жол бойынша жылжу бағанға қолданылған.",
  ),
};

// ---------- Русские и казахские фразы ----------

function ruPl(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** «на 2 столбца вправо и на 3 строки вниз» / «2 баған оңға және 3 жол төмен». */
function shiftL(dc: number, dr: number): L {
  const ru: string[] = [];
  const kk: string[] = [];
  if (dc > 0) {
    ru.push(`на ${dc} ${ruPl(dc, "столбец", "столбца", "столбцов")} вправо`);
    kk.push(`${dc} баған оңға`);
  }
  if (dr > 0) {
    ru.push(`на ${dr} ${ruPl(dr, "строку", "строки", "строк")} вниз`);
    kk.push(`${dr} жол төмен`);
  }
  return lk(ru.join(" и "), kk.join(" және "));
}

const copyPrompt = (f: string, a: string, b: string): L =>
  lk(
    `В ячейке ${a} записана формула \`${f}\`. Её скопировали в ячейку ${b}. Какая формула окажется в ${b}?`,
    `${a} ұяшығында \`${f}\` формуласы жазылған. Оны ${b} ұяшығына көшірді. ${b} ұяшығында қандай формула болады?`,
  );

const HINT_SHIFT: L = lk(
  "Сначала найди сдвиг: на сколько столбцов и строк формулу переместили. Потом сдвинь на столько же каждую ссылку, не трогая то, что закреплено знаком $.",
  "Алдымен жылжуды тап: формула қанша бағанға және қанша жолға жылжыған. Содан кейін әр сілтемені сонша жылжыт, $ белгісімен бекітілгенге тиіспе.",
);
const HINT_VALUE: L = lk(
  "Сначала запиши формулу для целевой ячейки (сдвинь ссылки с учётом $), потом подставь числа из таблицы.",
  "Алдымен мақсатты ұяшықтың формуласын жаз ($ белгілерін ескеріп сілтемелерді жылжыт), содан кейін кестедегі сандарды қой.",
);

// ---------- Общие помощники ----------

interface Cand {
  text: string | L;
  why: L | null;
}
const keyOf = (t: string | L) => (typeof t === "string" ? t : t.ru);

/** choice: правильный + 3 уникальных неверных, перемешаны. */
function choice(rand: Rand, c: { id: string; level: Level; prompt: L; hint: L; explanation: L; correct: string | L; wrongs: Cand[]; reveal?: Scene; scene?: Scene }): ChoiceStep {
  const seen = new Set<string>([keyOf(c.correct)]);
  const wrongs: Cand[] = [];
  for (const w of shuffle(c.wrongs, rand)) {
    if (wrongs.length >= 3) break;
    if (!seen.has(keyOf(w.text))) {
      seen.add(keyOf(w.text));
      wrongs.push(w);
    }
  }
  const all = shuffle<Cand>([{ text: c.correct, why: null }, ...wrongs], rand);
  return {
    id: c.id,
    type: "choice",
    skill: SKILL,
    level: c.level,
    prompt: c.prompt,
    hint: c.hint,
    scene: c.scene,
    reveal: c.reveal,
    options: all.map((o) => o.text),
    correct: all.findIndex((o) => o.why === null),
    whyWrong: all.map((o) => o.why),
    explanation: c.explanation,
  };
}

function numInput(id: string, level: Level, prompt: L, hint: L, explanation: L, answer: number, scene?: Scene, reveal?: Scene, suffix?: string): InputStep {
  return { id, type: "input", skill: SKILL, level, prompt, hint, scene, reveal, answers: [String(answer)], mode: "number", suffix, explanation };
}

/** Безопасный кусок id: без «:» (id режется по двоеточиям). */
const idPart = (s: string) => s.replace(/[:;"]/g, "_").replace(/\s+/g, "");

const sheetScene = (rows: (string | L)[][], highlightCells?: [number, number][]): Scene => ({ kind: "table", sheet: true, mono: true, rows, highlightCells });

// ---------- Генератор формул ----------

interface Plan {
  origin: [number, number];
  target: [number, number];
  dc: number;
  dr: number;
  f: Formula;
  g: Formula;
}

type Flags = readonly [boolean, boolean];
const FREE: Flags = [false, false];

/** Формула из двух ссылок с заданными знаками $; ссылки лежат левее/выше места формулы, чтобы выглядеть естественно. */
function makePlan(rand: Rand, opts: { flags: [Flags, Flags]; ops: readonly string[]; moves: readonly [number, number][]; row?: [number, number]; col?: [number, number] }): Plan {
  for (let attempt = 0; attempt < 200; attempt++) {
    const oc = int(rand, opts.col?.[0] ?? 2, opts.col?.[1] ?? 4);
    const or = int(rand, opts.row?.[0] ?? 2, opts.row?.[1] ?? 6);
    const [mdc, mdr] = pick(rand, opts.moves);
    const dc = mdc === -1 ? int(rand, 1, 3) : mdc;
    const dr = mdr === -1 ? int(rand, 1, 4) : mdr;
    if (dc === 0 && dr === 0) continue;
    const mk = (flags: Flags): Ref => ({
      col: flags[0] ? int(rand, 0, 1) : int(rand, 0, Math.max(0, oc - 1)),
      row: flags[1] ? int(rand, 1, 2) : or,
      ac: flags[0],
      ar: flags[1],
    });
    const f: Formula = [mk(opts.flags[0]), pick(rand, opts.ops), mk(opts.flags[1])];
    const g = shiftF(f, dc, dr);
    if (!validF(f) || !validF(g)) continue;
    // Две одинаковые ссылки — скучно и неоднозначно.
    const [a, b] = refs(f);
    if (refStr(a) === refStr(b)) continue;
    return { origin: [oc, or], target: [oc + dc, or + dr], dc, dr, f, g };
  }
  throw new Error("makePlan: не удалось подобрать формулу");
}

/** Неверные варианты формулы по списку ошибок (отсев повторов и некорректных ссылок). */
function mistakeCands(plan: Plan, kinds: Mistake[]): Cand[] {
  const out: Cand[] = [];
  const correct = fStr(plan.g);
  kinds.forEach((m, i) => {
    if (m === "onlyCol" && plan.dr === 0) return;
    if (m === "onlyRow" && plan.dc === 0) return;
    const w = applyMistake(plan.f, m, plan.dc, plan.dr, i % 2);
    if (!validF(w)) return;
    const text = fStr(w);
    if (text === correct || out.some((o) => o.text === text)) return;
    out.push({ text, why: WHY[m] });
  });
  return out;
}

const fmtMove = (p: Plan) => ({ a: cellName(...p.origin), b: cellName(...p.target) });

// ---------- Виды заданий ----------

function relFormula(rand: Rand, level: Level, seed: number, move: "down" | "right" | "diag") {
  const moves: [number, number][] = move === "down" ? [[0, -1]] : move === "right" ? [[-1, 0]] : [[-1, -1]];
  const plan = makePlan(rand, { flags: [FREE, FREE], ops: ["+", "-", "*"], moves });
  const { a, b } = fmtMove(plan);
  const f = fStr(plan.f);
  const g = fStr(plan.g);
  const kinds: Mistake[] = ["unchanged", "onlyRow", "onlyCol", "opposite", "partial", "transposed"];
  return choice(rand, {
    id: `g:${SKILL}:rel-${move}:${idPart(`${f}-${a}-${b}`)}:${seed}`,
    level,
    prompt: copyPrompt(f, a, b),
    hint: HINT_SHIFT,
    explanation: lk(
      `Из ${a} в ${b}: ${shiftL(plan.dc, plan.dr).ru}. Каждая ссылка сдвигается так же. Получается \`${g}\`.`,
      `${a} → ${b}: ${shiftL(plan.dc, plan.dr).kk}. Әр сілтеме де солай жылжиды. Нәтижесі: \`${g}\`.`,
    ),
    correct: g,
    wrongs: mistakeCands(plan, kinds),
  });
}

function absKeep(rand: Rand, level: Level, seed: number) {
  const dc = pick(rand, [0, 0, 1, 2]);
  const dr = dc === 0 ? int(rand, 1, 4) : pick(rand, [0, 1, 2]);
  const plan = makePlan(rand, { flags: [FREE, [true, true]], ops: ["*", "+"], moves: [[dc, dr]], col: [2, 3], row: [2, 4] });
  const { a, b } = fmtMove(plan);
  const f = fStr(plan.f);
  const g = fStr(plan.g);
  const abs = plan.f[2] as Ref;
  const absShifted = mapRefs(plan.f, (r, i) => (i === 1 ? { ...r, col: r.col + plan.dc, row: r.row + plan.dr } : shiftRef(r, plan.dc, plan.dr)));
  const absLost = mapRefs(plan.f, (r, i) => (i === 1 ? { ...r, ac: false, ar: false, col: r.col + plan.dc, row: r.row + plan.dr } : shiftRef(r, plan.dc, plan.dr)));
  const wrongs: Cand[] = [
    { text: f, why: WHY.unchanged },
    {
      text: fStr(absShifted),
      why: lk(`Сдвинулась и \`${refStr(abs)}\`, но абсолютная ссылка при копировании не меняется.`, `\`${refStr(abs)}\` да жылжыған, бірақ абсолютті сілтеме көшіргенде өзгермейді.`),
    },
    {
      text: fStr(absLost),
      why: lk(`У ссылки пропали знаки $ и она сдвинулась. Скопированная формула сохраняет \`${refStr(abs)}\` как есть.`, `Сілтемеден $ белгілері түсіп қалып, ол жылжыған. Көшірілген формула \`${refStr(abs)}\` сілтемесін сол күйінде сақтайды.`),
    },
    ...mistakeCands(plan, ["opposite", "transposed"]),
  ].filter((w) => w.text !== g && validRefText(keyOf(w.text)));
  return choice(rand, {
    id: `g:${SKILL}:abs-keep:${idPart(`${f}-${a}-${b}`)}:${seed}`,
    level,
    prompt: copyPrompt(f, a, b),
    hint: lk(
      "Какая ссылка «прибита» знаками $, а какая нет? Сдвинь на столько же, на сколько сдвинули формулу, только свободную.",
      "Қай сілтеме $ белгілерімен «шегеленген», қайсысы жоқ? Тек еркін сілтемені формула қанша жылжыса, сонша жылжыт.",
    ),
    explanation: lk(
      `Из ${a} в ${b}: ${shiftL(plan.dc, plan.dr).ru}. Относительная ссылка сдвигается, а \`${refStr(abs)}\` закреплена и не меняется. Получается \`${g}\`.`,
      `${a} → ${b}: ${shiftL(plan.dc, plan.dr).kk}. Салыстырмалы сілтеме жылжиды, ал \`${refStr(abs)}\` бекітілген және өзгермейді. Нәтижесі: \`${g}\`.`,
    ),
    correct: g,
    wrongs,
  });
}

/** Проверка «текст формулы не содержит ссылок вне таблицы» — формулы строятся валидными, здесь защита от строк с row < 1. */
const validRefText = (s: string) => !/[A-Z]\$?0\b|[A-Z]\$?-/.test(s);

function singleRef(rand: Rand, level: Level, seed: number) {
  const kind = level === 1 ? pick(rand, ["rel", "abs"] as const) : pick(rand, ["col", "row"] as const);
  for (let attempt = 0; attempt < 100; attempt++) {
    const oc = int(rand, 2, 4);
    const or = int(rand, 2, 6);
    const dc = int(rand, 1, 3);
    const dr = int(rand, 1, 4);
    const r: Ref = {
      col: int(rand, 0, Math.max(0, oc - 1)),
      row: int(rand, 1, 6),
      ac: kind === "abs" || kind === "col",
      ar: kind === "abs" || kind === "row",
    };
    const g = shiftRef(r, dc, dr);
    if (!validRef(g)) continue;
    const a = cellName(oc, or);
    const b = cellName(oc + dc, or + dr);
    const f = refStr(r);
    const correct = refStr(g);
    const wrongs: Cand[] = [];
    const add = (ref: Ref, why: L) => {
      const t = refStr(ref);
      if (validRef(ref) && t !== correct && !wrongs.some((w) => w.text === t)) wrongs.push({ text: t, why });
    };
    add(r, lk("Ссылка осталась без изменений, а её незакреплённые части (без знака $ перед ними) при копировании сдвигаются.", "Сілтеме өзгеріссіз қалған, ал оның бекітілмеген бөліктері (алдында $ белгісі жоқ) көшіргенде жылжиды."));
    add({ ...r, col: r.col + dc, row: r.row + dr }, WHY.ignore);
    add({ ...r, col: r.ac ? r.col + dc : r.col, row: r.ar ? r.row + dr : r.row }, WHY.invert);
    add({ ...r, col: r.ac ? r.col : r.col + dc }, WHY.onlyCol);
    add({ ...r, row: r.ar ? r.row : r.row + dr }, WHY.onlyRow);
    add(shiftRef(r, -dc, -dr), WHY.opposite);
    if (kind === "abs") {
      // Абсолютная ссылка при копировании не меняется — любые изменения (в том числе потеря $) неверны.
      const WHY_ABS = lk(
        "Абсолютная ссылка закреплена знаками $ и при копировании не меняется, а здесь она изменена.",
        "Абсолютті сілтеме $ белгілерімен бекітілген және көшіргенде өзгермейді, ал мұнда ол өзгертілген.",
      );
      add({ ...r, ac: false, ar: false, col: r.col + dc, row: r.row + dr }, WHY_ABS);
      add({ ...r, ar: false, row: r.row + dr }, WHY_ABS);
      add({ ...r, ac: false, col: r.col + dc }, WHY_ABS);
    }
    return choice(rand, {
      id: `g:${SKILL}:ref-${kind}:${idPart(`${f}-${a}-${b}`)}:${seed}`,
      level,
      prompt: lk(
        `В формуле, записанной в ячейке ${a}, есть ссылка \`${f}\`. Формулу скопировали в ячейку ${b}. Какой станет эта ссылка?`,
        `${a} ұяшығында жазылған формулада \`${f}\` сілтемесі бар. Формуланы ${b} ұяшығына көшірді. Бұл сілтеме қандай болады?`,
      ),
      hint: lk(
        "Найди сдвиг (столбцы и строки) и подумай: что в ссылке закреплено знаком $, а что нет?",
        "Жылжуды тап (бағандар мен жолдар) және ойлан: сілтемеде $ белгісімен не бекітілген, не жоқ?",
      ),
      explanation: lk(
        `Из ${a} в ${b}: ${shiftL(dc, dr).ru}. Ссылка \`${f}\` ${kind === "abs" ? "абсолютная — не меняется" : kind === "rel" ? "относительная — сдвигается целиком" : kind === "col" ? "с закреплённым столбцом — меняется только строка" : "с закреплённой строкой — меняется только столбец"}. Получается \`${correct}\`.`,
        `${a} → ${b}: ${shiftL(dc, dr).kk}. \`${f}\` сілтемесі ${kind === "abs" ? "абсолютті — өзгермейді" : kind === "rel" ? "салыстырмалы — түгелдей жылжиды" : kind === "col" ? "бағаны бекітілген — тек жолы өзгереді" : "жолы бекітілген — тек бағаны өзгереді"}. Нәтижесі: \`${correct}\`.`,
      ),
      correct,
      wrongs,
    });
  }
  throw new Error("singleRef: не удалось подобрать ссылку");
}

const MIXED_FLAGS: Flags[] = [
  [true, false],
  [false, true],
  [true, true],
  [false, false],
];

function mixedCopy(rand: Rand, level: Level, seed: number) {
  const moves: [number, number][] = level === 2 ? [[1, 1], [1, -1], [-1, 1], [0, -1], [-1, 0]] : [[-1, -1], [1, -1], [-1, 1]];
  const kinds: Mistake[] = ["unchanged", "ignore", "invert", "onlyCol", "onlyRow", "partial", "partial"];
  for (let attempt = 0; attempt < 100; attempt++) {
    const f1 = pick(rand, MIXED_FLAGS.slice(0, 3));
    const f2 = pick(rand, [[true, false], [false, true], [false, false]] as Flags[]);
    const plan = makePlan(rand, { flags: [f1, f2], ops: ["+", "*", "-"], moves });
    const wrongs = mistakeCands(plan, kinds);
    // Формула должна измениться, и неверных вариантов должно хватать на четыре варианта ответа.
    if (fStr(plan.f) === fStr(plan.g) || wrongs.length < 3) continue;
    const { a, b } = fmtMove(plan);
    const f = fStr(plan.f);
    const g = fStr(plan.g);
    return choice(rand, {
      id: `g:${SKILL}:mixed-copy:${idPart(`${f}-${a}-${b}`)}:${seed}`,
      level,
      prompt: copyPrompt(f, a, b),
      hint: HINT_SHIFT,
      explanation: lk(
        `Из ${a} в ${b}: ${shiftL(plan.dc, plan.dr).ru}. Знак $ закрепляет то, что стоит сразу после него (столбец или строку), остальное сдвигается. Получается \`${g}\`.`,
        `${a} → ${b}: ${shiftL(plan.dc, plan.dr).kk}. $ белгісі өзінен кейін тұрғанды (бағанды немесе жолды) бекітеді, қалғаны жылжиды. Нәтижесі: \`${g}\`.`,
      ),
      correct: g,
      wrongs,
    });
  }
  throw new Error("mixedCopy: не удалось подобрать формулу");
}

// ---------- Значение формулы в таблице чисел ----------

const evalF = (f: Formula, grid: number[][]): number => {
  // Формулы значения состоят из двух ссылок и одного знака + или *.
  const [x, op, y] = f as [Ref, string, Ref];
  const a = grid[x.row - 1][x.col];
  const b = grid[y.row - 1][y.col];
  return op === "*" ? a * b : a + b;
};

function valueCopy(rand: Rand, level: Level, seed: number) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const grid = Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => int(rand, 1, 9)));
    const oc = 3;
    const or = 2;
    const dc = level === 2 ? pick(rand, [0, 0, 1]) : pick(rand, [0, 1, 1]);
    const dr = int(rand, 1, 3);
    const flagSet: Flags[] = level === 2 ? [FREE, [true, true], [false, true]] : MIXED_FLAGS.slice(0, 3);
    const mk = (flags: Flags): Ref => ({ col: int(rand, 0, 2), row: int(rand, 1, 5), ac: flags[0], ar: flags[1] });
    const f: Formula = [mk(pick(rand, flagSet)), pick(rand, ["+", "*"]), mk(pick(rand, flagSet))];
    const g = shiftF(f, dc, dr);
    const inside = (fm: Formula) => refs(fm).every((r) => r.col >= 0 && r.col <= 2 && r.row >= 1 && r.row <= 5);
    if (!inside(f) || !inside(g)) continue;
    const [x, , y] = f as [Ref, string, Ref];
    if (refStr(x) === refStr(y)) continue;
    const a = cellName(oc, or);
    const b = cellName(oc + dc, or + dr);
    const answer = evalF(g, grid);
    const fText = fStr(f);
    const gText = fStr(g);
    const rows: (string | L)[][] = grid.map((r, i) => [...r.map(String), i + 1 === or ? fText : "", ""]);
    const scene = sheetScene(rows, [[or - 1, oc], [or + dr - 1, oc + dc]]);
    // В id — формула, сдвиг и числа таблицы: по ним ответ можно пересчитать независимо.
    const id = `g:${SKILL}:value-${level === 2 ? "abs" : "mixed"}:${idPart(`${fText}-${a}-${b}`)}:${idPart(grid.map((r) => r.join("")).join("_"))}:${seed}`;
    const revealRows = rows.map((r) => [...r]);
    revealRows[or + dr - 1][oc + dc] = gText;
    const reveal = sheetScene(revealRows, [[or + dr - 1, oc + dc]]);
    return numInput(
      id,
      level,
      lk(
        `В ячейке ${a} записана формула \`${fText}\`. Её скопировали в ячейку ${b}. Чему равно значение в ${b}?`,
        `${a} ұяшығында \`${fText}\` формуласы жазылған. Оны ${b} ұяшығына көшірді. ${b} ұяшығындағы мән неге тең?`,
      ),
      HINT_VALUE,
      lk(
        `Из ${a} в ${b}: ${shiftL(dc, dr).ru}. В ${b} получается \`${gText}\`. Подставляем числа из таблицы: результат ${answer}.`,
        `${a} → ${b}: ${shiftL(dc, dr).kk}. ${b} ұяшығында \`${gText}\` шығады. Кестедегі сандарды қоямыз: нәтиже ${answer}.`,
      ),
      answer,
      scene,
      reveal,
    );
  }
  throw new Error("valueCopy: не удалось подобрать формулу");
}

// ---------- Проценты ----------

const GOODS: L[] = [lk("Тетрадь", "Дәптер"), lk("Ручка", "Қалам"), lk("Линейка", "Сызғыш"), lk("Пенал", "Қалам сауыт"), lk("Альбом", "Альбом"), lk("Папка", "Папка")];

function percentCase(rand: Rand) {
  const p = pick(rand, [5, 8, 10, 12, 15, 20, 25]);
  const markup = rand() < 0.65;
  const target = int(rand, 3, 5);
  const prices = Array.from({ length: target - 1 }, () => int(rand, 2, 30) * 100);
  const f = markup ? `=D2*${p}/100+D2` : `=D2-D2*${p}/100`;
  const g = f.replace(/D2/g, `D${target}`);
  const price = prices[target - 2];
  const answer = markup ? price + (price * p) / 100 : price - (price * p) / 100;
  const rows: (string | L)[][] = [
    ["№", lk("Товар", "Тауар"), lk("Кол-во", "Саны"), lk("Цена, ₸", "Бағасы, ₸"), markup ? lk("С наценкой", "Үстемесімен") : lk("Со скидкой", "Жеңілдікпен")],
    ...prices.map((pr, i): (string | L)[] => [String(i + 1), GOODS[i], String(int(rand, 1, 9)), String(pr), i === 0 ? f : ""]),
  ];
  return { p, markup, target, price, f, g, answer, rows };
}

function percent(rand: Rand, level: Level, seed: number) {
  const c = percentCase(rand);
  const e = `E${c.target}`;
  const word = c.markup ? lk("наценкой", "үстемесі бар") : lk("скидкой", "жеңілдігі бар");
  return numInput(
    `g:${SKILL}:percent:${idPart(`${c.f}-${c.target}-${c.price}`)}:${c.markup ? "up" : "down"}:${seed}`,
    level,
    lk(
      `В E2 записана формула \`${c.f}\` (цена с ${word.ru} ${c.p}%). Её скопировали вниз, в ${e}. Чему равно значение в ${e}?`,
      `E2 ұяшығында \`${c.f}\` формуласы жазылған (${c.p}% ${word.kk} баға). Оны төмен, ${e} ұяшығына көшірді. ${e} ұяшығындағы мән неге тең?`,
    ),
    lk(
      "Сначала запиши формулу для нужной строки: какая ячейка цены в ней окажется? Потом найди процент от этой цены и прибавь его или вычти.",
      "Алдымен керекті жол үшін формуланы жаз: онда баға ұяшығы қайсысы болады? Содан кейін сол бағаның пайызын тауып, оны қос немесе шегер.",
    ),
    lk(
      `В ${e} формула сдвинется на ${c.target - 2} ${ruPl(c.target - 2, "строку", "строки", "строк")} вниз: \`${c.g}\`. D${c.target} = ${c.price}, ${c.price} · ${c.p} / 100 = ${(c.price * c.p) / 100}, ${c.markup ? `${c.price} + ${(c.price * c.p) / 100}` : `${c.price} − ${(c.price * c.p) / 100}`} = ${c.answer}.`,
      `${e} ұяшығында формула ${c.target - 2} жол төмен жылжиды: \`${c.g}\`. D${c.target} = ${c.price}, ${c.price} · ${c.p} / 100 = ${(c.price * c.p) / 100}, ${c.markup ? `${c.price} + ${(c.price * c.p) / 100}` : `${c.price} − ${(c.price * c.p) / 100}`} = ${c.answer}.`,
    ),
    c.answer,
    sheetScene(c.rows, [[c.target - 1, 3], [c.target - 1, 4]]),
    undefined,
    "₸",
  );
}

// ---------- Диапазоны (СУММ) ----------

function sumRange(rand: Rand, level: Level, seed: number) {
  const absolute = rand() < 0.3;
  const vertical = rand() < 0.7;
  const oc = int(rand, 0, 3);
  const len = int(rand, 2, 4);
  const start = int(rand, 1, 3);
  const end = start + len - 1;
  const oRow = end + 1;
  const shiftRight = vertical ? int(rand, 1, 3) : 0;
  const shiftDown = vertical ? 0 : int(rand, 1, 3);
  // Вертикальная сумма: столбец c, строки start..end, формула под ней; копируем вправо.
  // Горизонтальная сумма: строка r, столбцы start-1..end-1, формула справа; копируем вниз.
  const range = (c1: number, r1: number, c2: number, r2: number, abs: boolean) =>
    abs ? `$${colName(c1)}$${r1}:$${colName(c2)}$${r2}` : `${colName(c1)}${r1}:${colName(c2)}${r2}`;
  let fRange: string;
  let gRange: string;
  let a: string;
  let b: string;
  const E_END = lk("Сдвинулся только конец диапазона. Обе границы диапазона сдвигаются одинаково.", "Диапазонның тек соңы жылжыған. Диапазонның екі шекарасы да бірдей жылжиды.");
  const E_SHORT = lk("Диапазон стал короче: его длина при копировании не меняется.", "Диапазон қысқарған: көшіргенде оның ұзындығы өзгермейді.");
  const E_ABS = lk("Диапазон закреплён знаками $, поэтому при копировании он не сдвигается.", "Диапазон $ белгілерімен бекітілген, сондықтан көшіргенде жылжымайды.");
  const E_NOABS = lk("Знаков $ в исходной формуле нет, значит, диапазон не закреплён и сдвигается.", "Бастапқы формулада $ белгілері жоқ, демек диапазон бекітілмеген және жылжиды.");
  let wrongRanges: { text: string; why: L }[];
  if (vertical) {
    fRange = range(oc, start, oc, end, absolute);
    const nc = oc + shiftRight;
    gRange = absolute ? fRange : range(nc, start, nc, end, false);
    a = cellName(oc, oRow);
    b = cellName(nc, oRow);
    wrongRanges = [
      absolute ? { text: range(nc, start, nc, end, false), why: E_ABS } : { text: fRange, why: WHY.unchanged },
      { text: range(oc, start, nc, end, false), why: E_END },
      { text: range(nc, start + 1, nc, end + 1, false), why: lk("Строки сдвинуты, хотя копировали по горизонтали: строка при этом остаётся прежней.", "Көлденең көшірсе де жолдар жылжытылған: бұл кезде жол бұрынғы күйінде қалады.") },
      ...(len >= 3 ? [{ text: range(nc, start, nc, end - 1, false), why: E_SHORT }] : []),
      absolute ? { text: range(oc, start, nc, end, true), why: E_END } : { text: range(oc, start, oc, end, true), why: E_NOABS },
    ];
  } else {
    // Горизонтальная сумма: числа в строке row, формула справа от них; копируем вниз.
    const row = int(rand, 1, 4);
    const c1 = oc;
    const c2 = oc + len - 1;
    const fc = c2 + 1;
    fRange = range(c1, row, c2, row, absolute);
    const nr = row + shiftDown;
    gRange = absolute ? fRange : range(c1, nr, c2, nr, false);
    a = cellName(fc, row);
    b = cellName(fc, nr);
    wrongRanges = [
      absolute ? { text: range(c1, nr, c2, nr, false), why: E_ABS } : { text: fRange, why: WHY.unchanged },
      { text: range(c1, row, c2, nr, false), why: E_END },
      { text: range(c1 + 1, nr, c2 + 1, nr, false), why: lk("Столбцы сдвинуты, хотя копировали вниз: столбцы при этом остаются прежними.", "Төмен көшірсе де бағандар жылжытылған: бұл кезде бағандар бұрынғы күйінде қалады.") },
      ...(len >= 3 ? [{ text: range(c1, nr, c2 - 1, nr, false), why: E_SHORT }] : []),
      absolute ? { text: range(c1, row, c2, nr, true), why: E_END } : { text: range(c1, row, c2, row, true), why: E_NOABS },
    ];
  }
  // Закреплённый диапазон не меняется вовсе: любой сдвиг — та же ошибка «не учтены знаки $».
  if (absolute) {
    const E_ABS_END = lk(
      "Конец диапазона закреплён знаками $ так же, как начало: при копировании весь диапазон остаётся на месте.",
      "Диапазонның соңы да басы сияқты $ белгілерімен бекітілген: көшіргенде бүкіл диапазон орнында қалады.",
    );
    wrongRanges = wrongRanges.map((w) => ({ text: w.text, why: w.text.includes("$") ? E_ABS_END : E_ABS }));
  }
  const fx = (range_: string): L => lk(`=СУММ(${range_})`, `=SUM(${range_})`);
  const f = fx(fRange);
  const g = fx(gRange);
  const wrongs = wrongRanges.filter((w) => w.text !== gRange).map((w) => ({ text: fx(w.text), why: w.why }));
  return choice(rand, {
    id: `g:${SKILL}:sum-range:${idPart(`${fRange}-${a}-${b}`)}:${seed}`,
    level,
    prompt: lk(
      `В ячейке ${a} записана формула \`${f.ru}\`. Её скопировали в ячейку ${b}. Какая формула окажется в ${b}?`,
      `${a} ұяшығында \`${f.kk}\` формуласы жазылған. Оны ${b} ұяшығына көшірді. ${b} ұяшығында қандай формула болады?`,
    ),
    hint: lk(
      "У диапазона две границы. Сдвинь каждую границу на столько же, на сколько сдвинули формулу, но посмотри, есть ли в записи знаки $.",
      "Диапазонның екі шекарасы бар. Әр шекараны формула қанша жылжыса, сонша жылжыт, бірақ жазбада $ белгілері бар-жоғына қара.",
    ),
    explanation: lk(
      `Из ${a} в ${b}: ${shiftL(vertical ? shiftRight : 0, vertical ? 0 : shiftDown).ru}. ${absolute ? "Диапазон закреплён знаками $, поэтому не меняется" : "Обе границы диапазона сдвигаются одинаково"}: получается \`${g.ru}\`.`,
      `${a} → ${b}: ${shiftL(vertical ? shiftRight : 0, vertical ? 0 : shiftDown).kk}. ${absolute ? "Диапазон $ белгілерімен бекітілген, сондықтан өзгермейді" : "Диапазонның екі шекарасы да бірдей жылжиды"}: нәтижесі \`${g.kk}\`.`,
    ),
    correct: g,
    wrongs,
  });
}

// ---------- ЕСЛИ ----------

function ifCase(rand: Rand, level: Level, seed: number) {
  const op = pick(rand, [">=", ">", "<", "<="] as const);
  const t = int(rand, 3, 17) * 5;
  const score = rand() < 0.5 ? t : t + pick(rand, [-5, 5, -10, 10]);
  const holds = op === ">=" ? score >= t : op === ">" ? score > t : op === "<" ? score < t : score <= t;
  const yes = lk("да", "иә");
  const no = lk("нет", "жоқ");
  const row = int(rand, 2, 6);
  const cellB = `B${row}`;
  const cellC = `C${row}`;
  const fRu = `=ЕСЛИ(${cellB}${op}${t};"да";"нет")`;
  const fKk = `=IF(${cellB}${op}${t};"иә";"жоқ")`;
  const answer = holds ? yes : no;
  const other = holds ? no : yes;
  const explain = (v: boolean) => (v ? "верно" : "неверно");
  return choice(rand, {
    id: `g:${SKILL}:if:${idPart(`${op}${t}`)}-${score}:${row}:${seed}`,
    level,
    prompt: lk(
      `В ячейке ${cellB} записано число ${score}. Что отобразится в ячейке ${cellC} с формулой \`${fRu}\`?`,
      `${cellB} ұяшығында ${score} саны жазылған. \`${fKk}\` формуласы бар ${cellC} ұяшығында не көрінеді?`,
    ),
    hint: lk(
      "Сначала проверь условие: верно ли оно для этого числа? Если верно — берётся второй аргумент, если нет — третий.",
      "Алдымен шартты тексер: ол осы сан үшін ақиқат па? Ақиқат болса — екінші аргумент алынады, болмаса — үшінші.",
    ),
    explanation: lk(
      `Проверяем условие: ${score} ${op} ${t} — ${explain(holds)}. Значит, выводится «${answer.ru}».`,
      `Шартты тексереміз: ${score} ${op} ${t} — ${holds ? "ақиқат" : "жалған"}. Демек, «${answer.kk}» шығады.`,
    ),
    correct: answer,
    wrongs: [
      {
        text: other,
        why: lk(
          `Условие ${score} ${op} ${t} ${holds ? "верно" : "неверно"}${score === t && (op === ">" || op === "<") ? "; знак строгий, равные числа не подходят" : ""}, поэтому выводится другое значение.`,
          `${score} ${op} ${t} шарты ${holds ? "ақиқат" : "жалған"}${score === t && (op === ">" || op === "<") ? "; белгі қатаң, тең сандар сәйкес келмейді" : ""}, сондықтан басқа мән шығады.`,
        ),
      },
      { text: String(score), why: lk("Функция выводит один из двух текстов из формулы, а не число из ячейки.", "Функция формуладағы екі мәтіннің бірін шығарады, ұяшықтағы санды емес.") },
      { text: lk("ошибка", "қате"), why: lk("Формула записана верно: ошибки не будет.", "Формула дұрыс жазылған: қате болмайды.") },
    ],
  });
}

// ---------- Обратная задача ----------

function reverse(rand: Rand, level: Level, seed: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const f1 = pick(rand, MIXED_FLAGS);
    const f2 = pick(rand, MIXED_FLAGS);
    const plan = makePlan(rand, { flags: [f1, f2], ops: ["+", "*", "-"], moves: [[-1, -1]], row: [3, 7], col: [2, 4] });
    const f = fStr(plan.f);
    const g = fStr(plan.g);
    if (f === g) continue;
    // Ошибки обратного хода: формула не «развёрнута», развёрнута без учёта $, развёрнута в ту же сторону.
    const undoIgnore = mapRefs(plan.g, (r) => ({ ...r, col: r.col - plan.dc, row: r.row - plan.dr }));
    const forward = shiftF(plan.g, plan.dc, plan.dr);
    const undoCol = mapRefs(plan.g, (r) => ({ ...r, col: r.ac ? r.col : r.col - plan.dc }));
    const undoRow = mapRefs(plan.g, (r) => ({ ...r, row: r.ar ? r.row : r.row - plan.dr }));
    const raw: Cand[] = [
      { text: g, why: lk("Это формула из ячейки, куда копировали. Нужно вернуться назад на тот же сдвиг.", "Бұл көшірілген ұяшықтағы формула. Сол жылжуға кері қайту керек.") },
      { text: fStr(undoIgnore), why: lk("Знаки $ не учтены: закреплённая часть при копировании не менялась, значит, назад её двигать не нужно.", "$ белгілері ескерілмеген: бекітілген бөлік көшіргенде өзгермеген, демек, оны кері жылжыту керек емес.") },
      { text: fStr(forward), why: lk("Сдвиг сделан в ту же сторону, а нужно вернуться назад: из ячейки назначения — в исходную.", "Жылжу сол бағытта жасалған, ал артқа қайту керек: көшірілген ұяшықтан бастапқысына.") },
      { text: fStr(undoCol), why: lk("Назад сдвинуты только столбцы, а строки тоже менялись при копировании.", "Тек бағандар артқа жылжытылған, ал көшіргенде жолдар да өзгерген.") },
      { text: fStr(undoRow), why: lk("Назад сдвинуты только строки, а столбцы тоже менялись при копировании.", "Тек жолдар артқа жылжытылған, ал көшіргенде бағандар да өзгерген.") },
    ];
    const wrongs = raw.filter((c, i) => validF(parseBack(keyOf(c.text))) && c.text !== f && raw.findIndex((x) => x.text === c.text) === i);
    if (wrongs.length < 3) continue;
    const { a, b } = fmtMove(plan);
    return choice(rand, {
      id: `g:${SKILL}:reverse:${idPart(`${g}-${a}-${b}`)}:${seed}`,
      level,
      prompt: lk(
        `Формулу из ячейки ${a} скопировали в ячейку ${b}. В ${b} оказалась формула \`${g}\`. Какая формула была записана в ${a}?`,
        `${a} ұяшығындағы формуланы ${b} ұяшығына көшірді. ${b} ұяшығында \`${g}\` формуласы шықты. ${a} ұяшығында қандай формула жазылған болатын?`,
      ),
      hint: lk(
        "Иди обратно: формулу переместили вправо и вниз, значит, нужно вернуться влево и вверх — но только в тех частях ссылок, где нет знака $.",
        "Кері жүр: формуланы оңға және төмен жылжытқан, демек солға және жоғары қайту керек — бірақ сілтемелердің тек $ белгісі жоқ бөліктерінде.",
      ),
      explanation: lk(
        `Из ${a} в ${b}: ${shiftL(plan.dc, plan.dr).ru}. Идём обратно: у каждой ссылки возвращаем назад только то, что не закреплено знаком $. Было \`${f}\`.`,
        `${a} → ${b}: ${shiftL(plan.dc, plan.dr).kk}. Кері жүреміз: әр сілтемеде тек $ белгісімен бекітілмегенін артқа қайтарамыз. Бастапқы формула: \`${f}\`.`,
      ),
      correct: f,
      wrongs,
    });
  }
  throw new Error("reverse: не удалось подобрать формулу");
}

/** Разбор текста формулы обратно в ссылки — чтобы проверить, что неверные варианты не выходят за границы таблицы. */
function parseBack(text: string): Formula {
  const out: Formula = [];
  const re = /(\$?)([A-Z])(\$?)(-?\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ ac: !!m[1], col: m[2].charCodeAt(0) - 65, ar: !!m[3], row: Number(m[4]) });
  return out;
}

// ---------- СЧЁТЕСЛИ и СУММЕСЛИ ----------

const STUDENTS = ["Алия", "Данияр", "Мадина", "Ерлан", "Айгерим", "Бекзат"];

function countIf(rand: Rand, level: Level, seed: number) {
  const scores = Array.from({ length: 6 }, () => int(rand, 4, 19) * 5);
  const op = pick(rand, [">=", ">", "<", "<="] as const);
  const t = rand() < 0.6 ? pick(rand, scores) : int(rand, 6, 17) * 5;
  const test = (s: number) => (op === ">=" ? s >= t : op === ">" ? s > t : op === "<" ? s < t : s <= t);
  const count = scores.filter(test).length;
  const hit = scores.map((s, i) => (test(s) ? i + 1 : -1)).filter((i) => i >= 0);
  const rows: (string | L)[][] = [[lk("Имя", "Аты"), lk("Балл", "Балл")], ...scores.map((s, i): (string | L)[] => [STUDENTS[i], String(s)])];
  const scene: Scene = { kind: "table", sheet: true, rows };
  const reveal: Scene = { kind: "table", sheet: true, rows, highlightRows: hit };
  const boundary = scores.includes(t) && (op === ">" || op === "<");
  return numInput(
    `g:${SKILL}:countif:${idPart(`${op}${t}`)}-${scores.join("_")}:${count}:${seed}`,
    level,
    lk(
      `Чему равно значение формулы \`=СЧЁТЕСЛИ(B2:B7;"${op}${t}")\` для таблицы на рисунке?`,
      `Суреттегі кесте үшін \`=COUNTIF(B2:B7;"${op}${t}")\` формуласының мәні неге тең?`,
    ),
    lk(
      "Просмотри числа в B2:B7 и отметь те, что подходят под условие. Обрати внимание на знак: входит ли в условие равное число?",
      "B2:B7 ішіндегі сандарды қарап шығып, шартқа сәйкес келетіндерін белгіле. Белгіге назар аудар: тең сан шартқа кіре ме?",
    ),
    lk(
      `Функция считает ячейки, где значение ${op} ${t}: ${count === 0 ? "таких нет" : hit.map((i) => scores[i - 1]).join(", ")}.${boundary ? " Число, равное границе, при строгом знаке не подходит." : ""} Ответ: ${count}.`,
      `Функция мәні ${op} ${t} болатын ұяшықтарды санайды: ${count === 0 ? "ондайлар жоқ" : hit.map((i) => scores[i - 1]).join(", ")}.${boundary ? " Қатаң белгіде шекараға тең сан сәйкес келмейді." : ""} Жауабы: ${count}.`,
    ),
    count,
    scene,
    reveal,
  );
}

const CATS: L[] = [lk("молоко", "сүт"), lk("хлеб", "нан"), lk("сыр", "ірімшік")];

function sumIf(rand: Rand, level: Level, seed: number) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const cats = Array.from({ length: 6 }, () => int(rand, 0, 2));
    const target = int(rand, 0, 2);
    const hits = cats.map((c, i) => (c === target ? i : -1)).filter((i) => i >= 0);
    if (hits.length < 2 || hits.length > 4) continue;
    const amounts = Array.from({ length: 6 }, () => int(rand, 3, 60) * 10);
    const answer = hits.reduce((s, i) => s + amounts[i], 0);
    const rows: (string | L)[][] = [[lk("Товар", "Тауар"), lk("Сумма, ₸", "Сомасы, ₸")], ...cats.map((c, i): (string | L)[] => [CATS[c], String(amounts[i])])];
    const scene: Scene = { kind: "table", sheet: true, rows };
    const reveal: Scene = { kind: "table", sheet: true, rows, highlightRows: hits.map((i) => i + 1) };
    const name = CATS[target];
    return numInput(
      `g:${SKILL}:sumif:${idPart(name.ru)}-${cats.join("")}:${amounts.join("_")}:${seed}`,
      level,
      lk(`Чему равно значение формулы \`=СУММЕСЛИ(A2:A7;"${name.ru}";B2:B7)\`?`, `\`=SUMIF(A2:A7;"${name.kk}";B2:B7)\` формуласының мәні неге тең?`),
      lk(
        `Найди в столбце A строки со словом «${name.ru}» и сложи числа из столбца B в этих же строках.`,
        `A бағанынан «${name.kk}» сөзі бар жолдарды тауып, дәл сол жолдардағы B бағанының сандарын қос.`,
      ),
      lk(
        `Функция складывает числа из B2:B7 только в строках, где в A2:A7 написано «${name.ru}»: ${hits.map((i) => amounts[i]).join(" + ")} = ${answer}.`,
        `Функция B2:B7 ішіндегі сандарды тек A2:A7 бағанында «${name.kk}» жазылған жолдарда қосады: ${hits.map((i) => amounts[i]).join(" + ")} = ${answer}.`,
      ),
      answer,
      scene,
      reveal,
      "₸",
    );
  }
  throw new Error("sumIf: не удалось подобрать таблицу");
}

// ---------- Вопросы по уровням ----------

type Maker = (rand: Rand, level: Level, seed: number) => ChoiceStep | InputStep;

const MAKERS: Record<Level, Maker[]> = {
  1: [
    (r, l, s) => relFormula(r, l, s, "down"),
    (r, l, s) => relFormula(r, l, s, "right"),
    (r, l, s) => relFormula(r, l, s, "diag"),
    absKeep,
    singleRef,
    (r, l, s) => relFormula(r, l, s, "diag"),
  ],
  2: [mixedCopy, valueCopy, percent, ifCase, sumRange, singleRef, mixedCopy],
  3: [reverse, valueCopy, countIf, sumIf, mixedCopy, reverse],
};

function question(level: Level, seed: number) {
  const rand = seeded(seed);
  return pick(rand, MAKERS[level])(rand, level, seed);
}

// ---------- Утверждения, пары, короткие вопросы ----------

function claimCase(rand: Rand, level: Level) {
  const plan =
    level === 1
      ? makePlan(rand, { flags: [FREE, FREE], ops: ["+", "-", "*"], moves: [[0, -1], [-1, 0], [-1, -1]] })
      : level === 2
        ? makePlan(rand, { flags: [pick(rand, MIXED_FLAGS.slice(0, 3)), FREE], ops: ["+", "*"], moves: [[0, -1], [-1, 0], [1, 1]] })
        : makePlan(rand, { flags: [pick(rand, MIXED_FLAGS), pick(rand, MIXED_FLAGS)], ops: ["+", "*", "-"], moves: [[-1, -1], [1, -1], [-1, 1]] });
  return plan;
}

function statement(level: Level, seed: number): Statement {
  const rand = seeded(seed);
  for (let attempt = 0; attempt < 40; attempt++) {
    const plan = claimCase(rand, level);
    const { a, b } = fmtMove(plan);
    const value = rand() < 0.5;
    const kinds: Mistake[] = ["unchanged", "ignore", "invert", "onlyCol", "onlyRow", "opposite", "partial"];
    const wrongs = mistakeCands(plan, kinds);
    if (!value && !wrongs.length) continue;
    const claim = value ? fStr(plan.g) : (pick(rand, wrongs).text as string);
    const f = fStr(plan.f);
    return {
      id: `s:${SKILL}:${idPart(`${f}-${a}-${b}`)}:${idPart(claim)}`,
      skill: SKILL,
      level,
      text: lk(
        `Формулу ${f} из ${a} скопировали в ${b}. Получилась формула ${claim}.`,
        `${a} ұяшығындағы ${f} формуласын ${b} ұяшығына көшірді. Нәтижесінде ${claim} формуласы шықты.`,
      ),
      value,
      explanation: lk(
        `Из ${a} в ${b}: ${shiftL(plan.dc, plan.dr).ru}. Правильно: ${fStr(plan.g)}.`,
        `${a} → ${b}: ${shiftL(plan.dc, plan.dr).kk}. Дұрысы: ${fStr(plan.g)}.`,
      ),
      hint: HINT_SHIFT,
    };
  }
  throw new Error("statement: не удалось подобрать формулу");
}

function pair(level: Level, seed: number): Pair {
  const rand = seeded(seed);
  const plan = claimCase(rand, level);
  const { a, b } = fmtMove(plan);
  const f = fStr(plan.f);
  return { id: `p:${SKILL}:${idPart(`${f}-${a}-${b}`)}`, skill: SKILL, level, left: `${f}  (${a} → ${b})`, right: fStr(plan.g) };
}

function short(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  if (level === 1) {
    if (rand() < 0.5) {
      const oc = int(rand, 2, 4);
      const or = int(rand, 2, 5);
      const dr = int(rand, 2, 6);
      const ref = cellName(int(rand, 0, oc - 1), or);
      return {
        id: `q:${SKILL}:row:${ref}-${or}-${dr}`,
        skill: SKILL,
        level,
        prompt: lk(
          `Формулу из ${cellName(oc, or)} скопировали в ${cellName(oc, or + dr)}. В формуле была ссылка ${ref}. Какой номер строки у этой ссылки в новой формуле?`,
          `${cellName(oc, or)} ұяшығындағы формуланы ${cellName(oc, or + dr)} ұяшығына көшірді. Формулада ${ref} сілтемесі болған. Жаңа формулада бұл сілтеменің жол нөмірі қандай?`,
        ),
        answer: String(or + dr),
        mode: "number",
        explanation: lk(
          `Формулу сдвинули на ${dr} ${ruPl(dr, "строку", "строки", "строк")} вниз, поэтому и номер строки в ссылке вырос на ${dr}: ${or} + ${dr} = ${or + dr}.`,
          `Формула ${dr} жол төмен жылжыған, сондықтан сілтемедегі жол нөмірі де сонша өскен: ${or} + ${dr} = ${or + dr}.`,
        ),
        hint: lk("Относительная ссылка сдвигается на столько же строк, на сколько сдвинули формулу.", "Салыстырмалы сілтеме формула қанша жолға жылжыса, сонша жолға жылжиды."),
      };
    }
    const oc = int(rand, 0, 3);
    const dc = int(rand, 2, 5);
    const or = int(rand, 1, 5);
    return {
      id: `q:${SKILL}:cols:${cellName(oc, or)}-${dc}`,
      skill: SKILL,
      level,
      prompt: lk(
        `Формулу из ${cellName(oc, or)} скопировали в ${cellName(oc + dc, or)}. На сколько столбцов вправо сдвинута формула?`,
        `${cellName(oc, or)} ұяшығындағы формуланы ${cellName(oc + dc, or)} ұяшығына көшірді. Формула қанша бағанға оңға жылжыған?`,
      ),
      answer: String(dc),
      mode: "number",
      explanation: lk(
        `От ${colName(oc)} до ${colName(oc + dc)} — ${dc} ${ruPl(dc, "столбец", "столбца", "столбцов")}. Ссылки без знаков $ сдвинутся на столько же.`,
        `${colName(oc)} → ${colName(oc + dc)}: ${dc} баған. $ белгілері жоқ сілтемелер де сонша жылжиды.`,
      ),
      hint: lk("Посчитай буквы от исходного столбца до нового.", "Бастапқы бағаннан жаңа бағанға дейінгі әріптерді сана."),
    };
  }
  if (level === 2) {
    const p = pick(rand, [5, 10, 12, 15, 20, 25]);
    const target = int(rand, 3, 6);
    const price = int(rand, 2, 30) * 100;
    const answer = price + (price * p) / 100;
    return {
      id: `q:${SKILL}:percent:${p}-${target}-${price}`,
      skill: SKILL,
      level,
      prompt: lk(
        `Формулу \`=D2*${p}/100+D2\` из E2 скопировали в E${target}. В D${target} записано ${price}. Чему равно значение в E${target}?`,
        `E2 ұяшығындағы \`=D2*${p}/100+D2\` формуласын E${target} ұяшығына көшірді. D${target} ұяшығында ${price} жазылған. E${target} ұяшығындағы мән неге тең?`,
      ),
      answer: String(answer),
      mode: "number",
      explanation: lk(
        `В E${target} формула \`=D${target}*${p}/100+D${target}\`: ${price} · ${p} / 100 = ${(price * p) / 100}, ${price} + ${(price * p) / 100} = ${answer}.`,
        `E${target} ұяшығында формула \`=D${target}*${p}/100+D${target}\`: ${price} · ${p} / 100 = ${(price * p) / 100}, ${price} + ${(price * p) / 100} = ${answer}.`,
      ),
      hint: lk("Найди процент от цены (умножь на процент и раздели на 100) и прибавь саму цену.", "Бағаның пайызын тап (пайызға көбейтіп, 100-ге бөл) да бағаның өзін қос."),
    };
  }
  const scores = Array.from({ length: 6 }, () => int(rand, 4, 19) * 5);
  const op = pick(rand, [">=", ">", "<", "<="] as const);
  const t = pick(rand, scores);
  const test = (s: number) => (op === ">=" ? s >= t : op === ">" ? s > t : op === "<" ? s < t : s <= t);
  const count = scores.filter(test).length;
  return {
    id: `q:${SKILL}:countif:${op}${t}-${scores.join("_")}`,
    skill: SKILL,
    level,
    prompt: lk(
      `В диапазоне B2:B7 записаны числа: ${scores.join(", ")}. Чему равно значение \`=СЧЁТЕСЛИ(B2:B7;"${op}${t}")\`?`,
      `B2:B7 диапазонында мына сандар жазылған: ${scores.join(", ")}. \`=COUNTIF(B2:B7;"${op}${t}")\` мәні неге тең?`,
    ),
    answer: String(count),
    mode: "number",
    explanation: lk(
      `Считаем числа, для которых верно «${op} ${t}»: ${scores.filter(test).join(", ") || "таких нет"}. Всего: ${count}.`,
      `«${op} ${t}» шарты ақиқат сандарды санаймыз: ${scores.filter(test).join(", ") || "ондайлар жоқ"}. Барлығы: ${count}.`,
    ),
    hint: lk("Проверь каждое число: подходит ли оно под условие? Обрати внимание, входит ли граница.", "Әр санды тексер: ол шартқа сәйкес пе? Шекара кіретініне назар аудар."),
  };
}

export const BANKS: SkillBank[] = [{ skill: SKILL, question, statement, pair, short }];
