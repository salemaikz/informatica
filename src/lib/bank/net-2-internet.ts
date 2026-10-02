import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import { poolBank } from "./pool";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка net.addr (IP-адреса, URL, DNS, протоколы, маска подсети): генераторы + статичный пул «на знание».
// Генераторы: верность записи IP-адреса, сборка IP из фрагментов (единственный порядок проверяется перебором всех
// 24 перестановок), сборка URL из фрагментов, часть URL, адрес сети по IP и маске, IP из двоичной записи.
// Ответ всегда считает код; неверные варианты — типичные ошибки (256 вместо 255, три числа, запятая, склейка чисел).
// Параметры задачи зашиты в id (g:net.addr:<вид>:<параметры>:<seed>) — по ним ответы перепроверены независимо
// (scripts/out/net-2-internet/verify_bank.py). После переменных чисел казахские тексты без падежных окончаний.

const SKILL = "net.addr";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const w = (ru: string, kk: string): L => ({ ru, kk });
/** Безопасный для id фрагмент: только латиница, цифры и дефис. */
const slug = (s: string) => s.replace(/[^0-9a-zA-Z]+/g, "-");

const OK_IP = w("Верный адрес: четыре числа, все от 0 до 255.", "Дұрыс мекенжай: төрт сан, бәрі 0-ден 255-ке дейін.");

// ---------- Проверка записей ----------

/** IPv4: ровно четыре десятичных числа 0–255 без лишних нулей, разделённые точками. */
export function isValidIp(s: string): boolean {
  const p = s.split(".");
  return p.length === 4 && p.every((x) => /^(0|[1-9]\d{0,2})$/.test(x) && Number(x) <= 255);
}

function permutations(n: number): number[][] {
  const out: number[][] = [];
  const rec = (cur: number[], rest: number[]) => {
    if (!rest.length) out.push(cur);
    for (let i = 0; i < rest.length; i++) rec([...cur, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)]);
  };
  rec([], Array.from({ length: n }, (_, i) => i));
  return out;
}
const PERMS4 = permutations(4);

/** Что не так с записью, которая не является IP-адресом (первая найденная проблема). */
function describeIp(s: string): L {
  if (s.includes(",")) return w("числа разделены запятой, а нужна точка", "сандар үтірмен бөлінген, ал нүкте керек");
  const parts = s.split(".");
  const letters = parts.find((p) => /[^0-9]/.test(p));
  if (letters !== undefined && letters !== "") return w(`в записи есть буква: «${letters}» — не число`, `жазбада әріп бар: «${letters}» — сан емес`);
  const big = parts.find((p) => /^\d+$/.test(p) && Number(p) > 255);
  if (big !== undefined) return w(`число ${big} больше 255`, `${big} саны 255-тен үлкен`);
  if (parts.some((p) => p === "")) {
    return w(
      "лишняя точка: адрес не может начинаться или заканчиваться точкой, а две точки подряд пропускают число",
      "артық нүкте: мекенжай нүктеден басталмайды не нүктемен аяқталмайды, ал қатар екі нүкте санды жіберіп кетеді",
    );
  }
  if (parts.length !== 4) return w(`чисел ${parts.length}, а нужно четыре`, `жазбада ${parts.length} сан, ал төртеу болуы керек`);
  const lead = parts.find((p) => p.length > 1 && p[0] === "0");
  if (lead) return w(`в числе ${lead} лишний ноль в начале`, `${lead} санының басында артық нөл бар`);
  return w("адрес не подходит", "мекенжай жарамсыз");
}

// ---------- Верность записи IP-адреса ----------

type Defect = "big" | "short" | "long" | "empty" | "comma" | "letter";

function validOctets(rand: Rand, level: Level): number[] {
  // На уровне C в адресе чаще встречаются границы 0 и 255 — это не ошибка.
  return Array.from({ length: 4 }, () => (level === 3 && rand() < 0.35 ? pick(rand, [0, 255]) : int(rand, 1, 254)));
}

function badIp(rand: Rand, level: Level, defect: Defect): { s: string; why: L } {
  const o = validOctets(rand, 1);
  switch (defect) {
    case "big": {
      const v = level === 1 ? int(rand, 300, 999) : int(rand, 256, 299);
      const i = int(rand, 0, 3);
      const p = o.map(String);
      p[i] = String(v);
      return { s: p.join("."), why: w(`Число ${v} больше 255: в один байт оно не помещается.`, `${v} саны 255-тен үлкен: ол бір байтқа сыймайды.`) };
    }
    case "short":
      return { s: o.slice(0, 3).join("."), why: w("В записи всего три числа, а в IPv4 их четыре.", "Жазбада барлығы үш сан, ал IPv4-те олар төртеу.") };
    case "long":
      return { s: [...o, int(rand, 1, 254)].join("."), why: w("В записи пять чисел — на одно больше, чем нужно.", "Жазбада бес сан — қажеттіден біреу артық.") };
    case "empty": {
      const i = int(rand, 1, 2);
      const p = o.map(String);
      p[i] = "";
      return { s: p.join("."), why: w("Между двумя точками подряд пропущено число.", "Қатар тұрған екі нүктенің арасында сан жіберіліп кеткен.") };
    }
    case "comma": {
      const i = int(rand, 1, 3);
      const p = o.map(String);
      const s = p.slice(0, i).join(".") + "," + p.slice(i).join(".");
      return { s, why: w("Числа в IP-адресе разделяют точками, а не запятыми.", "IP мекенжайдағы сандарды үтірмен емес, нүктелермен бөледі.") };
    }
    case "letter": {
      const i = int(rand, 0, 3);
      const p = o.map(String);
      p[i] = pick(rand, ["A", "B", "x", "O"]);
      return { s: p.join("."), why: w("В IPv4 числа состоят только из цифр, буквы недопустимы.", "IPv4-те сандар тек цифрлардан тұрады, әріптерге рұқсат жоқ.") };
    }
  }
}

const DEFECTS: Record<Level, Defect[]> = {
  1: ["big", "short", "long"],
  2: ["big", "short", "long", "empty", "comma", "letter"],
  3: ["big", "empty", "short", "long"],
};

const HINT_IP: L = w(
  "Проверяй по порядку: сколько чисел в записи (должно быть четыре) и не больше ли 255 каждое число.",
  "Ретімен тексер: жазбада неше сан бар (төртеу болуы керек) және әр сан 255-тен аспай ма.",
);

interface Opt {
  v: string;
  why: L | null;
}

function buildChoice(rand: Rand, id: string, level: Level, prompt: L, correct: Opt, wrongs: Opt[], explanation: L, hint: L, scene?: Scene): ChoiceStep {
  const seen = new Set<string>([correct.v]);
  const picked: Opt[] = [];
  for (const x of wrongs) {
    if (seen.has(x.v)) continue;
    seen.add(x.v);
    picked.push(x);
    if (picked.length === 3) break;
  }
  if (picked.length < 3) throw new Error(`${id}: не хватило разных неверных вариантов`);
  const list = shuffle<Opt>([{ v: correct.v, why: null }, ...picked], rand);
  const step: ChoiceStep = {
    id,
    type: "choice",
    skill: SKILL,
    level,
    prompt,
    options: list.map((x) => x.v),
    correct: list.findIndex((x) => x.why === null),
    whyWrong: list.map((x) => x.why),
    explanation,
    hint,
  };
  if (scene) step.scene = scene;
  return step;
}

/** Выбор «какая запись может / не может быть IP-адресом». */
function genIpChoice(level: Level, seed: number, rand: Rand): QuestionStep {
  const cannot = level === 3 ? true : level === 2 ? rand() < 0.5 : false;
  const defects = DEFECTS[level];
  const bad = (n: number) => {
    const out: { s: string; why: L }[] = [];
    const pool = shuffle(defects, rand);
    for (let i = 0; i < n; i++) out.push(badIp(rand, level, pool[i % pool.length]));
    return out;
  };
  if (!cannot) {
    const good = validOctets(rand, level).join(".");
    const wrongs = bad(3);
    return buildChoice(
      rand,
      `g:net.addr:ipvalid:${slug(good)}:${seed}`,
      level,
      w("Какая запись может быть IP-адресом (IPv4)?", "Қай жазба IP мекенжайы (IPv4) бола алады?"),
      { v: good, why: null },
      wrongs.map((x) => ({ v: x.s, why: x.why })),
      w(
        `Подходит ${good}: четыре числа, и все от 0 до 255. В остальных записях есть ошибка: число больше 255, не четыре числа, лишние знаки.`,
        `${good} жарайды: төрт сан, және бәрі 0-ден 255-ке дейін. Қалған жазбаларда қате бар: 255-тен үлкен сан, сандар төртеу емес, артық белгілер.`,
      ),
      HINT_IP,
    );
  }
  const wrong = bad(1)[0];
  const goods = Array.from({ length: 6 }, () => validOctets(rand, level).join("."));
  return buildChoice(
    rand,
    `g:net.addr:ipinvalid:${slug(wrong.s)}:${seed}`,
    level,
    w("Какая запись не может быть IP-адресом (IPv4)?", "Қай жазба IP мекенжайы (IPv4) бола алмайды?"),
    { v: wrong.s, why: null },
    goods.map((s) => ({ v: s, why: OK_IP })),
    w(
      `В записи ${wrong.s} ошибка: ${describeIp(wrong.s).ru}. Остальные записи верные: четыре числа, все от 0 до 255 (числа 0 и 255 допустимы).`,
      `${wrong.s} жазбасында қате бар: ${describeIp(wrong.s).kk}. Қалған жазбалар дұрыс: төрт сан, бәрі 0-ден 255-ке дейін (0 және 255 сандары жарамды).`,
    ),
    HINT_IP,
  );
}

