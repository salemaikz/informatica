import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneView } from "@/components/scenes/SceneView";
import { SCENE_SAMPLES } from "@/components/scenes/samples";
import { SAMPLES as CHART } from "@/components/scenes/samples/chart";
import { SAMPLES as EXTENDED } from "@/components/scenes/samples/extended";
import { SAMPLES as BOX } from "@/components/scenes/samples/box";
import { SAMPLES as WEB } from "@/components/scenes/samples/web";
import { SAMPLES as DB } from "@/components/scenes/samples/db-schema";
import { SAMPLES as WAVE } from "@/components/scenes/samples/wave";
import { DEFAULT_TONES, chartLayout, type ChartInput } from "@/components/scenes/chart";
import { HARDWARE_NAMES } from "@/components/scenes/hardware/names";
import { estimateTextWidth } from "@/components/scenes/text-width";
import { dict, type DictKey } from "@/i18n/dict";
import { fmt } from "@/lib/text";
import type { Lang, Scene, Text } from "@/lib/types";
import { validateScene } from "./validate";

// Пакет P7 этапа 16В: проверка рисунков волны 3 по галерее /dev/scenes. Регрессионные тесты на найденное:
// раскладка подписей (порог на диаграмме, подпись сдвига), слои, цвета только из токенов, тексты на двух языках.

const html = (scene: Scene) => renderToStaticMarkup(createElement(SceneView, { scene }));
const txt = (x: Text, lang: Lang) => (typeof x === "string" ? x : x[lang]);
const tr = (lang: Lang) => (key: DictKey, params?: Record<string, string | number>) => fmt(dict[key][lang], params);

function toInput(scene: Extract<Scene, { kind: "chart" }>, lang: Lang): ChartInput {
  const t = tr(lang);
  return {
    type: scene.type,
    labels: scene.labels.map((x) => txt(x, lang)),
    series: scene.series.map((s, i) => ({ name: s.name ? txt(s.name, lang) : undefined, values: s.values, tone: s.tone ?? DEFAULT_TONES[i % DEFAULT_TONES.length] })),
    values: !!scene.values,
    unit: scene.unit,
    threshold: scene.threshold && { value: scene.threshold.value, label: scene.threshold.label ? txt(scene.threshold.label, lang) : undefined },
    highlight: scene.highlight ?? [],
    funnel: !!scene.funnel,
    axes: scene.axes && { x: scene.axes.x ? txt(scene.axes.x, lang) : undefined, y: scene.axes.y ? txt(scene.axes.y, lang) : undefined },
    funnelFrom: t("scene.chart.funnelFrom"),
    funnelNote: t("scene.chart.funnelNote"),
  };
}

