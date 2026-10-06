import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

vi.mock("server-only", () => ({}));

// Ф3 дуэлей: подписанный старт, запись вызова (сервер пересобирает набор и сам судит ответы), карточка вызова, игра против
// записи, итог во входящих вызвавшего, очки недели. Хранилище — память, часы — подменные.
const holder = vi.hoisted(() => ({ kv: null as null | import("@/server/kv").Kv }));
vi.mock("@/server/kv", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/kv")>();
  return { ...real, getKv: () => holder.kv!, getStrictKv: () => holder.kv! };
});

const { createMemoryKv } = await import("@/server/kv");
const me = await import("@/app/api/social/me/route");
const home = await import("@/app/api/social/home/route");
const block = await import("@/app/api/social/block/route");
const start = await import("@/app/api/duel/start/route");
const record = await import("@/app/api/duel/challenge/route");
const view = await import("@/app/api/duel/challenge/[id]/route");
const accept = await import("@/app/api/duel/challenge/[id]/accept/route");
const result = await import("@/app/api/duel/challenge/[id]/result/route");
const { PLAYER_COOKIE } = await import("@/server/social/player");
const { buildDeck, correctAnswer, DECK_TAG } = await import("@/lib/duel/deck");
const { verifyStart } = await import("@/server/duel/seat");
const { answersOf } = await import("@/lib/duel/challenge");
const { runAnswer, startRun } = await import("@/lib/duel/run");

let ipN = 0;
const req = (method: string, path: string, opts: { body?: unknown; cookie?: string | null } = {}) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      host: "localhost",
      "x-forwarded-for": `10.8.${Math.floor(++ipN / 250)}.${ipN % 250}`,
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
const ctxOf = (id: string) => ({ params: Promise.resolve({ id }) });

interface Player {
  cookie: string;
  code: string;
  pid: string;
}

async function create(name: string): Promise<Player> {
  const res = await me.POST(req("POST", "/api/social/me", { body: { name, lang: "kk", lv: 4, cosmetics: { frame: "frame-neon", title: null }, ft: true } }));
  const json = await res.json();
  const m = new RegExp(`${PLAYER_COOKIE}=([^;]*)`).exec(res.headers.get("set-cookie") ?? "")!;
  const cookie = `${PLAYER_COOKIE}=${m[1]}`;
  return { cookie, code: json.player.code, pid: cookie.slice(PLAYER_COOKIE.length + 1, PLAYER_COOKIE.length + 23) };
}

let clock = Date.UTC(2026, 9, 6, 8, 0, 0);
let info: MockInstance<typeof console.info>;
const cmdsOf = (route: string): number => {
  const lines = info.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith(`[social] route=${route} `));
  return Number(/cmds=(\d+)/.exec(lines[lines.length - 1] ?? "")?.[1] ?? NaN);
};

type StartView = { start: string; mode: "ten" | "blitz"; seed: number; band: 1 | 2 | 3 | 4; n: number; topic?: string };

async function startSolo(p: Player, body: Record<string, unknown> = { mode: "ten", lv: 4, deckTag: DECK_TAG }) {
  const res = await start.POST(req("POST", "/api/duel/start", { cookie: p.cookie, body }));
  return { status: res.status, json: (await res.json()) as StartView & { error?: string } };
}

/**
 * Ответы ученика так, как их собирает экран: правильно `correct` первых заданий, остальные — неверно, по msEach мс на задание
 * (через тот же автомат матча и answersOf). Часы сервера двигаются на прошедшее время.
 */
function play(s: StartView, correct: number, msEach = 1500, count = s.n) {
  const deck = buildDeck(s.mode, s.seed, s.band, s.topic);
  let run = startRun();
  let now = 0;
  for (let k = 0; k < count; k++) {
    now = (run.pauseUntil || now) + msEach;
    const item = deck[k];
    const right = correctAnswer(item);
    const wrong = typeof right === "boolean" ? !right : (right + 1) % (item.shape === "choice" ? item.step.options.length : 2);
    run = runAnswer(run, deck, k < correct ? right : wrong, now);
  }
  clock += now + 5_000;
  return answersOf(s.mode, run);
}

