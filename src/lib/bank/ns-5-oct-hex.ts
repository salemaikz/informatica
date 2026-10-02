import type { L, Level, QuestionStep, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка ns.octhex: перевод 2 ↔ 8 ↔ 16. Правильный ответ всегда считает код (toString/parseInt),
// неверные варианты — типичные ошибки: группы слева, потерянные нули, обратный порядок, десятичное значение.
// Тексты после переменных — без падежных окончаний (в казахском окончание зависит от числа).

const SKILL = "ns.octhex";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });
const T = (ru: string, kk: string): L => ({ ru, kk });

type Base = 2 | 8 | 16;
const SUB: Record<Base, string> = { 2: "₂", 8: "₈", 16: "₁₆" };
const SYS: Record<Base, L> = {
  2: T("двоичную", "екілік"),
  8: T("восьмеричную", "сегіздік"),
  16: T("шестнадцатеричную", "он алтылық"),
};
const SYS_GEN: Record<Base, L> = {
  2: T("двоичной", "екілік"),
  8: T("восьмеричной", "сегіздік"),
  16: T("шестнадцатеричной", "он алтылық"),
};
const rec = (s: string, b: Base) => `${s}${SUB[b]}`;
const toBase = (n: number, b: Base) => n.toString(b).toUpperCase();
const bitsPer = (b: 8 | 16) => (b === 8 ? 3 : 4);
const groupWord = (b: 8 | 16): L => (b === 8 ? T("тройки", "үштіктерге") : T("четвёрки", "төрттіктерге"));

/** Случайная двоичная запись длины len со старшей единицей. */
function randBits(rand: Rand, len: number): string {
  let s = "1";
  for (let i = 1; i < len; i++) s += rand() < 0.5 ? "0" : "1";
  return s;
}

/** Группы по k бит справа налево; слева дописаны нули. */
function groupsOf(b: string, k: number): string[] {
  const padded = b.padStart(Math.ceil(b.length / k) * k, "0");
  return padded.match(new RegExp(`.{${k}}`, "g")) ?? [];
}
const digitOf = (g: string) => parseInt(g, 2).toString(16).toUpperCase();

/** Неверное разбиение: группы от левого края, последняя группа неполная. */
function leftGroups(b: string, k: number): string[] {
  return b.match(new RegExp(`.{1,${k}}`, "g")) ?? [];
}

/** Двоичная запись → цифры системы base по группам. */
function binToBase(b: string, base: 8 | 16): string {
  return groupsOf(b, bitsPer(base)).map(digitOf).join("");
}

/** Цифры системы base → двоичная запись с точными группами (ведущие нули не обрезаны). */
function digitsToBits(s: string, base: 8 | 16): string {
  return s
    .split("")
    .map((d) => parseInt(d, 16).toString(2).padStart(bitsPer(base), "0"))
    .join("");
}
const trimZeros = (s: string) => s.replace(/^0+(?=.)/, "");

/** Случайная запись в системе base из len цифр (старшая цифра не ноль). */
function randDigits(rand: Rand, len: number, base: 8 | 16): string {
  let s = toBase(int(rand, 1, base - 1), base);
  for (let i = 1; i < len; i++) s += toBase(int(rand, 0, base - 1), base);
  return s;
}

/** Меняет одну цифру записи на соседнюю в пределах системы (старшая цифра не становится нулём). */
function bumpDigit(rand: Rand, s: string, base: number): string {
  const pos = int(rand, 0, s.length - 1);
  const v = parseInt(s[pos], 16);
  let nv = v + pick(rand, [-1, 1]);
  if (nv < 0 || nv >= base || (pos === 0 && nv === 0)) nv = v + 1 < base ? v + 1 : v - 1;
  return `${s.slice(0, pos)}${nv.toString(16).toUpperCase()}${s.slice(pos + 1)}`;
}

/** Меняет один бит. */
function flipBit(rand: Rand, s: string): string {
  const pos = int(rand, 1, s.length - 1);
  return `${s.slice(0, pos)}${s[pos] === "1" ? "0" : "1"}${s.slice(pos + 1)}`;
}

const reverse = (s: string) => s.split("").reverse().join("");