// ---------- Сборка IP из фрагментов ----------

const LETTERS = ["А", "Б", "В", "Г", "Д"];

function cutsOf(addr: string): string[][] {
  const out: string[][] = [];
  const n = addr.length;
  for (let a = 1; a < n - 2; a++)
    for (let b = a + 1; b < n - 1; b++) for (let c = b + 1; c < n; c++) out.push([addr.slice(0, a), addr.slice(a, b), addr.slice(b, c), addr.slice(c)]);
  return out;
}

/** Сколько разрезов проходит внутри числа (не по точке). */
const innerCuts = (f: string[]) => [0, 1, 2].filter((i) => !(f[i].endsWith(".") || f[i + 1].startsWith("."))).length;
const solutionsOf = (f: string[]) => PERMS4.filter((p) => isValidIp(p.map((i) => f[i]).join("")));
const quoteJoin = (parts: string[]) => parts.map((p) => `«${p}»`).join(" + ");

function genFragIp(level: Level, seed: number, rand: Rand): QuestionStep {
  let addr = "172.16.100.10";
  let frags = ["172.", "16.1", "00", ".10"];
  const want = level === 3 ? 2 : 1;
  for (let attempt = 0; attempt < 60; attempt++) {
    const a = [pick(rand, [10, 172, 192, 100, 64, 85, 95, 128]), int(rand, 10, 255), int(rand, 10, 255), int(rand, 2, 254)];
    const cand = a.join(".");
    const ok = cutsOf(cand).filter((f) => f.every((x) => x.length >= 2) && innerCuts(f) === want && solutionsOf(f).length === 1);
    if (ok.length) {
      addr = cand;
      frags = pick(rand, ok);
      break;
    }
  }
  const order = shuffle([0, 1, 2, 3], rand); // order[i] — какой по счёту фрагмент лежит на карточке с буквой i
  const letterOf = (frag: number) => LETTERS[order.indexOf(frag)];
  const seq = (perm: number[]) => perm.map(letterOf).join("");
  const glue = (perm: number[]) => perm.map((i) => frags[i]).join("");
  const correct = seq([0, 1, 2, 3]);
  const swaps: number[][] = [];
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++) {
      const p = [0, 1, 2, 3];
      [p[i], p[j]] = [p[j], p[i]];
      swaps.push(p);
    }
  const wrongs = shuffle(swaps, rand).map((p) => {
    const d = describeIp(glue(p));
    return { v: seq(p), why: w(`Получится «${glue(p)}»: ${d.ru}.`, `«${glue(p)}» шығады: ${d.kk}.`) as L | null };
  });
  return buildChoice(
    rand,
    `g:net.addr:fragip:${slug(addr)}-${slug(frags.join("_"))}:${seed}`,
    level,
    w(
      "IP-адрес записали на четырёх карточках (см. таблицу). В каком порядке их нужно сложить, чтобы получился верный адрес?",
      "IP мекенжайды төрт карточкаға жазған (кестені қара). Дұрыс мекенжай шығуы үшін оларды қандай ретпен қою керек?",
    ),
    { v: correct, why: null },
    wrongs,
    w(
      `Порядок ${correct}: ${quoteJoin(frags)} = ${addr}. Это единственный порядок, при котором чисел четыре и каждое не больше 255.`,
      `Реті ${correct}: ${quoteJoin(frags)} = ${addr}. Бұл сандар төртеу және әрқайсысы 255-тен аспайтын жалғыз рет.`,
    ),
    w(
      "Карточка, которая начинается с точки, не может стоять первой, а карточка, которая заканчивается точкой, — последней. Проверяй, не склеиваются ли числа в число больше 255.",
      "Нүктеден басталатын карточка бірінші тұра алмайды, ал нүктемен аяқталатын карточка — соңғы тұра алмайды. Сандар 255-тен үлкен санға жабыспайтынын тексер.",
    ),
    {
      kind: "table",
      columns: [w("Карточка", "Карточка"), w("Текст", "Мәтін")],
      rows: [0, 1, 2, 3].map((i) => [LETTERS[i], frags[order[i]]]),
      mono: true,
    },
  );
}

// ---------- Сборка URL из фрагментов ----------

const PROTOCOLS = ["http", "https", "ftp"] as const;
const HOSTS = ["school.kz", "edu.gov.kz", "lyceum.kz", "info.school.kz", "kitap.kz", "portal.edu.kz", "nis.edu.kz", "olimp.kz"];
const FILES = ["/index.html", "/plan.pdf", "/photo.jpg", "/news.html", "/book.pdf"];
const PATHS = ["/docs/plan.pdf", "/news/index.html", "/files/book.pdf", "/img/photo.jpg", "/info/rules.pdf"];

function genFragUrl(level: Level, seed: number, rand: Rand): QuestionStep {
  const proto = pick(rand, PROTOCOLS);
  const host = pick(rand, HOSTS);
  let frags: string[];
  if (level === 3) {
    const path = pick(rand, PATHS);
    const dot = host.lastIndexOf(".");
    frags = [proto, "://", host.slice(0, dot), `${host.slice(dot)}/`, path.slice(1)];
  } else {
    frags = [proto, "://", host, pick(rand, FILES)];
  }
  const n = frags.length;
  const url = frags.join("");
  const order = shuffle(Array.from({ length: n }, (_, i) => i), rand);
  const letterOf = (frag: number) => LETTERS[order.indexOf(frag)];
  const seq = (perm: number[]) => perm.map(letterOf).join("");
  const glue = (perm: number[]) => perm.map((i) => frags[i]).join("");
  const natural = Array.from({ length: n }, (_, i) => i);
  const swaps: number[][] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const p = [...natural];
      [p[i], p[j]] = [p[j], p[i]];
      swaps.push(p);
    }
  const reason = (s: string): L => {
    if (!s.startsWith(proto)) return w("адрес начинается не с протокола", "мекенжай хаттамадан басталмайды");
    if (!s.startsWith(`${proto}://`)) return w("«://» должно стоять сразу после протокола", "«://» хаттамадан кейін бірден тұруы керек");
    return w("части имени сервера и пути перепутаны", "сервер аты мен жолдың бөліктері араласып кеткен");
  };
  const wrongs = shuffle(swaps, rand).map((p) => {
    const r = reason(glue(p));
    return { v: seq(p), why: w(`Получится «${glue(p)}»: ${r.ru}.`, `«${glue(p)}» шығады: ${r.kk}.`) as L | null };
  });
  const letters = natural.map(letterOf).join("");
  return buildChoice(
    rand,
    `g:net.addr:fragurl:${slug(url)}:${seed}`,
    level,
    w(
      `Адрес страницы разрезали на ${n === 4 ? "четыре фрагмента" : "пять фрагментов"} (см. таблицу). В каком порядке их нужно сложить, чтобы получился URL?`,
      `Беттің мекенжайын ${n === 4 ? "төрт" : "бес"} үзіндіге кесіп тастаған (кестені қара). URL шығуы үшін оларды қандай ретпен қою керек?`,
    ),
    { v: letters, why: null },
    wrongs,
    w(
      `URL собирается так: протокол, затем «://», затем имя сервера, в конце путь к файлу. Верный порядок ${letters}: ${url}.`,
      `URL былай құрастырылады: хаттама, содан кейін «://», сервер аты, соңында файлға жол. Дұрыс рет ${letters}: ${url}.`,
    ),
    w(
      "Адрес всегда начинается с протокола, сразу за ним идёт «://», а путь к файлу стоит в самом конце.",
      "Мекенжай әрқашан хаттамадан басталады, одан кейін бірден «://» тұрады, ал файлға жол ең соңында тұрады.",
    ),
    {
      kind: "table",
      columns: [w("Фрагмент", "Үзінді"), w("Текст", "Мәтін")],
      rows: natural.map((i) => [LETTERS[i], frags[order[i]]]),
      mono: true,
    },
  );
}

// ---------- Часть URL ----------

type PartKind = "protocol" | "file" | "host" | "path" | "tld";

const PART_NAME: Record<PartKind, L> = {
  protocol: w("протокол", "хаттама"),
  file: w("имя файла", "файл аты"),
  host: w("имя сервера (домен)", "сервер аты (домен)"),
  path: w("путь к файлу (папки)", "файлға жол (қалталар)"),
  tld: w("домен верхнего уровня", "жоғарғы деңгейлі домен"),
};