async function recordChallenge(p: Player, s: StartView, answers: unknown) {
  const res = await record.POST(req("POST", "/api/duel/challenge", { cookie: p.cookie, body: { start: s.start, answers } }));
  return { status: res.status, json: (await res.json()) as { id: string; url: string; res: { score: number; correct: number; answered: number }; error?: string } };
}

async function acceptCh(p: Player, id: string) {
  const res = await accept.POST(req("POST", `/api/duel/challenge/${id}/accept`, { cookie: p.cookie }), ctxOf(id));
  return { status: res.status, json: (await res.json()) as { start: StartView; tl: { i: number; ok: boolean; t: number }[]; by: { code: string; name: string }; error?: string } };
}

async function sendResult(p: Player, id: string, s: StartView, answers: unknown) {
  const res = await result.POST(req("POST", `/api/duel/challenge/${id}/result`, { cookie: p.cookie, body: { start: s.start, answers } }), ctxOf(id));
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  clock = Date.UTC(2026, 9, 6, 8, 0, 0);
  holder.kv = createMemoryKv(() => clock);
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  vi.stubEnv("SOCIAL_SECRET", "test-social-secret");
  vi.stubEnv("SOCIAL_MEMORY_OK", "1");
  vi.stubEnv("SOCIAL_NAMES", "");
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/duel/start — подписанный старт", () => {
  it("без игрока 401; чужая сборка 409 stale; неверный режим/тема 400; старт — 0 команд Redis", async () => {
    const a = await create("Айжан");
    expect((await start.POST(req("POST", "/api/duel/start", { body: { mode: "ten", lv: 1, deckTag: DECK_TAG } }))).status).toBe(401);
    expect((await startSolo(a, { mode: "ten", lv: 1, deckTag: "other" })).json.error).toBe("stale");
    expect((await startSolo(a, { mode: "chess", lv: 1, deckTag: DECK_TAG })).status).toBe(400);
    expect((await startSolo(a, { mode: "topic", lv: 1, deckTag: DECK_TAG })).status).toBe(400);
    const ok = await startSolo(a, { mode: "topic", topic: "t01", lv: 12, deckTag: DECK_TAG });
    expect(ok.status).toBe(200);
    expect(cmdsOf("duel.start")).toBe(0);
    expect(ok.json).toMatchObject({ mode: "topic", topic: "t01", band: 3, n: 10, deckTag: DECK_TAG });
    const claims = verifyStart(ok.json.start)!;
    expect(claims).toMatchObject({ pid: a.pid, mode: "topic", band: 3, seed: ok.json.seed });
    expect(claims.ch).toBeUndefined();
  });
});