// Причины неверных вариантов (показываются бесплатно при ошибке).
const WHY = {
  reversed: T(
    "Цифры записаны в обратном порядке: цифра левой группы бит и в ответе стоит слева.",
    "Цифрлар кері ретпен жазылған: сол жақтағы бит тобының цифры жауапта да сол жақта тұрады.",
  ),
  asDecimal: T(
    "Число принято за десятичное и переведено в двоичную как десятичное.",
    "Сан ондық деп алынып, екілік жүйеге ондық сан ретінде аударылған.",
  ),
  near: T(
    "Это соседняя цифра: значение отличается на единицу. Сложи веса заново.",
    "Бұл — көрші цифр: мәні бірге ерекшеленеді. Салмақтарды қайта қос.",
  ),
  oneOff: T(
    "Ошибка на единицу: выпиши двоичную запись и пересчитай её цифры.",
    "Бірге қателесу: екілік жазбаны жазып, цифрларын қайта сана.",
  ),
  left: T(
    "Группы взяты слева направо. Резать нужно справа налево, а недостающие нули дописывать слева.",
    "Топтар солдан оңға қарай алынған. Оңнан солға қарай бөліп, жетпейтін нөлдерді сол жағына жазу керек.",
  ),
  decimal: T(
    "Это десятичное значение числа, а не запись в нужной системе.",
    "Бұл — санның ондық мәні, керек жүйедегі жазба емес.",
  ),
  off: T(
    "Одна из цифр определена неверно: проверь каждую группу бит по таблице.",
    "Цифрлардың бірі қате анықталған: әр бит тобын кесте бойынша тексер.",
  ),
  flip: T(
    "Биты внутри групп прочитаны наоборот: например, 110 — это 6, а не 3.",
    "Топ ішіндегі биттер керісінше оқылған: мысалы, 110 — бұл 6, 3 емес.",
  ),
  lostZeros: T(
    "Потеряны нули: каждая цифра — ровно 3 (или 4) бита, нули внутри числа сохраняются.",
    "Нөлдер жоғалған: әр цифр — дәл 3 (немесе 4) бит, санның ішіндегі нөлдер сақталады.",
  ),
  order: T(
    "Группы бит записаны в обратном порядке.",
    "Бит топтары кері ретпен жазылған.",
  ),
  bit: T(
    "В одной из групп бит записан неверно: сверь каждую цифру с таблицей.",
    "Топтардың бірінде бит қате жазылған: әр цифрды кестемен салыстыр.",
  ),
  copy: T(
    "Цифры просто переписаны, перевода не было.",
    "Цифрлар жай көшіріліп жазылған, аудару болмаған.",
  ),
  generic: T(
    "Такая запись получается при ошибке в одной из групп: проверь каждую группу отдельно.",
    "Мұндай жазба бір топта қате кеткенде шығады: әр топты жеке тексер.",
  ),
};

interface Wrong {
  v: string;
  why: L;
}

/** Правильный вариант + 3 неверных (типичные ошибки, затем запасные), перемешанные вместе с whyWrong. */
function choose(rand: Rand, correct: string, wrongs: Wrong[], spare: () => string): { options: Text[]; correct: number; whyWrong: (L | null)[] } {
  const seen = new Set([correct]);
  const chosen: Wrong[] = [];
  for (const w of shuffle(wrongs, rand)) {
    if (chosen.length >= 3) break;
    if (!w.v || seen.has(w.v)) continue;
    seen.add(w.v);
    chosen.push(w);
  }
  for (let guard = 0; chosen.length < 3 && guard < 60; guard++) {
    const v = spare();
    if (v && !seen.has(v)) {
      seen.add(v);
      chosen.push({ v, why: WHY.generic });
    }
  }
  const entries = shuffle([{ v: correct, why: null as L | null }, ...chosen], rand);
  return { options: entries.map((e) => e.v), correct: entries.findIndex((e) => e.why === null), whyWrong: entries.map((e) => e.why) };
}

/** Разбор перевода 2 → 8/16 одной строкой: «110 → 6, 101 → 5». */
function groupsLine(b: string, base: 8 | 16): string {
  return groupsOf(b, bitsPer(base)).map((g) => `${g} → ${digitOf(g)}`).join(", ");
}

/** Сцена-«раскрытие»: группы бит сверху, цифры снизу. */
function groupsScene(cols: string[], digits: string[]): Scene {
  return { kind: "table", columns: cols, rows: [digits], highlightCols: cols.map((_, i) => i), mono: true };
}

// ---------- Задания ----------

