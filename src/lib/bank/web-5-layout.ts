import type { ChoiceStep, InputStep, L, Level, QuestionStep, Scene, Text } from "../types";
import { seeded, shuffle } from "../text";
import { poolBank } from "./pool";
import type { Pair, Rand, ShortQuestion, SkillBank, Statement } from "./types";

// Банк навыка web.layout (CSS: блоки, отступы, выравнивание, тема t13). Расчёты — кодом: ширина блока
// (width + padding + border [+ margin]), значения padding/margin из 2 и 4 чисел, box-sizing: border-box, обратная
// задача (найти width), приоритет style > id > класс > тег и наследование цвета (мини-«браузер» ниже), короткая запись #RGB.
// Знания (display, центрирование, схлопывание margin, наследование) — статичный пул.
// Тексты после переменных чисел — без падежных окончаний (в казахском окончание зависит от числа).
// Проверка: scripts/out/web-5-layout/verify.py (числа), verify.mjs (отображение в настоящем браузере).

const SKILL = "web.layout";

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const same = (s: string): L => ({ ru: s, kk: s });
const w = (ru: string, kk: string): L => ({ ru, kk });

// ---------- Общие данные ----------

interface Wrong {
  v: Text;
  why: L;
}

interface Head {
  id: string;
  level: Level;
  prompt: L;
  hint: L;
  explanation: L;
  scene?: Scene;
  reveal?: Scene;
}

/** Выбор из 4: верный + три разных неверных (с разбором ошибки), варианты перемешаны. */
function buildChoice(rand: Rand, head: Head, correct: Text, wrongs: Wrong[]): ChoiceStep {
  const key = (t: Text) => JSON.stringify(t);
  const seen = new Set<string>([key(correct)]);
  const picked: Wrong[] = [];
  for (const x of shuffle(wrongs, rand)) {
    if (picked.length >= 3) break;
    if (!seen.has(key(x.v))) {
      seen.add(key(x.v));
      picked.push(x);
    }
  }
  if (picked.length < 3) throw new Error(`web-5-layout ${head.id}: не хватает неверных вариантов`);
  const all = shuffle<{ v: Text; why: L | null }>([{ v: correct, why: null }, ...picked], rand);
  return {
    type: "choice",
    skill: SKILL,
    ...head,
    options: all.map((a) => a.v),
    correct: all.findIndex((a) => a.why === null),
    whyWrong: all.map((a) => a.why),
  };
}

function buildInput(head: Head, answers: string[], mode: "number" | "text"): InputStep {
  return { type: "input", skill: SKILL, ...head, answers, mode };
}

const codeCss = (lines: string[]): Scene => ({ kind: "code", lang: "css", lines });
const codeHtml = (lines: string[]): Scene => ({ kind: "code", lang: "html", lines });
const webScene = (html: string, css?: string, caption?: L): Scene => ({ kind: "web", html, css, caption });

// ---------- Подсказки ----------

const HINT_WIDTH: L = w(
  "Padding, border и margin есть и слева, и справа. Запиши, сколько каждый слой даёт по горизонтали, и сложи со `width`.",
  "Padding, border және margin сол жақта да, оң жақта да бар. Әр қабат көлденеңінен қанша беретінін жазып, `width` мәніне қос.",
);

// ---------- Короткая запись цвета #RGB ----------

const HEX = "0123456789ABCDEF";
const hexDigits = (rand: Rand): [string, string, string] => {
  const ds = shuffle(HEX.split(""), rand);
  return [ds[0], ds[1], ds[2]];
};
const expandHex = ([a, b, c]: [string, string, string]) => `#${a}${a}${b}${b}${c}${c}`;

const HINT_HEX: L = w(
  "Короткая запись повторяет каждую цифру: R, G и B превращаются в пары одинаковых цифр. Проверь каждый вариант по этому правилу.",
  "Қысқа жазба әр цифрды қайталайды: R, G және B бірдей цифрлар жұбына айналады. Әр нұсқаны осы ереже бойынша тексер.",
);

/** B: что означает запись #RGB. */
function hexExpand(rand: Rand, level: Level, seed: number): QuestionStep {
  const d = hexDigits(rand);
  const [a, b, c] = d;
  const full = expandHex(d);
  return buildChoice(
    rand,
    {
      id: `g:${SKILL}:hex:${a}${b}${c}:${seed}`,
      level,
      hint: HINT_HEX,
      prompt: w(`Чему равна короткая запись #${a}${b}${c}?`, `#${a}${b}${c} қысқа жазбасы неге тең?`),
      explanation: w(
        `Браузер повторяет каждую цифру: #${a}${b}${c} = **${full}** (R = ${a}${a}, G = ${b}${b}, B = ${c}${c}).`,
        `Браузер әр цифрды қайталайды: #${a}${b}${c} = **${full}** (R = ${a}${a}, G = ${b}${b}, B = ${c}${c}).`,
      ),
    },
    full,
    [
      { v: `#${a}${b}${c}000`, why: w("Нули дописаны в конец, а нужно повторить каждую цифру.", "Нөлдер соңына жазылған, ал әр цифрды қайталау керек.") },
      { v: `#000${a}${b}${c}`, why: w("Нули дописаны в начало, а нужно повторить каждую цифру.", "Нөлдер басына жазылған, ал әр цифрды қайталау керек.") },
      { v: `#${a}0${b}0${c}0`, why: w("После каждой цифры стоит ноль, а нужно повторить саму цифру.", "Әр цифрдан кейін нөл тұр, ал цифрдың өзін қайталау керек.") },
      { v: `#${a}${b}${c}${a}${b}${c}`, why: w("Повторена вся тройка целиком, а повторять нужно каждую цифру отдельно.", "Үштік тұтас қайталанған, ал әр цифрды бөлек қайталау керек.") },
    ],
  );
}

/** C: какой цвет нельзя записать коротко (одна из пар с разными цифрами). */
function hexNoShort(rand: Rand, level: Level, seed: number): QuestionStep {
  const wrongs: Wrong[] = [];
  const used = new Set<string>();
  while (wrongs.length < 4) {
    const code = expandHex(hexDigits(rand));
    if (used.has(code)) continue;
    used.add(code);
    wrongs.push({
      v: code,
      why: w(
        `В каждой паре цифры одинаковые, поэтому ${code} записывается коротко: #${code[1]}${code[3]}${code[5]}.`,
        `Әр жұпта цифрлар бірдей, сондықтан ${code} қысқаша жазылады: #${code[1]}${code[3]}${code[5]}.`,
      ),
    });
  }
  // Верный вариант: одна пара с разными цифрами.
  const d = hexDigits(rand);
  const pairs = [`${d[0]}${d[0]}`, `${d[1]}${d[1]}`, `${d[2]}${d[2]}`];
  const bad = int(rand, 0, 2);
  pairs[bad] = `${d[bad]}${HEX[(HEX.indexOf(d[bad]) + 1 + int(rand, 0, 13)) % 16]}`;
  if (pairs[bad][0] === pairs[bad][1]) pairs[bad] = `${d[bad]}${HEX[(HEX.indexOf(d[bad]) + 1) % 16]}`;
  const code = `#${pairs.join("")}`;
  return buildChoice(
    rand,
    {
      id: `g:${SKILL}:noshort:${code.slice(1)}:${seed}`,
      level,
      hint: w(
        "Разбей каждый код на пары RR, GG, BB. Коротко записывается тот, у которого в каждой паре цифры одинаковые.",
        "Әр кодты RR, GG, BB жұптарына бөл. Әр жұпта цифрлар бірдей болғандағы код қысқаша жазылады.",
      ),
      prompt: w("Какой из цветов нельзя записать в короткой форме #RGB?", "Мына түстердің қайсысын #RGB қысқа түрінде жазуға болмайды?"),
      explanation: w(
        `Коротко записывают только цвета, у которых в каждой паре цифры одинаковые. В ${code} пара ${pairs[bad]} состоит из разных цифр, поэтому сократить его нельзя.`,
        `Тек әр жұпта цифрлары бірдей түстерді ғана қысқаша жазады. ${code} кодында ${pairs[bad]} жұбы әртүрлі цифрлардан тұрады, сондықтан оны қысқартуға болмайды.`,
      ),
    },
    code,
    wrongs,
  );
}

// ---------- Блочная модель: расчёты ----------

const CSS_BOX = (lines: string[]): Scene => codeCss(["div {", ...lines.map((l) => `    ${l}`), "}"]);

/** A: ширина блока без margin (одно число на сторону). */
function widthA(rand: Rand, level: Level, seed: number): QuestionStep {
  const wd = pick(rand, [100, 120, 150, 180, 200, 240, 300]);
  const p = pick(rand, [5, 8, 10, 12, 15, 20]);
  const b = pick(rand, [1, 2, 3, 4, 5]);
  const total = wd + 2 * p + 2 * b;
  const head: Head = {
    id: `g:${SKILL}:wa:${wd}x${p}x${b}:${seed}`,
    level,
    hint: HINT_WIDTH,
    prompt: w(
      "Чему равна ширина блока в пикселях — вместе с padding и border, без margin? (width — ширина содержимого)",
      "Блоктың ені неше пиксель — padding пен border-ді қоса, margin-сіз? (width — мазмұнның ені)",
    ),
    scene: CSS_BOX([`width: ${wd}px;`, `padding: ${p}px;`, `border: ${b}px solid red;`]),
    explanation: w(
      `Padding и border есть и слева, и справа: ${wd} + 2 · ${p} + 2 · ${b} = ${wd} + ${2 * p} + ${2 * b} = **${total}** px.`,
      `Padding пен border сол жақта да, оң жақта да бар: ${wd} + 2 · ${p} + 2 · ${b} = ${wd} + ${2 * p} + ${2 * b} = **${total}** px.`,
    ),
  };
  if (rand() < 0.4) return buildInput(head, [String(total)], "number");
  return buildChoice(rand, head, String(total), [
    { v: String(wd + p + b), why: w("Учтена только одна сторона каждого слоя, а padding и border есть и слева, и справа.", "Әр қабаттың тек бір жағы есепке алынған, ал padding пен border сол жақта да, оң жақта да бар.") },
    { v: String(wd), why: w("Это только ширина содержимого: padding и border добавляются к ней.", "Бұл тек мазмұнның ені: оған padding пен border қосылады.") },
    { v: String(wd + 2 * p), why: w("Забыта рамка: border тоже занимает место слева и справа.", "Жиек ұмытылған: border де сол жақта және оң жақта орын алады.") },
    { v: String(wd + 2 * b), why: w("Забыт внутренний отступ: padding тоже добавляется с двух сторон.", "Ішкі шегініс ұмытылған: padding те екі жағынан қосылады.") },
    { v: String(total + p + b), why: w("Лишние слои: считаются только ширина содержимого и padding и border с двух сторон.", "Артық қабаттар: тек мазмұн ені және екі жақтағы padding пен border есептеледі.") },
  ]);
}

/** B: padding из двух значений — по горизонтали работает второе число. */
function widthShort(rand: Rand, level: Level, seed: number): QuestionStep {
  const wd = pick(rand, [100, 120, 150, 200, 240, 300]);
  const v = pick(rand, [4, 6, 8, 10, 12]);
  const h = pick(rand, [15, 18, 20, 24, 25, 30]);
  const b = pick(rand, [1, 2, 3, 4, 5]);
  const total = wd + 2 * h + 2 * b;
  return buildChoice(
    rand,
    {
      id: `g:${SKILL}:ws:${wd}x${v}x${h}x${b}:${seed}`,
      level,
      hint: w(
        "В записи из двух значений первое число — для верха и низа, второе — для левой и правой сторон. Для ширины нужны левая и правая.",
        "Екі мәнді жазбада бірінші сан — жоғарғы және төменгі жақтарға, екіншісі — сол және оң жақтарға. Ен үшін сол және оң жақ керек.",
      ),
      prompt: w(
        "Чему равна ширина блока в пикселях (без margin)? Обрати внимание на значения padding",
        "Блоктың ені неше пиксель (margin-сіз)? padding мәндеріне назар аудар",
      ),
      scene: CSS_BOX([`width: ${wd}px;`, `padding: ${v}px ${h}px;`, `border: ${b}px solid red;`]),
      explanation: w(
        `У \`padding: ${v}px ${h}px\` первое число — верх и низ, второе — лево и право. По горизонтали работает ${h}: ${wd} + 2 · ${h} + 2 · ${b} = **${total}** px.`,
        `\`padding: ${v}px ${h}px\` жазбасында бірінші сан — жоғары және төмен, екіншісі — сол және оң жақ. Көлденеңінен ${h} жұмыс істейді: ${wd} + 2 · ${h} + 2 · ${b} = **${total}** px.`,
      ),
    },
    String(total),
    [
      { v: String(wd + 2 * v + 2 * b), why: w("Взято первое число (верх и низ), а по горизонтали работает второе.", "Бірінші сан (жоғары және төмен) алынған, ал көлденеңінен екіншісі жұмыс істейді.") },
      { v: String(wd + v + h + 2 * b), why: w("Оба числа сложены по одному разу, а лево и право — это два одинаковых отступа по второму числу.", "Екі сан да бір реттен қосылған, ал сол және оң жақ — екінші санмен екі бірдей шегініс.") },
      { v: String(wd + 2 * h), why: w("Забыта рамка: border тоже занимает место слева и справа.", "Жиек ұмытылған: border де сол жақта және оң жақта орын алады.") },
      { v: String(wd + h + b), why: w("Учтена одна сторона каждого слоя вместо двух.", "Әр қабаттың екі жағының орнына бір жағы ғана есепке алынған.") },
      { v: String(wd), why: w("Это только ширина содержимого: padding и border добавляются к ней.", "Бұл тек мазмұнның ені: оған padding пен border қосылады.") },
    ],
  );
}