describe("вызов: запись → карточка → принять → итог во входящих", () => {
  it("полный путь, сервер сам судит ответы и не даёт сыграть дважды", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    const s = (await startSolo(a)).json;
    const rec = await recordChallenge(a, s, play(s, 6));
    expect(rec.status).toBe(200);
    expect(rec.json.url).toBe(`/duel/c/${rec.json.id}`);
    expect(rec.json.res).toMatchObject({ score: 6, correct: 6, answered: 10 });
    expect(cmdsOf("duel.challenge")).toBeLessThanOrEqual(6);
    // Тот же старт второй раз — тот же вызов (повтор отправки, двойное нажатие).
    expect((await recordChallenge(a, s, play(s, 10))).json.id).toBe(rec.json.id);
    const id = rec.json.id;

    // Публичная карточка: открыть может и тот, у кого нет профиля.
    const anon = await view.GET(req("GET", `/api/duel/challenge/${id}`), ctxOf(id));
    const card = await anon.json();
    expect(card).toMatchObject({ id, mode: "ten", by: { code: a.code, name: "Айжан", frame: "frame-neon" }, res: { score: 6 }, stale: false, mine: false, played: false });
    expect(JSON.stringify(card)).not.toContain(a.pid);

    expect((await acceptCh(a, id)).json.error).toBe("self");
    const acc = await acceptCh(b, id);
    expect(acc.status).toBe(200);
    expect(acc.json.tl).toHaveLength(10);
    expect(acc.json.start).toMatchObject({ mode: "ten", seed: s.seed, band: s.band });
    expect(verifyStart(acc.json.start.start)).toMatchObject({ pid: b.pid, ch: id });

    // Болат: 8 верных — победа над записью → +1 за принятый и +1 за победу.
    const r = await sendResult(b, id, acc.json.start, play(acc.json.start, 8));
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ result: "win", stored: true, counted: true, weekPts: 2, you: { correct: 8 }, rival: { correct: 6 } });
    // +2 с ревью: блокировка и карточка вызвавшего (не писать во входящие заблокировавшего или удалившегося).
    expect(cmdsOf("duel.challenge.result")).toBeLessThanOrEqual(19);
    expect(await holder.kv!.zscore("top:w:2026-W41", b.pid)).toBe(2);

    // У Айжан во входящих: Болат, его итог, её итог, для неё — поражение.
    const h = await (await home.GET(req("GET", "/api/social/home", { cookie: a.cookie }))).json();
    expect(h.inbox).toHaveLength(1);
    expect(h.inbox[0]).toMatchObject({ k: "chr", id, m: "ten", w: "loss", from: { code: b.code, name: "Болат" }, s: { correct: 8 }, r: { correct: 6 } });
    // Автор видит итоги принявших.
    const mine = await (await view.GET(req("GET", `/api/duel/challenge/${id}`, { cookie: a.cookie }), ctxOf(id))).json();
    expect(mine.mine).toBe(true);
    expect(mine.results).toEqual([expect.objectContaining({ card: expect.objectContaining({ code: b.code }), score: 8, correct: 8, w: "loss" })]);

    // Сыграть второй раз нельзя: «уже сыграно», повторный итог не сохраняется и очков не даёт.
    expect((await acceptCh(b, id)).json.error).toBe("already");
    const again = await sendResult(b, id, acc.json.start, play(acc.json.start, 10));
    expect(again.json).toMatchObject({ stored: false, counted: false, weekPts: 0 });
    expect(await holder.kv!.zscore("top:w:2026-W41", b.pid)).toBe(2);
  });

  it("слишком быстрые ответы — неверно и флаг; 3+ флага — не в топ", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    const s = (await startSolo(a)).json;
    const id = (await recordChallenge(a, s, play(s, 5))).json.id;
    const acc = (await acceptCh(b, id)).json;
    const r = await sendResult(b, id, acc.start, play(acc.start, 10, 300));
    expect(r.json).toMatchObject({ stored: true, counted: false, why: "fast", weekPts: 0, you: { correct: 0 } });
  });

  it("время клиента больше прошедшего по часам сервера — флаг sum (неверно)", async () => {
    const a = await create("Айжан");
    const s = (await startSolo(a)).json;
    const answers = play(s, 10, 10_000);
    clock -= 90_000; // прислали «100 с игры» через 15 с после старта
    const rec = await recordChallenge(a, s, answers);
    expect(rec.json.res.correct).toBeLessThan(3);
  });

  it("окно старта прошло — 410 expired; чужой или подделанный старт — 400", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    const s = (await startSolo(a)).json;
    const answers = play(s, 5);
    expect((await recordChallenge(b, s, answers)).json.error).toBe("bad_start");
    expect((await recordChallenge(a, { ...s, start: s.start.slice(0, -2) + "xx" }, answers)).json.error).toBe("bad_start");
    clock += 2 * 3_600_000;
    const late = await recordChallenge(a, s, answers);
    expect(late.status).toBe(410);
    expect(late.json.error).toBe("expired");
    // Старт вызова нельзя предъявить как запись своего вызова (ch) и наоборот.
    const s2 = (await startSolo(a)).json;
    const id = (await recordChallenge(a, s2, play(s2, 5))).json.id;
    const acc = (await acceptCh(b, id)).json;
    expect((await recordChallenge(b, acc.start, play(acc.start, 5))).json.error).toBe("bad_start");
    expect((await sendResult(b, id, s2, play(s2, 5))).json.error).toBe("bad_start");
  });

  it("задания обновились (другой тег) — stale: карточка помечена, принять нельзя", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    const s = (await startSolo(a)).json;
    const id = (await recordChallenge(a, s, play(s, 5))).json.id;
    await holder.kv!.hset(`du:ch:${id}`, { tag: "old-build" });
    expect((await (await view.GET(req("GET", `/api/duel/challenge/${id}`, { cookie: b.cookie }), ctxOf(id))).json()).stale).toBe(true);
    const r = await acceptCh(b, id);
    expect(r.status).toBe(409);
    expect(r.json.error).toBe("stale");
  });

  it("автор заблокировал — вызова «нет» (404), без раскрытия блокировки", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    const s = (await startSolo(a)).json;
    const id = (await recordChallenge(a, s, play(s, 5))).json.id;
    await block.POST(req("POST", "/api/social/block", { cookie: a.cookie, body: { code: b.code } }));
    expect((await view.GET(req("GET", `/api/duel/challenge/${id}`, { cookie: b.cookie }), ctxOf(id))).status).toBe(404);
    expect((await acceptCh(b, id)).status).toBe(404);
    expect((await view.GET(req("GET", "/api/duel/challenge/nope"), ctxOf("nope"))).status).toBe(404);
  });

  it("пара за сутки: третий засчитанный вызов той же пары — 0 очков (pair_limit)", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    const out: Record<string, unknown>[] = [];
    for (let k = 0; k < 3; k++) {
      const s = (await startSolo(a)).json;
      const id = (await recordChallenge(a, s, play(s, 3))).json.id;
      const acc = (await acceptCh(b, id)).json;
      out.push((await sendResult(b, id, acc.start, play(acc.start, 7))).json);
    }
    expect(out.map((r) => r.weekPts)).toEqual([2, 2, 0]);
    expect(out[2].why).toBe("pair_limit");
  });

  it("блиц: ответы в часах режима, штраф за ошибку; пачка больше набора — 400", async () => {
    const a = await create("Айжан");
    const s = (await startSolo(a, { mode: "blitz", lv: 2, deckTag: DECK_TAG })).json;
    const rec = await recordChallenge(a, s, play(s, 12, 1500, 20));
    expect(rec.status).toBe(200);
    // 12 верных (+2) и 8 неверных (−1) — если все уложились в 60 с часов блица.
    expect(rec.json.res).toMatchObject({ correct: 12, answered: 20, score: 12 * 2 - 8 });
    expect((await recordChallenge(a, (await startSolo(a, { mode: "ten", lv: 2, deckTag: DECK_TAG })).json, new Array(11).fill({ i: 0, a: 0, ms: 1000 }))).status).toBe(400);
  });
});