function bin2baseChoice(rand: Rand, level: Level, seed: number, base: 8 | 16, len: number): QuestionStep {
  const b = randBits(rand, len);
  const k = bitsPer(base);
  const n = parseInt(b, 2);
  const ans = binToBase(b, base);
  const left = leftGroups(b, k).map((g) => parseInt(g, 2).toString(16).toUpperCase()).join("");
  const flipped = groupsOf(b, k).map((g) => digitOf(reverse(g))).join("");
  const o = choose(
    rand,
    ans,
    [
      { v: reverse(ans), why: WHY.reversed },
      { v: left, why: WHY.left },
      { v: String(n), why: WHY.decimal },
      { v: flipped, why: WHY.flip },
      { v: bumpDigit(rand, ans, base), why: WHY.off },
    ],
    () => bumpDigit(rand, ans, base),
  );
  const g = groupsOf(b, k);
  return {
    id: `g:ns.octhex:b2${base}c:${b}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: {
      ru: `Переведи в ${SYS[base].ru} систему: ${rec(b, 2)}`,
      kk: `${SYS[base].kk[0].toUpperCase()}${SYS[base].kk.slice(1)} жүйеге аудар: ${rec(b, 2)}`,
    },
    ...o,
    reveal: groupsScene(g, g.map(digitOf)),
    hint: {
      ru: `Режь число на ${groupWord(base).ru} справа налево и замени каждую группу цифрой.`,
      kk: `Санды оңнан солға қарай ${groupWord(base).kk} бөліп, әр топты цифрмен ауыстыр.`,
    },
    explanation: {
      ru: `Группы по ${k} бита справа налево${b.length % k ? " (слева дописаны нули)" : ""}: ${g.join(" | ")}. ${groupsLine(b, base)}. Ответ: ${rec(ans, base)}. Проверка: значение числа ${n}.`,
      kk: `Оңнан солға қарай ${k} биттен топтар${b.length % k ? " (сол жағына нөл жазылды)" : ""}: ${g.join(" | ")}. ${groupsLine(b, base)}. Жауабы: ${rec(ans, base)}. Тексеру: санның мәні ${n}.`,
    },
  };
}

function bin2baseInput(rand: Rand, level: Level, seed: number, base: 8 | 16, len: number): QuestionStep {
  const b = randBits(rand, len);
  const k = bitsPer(base);
  const ans = binToBase(b, base);
  const g = groupsOf(b, k);
  return {
    id: `g:ns.octhex:b2${base}i:${b}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `Переведи в ${SYS[base].ru} систему: ${rec(b, 2)}`,
      kk: `${SYS[base].kk[0].toUpperCase()}${SYS[base].kk.slice(1)} жүйеге аудар: ${rec(b, 2)}`,
    },
    answers: [...new Set([ans, ans.toLowerCase()])],
    mode: "number",
    suffix: SUB[base],
    hint: {
      ru: `Режь на ${groupWord(base).ru} справа налево. Если слева не хватает бит — допиши нули слева.`,
      kk: `Оңнан солға қарай ${groupWord(base).kk} бөл. Сол жақта бит жетпесе — сол жағына нөл жаз.`,
    },
    explanation: {
      ru: `Группы по ${k} бита справа налево${b.length % k ? " (слева дописаны нули)" : ""}: ${g.join(" | ")}. ${groupsLine(b, base)}. Ответ: ${rec(ans, base)}. Проверка: значение числа ${parseInt(b, 2)}.`,
      kk: `Оңнан солға қарай ${k} биттен топтар${b.length % k ? " (сол жағына нөл жазылды)" : ""}: ${g.join(" | ")}. ${groupsLine(b, base)}. Жауабы: ${rec(ans, base)}. Тексеру: санның мәні ${parseInt(b, 2)}.`,
    },
  };
}

function base2binChoice(rand: Rand, level: Level, seed: number, base: 8 | 16, len: number): QuestionStep {
  const s = randDigits(rand, len, base);
  const exact = digitsToBits(s, base);
  const ans = trimZeros(exact);
  const k = bitsPer(base);
  const lost = trimZeros(s.split("").map((d) => parseInt(d, 16).toString(2)).join(""));
  const orderRev = trimZeros(digitsToBits(reverse(s), base));
  const decimalBin = /^\d+$/.test(s) ? parseInt(s, 10).toString(2) : "";
  const o = choose(
    rand,
    ans,
    [
      { v: lost, why: WHY.lostZeros },
      { v: orderRev, why: WHY.order },
      { v: decimalBin, why: WHY.asDecimal },
      { v: flipBit(rand, ans), why: WHY.bit },
    ],
    () => flipBit(rand, ans),
  );
  return {
    id: `g:ns.octhex:${base}2bc:${s}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: { ru: `Переведи в двоичную систему: ${rec(s, base)}`, kk: `Екілік жүйеге аудар: ${rec(s, base)}` },
    ...o,
    reveal: groupsScene(s.split(""), digitsToBits(s, base).match(new RegExp(`.{${k}}`, "g")) ?? []),
    hint: {
      ru: `Каждая цифра — ровно ${k} бита, даже если слева получаются нули.`,
      kk: `Әр цифр — дәл ${k} бит, сол жақта нөлдер шықса да.`,
    },
    explanation: {
      ru: `Каждую цифру заменяем ${k} битами: ${s.split("").map((d) => `${d} → ${parseInt(d, 16).toString(2).padStart(k, "0")}`).join(", ")}. Склеиваем: ${exact}${exact === ans ? "" : `. Нули в самом начале убираем: ${ans}`}₂.`,
      kk: `Әр цифрды ${k} битпен ауыстырамыз: ${s.split("").map((d) => `${d} → ${parseInt(d, 16).toString(2).padStart(k, "0")}`).join(", ")}. Жалғаймыз: ${exact}${exact === ans ? "" : `. Ең басындағы нөлдерді алып тастаймыз: ${ans}`}₂.`,
    },
  };
}

function base2binInput(rand: Rand, level: Level, seed: number, base: 8 | 16, len: number): QuestionStep {
  const s = randDigits(rand, len, base);
  const exact = digitsToBits(s, base);
  const ans = trimZeros(exact);
  const k = bitsPer(base);
  return {
    id: `g:ns.octhex:${base}2bi:${s}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: { ru: `Переведи в двоичную систему: ${rec(s, base)}`, kk: `Екілік жүйеге аудар: ${rec(s, base)}` },
    answers: [ans],
    mode: "binary",
    suffix: "₂",
    reveal: groupsScene(s.split(""), digitsToBits(s, base).match(new RegExp(`.{${k}}`, "g")) ?? []),
    hint: {
      ru: `Каждая цифра — ровно ${k} бита. Нули внутри числа не теряй, лишние нули в самом начале можно убрать.`,
      kk: `Әр цифр — дәл ${k} бит. Санның ішіндегі нөлдерді жоғалтпа, ең басындағы артық нөлдерді алып тастауға болады.`,
    },
    explanation: {
      ru: `${s.split("").map((d) => `${d} → ${parseInt(d, 16).toString(2).padStart(k, "0")}`).join(", ")}. Склеиваем: ${exact}${exact === ans ? "" : `. Нули в самом начале убираем: ${ans}`}₂.`,
      kk: `${s.split("").map((d) => `${d} → ${parseInt(d, 16).toString(2).padStart(k, "0")}`).join(", ")}. Жалғаймыз: ${exact}${exact === ans ? "" : `. Ең басындағы нөлдерді алып тастаймыз: ${ans}`}₂.`,
    },
  };
}