/** C: место на странице при margin из четырёх значений (по горизонтали — правое и левое). */
function space4(rand: Rand, level: Level, seed: number): QuestionStep {
  const wd = pick(rand, [100, 120, 150, 200]);
  const p = pick(rand, [5, 10, 15]);
  const b = pick(rand, [1, 2, 3]);
  const vals = shuffle([5, 10, 15, 20, 25, 30, 40], rand).slice(0, 4);
  const [t, r, bt, l] = vals;
  const block = wd + 2 * p + 2 * b;
  const total = block + r + l;
  return buildChoice(
    rand,
    {
      id: `g:${SKILL}:sp:${wd}x${p}x${b}x${vals.join("-")}:${seed}`,
      level,
      hint: w(
        "Четыре значения margin идут по часовой стрелке: сверху, справа, снизу, слева. По горизонтали участвуют только правое и левое.",
        "margin-нің төрт мәні сағат тілі бойымен жүреді: жоғарыдан, оңнан, төменнен, солдан. Көлденеңінен тек оң және сол жақ қатысады.",
      ),
      prompt: w(
        "Сколько пикселей по горизонтали занимает блок на странице вместе с внешними отступами?",
        "Блок бетте сыртқы шегіністерімен бірге көлденеңінен неше пиксель орын алады?",
      ),
      scene: CSS_BOX([`width: ${wd}px;`, `padding: ${p}px;`, `border: ${b}px solid red;`, `margin: ${t}px ${r}px ${bt}px ${l}px;`]),
      explanation: w(
        `Блок: ${wd} + 2 · ${p} + 2 · ${b} = ${block}. Из \`margin: ${t}px ${r}px ${bt}px ${l}px\` по горизонтали берём правое (${r}) и левое (${l}): ${block} + ${r} + ${l} = **${total}** px.`,
        `Блок: ${wd} + 2 · ${p} + 2 · ${b} = ${block}. \`margin: ${t}px ${r}px ${bt}px ${l}px\` жазбасынан көлденеңінен оң (${r}) және сол (${l}) мәндерін аламыз: ${block} + ${r} + ${l} = **${total}** px.`,
      ),
    },
    String(total),
    [
      { v: String(block), why: w("Это ширина блока без внешних отступов: нужно добавить правый и левый margin.", "Бұл сыртқы шегіністерсіз блок ені: оң және сол margin қосу керек.") },
      { v: String(block + t + bt), why: w("Взяты верхний и нижний margin, а по горизонтали работают правый и левый.", "Жоғарғы және төменгі margin алынған, ал көлденеңінен оң және сол жұмыс істейді.") },
      { v: String(block + t + r + bt + l), why: w("Сложены все четыре значения, а по горизонтали участвуют только два.", "Төрт мәннің бәрі қосылған, ал көлденеңінен тек екеуі қатысады.") },
      { v: String(block + 2 * r), why: w("Правое значение удвоено, но левое margin другое: нужно сложить правое и левое.", "Оң мән екі еселенген, бірақ сол margin басқа: оң және сол мәндерді қосу керек.") },
      { v: String(block + 2 * l), why: w("Левое значение удвоено, но правое margin другое: нужно сложить правое и левое.", "Сол мән екі еселенген, бірақ оң margin басқа: оң және сол мәндерді қосу керек.") },
    ],
  );
}

/** C: box-sizing: border-box — ширина содержимого или место с margin. */
function borderBox(rand: Rand, level: Level, seed: number): QuestionStep {
  const p = pick(rand, [10, 15, 20, 25]);
  const b = pick(rand, [2, 3, 5]);
  const m = pick(rand, [5, 10, 15, 20]);
  const wd = pick(rand, [200, 240, 300, 360, 400]);
  const lines = ["box-sizing: border-box;", `width: ${wd}px;`, `padding: ${p}px;`, `border: ${b}px solid red;`, `margin: ${m}px;`];
  const content = wd - 2 * p - 2 * b;
  const space = wd + 2 * m;
  if (rand() < 0.5) {
    return buildChoice(
      rand,
      {
        id: `g:${SKILL}:bbc:${wd}x${p}x${b}:${seed}`,
        level,
        hint: w(
          "При `border-box` число `width` — это весь блок: в него уже входят padding и border. Вычти их с обеих сторон.",
          "`border-box` кезінде `width` саны — бүкіл блок: оған padding пен border кіреді. Оларды екі жағынан алып тас.",
        ),
        prompt: w("У блока `box-sizing: border-box`. Чему равна ширина содержимого в пикселях?", "Блокта `box-sizing: border-box` бар. Мазмұнның ені неше пиксель?"),
        scene: CSS_BOX(lines),
        explanation: w(
          `С \`border-box\` \`width\` — ширина всего блока. Содержимому остаётся ${wd} − 2 · ${p} − 2 · ${b} = **${content}** px.`,
          `\`border-box\` кезінде \`width\` — бүкіл блоктың ені. Мазмұнға ${wd} − 2 · ${p} − 2 · ${b} = **${content}** px қалады.`,
        ),
      },
      String(content),
      [
        { v: String(wd), why: w("Это ширина всего блока, а спрашивают про содержимое: из неё нужно вычесть padding и border.", "Бұл бүкіл блоктың ені, ал мазмұн туралы сұралған: одан padding пен border алып тастау керек.") },
        { v: String(wd + 2 * p + 2 * b), why: w("Так считают без `border-box`: здесь padding и border уже входят в width.", "Мұндай `border-box` болмағанда есептейді: мұнда padding пен border width мәніне кіреді.") },
        { v: String(wd - 2 * p), why: w("Забыта рамка: border тоже входит в width и вычитается с двух сторон.", "Жиек ұмытылған: border да width мәніне кіреді және екі жағынан алынады.") },
        { v: String(wd - p - b), why: w("Вычтена одна сторона, а padding и border есть и слева, и справа.", "Бір жағы алынған, ал padding пен border сол жақта да, оң жақта да бар.") },
        { v: String(wd - 2 * b), why: w("Забыт padding: он тоже входит в width и вычитается с двух сторон.", "padding ұмытылған: ол да width мәніне кіреді және екі жағынан алынады.") },
      ],
    );
  }
  return buildChoice(
    rand,
    {
      id: `g:${SKILL}:bbs:${wd}x${p}x${b}x${m}:${seed}`,
      level,
      hint: w(
        "При `border-box` блок занимает ровно `width`. К нему остаётся добавить только margin с двух сторон.",
        "`border-box` кезінде блок тура `width` орын алады. Оған тек екі жақтағы margin қосу қалады.",
      ),
      prompt: w(
        "У блока `box-sizing: border-box`. Сколько пикселей по горизонтали он занимает на странице вместе с margin?",
        "Блокта `box-sizing: border-box` бар. Ол бетте margin-мен бірге көлденеңінен неше пиксель орын алады?",
      ),
      scene: CSS_BOX(lines),
      explanation: w(
        `С \`border-box\` блок равен \`width\` = ${wd} px, padding и border уже внутри. Добавляем margin с двух сторон: ${wd} + 2 · ${m} = **${space}** px.`,
        `\`border-box\` кезінде блок \`width\` = ${wd} px-ге тең, padding пен border ішінде. Екі жақтағы margin қосамыз: ${wd} + 2 · ${m} = **${space}** px.`,
      ),
    },
    String(space),
    [
      { v: String(wd + 2 * p + 2 * b + 2 * m), why: w("Так считают без `border-box`: здесь padding и border уже входят в width.", "Мұндай `border-box` болмағанда есептейді: мұнда padding пен border width мәніне кіреді.") },
      { v: String(wd), why: w("Это ширина самого блока: margin с двух сторон ещё нужно добавить.", "Бұл блоктың өз ені: екі жақтағы margin әлі қосылуы керек.") },
      { v: String(wd + m), why: w("Учтена одна сторона margin, а он есть и слева, и справа.", "margin-нің бір жағы ғана есепке алынған, ал ол сол жақта да, оң жақта да бар.") },
      { v: String(wd + 2 * p + 2 * b), why: w("Padding и border прибавлены зря (они уже внутри width), а margin забыт.", "Padding пен border бекер қосылған (олар width ішінде), ал margin ұмытылған.") },
      { v: String(wd - 2 * p - 2 * b + 2 * m), why: w("Padding и border вычтены зря: при `border-box` блок остаётся равным width.", "Padding пен border бекер алынған: `border-box` кезінде блок width-ке тең болып қалады.") },
    ],
  );
}

/** C: обратная задача — найти width по полному месту на странице. */
function reverseWidth(rand: Rand, level: Level, seed: number): QuestionStep {
  const wd = pick(rand, [100, 120, 150, 180, 200, 230, 250]);
  const p = pick(rand, [5, 10, 15, 20]);
  const b = pick(rand, [1, 2, 3, 5]);
  const m = pick(rand, [5, 10, 15, 20]);
  const total = wd + 2 * (p + b + m);
  const head: Head = {
    id: `g:${SKILL}:rev:${wd}x${p}x${b}x${m}:${seed}`,
    level,
    hint: w(
      "Задача обратная: сложи всё, что даёт одна сторона (padding, border, margin), удвой и вычти из общего числа.",
      "Бұл кері есеп: бір жақтың беретінін (padding, border, margin) қос, екі еселе де, жалпы саннан алып таста.",
    ),
    prompt: w(
      `Блок вместе с внешними отступами занимает по горизонтали ровно ${total} px. Чему равна width в пикселях?`,
      `Блок сыртқы шегіністерімен бірге көлденеңінен тура ${total} px орын алады. width неше пиксель?`,
    ),
    scene: CSS_BOX(["width: ...px;", `padding: ${p}px;`, `border: ${b}px solid red;`, `margin: ${m}px;`]),
    explanation: w(
      `Каждая сторона добавляет ${p} + ${b} + ${m} = ${p + b + m} px, обе — ${2 * (p + b + m)} px. Значит, width = ${total} − ${2 * (p + b + m)} = **${wd}** px.`,
      `Әр жақ ${p} + ${b} + ${m} = ${p + b + m} px қосады, екі жақ — ${2 * (p + b + m)} px. Демек, width = ${total} − ${2 * (p + b + m)} = **${wd}** px.`,
    ),
  };
  if (rand() < 0.5) return buildInput(head, [String(wd)], "number");
  return buildChoice(rand, head, String(wd), [
    { v: String(total - (p + b + m)), why: w("Вычтена только одна сторона, а padding, border и margin есть и слева, и справа.", "Тек бір жағы алынған, ал padding, border және margin сол жақта да, оң жақта да бар.") },
    { v: String(total - 2 * (p + b)), why: w("Забыт внешний отступ: margin тоже входит в занимаемое место.", "Сыртқы шегініс ұмытылған: margin де алатын орынға кіреді.") },
    { v: String(total - 2 * (p + m)), why: w("Забыта рамка: border тоже входит в занимаемое место.", "Жиек ұмытылған: border де алатын орынға кіреді.") },
    { v: String(total - 2 * (b + m)), why: w("Забыт padding: он тоже входит в занимаемое место.", "padding ұмытылған: ол да алатын орынға кіреді.") },
    { v: String(total + 2 * (p + b + m)), why: w("Отступы и рамка прибавлены вместо того, чтобы вычесть: width — это то, что остаётся.", "Шегіністер мен жиек алудың орнына қосылған: width — қалатын мән.") },
  ]);
}

