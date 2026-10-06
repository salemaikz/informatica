import { describe, expect, it, vi } from "vitest";
import {
  ADJ_MAX,
  BOT_ACC_CAP,
  BOT_FLOOR_MS,
  BOT_SIGMA,
  BOT_TABLE,
  CLOCK_LEVEL_FACTOR,
  CLOCK_PACE_MS,
  LIMIT_MARGIN_MS,
  SLOW_AFTER_ERROR,
  botAccuracy,
  botProfile,
  botReadMs,
  botTimeline,
  nextBotAdj,
  readMs,
  thinkMedianMs,
  type BotProfile,
} from "@/lib/duel/bot";
import { buildDeck, optionCount, correctAnswer } from "@/lib/duel/deck";
import { DUEL_MODES } from "@/lib/duel/modes";
import { IDLE_NOTICE_MS, totals, winner } from "@/lib/duel/score";
import type { DuelBand, DuelEvent, DuelItem, DuelModeId } from "@/lib/duel/types";
import { seeded } from "@/lib/text";

// Тысячи матчей на тест: при общей нагрузке на CPU (полный прогон) 5 с по умолчанию мало.
vi.setConfig({ testTimeout: 60_000 });

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
            think[lv].push((e.t - prev - botReadMs(item)) / (prevWrong ? SLOW_AFTER_ERROR : 1));
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

/**
 * Смоделированный ученик того же уровня: та же точность и темп полосы (так задан «ученик уровня»), своя случайность, те же
 * правила режима. Абсолютный темп бота проверяют отдельные тесты ниже — этот тест только про равенство сил.
 */
function simulatedPlayer(deck: DuelItem[], p: BotProfile, seed: number): DuelEvent[] {
  const rand = seeded(seed);
  const meta = DUEL_MODES[deck[0].mode];
  const events: DuelEvent[] = [];
  let t = 0;
  let prevWrong = false;
  for (const item of deck) {
    let ok = rand() < botAccuracy(p, item.skill, item.level, item.shape);
    const z = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    let dt = Math.max(BOT_FLOOR_MS, botReadMs(item) + thinkMedianMs(p, item) * Math.exp(0.35 * z) * (prevWrong ? 1.15 : 1));
    if (item.limitMs != null && dt >= item.limitMs) {
      dt = item.limitMs;
      ok = false;
    }
    const at = t + (prevWrong ? meta.errorPauseMs : 0) + Math.round(dt);
    if (meta.clockMs != null && at > meta.clockMs) break;
    events.push({ i: item.i, ok, t: at });
    t = at;
    prevWrong = !ok;
  }
  return events;
}

type Tap = "uniform" | "true" | "false";

/** Нажиматель без чтения: как можно быстрее (500–700 мс на утверждение, 700–900 на выбор), вариант наугад или всегда один. */
function tapper(deck: DuelItem[], seed: number, how: Tap = "uniform"): DuelEvent[] {
  const rand = seeded(seed);
  const meta = DUEL_MODES[deck[0].mode];
  const events: DuelEvent[] = [];
  let t = 0;
  let prevWrong = false;
  for (const item of deck) {
    const right = correctAnswer(item);
    const ok =
      item.shape === "statement" && how !== "uniform" ? (how === "true") === right : Math.floor(rand() * optionCount(item)) === (item.shape === "statement" ? (right ? 1 : 0) : right);
    const at = t + (prevWrong ? meta.errorPauseMs : 0) + (item.shape === "statement" ? 500 : 700) + Math.floor(rand() * 200);
    if (meta.clockMs != null && at > meta.clockMs) break;
    events.push({ i: item.i, ok, t: at });
    t = at;
    prevWrong = !ok;
  }
  return events;
}
const randomTapper = (deck: DuelItem[], seed: number) => tapper(deck, seed);

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

  for (const how of ["true", "false", "uniform"] as Tap[]) {
    it(`«верю — не верю»: нажиматель «${how}» без чтения в среднем не набирает очков и редко обыгрывает честный профиль`, () => {
      for (const band of BANDS) {
        const p = botProfile(band);
        let tapperSum = 0;
        let tapperWins = 0;
        const N = 2000;
        for (let m = 0; m < N; m++) {
          const deck = deckFor("truth", 900 + (m % 40), band);
          const tap = totals("truth", tapper(deck, 17 * m + 3, how));
          const honest = totals("truth", botTimeline(deck, p, `h${band}:${m}`));
          tapperSum += tap.score;
          if (winner(tap, honest).winner === "a") tapperWins++;
        }
        const mean = tapperSum / N;
        const rate = tapperWins / N;
        expect(mean, `${how} band ${band}: mean ${mean}`).toBeLessThan(0.5);
        // Нажатие наугад даёт разброс ±√n очков; против слабейшей полосы остаётся ≈ 14 % — это предел счёта ±1.
        const cap = how === "uniform" ? (band === 1 ? 0.17 : 0.12) : 0.08;
        expect(rate, `${how} band ${band}: win ${rate}`).toBeLessThan(cap);
      }
    });
  }
});