/** A: цифра ↔ группа бит (выбор). */
function digitChoice(rand: Rand, level: Level, seed: number): QuestionStep {
  const hexMode = rand() < 0.6;
  const d = hexMode ? int(rand, 5, 15) : int(rand, 3, 7);
  const base: 8 | 16 = hexMode ? 16 : 8;
  const k = bitsPer(base);
  const sym = toBase(d, base);
  const bits = d.toString(2).padStart(k, "0");
  if (rand() < 0.5) {
    // цифра → биты
    const near = (x: number) => (x >= 0 && x < base ? x.toString(2).padStart(k, "0") : "");
    const o = choose(
      rand,
      bits,
      [
        { v: near(d - 1), why: WHY.near },
        { v: near(d + 1), why: WHY.near },
        { v: d.toString(2), why: WHY.lostZeros },
        { v: reverse(bits), why: WHY.flip },
      ],
      () => int(rand, 0, base - 1).toString(2).padStart(k, "0"),
    );
    return {
      id: `g:ns.octhex:dig2bits:${base}${sym}:${seed}`,
      type: "choice",
      skill: SKILL,
      level,
      prompt: {
        ru: `Какими ${k} битами записывается цифра ${sym} в ${SYS_GEN[base].ru} системе?`,
        kk: `${SYS_GEN[base].kk[0].toUpperCase()}${SYS_GEN[base].kk.slice(1)} жүйенің ${sym} цифры қандай ${k} битпен жазылады?`,
      },
      ...o,
      hint: {
        ru: `Найди значение цифры${base === 16 ? " (A = 10 … F = 15)" : ""} и разложи его по весам ${k === 3 ? "4, 2, 1" : "8, 4, 2, 1"}.`,
        kk: `Цифрдың мәнін тап${base === 16 ? " (A = 10 … F = 15)" : ""} және оны ${k === 3 ? "4, 2, 1" : "8, 4, 2, 1"} салмақтарына жікте.`,
      },
      explanation: {
        ru: `${sym} = ${d}. Веса ${k === 3 ? "4, 2, 1" : "8, 4, 2, 1"}: ${bits}. Битов всегда ровно ${k}, нули слева сохраняются.`,
        kk: `${sym} = ${d}. Салмақтар ${k === 3 ? "4, 2, 1" : "8, 4, 2, 1"}: ${bits}. Әрқашан дәл ${k} бит болады, сол жақтағы нөлдер сақталады.`,
      },
    };
  }
  // биты → цифра
  const around = (x: number) => (x >= 0 && x < base ? toBase(x, base) : "");
  const o = choose(
    rand,
    sym,
    [
      { v: around(d - 1), why: WHY.near },
      { v: around(d + 1), why: WHY.near },
      { v: d >= 10 ? String(d) : "", why: T("Это десятичное значение: в шестнадцатеричной системе значение 10–15 записывается одной буквой.", "Бұл — ондық мән: он алтылық жүйеде 10–15 мәні бір әріппен жазылады.") },
      { v: around(parseInt(reverse(bits), 2)), why: WHY.flip },
    ],
    () => around(int(rand, 0, base - 1)),
  );
  return {
    id: `g:ns.octhex:bits2dig:${base}${bits}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: {
      ru: `Какой цифре ${SYS_GEN[base].ru} системы соответствуют биты ${bits}?`,
      kk: `${bits} биттері ${SYS_GEN[base].kk} жүйенің қай цифрына сәйкес келеді?`,
    },
    ...o,
    hint: {
      ru: `Сложи веса ${k === 3 ? "4, 2, 1" : "8, 4, 2, 1"} там, где стоит 1.`,
      kk: `1 тұрған жерлердегі ${k === 3 ? "4, 2, 1" : "8, 4, 2, 1"} салмақтарын қос.`,
    },
    explanation: {
      ru: `${bits} = ${d}${base === 16 && d >= 10 ? `, а ${d} в шестнадцатеричной системе — буква ${sym}` : ""}. Ответ: ${sym}.`,
      kk: `${bits} = ${d}${base === 16 && d >= 10 ? `, ал ${d} он алтылық жүйеде — ${sym} әрпі` : ""}. Жауабы: ${sym}.`,
    },
  };
}

/** A: соответствие «цифра 16-й системы ↔ четыре бита». */
function matchHex(rand: Rand, level: Level, seed: number): QuestionStep {
  const digits = shuffle(Array.from({ length: 16 }, (_, i) => i), rand).slice(0, 4).sort((a, b) => a - b);
  return {
    id: `g:ns.octhex:match:${digits.map((d) => d.toString(16)).join("")}:${seed}`,
    type: "match",
    skill: SKILL,
    level,
    prompt: {
      ru: "Соедини цифру шестнадцатеричной системы с её записью четырьмя битами",
      kk: "Он алтылық жүйенің цифрын оның төрт биттік жазбасымен жұптастыр",
    },
    pairs: digits.map((d) => ({ left: rec(toBase(d, 16), 16), right: d.toString(2).padStart(4, "0") })),
    hint: {
      ru: "Запиши веса четвёрки: 8, 4, 2, 1. Помни: A = 10, B = 11, C = 12, D = 13, E = 14, F = 15.",
      kk: "Төрттіктің салмақтарын жаз: 8, 4, 2, 1. Есіңде болсын: A = 10, B = 11, C = 12, D = 13, E = 14, F = 15.",
    },
    explanation: {
      ru: `${digits.map((d) => `${toBase(d, 16)} = ${d} → ${d.toString(2).padStart(4, "0")}`).join("; ")}. Битов всегда четыре, нули слева сохраняются.`,
      kk: `${digits.map((d) => `${toBase(d, 16)} = ${d} → ${d.toString(2).padStart(4, "0")}`).join("; ")}. Әрқашан төрт бит болады, сол жақтағы нөлдер сақталады.`,
    },
  };
}

/** B: выбрать верное разбиение на группы. */
function splitChoice(rand: Rand, level: Level, seed: number): QuestionStep {
  const base: 8 | 16 = rand() < 0.5 ? 8 : 16;
  const k = bitsPer(base);
  let b = randBits(rand, int(rand, 7, 11));
  while (b.length % k === 0) b = randBits(rand, int(rand, 7, 11));
  const join = (g: string[]) => g.join(" ");
  const correct = join(groupsOf(b, k));
  const other = k === 3 ? 4 : 3;
  const padRight = (() => {
    const g = leftGroups(b, k);
    g[g.length - 1] = g[g.length - 1].padEnd(k, "0");
    return join(g);
  })();
  const o = choose(
    rand,
    correct,
    [
      { v: join(leftGroups(b, k)), why: WHY.left },
      { v: padRight, why: T("Нули дописаны справа, а это меняет число. Нули дописывают слева.", "Нөлдер оң жағына жазылған, бұл санды өзгертеді. Нөлдерді сол жағына жазады.") },
      { v: join(groupsOf(b, other)), why: T(`Группы по ${other} бита относятся к другой системе: здесь нужны группы по ${k}.`, `${other} биттік топтар басқа жүйеге жатады: мұнда ${k} биттік топтар керек.`) },
    ],
    () => join(leftGroups(b, k).reverse()),
  );
  return {
    id: `g:ns.octhex:split:${base}${b}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: {
      ru: `Как правильно разбить ${rec(b, 2)} для перевода в ${SYS[base].ru} систему?`,
      kk: `${rec(b, 2)} санын ${SYS[base].kk} жүйеге аудару үшін қалай дұрыс бөлу керек?`,
    },
    ...o,
    hint: {
      ru: `Начинай с правого края и бери по ${k} бита. Недостающие нули пишут слева.`,
      kk: `Оң жақ шетінен бастап ${k} биттен ал. Жетпейтін нөлдер сол жағына жазылады.`,
    },
    explanation: {
      ru: `Группы по ${k} бита берём справа налево, нули дописываем слева: ${correct}. Тогда цифры: ${groupsOf(b, k).map(digitOf).join("")}.`,
      kk: `${k} биттен топтарды оңнан солға қарай аламыз, нөлдерді сол жағына жазамыз: ${correct}. Сонда цифрлар: ${groupsOf(b, k).map(digitOf).join("")}.`,
    },
  };
}

