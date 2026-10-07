import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// План: бумажный конспект — сетка и числовая прямая; мастерская — конвейер;
// комикс — движение персонажа по ступеням. Одинаковая тема позволяет сравнить подачу.
// Бумага: #f7f3e8 / #fffdf7 / #273c47 / #1a91d6 / #f0b400.
// Мастерская: #081a2a / #10344d / #53c8ed / #f0b400 / #ff7991.
// Комикс: #ffdb56 / #17334a / #ffd0e1 / #cdeefb / #bceadf / #1a91d6.
// Типографика: в конспекте Georgia + Nunito, в мастерской JetBrains Mono + Nunito,
// в комиксе крупный Nunito. Не используем одинаковую сетку карточек во всех листах.
// Подарок соответствует существующей косметике blue-orbit, без новых наград.

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "content-studio/2026-10-07-variants/visuals");
mkdirSync(out, { recursive: true });
const fontLicenses = [
  ["Nunito", "@fontsource-variable/nunito", "OFL-Nunito.txt"],
  ["JetBrains Mono", "@fontsource-variable/jetbrains-mono", "OFL-JetBrains-Mono.txt"],
].map(([name, pkg, file]) => {
  const license = readFileSync(resolve(root, `node_modules/${pkg}/LICENSE`), "utf8");
  writeFileSync(resolve(out, file), license);
  return `${name}\n${license}`;
}).join("\n\n");
const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const font = {
  sans: "Nunito, Arial, sans-serif",
  serif: "Georgia, Times New Roman, serif",
  mono: "JetBrains Mono, Courier New, monospace",
};
function text(x, y, content, size = 24, fill = "#17334a", options = {}) {
  const { family = "sans", weight = 600, anchor = "start", leading = 1.2, rotate, opacity } = options;
  const lines = Array.isArray(content) ? content : [content];
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${font[family]}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}"${rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : ""}${opacity ? ` opacity="${opacity}"` : ""}>${lines.map((l, i) => `<tspan x="${x}" dy="${i ? size * leading : 0}">${esc(l)}</tspan>`).join("")}</text>`;
}
function rect(x, y, w, h, fill, stroke = "none", radius = 0, sw = 1) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}
function line(x1, y1, x2, y2, stroke, width = 2, dash = "") {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
}
function bit(x, y, scale = 1, { happy = true, turn = 0, arms = false } = {}) {
  return `<g transform="translate(${x} ${y}) scale(${scale}) rotate(${turn} 60 60)">
  <ellipse cx="60" cy="110" rx="35" ry="5" fill="#17334a" opacity=".12"/>
  ${arms ? '<path d="M19 85 Q-10 64 -3 46 M102 85 Q132 72 128 50" fill="none" stroke="#1277b3" stroke-width="9" stroke-linecap="round"/>' : ""}
  <path d="M60 14 V27" stroke="#1277b3" stroke-width="4" stroke-linecap="round"/>
  <circle cx="60" cy="11" r="6.5" fill="#f0b400"/>
  ${rect(9, 54, 12, 24, "#1277b3", "none", 6)}${rect(99, 54, 12, 24, "#1277b3", "none", 6)}
  ${rect(17, 26, 86, 78, "#1a91d6", "none", 28)}${rect(25, 30, 70, 16, "#fff", "none", 8).replace('/>', ' opacity=".18"/>')}
  ${rect(28, 42, 64, 50, "#10263d", "none", 17)}
  <g fill="none" stroke="#7fe3ff" stroke-width="5" stroke-linecap="round">${happy ? '<path d="M39 64 q7 -9 14 0 M67 64 q7 -9 14 0"/>' : '<circle cx="46" cy="62" r="3" fill="#7fe3ff"/><circle cx="74" cy="62" r="3" fill="#7fe3ff"/>'}<path d="${happy ? "M50 75 q10 9 20 0" : "M53 76 q7 5 14 0"}" stroke-width="4"/></g>
  <circle cx="35" cy="80" r="4" fill="#ff8fb1" opacity=".55"/><circle cx="85" cy="80" r="4" fill="#ff8fb1" opacity=".55"/>
  </g>`;
}
function orbit(x, y, size = 130, dark = false, comic = false) {
  const c = x + size / 2;
  const cy = y + size / 2;
  return `<g>${rect(x + 8, y + 8, size - 16, size - 16, dark ? "#092438" : "#e8f5fc", "none", size / 2)}
  <circle cx="${c}" cy="${cy}" r="${size * .43}" fill="none" stroke="#1a91d6" stroke-width="${comic ? 8 : 5}"/>
  <ellipse cx="${c}" cy="${cy}" rx="${size * .5}" ry="${size * .21}" fill="none" stroke="${dark ? "#7fe3ff" : "#1277b3"}" stroke-width="3" transform="rotate(-28 ${c} ${cy})"/>
  ${bit(x + size * .15, y + size * .1, size * .7 / 120)}
  <circle cx="${x + size * .85}" cy="${y + size * .24}" r="${size * .045}" fill="#f0b400"/>
  </g>`;
}
function paperCase(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M15 53 L111 9 L220 53 L124 103 Z" fill="#e9edf0" stroke="#273c47" stroke-width="2"/>
  <path d="M15 53 L124 103 L124 186 L15 133 Z" fill="#c6e5f4" stroke="#273c47" stroke-width="2"/>
  <path d="M124 103 L220 53 L220 137 L124 186 Z" fill="#88c2e2" stroke="#273c47" stroke-width="2"/>
  <path d="M52 36 L161 85 L161 165 L136 179 L136 94 L26 48 Z" fill="#f0b400"/>
  <path d="M189 39 L88 89 L88 169 L61 155 L61 78 L165 28 Z" fill="#f8cf49"/>
  <path d="M115 27 Q97 -9 78 13 Q75 31 114 31 Q124 -13 145 7 Q151 27 115 27" fill="none" stroke="#bd8f0c" stroke-width="7" stroke-linecap="round"/>
  ${bit(143, 94, .37)}
  </g>`;
}
function metalCase(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M10 30 L203 30 L233 59 L233 159 L10 159 Z" fill="#10344d" stroke="#53c8ed" stroke-width="3"/>
  <path d="M10 30 L37 5 L228 5 L233 59 L203 30 Z" fill="#1b516e" stroke="#53c8ed" stroke-width="3"/>
  <path d="M22 65 H222 M40 34 V158 M199 34 V158" stroke="#1a91d6" stroke-width="9"/>
  ${rect(90, 65, 48, 46, "#f0b400", "#081a2a", 4, 3)}<path d="M105 86 H123 M114 78 V96" stroke="#081a2a" stroke-width="4"/>
  ${[24, 216].map(cx => [45, 143].map(cy => `<circle cx="${cx}" cy="${cy}" r="4" fill="#7fe3ff"/>`).join("")).join("")}
  <path d="M84 6 V-10 H159 V6" fill="none" stroke="#53c8ed" stroke-width="7"/>
  </g>`;
}
function comicCase(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M0 24 L132 9 L202 50 L68 65 Z" fill="#7bd3f3" stroke="#17334a" stroke-width="4" stroke-linejoin="round"/>
  <path d="M0 24 L68 65 L68 162 L0 120 Z" fill="#1a91d6" stroke="#17334a" stroke-width="4" stroke-linejoin="round"/>
  <path d="M68 65 L202 50 L202 146 L68 162 Z" fill="#54b8e6" stroke="#17334a" stroke-width="4" stroke-linejoin="round"/>
  <path d="M60 17 L121 58 L121 156 L152 151 L152 54 L92 13 Z" fill="#ffdb56" stroke="#17334a" stroke-width="3"/>
  <path d="M0 89 L202 111 V83 L0 61 Z" fill="#ffdb56" stroke="#17334a" stroke-width="3"/>
  <path d="M78 8 Q16 -46 12 -10 Q16 17 78 8 Q118 -45 137 -10 Q143 11 78 8" fill="#ffdb56" stroke="#17334a" stroke-width="4"/>
  </g>`;
}

const copy = {
  ru: {
    paperTitle: "Урок как личный конспект", paperSub: "Схема сначала. Правило становится понятным следом.",
    lesson: "Шагаем через два", intro: "range задаёт начало, границу и шаг последовательности.",
    start: "начало", stop: "граница", step: "шаг", excl: "Граница не входит", exclBody: ["После 8 получаем 10 — это уже за границей 9.", "Поэтому остаются числа 2, 4, 6 и 8."],
    try: "Проверь себя", question: "Какие числа получатся?", check: "Проверить", levelCase: "Кейс уровня", onlyLevel: "Только за новый уровень", cosmetic: "Голубая орбита", cosmeticBody: "Рамка для твоего профиля", onlyLook: "Меняет только внешний вид.", instagram: "Обложка Instagram", paperSocial: ["9 не", "входит."], socialBottom: "Пойми range на одной схеме", more: "Сначала 2. Дальше прибавляем 2.", workshopTitle: "Мастерская кода", workshopSub: "Разбираем правило как работающий механизм.", benchTitle: "Настрой шаг — проследи результат", before: "Стоп перед 9", output: "Результат", bitSays: ["Не добавляй границу", "в последовательность."], workshopGift: "Оформление профиля из кейса", workshopSocial: ["Стоп —", "это не шаг"], workshopPost: "Разберись в range", comicTitle: "Код тоже может быть комиксом", comicSub: "Один прыжок — один шаг. Бит показывает, как это работает.", bubble: "range(2, 9, 2): прыгаем через два!", finish: "9 — граница. Последнее число здесь — 8.", yourTurn: "Твой ход", newLevel: ["Новый уровень —", "открывай кейс!"], comicSocial: ["Не", "ошибка.", "Шаг 2."], comicPost: "Python без скучных правил", galleryTitle: "Три способа объяснить одно правило", gallerySub: "Урок, подарок за уровень и обложка Instagram в одном стиле. Выбери, какое направление подходит сервису.", galleryNote: "Это визуальные концепции для обсуждения. Кейс выдаётся только за новый уровень; внутри — оформление профиля.", paperName: "Бумажный конспект", paperDesc: "Большая числовая прямая, заметки на полях и спокойная бумажная фактура.", workshopName: "Техническая мастерская", workshopDesc: "Конвейер, граница-ограничитель и Бит, который помогает читать схему.", comicName: "Геометрический комикс", comicDesc: "Бит прыгает по числам; правило превращается в короткую историю.", svgLink: "Открыть SVG", pngLink: "Скачать PNG", contactLink: "Общий лист (русский)", language: "Язык материалов", selected: "Показан русский", formats: "SVG: 1600 × 1200. Все иллюстрации — векторные.", concept: "Концепция", preview: "Увеличить лист",
  },
  kk: {
    paperTitle: "Өз конспектіңдей түсінікті сабақ", paperSub: "Алдымен сызба. Содан кейін ереже түсінікті болады.",
    lesson: "Екі қадаммен жүреміз", intro: "range тізбектің басын, шекарасын және қадамын береді.",
    start: "басы", stop: "шекара", step: "қадам", excl: "Шекара тізбекке кірмейді", exclBody: ["8-ден кейін 10 шығады. Ол 9 шекарасынан асып кетеді.", "Сондықтан тізбекте 2, 4, 6 және 8 қалады."],
    try: "Өзіңді тексер", question: "Қандай сандар шығады?", check: "Тексеру", levelCase: "Деңгей кейсі", onlyLevel: "Тек жаңа деңгейге жеткенде", cosmetic: "Көгілдір орбита", cosmeticBody: "Профиліңе арналған жақтау", onlyLook: "Тек сыртқы көріністі өзгертеді.", instagram: "Instagram мұқабасы", paperSocial: ["9 тізбекке", "кірмейді."], socialBottom: "range-ті бір сызбамен түсін", more: "Алдымен 2. Әр жолы 2-ні қосамыз.", workshopTitle: "Код шеберханасы", workshopSub: "Ережені жұмыс істейтін механизм арқылы түсінеміз.", benchTitle: "Қадамды орнат та, нәтижені бақыла", before: "9-ға жетпей тоқта", output: "Нәтиже", bitSays: ["Шекараны тізбекке", "қоспа."], workshopGift: "Кейстен профиль жақтауы шығады", workshopSocial: ["Шекара —", "қадам емес"], workshopPost: "range-ті түсініп ал", comicTitle: "Кодты комикспен де түсінуге болады", comicSub: "Бір секіріс — бір қадам. Бит оның қалай жұмыс істейтінін көрсетеді.", bubble: "range(2, 9, 2): екі қадамнан секіреміз!", finish: "9 — шекара. Мұндағы соңғы сан — 8.", yourTurn: "Енді сен көр", newLevel: ["Жаңа деңгей —", "кейсті аш!"], comicSocial: ["Қате", "емес.", "Қадам 2."], comicPost: "Python-ды қызықты үйрен", galleryTitle: "Бір ережені түсіндірудің үш жолы", gallerySub: "Сабақ, жаңа деңгей сыйлығы және Instagram мұқабасы бір стильде. Сервиске сай келетін бағытты таңда.", galleryNote: "Бұл — талқылауға арналған көрнекі тұжырымдамалар. Кейс тек жаңа деңгейге жеткенде беріледі; ішінде — профильді безендіру.", paperName: "Қағаз конспект", paperDesc: "Үлкен сан сәулесі, жиектегі жазбалар және жайлы қағаз реңкі.", workshopName: "Техникалық шеберхана", workshopDesc: "Конвейер, шекара шектеуі және сызбаны оқуға көмектесетін Бит.", comicName: "Геометриялық комикс", comicDesc: "Бит сандардың үстімен секіреді; ереже қысқа оқиғаға айналады.", svgLink: "SVG ашу", pngLink: "PNG жүктеу", contactLink: "Жалпы парақ (орысша)", language: "Материалдар тілі", selected: "Қазақша көрсетілген", formats: "SVG: 1600 × 1200. Барлық сурет — векторлық.", concept: "Тұжырымдама", preview: "Парақты үлкейту",
  },
};

function fontCss() {
  const fonts = [
    ["Nunito", "nunito", "@fontsource-variable/nunito"],
    ["JetBrains Mono", "jetbrains-mono", "@fontsource-variable/jetbrains-mono"],
  ];
  const ranges = { "latin": "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD", "cyrillic": "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116", "cyrillic-ext": "U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F" };
  return fonts.flatMap(([name, prefix, pkg]) => Object.entries(ranges).map(([subset, range]) => {
    const data = readFileSync(resolve(root, `node_modules/${pkg}/files/${prefix}-${subset}-wght-normal.woff2`)).toString("base64");
    return `@font-face{font-family:'${name}';font-style:normal;font-weight:200 900;src:url(data:font/woff2;base64,${data}) format('woff2');unicode-range:${range};}`;
  })).join("");
}
const fonts = fontCss();
function svg(body, label, lang) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200" role="img" aria-labelledby="title desc" xml:lang="${lang}"><title id="title">${esc(label)}</title><desc id="desc">${esc(copy[lang].galleryNote)}</desc><metadata id="font-licenses">${esc(fontLicenses)}</metadata><defs><style>${fonts}</style><pattern id="paper-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#b8c8c7" stroke-width=".7" opacity=".65"/></pattern><pattern id="blueprint-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#53c8ed" stroke-width=".7" opacity=".15"/></pattern><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.3" fill="#17334a" opacity=".1"/></pattern><marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto"><path d="M0 0 L7 3 L0 6" fill="none" stroke="#1a91d6" stroke-width="1.4"/></marker><marker id="gold-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0 0 L7 3 L0 6" fill="none" stroke="#f0b400" stroke-width="1.6"/></marker></defs>${body}</svg>`;
}