describe("диаграммы: порог", () => {
  it("слои: линия порога под подписями значений, подпись порога — последней, поверх всего (ru, столбцы и линии)", () => {
    for (const i of [2, 4]) {
      const out = html(CHART[i]);
      const line = out.indexOf('stroke-dasharray="6 4"');
      expect(line, `образец ${i}: линия порога`).toBeGreaterThan(0);
      // подписи, которые двигает motion (значения и подпись порога), — text с transform в style; подпись порога идёт последней из них
      const moving = [...out.matchAll(/<text[^>]*style="transform:translateX[^>]*>([^<]*)<\/text>/g)];
      expect(moving.length, `образец ${i}`).toBeGreaterThan(2);
      const label = CHART[i].kind === "chart" && CHART[i].threshold ? txt(CHART[i].threshold!.label ?? "", "ru") : "";
      expect(moving[moving.length - 1][1], `образец ${i}: подпись порога последняя`).toBe(label);
      for (const m of moving.slice(0, -1)) expect(m.index, `образец ${i}: «${m[1]}» ниже линии порога`).toBeGreaterThan(line);
    }
  });

  it("подписи значений у столбцов — с обводкой цвета фона, чтобы пунктир порога их не перечёркивал", () => {
    const out = html(CHART[2]);
    const vals = [...out.matchAll(/<text[^>]*class="tabular-nums"[^>]*style="transform:translateX[^>]*>[^<]*₸<\/text>/g)];
    expect(vals.length).toBe(8);
    for (const v of vals) {
      expect(v[0]).toContain('paint-order="stroke"');
      expect(v[0]).toContain('stroke="var(--surface)"');
    }
  });

  it("на ru и kk подпись порога не ложится ни на подписи значений, ни на столбцы — в каждом образце с порогом", () => {
    const withThreshold = CHART.filter((s) => s.type === "bar" && s.threshold);
    expect(withThreshold.length).toBeGreaterThan(0);
    for (const scene of withThreshold)
      for (const lang of ["ru", "kk"] as const) {
        const lay = chartLayout(toInput(scene, lang));
        if (lay.type !== "bar" || !lay.threshold) throw new Error();
        const t = lay.threshold;
        const w = estimateTextWidth(t.text, t.font);
        const a = { x1: t.anchor === "end" ? t.x - w : t.x, x2: t.anchor === "end" ? t.x : t.x + w, y1: t.ty - t.font, y2: t.ty + 2 };
        const hit = (b: { x1: number; x2: number; y1: number; y2: number }) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
        for (const v of lay.valueLabels) {
          const hw = estimateTextWidth(v.text, v.font) / 2;
          expect(hit({ x1: v.x - hw, x2: v.x + hw, y1: v.y - v.font, y2: v.y + 2 }), `${lang} значение ${v.text}`).toBe(false);
        }
        for (const b of lay.bars) expect(hit({ x1: b.x, x2: b.x + b.w, y1: b.y, y2: b.y + b.h }), `${lang} столбец ${b.key}`).toBe(false);
        expect(a.y1).toBeGreaterThanOrEqual(0);
        expect(a.x1).toBeGreaterThanOrEqual(0);
      }
  });

  it("цвета серий по умолчанию — без danger и heart (красный значит «неверно», розовый — сердечки)", () => {
    for (const t of DEFAULT_TONES) expect(["danger", "heart"]).not.toContain(t);
  });
});

describe("binary: подпись сдвига", () => {
  const shifts = EXTENDED.filter((s) => s.kind === "binary" && s.shift);

  it("в образцах есть сдвиг влево и вправо", () => {
    expect(shifts.map((s) => (s.kind === "binary" ? s.shift : "")).sort()).toContain("left");
    expect(shifts.map((s) => (s.kind === "binary" ? s.shift : "")).sort()).toContain("right");
  });

  it("подпись — обычным текстом под рисунком (переносится), а не строкой внутри SVG; стрелка и результат на месте", () => {
    for (const s of shifts) {
      if (s.kind !== "binary") continue;
      const out = html(s);
      const label = dict[s.shift === "left" ? "scene.binary.shiftLeft" : "scene.binary.shiftRight"].ru;
      const svg = out.slice(out.indexOf("<svg"), out.indexOf("</svg>"));
      // в aria-label рисунка фраза есть (для скринридера), но видимого <text> с ней в SVG нет
      expect([...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]), label).not.toContain(label);
      expect(out).toMatch(new RegExp(`<p class="[^"]*text-balance[^"]*">${label}</p>`));
      expect(out).toContain(dict["scene.binary.shiftResult"].ru);
      expect(svg).toContain("stroke-primary"); // стрелка
    }
  });

  it("под рисунком остаётся место только на стрелку (22 px), а не на стрелку и подпись", () => {
    const out = html({ kind: "binary", bits: "101101", shift: "left" });
    const noShift = html({ kind: "binary", bits: "101101", groups: 3 });
    const h = (s: string) => Number(s.match(/<svg viewBox="0 0 \d+ (\d+)"/)?.[1]);
    expect(h(out)).toBeGreaterThan(0);
    expect(h(noShift)).toBeGreaterThan(0);
    // стрелка лежит ниже плиток, но внутри рамки рисунка
    const ay = Number(out.match(/<line x1="[\d.]+" x2="[\d.]+" y1="([\d.]+)"/)?.[1]);
    expect(ay + 7 + 1.5).toBeLessThanOrEqual(h(out));
    expect(h(out) - ay).toBeLessThan(22);
  });
});

describe("box: линейка", () => {
  it("строки линейки в две строки отстоят друг от друга (gap-2.5), не слипаются", () => {
    const twoLines = BOX.filter((s) => s.borderBox && s.total);
    expect(twoLines.length).toBeGreaterThan(0);
    for (const s of twoLines) expect(html(s)).toContain("flex flex-col items-center gap-2.5");
  });
});

describe("hardware: «Wi-Fi» не рвётся по строкам", () => {
  it("после дефиса — word joiner (U+2060), на ru и kk; «Wi-Fi» без него в названиях нет", () => {
    expect(HARDWARE_NAMES["access-point"].ru).toContain("Wi-⁠Fi");
    expect(HARDWARE_NAMES["access-point"].kk).toContain("Wi-⁠Fi");
    for (const [id, name] of Object.entries(HARDWARE_NAMES)) {
      expect(name.ru, id).not.toMatch(/Wi-(?!⁠)Fi/);
      expect(name.kk, id).not.toMatch(/Wi-(?!⁠)Fi/);
    }
  });

  it("в рисунке: подпись карточки с joiner, невидимый символ не попадает в SVG и не меняет слова", () => {
    const out = html({ kind: "hardware", items: ["access-point"] });
    expect(out).toContain("Точка доступа Wi-⁠Fi");
    expect(HARDWARE_NAMES["access-point"].ru.replace(/⁠/g, "")).toBe("Точка доступа Wi-Fi");
    expect(HARDWARE_NAMES["access-point"].kk.replace(/⁠/g, "")).toBe("Wi-Fi қатынау нүктесі");
  });
});

// ---------- цвета: только токены ----------

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const cssVars = new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const COLOR_UTIL = /^(?:[a-z0-9-]+:)*!?(bg|text|border|fill|stroke|ring|outline|divide|from|via|to|shadow|decoration|accent|caret)-(.+)$/;
const PALETTE = /^(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)(-\d{2,3})?(\/\d+)?$/;
const SEMANTIC = /^(primary|success|danger|warning|ai|heart)(-strong|-soft)?(\/\d+)?$/;
const GOLD_STREAK = /^(gold|streak)(-soft)?(\/\d+)?$/;

/** Все сцены волны 3, кроме `web`: у неё в iframe свой документ ученика (там цвета страницы-примера). */
const GALLERY = SCENE_SAMPLES.flatMap((g) => g.scenes.map((scene, i) => ({ id: `${g.group}[${i}]`, scene }))).filter((x) => x.scene.kind !== "web");

describe("цвета рисунков волны 3 — только токены", () => {
  it("в разметке нет hex, rgb(), hsl(), oklch() и цветов стандартной палитры Tailwind", () => {
    for (const { id, scene } of GALLERY) {
      const out = html(scene);
      expect(out, id).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(out, id).not.toMatch(/\b(?:rgba?|hsla?|oklch|oklab)\(/);
      for (const m of out.matchAll(/class="([^"]*)"/g))
        for (const cls of m[1].split(/\s+/).filter(Boolean)) {
          const u = cls.match(COLOR_UTIL);
          if (!u) continue;
          expect(PALETTE.test(u[2]), `${id}: класс ${cls}`).toBe(false);
          expect(cls, id).not.toMatch(/-\[#/);
        }
    }
  });

  it("каждая var(--имя) в разметке есть в globals.css", () => {
    for (const { id, scene } of GALLERY)
      for (const m of html(scene).matchAll(/var\(--([a-z0-9-]+)/g)) expect(cssVars.has(m[1]), `${id}: --${m[1]}`).toBe(true);
  });

  it("у gold и streak нет «-strong» (его нет в токенах); у остальных тонов суффиксы только -strong и -soft", () => {
    for (const { id, scene } of GALLERY)
      for (const m of html(scene).matchAll(/class="([^"]*)"/g))
        for (const cls of m[1].split(/\s+/).filter(Boolean)) {
          const u = cls.match(COLOR_UTIL);
          if (!u) continue;
          if (/^(gold|streak)/.test(u[2])) expect(GOLD_STREAK.test(u[2]), `${id}: ${cls}`).toBe(true);
          if (/^(primary|success|danger|warning|ai|heart)-/.test(u[2])) expect(SEMANTIC.test(u[2]), `${id}: ${cls}`).toBe(true);
        }
  });

  it("розовый heart — только сердечки: в рисунках волны 3 его нет", () => {
    for (const { id, scene } of GALLERY) expect(html(scene), id).not.toMatch(/(?:bg|text|border|fill|stroke|ring)-heart|var\(--heart/);
  });
});

// ---------- тексты ----------

const WAVE3_PREFIXES = [
  "scene.chart.", "scene.db.", "scene.table.", "scene.graph.", "scene.grid.", "scene.gates.", "scene.switches.", "scene.circuit.ariaOutputs",
  "scene.numberline.", "scene.wave.", "scene.binary.", "scene.decimal.", "scene.tape.", "scene.box.", "scene.url.", "scene.message.",
];
const wave3Keys = (Object.keys(dict) as DictKey[]).filter((k) => WAVE3_PREFIXES.some((p) => k.startsWith(p)));
/** Слова, которые в казахском тексте и в русском выглядят одинаково (код, заимствования, подстановки). */
const SAME_IN_BOTH = new Set<string>([
  "scene.numberline.rowLine", "scene.numberline.end", "scene.url.ariaPart", "scene.url.role.domain", "scene.url.role.port",
  "scene.message.aria.chat", "scene.wave.bits", "scene.binary.byte", "scene.binary.andIp", "scene.binary.andMask",
]);

describe("тексты рисунков волны 3 (словарь scene.*)", () => {
  it("ключей достаточно, у каждого есть ru и kk, подстановки {…} совпадают", () => {
    expect(wave3Keys.length).toBeGreaterThanOrEqual(90);
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const k of wave3Keys) {
      expect(dict[k].ru.trim(), k).not.toBe("");
      expect(dict[k].kk.trim(), k).not.toBe("");
      expect(ph(dict[k].kk), k).toBe(ph(dict[k].ru));
    }
  });

  it("казахский не равен русскому, кроме кодовых слов и заимствований из списка", () => {
    const same = wave3Keys.filter((k) => dict[k].ru === dict[k].kk).sort();
    expect(same).toEqual([...SAME_IN_BOTH].filter((k) => wave3Keys.includes(k as DictKey)).sort());
  });

  it("по глоссарию: ҰБТ, а не ЕНТ; «программа» (не «бағдарлама»); екілік (не «бинарлы»); бастапқы кілт (не «бірегей»)", () => {
    const texts = wave3Keys.map((k) => dict[k].kk);
    const samples = SCENE_SAMPLES.flatMap((g) => g.scenes).map((s) => JSON.stringify(s));
    const all = [...texts, ...samples];
    for (const s of all) {
      expect(s).not.toMatch(/(?<![А-ЯЁҚҰ])ЕНТ(?![А-ЯЁ])/);
      expect(s).not.toMatch(/бағдарлама|бинарлы|бірегей кілт/i);
    }
  });

  it("термины: деректер қоры, бастапқы / сыртқы кілт, санау жүйесінің негізі, тілім, көрсеткі", () => {
    expect(dict["scene.db.aria"].kk).toContain("Деректер қорының");
    expect(dict["scene.db.pk"].kk).toBe("бастапқы кілт");
    expect(dict["scene.db.fk"].kk).toBe("сыртқы кілт");
    expect(dict["scene.decimal.ariaBase"].kk).toContain("санау жүйесінің негізі");
    expect(dict["scene.tape.ariaSlice"].kk).toContain("Тілім");
    expect(dict["scene.table.arrow"].kk).toContain("Көрсеткі");
    expect(dict["scene.gates.xor"].kk).toBe("Қатаң НЕМЕСЕ");
  });

  it("отсчёт звука — «өлшем», как в уроке о звуке; сравнительные «жақсырақ / нашарырақ» в подписях волны", () => {
    expect(dict["scene.wave.samples"].kk).toBe("өлшемдер: {n}");
    const waveText = JSON.stringify(WAVE);
    expect(waveText).not.toContain("өлшеу");
    expect(waveText).not.toContain("Дөрекі");
    expect(waveText).toContain("Жақсырақ");
    expect(waveText).toContain("Нашарырақ");
  });

  it("подписи ленты и группы: «бөлектелген» (единая форма), счётная подпись групп — с «саны»", () => {
    expect(dict["scene.tape.ariaHighlight"].kk).toContain("Бөлектелген");
    expect(dict["scene.binary.ariaGroups"].kk).toBe("топтағы разряд саны: {g}");
  });

  it("образцы web: «SMS-тегі» (сингармонизм: SMS читается «эсэмэс»), а не «SMS-тағы»", () => {
    const text = JSON.stringify(WEB);
    expect(text).toContain("SMS-тегі");
    expect(text).not.toContain("SMS-тағы");
  });
});

describe("образцы db-schema: худший случай по казахскому", () => {
  it("широкое имя таблицы из 14 букв, непротиворечивые поля (адрес, роль), ссылка на «Рөлдер»", () => {
    const s = DB[8];
    expect(validateScene(s)).toEqual([]);
    expect(s.tables[0].name).toBe("ПАЙДАЛАНУШЫЛАР");
    expect(s.tables[0].name.length).toBe(14);
    const fk = s.tables[0].fields.find((f) => f.fk);
    expect(fk?.fk).toBe("Рөлдер.Коды");
    expect(s.tables.some((t) => t.name === "Рөлдер")).toBe(true);
    // имена полей — по-казахски, тип у имени — подходящий (имя не INT)
    const mail = s.tables[0].fields.find((f) => f.name === "Электрондық пошта");
    expect(mail?.type).toBe("TEXT");
    // самое длинное «имя + тип» укладывается в предел проверки (22 символа)
    for (const t of s.tables) for (const f of t.fields) expect(`${f.name} ${f.type ?? ""}`.length).toBeLessThanOrEqual(22);
  });

  it("прочие образцы: «Атауы» (не «Аталуы»); подписи связи «көптен-көпке»", () => {
    const all = JSON.stringify(DB);
    expect(all).not.toContain("Аталуы");
    expect(all).not.toContain("ЖҰМЫСШЫЛАРДЫҢ");
    expect(all).toContain("Көптен-көпке");
    expect(all).not.toContain("Көпке-көп");
  });
});