/** C: 8 → 16 и 16 → 8 через двоичную систему (ввод). */
function crossInput(rand: Rand, level: Level, seed: number): QuestionStep {
  const from: 8 | 16 = rand() < 0.5 ? 8 : 16;
  const to: 8 | 16 = from === 8 ? 16 : 8;
  const s = randDigits(rand, from === 8 ? int(rand, 3, 4) : int(rand, 2, 3), from);
  const bits = trimZeros(digitsToBits(s, from));
  const ans = binToBase(bits, to);
  return {
    id: `g:ns.octhex:cross:${from}${s}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `Переведи в ${SYS[to].ru} систему: ${rec(s, from)}`,
      kk: `${SYS[to].kk[0].toUpperCase()}${SYS[to].kk.slice(1)} жүйеге аудар: ${rec(s, from)}`,
    },
    answers: [...new Set([ans, ans.toLowerCase()])],
    mode: "number",
    suffix: SUB[to],
    hint: {
      ru: "Двоичная система — мост: замени каждую цифру группой бит, затем режь запись справа налево по другому размеру групп.",
      kk: "Екілік жүйе — көпір: әр цифрды бит тобымен ауыстыр, содан кейін жазбаны басқа топ өлшемімен оңнан солға қарай бөл.",
    },
    explanation: {
      ru: `${rec(s, from)} → ${digitsToBits(s, from).match(new RegExp(`.{${bitsPer(from)}}`, "g"))!.join(" ")} → ${bits}₂. Теперь группы по ${bitsPer(to)} бита справа налево: ${groupsOf(bits, bitsPer(to)).join(" | ")}. Ответ: ${rec(ans, to)}.`,
      kk: `${rec(s, from)} → ${digitsToBits(s, from).match(new RegExp(`.{${bitsPer(from)}}`, "g"))!.join(" ")} → ${bits}₂. Енді оңнан солға қарай ${bitsPer(to)} биттен топтар: ${groupsOf(bits, bitsPer(to)).join(" | ")}. Жауабы: ${rec(ans, to)}.`,
    },
  };
}

/** C: сколько единиц / нулей в двоичной записи числа, заданного в 8-й или 16-й системе. */
function countInput(rand: Rand, level: Level, seed: number): QuestionStep {
  const base: 8 | 16 = rand() < 0.5 ? 8 : 16;
  const s = randDigits(rand, base === 8 ? int(rand, 3, 4) : int(rand, 2, 3), base);
  const bits = trimZeros(digitsToBits(s, base));
  const ones = bits.split("").filter((c) => c === "1").length;
  const zeros = bits.length - ones;
  const askOnes = rand() < 0.6;
  const count = askOnes ? ones : zeros;
  return {
    id: `g:ns.octhex:${askOnes ? "ones" : "zeros"}:${base}${s}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    ent: true,
    prompt: {
      ru: `Сколько ${askOnes ? "единиц" : "нулей"} в двоичной записи числа ${rec(s, base)}?`,
      kk: `${rec(s, base)} санының екілік жазбасында неше ${askOnes ? "бірлік" : "нөл"} бар?`,
    },
    answers: [String(count)],
    mode: "number",
    hint: {
      ru: `Запиши число двоичным кодом: каждая цифра — ${bitsPer(base)} бита. Нули в самом начале записи не считай.`,
      kk: `Санды екілік кодпен жаз: әр цифр — ${bitsPer(base)} бит. Жазбаның ең басындағы нөлдерді санама.`,
    },
    explanation: {
      ru: `${rec(s, base)} → ${bits}₂. ${askOnes ? "Единиц" : "Нулей"}: ${count} (всего цифр ${bits.length}, единиц ${ones}, нулей ${zeros}). Нули в самом начале записи не входят в число.`,
      kk: `${rec(s, base)} → ${bits}₂. ${askOnes ? "Бірліктер" : "Нөлдер"}: ${count} (барлығы ${bits.length} цифр, бірлік ${ones}, нөл ${zeros}). Жазбаның ең басындағы нөлдер санға кірмейді.`,
    },
  };
}

