import { describe, expect, it, vi } from "vitest";
import { DECK_TAG, MIN_OPTIONS, buildDeck, checkAnswer, correctAnswer, deckLevels, duelTopics, isDuelTopic, optionCount, topicSkills } from "@/lib/duel/deck";
import { DUEL_MODES, DUEL_MODE_IDS, bandOf, matchDurationMs } from "@/lib/duel/modes";
import type { DuelBand, DuelItem } from "@/lib/duel/types";
import { ENT_TOPICS } from "@/content/ent-topics";
import type { L, Text } from "@/lib/types";
import { computeDeckTag, deckSources } from "../scripts/deck-tag.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Сотни наборов на тест: при общей нагрузке на CPU (полный прогон) 5 с по умолчанию мало.
vi.setConfig({ testTimeout: 60_000 });

const BANDS: DuelBand[] = [1, 2, 3, 4];
const keys = (d: DuelItem[]) => d.map((x) => x.key);
const bothLangs = (t: Text) => typeof t === "string" || (!!(t as L).ru && !!(t as L).kk);

function texts(item: DuelItem): Text[] {
  return item.shape === "statement" ? [item.statement.text, item.statement.explanation] : [item.step.prompt, item.step.explanation, ...item.step.options];
}

describe("buildDeck", () => {
  it("детерминирован: тот же seed — тот же набор", () => {
    for (const mode of DUEL_MODE_IDS) {
      const topic = mode === "topic" ? "t04" : undefined;
      const a = buildDeck(mode, 12345, 2, topic);
      const b = buildDeck(mode, 12345, 2, topic);
      expect(a.length).toBe(DUEL_MODES[mode].n);
      expect(keys(a)).toEqual(keys(b));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it("другой seed — другой набор", () => {
    expect(keys(buildDeck("ten", 1, 3))).not.toEqual(keys(buildDeck("ten", 2, 3)));
    expect(keys(buildDeck("truth", 1, 3))).not.toEqual(keys(buildDeck("truth", 2, 3)));
  });

  it("набор не зависит от истории вызовов банка и от свежей загрузки модулей", async () => {
    const cases = [
      ["blitz", 4321, 1, undefined],
      ["truth", 4321, 3, undefined],
      ["ten", 4321, 4, undefined],
      ["topic", 4321, 2, "u2"],
    ] as const;
    const before = cases.map(([m, s, b, t]) => keys(buildDeck(m, s, b, t)));
    // Посторонние вызовы банка и другие наборы между сборками не должны ничего менять.
    const { draw } = await import("@/lib/bank");
    draw("question", { skills: topicSkills("t01"), count: 50, seed: 9 });
    draw("statement", { skills: topicSkills("t04"), count: 50, seed: 10 });
    for (let s = 0; s < 5; s++) buildDeck("truth", s, 2);
    expect(cases.map(([m, s, b, t]) => keys(buildDeck(m, s, b, t)))).toEqual(before);
    // Свежий модуль (как у другого клиента или на сервере) — те же ключи.
    vi.resetModules();
    const fresh = await import("@/lib/duel/deck");
    expect(fresh.buildDeck).not.toBe(buildDeck);
    expect(cases.map(([m, s, b, t]) => keys(fresh.buildDeck(m, s, b, t)))).toEqual(before);
  });

  it("«верю — не верю»: ровно поровну «верно» и «неверно» на каждом уровне, порядок перемешан", () => {
    for (const band of BANDS) {
      let firstTrue = 0;
      let decks = 0;
      for (let seed = 0; seed < 60; seed++) {
        const deck = buildDeck("truth", seed * 7919 + band, band);
        expect(deck.length).toBe(DUEL_MODES.truth.n);
        const trues = deck.filter((d) => correctAnswer(d) === true).length;
        expect(trues, `band ${band} seed ${seed}`).toBe(deck.length / 2);
        for (const lv of [1, 2, 3]) {
          const at = deck.filter((d) => d.level === lv);
          const t = at.filter((d) => correctAnswer(d) === true).length;
          expect(Math.abs(2 * t - at.length), `band ${band} seed ${seed} lv ${lv}`).toBeLessThanOrEqual(1);
        }
        // Перемешано, а не блоками «все верные, потом все неверные»: серий длиннее 12 нет.
        let run = 1;
        for (let k = 1; k < deck.length; k++) {
          run = correctAnswer(deck[k]) === correctAnswer(deck[k - 1]) ? run + 1 : 1;
          expect(run).toBeLessThanOrEqual(12);
        }
        firstTrue += correctAnswer(deck[0]) === true ? 1 : 0;
        decks++;
      }
      // Первое утверждение — то «верно», то «неверно».
      expect(firstTrue).toBeGreaterThan(decks * 0.2);
      expect(firstTrue).toBeLessThan(decks * 0.8);
    }
  });

  it("у каждого задания оба языка, ключ — без текста (язык в buildDeck не передаётся вовсе)", () => {
    for (const mode of DUEL_MODE_IDS) {
      const deck = buildDeck(mode, 777, 4, mode === "topic" ? "u3" : undefined);
      for (const item of deck) {
        expect(item.key).not.toMatch(/[а-яәғқңөұүһі]/i);
        for (const t of texts(item)) expect(bothLangs(t)).toBe(true);
      }
    }
  });

  it("на всех полосах каждый режим без темы набирает n заданий нужной формы", () => {
    for (const band of BANDS) {
      for (const mode of ["blitz", "truth", "ten"] as const) {
        for (const seed of [1, 99, 2026]) {
          const deck = buildDeck(mode, seed, band);
          const meta = DUEL_MODES[mode];
          expect(deck.length, `${mode} band ${band} seed ${seed}`).toBe(meta.n);
          expect(deck.map((d) => d.i)).toEqual(deck.map((_, i) => i));
          expect(deck.every((d) => d.shape === meta.shape)).toBe(true);
          expect(new Set(keys(deck)).size).toBe(deck.length);
          // Уровни не убывают (сложность растёт), совпадают с планом позиций.
          expect(deck.map((d) => d.level)).toEqual(deckLevels(mode, band));
        }
      }
    }
  });

  it("на всех полосах и темах режим «по теме» набирает 10 заданий ступенькой 5A/3B/2C", () => {
    const topics = duelTopics();
    for (const ent of ENT_TOPICS) expect(topics).toContain(ent.id);
    expect(topics).toContain("u1");
    for (const topic of topics) {
      for (const band of BANDS) {
        const deck = buildDeck("topic", 4242 + band, band, topic);
        expect(deck.length, `topic ${topic} band ${band}`).toBe(10);
        expect(deck.map((d) => d.level)).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 3, 3]);
        const allowed = new Set(topicSkills(topic));
        expect(deck.every((d) => allowed.has(d.skill))).toBe(true);
      }
    }
  });

  it("задания на выбор: ≥ 3 вариантов, верный индекс в пределах, без повторов текста", () => {
    for (const band of BANDS) {
      const deck = buildDeck("blitz", 31337, band);
      const seen = new Set<string>();
      for (const item of deck) {
        if (item.shape !== "choice") throw new Error("ожидался выбор");
        expect(item.step.type).toBe("choice");
        expect(item.step.options.length).toBeGreaterThanOrEqual(MIN_OPTIONS);
        expect(item.step.correct).toBeGreaterThanOrEqual(0);
        expect(item.step.correct).toBeLessThan(item.step.options.length);
        const k = [item.step.prompt.ru, ...item.step.options.map((o) => (typeof o === "string" ? o : o.ru))].join("|");
        expect(k).not.toContain("[object Object]");
        expect(seen.has(k), k).toBe(false);
        seen.add(k);
      }
    }
  });

  it("лимит на задание — только в «10 вопросов», 20/30/45 с по уровню", () => {
    const ten = buildDeck("ten", 5, 2);
    expect(ten.map((d) => d.limitMs)).toEqual([20, 20, 20, 20, 20, 30, 30, 30, 45, 45].map((s) => s * 1000));
    expect(matchDurationMs("ten", ten.map((d) => d.level))).toBe(280_000);
    expect(buildDeck("blitz", 5, 2).every((d) => d.limitMs === null)).toBe(true);
    expect(matchDurationMs("blitz", [])).toBe(60_000);
    expect(matchDurationMs("truth", [])).toBe(45_000);
  });

  it("негодные параметры — пустой набор", () => {
    expect(buildDeck("topic", 1, 1)).toEqual([]);
    expect(buildDeck("topic", 1, 1, "t99")).toEqual([]);
    expect(buildDeck("nope" as never, 1, 1)).toEqual([]);
    expect(buildDeck("ten", 1, 7 as DuelBand)).toEqual([]);
    expect(buildDeck("ten", Number.NaN, 1)).toEqual([]);
    expect(isDuelTopic("t04")).toBe(true);
    expect(isDuelTopic("x".repeat(100))).toBe(false);
  });

  it("полоса по уровню", () => {
    expect([0, 1, 4, 5, 9, 10, 19, 20, 99, Number.NaN].map(bandOf)).toEqual([1, 1, 1, 2, 2, 3, 3, 4, 4, 1]);
  });
});

describe("checkAnswer", () => {
  it("выбор: +2 за верный, −1 за неверный (блиц); мусор — неверно", () => {
    const item = buildDeck("blitz", 8, 1)[0];
    const right = correctAnswer(item) as number;
    expect(checkAnswer(item, right)).toEqual({ ok: true, pts: 2 });
    expect(checkAnswer(item, (right + 1) % optionCount(item))).toEqual({ ok: false, pts: -1 });
    expect(checkAnswer(item, -1).ok).toBe(false);
    expect(checkAnswer(item, true).ok).toBe(false);
    expect(checkAnswer(item, right + 0.5).ok).toBe(false);
  });

  it("утверждение: ±1; число вместо true/false — неверно", () => {
    const item = buildDeck("truth", 8, 1)[0];
    const right = correctAnswer(item) as boolean;
    expect(checkAnswer(item, right)).toEqual({ ok: true, pts: 1 });
    expect(checkAnswer(item, !right)).toEqual({ ok: false, pts: -1 });
    expect(checkAnswer(item, 1).ok).toBe(false);
  });

  it("«10 вопросов»: +1 / 0", () => {
    const item = buildDeck("ten", 8, 1)[0];
    expect(checkAnswer(item, correctAnswer(item)).pts).toBe(1);
    expect(checkAnswer(item, -1).pts).toBe(0);
  });
});

describe("deckTag", () => {
  const root = join(__dirname, "..");
  const read = (p: string) => readFileSync(p, "utf8");

  it("без переменной сборки — dev", () => {
    expect(DECK_TAG).toBe(process.env.NEXT_PUBLIC_DECK_TAG || "dev");
  });

  it("в тег входят deck.ts, весь банк и его зависимости", () => {
    const src: string[] = deckSources(root);
    expect(src).toContain("src/lib/duel/deck.ts");
    expect(src).toContain("src/lib/duel/modes.ts");
    expect(src).toContain("src/lib/bank/index.ts");
    expect(src).toContain("src/lib/bank/types.ts");
    expect(src).toContain("src/lib/text.ts");
    expect(src).toContain("src/content/skills.ts");
    expect(src.filter((s) => s.startsWith("src/lib/bank/")).length).toBeGreaterThan(100);
    expect(src).not.toContain("src/lib/duel/bot.ts");
  });

  it("стабилен и меняется при правке банка или навыков урока, но не текста урока", () => {
    const tag = computeDeckTag(root);
    expect(tag).toMatch(/^[0-9a-f]{10}$/);
    expect(computeDeckTag(root)).toBe(tag);
    const patched = (file: string, fn: (s: string) => string) => (p: string) => (p.endsWith(file) ? fn(read(p)) : read(p));
    expect(computeDeckTag(root, patched("bank/ns.ts", (s) => s + "\n// x"))).not.toBe(tag);
    expect(computeDeckTag(root, patched("duel/deck.ts", (s) => s.replace("MIN_OPTIONS = 3", "MIN_OPTIONS = 4")))).not.toBe(tag);
    expect(computeDeckTag(root, patched("catalog.generated.ts", (s) => s.replace('"skills":["ns.base"]', '"skills":["ns.props"]')))).not.toBe(tag);
    expect(computeDeckTag(root, patched("catalog.generated.ts", (s) => s.replace('"stepCount":19', '"stepCount":20')))).toBe(tag);
  });
});