describe("бот: абсолютный темп в режимах на часах", () => {
  const stats = (mode: DuelModeId, band: DuelBand) => {
    const answered: number[] = [];
    const first: number[] = [];
    const gaps: number[] = [];
    for (let m = 0; m < 300; m++) {
      const tl = botTimeline(deckFor(mode, 300 + (m % 30), band), botProfile(band), `pace${m}`);
      answered.push(tl.length);
      first.push(tl[0].t);
      tl.forEach((e, k) => k && gaps.push(e.t - tl[k - 1].t));
    }
    return { answered: median(answered), first: median(first), gap: median(gaps) };
  };

  it("блиц: слабейшая полоса — не меньше 8 ответов за минуту, сильнее полоса — не медленнее", () => {
    const s = BANDS.map((b) => stats("blitz", b));
    expect(s[0].answered, JSON.stringify(s)).toBeGreaterThanOrEqual(8);
    for (let k = 1; k < 4; k++) expect(s[k].answered, JSON.stringify(s)).toBeGreaterThanOrEqual(s[k - 1].answered);
    // Не «сверхчеловек»: меньше половины набора и не быстрее 3 с на задание в среднем.
    for (const x of s) expect(x.answered).toBeLessThanOrEqual(20);
  });

  it("«верю — не верю»: не меньше 10 утверждений за 45 с, но не больше 18", () => {
    for (const band of BANDS) {
      const x = stats("truth", band);
      expect(x.answered, `band ${band}`).toBeGreaterThanOrEqual(10);
      expect(x.answered, `band ${band}`).toBeLessThanOrEqual(18);
    }
  });

  it("первый ответ и обычный промежуток — заметно раньше «Соперник не отвечает» (10 с)", () => {
    for (const mode of ["blitz", "truth"] as DuelModeId[]) {
      for (const band of BANDS) {
        const x = stats(mode, band);
        expect(x.first, `${mode} band ${band}`).toBeLessThan(IDLE_NOTICE_MS * 0.7);
        expect(x.gap, `${mode} band ${band}`).toBeLessThan(IDLE_NOTICE_MS * 0.7);
      }
    }
  });

  it("медиана первого ответа на часах = темп полосы × уровень (±3 %), чтение не добавляется сверху", () => {
    for (const mode of ["blitz", "truth"] as DuelModeId[]) {
      for (const band of BANDS) {
        const deck = deckFor(mode, 1, band);
        const p = botProfile(band);
        expect(botReadMs(deck[0])).toBe(0);
        const target = CLOCK_PACE_MS[band][deck[0].shape] * CLOCK_LEVEL_FACTOR[deck[0].level - 1];
        expect(thinkMedianMs(p, deck[0])).toBeCloseTo(target, 6);
        const t0 = Array.from({ length: 10_000 }, (_, s) => botTimeline(deck, p, `f${s}`)[0].t);
        expect(Math.abs(median(t0) / Math.max(BOT_FLOOR_MS, target) - 1), `${mode} band ${band}`).toBeLessThan(0.03);
      }
    }
  });

  it("утверждения: точность переводится с выбора через «знает» (±3 % на 10 000 seed)", () => {
    for (const band of BANDS) {
      const p = botProfile(band);
      const ok = [0, 0, 0];
      const all = [0, 0, 0];
      for (let s = 0; s < 10_000; s++) {
        const deck = deckFor("truth", s % 20, band);
        for (const e of botTimeline(deck, p, `acc${s}`)) {
          ok[deck[e.i].level - 1] += e.ok ? 1 : 0;
          all[deck[e.i].level - 1]++;
        }
      }
      for (const lv of [1, 2, 3] as const) {
        if (all[lv - 1] < 2000) continue;
        const want = botAccuracy(p, "x", lv, "statement");
        const know = (BOT_TABLE[band].acc[lv - 1] - 0.25) / 0.75;
        expect(want).toBeCloseTo(Math.min(BOT_ACC_CAP, know + (1 - know) / 2), 6);
        expect(Math.abs(ok[lv - 1] / all[lv - 1] - want), `band ${band} lv ${lv}`).toBeLessThan(0.03);
      }
    }
  });
});

describe("бот: тайм-аут на задании с лимитом", () => {
  it("выборка за лимитом — тайм-аут: t = лимит, неверно; иначе не позже лимита − 1 с", () => {
    let timeouts = 0;
    let total = 0;
    for (let s = 0; s < 3000; s++) {
      const deck = deckFor("ten", s % 30, 1);
      const tl = botTimeline(deck, botProfile(1), `to${s}`);
      expect(tl.length).toBe(deck.length);
      tl.forEach((e, k) => {
        const dt = e.t - (k ? tl[k - 1].t : 0);
        const lim = deck[k].limitMs!;
        total++;
        if (dt === lim) {
          timeouts++;
          expect(e.ok).toBe(false);
        } else expect(dt).toBeLessThanOrEqual(lim - LIMIT_MARGIN_MS);
      });
    }
    // Полоса 1 иногда не успевает (медиана 9–20 с + чтение до 16 с при лимите 20–45 с): сейчас ≈ 12 %.
    expect(timeouts / total).toBeGreaterThan(0.02);
    expect(timeouts / total).toBeLessThan(0.2);
  });

  it("сильная полоса почти не выходит за лимит", () => {
    let timeouts = 0;
    let total = 0;
    for (let s = 0; s < 1000; s++) {
      const deck = deckFor("ten", s % 30, 4);
      botTimeline(deck, botProfile(4), `to4:${s}`).forEach((e, k, tl) => {
        total++;
        if (e.t - (k ? tl[k - 1].t : 0) === deck[k].limitMs) timeouts++;
      });
    }
    expect(timeouts / total).toBeLessThan(0.03);
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