/** C: сколько цифр в двоичной записи числа из 8-й или 16-й системы (ловушка: ведущие нули). */
function lenChoice(rand: Rand, level: Level, seed: number): QuestionStep {
  const base: 8 | 16 = rand() < 0.5 ? 8 : 16;
  const k = bitsPer(base);
  const s = randDigits(rand, int(rand, 2, 3), base);
  const bits = trimZeros(digitsToBits(s, base));
  const o = choose(
    rand,
    String(bits.length),
    [
      { v: String(s.length * k), why: T("Нули в начале записи не считаются: левая цифра может дать меньше бит.", "Жазбаның басындағы нөлдер есептелмейді: сол жақтағы цифр азырақ бит беруі мүмкін.") },
      { v: String(s.length), why: T("Это число цифр в исходной записи, а не в двоичной.", "Бұл — бастапқы жазбадағы цифрлар саны, екілік жазбадағы емес.") },
      { v: String(bits.length + 1), why: WHY.oneOff },
      { v: String(bits.length - 1), why: WHY.oneOff },
    ],
    () => String(bits.length + int(rand, 2, 3)),
  );
  return {
    id: `g:ns.octhex:len:${base}${s}:${seed}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt: {
      ru: `Сколько цифр в двоичной записи числа ${rec(s, base)}?`,
      kk: `${rec(s, base)} санының екілік жазбасында неше цифр бар?`,
    },
    ...o,
    hint: {
      ru: `Замени каждую цифру группой из ${k} бит, затем убери нули в самом начале.`,
      kk: `Әр цифрды ${k} бит тобымен ауыстыр, содан кейін ең басындағы нөлдерді алып таста.`,
    },
    explanation: {
      ru: `${rec(s, base)} → ${bits}₂, количество цифр: ${bits.length}.${bits.length < s.length * k ? ` Бит в группах: ${s.length * k}, но нули в начале левой группы в запись не входят.` : ""}`,
      kk: `${rec(s, base)} → ${bits}₂, цифрлар саны: ${bits.length}.${bits.length < s.length * k ? ` Топтардағы биттер саны: ${s.length * k}, бірақ сол жақтағы топтың басындағы нөлдер жазбаға кірмейді.` : ""}`,
    },
  };
}

/** C: длина записи в другой системе по числу двоичных цифр. */
function ndigitsInput(rand: Rand, level: Level, seed: number): QuestionStep {
  const base: 8 | 16 = rand() < 0.5 ? 8 : 16;
  const k = bitsPer(base);
  const n = int(rand, 7, 22);
  const ans = Math.ceil(n / k);
  return {
    id: `g:ns.octhex:ndigits:${base}:${n}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: {
      ru: `Количество цифр в двоичной записи числа: ${n}. Сколько цифр в записи этого числа в ${SYS_GEN[base].ru} системе?`,
      kk: `Санның екілік жазбасындағы цифрлар саны: ${n}. Осы санның ${SYS_GEN[base].kk} жүйедегі жазбасында неше цифр бар?`,
    },
    answers: [String(ans)],
    mode: "number",
    hint: {
      ru: `Одна цифра заменяет ${k} бита. Сколько групп по ${k} нужно, чтобы вместить все биты (последняя может быть неполной)?`,
      kk: `Бір цифр ${k} битті ауыстырады. Барлық битті сыйғызу үшін ${k} биттен қанша топ керек (соңғысы толық болмауы мүмкін)?`,
    },
    explanation: {
      ru: `Режем по ${k} бита: ${n} = ${k} · ${Math.floor(n / k)} + ${n % k}. ${n % k ? "Остаток — неполная группа, она тоже даёт цифру." : "Все группы полные."} Цифр: ${ans}.`,
      kk: `${k} биттен бөлеміз: ${n} = ${k} · ${Math.floor(n / k)} + ${n % k}. ${n % k ? "Қалдық — толық емес топ, ол да бір цифр береді." : "Барлық топ толық."} Цифрлар саны: ${ans}.`,
    },
  };
}