function paper(lang) {
  const c = copy[lang];
  const ink = "#273c47";
  let b = rect(0, 0, 1600, 1200, "#f7f3e8") + rect(0, 0, 1600, 1200, "url(#paper-grid)");
  b += text(66, 101, c.paperTitle, lang === "kk" ? 48 : 54, ink, { family: "serif", weight: 700 });
  b += text(69, 143, c.paperSub, 23, ink);
  b += bit(1432, 40, .9, { happy: false });
  b += rect(56, 185, 983, 946, "#fffdf7", ink, 9, 2);
  b += rect(57, 186, 981, 944, "url(#paper-grid)", "none", 8);
  b += line(121, 187, 121, 1130, "#cd797e", 1.5);
  [240, 380, 520, 660, 800, 940, 1080].forEach(y => { b += `<circle cx="83" cy="${y}" r="12" fill="#f7f3e8" stroke="#b6c2c5" stroke-width="1.5"/>`; });
  b += text(148, 248, "Python / range", 20, "#4f6b75", { family: "mono", weight: 500 });
  b += text(145, 306, c.lesson, 43, ink, { family: "serif", weight: 700 });
  b += text(148, 346, c.intro, lang === "kk" ? 21 : 22, ink);
  b += rect(147, 375, 820, 102, "#e8f5fc", "#98b6c4", 4, 1.4);
  b += text(171, 438, "range(2, 9, 2)", 44, "#145b80", { family: "mono", weight: 600 });
  b += text(649, 412, c.start + " = 2", 19, ink, { family: "mono", weight: 500 });
  b += text(649, 438, c.stop + " = 9", 19, ink, { family: "mono", weight: 500 });
  b += text(649, 464, c.step + " = 2", 19, ink, { family: "mono", weight: 500 });
  b += text(148, 524, c.more, 24, ink);
  b += `<path d="M175 621 H980" stroke="${ink}" stroke-width="3" fill="none"/>`;
  [2, 4, 6, 8].forEach((n, i) => {
    const x = 228 + 195 * i;
    b += line(x, 611, x, 633, ink, 2);
    b += `<circle cx="${x}" cy="621" r="24" fill="#1a91d6" stroke="#fffdf7" stroke-width="4"/>`;
    b += text(x, 630, n, 26, "#fff", { anchor: "middle", weight: 800 });
    if (i < 3) {
      b += `<path d="M${x + 29} 603 Q${x + 98} 554 ${x + 166} 603" stroke="#1a91d6" stroke-width="2.5" fill="none" marker-end="url(#arrow)"/>`;
      b += text(x + 98, 574, "+2", 20, "#145b80", { anchor: "middle", family: "mono" });
    }
  });
  b += line(912, 559, 912, 684, "#b84c60", 2.5, "6 6");
  b += `<circle cx="912" cy="621" r="24" fill="#fffdf7" stroke="#b84c60" stroke-width="2.5"/>`;
  b += text(912, 630, "9", 26, "#b84c60", { anchor: "middle", weight: 700 });
  b += text(912, 705, c.stop, 19, "#b84c60", { anchor: "middle" });
  b += bit(145, 728, 1.14, { happy: false });
  b += rect(318, 747, 650, 126, "#fff8dd", "#ccb773", 3, 1.4);
  b += `<path d="M318 793 L295 802 L318 816" fill="#fff8dd" stroke="#ccb773" stroke-width="1.4"/>`;
  b += text(341, 782, c.excl, lang === "kk" ? 26 : 29, ink, { family: "serif", weight: 700 });
  b += text(341, 816, c.exclBody, lang === "kk" ? 19 : 20, ink, { leading: 1.5 });
  b += line(147, 906, 967, 906, "#6a8a95", 1.2);
  b += text(148, 948, c.try, 27, ink, { family: "serif", weight: 700 });
  b += text(148, 984, c.question, 22, ink);
  b += text(148, 1032, "range(1, 8, 3)", 32, ink, { family: "mono", weight: 600 });
  b += rect(148, 1060, 266, 48, "#fffdf7", "#98b6c4", 5, 1.5) + text(281, 1092, "1, 4, 7", 25, ink, { family: "mono", anchor: "middle" });
  b += rect(769, 1029, 198, 61, "#1a91d6", "none", 5) + text(868, 1068, c.check, 23, "white", { anchor: "middle", weight: 800 });
  b += rect(1071, 185, 474, 438, "#fffdf7", ink, 9, 2);
  b += text(1101, 234, c.levelCase, 32, ink, { family: "serif", weight: 700 });
  b += text(1101, 270, c.onlyLevel, 21, ink);
  b += paperCase(1168, 279, 1.04);
  b += orbit(1110, 492, 101);
  b += text(1230, 531, c.cosmetic, lang === "kk" ? 23 : 22, ink, { weight: 800 });
  b += text(1230, 560, c.cosmeticBody, lang === "kk" ? 17 : 18, ink);
  b += text(1230, 586, c.onlyLook, 17, ink);
  b += rect(1071, 650, 474, 481, "#fffdf7", ink, 9, 2);
  b += text(1101, 697, c.instagram, 26, ink, { family: "serif", weight: 700 });
  b += rect(1101, 722, 414, 379, "#deeff2", "#98b6c4", 0, 1.5);
  b += rect(1101, 722, 414, 379, "url(#paper-grid)");
  b += text(1122, 799, c.paperSocial, lang === "kk" ? 47 : 66, ink, { family: "serif", weight: 700, leading: 1.05 });
  b += text(1125, 924, "range(2, 9, 2)", 25, "#145b80", { family: "mono", weight: 600 });
  b += line(1125, 950, 1358, 950, ink, 2);
  b += text(1125, 983, "2   4   6   8", 24, ink, { family: "mono", weight: 700 });
  b += bit(1375, 932, .95, { turn: -8 });
  b += text(1125, 1056, c.socialBottom, 20, ink);
  b += text(1125, 1084, "Informatica", 17, "#145b80", { weight: 800 });
  return svg(b, c.paperName, lang);
}

