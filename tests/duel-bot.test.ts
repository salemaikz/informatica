import { describe, expect, it } from "vitest";
import {
  ADJ_MAX,
  BOT_ACC_CAP,
  BOT_FLOOR_MS,
  BOT_SIGMA,
  BOT_TABLE,
  SLOW_AFTER_ERROR,
  botAccuracy,
  botProfile,
  botTimeline,
  nextBotAdj,
  readMs,
  thinkMedianMs,
  type BotProfile,
} from "@/lib/duel/bot";
import { buildDeck, optionCount, correctAnswer } from "@/lib/duel/deck";
import { DUEL_MODES } from "@/lib/duel/modes";
import { totals, winner } from "@/lib/duel/score";
import type { DuelBand, DuelEvent, DuelItem, DuelModeId } from "@/lib/duel/types";
import { seeded } from "@/lib/text";

const BANDS: DuelBand[] = [1, 2, 3, 4];
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Наборы «10 вопросов» без лимита на задание: так видно «чистое» время бота. */
function unlimitedDecks(band: DuelBand, count: number): DuelItem[][] {
  return Array.from({ length: count }, (_, k) => buildDeck("ten", 1000 + k, band).map((d) => ({ ...d, limitMs: null })));
}

describe("бот: детерминизм и границы", () => {
  it("тот же набор, профиль и botSeed — тот же таймлайн; другой botSeed — другой", () => {
    const deck = buildDeck("blitz", 42, 2);
    const p = botProfile(2);
    expect(botTimeline(deck, p, "m1")).toEqual(botTimeline(deck, p, "m1"));
    expect(botTimeline(deck, p, "m1")).not.toEqual(botTimeline(deck, p, "m2"));
    expect(botTimeline([], p, 1)).toEqual([]);
  });

  it("ни одного ответа быстрее нижней границы; часы и лимиты соблюдены", () => {
    for (const band of BANDS) {
      for (const mode of ["blitz", "truth", "ten"] as DuelModeId[]) {
        const meta = DUEL_MODES[mode];
        for (let s = 0; s < 40; s++) {
          const deck = buildDeck(mode, s, band);
          const tl = botTimeline(deck, botProfile(band, { adj: ADJ_MAX }), s);
          let prev = 0;
          let prevOk = true;
          tl.forEach((e, k) => {
            expect(e.i).toBe(k);
            const dt = e.t - prev - (prevOk ? 0 : meta.errorPauseMs);
            expect(dt).toBeGreaterThanOrEqual(BOT_FLOOR_MS);
            const lim = deck[k].limitMs;
            if (lim != null) expect(dt).toBeLessThanOrEqual(lim);
            if (meta.clockMs != null) expect(e.t).toBeLessThanOrEqual(meta.clockMs);
            prev = e.t;
            prevOk = e.ok;
          });
          if (meta.clockMs == null) expect(tl.length).toBe(deck.length);
        }
      }
    }
  });

  it("точность никогда не выше 0,92: резинка и освоение не делают сверхчеловека", () => {
    const p = botProfile(4, { adj: 1, mastery: { "ns.base": 1 } });
    expect(p.adj).toBe(ADJ_MAX);
    for (const lv of [1, 2, 3] as const) {
      expect(botAccuracy(p, "ns.base", lv)).toBeLessThanOrEqual(BOT_ACC_CAP);
      expect(botAccuracy(p, "x", lv)).toBeLessThanOrEqual(BOT_ACC_CAP);
    }
    expect(botAccuracy(botProfile(1, { adj: -1, mastery: { a: 0 } }), "a", 3)).toBeGreaterThan(0);
  });

  it("освоение ученика смешивается с таблицей 50/50", () => {
    const strong = botProfile(1, { mastery: { s: 1 } });
    const weak = botProfile(1, { mastery: { s: 0 } });
    expect(botAccuracy(strong, "s", 1)).toBeCloseTo(0.5 * 0.7 + 0.5 * 0.95, 6);
    expect(botAccuracy(weak, "s", 1)).toBeCloseTo(0.5 * 0.7 + 0.5 * 0.45, 6);
    expect(botAccuracy(weak, "s", 3)).toBeCloseTo(0.5 * 0.4 + 0.5 * (0.45 - 0.22), 6);
    // Навык без освоения — только таблица.
    expect(botAccuracy(strong, "other", 2)).toBeCloseTo(0.55, 6);
  });
});