// ---------- Мини-«браузер»: цвет по правилам CSS ----------

interface ColorDef {
  key: string;
  ru: string;
  kk: string;
}

const PALETTE: ColorDef[] = [
  { key: "red", ru: "красный", kk: "қызыл" },
  { key: "blue", ru: "синий", kk: "көк" },
  { key: "green", ru: "зелёный", kk: "жасыл" },
  { key: "orange", ru: "оранжевый", kk: "қызғылт сары" },
  { key: "purple", ru: "фиолетовый", kk: "күлгін" },
];
const BLACK: ColorDef = { key: "black", ru: "чёрный", kk: "қара" };
const colorL = (key: string): L => {
  const c = [...PALETTE, BLACK].find((x) => x.key === key)!;
  return w(c.ru, c.kk);
};

interface Rule {
  sel: string;
  color: string;
  kind: "t" | "c" | "i" | "n";
  matches: boolean;
}

/** Сила селектора: style (4) > id (3) > класс (2) > тег (1). */
const strength = (kind: Rule["kind"]) => (kind === "i" ? 3 : kind === "c" ? 2 : 1);

/** Побеждает самое сильное подходящее правило; при равенстве — записанное ниже. */
export function winnerRule(rules: Rule[]): Rule {
  let best: Rule | undefined;
  for (const r of rules) {
    if (!r.matches) continue;
    if (!best || strength(r.kind) >= strength(best.kind)) best = r;
  }
  if (!best) throw new Error("нет подходящего правила");
  return best;
}

/** B/C: цвет абзаца при правилах для тега, класса, id и (иногда) атрибуте style. */
function priority(rand: Rand, level: Level, seed: number): QuestionStep {
  const cls = pick(rand, ["note", "big", "menu"] as const);
  const idName = pick(rand, ["main", "title", "top"] as const);
  const colors = shuffle(PALETTE, rand);
  let ci = 0;
  const mk = (kind: Rule["kind"]): Rule => {
    const sel = kind === "t" ? "p" : kind === "c" ? `.${cls}` : kind === "i" ? `#${idName}` : pick(rand, ["h1", ".other", "#extra"]);
    return { sel, kind, matches: kind !== "n", color: colors[ci++ % colors.length].key };
  };
  let kinds: Rule["kind"][];
  if (level === 2) {
    kinds = pick(rand, [["t", "c"], ["c", "i"], ["t", "i"], ["t", "c", "i"]] as Rule["kind"][][]);
    if (rand() < 0.2) kinds = [...kinds, "n"];
  } else {
    kinds = pick(rand, [["t", "c", "i", "n"], ["t", "t", "c"], ["c", "c", "t"], ["i", "c", "c"], ["t", "c", "i"]] as Rule["kind"][][]);
  }
  const rules = shuffle(kinds, rand).map(mk);
  const useInline = level === 3 ? rand() < 0.55 : rand() < 0.4;
  const inlineColor = useInline ? colors[ci++ % colors.length].key : null;
  const hasClass = rules.some((r) => r.kind === "c");
  const hasId = rules.some((r) => r.kind === "i");
  const win = inlineColor ? null : winnerRule(rules);
  const winKey = inlineColor ?? win!.color;
  const element = `<p${hasClass ? ` class="${cls}"` : ""}${hasId ? ` id="${idName}"` : ""}${inlineColor ? ` style="color: ${inlineColor}"` : ""}>Hello</p>`;
  const css = rules.flatMap((r) => [`${r.sel} {`, `    color: ${r.color};`, "}"]).join("\n");
  const wrongs: Wrong[] = [...PALETTE, BLACK]
    .filter((c) => c.key !== winKey)
    .map((c) => {
      const rule = rules.find((r) => r.color === c.key);
      let why: L;
      if (c.key === "black") why = w("Чёрный — цвет по умолчанию, но здесь цвет задан правилами, и одно из них применяется.", "Қара — әдепкі түс, бірақ мұнда түс ережелермен берілген және солардың бірі қолданылады.");
      else if (!rule) why = w("Правила с таким цветом в коде нет.", "Кодта мұндай түсті ереже жоқ.");
      else if (!rule.matches) why = w(`Правило ${rule.sel} к этому элементу не относится.`, `${rule.sel} ережесі бұл элементке қатысты емес.`);
      else if (inlineColor) why = w(`Правило ${rule.sel} подходит, но атрибут style в теге сильнее: style > id > класс > тег.`, `${rule.sel} ережесі сәйкес келеді, бірақ тегтегі style атрибуты күштірек: style > id > класс > тег.`);
      else if (strength(rule.kind) < strength(win!.kind)) why = w(`Правило ${rule.sel} подходит, но его селектор слабее: id > класс > тег.`, `${rule.sel} ережесі сәйкес келеді, бірақ оның селекторы әлсіз: id > класс > тег.`);
      else why = w(`Правила ${rule.sel} и ${win!.sel} равны по приоритету, а побеждает то, что записано ниже.`, `${rule.sel} және ${win!.sel} ережелерінің басымдығы тең, ал төменірек жазылғаны жеңеді.`);
      return { v: colorL(c.key), why };
    });
  const sameStrength = !inlineColor && rules.filter((r) => r.matches && strength(r.kind) === strength(win!.kind)).length > 1;
  const wl = colorL(winKey);
  const sig = rules.map((r) => r.kind + r.color[0]).join("") + (inlineColor ? `s${inlineColor[0]}` : "");
  return buildChoice(
    rand,
    {
      id: `g:${SKILL}:prio:${sig}:${seed}`,
      level,
      hint: w(
        "Сначала вычеркни правила, которые к этому элементу не относятся. Среди остальных сравни: style в теге > id > класс > тег.",
        "Алдымен бұл элементке қатысы жоқ ережелерді сызып таста. Қалғандарын салыстыр: тегтегі style > id > класс > тег.",
      ),
      prompt: w("Какого цвета будет текст абзаца?", "Абзац мәтіні қандай түсті болады?"),
      scene: codeHtml(["<style>", ...rules.map((r) => `    ${r.sel} { color: ${r.color}; }`), "</style>", element]),
      reveal: webScene(element, css),
      explanation: w(
        inlineColor
          ? `Атрибут \`style\` в самом теге сильнее любых правил из \`<style>\`. Цвет: **${wl.ru}**.`
          : sameStrength
            ? `Подходящих правил несколько, самые сильные из них равны по приоритету (${win!.sel}), поэтому побеждает записанное ниже. Цвет: **${wl.ru}**.`
            : `Из подходящих правил самый приоритетный селектор — ${win!.sel} (id > класс > тег), порядок записи не важен. Цвет: **${wl.ru}**.`,
        inlineColor
          ? `Тегтің өзіндегі \`style\` атрибуты \`<style>\` ішіндегі кез келген ережеден күшті. Түсі: **${wl.kk}**.`
          : sameStrength
            ? `Сәйкес келетін ережелер бірнеше, олардың ең күштілерінің басымдығы тең (${win!.sel}), сондықтан төменірек жазылғаны жеңеді. Түсі: **${wl.kk}**.`
            : `Сәйкес келетін ережелердің ішінде селекторы ең басымы — ${win!.sel} (id > класс > тег), жазылу реті маңызды емес. Түсі: **${wl.kk}**.`,
      ),
    },
    wl,
    wrongs,
  );
}

interface InhEl {
  tag: string;
  cls?: "a" | "b";
}

/** C: цвет вложенного элемента — собственное правило или наследование от родителя. */
function inherit(rand: Rand, level: Level, seed: number): QuestionStep {
  const childTag = pick(rand, ["p", "span"] as const);
  const parent: InhEl = { tag: "div", cls: rand() < 0.6 ? "a" : undefined };
  const child: InhEl = { tag: childTag, cls: pick(rand, [undefined, "a", "b"] as const) };
  const sels = shuffle(["div", childTag, ".a", ".b"], rand).slice(0, int(rand, 2, 3));
  const colors = shuffle(PALETTE, rand);
  const rules = sels.map((sel, i) => ({ sel, color: colors[i].key }));
  const match = (el: InhEl, sel: string) => (sel.startsWith(".") ? el.cls === sel.slice(1) : el.tag === sel);
  const str = (sel: string) => (sel.startsWith(".") ? 2 : 1);
  const own = (el: InhEl) => {
    let best: { sel: string; color: string } | undefined;
    for (const r of rules) if (match(el, r.sel) && (!best || str(r.sel) >= str(best.sel))) best = r;
    return best;
  };
  const parentOwn = own(parent);
  const parentColor = parentOwn?.color ?? "black";
  const childOwn = own(child);
  const answer = childOwn?.color ?? parentColor;
  const html = [
    `<div${parent.cls ? ` class="${parent.cls}"` : ""}>`,
    `    <${childTag}${child.cls ? ` class="${child.cls}"` : ""}>Hello</${childTag}>`,
    "</div>",
  ];
  const style = rules.map((r) => `    ${r.sel} { color: ${r.color}; }`);
  const css = rules.flatMap((r) => [`${r.sel} {`, `    color: ${r.color};`, "}"]).join("\n");
  const answerL = colorL(answer);
  const why = (ru: string, kk: string) => w(ru, kk);
  const explainRu = childOwn
    ? `К слову Hello подходит своё правило ${childOwn.sel}: оно сильнее унаследованного значения. Цвет: **${answerL.ru}**.`
    : parentOwn
      ? `Для самого Hello правил нет, он наследует цвет родителя. У родителя побеждает ${parentOwn.sel}. Цвет: **${answerL.ru}**.`
      : `Ни для Hello, ни для родителя подходящих правил нет, остаётся цвет по умолчанию. Цвет: **${answerL.ru}**.`;
  const explainKk = childOwn
    ? `Hello сөзіне өзінің ${childOwn.sel} ережесі сәйкес келеді: ол мұраланған мәннен күшті. Түсі: **${answerL.kk}**.`
    : parentOwn
      ? `Hello үшін жеке ереже жоқ, ол ата-ана түсін мұралайды. Ата-ана үшін ${parentOwn.sel} жеңеді. Түсі: **${answerL.kk}**.`
      : `Hello үшін де, ата-ана үшін де сәйкес ереже жоқ, әдепкі түс қалады. Түсі: **${answerL.kk}**.`;
  const wrongs: Wrong[] = [...PALETTE, BLACK]
    .filter((c) => c.key !== answer)
    .map((c) => {
      const rule = rules.find((r) => r.color === c.key);
      let reason: L;
      if (c.key === "black") reason = why("Чёрный — цвет по умолчанию, но здесь цвет приходит из правил или от родителя.", "Қара — әдепкі түс, бірақ мұнда түс ережелерден немесе ата-анадан келеді.");
      else if (!rule) reason = why("Правила с таким цветом в коде нет.", "Кодта мұндай түсті ереже жоқ.");
      else if (match(child, rule.sel)) reason = why(`Правило ${rule.sel} подходит, но у слова есть более сильное правило, и побеждает оно.`, `${rule.sel} ережесі сәйкес келеді, бірақ сөздің күштірек ережесі бар, ол жеңеді.`);
      else if (match(parent, rule.sel)) reason = why(`Правило ${rule.sel} относится к родителю, но у самого слова есть своё правило или оно слабее другого правила родителя.`, `${rule.sel} ережесі ата-анаға қатысты, бірақ сөздің өз ережесі бар немесе ол ата-ананың басқа ережесінен әлсіз.`);
      else reason = why(`Правило ${rule.sel} не относится ни к слову, ни к родителю.`, `${rule.sel} ережесі сөзге де, ата-анаға да қатысты емес.`);
      return { v: colorL(c.key), why: reason };
    });
  return buildChoice(
    rand,
    {
      id: `g:${SKILL}:inh:${rules.map((r) => r.sel + r.color[0]).join("")}${parent.cls ?? "_"}${child.cls ?? "_"}:${seed}`,
      level,
      hint: w(
        "Начни с вложенного слова: есть ли для него своё правило? Если нет, возьми цвет родителя: сравни правила для `div` (тег или класс).",
        "Ішкі сөзден баста: оған жеке ереже бар ма? Жоқ болса, ата-ана түсін ал: `div` үшін ережелерді (тег пен класс) салыстыр.",
      ),
      prompt: w("Какого цвета будет слово Hello?", "Hello сөзі қандай түсті болады?"),
      scene: codeHtml(["<style>", ...style, "</style>", ...html]),
      reveal: webScene(html.join("\n"), css),
      explanation: w(explainRu, explainKk),
    },
    answerL,
    wrongs,
  );
}

