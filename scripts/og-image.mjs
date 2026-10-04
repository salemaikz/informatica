/**
 * Картинка превью ссылки (WhatsApp, Telegram, Instagram): public/og.png, 1200×630.
 *
 *   node scripts/og-image.mjs
 *
 * HTML со шрифтом Nunito (node_modules/@fontsource-variable/nunito, вшит в страницу как base64),
 * маскот «Бит» — копия SVG из src/components/mascot/Mascot.tsx (настроение happy), цвета — из src/app/globals.css (светлая тема).
 * Снимает Chromium через playwright. Путь к браузеру: PW_CHROMIUM_PATH или /opt/pw-browsers/chromium-1194/chrome-linux/chrome
 * (в облачной среде Claude Code); если такого нет — браузер Playwright по умолчанию.
 * Перегенерировать при смене маскота, цветов бренда или названия; результат коммитить.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public", "og.png");
const W = 1200;
const H = 630;
const MAX_BYTES = 300 * 1024;

// ---------- цвета бренда из globals.css (первый блок :root — светлая тема) ----------

const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const token = (name) => {
  const v = rootBlock.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`))?.[1];
  if (!v) throw new Error(`Нет токена --${name} в globals.css`);
  return v;
};
const C = Object.fromEntries(
  ["bg", "surface", "border", "text", "muted", "primary", "primary-strong", "primary-soft", "gold", "gold-soft", "ai", "ai-soft", "success", "success-soft"].map((n) => [n, token(n)]),
);

// ---------- маскот: копия из Mascot.tsx с проверкой, что оригинал не изменился ----------

const mascotSrc = readFileSync(path.join(root, "src/components/mascot/Mascot.tsx"), "utf8");
const MASCOT_MARKERS = [
  'const EYE = "#7fe3ff"',
  '<rect x="17" y="26" width="86" height="78" rx="28" fill="#1a91d6" />',
  '<rect x="28" y="42" width="64" height="50" rx="17" fill="#10263d" />',
  '<path d="M39 64 q7 -9 14 0" />',
  '<path d="M50 75 q10 9 20 0" {...common} />',
  'fill={mood === "sad" ? "#9aa6b8" : "#f0b400"}',
];
for (const m of MASCOT_MARKERS) {
  if (!mascotSrc.includes(m)) {
    console.error(`Маскот в Mascot.tsx изменился (нет «${m}»). Обнови копию SVG в scripts/og-image.mjs.`);
    process.exit(1);
  }
}
const EYE = "#7fe3ff";
const MASCOT = `
<svg viewBox="0 0 120 120" width="100%" height="100%" overflow="visible" aria-hidden="true">
  <line x1="60" y1="14" x2="60" y2="27" stroke="#1277b3" stroke-width="4" stroke-linecap="round" />
  <circle cx="60" cy="11" r="6.5" fill="#f0b400" />
  <rect x="9" y="54" width="12" height="24" rx="6" fill="#1277b3" />
  <rect x="99" y="54" width="12" height="24" rx="6" fill="#1277b3" />
  <rect x="17" y="26" width="86" height="78" rx="28" fill="#1a91d6" />
  <rect x="25" y="30" width="70" height="16" rx="8" fill="#fff" opacity="0.18" />
  <rect x="28" y="42" width="64" height="50" rx="17" fill="#10263d" />
  <g stroke="${EYE}" stroke-width="5" stroke-linecap="round" fill="none">
    <path d="M39 64 q7 -9 14 0" />
    <path d="M67 64 q7 -9 14 0" />
  </g>
  <path d="M50 75 q10 9 20 0" stroke="${EYE}" stroke-width="4" stroke-linecap="round" fill="none" />
  <circle cx="35" cy="80" r="4" fill="#ff8fb1" opacity="0.55" />
  <circle cx="85" cy="80" r="4" fill="#ff8fb1" opacity="0.55" />
</svg>`;

// ---------- шрифт Nunito (вшиваем, чтобы страница не ходила в сеть) ----------

const fontDir = path.join(root, "node_modules/@fontsource-variable/nunito");
const fontCss = readFileSync(path.join(fontDir, "index.css"), "utf8")
  .replace(/url\(\.\/files\/([^)]+\.woff2)\)/g, (_, file) => {
    const p = path.join(fontDir, "files", file);
    return `url(data:font/woff2;base64,${readFileSync(p).toString("base64")})`;
  })
  .replace(/font-family:\s*'Nunito Variable'/g, "font-family: 'NunitoOG'");

// ---------- страница ----------

const TILES = [
  { t: "1", x: 884, y: 70, c: C.primary, bg: C.surface, r: -6 },
  { t: "0", x: 1010, y: 112, c: C["primary-strong"], bg: C["primary-soft"], r: 7 },
  { t: "1", x: 818, y: 468, c: C.success, bg: C["success-soft"], r: 5 },
  { t: "0", x: 1050, y: 452, c: C.ai, bg: C["ai-soft"], r: -8 },
];

const PILLS = [
  { ru: "Уроки", kk: "Сабақтар", fg: C["primary-strong"], bg: C["primary-soft"] },
  { ru: "Игры", kk: "Ойындар", fg: "#9a6a00", bg: C["gold-soft"] },
  { ru: "ИИ-помощник Бит", kk: "ЖИ-көмекші Бит", fg: C.ai, bg: C["ai-soft"] },
];

const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<style>
${fontCss}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body { position: relative; font-family: 'NunitoOG', sans-serif; background: ${C.bg}; color: ${C.text}; }
.disc { position: absolute; left: 744px; top: 70px; width: 490px; height: 490px; border-radius: 50%; background: ${C["primary-soft"]}; }
.disc2 { position: absolute; left: 790px; top: 116px; width: 398px; height: 398px; border-radius: 50%; background: ${C.surface}; }
.mascot { position: absolute; left: 826px; top: 138px; width: 334px; height: 334px; }
.tile { position: absolute; width: 92px; height: 92px; border-radius: 26px; border: 4px solid ${C.border}; border-bottom-width: 9px; display: flex; align-items: center; justify-content: center; font-size: 56px; font-weight: 900; }
.left { position: absolute; left: 72px; top: 0; width: 690px; height: ${H}px; display: flex; flex-direction: column; justify-content: center; }
.brand { font-size: 118px; font-weight: 900; line-height: 1; letter-spacing: -2px; color: ${C["primary-strong"]}; }
.ru { margin-top: 26px; font-size: 62px; font-weight: 800; line-height: 1.1; color: ${C.text}; }
.kk { font-size: 62px; font-weight: 800; line-height: 1.1; color: ${C.primary}; }
.pills { margin-top: 46px; display: flex; flex-wrap: wrap; gap: 14px; }
.pill { border-radius: 999px; padding: 10px 24px 11px; font-size: 28px; font-weight: 800; line-height: 1.15; }
.pill small { display: block; font-size: 22px; font-weight: 700; opacity: 0.8; }
</style></head>
<body>
  <div class="disc"></div><div class="disc2"></div>
  ${TILES.map((x) => `<div class="tile" style="left:${x.x}px;top:${x.y}px;color:${x.c};background:${x.bg};transform:rotate(${x.r}deg)">${x.t}</div>`).join("\n  ")}
  <div class="mascot">${MASCOT}</div>
  <div class="left">
    <div class="brand">Informatica</div>
    <div class="ru">Информатика к ЕНТ</div>
    <div class="kk">ҰБТ информатикасы</div>
    <div class="pills">
      ${PILLS.map((p) => `<div class="pill" style="color:${p.fg};background:${p.bg}">${p.ru}<small>${p.kk}</small></div>`).join("\n      ")}
    </div>
  </div>
</body></html>`;

// ---------- снимок ----------

const candidates = [process.env.PW_CHROMIUM_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  // Проверка шрифта: если Nunito не загрузился, текст был бы системным — не сохраняем такую картинку.
  const fontOk = await page.evaluate(() => document.fonts.check("800 40px NunitoOG", "Информатика ҰБТ информатикасы"));
  if (!fontOk) throw new Error("Шрифт Nunito не загрузился");
  const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
  writeFileSync(out, png);
} finally {
  await browser.close();
}

const size = statSync(out).size;
console.log(`public/og.png: ${W}×${H}, ${(size / 1024).toFixed(1)} КБ`);
if (size > MAX_BYTES) {
  console.error(`Файл больше ${MAX_BYTES / 1024} КБ — упрости картинку.`);
  process.exit(1);
}