function genUrlPart(level: Level, seed: number, rand: Rand): QuestionStep {
  const proto = pick(rand, PROTOCOLS);
  const host = pick(rand, HOSTS);
  const path = pick(rand, PATHS);
  const slash = path.lastIndexOf("/");
  const folders = path.slice(0, slash + 1);
  const file = path.slice(slash + 1);
  const url = `${proto}://${host}${path}`;
  const labels = host.split(".");
  const tld = labels[labels.length - 1];
  const kind = pick<PartKind>(rand, level === 1 ? ["protocol", "file"] : ["host", "path", "tld"]);
  const values: Record<PartKind, string> = { protocol: proto, file, host, path: folders, tld };
  const describe = (v: string): L => {
    if (v === proto) return w("Это протокол: он стоит в начале адреса, перед «://».", "Бұл хаттама: ол мекенжайдың басында, «://» алдында тұрады.");
    if (v === host) return w("Это имя сервера (домен): оно стоит после «://».", "Бұл сервер аты (домен): ол «://» кейін тұрады.");
    if (v === folders) return w("Это путь: папки на сервере, в которых лежит файл.", "Бұл жол: файл жатқан сервердегі қалталар.");
    if (v === file) return w("Это имя файла: оно стоит в самом конце адреса.", "Бұл файл аты: ол мекенжайдың ең соңында тұрады.");
    if (v === tld) return w("Это домен верхнего уровня: последняя часть имени сервера.", "Бұл жоғарғы деңгейлі домен: сервер атының соңғы бөлігі.");
    if (v === labels[0]) return w("Это левая часть имени сервера, а домен верхнего уровня стоит справа.", "Бұл сервер атының сол жақ бөлігі, ал жоғарғы деңгейлі домен оң жақта тұрады.");
    return w("Это другая часть адреса.", "Бұл мекенжайдың басқа бөлігі.");
  };
  const correct = values[kind];
  const others = shuffle(
    [proto, host, folders, file, kind === "tld" ? labels[0] : tld].filter((v) => v !== correct),
    rand,
  );
  const askRu = PART_NAME[kind].ru;
  const askKk = PART_NAME[kind].kk;
  return buildChoice(
    rand,
    `g:net.addr:urlpart:${slug(url)}-${kind}:${seed}`,
    level,
    w(`В адресе ${url} ${askRu} — это:`, `${url} мекенжайындағы ${askKk} — бұл:`),
    { v: correct, why: null },
    others.map((v) => ({ v, why: describe(v) })),
    w(
      `URL устроен так: протокол :// сервер / путь / файл. В адресе ${url}: протокол — ${proto}, сервер — ${host}, путь — ${folders}, файл — ${file}, домен верхнего уровня — ${tld}.`,
      `URL былай құрылған: хаттама :// сервер / жол / файл. ${url} мекенжайында: хаттама — ${proto}, сервер — ${host}, жол — ${folders}, файл — ${file}, жоғарғы деңгейлі домен — ${tld}.`,
    ),
    w(
      "Адрес устроен так: протокол, «://», имя сервера, путь, имя файла. Найди нужное место в этой цепочке.",
      "Мекенжай былай құрылған: хаттама, «://», сервер аты, жол, файл аты. Осы тізбектен керек орынды тап.",
    ),
  );
}

// ---------- Адрес сети по IP и маске ----------

const ipStr = (a: number[]) => a.join(".");
const andIp = (a: number[], m: number[]) => a.map((x, i) => x & m[i]);
const orIp = (a: number[], m: number[]) => a.map((x, i) => x | m[i]);

function pickIp(rand: Rand): number[] {
  const t = int(rand, 0, 2);
  if (t === 0) return [192, 168, int(rand, 0, 254), int(rand, 2, 254)];
  if (t === 1) return [172, int(rand, 16, 31), int(rand, 0, 254), int(rand, 2, 254)];
  return [10, int(rand, 0, 254), int(rand, 0, 254), int(rand, 2, 254)];
}

const ALIGNED_MASKS = [
  [255, 255, 255, 0],
  [255, 255, 0, 0],
  [255, 0, 0, 0],
];
const LAST_MASKS = [128, 192, 224, 240, 248, 252];

interface NetTask {
  ip: number[];
  mask: number[];
  net: number[];
}

function netTask(rand: Rand, level: Level): NetTask {
  const ip = pickIp(rand);
  if (level === 3) {
    for (let i = 0; i < 80; i++) {
      const mask = [255, 255, 255, pick(rand, LAST_MASKS)];
      const net = andIp(ip, mask);
      if (net[3] !== 0 && net[3] !== ip[3]) return { ip, mask, net };
      ip[3] = int(rand, 2, 254);
    }
    return { ip: [192, 168, 5, 70], mask: [255, 255, 255, 192], net: [192, 168, 5, 64] };
  }
  const mask = pick(rand, ALIGNED_MASKS);
  return { ip, mask, net: andIp(ip, mask) };
}

const HINT_NET: L = w(
  "Где в маске стоит 255, число адреса сохраняется, где 0 — обнуляется. Для числа между ними переведи оба числа в двоичную систему и выполни И по разрядам.",
  "Маскада 255 тұрған жерде мекенжай саны сақталады, 0 тұрған жерде нөлге айналады. Олардың арасындағы сан үшін екі санды екілік жүйеге аударып, разрядтар бойынша ЖӘНЕ орында.",
);

function netWrongs(t: NetTask): Opt[] {
  const k = t.mask.filter((x) => x === 255).length;
  const over = t.net.map((x, i) => (i >= Math.max(k - 1, 0) ? 0 : x));
  const host = t.ip.map((x, i) => x & ~t.mask[i] & 255);
  return [
    { v: ipStr(t.ip), why: w("Это сам IP-адрес: маска к нему не применена.", "Бұл IP мекенжайдың өзі: маска оған қолданылмаған.") },
    { v: ipStr(over), why: w("Обнулено лишнее число: маска 255 сохраняет число адреса.", "Артық сан нөлденген: 255 маскасы мекенжай санын сақтайды.") },
    { v: ipStr(orIp(t.ip, t.mask)), why: w("Применено ИЛИ вместо И: адрес сети получают побитовым И.", "ЖӘНЕ орнына НЕМЕСЕ қолданылған: желі мекенжайын биттік ЖӘНЕ арқылы алады.") },
    { v: ipStr(host), why: w("Это часть узла — то, что маска обнуляет, а не адрес сети.", "Бұл түйін бөлігі — маска нөлдейтін бөлік, желі мекенжайы емес.") },
  ];
}

function netExplanation(t: NetTask): L {
  const i = t.mask.findIndex((x) => x !== 255 && x !== 0);
  if (i === -1) {
    return w(
      `Маска ${ipStr(t.mask)}: где 255 — число сохраняется, где 0 — обнуляется. Адрес сети: ${ipStr(t.net)}.`,
      `${ipStr(t.mask)} маскасы: 255 тұрған жерде сан сақталады, 0 тұрған жерде нөлге айналады. Желі мекенжайы: ${ipStr(t.net)}.`,
    );
  }
  const b = (n: number) => n.toString(2).padStart(8, "0");
  return w(
    `Первые ${i} чис${i === 1 ? "ло" : i < 5 ? "ла" : "ел"} не меняются (маска 255). Последнее: ${t.ip[i]} И ${t.mask[i]}: ${b(t.ip[i])} И ${b(t.mask[i])} = ${b(t.net[i])} = ${t.net[i]}. Адрес сети: ${ipStr(t.net)}.`,
    `Алғашқы ${i} сан өзгермейді (255 маскасы). Соңғысы: ${t.ip[i]} ЖӘНЕ ${t.mask[i]}: ${b(t.ip[i])} ЖӘНЕ ${b(t.mask[i])} = ${b(t.net[i])} = ${t.net[i]}. Желі мекенжайы: ${ipStr(t.net)}.`,
  );
}

function genNetAddr(level: Level, seed: number, rand: Rand): QuestionStep {
  const t = netTask(rand, level === 1 ? 2 : level);
  const id = `g:net.addr:netaddr:${slug(ipStr(t.ip))}-${slug(ipStr(t.mask))}:${seed}`;
  if (level === 3) {
    const step: InputStep = {
      id,
      type: "input",
      skill: SKILL,
      level,
      prompt: w(
        `IP-адрес компьютера ${ipStr(t.ip)}, маска подсети ${ipStr(t.mask)}. Введи адрес сети (четыре числа через точки).`,
        `Компьютердің IP мекенжайы ${ipStr(t.ip)}, ішкі желі маскасы ${ipStr(t.mask)}. Желі мекенжайын енгіз (төрт сан нүктелермен).`,
      ),
      answers: [ipStr(t.net)],
      mode: "text",
      explanation: netExplanation(t),
      hint: HINT_NET,
    };
    return step;
  }
  return buildChoice(
    rand,
    id,
    level,
    w(
      `IP-адрес компьютера ${ipStr(t.ip)}, маска подсети ${ipStr(t.mask)}. Чему равен адрес сети?`,
      `Компьютердің IP мекенжайы ${ipStr(t.ip)}, ішкі желі маскасы ${ipStr(t.mask)}. Желі мекенжайы неге тең?`,
    ),
    { v: ipStr(t.net), why: null },
    netWrongs(t),
    netExplanation(t),
    HINT_NET,
  );
}

// ---------- IP из двоичной записи ----------