function makeQuestion(level: Level, seed: number): QuestionStep {
  const rand = seeded(seed);
  if (level === 1) {
    const kind = pick(rand, ["b2o", "b2h", "o2b", "h2b", "digit", "digit", "match"] as const);
    switch (kind) {
      case "b2o":
        return bin2baseChoice(rand, level, seed, 8, 6);
      case "b2h":
        return bin2baseChoice(rand, level, seed, 16, 8);
      case "o2b":
        return base2binChoice(rand, level, seed, 8, 2);
      case "h2b":
        return base2binChoice(rand, level, seed, 16, 2);
      case "digit":
        return digitChoice(rand, level, seed);
      default:
        return matchHex(rand, level, seed);
    }
  }
  if (level === 2) {
    const kind = pick(rand, ["b2h", "b2o", "o2b", "h2b", "split", "b2oc", "b2hc"] as const);
    switch (kind) {
      case "b2h":
        return bin2baseInput(rand, level, seed, 16, pick(rand, [9, 10, 11, 13]));
      case "b2o":
        return bin2baseInput(rand, level, seed, 8, pick(rand, [7, 8, 10, 11]));
      case "o2b":
        return base2binInput(rand, level, seed, 8, 3);
      case "h2b":
        return base2binInput(rand, level, seed, 16, int(rand, 2, 3));
      case "split":
        return splitChoice(rand, level, seed);
      case "b2oc":
        return bin2baseChoice(rand, level, seed, 8, pick(rand, [7, 8, 10]));
      default:
        return bin2baseChoice(rand, level, seed, 16, pick(rand, [9, 10, 11]));
    }
  }
  const kind = pick(rand, ["cross", "cross", "count", "len", "ndigits"] as const);
  switch (kind) {
    case "cross":
      return crossInput(rand, level, seed);
    case "count":
      return countInput(rand, level, seed);
    case "len":
      return lenChoice(rand, level, seed);
    default:
      return ndigitsInput(rand, level, seed);
  }
}

// ---------- Утверждения «верно / неверно» ----------

function makeStatement(level: Level, seed: number): Statement {
  const rand = seeded(seed);
  if (level === 1) {
    const hexMode = rand() < 0.6;
    const base: 8 | 16 = hexMode ? 16 : 8;
    const k = bitsPer(base);
    const d = hexMode ? int(rand, 5, 15) : int(rand, 3, 7);
    const bits = d.toString(2).padStart(k, "0");
    const value = rand() < 0.5;
    const claim = value ? bits : pick(rand, [flipBit(rand, bits), reverse(bits)].filter((x) => x !== bits));
    return {
      id: `s:ns.octhex:dig:${base}${toBase(d, base)}:${claim}`,
      skill: SKILL,
      level,
      text: same(`${rec(toBase(d, base), base)} = ${claim}₂`),
      value: claim === bits,
      explanation: same(`${toBase(d, base)} = ${d} → ${bits}`),
    };
  }
  if (level === 2) {
    const base: 8 | 16 = rand() < 0.5 ? 8 : 16;
    const k = bitsPer(base);
    let b = randBits(rand, int(rand, 7, 11));
    while (b.length % k === 0) b = randBits(rand, int(rand, 7, 11));
    const ans = binToBase(b, base);
    const value = rand() < 0.5;
    const left = leftGroups(b, k).map((g) => parseInt(g, 2).toString(16).toUpperCase()).join("");
    const claim = value ? ans : pick(rand, [left, reverse(ans), bumpDigit(rand, ans, base)].filter((x) => x !== ans));
    return {
      id: `s:ns.octhex:b2x:${base}${b}:${claim}`,
      skill: SKILL,
      level,
      text: same(`${rec(b, 2)} = ${rec(claim, base)}`),
      value: claim === ans,
      explanation: same(`${groupsOf(b, k).join(" | ")} → ${groupsOf(b, k).map(digitOf).join("")}: ${rec(b, 2)} = ${rec(ans, base)}`),
    };
  }
  // C: единицы в двоичной записи или длина записи.
  const base: 8 | 16 = rand() < 0.5 ? 8 : 16;
  const s = randDigits(rand, base === 8 ? int(rand, 3, 4) : int(rand, 2, 3), base);
  const bits = trimZeros(digitsToBits(s, base));
  const ones = bits.split("").filter((c) => c === "1").length;
  const value = rand() < 0.5;
  if (rand() < 0.5) {
    const claim = value ? ones : Math.max(1, ones + pick(rand, [-1, 1]));
    return {
      id: `s:ns.octhex:ones:${base}${s}:${claim}`,
      skill: SKILL,
      level,
      text: {
        ru: `Количество единиц в двоичной записи числа ${rec(s, base)}: ${claim}`,
        kk: `${rec(s, base)} санының екілік жазбасындағы бірліктер саны: ${claim}`,
      },
      value: claim === ones,
      explanation: same(`${rec(s, base)} → ${bits}₂: ${ones}`),
    };
  }
  const claim = value ? bits.length : pick(rand, [s.length * bitsPer(base), bits.length + 1, bits.length - 1].filter((x) => x !== bits.length));
  return {
    id: `s:ns.octhex:len:${base}${s}:${claim}`,
    skill: SKILL,
    level,
    text: {
      ru: `Количество цифр в двоичной записи числа ${rec(s, base)}: ${claim}`,
      kk: `${rec(s, base)} санының екілік жазбасындағы цифрлар саны: ${claim}`,
    },
    value: claim === bits.length,
    explanation: {
      ru: `${rec(s, base)} → ${bits}₂, количество цифр: ${bits.length} (нули в начале не считаются).`,
      kk: `${rec(s, base)} → ${bits}₂, цифрлар саны: ${bits.length} (басындағы нөлдер есептелмейді).`,
    },
  };
}