describe("бот: распределения на 10 000 seed (±3 % от таблицы)", () => {
  for (const band of BANDS) {
    it(`полоса ${band}: точность и медианы времени по уровням`, () => {
      const p = botProfile(band);
      const ok: [number, number][] = [
        [0, 0],
        [0, 0],
        [0, 0],
      ];
      const think: number[][] = [[], [], []];
      const decks = unlimitedDecks(band, 20);
      let runs = 0;
      for (const deck of decks) {
        for (let s = 0; s < 500; s++, runs++) {
          const tl = botTimeline(deck, p, `${band}:${s}`);
          let prev = 0;
          let prevWrong = false;
          tl.forEach((e) => {
            const item = deck[e.i];
            const lv = item.level - 1;
            ok[lv][0] += e.ok ? 1 : 0;
            ok[lv][1]++;
            // Время «на подумать»: минус чтение, без замедления после ошибки.
            think[lv].push((e.t - prev - readMs(item)) / (prevWrong ? SLOW_AFTER_ERROR : 1));
            prev = e.t;
            prevWrong = !e.ok;
          });
        }
      }
      expect(runs).toBe(10_000);
      for (const lv of [0, 1, 2]) {
        const acc = ok[lv][0] / ok[lv][1];
        expect(Math.abs(acc - BOT_TABLE[band].acc[lv]), `acc band ${band} lv ${lv + 1}`).toBeLessThan(0.03);
        const target = BOT_TABLE[band].medianMs[lv];
        expect(Math.abs(median(think[lv]) / target - 1), `median band ${band} lv ${lv + 1}`).toBeLessThan(0.03);
      }
    });
  }

  it("разброс логнормальный: σ логарифма ≈ 0,35", () => {
    const deck = unlimitedDecks(3, 1)[0];
    const p = botProfile(3);
    const logs: number[] = [];
    for (let s = 0; s < 4000; s++) {
      const tl = botTimeline(deck, p, s);
      const e0 = tl[0];
      const t = e0.t - readMs(deck[0]);
      if (t + readMs(deck[0]) > BOT_FLOOR_MS) logs.push(Math.log(t / thinkMedianMs(p, deck[0])));
    }
    const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
    const sd = Math.sqrt(logs.reduce((a, b) => a + (b - mean) ** 2, 0) / logs.length);
    expect(Math.abs(sd - BOT_SIGMA)).toBeLessThan(0.03);
  });
});

const deckCache = new Map<string, DuelItem[]>();
/** Наборы повторяются (сборка набора дороже матча) — кэш на время теста. */
function deckFor(mode: DuelModeId, seed: number, band: DuelBand): DuelItem[] {
  const k = `${mode}:${seed}:${band}`;
  let d = deckCache.get(k);
  if (!d) deckCache.set(k, (d = buildDeck(mode, seed, band)));
  return d;
}

/** Смоделированный ученик того же уровня: та же таблица, своя случайность, те же правила режима. */
function simulatedPlayer(deck: DuelItem[], p: BotProfile, seed: number): DuelEvent[] {
  const rand = seeded(seed);
  const meta = DUEL_MODES[deck[0].mode];
  const events: DuelEvent[] = [];
  let t = 0;
  let prevWrong = false;
  for (const item of deck) {
    const ok = rand() < p.row.acc[item.level - 1];
    const z = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    let dt = Math.max(BOT_FLOOR_MS, readMs(item) + thinkMedianMs(p, item) * Math.exp(0.35 * z) * (prevWrong ? 1.15 : 1));
    if (item.limitMs != null) dt = Math.min(dt, item.limitMs);
    const at = t + (prevWrong ? meta.errorPauseMs : 0) + Math.round(dt);
    if (meta.clockMs != null && at > meta.clockMs) break;
    events.push({ i: item.i, ok, t: at });
    t = at;
    prevWrong = !ok;
  }
  return events;
}

/** Случайный нажиматель: жмёт как можно быстрее (≥ 700 мс), вариант наугад. */
function randomTapper(deck: DuelItem[], seed: number): DuelEvent[] {
  const rand = seeded(seed);
  const meta = DUEL_MODES[deck[0].mode];
  const events: DuelEvent[] = [];
  let t = 0;
  let prevWrong = false;
  for (const item of deck) {
    const pick = Math.floor(rand() * optionCount(item));
    const right = correctAnswer(item);
    const ok = item.shape === "statement" ? (pick === 1) === right : pick === right;
    const at = t + (prevWrong ? meta.errorPauseMs : 0) + (item.shape === "statement" ? 500 : 700) + Math.floor(rand() * 200);
    if (meta.clockMs != null && at > meta.clockMs) break;
    events.push({ i: item.i, ok, t: at });
    t = at;
    prevWrong = !ok;
  }
  return events;
}