function genBinIp(level: Level, seed: number, rand: Rand): QuestionStep {
  const o = [pick(rand, [10, 172, 192, 100, 200]), int(rand, 0, 255), int(rand, 0, 255), int(rand, 1, 254)];
  const bin = o.map((x) => x.toString(2).padStart(8, "0"));
  return {
    id: `g:net.addr:binip:${o.join("-")}:${seed}`,
    type: "input",
    skill: SKILL,
    level,
    prompt: w(
      `Двоичная запись IP-адреса: ${bin.join(".")}. Запиши его в обычном виде (четыре числа через точки).`,
      `IP мекенжайдың екілік жазбасы: ${bin.join(".")}. Оны әдеттегі түрде жаз (төрт сан нүктелермен).`,
    ),
    answers: [o.join(".")],
    mode: "text",
    explanation: w(
      `Каждая группа из 8 цифр — одно число. Читаем группы по весам 128, 64, 32, 16, 8, 4, 2, 1: ${bin.map((b, i) => `${b}₂ = ${o[i]}`).join(", ")}. Адрес: ${o.join(".")}.`,
      `8 цифрдан тұратын әр топ — бір сан. Топтарды 128, 64, 32, 16, 8, 4, 2, 1 салмақтары бойынша оқимыз: ${bin.map((b, i) => `${b}₂ = ${o[i]}`).join(", ")}. Мекенжай: ${o.join(".")}.`,
    ),
    hint: w(
      "Каждая группа из 8 цифр — одно число. Переведи группы по очереди: подпиши веса 128, 64, 32, 16, 8, 4, 2, 1 и сложи те, что под единицами.",
      "8 цифрдан тұратын әр топ — бір сан. Топтарды кезекпен аудар: 128, 64, 32, 16, 8, 4, 2, 1 салмақтарын жазып, бірлердің астындағыларын қос.",
    ),
  };
}

// ---------- Утверждения, сгенерированные кодом ----------

function genIpStatement(level: Level, seed: number, rand: Rand): Statement {
  const valid = rand() < 0.5;
  let s: string;
  let expl: L;
  if (valid) {
    s = validOctets(rand, level).join(".");
    expl = w(`${s}: четыре числа, и все от 0 до 255 (числа 0 и 255 допустимы).`, `${s}: төрт сан, және бәрі 0-ден 255-ке дейін (0 және 255 сандары жарамды).`);
  } else {
    const b = badIp(rand, level, pick(rand, DEFECTS[level]));
    s = b.s;
    const d = describeIp(s);
    expl = w(`В записи ${s} ошибка: ${d.ru}.`, `${s} жазбасында қате бар: ${d.kk}.`);
  }
  return {
    id: `s:net.addr:ip:${slug(s)}`,
    skill: SKILL,
    level,
    text: w(`Запись ${s} может быть IP-адресом (IPv4)`, `${s} жазбасы IP мекенжайы (IPv4) бола алады`),
    value: isValidIp(s),
    explanation: expl,
    hint: HINT_IP,
  };
}

function genNetStatement(level: Level, seed: number, rand: Rand): Statement {
  const t = netTask(rand, level);
  const claimTrue = rand() < 0.5;
  const wrong = netWrongs(t).find((x) => x.v !== ipStr(t.net))!.v;
  const claim = claimTrue ? ipStr(t.net) : wrong;
  return {
    id: `s:net.addr:net:${slug(ipStr(t.ip))}-${slug(ipStr(t.mask))}-${slug(claim)}`,
    skill: SKILL,
    level,
    text: w(
      `При IP-адресе ${ipStr(t.ip)} и маске ${ipStr(t.mask)} адрес сети — ${claim}`,
      `IP мекенжайы ${ipStr(t.ip)} және маскасы ${ipStr(t.mask)} болғанда желі мекенжайы — ${claim}`,
    ),
    value: claim === ipStr(t.net),
    explanation: netExplanation(t),
    hint: HINT_NET,
  };
}

// ---------- Статичный пул: знания ----------

/** Выбор одного ответа: верный всегда первый — варианты перемешает poolBank по seed. */
function ch(id: string, level: Level, prompt: L, correct: Text, wrongs: [Text, L][], explanation: L, hint: L): ChoiceStep {
  return {
    id: `p:${SKILL}:${id}`,
    type: "choice",
    skill: SKILL,
    level,
    prompt,
    options: [correct, ...wrongs.map((x) => x[0])],
    correct: 0,
    whyWrong: [null, ...wrongs.map((x) => x[1])],
    explanation,
    hint,
  };
}