// ---------- Пары ----------

function makePair(level: Level, seed: number): Pair {
  const rand = seeded(seed);
  if (level === 1) {
    const hexMode = rand() < 0.6;
    const base: 8 | 16 = hexMode ? 16 : 8;
    const d = int(rand, 0, base - 1);
    return { id: `p:ns.octhex:dig:${base}${toBase(d, base)}`, skill: SKILL, level, left: rec(toBase(d, base), base), right: d.toString(2).padStart(bitsPer(base), "0") };
  }
  if (level === 2) {
    const s = randDigits(rand, 2, 16);
    return { id: `p:ns.octhex:hex2:${s}`, skill: SKILL, level, left: rec(s, 16), right: rec(trimZeros(digitsToBits(s, 16)), 2) };
  }
  const o = randDigits(rand, 3, 8);
  const bits = trimZeros(digitsToBits(o, 8));
  return { id: `p:ns.octhex:o2h:${o}`, skill: SKILL, level, left: rec(o, 8), right: rec(binToBase(bits, 16), 16) };
}

// ---------- Короткие вопросы ----------

function makeShort(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed);
  if (level === 1) {
    const hexMode = rand() < 0.6;
    const base: 8 | 16 = hexMode ? 16 : 8;
    // цифры со старшим битом 1 — ответ без ведущих нулей, однозначный
    const d = hexMode ? int(rand, 8, 15) : int(rand, 4, 7);
    const bits = d.toString(2);
    return {
      id: `q:ns.octhex:dig:${base}${toBase(d, base)}`,
      skill: SKILL,
      level,
      prompt: same(`${rec(toBase(d, base), base)} = ?₂`),
      answer: bits,
      mode: "binary",
      explanation: same(`${toBase(d, base)} = ${d} → ${bits}`),
    };
  }
  if (level === 2) {
    const base: 8 | 16 = rand() < 0.5 ? 8 : 16;
    const k = bitsPer(base);
    let b = randBits(rand, int(rand, 7, 11));
    while (b.length % k === 0) b = randBits(rand, int(rand, 7, 11));
    const ans = binToBase(b, base);
    return {
      id: `q:ns.octhex:b2x:${base}${b}`,
      skill: SKILL,
      level,
      prompt: same(`${rec(b, 2)} = ?${SUB[base]}`),
      answer: ans,
      mode: "number",
      explanation: same(`${groupsOf(b, k).join(" | ")} → ${groupsOf(b, k).map(digitOf).join("")}`),
    };
  }
  const from: 8 | 16 = rand() < 0.5 ? 8 : 16;
  const to: 8 | 16 = from === 8 ? 16 : 8;
  const s = randDigits(rand, from === 8 ? 3 : int(rand, 2, 3), from);
  const bits = trimZeros(digitsToBits(s, from));
  const ans = binToBase(bits, to);
  return {
    id: `q:ns.octhex:cross:${from}${s}`,
    skill: SKILL,
    level,
    prompt: same(`${rec(s, from)} = ?${SUB[to]}`),
    answer: ans,
    mode: "number",
    explanation: same(`${rec(s, from)} → ${bits}₂ → ${rec(ans, to)}`),
  };
}

export const BANKS: SkillBank[] = [
  {
    skill: SKILL,
    question: makeQuestion,
    statement: makeStatement,
    pair: makePair,
    short: makeShort,
  },
];