// ---------- Статичный пул: знания ----------

function mc(id: string, level: Level, prompt: L, correct: Text, wrongs: [Text, L][], hint: L, explanation: L, scene?: Scene): ChoiceStep {
  if (wrongs.length !== 3) throw new Error(`web-5-layout ${id}: нужно ровно 3 неверных варианта`);
  return {
    type: "choice",
    id: `p:${SKILL}:${id}`,
    skill: SKILL,
    level,
    prompt,
    scene,
    hint,
    options: [correct, ...wrongs.map((x) => x[0])],
    correct: 0,
    whyWrong: [null, ...wrongs.map((x) => x[1])],
    explanation,
  };
}

function inp(id: string, level: Level, prompt: L, answer: string, mode: "number" | "text", hint: L, explanation: L, scene?: Scene): InputStep {
  return { type: "input", id: `p:${SKILL}:${id}`, skill: SKILL, level, prompt, scene, hint, answers: [answer], mode, explanation };
}

const POOL: QuestionStep[] = [
  // ----- A -----
  mc(
    "layer-inner",
    1,
    w("Какой слой блока находится между содержимым и рамкой?", "Блоктың қай қабаты мазмұн мен жиектің арасында орналасқан?"),
    "padding",
    [
      ["margin", w("`margin` — это внешний отступ: он находится снаружи рамки.", "`margin` — сыртқы шегініс: ол жиектің сыртында орналасқан.")],
      ["width", w("`width` — не слой, а ширина содержимого.", "`width` — қабат емес, мазмұнның ені.")],
      ["display", w("`display` — не слой, а вид элемента: блок или строка.", "`display` — қабат емес, элементтің түрі: блок немесе жол.")],
    ],
    w("Вспомни картину в музее: что лежит между самой картиной и рамой?", "Мұражайдағы суретті еске түсір: сурет пен раманың арасында не бар?"),
    w("Изнутри наружу: содержимое → padding → border → margin. Между содержимым и рамкой — внутренний отступ `padding`.", "Ішкіден сыртқа: мазмұн → padding → border → margin. Мазмұн мен жиектің арасында — ішкі шегініс `padding`."),
  ),
  mc(
    "margin-outside",
    1,
    w("Какое свойство задаёт свободное место между рамкой блока и соседними блоками?", "Қай қасиет блок жиегі мен көрші блоктардың арасындағы бос орынды береді?"),
    "margin",
    [
      ["padding", w("`padding` — внутренний отступ: он между содержимым и рамкой.", "`padding` — ішкі шегініс: ол мазмұн мен жиектің арасында.")],
      ["border", w("`border` — сама рамка, а не расстояние до соседей.", "`border` — жиектің өзі, көршілерге дейінгі қашықтық емес.")],
      ["width", w("`width` — ширина содержимого.", "`width` — мазмұнның ені.")],
    ],
    w("Расстояние между соседними картинами на стене — это место снаружи рамы.", "Қабырғадағы көрші суреттердің арақашықтығы — рама сыртындағы орын."),
    w("`margin` — внешний отступ: расстояние от рамки блока до соседей.", "`margin` — сыртқы шегініс: блок жиегінен көршілерге дейінгі қашықтық."),
  ),
  mc(
    "width-default",
    1,
    w("Что по умолчанию задаёт свойство `width`?", "`width` қасиеті әдепкі бойынша нені береді?"),
    w("ширину содержимого блока", "блок мазмұнының енін"),
    [
      [w("ширину блока вместе с padding и border", "padding пен border-ді қоса блок енін"), w("Так было бы с `box-sizing: border-box`, а по умолчанию padding и border добавляются к `width`.", "Бұл `box-sizing: border-box` кезінде болар еді, ал әдепкі бойынша padding пен border `width` мәніне қосылады.")],
      [w("толщину рамки", "жиектің қалыңдығын"), w("Толщину рамки задаёт `border`.", "Жиектің қалыңдығын `border` береді.")],
      [w("ширину всей страницы", "бүкіл беттің енін"), w("`width` относится к одному элементу, а не ко всей странице.", "`width` бүкіл бетке емес, бір элементке қатысты.")],
    ],
    w("Вспомни формулу ширины блока: к чему добавляются padding и border?", "Блок ені формуласын еске түсір: padding пен border неге қосылады?"),
    w("По умолчанию `width` — ширина **содержимого**. Видимая ширина блока: width + 2 · padding + 2 · border.", "Әдепкі бойынша `width` — **мазмұнның** ені. Блоктың көрінетін ені: width + 2 · padding + 2 · border."),
  ),
  mc(
    "block-tag",
    1,
    w("Какой элемент по умолчанию блочный?", "Қай элемент әдепкі бойынша блоктық?"),
    "<div>",
    [
      ["<span>", w("`span` — строчный элемент: он стоит в строке, как слово.", "`span` — жолішілік элемент: ол жолда сөз сияқты тұрады.")],
      ["<b>", w("`b` — строчный элемент: просто делает текст жирным внутри строки.", "`b` — жолішілік элемент: жол ішінде мәтінді жуан етеді.")],
      ["<a>", w("`a` (ссылка) — строчный элемент.", "`a` (сілтеме) — жолішілік элемент.")],
    ],
    w("Блочный элемент — как абзац: начинается с новой строки.", "Блоктық элемент абзац сияқты: жаңа жолдан басталады."),
    w("`div`, `p`, `h1`–`h6`, `ul`, `form` — блочные: с новой строки и на всю ширину. `span`, `a`, `b`, `i` — строчные.", "`div`, `p`, `h1`–`h6`, `ul`, `form` — блоктық: жаңа жолдан және бүкіл енімен. `span`, `a`, `b`, `i` — жолішілік."),
  ),
  mc(
    "inline-tag",
    1,
    w("Какой элемент по умолчанию строчный (inline)?", "Қай элемент әдепкі бойынша жолішілік (inline)?"),
    "<span>",
    [
      ["<div>", w("`div` — блочный элемент: он начинается с новой строки.", "`div` — блоктық элемент: ол жаңа жолдан басталады.")],
      ["<p>", w("`p` (абзац) — блочный элемент.", "`p` (абзац) — блоктық элемент.")],
      ["<h1>", w("`h1` (заголовок) — блочный элемент.", "`h1` (тақырып) — блоктық элемент.")],
    ],
    w("Строчный элемент стоит в строке, как слово среди слов.", "Жолішілік элемент жолда сөздердің арасындағы сөз сияқты тұрады."),
    w("`span` — строчный: он не начинается с новой строки и не занимает всю ширину.", "`span` — жолішілік: ол жаңа жолдан басталмайды және бүкіл енді алмайды."),
  ),
  mc(
    "text-center",
    1,
    w("Как выровнять текст внутри блока по центру?", "Блок ішіндегі мәтінді ортаға қалай туралауға болады?"),
    "text-align: center;",
    [
      ["margin: 0 auto;", w("Так по центру ставят сам блок (при заданной `width`), а не текст внутри него.", "Бұлай блоктың өзін ортаға қояды (`width` берілгенде), ішіндегі мәтінді емес.")],
      ["display: center;", w("У `display` нет значения `center`: оно задаёт вид элемента (block, inline, none…).", "`display` қасиетінде `center` мәні жоқ: ол элемент түрін (block, inline, none…) береді.")],
      ["align: center;", w("Свойство называется `text-align`, а не `align`.", "Қасиеттің аты `text-align`, `align` емес.")],
    ],
    w("Выравнивание текста — по-английски text align.", "Мәтінді туралау — ағылшынша text align."),
    w("Текст внутри блока по центру ставит `text-align: center`.", "Блок ішіндегі мәтінді ортаға `text-align: center` қояды."),
  ),
  mc(
    "display-none",
    1,
    w("Какая запись убирает элемент со страницы вместе с его местом?", "Қай жазба элементті беттен орнымен бірге алып тастайды?"),
    "display: none;",
    [
      ["visibility: hidden;", w("Он прячет элемент, но пустое место остаётся.", "Ол элементті жасырады, бірақ бос орын қалады.")],
      ["display: hidden;", w("У `display` нет значения `hidden`: правильное значение — `none`.", "`display` қасиетінде `hidden` мәні жоқ: дұрыс мән — `none`.")],
      ["display: block;", w("`block` делает элемент блоком, а не убирает его.", "`block` элементті блок етеді, алып тастамайды.")],
    ],
    w("«None» по-английски — «ничего». Что остаётся от элемента, если у него display: ничего?", "«None» ағылшынша — «ештеңе». Элементтің display мәні «ештеңе» болса, одан не қалады?"),
    w("`display: none` убирает элемент полностью: его не видно, и места он не занимает.", "`display: none` элементті толық алып тастайды: ол көрінбейді және орын алмайды."),
  ),
  mc(
    "hex-short-red",
    1,
    w("Как коротко записать цвет #FF0000?", "#FF0000 түсін қалай қысқаша жазуға болады?"),
    "#F00",
    [
      ["#FF0", w("Это `#FFFF00` — жёлтый: цифры пар повторяются, и получается три пары.", "Бұл `#FFFF00` — сары: жұптардағы цифрлар қайталанады, үш жұп шығады.")],
      ["#F0", w("Нужны три цифры: по одной на R, G и B.", "Үш цифр керек: R, G және B үшін біреуден.")],
      ["#0F0", w("Это `#00FF00` — зелёный: максимум стоит во втором канале.", "Бұл `#00FF00` — жасыл: максимум екінші арнада тұр.")],
    ],
    w("Разбей #FF0000 на пары и из каждой пары возьми одну цифру.", "#FF0000 кодын жұптарға бөліп, әр жұптан бір цифр ал."),
    w("Пары FF, 00, 00 → одинаковые цифры в парах → по одной цифре: `#F00`.", "FF, 00, 00 жұптары → жұптарда цифрлар бірдей → біреуден: `#F00`."),
  ),
  mc(
    "padding-two",
    1,
    w("Что означает `padding: 10px 20px;`?", "`padding: 10px 20px;` нені білдіреді?"),
    w("10px сверху и снизу, 20px слева и справа", "жоғарыдан және төменнен 10px, солдан және оңнан 20px"),
    [
      [w("10px слева и справа, 20px сверху и снизу", "солдан және оңнан 10px, жоғарыдан және төменнен 20px"), w("Наоборот: первое число — верх и низ, второе — лево и право.", "Керісінше: бірінші сан — жоғары және төмен, екіншісі — сол және оң жақ.")],
      [w("10px сверху, 20px по всем остальным сторонам", "жоғарыдан 10px, қалған барлық жақтан 20px"), w("Два числа задают пары сторон: верх/низ и лево/право.", "Екі сан жақтар жұбын береді: жоғары/төмен және сол/оң.")],
      [w("10px и 20px — два слоя отступа на каждой стороне", "10px және 20px — әр жақтағы екі қабат шегініс"), w("Это одно свойство, а числа относятся к разным сторонам, а не к слоям.", "Бұл бір қасиет, ал сандар қабаттарға емес, әртүрлі жақтарға қатысты.")],
    ],
    w("Два значения идут по парам: сначала вертикаль, потом горизонталь.", "Екі мән жұппен жүреді: алдымен тік, содан кейін көлденең."),
    w("Два значения: первое — верх и низ, второе — лево и право. Четыре значения — по часовой стрелке: верх, право, низ, лево.", "Екі мән: біріншісі — жоғары және төмен, екіншісі — сол және оң жақ. Төрт мән — сағат тілі бойымен: жоғары, оң, төмен, сол."),
  ),
  // ----- B -----
  mc(
    "margin-auto-need",
    2,
    w("Что нужно блоку, чтобы `margin: 0 auto;` поставил его по центру страницы?", "`margin: 0 auto;` блокты беттің ортасына қоюы үшін блокқа не керек?"),
    w("заданная `width`, меньшая ширины страницы", "беттің енінен аз берілген `width`"),
    [
      [w("`text-align: center` у самого блока", "блоктың өзінде `text-align: center`"), w("`text-align` двигает содержимое блока, а не сам блок.", "`text-align` блоктың ішіндегіні жылжытады, блоктың өзін емес.")],
      [w("рамка `border`", "`border` жиегі"), w("Рамка не связана с центрированием.", "Жиектің ортаға қоюға қатысы жоқ.")],
      ["display: none", w("`display: none` убирает блок, а не ставит его по центру.", "`display: none` блокты алып тастайды, ортаға қоймайды.")],
    ],
    w("Чтобы поделить свободное место слева и справа, оно сначала должно быть. Что делает блок уже страницы?", "Сол және оң жақтағы бос орынды бөлу үшін ол алдымен болуы керек. Блокты беттен тарлататын не?"),
    w("Блок без `width` и так на всю ширину — делить нечего. Когда `width` меньше страницы, `auto` делит остаток поровну слева и справа.", "`width` жоқ блок өзі бүкіл енде — бөлетін ештеңе жоқ. `width` беттен аз болғанда, `auto` қалған орынды сол және оң жаққа тең бөледі."),
  ),
  mc(
    "margin-four",
    2,
    w("Что означает `margin: 5px 10px 15px 20px;`?", "`margin: 5px 10px 15px 20px;` нені білдіреді?"),
    w("сверху 5, справа 10, снизу 15, слева 20", "жоғарыдан 5, оңнан 10, төменнен 15, солдан 20"),
    [
      [w("сверху 5, слева 10, снизу 15, справа 20", "жоғарыдан 5, солдан 10, төменнен 15, оңнан 20"), w("Порядок идёт по часовой стрелке: после «сверху» идёт «справа», а не «слева».", "Реті сағат тілі бойымен: «жоғарыдан» кейін «оңнан» келеді, «солдан» емес.")],
      [w("сверху 5, снизу 10, слева 15, справа 20", "жоғарыдан 5, төменнен 10, солдан 15, оңнан 20"), w("Это не порядок CSS: значения идут по кругу, а не парами «верх-низ, лево-право».", "Бұл CSS реті емес: мәндер дөңгелене жүреді, «жоғары-төмен, сол-оң» жұптарымен емес.")],
      [w("по 50px со всех сторон", "барлық жақтан 50px"), w("Значения не складываются: каждое число относится к своей стороне.", "Мәндер қосылмайды: әр сан өз жағына қатысты.")],
    ],
    w("Представь стрелки часов, начни с 12 часов (верх).", "Сағат тілін елестет, 12-ден (жоғарыдан) баста."),
    w("Четыре значения идут по часовой стрелке, начиная сверху: верх, право, низ, лево.", "Төрт мән жоғарыдан бастап сағат тілі бойымен жүреді: жоғары, оң, төмен, сол."),
  ),
  mc(
    "inline-width",
    2,
    w("Что произойдёт с `width: 200px;` у обычного `<span>`?", "Қарапайым `<span>` үшін `width: 200px;` не болады?"),
    w("ничего: у строчного элемента width не действует", "ештеңе болмайды: жолішілік элементте width әрекет етпейді"),
    [
      [w("span станет шириной ровно 200px", "span ені тура 200px болады"), w("Строчный элемент игнорирует `width`: его размер зависит от содержимого.", "Жолішілік элемент `width` қасиетін елемейді: оның өлшемі мазмұнға байланысты.")],
      [w("span станет блоком", "span блокқа айналады"), w("Блоком элемент делает `display: block`, а не `width`.", "Элементті блок етуді `display: block` істейді, `width` емес.")],
      [w("span исчезнет со страницы", "span беттен жоғалады"), w("Исчезает элемент при `display: none`, а `width` его не убирает.", "Элемент `display: none` кезінде жоғалады, ал `width` оны алып тастамайды.")],
    ],
    w("Вспомни, как ведут себя слова в строке: можно ли задать ширину одному слову?", "Жолдағы сөздердің өзін қалай ұстайтынын еске түсір: бір сөзге ен беруге бола ма?"),
    w("У `inline` ширина и высота не задаются. Чтобы они заработали, нужен `display: block` или `inline-block`.", "`inline` үшін ен мен биіктік берілмейді. Олар жұмыс істеуі үшін `display: block` немесе `inline-block` керек."),
  ),
  mc(
    "style-vs-id",
    2,
    w("Что сильнее: атрибут `style` в теге или правило для `#id` в CSS?", "Қайсысы күшті: тегтегі `style` атрибуты ма, әлде CSS-тегі `#id` ережесі ме?"),
    w("атрибут `style` в теге", "тегтегі `style` атрибуты"),
    [
      [w("правило для `#id`", "`#id` ережесі"), w("`#id` сильнее класса и тега, но атрибут `style` сильнее и его.", "`#id` класс пен тегтен күшті, бірақ `style` атрибуты оны да басады.")],
      [w("они равны, решает порядок записи", "олар тең, жазылу реті шешеді"), w("Приоритеты разные: порядок решает только при равных.", "Басымдықтар әртүрлі: реті тек тең болғанда шешеді.")],
      [w("побеждает более короткая запись", "қысқа жазба жеңеді"), w("Длина записи на приоритет не влияет.", "Жазбаның ұзындығы басымдыққа әсер етпейді.")],
    ],
    w("Что «ближе» к самому элементу: правило где-то в CSS или запись прямо в его теге?", "Элементтің өзіне не «жақынырақ»: CSS-тегі ереже ме, әлде оның тегіндегі жазба ма?"),
    w("Порядок приоритета: style в теге > id > класс > тег.", "Басымдық реті: тегтегі style > id > класс > тег."),
  ),
  mc(
    "two-classes",
    2,
    w("Какого цвета будет текст абзаца?", "Абзац мәтіні қандай түсті болады?"),
    w("синего", "көк"),
    [
      [w("красного", "қызыл"), w("`.a` записан в атрибуте последним, но порядок имён в `class` не важен: решает порядок правил в CSS, а `.b` записано ниже.", "`.a` атрибутта соңғы жазылған, бірақ `class` ішіндегі атаулар реті маңызды емес: CSS-тегі ережелер реті шешеді, ал `.b` төменірек жазылған.")],
      [w("чёрного", "қара"), w("Подходят оба правила класса, поэтому браузер применит одно из них, а не цвет по умолчанию.", "Екі класс ережесі де сәйкес келеді, сондықтан браузер әдепкі түсті емес, солардың бірін қолданады.")],
      [w("будет ошибка: два класса нельзя", "қате болады: екі класс болмайды"), w("Элементу можно давать несколько классов через пробел.", "Элементке бірнеше класты бос орын арқылы беруге болады.")],
    ],
    w("У двух правил одинаковый приоритет. Что решает в таком случае: порядок имён в атрибуте или порядок правил в CSS?", "Екі ереженің басымдығы бірдей. Мұндайда не шешеді: атрибуттағы атаулар реті ме, әлде CSS-тегі ережелер реті ме?"),
    w("Приоритет у `.a` и `.b` одинаковый, поэтому побеждает правило, записанное ниже в CSS: `.b` — синий.", "`.a` және `.b` басымдығы бірдей, сондықтан CSS-те төменірек жазылған ереже жеңеді: `.b` — көк."),
    codeHtml(["<style>", "    .a { color: red; }", "    .b { color: blue; }", "</style>", '<p class="b a">Hi</p>']),
  ),
  mc(
    "inherit-prop",
    2,
    w("Какое свойство передаётся вложенным элементам (наследуется)?", "Қай қасиет ішкі элементтерге беріледі (мұраланады)?"),
    "color",
    [
      ["border", w("Рамка не наследуется: она рисуется только у того элемента, которому задана.", "Жиек мұраланбайды: ол тек өзіне берілген элементте салынады.")],
      ["margin", w("Внешний отступ не наследуется.", "Сыртқы шегініс мұраланбайды.")],
      ["padding", w("Внутренний отступ не наследуется.", "Ішкі шегініс мұраланбайды.")],
    ],
    w("Если задать цвет текста у `div`, поменяется ли цвет текста абзаца внутри?", "`div` үшін мәтін түсін берсек, ішіндегі абзац мәтінінің түсі өзгере ме?"),
    w("Наследуются свойства текста: `color`, `font-size`, `font-family`, `text-align`. `border`, `margin`, `padding`, `background` — нет.", "Мәтін қасиеттері мұраланады: `color`, `font-size`, `font-family`, `text-align`. `border`, `margin`, `padding`, `background` — жоқ."),
  ),
  mc(
    "hex-expand-0af",
    2,
    w("Чему равен цвет `#0AF`?", "`#0AF` түсі неге тең?"),
    "#00AAFF",
    [
      ["#000AAF", w("Нули дописаны в начало, а нужно повторить каждую цифру.", "Нөлдер басына жазылған, ал әр цифрды қайталау керек.")],
      ["#0AF000", w("Нули дописаны в конец, а нужно повторить каждую цифру.", "Нөлдер соңына жазылған, ал әр цифрды қайталау керек.")],
      ["#0A0AF0", w("Цифры чередуются с нулями, а нужно повторить саму цифру.", "Цифрлар нөлдермен кезектесіп тұр, ал цифрдың өзін қайталау керек.")],
    ],
    w("Каждую из трёх цифр запиши дважды подряд.", "Үш цифрдың әрқайсысын қатарынан екі рет жаз."),
    w("`0AF` → `00`, `AA`, `FF` → `#00AAFF`.", "`0AF` → `00`, `AA`, `FF` → `#00AAFF`."),
  ),
  mc(
    "id-unique",
    2,
    w("Сколько элементов на странице может иметь один и тот же id?", "Бетте бір id-ге нешеу ие бола алады?"),
    w("один", "біреу"),
    [
      [w("любое количество", "кез келген саны"), w("`id` — уникальное имя: его не повторяют. Для группы элементов есть класс.", "`id` — бірегей атау: оны қайталамайды. Элементтер тобы үшін класс бар.")],
      [w("не больше двух", "екіден көп емес"), w("Ограничения «два» нет: id вообще должен быть у одного.", "«Екеу» деген шек жоқ: id жалпы біреуінде ғана болуы керек.")],
      [w("не больше десяти", "оннан көп емес"), w("Ограничения «десять» нет: id уникален.", "«Он» деген шек жоқ: id бірегей.")],
    ],
    w("Номер паспорта бывает у нескольких людей сразу?", "Төлқұжат нөмірі бірнеше адамда бірден болады ма?"),
    w("`id` — уникальное имя одного элемента. Для нескольких элементов используют класс.", "`id` — бір элементтің бірегей атауы. Бірнеше элемент үшін класс қолданады."),
  ),
  mc(
    "hidden-vs-none",
    2,
    w("Чем `visibility: hidden` отличается от `display: none`?", "`visibility: hidden` `display: none` қасиетінен немен ерекшеленеді?"),
    w("hidden прячет элемент, но место остаётся; none убирает и элемент, и место", "hidden элементті жасырады, бірақ орын қалады; none элементті де, орнын да алып тастайды"),
    [
      [w("hidden убирает и элемент, и место; none только прячет", "hidden элементті де, орнын да алып тастайды; none тек жасырады"), w("Наоборот: место освобождает именно `display: none`.", "Керісінше: орынды дәл `display: none` босатады.")],
      [w("Ничем, это одно и то же", "Ештеңемен, бұл бір нәрсе"), w("Разница есть: после hidden остаётся пустое место.", "Айырмашылық бар: hidden-нен кейін бос орын қалады.")],
      [w("hidden меняет цвет, none меняет шрифт", "hidden түсті, none қарпті өзгертеді"), w("Оба относятся к показу элемента, а не к цвету или шрифту.", "Екеуі де элементті көрсетуге қатысты, түске немесе қарпке емес.")],
    ],
    w("Представь пустое кресло в зале: человека не видно, а место осталось ли занято?", "Залдағы бос креслоны елестет: адам көрінбейді, ал орын бос па?"),
    w("`visibility: hidden` — элемент невидим, но занимает место. `display: none` — элемент убран вместе с местом.", "`visibility: hidden` — элемент көрінбейді, бірақ орын алады. `display: none` — элемент орнымен бірге алынады."),
  ),
  mc(
    "center-text-vs-block",
    2,
    w("Блок шириной 300px на странице шириной 800px, у блока `text-align: center`. Что произойдёт?", "Ені 800px бетте ені 300px блок бар, блокта `text-align: center`. Не болады?"),
    w("текст встанет по центру блока, сам блок останется слева", "мәтін блоктың ортасына тұрады, блоктың өзі сол жақта қалады"),
    [
      [w("блок встанет по центру страницы", "блок беттің ортасына тұрады"), w("Блок центрирует `margin: 0 auto`, а `text-align` двигает только содержимое.", "Блокты `margin: 0 auto` ортаға қояды, ал `text-align` тек ішіндегіні жылжытады.")],
      [w("и блок, и текст встанут по центру", "блок та, мәтін де ортаға тұрады"), w("`text-align` блок не двигает: он останется на своём месте.", "`text-align` блокты жылжытпайды: ол өз орнында қалады.")],
      [w("ничего не изменится", "ештеңе өзгермейді"), w("Текст внутри блока сместится: по умолчанию он прижат влево.", "Блок ішіндегі мәтін жылжиды: әдепкі бойынша ол солға жақын тұрады.")],
    ],
    w("Табличка на стене и надпись на табличке: что двигает `text-align`?", "Қабырғадағы тақтайша мен тақтайшадағы жазу: `text-align` нені жылжытады?"),
    w("`text-align` выравнивает содержимое внутри блока. Сам блок по центру ставит `margin: 0 auto`.", "`text-align` блок ішіндегіні туралайды. Блоктың өзін ортаға `margin: 0 auto` қояды."),
  ),
  mc(
    "inline-block",
    2,
    w("Какое значение `display` нужно, чтобы элемент стоял в строке, но у него работали `width` и `height`?", "Элемент жолда тұруы, бірақ оның `width` және `height` қасиеттері жұмыс істеуі үшін `display` қай мәні керек?"),
    "inline-block",
    [
      ["inline", w("У `inline` ширина и высота не действуют.", "`inline` үшін ен мен биіктік әрекет етпейді.")],
      ["block", w("`block` начинается с новой строки и не стоит в строке рядом с соседями.", "`block` жаңа жолдан басталады және көршілермен қатар жолда тұрмайды.")],
      ["none", w("`none` убирает элемент.", "`none` элементті алып тастайды.")],
    ],
    w("Название состоит из двух частей: «в строке» и «как блок».", "Атауы екі бөліктен тұрады: «жолда» және «блок сияқты»."),
    w("`inline-block` — элемент стоит в строке, как слово, но размеры и отступы действуют, как у блока.", "`inline-block` — элемент жолда сөз сияқты тұрады, бірақ өлшемдер мен шегіністер блок сияқты әрекет етеді."),
  ),
  mc(
    "priority-order",
    2,
    w("В каком порядке записаны способы задать стиль — от самого сильного к самому слабому?", "Стиль берудің қай жолдары ең күштіден ең әлсізге қарай орналасқан?"),
    w("style в теге → id → класс → тег", "тегтегі style → id → класс → тег"),
    [
      [w("id → style в теге → класс → тег", "id → тегтегі style → класс → тег"), w("Атрибут `style` в самом теге сильнее id.", "Тегтің өзіндегі `style` атрибуты id-ден күшті.")],
      [w("тег → класс → id → style в теге", "тег → класс → id → тегтегі style"), w("Это порядок от самого слабого к самому сильному.", "Бұл ең әлсізден ең күштіге қарай реті.")],
      [w("style в теге → класс → id → тег", "тегтегі style → класс → id → тег"), w("id сильнее класса: id задаёт один элемент, класс — группу.", "id кластан күшті: id бір элементті, класс топты береді.")],
    ],
    w("Чем «точнее» адрес (один конкретный элемент), тем сильнее правило.", "Мекенжай неғұрлым «нақты» (нақты бір элемент) болса, ереже соғұрлым күшті."),
    w("Приоритет: style в теге > id > класс > тег. При равных приоритетах побеждает правило, записанное ниже.", "Басымдық: тегтегі style > id > класс > тег. Басымдық тең болса, төменірек жазылған ереже жеңеді."),
  ),
  inp(
    "box-height",
    2,
    w("Блок: height 50px, padding 10px, border 2px. Чему равна высота блока в пикселях (без margin)?", "Блок: height 50px, padding 10px, border 2px. Блоктың биіктігі неше пиксель (margin-сіз)?"),
    "74",
    "number",
    w("По вертикали работают те же слои: сверху и снизу есть и padding, и border.", "Тік бағытта да сол қабаттар жұмыс істейді: жоғарыда да, төменде де padding пен border бар."),
    w("50 + 2 · 10 + 2 · 2 = 50 + 20 + 4 = **74** px.", "50 + 2 · 10 + 2 · 2 = 50 + 20 + 4 = **74** px."),
    codeCss(["div {", "    height: 50px;", "    padding: 10px;", "    border: 2px solid red;", "}"]),
  ),
  // ----- C -----
  mc(
    "margin-collapse",
    3,
    w("Чему равно расстояние между рамками двух блоков (один под другим)?", "Екі блок жиектерінің арақашықтығы неге тең (бірі екіншісінің астында)?"),
    "30px",
    [
      ["50px", w("Вертикальные margin соседних блоков не складываются: берётся большее значение.", "Көрші блоктардың тік margin мәндері қосылмайды: үлкені алынады.")],
      ["20px", w("Берётся большее значение, а оно здесь 30px.", "Үлкен мән алынады, ал ол мұнда 30px.")],
      ["10px", w("Разность margin тоже не берётся: расстояние равно большему из двух.", "margin айырмасы да алынбайды: арақашықтық екеуінің үлкеніне тең.")],
    ],
    w("Вспомни ловушку: что происходит с вертикальными margin соседних блоков?", "Тұзақты еске түсір: көрші блоктардың тік margin мәндерімен не болады?"),
    w("Вертикальные margin соседних блоков «схлопываются»: расстояние равно большему из них, то есть 30px.", "Көрші блоктардың тік margin мәндері «қосылып кетеді»: арақашықтық олардың үлкеніне тең, яғни 30px."),
    codeCss([".a { margin-bottom: 20px; }", ".b { margin-top: 30px; }", "/* блок .a стоит над блоком .b */"]),
  ),
  mc(
    "border-box-content",
    3,
    w("У блока `box-sizing: border-box; width: 200px; padding: 20px; border: 5px solid red;`. Чему равна ширина содержимого?", "Блокта `box-sizing: border-box; width: 200px; padding: 20px; border: 5px solid red;` бар. Мазмұн ені неге тең?"),
    "150px",
    [
      ["200px", w("200px — ширина всего блока, а не содержимого: padding и border нужно вычесть.", "200px — бүкіл блоктың ені, мазмұнның емес: padding пен border алып тастау керек.")],
      ["250px", w("Так считают без `border-box`, но здесь padding и border уже внутри `width`.", "Мұндай `border-box` болмағанда есептейді, ал мұнда padding пен border `width` ішінде.")],
      ["160px", w("Вычтен только padding, а рамка забыта: border тоже входит в `width`.", "Тек padding алынған, жиек ұмытылған: border да `width` ішінде.")],
    ],
    w("При `border-box` число `width` — это весь блок. Из него нужно вычесть padding и border с двух сторон.", "`border-box` кезінде `width` саны — бүкіл блок. Одан екі жақтағы padding пен border алып тастау керек."),
    w("200 − 2 · 20 − 2 · 5 = 200 − 40 − 10 = **150** px.", "200 − 2 · 20 − 2 · 5 = 200 − 40 − 10 = **150** px."),
  ),
  mc(
    "inherit-own-rule",
    3,
    w("Какого цвета будет текст абзаца?", "Абзац мәтіні қандай түсті болады?"),
    w("красного", "қызыл"),
    [
      [w("зелёного", "жасыл"), w("Цвет от `div` наследуется, но у абзаца есть собственное правило `p`: оно сильнее унаследованного.", "`div` түсі мұраланады, бірақ абзацтың өзінің `p` ережесі бар: ол мұраланғаннан күшті.")],
      [w("чёрного", "қара"), w("Чёрный — цвет по умолчанию, но здесь есть правило `p` с цветом.", "Қара — әдепкі түс, бірақ мұнда түсі бар `p` ережесі бар.")],
      [w("будет ошибка: два правила спорят", "қате болады: екі ереже дауласады"), w("Спора нет: правило для самого элемента сильнее унаследованного значения.", "Дау жоқ: элементтің өзіне арналған ереже мұраланған мәннен күшті.")],
    ],
    w("Есть ли у самого абзаца правило, которое выбирает именно его?", "Абзацтың өзін таңдайтын ереже бар ма?"),
    w("Унаследованное значение — самое слабое. Правило `p { color: red; }` выбирает сам абзац, поэтому он красный.", "Мұраланған мән — ең әлсізі. `p { color: red; }` ережесі абзацтың өзін таңдайды, сондықтан ол қызыл."),
    codeHtml(["<style>", "    div { color: green; }", "    p { color: red; }", "</style>", "<div><p>Hi</p></div>"]),
  ),
  mc(
    "auto-no-width",
    3,
    w("У блока нет `width`, но задано `margin: 0 auto;`. Что произойдёт?", "Блокта `width` жоқ, бірақ `margin: 0 auto;` берілген. Не болады?"),
    w("ничего не изменится: блок и так на всю ширину", "ештеңе өзгермейді: блок өзі бүкіл енде"),
    [
      [w("блок встанет по центру страницы", "блок беттің ортасына тұрады"), w("Центрировать нечего: блок занимает всю ширину, свободного места нет.", "Ортаға қоятын ештеңе жоқ: блок бүкіл енді алады, бос орын жоқ.")],
      [w("блок станет узким", "блок тар болады"), w("Ширину блока меняет `width`, а не `margin`.", "Блоктың енін `width` өзгертеді, `margin` емес.")],
      [w("блок исчезнет", "блок жоғалады"), w("Исчезает элемент при `display: none`, а не при `margin: 0 auto`.", "Элемент `display: none` кезінде жоғалады, `margin: 0 auto` кезінде емес.")],
    ],
    w("Чтобы поделить свободное место поровну, оно должно существовать. Есть ли оно у блока без `width`?", "Бос орынды тең бөлу үшін ол болуы керек. `width` жоқ блокта ол бар ма?"),
    w("Блок без `width` растянут на всю ширину, свободного места нет, и `auto` делить нечего.", "`width` жоқ блок бүкіл енге созылған, бос орын жоқ, `auto` бөлетін ештеңе жоқ."),
  ),
  mc(
    "specificity-compound",
    3,
    w("Какого цвета будет текст абзаца?", "Абзац мәтіні қандай түсті болады?"),
    w("красного", "қызыл"),
    [
      [w("синего", "көк"), w("Правило `.note` записано ниже, но у `p.note` приоритет выше: в селекторе есть и тег, и класс. Порядок решает только при равных приоритетах.", "`.note` ережесі төменірек жазылған, бірақ `p.note` басымдығы жоғары: селекторда тег те, класс та бар. Реті тек басымдық тең болғанда шешеді.")],
      [w("чёрного", "қара"), w("Оба правила подходят, поэтому одно из них будет применено, а не цвет по умолчанию.", "Екі ереже де сәйкес келеді, сондықтан солардың бірі қолданылады, әдепкі түс емес.")],
      [w("будет ошибка: класс написан дважды", "қате болады: класс екі рет жазылған"), w("Это два разных селектора: один для `p` с классом, другой для любого элемента с классом.", "Бұл екі басқа селектор: бірі класы бар `p` үшін, екіншісі класы бар кез келген элемент үшін.")],
    ],
    w("Сравни, из скольких частей состоят селекторы: в одном только класс, в другом тег и класс.", "Селекторлар неше бөліктен тұратынын салыстыр: біреуінде тек класс, екіншісінде тег пен класс."),
    w("Селектор `p.note` точнее, чем просто `.note`: в нём тег и класс. Более точный селектор побеждает, порядок не важен.", "`p.note` селекторы жай `.note` селекторына қарағанда нақтырақ: онда тег пен класс бар. Нақтырақ селектор жеңеді, реті маңызды емес."),
    codeHtml(["<style>", "    p.note { color: red; }", "    .note { color: blue; }", "</style>", '<p class="note">Hi</p>']),
  ),
  inp(
    "fit-blocks",
    3,
    w(
      "Ширина контейнера 400px. Каждый блок: width 80px, padding 10px, border 2px, margin 8px. Сколько таких блоков поместится в один ряд? (считай только размеры)",
      "Контейнер ені 400px. Әр блок: width 80px, padding 10px, border 2px, margin 8px. Бір қатарға неше осындай блок симады? (тек өлшемдерді есепте)",
    ),
    "3",
    "number",
    w("Сначала найди, сколько места занимает один блок вместе с margin, потом раздели 400 на это число и отбрось дробную часть.", "Алдымен бір блоктың margin-мен қанша орын алатынын тап, сосын 400-ді сол санға бөліп, бөлшек бөлігін алып таста."),
    w("Один блок: 80 + 2 · 10 + 2 · 2 + 2 · 8 = 80 + 20 + 4 + 16 = 120 px. 400 : 120 = 3,33…, значит помещается **3** блока.", "Бір блок: 80 + 2 · 10 + 2 · 2 + 2 · 8 = 80 + 20 + 4 + 16 = 120 px. 400 : 120 = 3,33…, демек **3** блок симады."),
  ),
  mc(
    "inherit-border",
    3,
    w("У `div` задана рамка: `div { border: 2px solid red; }`. Что будет вокруг абзаца `<p>` внутри него?", "`div` үшін жиек берілген: `div { border: 2px solid red; }`. Ішіндегі `<p>` абзацының айналасында не болады?"),
    w("ничего: `border` не наследуется, рамка только у `div`", "ештеңе: `border` мұраланбайды, жиек тек `div` элементінде"),
    [
      [w("такая же красная рамка", "дәл сондай қызыл жиек"), w("Рамка не наследуется. Наследуются свойства текста: `color`, `font-size` и подобные.", "Жиек мұраланбайды. Мәтін қасиеттері мұраланады: `color`, `font-size` және соларға ұқсас.")],
      [w("рамка вдвое тоньше", "екі есе жіңішке жиек"), w("Такого правила в CSS нет: рамка либо задана элементу, либо нет.", "CSS-те мұндай ереже жоқ: жиек элементке не берілген, не берілмеген.")],
      [w("абзац станет красным", "абзац қызыл болады"), w("Цвет рамки и цвет текста — разные свойства; текст красным не станет.", "Жиек түсі мен мәтін түсі — әртүрлі қасиеттер; мәтін қызыл болмайды.")],
    ],
    w("Вспомни, какие свойства наследуются: текстовые или оформляющие блок?", "Қай қасиеттер мұраланатынын еске түсір: мәтіндік пе, әлде блокты безендіретіні ме?"),
    w("`border`, `margin`, `padding` и `background` не наследуются: они действуют только на тот элемент, которому заданы.", "`border`, `margin`, `padding` және `background` мұраланбайды: олар тек өзіне берілген элементке әсер етеді."),
  ),
];

