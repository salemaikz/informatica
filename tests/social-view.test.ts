import { beforeEach, describe, expect, it, vi } from "vitest";
import { playerTag, sanitizeCard, sanitizeInbox, sanitizePlayer, sanitizeTop, visibleName } from "@/lib/social/view";
import { answersOf, isRecNonce, recHref, sanitizeChallenge, sanitizeStart } from "@/lib/duel/challenge";
import { pendingLinkOf } from "@/lib/pending-link";
import { buildDeck, correctAnswer } from "@/lib/duel/deck";
import { runAnswer, runTick, startRun } from "@/lib/duel/run";
import { duelXpBase, hideName, HIDDEN_NAMES_MAX, sanitizeDuels } from "@/lib/duel/record";
import { useApp } from "@/lib/store";

vi.mock("server-only", () => ({}));
const { judgeRecord } = await import("@/server/duel/challenge");

// Ф3 дуэлей на клиенте: разбор ответов сервера (недоверенные данные), номер игрока вместо имени, скрытые имена в сторе,
// ответы для сервера (answersOf) — сервер восстанавливает ровно те же моменты ответов, ссылки соцчасти в pending-link.

const card = { code: "K7QF29XM", name: "Әсем", lv: 7, frame: "frame-neon", title: null };

describe("имена и карточки", () => {
  it("номер игрока — 4 цифры, один и тот же для кода", () => {
    const n = playerTag("K7QF29XM");
    expect(n).toBeGreaterThanOrEqual(1000);
    expect(n).toBeLessThanOrEqual(9999);
    expect(playerTag("K7QF29XM")).toBe(n);
    expect(new Set(["A0000000", "B1111111", "C2222222", "D3333333"].map(playerTag)).size).toBeGreaterThan(1);
  });

  it("имя скрыто жалобой или не задано — null (интерфейс рисует «Игрок 1234»)", () => {
    expect(visibleName(card, [])).toBe("Әсем");
    expect(visibleName(card, ["K7QF29XM"])).toBeNull();
    expect(visibleName({ ...card, name: null }, [])).toBeNull();
  });

  it("карточка из сети: чужой код, мусор в рамке, длинное имя — отбрасываются", () => {
    expect(sanitizeCard(card)).toEqual(card);
    expect(sanitizeCard({ ...card, code: "<script>" })).toBeNull();
    expect(sanitizeCard({ ...card, frame: "frame-hack", title: 5, lv: 1e9 })).toEqual({ ...card, frame: null, title: null, lv: 999 });
    expect(sanitizeCard({ ...card, name: "x".repeat(41) })?.name).toBeNull();
    expect(sanitizePlayer({ ...card, nameState: "weird", ft: false })).toMatchObject({ nameState: "none", ft: false });
  });

  it("входящие: только известные записи; автор — карточка или null", () => {
    const item = { k: "chr", id: "abcdefghij", m: "blitz", from: card, s: { score: 9, correct: 6, answered: 9, timeMs: 50_000 }, r: { score: 7, correct: 5 }, w: "loss", at: 5 };
    const out = sanitizeInbox([item, { ...item, k: "room" }, { ...item, id: "../x" }, null, { ...item, from: null, w: "?" }]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: "abcdefghij", mode: "blitz", outcome: "loss", their: { score: 9 }, mine: { score: 7, answered: 5 }, from: { code: card.code } });
    expect(out[1]).toMatchObject({ from: null, outcome: "draw" });
    expect(sanitizeInbox("x")).toEqual([]);
  });

  it("топ: строки с карточкой, скрытые очки — null", () => {
    expect(sanitizeTop({ rows: [{ card, score: 5, me: true }, { card: { ...card, code: "B1111111" }, score: null }, { card: {} }] })).toEqual([
      { card, score: 5, me: true },
      { card: { ...card, code: "B1111111" }, score: null, me: false },
    ]);
  });

  it("старт и карточка вызова из сети", () => {
    expect(sanitizeStart({ start: "a.b", mode: "ten", seed: 5, band: 2, deckTag: "dev" })).toMatchObject({ n: 10 });
    expect(sanitizeStart({ start: "a.b", mode: "topic", seed: 5, band: 2, deckTag: "dev" })).toBeNull();
    const v = sanitizeChallenge({ id: "abcdefghij", mode: "ten", band: 1, by: card, res: { score: 3, correct: 3 }, mine: true, results: [{ card, score: 2, w: "win" }, { card: null }] });
    expect(v).toMatchObject({ mine: true, stale: false, results: [{ score: 2, w: "win" }] });
  });
});