const questions: QuestionStep[] = [
  // ----- уровень A -----
  ch(
    "what-ip",
    1,
    w("Что такое IP-адрес?", "IP мекенжай дегеніміз не?"),
    w("Уникальный числовой адрес устройства в сети", "Желідегі құрылғының бірегей сандық мекенжайы"),
    [
      [w("Имя сайта из букв, например edu.gov.kz", "Әріптерден тұратын сайт аты, мысалы edu.gov.kz"), w("Имя из букв — это домен, а IP-адрес состоит из чисел.", "Әріптерден тұратын ат — домен, ал IP мекенжай сандардан тұрады.")],
      [w("Пароль для входа в Wi-Fi", "Wi-Fi-ға кіру құпиясөзі"), w("Пароль защищает сеть и адреса устройства не задаёт.", "Құпиясөз желіні қорғайды, құрылғының мекенжайын белгілемейді.")],
      [w("Название браузера", "Браузердің атауы"), w("Браузер — программа для просмотра сайтов, к адресам он не относится.", "Браузер — сайттарды қарайтын программа, мекенжайға қатысы жоқ.")],
    ],
    w("IP-адрес — уникальный номер устройства в сети, как номер дома на улице. По нему данные находят получателя.", "IP мекенжай — желідегі құрылғының бірегей нөмірі, көшедегі үй нөмірі сияқты. Деректер оны бойынша алушыны табады."),
    w("Вспомни номер дома на улице: что он помогает найти?", "Көшедегі үй нөмірін еске түсір: ол нені табуға көмектеседі?"),
  ),
  ch(
    "ipv4-form",
    1,
    w("Как записывается адрес IPv4?", "IPv4 мекенжайы қалай жазылады?"),
    w("Четыре числа от 0 до 255 через точки", "0-ден 255-ке дейінгі төрт сан нүктелермен"),
    [
      [w("Восемь групп из шестнадцатеричных цифр через двоеточие", "Қос нүктемен бөлінген он алтылық цифрлардан тұратын сегіз топ"), w("Так записывают адрес IPv6, а не IPv4.", "Бұлай IPv6 мекенжайын жазады, IPv4-ті емес.")],
      [w("Три числа от 0 до 255 через точки", "0-ден 255-ке дейінгі үш сан нүктелермен"), w("В IPv4 не три числа, а четыре.", "IPv4-те үш емес, төрт сан бар.")],
      [w("Слова из латинских букв через точки", "Нүктелермен бөлінген латын әріптерінен тұратын сөздер"), w("Слова через точки — это доменное имя, а не IP-адрес.", "Нүктелермен бөлінген сөздер — домен аты, IP мекенжай емес.")],
    ],
    w("IPv4 — четыре числа от 0 до 255, разделённые точками, например 192.168.1.10. Всего 32 бита.", "IPv4 — нүктелермен бөлінген 0-ден 255-ке дейінгі төрт сан, мысалы 192.168.1.10. Барлығы 32 бит."),
    w("Вспомни пример 192.168.1.10: сколько в нём чисел и чем они разделены?", "192.168.1.10 мысалын еске түсір: онда неше сан бар және олар немен бөлінген?"),
  ),
  ch(
    "dns-book",
    1,
    w("Какая служба работает как «телефонная книга» интернета?", "Қай қызмет интернеттің «телефон кітапшасы» болып жұмыс істейді?"),
    "DNS",
    [
      ["HTTPS", w("HTTPS шифрует передачу веб-страниц, а имена в адреса не переводит.", "HTTPS веб-беттерді беруді шифрлайды, аттарды мекенжайға айналдырмайды.")],
      ["SMTP", w("SMTP отправляет электронную почту.", "SMTP электрондық поштаны жібереді.")],
      ["FTP", w("FTP передаёт файлы.", "FTP файлдарды береді.")],
    ],
    w("DNS хранит соответствие «имя сайта — IP-адрес», как телефонная книга хранит «имя — номер».", "DNS «сайт аты — IP мекенжай» сәйкестігін сақтайды, телефон кітапшасы «аты — нөмір» сақтағандай."),
    w("В телефонной книге по имени находят номер. Какая служба по имени сайта находит адрес?", "Телефон кітапшасында ат бойынша нөмірді табады. Қай қызмет сайт аты бойынша мекенжайды табады?"),
  ),
  ch(
    "ftp-files",
    1,
    w("Какой протокол предназначен для передачи файлов?", "Қай хаттама файлдарды беруге арналған?"),
    "FTP",
    [
      ["SMTP", w("SMTP отправляет письма.", "SMTP хаттарды жібереді.")],
      ["DNS", w("DNS переводит имена в IP-адреса.", "DNS аттарды IP мекенжайға айналдырады.")],
      ["IMAP", w("IMAP читает письма на сервере.", "IMAP хаттарды серверде оқиды.")],
    ],
    w("FTP — File Transfer Protocol, «протокол передачи файлов».", "FTP — File Transfer Protocol, «файлдарды беру хаттамасы»."),
    w("Расшифруй название: File Transfer Protocol.", "Атауын жікте: File Transfer Protocol."),
  ),
  ch(
    "smtp-send",
    1,
    w("Какой протокол отвечает за отправку электронной почты?", "Қай хаттама электрондық поштаны жіберуге жауап береді?"),
    "SMTP",
    [
      ["FTP", w("FTP передаёт файлы, а не письма.", "FTP файлдарды береді, хаттарды емес.")],
      ["HTTP", w("HTTP передаёт веб-страницы.", "HTTP веб-беттерді береді.")],
      ["DNS", w("DNS находит IP-адрес по имени.", "DNS ат бойынша IP мекенжайды табады.")],
    ],
    w("SMTP (Simple Mail Transfer Protocol) отправляет письма. Получают их по POP3 или IMAP.", "SMTP (Simple Mail Transfer Protocol) хаттарды жібереді. Оларды POP3 немесе IMAP арқылы алады."),
    w("Mail в названии протокола подсказывает, о чём он.", "Хаттама атауындағы Mail оның не туралы екенін білдіреді."),
  ),
  ch(
    "url-start",
    1,
    w("Что стоит в начале URL перед «://»?", "URL басында «://» алдында не тұрады?"),
    w("Протокол", "Хаттама"),
    [
      [w("Имя файла", "Файл аты"), w("Имя файла стоит в самом конце адреса.", "Файл аты мекенжайдың ең соңында тұрады.")],
      [w("Домен верхнего уровня", "Жоғарғы деңгейлі домен"), w("Домен верхнего уровня (например, kz) — последняя часть имени сервера.", "Жоғарғы деңгейлі домен (мысалы, kz) — сервер атының соңғы бөлігі.")],
      [w("Адрес электронной почты", "Электрондық пошта мекенжайы"), w("Адрес почты имеет вид имя@домен и в URL не входит.", "Пошта мекенжайы аты@домен түрінде болады және URL құрамына кірмейді.")],
    ],
    w("URL: протокол (например, https), затем «://», имя сервера, путь и имя файла.", "URL: хаттама (мысалы, https), содан кейін «://», сервер аты, жол және файл аты."),
    w("Вспомни https://edu.gov.kz/docs/plan.pdf: что написано до двоеточия?", "https://edu.gov.kz/docs/plan.pdf мекенжайын еске түсір: қос нүктеге дейін не жазылған?"),
  ),
  ch(
    "domain-kz",
    1,
    w("Какой домен верхнего уровня у Казахстана?", "Қазақстанның жоғарғы деңгейлі домені қандай?"),
    "kz",
    [
      ["ru", w("ru — домен России.", "ru — Ресей домені.")],
      ["com", w("com — домен коммерческих организаций, а не страны.", "com — коммерциялық ұйымдардың домені, ел домені емес.")],
      ["gov", w("gov — домен государственных организаций, он не обозначает страну.", "gov — мемлекеттік ұйымдардың домені, ол елді білдірмейді.")],
    ],
    w("Страну обозначает двухбуквенный домен: kz — Казахстан.", "Елді екі әріптен тұратын домен білдіреді: kz — Қазақстан."),
    w("Домены стран — две латинские буквы. Какие подходят для Казахстана?", "Елдердің домендері — екі латын әрпі. Қазақстанға қайсысы сәйкес келеді?"),
  ),
  // ----- уровень B -----
  ch(
    "https-s",
    2,
    w("Что означает буква S в протоколе HTTPS?", "HTTPS хаттамасындағы S әрпі нені білдіреді?"),
    w("Secure — защищённое соединение с шифрованием", "Secure — шифрлаумен қорғалған қосылыс"),
    [
      [w("Server — адрес сервера", "Server — сервердің мекенжайы"), w("Адрес сервера задаёт доменное имя или IP-адрес, а не буква в протоколе.", "Сервердің мекенжайын домен аты немесе IP мекенжай белгілейді, хаттамадағы әріп емес.")],
      [w("Speed — повышенная скорость", "Speed — арттырылған жылдамдық"), w("Шифрование скорость не повышает, а немного замедляет.", "Шифрлау жылдамдықты арттырмайды, сәл баяулатады.")],
      [w("Site — сайт", "Site — сайт"), w("HTTP тоже работает с сайтами, поэтому дело не в слове «сайт».", "HTTP де сайттармен жұмыс істейді, сондықтан мәселе «сайт» сөзінде емес.")],
    ],
    w("S — Secure («защищённый»): HTTPS шифрует данные между браузером и сайтом.", "S — Secure («қорғалған»): HTTPS браузер мен сайт арасындағы деректерді шифрлайды."),
    w("Перед паролем и банковскими картами нужна защита. Какое английское слово про неё?", "Құпиясөз бен банк карталарының алдында қорғаныс керек. Ол туралы қандай ағылшын сөзі бар?"),
  ),
  ch(
    "imap-sync",
    2,
    w("Какой протокол позволяет читать письма на сервере и видеть их одинаково на всех устройствах?", "Қай хаттама хаттарды серверде оқуға және барлық құрылғыда бірдей көруге мүмкіндік береді?"),
    "IMAP",
    [
      ["POP3", w("POP3 обычно скачивает письма на одно устройство.", "POP3 әдетте хаттарды бір құрылғыға жүктейді.")],
      ["SMTP", w("SMTP только отправляет письма.", "SMTP хаттарды тек жібереді.")],
      ["FTP", w("FTP предназначен для файлов, а не для писем.", "FTP файлдарға арналған, хаттарға емес.")],
    ],
    w("IMAP оставляет письма на сервере и синхронизирует их между устройствами. POP3 скачивает письма на устройство.", "IMAP хаттарды серверде қалдырып, құрылғылар арасында синхрондайды. POP3 хаттарды құрылғыға жүктейді."),
    w("Письма должны остаться на сервере, а не уйти на одно устройство.", "Хаттар бір құрылғыға кетпей, серверде қалуы керек."),
  ),
  ch(
    "tcp-ip",
    2,
    w("Что такое TCP/IP?", "TCP/IP дегеніміз не?"),
    w("Набор протоколов, на которых работает интернет", "Интернет жұмыс істейтін хаттамалар жиыны"),
    [
      [w("Название браузера", "Браузердің атауы"), w("Браузер — программа для просмотра сайтов, а TCP/IP — набор правил передачи данных.", "Браузер — сайттарды қарайтын программа, ал TCP/IP — деректерді беру ережелерінің жиыны.")],
      [w("Тип сетевого кабеля", "Желі кабелінің түрі"), w("Кабель — это среда передачи, а TCP/IP — правила передачи.", "Кабель — беру ортасы, ал TCP/IP — беру ережелері.")],
      [w("Язык программирования", "Программалау тілі"), w("На языках программирования пишут программы, а TCP/IP — это протоколы обмена данными.", "Программалау тілдерінде программа жазады, ал TCP/IP — деректер алмасу хаттамалары.")],
    ],
    w("TCP/IP — основа интернета: делит данные на пакеты и доставляет их по IP-адресам.", "TCP/IP — интернеттің негізі: деректерді пакеттерге бөліп, IP мекенжайлар бойынша жеткізеді."),
    w("Слово «протокол» в названии подсказывает, что это за явление.", "Атаудағы «хаттама» сөзі бұл не екенін білдіреді."),
  ),
  ch(
    "ipv6-bits",
    2,
    w("Сколько бит занимает адрес IPv6?", "IPv6 мекенжайы неше бит орын алады?"),
    "128",
    [
      ["32", w("32 бита — это длина адреса IPv4.", "32 бит — IPv4 мекенжайының ұзындығы.")],
      ["64", w("64 бита — половина адреса IPv6, а не весь адрес.", "64 бит — IPv6 мекенжайының жартысы, бүкіл мекенжай емес.")],
      ["256", w("Адрес IPv6 вдвое короче: 128 бит.", "IPv6 мекенжайы екі есе қысқа: 128 бит.")],
    ],
    w("IPv6 — 128 бит, записывается восемью группами через двоеточие. Это намного больше, чем 32 бита в IPv4.", "IPv6 — 128 бит, қос нүктемен бөлінген сегіз топ болып жазылады. Бұл IPv4-тегі 32 биттен әлдеқайда көп."),
    w("IPv6 появился, потому что адресов IPv4 (32 бита) стало не хватать. Адрес должен быть заметно длиннее.", "IPv6 IPv4 мекенжайлары (32 бит) жетпей қалғандықтан пайда болды. Мекенжай айтарлықтай ұзынырақ болуы керек."),
  ),
  ch(
    "ipv6-form",
    2,
    w("Какая запись похожа на адрес IPv6?", "Қай жазба IPv6 мекенжайына ұқсас?"),
    "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
    [
      ["192.168.0.1", w("Это IPv4: четыре числа через точки.", "Бұл IPv4: нүктелермен бөлінген төрт сан.")],
      ["www.school.kz", w("Это доменное имя сайта.", "Бұл сайттың домен аты.")],
      ["aman@school.kz", w("Это адрес электронной почты.", "Бұл электрондық пошта мекенжайы.")],
    ],
    w("IPv6 записывают восемью группами шестнадцатеричных цифр через двоеточие.", "IPv6-ны қос нүктемен бөлінген он алтылық цифрлардың сегіз тобы етіп жазады."),
    w("У IPv6 другой разделитель — не точка.", "IPv6-да бөлгіш басқа — нүкте емес."),
  ),
  ch(
    "dns-why",
    2,
    w("Зачем браузеру DNS, когда ты вводишь имя сайта?", "Сайттың атын енгізгенде браузерге DNS не үшін керек?"),
    w("Чтобы по имени сайта найти его IP-адрес", "Сайттың аты бойынша оның IP мекенжайын табу үшін"),
    [
      [w("Чтобы зашифровать страницу", "Бетті шифрлау үшін"), w("Шифрование — задача HTTPS.", "Шифрлау — HTTPS міндеті.")],
      [w("Чтобы скачать файл со страницы", "Беттегі файлды жүктеу үшін"), w("Файлы передаёт протокол, например FTP или HTTP, а не DNS.", "Файлдарды хаттама береді, мысалы FTP немесе HTTP, DNS емес.")],
      [w("Чтобы проверить пароль", "Құпиясөзді тексеру үшін"), w("Пароль проверяет сайт, DNS его не видит.", "Құпиясөзді сайт тексереді, DNS оны көрмейді.")],
    ],
    w("Для связи нужен IP-адрес, а человек вводит имя. DNS переводит имя в IP-адрес.", "Байланыс үшін IP мекенжай керек, ал адам атын енгізеді. DNS атты IP мекенжайға айналдырады."),
    w("Сервер понимает числовые адреса, а ты вводишь имя. Кто переводит одно в другое?", "Сервер сандық мекенжайды түсінеді, ал сен атын енгізесің. Бірін екіншісіне кім аударады?"),
  ),
  ch(
    "url-path",
    2,
    w("В адресе https://school.kz/news/2026/index.html какая часть задаёт папки на сервере?", "https://school.kz/news/2026/index.html мекенжайында серверде қалталарды қай бөлік көрсетеді?"),
    "/news/2026/",
    [
      ["school.kz", w("school.kz — имя сервера.", "school.kz — сервер аты.")],
      ["https", w("https — протокол.", "https — хаттама.")],
      ["index.html", w("index.html — имя файла.", "index.html — файл аты.")],
    ],
    w("Путь «/news/2026/» — папки на сервере. После него идёт имя файла index.html.", "«/news/2026/» жолы — серверде қалталар. Одан кейін index.html файл аты тұрады."),
    w("Папки стоят между именем сервера и именем файла.", "Қалталар сервер аты мен файл атының арасында тұрады."),
  ),
  // ----- уровень C -----
  ch(
    "mask-purpose",
    3,
    w("Для чего нужна маска подсети?", "Ішкі желі маскасы не үшін керек?"),
    w("Чтобы определить, какая часть IP-адреса относится к сети", "IP мекенжайдың қай бөлігі желіге жататынын анықтау үшін"),
    [
      [w("Чтобы скрыть IP-адрес от сайтов", "IP мекенжайды сайттардан жасыру үшін"), w("Маска ничего не скрывает: она показывает границу между сетью и узлом.", "Маска ештеңені жасырмайды: ол желі мен түйін арасындағы шекараны көрсетеді.")],
      [w("Чтобы зашифровать передаваемые данные", "Жіберілетін деректерді шифрлау үшін"), w("Шифрование — задача HTTPS, а маска данные не защищает.", "Шифрлау — HTTPS міндеті, ал маска деректерді қорғамайды.")],
      [w("Чтобы по доменному имени найти IP-адрес", "Домен аты бойынша IP мекенжайды табу үшін"), w("Имена в адреса переводит DNS.", "Аттарды мекенжайға DNS айналдырады.")],
    ],
    w("Маска показывает, какая часть IP-адреса — номер сети, а какая — номер устройства в ней. Адрес сети = IP И маска.", "Маска IP мекенжайдың қай бөлігі — желі нөмірі, ал қайсысы — ондағы құрылғы нөмірі екенін көрсетеді. Желі мекенжайы = IP ЖӘНЕ маска."),
    w("Подумай, что получают, применяя маску к IP-адресу.", "Масканы IP мекенжайға қолданғанда не алатынын ойла."),
  ),
  ch(
    "mask-op",
    3,
    w("Какой операцией получают адрес сети из IP-адреса и маски?", "IP мекенжай мен маскадан желі мекенжайын қандай амалмен алады?"),
    w("Побитовое И", "Биттік ЖӘНЕ"),
    [
      [w("Побитовое ИЛИ", "Биттік НЕМЕСЕ"), w("ИЛИ даёт единицу, если хотя бы один бит равен 1, и превратило бы нули маски в единицы адреса.", "НЕМЕСЕ кемінде бір бит 1 болса бірлік береді, және маскадағы нөлдерді мекенжайдың бірліктеріне айналдырар еді.")],
      [w("Сложение чисел", "Сандарды қосу"), w("Сложение увеличило бы числа, а адрес сети получается обнулением части адреса.", "Қосу сандарды арттырар еді, ал желі мекенжайы мекенжайдың бір бөлігін нөлдеу арқылы шығады.")],
      [w("Вычитание маски из адреса", "Адрестен масканы алу"), w("Вычитание даёт «не те» числа, а нужно обнулить хост-часть побитовым И.", "Азайту «басқа» сандар береді, ал түйін бөлігін биттік ЖӘНЕ арқылы нөлдеу керек.")],
    ],
    w("Адрес сети = IP-адрес И маска (побитово): единицы маски сохраняют биты адреса, нули обнуляют.", "Желі мекенжайы = IP мекенжай ЖӘНЕ маска (биттік): маскадағы бірліктер мекенжай биттерін сақтайды, нөлдер нөлдейді."),
    w("Единица маски оставляет бит адреса, ноль — обнуляет. Какая логическая операция так работает?", "Маскадағы бірлік мекенжай бітін қалдырады, нөл — нөлдейді. Қай логикалық амал солай жұмыс істейді?"),
  ),
  ch(
    "mask-ones",
    3,
    w("Сколько единиц подряд слева в двоичной записи маски 255.255.255.0?", "255.255.255.0 маскасының екілік жазбасында сол жақтан қатарынан неше бірлік бар?"),
    "24",
    [
      ["8", w("8 единиц — это одно число 255, а таких чисел три.", "8 бірлік — бір 255 саны, ал мұндай сан үшеу.")],
      ["16", w("16 единиц — два числа 255, а их три.", "16 бірлік — екі 255 саны, ал олар үшеу.")],
      ["32", w("32 единицы были бы, если бы все четыре числа были 255.", "Төрт сан да 255 болса, 32 бірлік болар еді.")],
    ],
    w("Каждое число 255 = 11111111₂ даёт 8 единиц. Три числа 255 — 24 единицы, затем 8 нулей.", "255 = 11111111₂ санының әрқайсысы 8 бірлік береді. Үш 255 саны — 24 бірлік, содан кейін 8 нөл."),
    w("255 в двоичной записи — это сколько единиц? Умножь на число таких чисел в маске.", "255 екілік жазбада неше бірлік? Маскадағы мұндай сандар санына көбейт."),
  ),
  ch(
    "ipv4-count",
    3,
    w("Сколько всего различных адресов в IPv4?", "IPv4-те барлығы неше түрлі мекенжай бар?"),
    "2³²",
    [
      ["2⁸", w("2⁸ = 256 — это число значений одного числа адреса.", "2⁸ = 256 — мекенжайдың бір санының мәндер саны.")],
      ["2¹²⁸", w("2¹²⁸ — число адресов IPv6.", "2¹²⁸ — IPv6 мекенжайларының саны.")],
      ["4 · 255", w("Адреса не складывают, а считают комбинации: у каждого из четырёх чисел 256 вариантов.", "Мекенжайларды қоспайды, комбинацияларды санайды: төрт санның әрқайсысында 256 нұсқа бар.")],
    ],
    w("Адрес занимает 32 бита, поэтому различных адресов 2³² = 4 294 967 296.", "Мекенжай 32 бит алады, сондықтан түрлі мекенжай 2³² = 4 294 967 296."),
    w("Сколько бит в адресе IPv4? Сколько различных значений у такого числа?", "IPv4 мекенжайында неше бит бар? Мұндай санның неше түрлі мәні бар?"),
  ),
  ch(
    "byte-limit",
    3,
    w("Почему в IPv4 каждое число не больше 255?", "Неге IPv4-те әр сан 255-тен аспайды?"),
    w("Каждое число занимает 1 байт (8 бит): всего 256 значений, от 0 до 255", "Әр сан 1 байт (8 бит) алады: барлығы 256 мән, 0-ден 255-ке дейін"),
    [
      [w("Так просто договорились для удобства", "Жай ыңғайлы болу үшін келісіп алған"), w("Ограничение следует из размера: в 8 битах не поместится больше 256 значений.", "Шектеу өлшемнен шығады: 8 битке 256 мәннен артық сыймайды.")],
      [w("Каждое число занимает 2 байта", "Әр сан 2 байт алады"), w("Если бы число занимало 2 байта, адрес был бы длиннее 32 бит.", "Сан 2 байт алса, мекенжай 32 биттен ұзын болар еді.")],
      [w("Точка считается за одну цифру", "Нүкте бір цифр болып саналады"), w("Точка — разделитель и в значении числа не участвует.", "Нүкте — бөлгіш, ол санның мәніне қатыспайды.")],
    ],
    w("1 байт = 8 бит, а в 8 битах 2⁸ = 256 значений: от 0 до 255. Четыре таких числа — 32 бита.", "1 байт = 8 бит, ал 8 битте 2⁸ = 256 мән бар: 0-ден 255-ке дейін. Төрт осындай сан — 32 бит."),
    w("Сколько бит в одном числе адреса и сколько значений они могут хранить?", "Мекенжайдың бір санында неше бит бар және олар неше мәнді сақтай алады?"),
  ),
  ch(
    "domain-top",
    3,
    w("Какая часть доменного имени edu.gov.kz — домен верхнего уровня?", "edu.gov.kz домен атының қай бөлігі — жоғарғы деңгейлі домен?"),
    "kz",
    [
      ["edu", w("edu стоит слева — это более подробная часть.", "edu сол жақта тұр — бұл неғұрлым егжей-тегжейлі бөлік.")],
      ["gov", w("gov — середина имени, уровень ниже верхнего.", "gov — атаудың ортасы, жоғарғыдан бір деңгей төмен.")],
      ["edu.gov", w("Это часть имени без домена верхнего уровня.", "Бұл жоғарғы деңгейлі доменсіз атау бөлігі.")],
    ],
    w("Домен читают справа налево: самая правая часть — домен верхнего уровня (kz — Казахстан).", "Доменді оңнан солға қарай оқиды: ең оң жақ бөлік — жоғарғы деңгейлі домен (kz — Қазақстан)."),
    w("С какой стороны надо читать доменное имя, чтобы найти главную часть?", "Басты бөлікті табу үшін домен атын қай жақтан оқу керек?"),
  ),
  ch(
    "mail-three",
    3,
    w(
      "Письма читают с телефона, планшета и компьютера, и везде должны быть одинаковые папки и отметки «прочитано». Какой протокол удобнее для получения почты?",
      "Хаттарды телефоннан, планшеттен және компьютерден оқиды, және барлық жерде бірдей қалталар мен «оқылды» белгілері болуы керек. Поштаны алу үшін қай хаттама ыңғайлырақ?",
    ),
    "IMAP",
    [
      ["POP3", w("POP3 обычно скачивает письма на одно устройство, и на остальных их не будет.", "POP3 әдетте хаттарды бір құрылғыға жүктейді, ал қалғандарында олар болмайды.")],
      ["SMTP", w("SMTP только отправляет письма, получать ими нельзя.", "SMTP хаттарды тек жібереді, олармен алуға болмайды.")],
      ["FTP", w("FTP предназначен для файлов.", "FTP файлдарға арналған.")],
    ],
    w("IMAP хранит письма на сервере и синхронизирует состояние между устройствами, поэтому всё одинаково везде.", "IMAP хаттарды серверде сақтап, құрылғылар арасында күйді синхрондайды, сондықтан бәрі барлық жерде бірдей."),
    w("Нужен протокол, при котором письма остаются на сервере, а устройства лишь показывают их.", "Хаттар серверде қалып, құрылғылар тек көрсететін хаттама керек."),
  ),
];