// ---------- Утверждения «верно / неверно» ----------

const st = (id: string, level: Level, text: L, value: boolean, explanation: L, hint: L): Statement => ({
  id: `s:${SKILL}:${id}`,
  skill: SKILL,
  level,
  text,
  value,
  explanation,
  hint,
});

const STATEMENTS: Statement[] = [
  st("padding-inside", 1, w("`padding` — внутренний отступ между содержимым и рамкой", "`padding` — мазмұн мен жиектің арасындағы ішкі шегініс"), true, w("Верно: padding внутри рамки, margin снаружи.", "Дұрыс: padding жиектің ішінде, margin сыртында."), w("Какой отступ лежит ближе к тексту?", "Қай шегініс мәтінге жақынырақ орналасқан?")),
  st("margin-bg", 1, w("Фон блока закрашивает и его внешний отступ margin", "Блок фоны оның сыртқы шегінісі margin-ді де бояйды"), false, w("Неверно: margin всегда прозрачный, фон закрашивает содержимое и padding.", "Қате: margin әрқашан мөлдір, фон мазмұн мен padding-ті бояйды."), w("Вспомни, что фон закрашивает «внутри рамки».", "Фонның «жиектің ішін» бояйтынын еске түсір.")),
  st("div-block", 1, w("Элемент `div` по умолчанию блочный", "`div` элементі әдепкі бойынша блоктық"), true, w("Верно: `div` начинается с новой строки и занимает всю ширину.", "Дұрыс: `div` жаңа жолдан басталады және бүкіл енді алады."), w("Блочный — как абзац в тетради.", "Блоктық — дәптердегі абзац сияқты.")),
  st("span-newline", 1, w("Элемент `span` по умолчанию начинается с новой строки", "`span` элементі әдепкі бойынша жаңа жолдан басталады"), false, w("Неверно: `span` строчный и стоит в строке рядом с соседями.", "Қате: `span` жолішілік және көршілермен қатар жолда тұрады."), w("`span` — как слово внутри предложения.", "`span` — сөйлем ішіндегі сөз сияқты.")),
  st("none-place", 1, w("`display: none` убирает элемент вместе с его местом на странице", "`display: none` элементті беттегі орнымен бірге алып тастайды"), true, w("Верно: элемент не виден и места не занимает.", "Дұрыс: элемент көрінбейді және орын алмайды."), w("Слово «none» значит «ничего».", "«none» сөзі «ештеңе» дегенді білдіреді.")),
  st("id-unique", 1, w("Один и тот же `id` можно дать нескольким элементам страницы", "Бір `id`-ді беттің бірнеше элементіне беруге болады"), false, w("Неверно: `id` уникален. Для группы элементов используют класс.", "Қате: `id` бірегей. Элементтер тобы үшін класс қолданады."), w("Вспомни сравнение id с номером паспорта.", "id-ді төлқұжат нөмірімен салыстыруды еске түсір.")),
  st("align-block", 2, w("`text-align: center` ставит по центру страницы сам блок", "`text-align: center` блоктың өзін беттің ортасына қояды"), false, w("Неверно: `text-align` двигает содержимое блока. Сам блок центрирует `margin: 0 auto`.", "Қате: `text-align` блоктың ішіндегіні жылжытады. Блоктың өзін `margin: 0 auto` ортаға қояды."), w("Что двигается: надпись на табличке или сама табличка?", "Не жылжиды: тақтайшадағы жазу ма, әлде тақтайшаның өзі ме?")),
  st("auto-width", 2, w("Чтобы `margin: 0 auto` поставил блок по центру, у блока должна быть задана `width`", "`margin: 0 auto` блокты ортаға қоюы үшін блокқа `width` берілуі керек"), true, w("Верно: без `width` блок на всю ширину, делить свободное место нечего.", "Дұрыс: `width` жоқ блок бүкіл енде, бөлетін бос орын жоқ."), w("Откуда возьмётся свободное место слева и справа?", "Сол және оң жақтағы бос орын қайдан шығады?")),
  st("hex-short", 2, w("`#F00` и `#FF0000` — один и тот же цвет", "`#F00` және `#FF0000` — бір түс"), true, w("Верно: короткая запись повторяет каждую цифру.", "Дұрыс: қысқа жазба әр цифрды қайталайды."), w("Повтори каждую цифру короткой записи дважды.", "Қысқа жазбаның әр цифрын екі рет қайтала.")),
  st("style-id", 2, w("Атрибут `style` в теге сильнее правила для `#id` в CSS", "Тегтегі `style` атрибуты CSS-тегі `#id` ережесінен күшті"), true, w("Верно: style > id > класс > тег.", "Дұрыс: style > id > класс > тег."), w("Что «ближе» к элементу?", "Элементке не «жақынырақ»?")),
  st("inline-width", 2, w("У `span` свойство `width` действует так же, как у `div`", "`span` үшін `width` қасиеті `div` сияқты әрекет етеді"), false, w("Неверно: у строчного элемента ширина не задаётся. Нужен `display: block` или `inline-block`.", "Қате: жолішілік элементте ен берілмейді. `display: block` немесе `inline-block` керек."), w("Можно ли задать ширину одному слову в строке?", "Жолдағы бір сөзге ен беруге бола ма?")),
  st("hidden-none", 2, w("`visibility: hidden` убирает элемент вместе с его местом", "`visibility: hidden` элементті орнымен бірге алып тастайды"), false, w("Неверно: после `visibility: hidden` место остаётся пустым. Место освобождает `display: none`.", "Қате: `visibility: hidden` кейін орын бос қалады. Орынды `display: none` босатады."), w("Невидимый элемент всё ещё может занимать место.", "Көрінбейтін элемент әлі де орын алуы мүмкін.")),
  st("color-inherit", 2, w("Свойства `color` и `text-align` наследуются вложенными элементами", "`color` және `text-align` қасиеттері ішкі элементтерге мұраланады"), true, w("Верно: свойства текста наследуются, а `border`, `margin` и `padding` — нет.", "Дұрыс: мәтін қасиеттері мұраланады, ал `border`, `margin` және `padding` — жоқ."), w("Какие свойства относятся к тексту?", "Қай қасиеттер мәтінге қатысты?")),
  st("border-box", 2, w("При `box-sizing: border-box` значение `width` включает padding и border", "`box-sizing: border-box` кезінде `width` мәні padding пен border-ді қамтиды"), true, w("Верно: `width` — это ширина всего блока без margin.", "Дұрыс: `width` — margin-сіз бүкіл блоктың ені."), w("Название говорит, до какого слоя считается ширина: «border».", "Атауы енің қай қабатқа дейін есептелетінін айтады: «border».")),
  st("hex-ffa500", 3, w("Цвет `#FFA500` можно записать коротко как `#FA5`", "`#FFA500` түсін қысқаша `#FA5` деп жазуға болады"), false, w("Неверно: пара `A5` состоит из разных цифр, сократить нельзя. `#FA5` — это `#FFAA55`.", "Қате: `A5` жұбы әртүрлі цифрлардан тұрады, қысқартуға болмайды. `#FA5` — бұл `#FFAA55`."), w("Разверни `#FA5` обратно: совпадёт ли результат?", "`#FA5` жазбасын кері ашып көр: нәтиже сәйкес келе ме?")),
  st("class-order", 3, w("Если у элемента `class=\"a b\"`, побеждает правило для `.a`, потому что `a` записан первым в атрибуте", "Элементте `class=\"a b\"` болса, `.a` ережесі жеңеді, өйткені `a` атрибутта бірінші жазылған"), false, w("Неверно: порядок имён в `class` не важен. При равном приоритете побеждает правило, записанное ниже в CSS.", "Қате: `class` ішіндегі атаулар реті маңызды емес. Басымдық тең болса, CSS-те төменірек жазылған ереже жеңеді."), w("Где записан порядок, который решает спор: в атрибуте или в CSS?", "Дауды шешетін ретті қайда жазады: атрибутта ма, CSS-те ме?")),
  st("collapse", 3, w("Нижний margin 20px у верхнего блока и верхний margin 30px у нижнего дают расстояние 50px", "Жоғарғы блоктың төменгі margin 20px және төменгі блоктың жоғарғы margin 30px арақашықтықты 50px етеді"), false, w("Неверно: вертикальные margin соседей не складываются, берётся большее — 30px.", "Қате: көршілердің тік margin мәндері қосылмайды, үлкені алынады — 30px."), w("Вспомни ловушку про вертикальные margin.", "Тік margin туралы тұзақты еске түсір.")),
  st("inherit-weak", 3, w("Унаследованное значение слабее любого правила, выбравшего сам элемент", "Мұраланған мән элементтің өзін таңдаған кез келген ережеден әлсіз"), true, w("Верно: даже правило для тега перебивает унаследованное от родителя.", "Дұрыс: тіпті тег ережесі де ата-анадан мұраланғанды басып тастайды."), w("Что «ближе» к элементу: собственное правило или значение родителя?", "Элементке не «жақынырақ»: өз ережесі ме, әлде ата-ана мәні ме?")),
  st("border-inherit", 3, w("Рамка, заданная у `div`, наследуется вложенными абзацами", "`div` үшін берілген жиек ішіндегі абзацтарға мұраланады"), false, w("Неверно: `border` не наследуется, рамка рисуется только у `div`.", "Қате: `border` мұраланбайды, жиек тек `div` элементінде салынады."), w("Наследуются свойства текста, а не оформления блока.", "Мәтін қасиеттері мұраланады, блок безендірілуі емес.")),
];