describe("answersOf: сервер восстанавливает те же моменты ответов", () => {
  for (const mode of ["blitz", "truth", "ten"] as const) {
    it(`${mode}: t судьи = t экрана (с паузами после ошибок и тайм-аутами)`, () => {
      const deck = buildDeck(mode, 4242, 2);
      let run = startRun();
      let now = 0;
      for (let k = 0; k < 8; k++) {
        now = Math.max(now, run.pauseUntil) + 900 + k * 37;
        if (mode === "ten" && k === 3) {
          // тайм-аут: ученик молчит дольше лимита
          run = runTick(run, deck, run.itemAt + (deck[k].limitMs ?? 0) + 1);
          now = run.itemAt;
          continue;
        }
        const right = correctAnswer(deck[k]);
        const ans = k % 3 === 1 ? (typeof right === "boolean" ? !right : (right + 1) % 3) : right;
        run = runAnswer(run, deck, ans, now);
      }
      const answers = answersOf(mode, run);
      expect(answers.map((a) => a.i)).toEqual(run.events.map((e) => e.i));
      // Запись пришла одной пачкой через 2 с после последнего ответа (как у экрана вызова).
      const last = run.events[run.events.length - 1].t;
      const claims = { pid: "p".repeat(22), mode, seed: 4242, band: 2 as const, n: deck.length, startAt: 0, endsAt: 3_600_000, deckTag: "dev" };
      const judged = judgeRecord(claims, answers, last + 2000)!;
      expect(judged.judged.map((j) => j.t)).toEqual(run.events.map((e) => e.t));
      expect(judged.judged.map((j) => j.ok)).toEqual(run.events.map((e) => e.ok));
      expect(judged.flags).toBe(0);
    });
  }
});

describe("адреса", () => {
  it("recHref с nonce; pending-link пропускает /f/<token> и /duel/c/<id>, отбрасывая хвосты", () => {
    const h = recHref("topic", "t03", "abc123");
    expect(h).toBe("/duel/rec?mode=topic&topic=t03&r=abc123");
    expect(new URL(recHref("blitz"), "http://x").searchParams.get("r")).toMatch(/^[a-z0-9]{6,16}$/);
    expect(isRecNonce("abc123")).toBe(true);
    expect(isRecNonce("ABC")).toBe(false);
    expect(pendingLinkOf("/f/AAAAAAAAAAAAAAAAAAAAAA")).toBe("/f/AAAAAAAAAAAAAAAAAAAAAA");
    expect(pendingLinkOf("/f/AAAAAAAAAAAAAAAAAAAAAA?utm=1#x")).toBe("/f/AAAAAAAAAAAAAAAAAAAAAA");
    expect(pendingLinkOf("/duel/c/abcdefghij")).toBe("/duel/c/abcdefghij");
    expect(pendingLinkOf("/duel/c/abc")).toBeNull();
    expect(pendingLinkOf("/f/short")).toBeNull();
    expect(pendingLinkOf("//evil.example/f/AAAAAAAAAAAAAAAAAAAAAA")).toBeNull();
    expect(pendingLinkOf("/duel/c/abcdefghij/../../x")).toBeNull();
  });
});

describe("стор: скрытые имена и запись вызова", () => {
  beforeEach(() => {
    useApp.setState(useApp.getInitialState(), true);
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 9, 6, 8));
  });

  it("hidePlayerName: сразу, без повторов, не больше 200; мусор — нет; санитайзер хранит коды", () => {
    useApp.getState().hidePlayerName("K7QF29XM");
    useApp.getState().hidePlayerName("K7QF29XM");
    useApp.getState().hidePlayerName("<b>");
    expect(useApp.getState().duels.hiddenNames).toEqual(["K7QF29XM"]);
    let list: string[] = [];
    for (let k = 0; k < HIDDEN_NAMES_MAX + 5; k++) list = hideName(list, `A${String(k).padStart(7, "0")}`);
    expect(list).toHaveLength(HIDDEN_NAMES_MAX);
    expect(sanitizeDuels({ hiddenNames: ["K7QF29XM", "K7QF29XM", 5, "bad"] }).hiddenNames).toEqual(["K7QF29XM"]);
  });

  it("запись своего вызова (solo): без бонуса за победу; запись друга (ghost) — бонус как над человеком", () => {
    const you = { score: 6, correct: 6 };
    expect(duelXpBase("ten", you, "win", "solo")).toBe(duelXpBase("ten", you, "loss", "solo"));
    expect(duelXpBase("ten", you, "win", "ghost") - duelXpBase("ten", you, "loss", "ghost")).toBe(5);
    const side = { score: 6, correct: 6, answered: 10, timeMs: 30_000 };
    const r = useApp.getState().recordDuel({ id: "rec.1.x", matchId: "rec.1", mode: "ten", opp: "solo", you: side, rival: side, attempts: [], wrong: [] });
    expect(r.result).toBe("draw");
    const g = useApp
      .getState()
      .recordDuel({ id: "ch.x.y", matchId: "ch.x", mode: "ten", opp: "ghost", oppName: "Болат", oppLevel: 5, oppCode: "B1111111", chId: "abcdefghij", you: side, rival: { ...side, score: 3, correct: 3 }, attempts: [], wrong: [] });
    expect(g.record).toMatchObject({ opp: "ghost", oppName: "Болат", oppCode: "B1111111", chId: "abcdefghij", result: "win" });
    const back = sanitizeDuels(JSON.parse(JSON.stringify(useApp.getState().duels)));
    expect(back.history.map((h) => h.opp)).toEqual(["ghost", "solo"]);
    expect(back.history[0]).toMatchObject({ oppCode: "B1111111", chId: "abcdefghij" });
    // «Резинка» бота от вызовов не меняется.
    expect(useApp.getState().duels.botAdj).toBe(0);
  });
});