const { signStart } = await import("@/server/duel/seat");

describe("исправления по ревью Ф3", () => {
  const resign = (s: StartView, over: Record<string, unknown>): StartView => ({ ...s, start: signStart({ ...verifyStart(s.start)!, ...over }) });

  it("старт выдан до новой сборки (другой DECK_TAG) — запись и итог 409 stale, ничего не записано", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    const s = (await startSolo(a)).json;
    const old = resign(s, { deckTag: "old-build" });
    const rec = await recordChallenge(a, old, play(old, 6));
    expect(rec.status).toBe(409);
    expect(rec.json.error).toBe("stale");
    const id = (await recordChallenge(a, s, play(s, 6))).json.id;
    const acc = (await acceptCh(b, id)).json;
    const oldAcc = resign(acc.start, { deckTag: "old-build" });
    const r = await sendResult(b, id, oldAcc, play(oldAcc, 8));
    expect(r.status).toBe(409);
    expect(r.json.error).toBe("stale");
    expect(await holder.kv!.lrange(`pl:inbox:${a.pid}`, 0, -1)).toEqual([]);
    expect(await holder.kv!.zscore("top:w:2026-W41", b.pid)).toBeNull();
  });

  it("вызвавший заблокировал принявшего после «Принять» или удалил профиль — итог отвечает как обычно, но во входящие и итоги не пишется", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    const c = await create("Сауле");
    const s = (await startSolo(a)).json;
    const id = (await recordChallenge(a, s, play(s, 5))).json.id;
    const accB = (await acceptCh(b, id)).json;
    const accC = (await acceptCh(c, id)).json;
    await block.POST(req("POST", "/api/social/block", { cookie: a.cookie, body: { code: b.code } }));
    const rb = await sendResult(b, id, accB.start, play(accB.start, 8));
    expect(rb.status).toBe(200);
    expect(rb.json).toMatchObject({ result: "win", stored: true });
    expect(await holder.kv!.lrange(`pl:inbox:${a.pid}`, 0, -1)).toEqual([]);
    expect(await holder.kv!.lrange(`du:ch:${id}:r`, 0, -1)).toEqual([]);
    // Повтор того же итога всё равно «уже сыграно».
    expect((await sendResult(b, id, accB.start, play(accB.start, 8))).json.stored).toBe(false);

    await me.DELETE(req("DELETE", "/api/social/me", { cookie: a.cookie }));
    const rc = await sendResult(c, id, accC.start, play(accC.start, 3));
    expect(rc.status).toBe(200);
    expect(await holder.kv!.lrange(`pl:inbox:${a.pid}`, 0, -1)).toEqual([]);
    expect((await holder.kv!.hgetAllStr(`pl:${a.pid}`)).code).toBeUndefined();
  });

  it("подключи :p и :r живут до конца вызова, а не 30 дней от последнего итога", async () => {
    const { challengeTtlLeft, CHALLENGE_TTL_SEC } = await import("@/server/duel/challenge");
    expect(challengeTtlLeft({ at: 0 }, 0)).toBe(CHALLENGE_TTL_SEC);
    expect(challengeTtlLeft({ at: 0 }, 29 * 86_400_000)).toBe(86_400);
    expect(challengeTtlLeft({ at: 0 }, 31 * 86_400_000)).toBe(60);

    const a = await create("Айжан");
    const b = await create("Болат");
    const s = (await startSolo(a)).json;
    const id = (await recordChallenge(a, s, play(s, 5))).json.id;
    clock += 29 * 86_400_000;
    const acc = (await acceptCh(b, id)).json;
    expect((await sendResult(b, id, acc.start, play(acc.start, 8))).json.stored).toBe(true);
    expect(await holder.kv!.lrange(`du:ch:${id}:r`, 0, -1)).toHaveLength(1);
    clock += 2 * 86_400_000; // вызов истёк — и его итоги тоже
    expect(await holder.kv!.lrange(`du:ch:${id}:r`, 0, -1)).toEqual([]);
    expect(await holder.kv!.sismember(`du:ch:${id}:p`, b.pid)).toBe(false);
  });

  it("гонка двух отправок одного старта: вторая видит готовый вызов, лишняя запись удалена", async () => {
    const { createChallenge, chKeys } = await import("@/server/duel/challenge");
    const { countingKv } = await import("@/server/social/kv");
    const a = await create("Айжан");
    const s = (await startSolo(a)).json;
    const answers = play(s, 6);
    const claims = verifyStart(s.start)!;
    const [x, y] = await Promise.all([
      createChallenge(countingKv(holder.kv!), a.pid, s.start, claims, answers, clock),
      createChallenge(countingKv(holder.kv!), a.pid, s.start, claims, answers, clock),
    ]);
    expect(x && y).toBeTruthy();
    expect(x!.id).toBe(y!.id);
    expect([x!.existing, y!.existing].sort()).toEqual([false, true]);
    expect(await holder.kv!.getStr(chKeys.used(s.start))).toBe(x!.id);
    expect((await holder.kv!.hgetAllStr(chKeys.hash(x!.id))).by).toBe(a.pid);
  });

  it("публичная карточка вызова — процессный лимит по IP (60 за 10 минут), 0 команд на отказ", async () => {
    const a = await create("Айжан");
    const s = (await startSolo(a)).json;
    const id = (await recordChallenge(a, s, play(s, 5))).json.id;
    const fixed = () => new Request(`http://localhost/api/duel/challenge/${id}`, { headers: { host: "localhost", "x-forwarded-for": "10.99.1.1" } });
    for (let k = 0; k < 60; k++) expect((await view.GET(fixed(), ctxOf(id))).status).toBe(200);
    expect((await view.GET(fixed(), ctxOf(id))).status).toBe(429);
    expect(cmdsOf("duel.challenge.view")).toBe(0);
  });
});