// ---------- Пары «термин ↔ значение» ----------

const pr = (id: string, level: Level, left: Text, right: L): Pair => ({ id: `p:${SKILL}:pair-${id}`, skill: SKILL, level, left, right });

const PAIRS: Pair[] = [
  pr("padding", 1, "padding", w("внутренний отступ", "ішкі шегініс")),
  pr("margin", 1, "margin", w("внешний отступ", "сыртқы шегініс")),
  pr("border", 1, "border", w("рамка блока", "блоктың жиегі")),
  pr("width", 1, "width", w("ширина содержимого", "мазмұн ені")),
  pr("text-align", 1, "text-align", w("выравнивание текста внутри блока", "блок ішіндегі мәтінді туралау")),
  pr("none", 2, "display: none", w("элемент убран и не занимает места", "элемент алынған және орын алмайды")),
  pr("block", 2, "display: block", w("с новой строки, на всю ширину", "жаңа жолдан, бүкіл енімен")),
  pr("inline", 2, "display: inline", w("в строке, как слово", "жолда, сөз сияқты")),
  pr("auto", 2, "margin: 0 auto", w("блок по центру (при заданной width)", "блок ортада (width берілгенде)")),
  pr("border-box", 3, "box-sizing: border-box", w("width включает padding и border", "width padding пен border-ді қамтиды")),
  pr("hidden", 3, "visibility: hidden", w("элемент скрыт, но место остаётся", "элемент жасырылған, бірақ орын қалады")),
  pr("style-attr", 3, w("атрибут style", "style атрибуты"), w("самый высокий приоритет", "ең жоғары басымдық")),
  pr("id-sel", 3, "#main", w("выбирает один элемент по id", "id бойынша бір элементті таңдайды")),
];