const stmt = (id: string, level: Level, ru: string, kk: string, value: boolean, eRu: string, eKk: string, hRu: string, hKk: string): Statement => ({
  id: `s:${SKILL}:${id}`,
  skill: SKILL,
  level,
  text: w(ru, kk),
  value,
  explanation: w(eRu, eKk),
  hint: w(hRu, hKk),
});

const statements: Statement[] = [
  stmt("four-numbers", 1, "IPv4-адрес состоит из четырёх чисел, разделённых точками", "IPv4 мекенжайы нүктелермен бөлінген төрт саннан тұрады", true, "Например, 192.168.1.10: четыре числа от 0 до 255.", "Мысалы, 192.168.1.10: 0-ден 255-ке дейінгі төрт сан.", "Вспомни пример адреса: сколько в нём чисел?", "Мекенжай мысалын еске түсір: онда неше сан бар?"),
  stmt("num-256", 1, "Число 256 может стоять в IPv4-адресе", "256 саны IPv4 мекенжайында тұра алады", false, "Наибольшее число — 255: в один байт (8 бит) число 256 не помещается.", "Ең үлкен сан — 255: 256 саны бір байтқа (8 бит) сыймайды.", "Сколько значений помещается в 8 бит?", "8 битке неше мән сияды?"),
  stmt("dns-name-ip", 1, "DNS находит IP-адрес по доменному имени", "DNS домен аты бойынша IP мекенжайды табады", true, "DNS — «телефонная книга» интернета: имя сайта → IP-адрес.", "DNS — интернеттің «телефон кітапшасы»: сайт аты → IP мекенжай.", "Вспомни телефонную книгу: по имени находят номер.", "Телефон кітапшасын еске түсір: ат бойынша нөмірді табады."),
  stmt("ftp-mail", 1, "Протокол FTP предназначен для отправки электронной почты", "FTP хаттамасы электрондық поштаны жіберуге арналған", false, "FTP передаёт файлы, а почту отправляет SMTP.", "FTP файлдарды береді, ал поштаны SMTP жібереді.", "Расшифруй: File Transfer Protocol.", "Жікте: File Transfer Protocol."),
  stmt("https-encrypt", 1, "HTTPS шифрует данные между браузером и сайтом", "HTTPS браузер мен сайт арасындағы деректерді шифрлайды", true, "Буква S — Secure: соединение защищено шифрованием.", "S әрпі — Secure: қосылыс шифрлаумен қорғалған.", "Что означает S в HTTPS?", "HTTPS-тегі S нені білдіреді?"),
  stmt("smtp-send", 1, "Протокол SMTP используется для отправки писем", "SMTP хаттамасы хаттарды жіберу үшін қолданылады", true, "SMTP отправляет письма, а получают их по POP3 или IMAP.", "SMTP хаттарды жібереді, ал оларды POP3 немесе IMAP арқылы алады.", "Какое слово в расшифровке SMTP относится к почте?", "SMTP жіктелуіндегі қай сөз поштаға қатысты?"),
  stmt("three-numbers", 1, "Запись 192.168.1 может быть IP-адресом", "192.168.1 жазбасы IP мекенжайы бола алады", false, "В записи три числа, а в IPv4 их ровно четыре.", "Жазбада үш сан, ал IPv4-те олар дәл төртеу.", "Пересчитай числа в записи.", "Жазбадағы сандарды санап шық."),
  stmt("tld-right", 2, "Домен верхнего уровня стоит в имени сайта первым слева", "Жоғарғы деңгейлі домен сайт атында сол жақтан бірінші тұрады", false, "Домен верхнего уровня — самая правая часть имени: в edu.gov.kz это kz.", "Жоғарғы деңгейлі домен — атаудың ең оң жақ бөлігі: edu.gov.kz атында ол kz.", "Доменное имя читают в определённую сторону. В какую?", "Домен атын белгілі бір жаққа қарай оқиды. Қай жаққа?"),
  stmt("email-at", 2, "В адресе aman@school.kz после знака @ стоит домен почтового сервера", "aman@school.kz мекенжайында @ белгісінен кейін пошта серверінің домені тұрады", true, "Слева от @ — имя ящика, справа — домен почтового сервера.", "@ белгісінің сол жағында — жәшік аты, оң жағында — пошта серверінің домені.", "Что стоит слева от @, а что справа?", "@ белгісінің сол жағында не, оң жағында не тұр?"),
  stmt("ipv6-short", 2, "Адрес IPv6 короче адреса IPv4", "IPv6 мекенжайы IPv4 мекенжайынан қысқа", false, "IPv6 занимает 128 бит, а IPv4 — 32 бита, поэтому IPv6 в четыре раза длиннее.", "IPv6 128 бит алады, ал IPv4 — 32 бит, сондықтан IPv6 төрт есе ұзын.", "Сколько бит в каждом из адресов?", "Әр мекенжайда неше бит бар?"),
  stmt("tcpip-base", 2, "TCP/IP — набор протоколов, на которых работает интернет", "TCP/IP — интернет жұмыс істейтін хаттамалар жиыны", true, "TCP/IP делит данные на пакеты и доставляет их по IP-адресам.", "TCP/IP деректерді пакеттерге бөліп, IP мекенжайлар бойынша жеткізеді.", "Слово «протокол» в названии: это правила.", "Атаудағы «хаттама» сөзі: бұл ережелер."),
  stmt("imap-server", 2, "Протокол IMAP позволяет читать письма на сервере", "IMAP хаттамасы хаттарды серверде оқуға мүмкіндік береді", true, "IMAP оставляет письма на сервере и синхронизирует их между устройствами.", "IMAP хаттарды серверде қалдырып, құрылғылар арасында синхрондайды.", "Чем IMAP отличается от POP3?", "IMAP POP3-тен немен ерекшеленеді?"),
  stmt("pop3-send", 2, "Протокол POP3 используется для отправки писем", "POP3 хаттамасы хаттарды жіберу үшін қолданылады", false, "POP3 получает письма на устройство, а отправляет их SMTP.", "POP3 хаттарды құрылғыға алады, ал оларды SMTP жібереді.", "Какой протокол почты отвечает за отправку?", "Пошта хаттамаларының қайсысы жіберуге жауап береді?"),
  stmt("mask-and", 3, "Адрес сети получают побитовым ИЛИ IP-адреса и маски", "Желі мекенжайын IP мекенжай мен масканың биттік НЕМЕСЕ амалымен алады", false, "Адрес сети = IP-адрес И маска (побитовое И), а не ИЛИ.", "Желі мекенжайы = IP мекенжай ЖӘНЕ маска (биттік ЖӘНЕ), НЕМЕСЕ емес.", "Единица маски оставляет бит адреса, ноль обнуляет. Это И или ИЛИ?", "Маскадағы бірлік мекенжай бітін қалдырады, нөл нөлдейді. Бұл ЖӘНЕ ме, НЕМЕСЕ ме?"),
  stmt("mask-network", 3, "Маска подсети показывает, какая часть IP-адреса относится к сети", "Ішкі желі маскасы IP мекенжайдың қай бөлігі желіге жататынын көрсетеді", true, "Единицы маски — номер сети, нули — номер устройства в ней.", "Масканың бірліктері — желі нөмірі, нөлдері — ондағы құрылғы нөмірі.", "Для чего нужна маска подсети?", "Ішкі желі маскасы не үшін керек?"),
  stmt("count-2-32", 3, "Всего в IPv4 существует 2³² различных адресов", "IPv4-те барлығы 2³² түрлі мекенжай бар", true, "Адрес занимает 32 бита, значит различных адресов 2³² = 4 294 967 296.", "Мекенжай 32 бит алады, демек түрлі мекенжай 2³² = 4 294 967 296.", "Сколько бит в адресе и какова формула числа комбинаций?", "Мекенжайда неше бит бар және комбинациялар санының формуласы қандай?"),
];