describe("бот: баланс", () => {
  for (const mode of ["blitz", "truth", "ten"] as DuelModeId[]) {
    it(`${mode}: против ученика того же уровня бот выигрывает 40–60 %`, () => {
      for (const band of BANDS) {
        const p = botProfile(band);
        let score = 0;
        const N = 1500;
        for (let m = 0; m < N; m++) {
          const deck = deckFor(mode, 500 + (m % 30), band);
          const bot = totals(mode, botTimeline(deck, p, `b${m}`));
          const me = totals(mode, simulatedPlayer(deck, p, 9_000_000 + m));
          const w = winner(bot, me).winner;
          score += w === "a" ? 1 : w === "draw" ? 0.5 : 0;
        }
        const rate = score / N;
        expect(rate, `${mode} band ${band}: ${rate}`).toBeGreaterThan(0.4);
        expect(rate, `${mode} band ${band}: ${rate}`).toBeLessThan(0.6);
      }
    });
  }

  it("блиц: случайный нажиматель проигрывает честному профилю даже самой слабой полосы", () => {
    const p = botProfile(1);
    let tapperWins = 0;
    let tapperSum = 0;
    let honestSum = 0;
    const N = 2000;
    for (let m = 0; m < N; m++) {
      const deck = deckFor("blitz", 700 + (m % 40), 1);
      const tap = totals("blitz", randomTapper(deck, 31 * m + 7));
      const honest = totals("blitz", botTimeline(deck, p, `h${m}`));
      tapperSum += tap.score;
      honestSum += honest.score;
      if (winner(tap, honest).winner === "a") tapperWins++;
    }
    expect(tapperSum / N).toBeLessThan(0);
    expect(tapperSum).toBeLessThan(honestSum);
    expect(tapperWins / N).toBeLessThan(0.15);
  });

  it("«верю — не верю»: случайный нажиматель в среднем проигрывает честному профилю", () => {
    const p = botProfile(1);
    let tapperSum = 0;
    let honestSum = 0;
    let tapperWins = 0;
    const N = 2000;
    for (let m = 0; m < N; m++) {
      const deck = deckFor("truth", 900 + (m % 40), 1);
      const tap = totals("truth", randomTapper(deck, 17 * m + 3));
      const honest = totals("truth", botTimeline(deck, p, `h${m}`));
      tapperSum += tap.score;
      honestSum += honest.score;
      if (winner(tap, honest).winner === "a") tapperWins++;
    }
    expect(tapperSum).toBeLessThan(honestSum);
    expect(tapperWins / N).toBeLessThan(0.5);
  });
});

describe("резинка", () => {
  it("3 победы подряд — бот точнее на 0,05, 3 поражения — слабее, предел ±0,1", () => {
    expect(nextBotAdj(0, [])).toBe(0);
    expect(nextBotAdj(0, ["win", "win"])).toBe(0);
    expect(nextBotAdj(0, ["win", "win", "win"])).toBe(0.05);
    expect(nextBotAdj(0.05, ["loss", "win", "win", "win", "win", "win", "win"])).toBe(0.1);
    expect(nextBotAdj(0.1, ["win", "win", "win"])).toBe(0.1);
    expect(nextBotAdj(0, ["loss", "loss", "loss"])).toBe(-0.05);
    expect(nextBotAdj(-0.1, ["loss", "loss", "loss"])).toBe(-0.1);
    expect(nextBotAdj(0, ["win", "draw", "win", "win"])).toBe(0);
    expect(nextBotAdj(0.05, ["win", "win", "loss"])).toBe(0.05);
    expect(nextBotAdj(Number.NaN, ["win", "win", "win"])).toBe(0.05);
    expect(nextBotAdj(5, [])).toBe(ADJ_MAX);
  });

  it("резинка меняет точность бота", () => {
    expect(botAccuracy(botProfile(2, { adj: 0.05 }), "x", 1)).toBeCloseTo(0.83, 6);
    expect(botAccuracy(botProfile(2, { adj: -0.1 }), "x", 1)).toBeCloseTo(0.68, 6);
  });
});