const pool = poolBank({ skill: SKILL, questions: POOL, statements: STATEMENTS, pairs: PAIRS });

// ---------- Короткие вопросы ----------

const sq = (id: string, level: Level, prompt: L, answer: string, mode: "number" | "text", explanation: L, hint: L): ShortQuestion => ({
  id: `q:${SKILL}:${id}`,
  skill: SKILL,
  level,
  prompt,
  answer,
  mode,
  explanation,
  hint,
});

const SHORTS: ShortQuestion[] = [
  sq("padding", 1, w("Запиши свойство CSS, которое задаёт внутренний отступ блока", "Блоктың ішкі шегінісін беретін CSS қасиетін жаз"), "padding", "text", w("Внутренний отступ — `padding`.", "Ішкі шегініс — `padding`."), w("Он находится между содержимым и рамкой.", "Ол мазмұн мен жиектің арасында орналасқан.")),
  sq("margin", 1, w("Запиши свойство CSS, которое задаёт внешний отступ блока", "Блоктың сыртқы шегінісін беретін CSS қасиетін жаз"), "margin", "text", w("Внешний отступ — `margin`.", "Сыртқы шегініс — `margin`."), w("Он находится снаружи рамки.", "Ол жиектің сыртында орналасқан.")),
  sq("none", 1, w("Запиши значение display, которое убирает элемент вместе с его местом", "Элементті орнымен бірге алып тастайтын display мәнін жаз"), "none", "text", w("`display: none` — элемент убран и места не занимает.", "`display: none` — элемент алынған және орын алмайды."), w("По-английски «ничего».", "Ағылшынша «ештеңе».")),
  sq("text-align", 1, w("Запиши свойство CSS, которое выравнивает текст внутри блока", "Блок ішіндегі мәтінді туралайтын CSS қасиетін жаз"), "text-align", "text", w("Выравнивание текста задаёт `text-align`.", "Мәтінді туралауды `text-align` береді."), w("Состоит из двух слов: text и align.", "Екі сөзден тұрады: text және align.")),
  sq("auto", 2, w("Запиши значение margin, которое ставит блок с заданной шириной по центру", "Ені берілген блокты ортаға қоятын margin мәнін жаз"), "0 auto", "text", w("`margin: 0 auto` — 0 сверху и снизу, `auto` слева и справа.", "`margin: 0 auto` — жоғарыдан және төменнен 0, солдан және оңнан `auto`."), w("Первое число — верх и низ, второе слово — лево и право.", "Бірінші сан — жоғары және төмен, екінші сөз — сол және оң жақ.")),
  sq("display", 2, w("Запиши свойство CSS, которое задаёт вид элемента: блок, строка или скрытый", "Элемент түрін (блок, жол немесе жасырын) беретін CSS қасиетін жаз"), "display", "text", w("Вид элемента задаёт `display`.", "Элемент түрін `display` береді."), w("По-английски «показывать».", "Ағылшынша «көрсету».")),
  sq("inline-block", 2, w("Запиши значение display: элемент стоит в строке, но width и height работают", "display мәнін жаз: элемент жолда тұр, бірақ width және height жұмыс істейді"), "inline-block", "text", w("`inline-block` — в строке, как слово, но с размерами, как у блока.", "`inline-block` — жолда сөз сияқты, бірақ өлшемдері блок сияқты."), w("Название состоит из двух слов через дефис.", "Атауы дефис арқылы екі сөзден тұрады.")),
  sq("hex-red", 2, w("Запиши цвет #FF0000 в короткой форме #RGB", "#FF0000 түсін #RGB қысқа түрінде жаз"), "#F00", "text", w("Пары FF, 00, 00 → по одной цифре: `#F00`.", "FF, 00, 00 жұптары → біреуден: `#F00`."), w("Из каждой пары возьми одну цифру.", "Әр жұптан бір цифр ал.")),
  sq("hex-short", 3, w("Запиши цвет #AABBCC в короткой форме #RGB", "#AABBCC түсін #RGB қысқа түрінде жаз"), "#ABC", "text", w("Пары AA, BB, CC → по одной цифре: `#ABC`.", "AA, BB, CC жұптары → біреуден: `#ABC`."), w("Из каждой пары возьми одну цифру.", "Әр жұптан бір цифр ал.")),
  sq("border-box", 3, w("Запиши значение box-sizing, при котором width включает padding и border", "width padding пен border-ді қамтитын box-sizing мәнін жаз"), "border-box", "text", w("`box-sizing: border-box` — `width` считается до рамки включительно.", "`box-sizing: border-box` — `width` жиекті қоса есептеледі."), w("Название говорит, до какого слоя считается ширина.", "Атауы енің қай қабатқа дейін есептелетінін айтады.")),
  sq("hex-88", 3, w("Чему равна 16-ричная пара 88 в десятичной системе?", "Он алтылық 88 жұбы ондық жүйеде неге тең?"), "136", "number", w("88₁₆ = 8 · 16 + 8 = 136.", "88₁₆ = 8 · 16 + 8 = 136."), w("Первая цифра — это шестнадцатки, вторая — единицы.", "Бірінші цифр — он алтылықтар, екіншісі — бірліктер.")),
];