const pr = (id: string, level: Level, left: Text, right: Text): Pair => ({ id: `p:${SKILL}:${id}`, skill: SKILL, level, left, right });

const pairs: Pair[] = [
  pr("ip", 1, "IP-адрес", w("Числовой адрес устройства в сети", "Желідегі құрылғының сандық мекенжайы")),
  pr("dns", 1, "DNS", w("Находит IP-адрес по имени сайта", "Сайт аты бойынша IP мекенжайды табады")),
  pr("https", 1, "HTTPS", w("Защищённая передача веб-страниц", "Веб-беттерді қорғалған түрде беру")),
  pr("ftp", 1, "FTP", w("Передача файлов", "Файлдарды беру")),
  pr("smtp", 1, "SMTP", w("Отправка писем", "Хаттарды жіберу")),
  pr("kz", 1, "kz", w("Домен верхнего уровня Казахстана", "Қазақстанның жоғарғы деңгейлі домені")),
  pr("pop3", 2, "POP3", w("Получение писем на устройство", "Хаттарды құрылғыға алу")),
  pr("imap", 2, "IMAP", w("Чтение писем на сервере", "Хаттарды серверде оқу")),
  pr("url", 2, "URL", w("Адрес страницы или файла в интернете", "Интернеттегі бет не файл мекенжайы")),
  pr("tcpip", 2, "TCP/IP", w("Основа работы интернета", "Интернет жұмысының негізі")),
  pr("ipv6", 2, "IPv6", w("Адрес из 128 бит", "128 биттен тұратын мекенжай")),
  pr("ipv4", 1, "IPv4", w("Адрес из 32 бит", "32 биттен тұратын мекенжай")),
  pr("mask", 3, w("Маска подсети", "Ішкі желі маскасы"), w("Определяет адрес сети по IP-адресу", "IP мекенжай бойынша желі мекенжайын анықтайды")),
  pr("email", 2, "aman@school.kz", w("Адрес электронной почты", "Электрондық пошта мекенжайы")),
];