function workshop(lang) {
  const c = copy[lang];
  const ink = "#d8f3ff";
  let b = rect(0, 0, 1600, 1200, "#081a2a") + rect(0, 0, 1600, 1200, "url(#blueprint-grid)");
  b += bit(56, 40, .86, { happy: false });
  b += text(179, 104, c.workshopTitle, 55, ink, { family: "mono", weight: 700 });
  b += text(183, 146, c.workshopSub, 24, "#93bed3");
  b += line(64, 181, 1536, 181, "#2c708b", 2);
  b += [64, 800, 1536].map(x => `<path d="M${x} 171 V191" stroke="#53c8ed" stroke-width="3"/>`).join("");
  b += rect(64, 212, 1472, 572, "#0b2539", "#53c8ed", 3, 2);
  b += rect(82, 230, 1436, 536, "url(#blueprint-grid)");
  b += text(104, 280, c.benchTitle, lang === "kk" ? 39 : 42, ink, { weight: 800 });
  b += text(106, 357, "range(2, 9, 2)", 49, "#7fe3ff", { family: "mono", weight: 600 });
  b += rect(736, 314, 414, 73, "#10344d", "#296781", 0, 1.5);
  b += text(756, 342, `${c.start} = 2  /  ${c.step} = 2`, 20, ink, { family: "mono", weight: 500 });
  b += text(756, 372, `${c.stop} = 9`, 20, "#ff91a5", { family: "mono", weight: 500 });
  b += `<path d="M118 634 H1150 V693 H118 Z" fill="#0d3147" stroke="#53c8ed" stroke-width="3"/>`;
  b += line(119, 653, 1148, 653, "#53c8ed", 2) + line(119, 677, 1148, 677, "#53c8ed", 2);
  for (let i = 0; i < 17; i++) {
    b += `<circle cx="${145 + 58 * i}" cy="665" r="8" fill="#081a2a" stroke="#2c708b" stroke-width="2"/>`;
  }
  [2, 4, 6, 8].forEach((n, i) => {
    const x = 150 + i * 224;
    b += rect(x, 484, 146, 138, "#114966", "#7fe3ff", 2, 2.5);
    b += `<path d="M${x + 15} 485 V473 H${x + 130} V485" fill="none" stroke="#53c8ed" stroke-width="3"/>`;
    b += text(x + 73, 573, n, 68, "#d8f3ff", { family: "mono", anchor: "middle", weight: 700 });
    b += [x + 12, x + 133].map(cx => `<circle cx="${cx}" cy="607" r="4" fill="#7fe3ff"/>`).join("");
    if (i < 3) {
      b += `<path d="M${x + 153} 545 H${x + 209}" stroke="#f0b400" stroke-width="3" fill="none" marker-end="url(#gold-arrow)"/>`;
      b += text(x + 182, 522, "+2", 19, "#f0b400", { family: "mono", anchor: "middle" });
    }
  });
  b += `<path d="M1056 446 V692" stroke="#ff7991" stroke-width="9"/><path d="M1032 447 H1109 M1032 692 H1109" stroke="#ff7991" stroke-width="5"/>`;
  b += text(1056, 427, c.before, lang === "kk" ? 18 : 20, "#ff91a5", { anchor: "middle", family: "mono" });
  b += rect(1077, 519, 47, 92, "#081a2a", "#ff7991", 2, 1.5);
  b += text(1100, 580, "9", 42, "#ff91a5", { family: "mono", anchor: "middle", weight: 600 });
  b += text(110, 747, `${c.output}:  2  4  6  8`, 25, "#7fe3ff", { family: "mono", weight: 600 });
  b += line(1187, 314, 1187, 741, "#2c708b", 1.5, "5 8");
  b += bit(1226, 389, 2.04, { arms: true });
  b += text(1357, 687, c.bitSays, 23, ink, { anchor: "middle", leading: 1.45 });
  b += rect(64, 819, 755, 312, "#0b2539", "#53c8ed", 3, 2);
  b += text(101, 867, c.levelCase, 29, ink, { family: "mono", weight: 700 });
  b += text(101, 901, c.onlyLevel, 21, "#93bed3");
  b += metalCase(104, 948, .85);
  b += `<path d="M329 1026 H390" stroke="#f0b400" stroke-width="3" fill="none" marker-end="url(#gold-arrow)"/>`;
  b += orbit(422, 963, 130, true);
  b += text(577, 1005, c.cosmetic, lang === "kk" ? 24 : 22, ink, { weight: 800 });
  b += text(577, 1037, lang === "ru" ? ["Рамка для", "твоего профиля"] : ["Профиліңе", "арналған жақтау"], 19, "#93bed3", { leading: 1.25 });
  b += rect(853, 819, 683, 312, "#10344d", "#53c8ed", 3, 2);
  b += text(889, 869, c.instagram, 23, ink, { family: "mono", weight: 500 });
  b += text(889, 936, c.workshopSocial, lang === "kk" ? 39 : 42, ink, { weight: 900, leading: 1.18 });
  b += text(889, 1080, c.workshopPost, 21, "#7fe3ff");
  b += rect(1231, 844, 280, 260, "#081a2a", "#53c8ed", 0, 1.5);
  b += rect(1231, 844, 280, 260, "url(#blueprint-grid)");
  b += text(1246, 881, "range(2, 9, 2)", 17, "#7fe3ff", { family: "mono", weight: 700 });
  b += `<path d="M1250 1002 H1491" fill="none" stroke="#53c8ed" stroke-width="3"/>`;
  [2, 4, 6, 8].forEach((n, i) => { b += rect(1250 + i * 58, 935, 44, 55, "#114966", "#7fe3ff", 0, 1.5) + text(1272 + i * 58, 974, n, 30, ink, { family: "mono", anchor: "middle" }); });
  b += line(1493, 917, 1493, 1014, "#ff7991", 5);
  b += text(1272, 1038, "2 → 4 → 6 → 8", 18, "#f0b400", { family: "mono", weight: 500 });
  b += text(1249, 1080, "Informatica", 17, ink, { weight: 800 });
  b += bit(1409, 1019, .58, { turn: 5 });
  b += text(64, 1170, c.onlyLook, 18, "#93bed3");
  return svg(b, c.workshopName, lang);
}