// ---------- Банк навыка ----------

type Gen = (rand: Rand, level: Level, seed: number) => QuestionStep;
const GENS: Record<Level, Gen[]> = {
  1: [widthA],
  2: [widthShort, priority, hexExpand],
  3: [borderBox, reverseWidth, space4, priority, inherit, hexNoShort],
};

/** Доля заданий из статичного пула (знания) на каждом уровне. */
const POOL_SHARE: Record<Level, number> = { 1: 0.65, 2: 0.5, 3: 0.4 };

const layoutBank: SkillBank = {
  skill: SKILL,
  question(level, seed) {
    const rand = seeded(seed);
    if (rand() < POOL_SHARE[level]) return pool.question(level, seed + 99991);
    return pick(rand, GENS[level])(rand, level, seed);
  },
  statement(level, seed): Statement {
    const rand = seeded(seed);
    if (level >= 2 && rand() < 0.35) {
      if (level === 3) {
        const wd = pick(rand, [100, 150, 200, 250]);
        const p = pick(rand, [5, 10, 15, 20]);
        const b = pick(rand, [1, 2, 5]);
        const total = wd + 2 * p + 2 * b;
        const claim = rand() < 0.5 ? total : pick(rand, [wd + p + b, wd, wd + 2 * p]);
        return {
          id: `s:${SKILL}:box:${wd}x${p}x${b}:${claim}`,
          skill: SKILL,
          level,
          text: w(
            `Блок: width ${wd}px, padding ${p}px, border ${b}px. Его полная ширина без margin — ${claim}px`,
            `Блок: width ${wd}px, padding ${p}px, border ${b}px. Оның margin-сіз толық ені — ${claim}px`,
          ),
          value: claim === total,
          explanation: w(`${wd} + 2 · ${p} + 2 · ${b} = ${total}px.`, `${wd} + 2 · ${p} + 2 · ${b} = ${total}px.`),
          hint: w("Padding и border есть и слева, и справа.", "Padding пен border сол жақта да, оң жақта да бар."),
        };
      }
      const d = hexDigits(rand);
      const full = expandHex(d);
      const short = `#${d[0]}${d[1]}${d[2]}`;
      const value = rand() < 0.5;
      const shown = value ? full : `#${d[0]}${d[1]}${d[1]}${d[2]}${d[2]}${d[0]}`;
      return {
        id: `s:${SKILL}:hex:${short.slice(1)}:${shown.slice(1)}`,
        skill: SKILL,
        level: 2,
        text: w(`Цвет ${short} — это то же самое, что ${shown}`, `${short} түсі — ${shown} түсімен бірдей`),
        value: shown === full,
        explanation: w(`Короткая запись повторяет каждую цифру: ${short} = ${full}.`, `Қысқа жазба әр цифрды қайталайды: ${short} = ${full}.`),
        hint: HINT_HEX,
      };
    }
    return pool.statement!(level, seed + 99991);
  },
  pair(level, seed): Pair {
    const rand = seeded(seed);
    if (level === 2 && rand() < 0.3) {
      const d = hexDigits(rand);
      return { id: `p:${SKILL}:hex:${d.join("")}`, skill: SKILL, level, left: `#${d.join("")}`, right: expandHex(d) };
    }
    return pool.pair!(level, seed + 99991);
  },
  short(level, seed): ShortQuestion {
    const rand = seeded(seed);
    if (rand() < 0.35) {
      if (level === 1) {
        const wd = pick(rand, [100, 150, 200, 250, 300]);
        const p = pick(rand, [5, 10, 15, 20]);
        const b = pick(rand, [1, 2, 3, 5]);
        const total = wd + 2 * p + 2 * b;
        return {
          id: `q:${SKILL}:wa:${wd}x${p}x${b}`,
          skill: SKILL,
          level,
          prompt: w(
            `Блок: width ${wd}px, padding ${p}px, border ${b}px. Чему равна его ширина в пикселях (без margin)?`,
            `Блок: width ${wd}px, padding ${p}px, border ${b}px. Оның ені неше пиксель (margin-сіз)?`,
          ),
          answer: String(total),
          mode: "number",
          explanation: same(`${wd} + 2 · ${p} + 2 · ${b} = ${total}`),
          hint: HINT_WIDTH,
        };
      }
      if (level === 3) {
        const wd = pick(rand, [100, 150, 200, 250]);
        const p = pick(rand, [5, 10, 15, 20]);
        const b = pick(rand, [1, 2, 3, 5]);
        const m = pick(rand, [5, 10, 20]);
        const total = wd + 2 * (p + b + m);
        return {
          id: `q:${SKILL}:rev:${wd}x${p}x${b}x${m}`,
          skill: SKILL,
          level,
          prompt: w(
            `Блок вместе с margin ${m}px занимает по горизонтали ${total} px; padding ${p}px, border ${b}px. Чему равна width?`,
            `Блок margin ${m}px болғанда көлденеңінен ${total} px орын алады; padding ${p}px, border ${b}px. width неге тең?`,
          ),
          answer: String(wd),
          mode: "number",
          explanation: w(
            `${total} − 2 · (${p} + ${b} + ${m}) = ${total} − ${2 * (p + b + m)} = ${wd}.`,
            `${total} − 2 · (${p} + ${b} + ${m}) = ${total} − ${2 * (p + b + m)} = ${wd}.`,
          ),
          hint: w("Задача обратная: вычти padding, border и margin с двух сторон.", "Бұл кері есеп: екі жақтағы padding, border және margin алып тастау керек."),
        };
      }
    }
    const items = SHORTS.filter((s) => s.level === level);
    return pick(rand, items.length ? items : SHORTS);
  },
};

export const BANKS: SkillBank[] = [layoutBank];