const sq = (id: string, level: Level, ru: string, kk: string, answer: string, mode: "number" | "text", eRu: string, eKk: string, hRu: string, hKk: string): ShortQuestion => ({
  id: `q:${SKILL}:${id}`,
  skill: SKILL,
  level,
  prompt: w(ru, kk),
  answer,
  mode,
  explanation: w(eRu, eKk),
  hint: w(hRu, hKk),
});

const shorts: ShortQuestion[] = [
  sq("bytes", 1, "Сколько байт занимает один IPv4-адрес?", "Бір IPv4 мекенжайы неше байт орын алады?", "4", "number", "Четыре числа по 1 байту: 4 байта = 32 бита.", "Төрт сан 1 байттан: 4 байт = 32 бит.", "Сколько чисел в адресе и сколько байт занимает каждое?", "Мекенжайда неше сан бар және әрқайсысы неше байт алады?"),
  sq("max", 1, "Какое наибольшее число может стоять в IPv4-адресе?", "IPv4 мекенжайында тұра алатын ең үлкен сан қандай?", "255", "number", "В 8 битах значения от 0 до 255.", "8 битте мәндер 0-ден 255-ке дейін.", "Сколько значений в 8 битах и с какого числа они начинаются?", "8 битте неше мән бар және олар қай саннан басталады?"),
  sq("bits", 1, "Сколько бит занимает адрес IPv4?", "IPv4 мекенжайы неше бит орын алады?", "32", "number", "Четыре числа по 8 бит: 4 · 8 = 32.", "Төрт сан 8 биттен: 4 · 8 = 32.", "Умножь число байтов адреса на 8.", "Мекенжайдың байт санын 8-ге көбейт."),
  sq("kz", 1, "Введи домен верхнего уровня Казахстана (две латинские буквы).", "Қазақстанның жоғарғы деңгейлі доменін енгіз (екі латын әрпі).", "kz", "text", "Домен страны: kz — Казахстан.", "Ел домені: kz — Қазақстан.", "Вспомни адрес любого казахстанского сайта: что стоит после последней точки?", "Қазақстанның кез келген сайтының мекенжайын еске түсір: соңғы нүктеден кейін не тұр?"),
  sq("https", 2, "Как называется защищённая версия протокола HTTP? Введи латиницей.", "HTTP хаттамасының қорғалған нұсқасы қалай аталады? Латын әрпімен енгіз.", "HTTPS", "text", "HTTPS: S — Secure, данные шифруются.", "HTTPS: S — Secure, деректер шифрланады.", "К названию HTTP добавлена одна буква.", "HTTP атауына бір әріп қосылған."),
  sq("smtp", 2, "Какой протокол (латиницей) отвечает за отправку электронной почты?", "Қай хаттама (латын әрпімен) электрондық поштаны жіберуге жауап береді?", "SMTP", "text", "SMTP — Simple Mail Transfer Protocol.", "SMTP — Simple Mail Transfer Protocol.", "В названии есть слово Mail.", "Атауында Mail сөзі бар."),
  sq("ipv6", 2, "Сколько бит занимает адрес IPv6?", "IPv6 мекенжайы неше бит орын алады?", "128", "number", "IPv6 — 128 бит, это в четыре раза больше, чем у IPv4.", "IPv6 — 128 бит, бұл IPv4-тен төрт есе көп.", "IPv4 — 32 бита, а IPv6 длиннее в 4 раза.", "IPv4 — 32 бит, ал IPv6 4 есе ұзын."),
  sq("values", 3, "Сколько различных значений может принимать одно число IPv4-адреса?", "IPv4 мекенжайының бір саны неше түрлі мән қабылдай алады?", "256", "number", "Число занимает 8 бит: 2⁸ = 256 значений, от 0 до 255.", "Сан 8 бит алады: 2⁸ = 256 мән, 0-ден 255-ке дейін.", "Сколько значений в 8 битах? Считай и ноль.", "8 битте неше мән бар? Нөлді де санап көр."),
  sq("mask-ones", 3, "Сколько единиц подряд в начале двоичной записи маски 255.255.0.0?", "255.255.0.0 маскасының екілік жазбасының басында қатарынан неше бірлік бар?", "16", "number", "Два числа 255 дают по 8 единиц: 16 единиц, затем 16 нулей.", "Екі 255 саны 8 бірліктен береді: 16 бірлік, содан кейін 16 нөл.", "Сколько единиц в 255₁₀ = 11111111₂ и сколько таких чисел в маске?", "255₁₀ = 11111111₂ санында неше бірлік бар және маскада мұндай сан неше?"),
];

// ---------- Сборка банка ----------

const pool = poolBank({ skill: SKILL, questions, statements, pairs, shorts });

type Gen = (level: Level, seed: number, rand: Rand) => QuestionStep;

const GENERATORS: Record<Level, Gen[]> = {
  1: [genIpChoice, genUrlPart, genIpChoice],
  2: [genIpChoice, genFragUrl, genFragIp, genNetAddr, genUrlPart],
  3: [genFragIp, genNetAddr, genBinIp, genFragUrl, genIpChoice],
};

function netShort(level: Level, seed: number): ShortQuestion {
  const rand = seeded(seed ^ 0x51ed270b);
  const t = netTask(rand, level === 3 ? 3 : 2);
  return {
    id: `q:${SKILL}:net:${slug(ipStr(t.ip))}-${slug(ipStr(t.mask))}`,
    skill: SKILL,
    level,
    prompt: w(
      `IP-адрес ${ipStr(t.ip)}, маска ${ipStr(t.mask)}. Чему равен адрес сети?`,
      `IP мекенжайы ${ipStr(t.ip)}, маскасы ${ipStr(t.mask)}. Желі мекенжайы неге тең?`,
    ),
    answer: ipStr(t.net),
    mode: "text",
    explanation: netExplanation(t),
    hint: HINT_NET,
  };
}

const addr: SkillBank = {
  skill: SKILL,
  question(level, seed) {
    const rand = seeded(seed ^ 0x7f4a7c15);
    // Примерно половина заданий — генераторы (расчёты и сборка адресов), остальное — знания из пула.
    if (rand() < 0.5) return pool.question(level, seed);
    return pick(rand, GENERATORS[level])(level, seed, rand);
  },
  statement(level, seed) {
    const rand = seeded(seed ^ 0x2545f491);
    const r = rand();
    if (r < 0.3) return genIpStatement(level, seed, rand);
    if (r < 0.45 && level >= 2) return genNetStatement(level, seed, rand);
    return pool.statement!(level, seed);
  },
  pair: pool.pair,
  short(level, seed) {
    const rand = seeded(seed ^ 0x3c6ef372);
    if (level >= 2 && rand() < 0.3) return netShort(level, seed);
    return pool.short!(level, seed);
  },
};

export const BANKS: SkillBank[] = [addr];