function comic(lang) {
  const c = copy[lang];
  const ink = "#17334a";
  let b = rect(0, 0, 1600, 1200, "#ffdb56") + rect(0, 0, 1600, 1200, "url(#dots)");
  b += text(64, 101, c.comicTitle, lang === "kk" ? 47 : 56, ink, { weight: 900 });
  b += text(68, 149, c.comicSub, lang === "kk" ? 23 : 24, ink, { weight: 700 });
  b += `<path d="M61 191 L1097 181 L1097 758 L57 770 Z" fill="#fffdf3" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>`;
  b += `<path d="M96 212 L1045 212 Q1067 212 1067 234 V300 Q1067 322 1045 322 H365 L337 361 L341 322 H96 Q78 322 78 300 V234 Q78 212 96 212 Z" fill="#cdeefb" stroke="${ink}" stroke-width="4"/>`;
  b += text(572, 279, c.bubble, lang === "kk" ? 34 : 36, ink, { anchor: "middle", weight: 900 });
  b += `<path d="M109 623 Q398 730 930 438" fill="none" stroke="#c5e6ec" stroke-width="13" stroke-linecap="round"/>`;
  b += bit(98, 380, 2.1, { arms: true, turn: -9 });
  const stones = [{ x: 408, y: 580, n: 2, fill: "#1a91d6" }, { x: 565, y: 524, n: 4, fill: "#33a9d7" }, { x: 722, y: 469, n: 6, fill: "#53bddb" }, { x: 879, y: 414, n: 8, fill: "#83d5e5" }];
  stones.forEach(({ x, y, n, fill }, i) => {
    b += `<path d="M${x} ${y} L${x + 132} ${y - 9} L${x + 137} ${y + 66} L${x + 7} ${y + 80} Z" fill="${fill}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
    b += text(x + 69, y + 47, n, 52, ink, { anchor: "middle", weight: 900 });
    if (i < 3) {
      b += `<path d="M${x + 89} ${y - 17} Q${x + 129} ${y - 84} ${x + 184} ${y - 73}" fill="none" stroke="#1a91d6" stroke-width="4" marker-end="url(#arrow)"/>`;
      b += text(x + 122, y - 84, "+2", 22, ink, { weight: 900, rotate: -13 });
    }
  });
  b += `<path d="M1015 369 V625" stroke="#cb4763" stroke-width="8" stroke-dasharray="12 9"/>`;
  b += `<path d="M985 357 L1044 349 L1049 405 L990 412 Z" fill="#ffd0e1" stroke="#cb4763" stroke-width="3"/>`;
  b += text(1017, 393, "9", 36, "#a1314d", { anchor: "middle", weight: 900, rotate: -8 });
  b += rect(369, 686, 672, 51, "#ffed99", ink, 9, 2.5) + text(705, 720, c.finish, lang === "kk" ? 23 : 22, ink, { anchor: "middle", weight: 800 });
  b += `<path d="M1131 193 L1539 202 L1536 766 L1131 759 Z" fill="#ffd0e1" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>`;
  b += text(1156, 248, c.instagram, 24, ink, { weight: 800 });
  b += rect(1156, 273, 353, 459, "#ffa856", ink, 0, 3);
  b += `<path d="M1157 655 L1356 274 H1508 L1265 731 H1157 Z" fill="#ffdb56"/>`;
  b += text(1180, 344, c.comicSocial, lang === "kk" ? 50 : 54, ink, { weight: 900, leading: 1.03 });
  b += bit(1274, 468, 1.42, { arms: true, turn: 10 });
  [2, 4, 6, 8].forEach((n, i) => {
    const x = 1177 + i * 77;
    const y = 642 - (i % 2) * 11;
    b += `<g transform="rotate(${i % 2 ? 5 : -6} ${x + 30} ${y + 25})">${rect(x, y, 62, 52, "#fffdf3", ink, 6, 3)}${text(x + 31, y + 38, n, 35, ink, { anchor: "middle", weight: 900 })}</g>`;
  });
  b += text(1180, 718, "Informatica", 20, ink, { weight: 900 });
  b += `<path d="M60 804 L739 788 L733 1136 L61 1123 Z" fill="#cdeefb" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>`;
  b += text(92, 858, c.yourTurn, 36, ink, { weight: 900 });
  b += text(94, 900, c.question, 25, ink, { weight: 700 });
  b += text(95, 958, "range(1, 8, 3)", 38, ink, { family: "mono", weight: 700 });
  b += rect(93, 1000, 286, 79, "#fffdf3", ink, 12, 3) + text(236, 1052, "1, 4, 7", 35, ink, { family: "mono", anchor: "middle", weight: 700 });
  b += rect(477, 1005, 217, 71, "#1a91d6", ink, 10, 3) + text(585, 1050, c.check, 27, "#fff", { anchor: "middle", weight: 900 });
  b += `<path d="M777 790 L1536 801 L1541 1132 L774 1137 Z" fill="#bceadf" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>`;
  b += text(815, 849, c.newLevel, 29, ink, { weight: 900, leading: 1.13 });
  b += `<path d="M839 929 L816 918 M858 909 L856 884 M884 909 L898 888" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`;
  b += comicCase(821, 948, .78);
  b += `<path d="M1012 1018 Q1052 982 1101 1010" fill="none" stroke="#1a91d6" stroke-width="4" marker-end="url(#arrow)"/>`;
  b += orbit(1125, 916, 145, false, true);
  b += text(1293, 965, lang === "ru" ? ["Голубая", "орбита"] : ["Көгілдір", "орбита"], 28, ink, { weight: 900, leading: 1.05 });
  b += text(1293, 1040, lang === "ru" ? ["Рамка", "для профиля"] : ["Профильге", "арналған жақтау"], lang === "kk" ? 21 : 22, ink, { weight: 700, leading: 1.25 });
  b += text(819, 1102, c.onlyLook, 21, ink, { weight: 700 });
  b += text(64, 1171, c.onlyLevel, 22, ink, { weight: 800 });
  return svg(b, c.comicName, lang);
}

const makers = { paper, workshop, comic };
for (const [name, make] of Object.entries(makers)) {
  for (const lang of ["ru", "kk"]) {
    writeFileSync(resolve(out, `${name}-${lang}.svg`), make(lang).replace(/[ \t]+$/gm, "").trimEnd() + "\n");
  }
}

const translations = Object.fromEntries(Object.entries(copy).map(([lang, c]) => [lang, Object.fromEntries(Object.entries(c).filter(([key]) => key.startsWith("gallery") || key.endsWith("Name") || key.endsWith("Desc") || ["svgLink", "pngLink", "contactLink", "language", "selected", "formats", "concept", "preview"].includes(key)))]));
const style = `:root{font-family:Nunito,Arial,sans-serif;color:#17334a;background:#f3f8fa}*{box-sizing:border-box}body{margin:0}a{color:#086a9e;text-decoration-thickness:1px;text-underline-offset:4px}a:focus-visible,button:focus-visible{outline:3px solid #f0b400;outline-offset:4px}button{font:inherit}header{padding:44px max(22px,calc((100vw - 1240px)/2));background:#fff;border-bottom:1px solid #c2d7e2}header .brand{display:flex;align-items:center;gap:16px}h1{font-size:clamp(28px,4vw,49px);line-height:1.12;max-width:890px;margin:14px 0 17px;font-weight:900}header p{font-size:20px;max-width:860px;line-height:1.5;margin:0}.tools{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-top:26px}.language{display:flex;align-items:center;gap:15px;flex-wrap:wrap}.switch{display:flex;gap:6px;padding:4px;border:1px solid #aac8d9;border-radius:12px;background:#eef6fa}.switch button{background:transparent;border:0;border-radius:8px;cursor:pointer;padding:11px 15px;font-weight:800;color:#17334a;min-height:44px}.switch button[aria-pressed=true]{background:#0879b8;color:#fff}main{max-width:1240px;margin:0 auto;padding:28px 22px 54px}.note{font-size:17px;line-height:1.5;max-width:920px;padding-left:18px;border-left:4px solid #f0b400;margin-bottom:30px}.toc{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:35px}.concept{margin:0 0 45px}.concept-head{display:flex;align-items:baseline;justify-content:space-between;gap:15px}.concept h2{font-size:28px;font-weight:900;margin:0 0 7px}.concept p{font-size:18px;line-height:1.45;margin:0 0 18px;max-width:880px}.preview{display:block;background:white;border:1px solid #c0d3dc;border-radius:10px;overflow:hidden;box-shadow:0 9px 30px #17334a14}.preview img{display:block;width:100%;height:auto}.links{display:flex;gap:20px;flex-wrap:wrap;font-size:17px;margin-top:15px}.formats{font-size:16px;color:#456271;margin-top:30px}.letter{font:800 20px 'JetBrains Mono',monospace;display:inline-block;padding-right:8px}footer{border-top:1px solid #c2d7e2;padding:24px 22px;text-align:center;font-size:15px}@media(max-width:550px){header{padding-top:25px}.brand svg{width:70px;height:70px}header p{font-size:18px}.concept-head{align-items:flex-start;flex-direction:column}.toc{gap:13px}.concept h2{font-size:24px}.concept p{font-size:16px}.language{font-size:16px;gap:10px}main{padding:23px 14px}.note{font-size:15px}.links{gap:16px;font-size:16px}}`;
const galleryBit = `<svg width="92" height="92" viewBox="0 0 120 120" aria-hidden="true">${bit(0, 0, 1)}</svg>`;
const sections = Object.keys(makers).map((name, i) => `<section class="concept" id="${name}"><div class="concept-head"><h2><span class="letter">${String.fromCharCode(65 + i)}</span><span data-copy="${name}Name">${esc(copy.ru[`${name}Name`])}</span></h2></div><p data-copy="${name}Desc">${esc(copy.ru[`${name}Desc`])}</p><a class="preview" data-preview="${name}" href="${name}-ru.svg" target="_blank" rel="noopener" aria-label="${esc(copy.ru.preview)}"><img data-image="${name}" src="${name}-ru.svg" width="1600" height="1200" alt="${esc(copy.ru[`${name}Name`])}" loading="lazy"/></a><div class="links"><a data-svg="${name}" href="${name}-ru.svg" target="_blank" rel="noopener" data-copy="svgLink">${copy.ru.svgLink}</a><a data-png="${name}" href="${name}-ru.png" download data-copy="pngLink">${copy.ru.pngLink}</a></div></section>`).join("");
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Визуальные варианты / Көрнекі нұсқалар — Informatica</title><style>${fonts}${style}</style></head><body><header><div class="brand">${galleryBit}<span style="font-size:22px;font-weight:900">Informatica</span></div><h1 data-copy="galleryTitle">${copy.ru.galleryTitle}</h1><p data-copy="gallerySub">${copy.ru.gallerySub}</p><div class="tools"><div class="language"><span data-copy="language">${copy.ru.language}</span><div class="switch" role="group" aria-label="${copy.ru.language}" id="language-switch"><button type="button" data-lang="ru" aria-pressed="true">Русский</button><button type="button" data-lang="kk" aria-pressed="false">Қазақша</button></div></div><a href="contact-sheet.png" target="_blank" rel="noopener" data-copy="contactLink">${copy.ru.contactLink}</a></div></header><main><p class="note" data-copy="galleryNote">${copy.ru.galleryNote}</p><nav class="toc" aria-label="${copy.ru.concept}" id="toc">${Object.keys(makers).map((name, i) => `<a href="#${name}"><span class="letter">${String.fromCharCode(65 + i)}</span><span data-copy="${name}Name">${copy.ru[`${name}Name`]}</span></a>`).join("")}</nav>${sections}<p class="formats" data-copy="formats">${copy.ru.formats}</p><span id="status" aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden">${copy.ru.selected}</span></main><footer>Informatica · 07.10.2026</footer><script>const strings=${JSON.stringify(translations)};function choose(lang){const c=strings[lang];document.documentElement.lang=lang;document.querySelectorAll('[data-copy]').forEach(el=>el.textContent=c[el.dataset.copy]);document.querySelectorAll('[data-lang]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.lang===lang)));document.querySelectorAll('[data-image]').forEach(el=>{el.src=el.dataset.image+'-'+lang+'.svg';el.alt=c[el.dataset.image+'Name']});document.querySelectorAll('[data-preview]').forEach(el=>{el.href=el.dataset.preview+'-'+lang+'.svg';el.setAttribute('aria-label',c.preview+': '+c[el.dataset.preview+'Name'])});document.querySelectorAll('[data-svg]').forEach(el=>el.href=el.dataset.svg+'-'+lang+'.svg');document.querySelectorAll('[data-png]').forEach(el=>el.href=el.dataset.png+'-'+lang+'.png');document.getElementById('language-switch').setAttribute('aria-label',c.language);document.getElementById('toc').setAttribute('aria-label',c.concept);document.getElementById('status').textContent=c.selected;try{localStorage.setItem('visual-variants-lang',lang)}catch{}}document.querySelectorAll('[data-lang]').forEach(el=>el.addEventListener('click',()=>choose(el.dataset.lang)));try{const saved=localStorage.getItem('visual-variants-lang');if(saved==='ru'||saved==='kk')choose(saved)}catch{}</script></body></html>`;
writeFileSync(resolve(out, "index.html"), html.replace(/[ \t]+$/gm, "").trimEnd() + "\n");
console.log(`Created 6 SVG sheets and gallery: ${out}`);

// SVG и HTML независимы от сети: шрифты Nunito и JetBrains Mono встроены.
// --png добавляет браузерный экспорт с точной загрузкой встроенных шрифтов.
if (process.argv.includes("--png")) {
  const { chromium } = await import("playwright");
  const sharp = (await import("sharp")).default;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
  for (const name of Object.keys(makers)) {
    for (const lang of ["ru", "kk"]) {
      await page.goto(`file://${resolve(out, `${name}-${lang}.svg`)}`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: resolve(out, `${name}-${lang}.png`), animations: "disabled" });
    }
  }
  await browser.close();
  const thumbs = await Promise.all(Object.keys(makers).map(name => sharp(resolve(out, `${name}-ru.png`)).resize(800, 600).png().toBuffer()));
  await sharp({ create: { width: 2400, height: 600, channels: 3, background: "#f3f8fa" } }).composite(thumbs.map((input, i) => ({ input, left: i * 800, top: 0 }))).png().toFile(resolve(out, "contact-sheet.png"));
  console.log("Exported RU/KK PNG and contact-sheet.png");
}
