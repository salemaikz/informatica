import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Маршруты живых дуэлей (этап 16Д, Ф4; docs/specs/duels.md §11): вызываем обработчики с Request, хранилище — память
// (сроки по serverNow: тестовые часы двигают и TTL) или подменный Upstash; часы — тестовый сдвиг server/clock.ts.
const holder = vi.hoisted(() => ({ kv: null as null | import("@/server/kv").Kv, noBurst: false }));
// Процессный лимит частоты (реальные часы): тест расхода команд прогоняет минуту матча за доли секунды.
vi.mock("@/server/rate-limit", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/rate-limit")>();
  return { ...real, rateLimit: (...a: Parameters<typeof real.rateLimit>) => holder.noBurst || real.rateLimit(...a) };
});
vi.mock("@/server/kv", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/kv")>();
  return { ...real, getKv: () => holder.kv!, getStrictKv: () => holder.kv! };
});

const { createMemoryKv, createUpstashKv } = await import("@/server/kv");
const clock = await import("@/server/clock");
const me = await import("@/app/api/social/me/route");
const queue = await import("@/app/api/duel/queue/route");
const ticketRoute = await import("@/app/api/duel/queue/[ticket]/route");
const room = await import("@/app/api/duel/room/route");
const roomJoin = await import("@/app/api/duel/room/[code]/join/route");
const view = await import("@/app/api/duel/m/[id]/route");
const ready = await import("@/app/api/duel/m/[id]/ready/route");
const answers = await import("@/app/api/duel/m/[id]/answers/route");
const done = await import("@/app/api/duel/m/[id]/done/route");
const leave = await import("@/app/api/duel/m/[id]/leave/route");
const rematch = await import("@/app/api/duel/m/[id]/rematch/route");
const testClock = await import("@/app/api/duel/test/clock/route");
const reportRoute = await import("@/app/api/social/report/route");
const { PLAYER_COOKIE } = await import("@/server/social/player");
const { DECK_TAG, buildDeck } = await import("@/lib/duel/deck");
const { correctAnswer } = await import("@/lib/duel/check");
const { kzWeek } = await import("@/lib/duel/week");
const { NextRequest } = await import("next/server");
import type { MatchJoin, MatchView } from "@/lib/duel/types";

let ipN = 0;
const freshIp = () => `10.7.${Math.floor(++ipN / 250)}.${ipN % 250}`;

function req(method: string, path: string, o: { body?: unknown; cookie?: string; seat?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      host: "localhost",
      "x-forwarded-for": freshIp(),
      ...(o.cookie ? { cookie: o.cookie } : {}),
      ...(o.seat ? { "x-duel-seat": o.seat } : {}),
      ...o.headers,
    },
    ...(o.body !== undefined ? { body: JSON.stringify(o.body) } : {}),
  });
}

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

interface Player {
  cookie: string;
  pid: string;
  /** Код друга (хранимый вид). */
  code: string;
}

async function player(name = "Аян", lv = 3): Promise<Player> {
  const res = await me.POST(req("POST", "/api/social/me", { body: { name, lang: "ru", lv, cosmetics: {}, ft: true } }));
  expect(res.status).toBe(200);
  const sc = res.headers.get("set-cookie")!;
  const v = new RegExp(`${PLAYER_COOKIE}=([^;]*)`).exec(sc)![1];
  const body = (await res.json()) as { player: { code: string } };
  return { cookie: `${PLAYER_COOKIE}=${v}`, pid: v.slice(0, 22), code: body.player.code };
}

type QueueReply = { state: "waiting"; ticket: string } | { state: "matched"; join: MatchJoin } | { state: "cancelled" };

async function join(p: Player, lv = 3, deckTag = DECK_TAG): Promise<QueueReply> {
  const res = await queue.POST(req("POST", "/api/duel/queue", { cookie: p.cookie, body: { lv, deckTag } }));
  expect(res.status).toBe(200);
  return res.json();
}

async function poll(p: Player, ticket: string, capture: boolean): Promise<QueueReply> {
  const res = await ticketRoute.GET(req("GET", `/api/duel/queue/${ticket}${capture ? "?try=1" : ""}`, { cookie: p.cookie }), params({ ticket }));
  expect(res.status).toBe(200);
  return res.json();
}

async function cancel(p: Player, ticket: string): Promise<QueueReply> {
  const res = await ticketRoute.DELETE(req("DELETE", `/api/duel/queue/${ticket}`, { cookie: p.cookie }), params({ ticket }));
  expect(res.status).toBe(200);
  return res.json();
}

async function getView(p: Player, id: string, seat?: string): Promise<MatchView> {
  const res = await view.GET(req("GET", `/api/duel/m/${id}`, { cookie: p.cookie, seat }), params({ id }));
  expect(res.status).toBe(200);
  return res.json();
}

const post = async (route: { POST: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response> }, action: string, p: Player, j: MatchJoin, body?: unknown) =>
  route.POST(req("POST", `/api/duel/m/${j.matchId}/${action}`, { cookie: p.cookie, seat: j.seat, body }), params({ id: j.matchId }));

/** Двое в очереди → матч. */
async function pairUp(): Promise<{ A: Player; B: Player; ja: MatchJoin; jb: MatchJoin }> {
  const A = await player("Аян");
  const B = await player("Әсем");
  const ra = await join(A);
  expect(ra.state).toBe("waiting");
  const rb = await join(B);
  expect(rb.state).toBe("matched");
  const pa = await poll(A, (ra as { ticket: string }).ticket, false);
  expect(pa.state).toBe("matched");
  return { A, B, ja: (pa as { join: MatchJoin }).join, jb: (rb as { join: MatchJoin }).join };
}

/** Перевести серверные часы на момент at (мс). */
const goTo = (at: number) => clock.setClockOffset(at - Date.now());

let infos: string[] = [];

beforeEach(() => {
  vi.stubEnv("SOCIAL_SECRET", "test-duel-secret");
  vi.stubEnv("SOCIAL_MEMORY_OK", "1");
  vi.stubEnv("SOCIAL_NAMES", "");
  vi.stubEnv("DUEL_TEST_HOOKS", "1");
  vi.stubEnv("VERCEL", "");
  clock.resetClock();
  holder.kv = createMemoryKv(clock.serverNow);
  infos = [];
  vi.spyOn(console, "info").mockImplementation((...a: unknown[]) => {
    infos.push(a.map(String).join(" "));
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  clock.resetClock();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  holder.noBurst = false;
});

describe("очередь «Блица»: захват через ZREM", () => {
  it("двое одновременно → один матч, ждущий не теряется", async () => {
    const A = await player("Аян");
    const B = await player("Әсем");
    const [ra, rb] = await Promise.all([join(A), join(B)]);
    const replies = [ra, rb];
    // Одновременные входы могут оба встать в очередь — их сводит следующая попытка захвата.
    let ja: MatchJoin | null = ra.state === "matched" ? ra.join : null;
    let jb: MatchJoin | null = rb.state === "matched" ? rb.join : null;
    for (let k = 0; k < 4 && (!ja || !jb); k++) {
      if (!ja && replies[0].state === "waiting") {
        const r = await poll(A, replies[0].ticket, k % 2 === 0);
        if (r.state === "matched") ja = r.join;
      }
      if (!jb && replies[1].state === "waiting") {
        const r = await poll(B, replies[1].ticket, k % 2 === 1);
        if (r.state === "matched") jb = r.join;
      }
    }
    expect(ja && jb).toBeTruthy();
    expect(ja!.matchId).toBe(jb!.matchId);
    expect(ja!.mode).toBe("blitz");
    expect(ja!.seed).toBe(jb!.seed);
    // Очередь пуста: никого не «потеряли» в ней.
    expect(await holder.kv!.zcard(`du:q:blitz:${DECK_TAG}`)).toBe(0);
  });

  it("одновременные повторные попытки двух ждущих сводят их без двойного матча", async () => {
    const A = await player("Аян");
    const B = await player("Әсем");
    const ra = (await join(A)) as { ticket: string };
    // B вошёл раньше, чем A встал в очередь? Нет — A уже ждёт; делаем B ждущим через отдельную очередь полос не выйдет,
    // поэтому моделируем: оба ждут (B пришёл, но A был занят), затем оба одновременно пытаются захватить.
    await holder.kv!.zrem(`du:q:blitz:${DECK_TAG}`, [`${ra.ticket}|${A.pid}`]);
    const rb = (await join(B)) as { state: string; ticket: string };
    expect(rb.state).toBe("waiting");
    await holder.kv!.zadd(`du:q:blitz:${DECK_TAG}`, clock.serverNow(), `${ra.ticket}|${A.pid}`);
    const [x, y] = await Promise.all([poll(A, ra.ticket, true), poll(B, rb.ticket, true)]);
    const joins = new Set<string>();
    for (const [p, r, t] of [
      [A, x, ra.ticket],
      [B, y, rb.ticket],
    ] as const) {
      let cur = r;
      for (let k = 0; k < 6 && cur.state !== "matched"; k++) {
        if (k === 2) goTo(clock.serverNow() + 2_500); // limbo (если был) истекает
        cur = await poll(p, t, k % 2 === 1);
      }
      expect(cur.state).toBe("matched");
      joins.add((cur as { join: MatchJoin }).join.matchId);
    }
    expect(joins.size).toBe(1);
  });

  it("трое → пара и один ждущий", async () => {
    const [A, B, C] = [await player("Аян"), await player("Әсем"), await player("Дана")];
    const ra = await join(A);
    const rb = await join(B);
    const rc = await join(C);
    expect(ra.state).toBe("waiting");
    expect(rb.state).toBe("matched");
    expect(rc.state).toBe("waiting");
    expect((await poll(A, (ra as { ticket: string }).ticket, false)).state).toBe("matched");
    const pc = await poll(C, (rc as { ticket: string }).ticket, true);
    expect(pc.state).toBe("waiting");
    expect(await holder.kv!.zcard(`du:q:blitz:${DECK_TAG}`)).toBe(1);
  });

  it("захват во время выбора Бита: отмена отвечает «matched» — вход в живой матч", async () => {
    const A = await player("Аян");
    const B = await player("Әсем");
    const ra = (await join(A)) as { ticket: string };
    const rb = await join(B);
    expect(rb.state).toBe("matched");
    const c = await cancel(A, ra.ticket);
    expect(c.state).toBe("matched");
    expect((c as { join: MatchJoin }).join.matchId).toBe((rb as { join: MatchJoin }).join.matchId);
  });

  it("обычная отмена — cancelled, очередь пуста", async () => {
    const A = await player("Аян");
    const ra = (await join(A)) as { ticket: string };
    expect((await cancel(A, ra.ticket)).state).toBe("cancelled");
    expect(await holder.kv!.zcard(`du:q:blitz:${DECK_TAG}`)).toBe(0);
  });

  it("полосы: в первые секунды далёкий уровень не подбирается, через 12 с — подбирается", async () => {
    const A = await player("Аян", 1);
    const B = await player("Әсем", 25);
    const ra = (await join(A, 1)) as { state: string; ticket: string };
    const rb = (await join(B, 25)) as { state: string; ticket: string };
    expect(ra.state).toBe("waiting");
    expect(rb.state).toBe("waiting");
    goTo(clock.serverNow() + 6_000);
    // Поллинг «живости»: оба обновляются.
    expect((await poll(A, ra.ticket, true)).state).toBe("waiting");
    goTo(clock.serverNow() + 7_000);
    const r = await poll(B, rb.ticket, true);
    expect(r.state).toBe("matched");
    expect((r as { join: MatchJoin }).join.band).toBe(1);
  });

  it("409 при другой версии набора, 401 без игрока", async () => {
    const A = await player();
    const res = await queue.POST(req("POST", "/api/duel/queue", { cookie: A.cookie, body: { lv: 3, deckTag: "old-build" } }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("update_needed");
    const anon = await queue.POST(req("POST", "/api/duel/queue", { body: { lv: 3, deckTag: DECK_TAG } }));
    expect(anon.status).toBe(401);
  });
});

/** Оба готовы, часы — на старте. */
async function startMatch() {
  const ctx = await pairUp();
  expect((await post(ready, "ready", ctx.A, ctx.ja)).status).toBe(200);
  const vb = (await (await post(ready, "ready", ctx.B, ctx.jb)).json()) as MatchView;
  expect(vb.state).toBe("countdown");
  goTo(ctx.ja.startAt + 100);
  return ctx;
}

function correct(j: MatchJoin, k: number) {
  const deck = buildDeck(j.mode, j.seed, j.band, j.topic);
  return correctAnswer(deck[k]);
}

describe("матч: готовность, ответы, завершение", () => {
  it("отмена без готовности: соперник не подтвердил за 6 с — cancelled no_ready", async () => {
    const { A, B, ja, jb } = await pairUp();
    await post(ready, "ready", A, ja);
    const v0 = await getView(A, ja.matchId, ja.seat);
    expect(v0.state).toBe("lobby");
    expect(v0.opp?.ready).toBe(false);
    goTo(ja.startAt - 1_000); // после срока готовности (6 с от создания)
    const late = (await (await post(ready, "ready", B, jb)).json()) as MatchView;
    expect(late.state).toBe("cancelled");
    expect(late.cancelled).toBe("no_ready");
    goTo(ja.startAt + 1_000);
    expect((await getView(A, ja.matchId, ja.seat)).state).toBe("cancelled");
  });

  it("ответы: верные засчитываются, полоса соперника видна, повтор не перезаписывает", async () => {
    const { A, B, ja, jb } = await startMatch();
    goTo(ja.startAt + 3_000);
    const a0 = { i: 0, a: correct(ja, 0), ms: 2_500 };
    const r1 = await post(answers, "answers", A, ja, { answers: [a0] });
    expect(r1.status).toBe(200);
    const b1 = (await r1.json()) as { view: MatchView; accepted: { i: number; ok: boolean }[] };
    expect(b1.accepted).toEqual([{ i: 0, ok: true }]);
    expect(b1.view.you.score).toBe(2);
    // Вторая вкладка шлёт другой ответ на то же задание — не перезаписывает.
    const dup = (await (await post(answers, "answers", A, ja, { answers: [{ i: 0, a: 99, ms: 2_500 }] })).json()) as { view: MatchView; accepted: unknown[] };
    expect(dup.accepted).toEqual([]);
    expect(dup.view.you.score).toBe(2);
    // Соперник видит мой таймлайн.
    const vb = await getView(B, jb.matchId, jb.seat);
    expect(vb.state).toBe("playing");
    expect(vb.opp?.answered).toBe(1);
    expect(vb.oppTl).toEqual([{ i: 0, ok: true, t: 2_500 }]);
    // Слишком быстрый ответ — неверно (флаг fast).
    goTo(ja.startAt + 3_500);
    const fast = (await (await post(answers, "answers", A, ja, { answers: [{ i: 1, a: correct(ja, 1), ms: 100 }] })).json()) as { accepted: { ok: boolean }[] };
    expect(fast.accepted[0].ok).toBe(false);
    // Пачка больше 5 — 400.
    const big = await post(answers, "answers", A, ja, { answers: Array.from({ length: 6 }, (_, i) => ({ i: i + 2, a: 0, ms: 1_000 })) });
    expect(big.status).toBe(400);
    // Без места — 403.
    const noSeat = await answers.POST(req("POST", `/api/duel/m/${ja.matchId}/answers`, { cookie: A.cookie, body: { answers: [] } }), params({ id: ja.matchId }));
    expect(noSeat.status).toBe(403);
    // Место другого игрока — как будто места нет.
    const stolen = await answers.POST(req("POST", `/api/duel/m/${ja.matchId}/answers`, { cookie: B.cookie, seat: ja.seat, body: { answers: [] } }), params({ id: ja.matchId }));
    expect(stolen.status).toBe(403);
  });

  it("ленивое завершение ровно один раз: два параллельных GET после конца", async () => {
    const { A, B, ja, jb } = await startMatch();
    goTo(ja.startAt + 5_000);
    const list = [0, 1, 2, 3, 4, 5].map((k, n) => ({ i: k, a: correct(ja, k), ms: 800 + n }));
    await post(answers, "answers", A, ja, { answers: list.slice(0, 5) });
    await post(answers, "answers", A, ja, { answers: list.slice(5) });
    goTo(ja.endsAt + 3_500);
    const [va, vb] = await Promise.all([getView(A, ja.matchId, ja.seat), getView(B, jb.matchId, jb.seat)]);
    const views = [va, vb];
    // Победитель гонки пишет итог; второй — тоже уже видит (или увидит в следующем опросе).
    for (let k = 0; k < 2; k++) if (views[k].state !== "finished") views[k] = await getView(k ? B : A, ja.matchId, k ? jb.seat : ja.seat);
    expect(views[0].state).toBe("finished");
    expect(views[1].state).toBe("finished");
    expect(views[0].result?.winner).toBe("you");
    expect(views[1].result?.winner).toBe("opp");
    // A засчитан (6 ответов), B — нет (0 ответов: «мало»).
    expect(views[0].result?.counted).toBe(true);
    expect(views[0].result?.weekPts).toBe(3);
    expect(views[1].result?.counted).toBe(false);
    expect(views[1].result?.why).toBe("short");
    // Очки недели начислены один раз.
    const week = `top:w:${kzWeek(clock.serverNow())}`;
    expect(await holder.kv!.zscore(week, A.pid)).toBe(3);
    expect(await holder.kv!.zscore(week, B.pid)).toBeNull();
    // Ещё несколько опросов — без второго начисления; история — одна запись.
    await Promise.all([getView(A, ja.matchId, ja.seat), getView(B, jb.matchId, jb.seat)]);
    expect(await holder.kv!.zscore(week, A.pid)).toBe(3);
    const [hist] = await holder.kv!.pipeline([{ op: "lrange", key: `du:h:${A.pid}`, start: 0, stop: 10 }] as const);
    expect(hist).toHaveLength(1);
    // Ответы после конца не принимаются.
    const late = (await (await post(answers, "answers", B, jb, { answers: [{ i: 0, a: correct(jb, 0), ms: 900 }] })).json()) as { accepted: unknown[] };
    expect(late.accepted).toEqual([]);
  });

  it("оба доиграли — итог сразу; лимит пары: 3-й матч за сутки не засчитан", async () => {
    const A = await player("Аян");
    const B = await player("Әсем");
    for (let round = 0; round < 3; round++) {
      const ra = (await join(A)) as { ticket: string };
      const rb = (await join(B)) as { join: MatchJoin };
      const ja = ((await poll(A, ra.ticket, false)) as { join: MatchJoin }).join;
      const jb = rb.join;
      await post(ready, "ready", A, ja);
      await post(ready, "ready", B, jb);
      goTo(ja.startAt + 4_000);
      for (const [p, j] of [
        [A, ja],
        [B, jb],
      ] as const) {
        await post(answers, "answers", p, j, { answers: [0, 1, 2, 3, 4].map((k) => ({ i: k, a: correct(j, k), ms: 750 })) });
      }
      await post(done, "done", A, ja);
      const v = (await (await post(done, "done", B, jb)).json()) as MatchView;
      expect(v.state).toBe("finished");
      expect(v.result?.reason).toBe("time");
      expect(v.result?.winner).toBe("draw");
      if (round < 2) expect(v.result?.counted).toBe(true);
      else {
        expect(v.result?.counted).toBe(false);
        expect(v.result?.why).toBe("pair_limit");
      }
      goTo(clock.serverNow() + 60_000);
    }
  });

  it("выход после старта — поражение; до старта — отмена", async () => {
    const { A, B, ja, jb } = await startMatch();
    const v = (await (await post(leave, "leave", A, ja)).json()) as MatchView;
    expect(v.state).toBe("finished");
    expect(v.result?.winner).toBe("opp");
    expect(v.result?.reason).toBe("left");
    expect(v.result?.weekPts).toBe(0);
    const vb = await getView(B, jb.matchId, jb.seat);
    expect(vb.result?.winner).toBe("you");
    // Рематч после ухода не создаётся.
    await post(rematch, "rematch", A, ja);
    const r = (await (await post(rematch, "rematch", B, jb)).json()) as MatchView;
    expect(r.rematch?.next).toBeUndefined();

    const p2 = await pairUp();
    const c = (await (await post(leave, "leave", p2.B, p2.jb)).json()) as MatchView;
    expect(c.state).toBe("cancelled");
    expect(c.cancelled).toBe("left");
  });

  it("техническая победа: соперник молчит 30 с, а я доиграл", async () => {
    const { A, B, ja, jb } = await startMatch();
    goTo(ja.startAt + 2_000);
    await getView(B, jb.matchId, jb.seat); // B на связи и пропал
    goTo(ja.startAt + 12_500);
    const notice = await getView(A, ja.matchId, ja.seat);
    expect(notice.opp!.idleMs).toBeGreaterThanOrEqual(10_000);
    expect(notice.state).toBe("playing");
    await post(done, "done", A, ja);
    goTo(ja.startAt + 33_000);
    const v = await getView(A, ja.matchId, ja.seat);
    expect(v.state).toBe("finished");
    expect(v.result?.reason).toBe("idle");
    expect(v.result?.winner).toBe("you");
  });

  it("реванш: оба согласились → новый матч с местами у обоих", async () => {
    const { A, B, ja, jb } = await startMatch();
    await post(done, "done", A, ja);
    const fin = (await (await post(done, "done", B, jb)).json()) as MatchView;
    expect(fin.state).toBe("finished");
    const r1 = (await (await post(rematch, "rematch", A, ja)).json()) as MatchView;
    expect(r1.rematch).toMatchObject({ you: true, opp: false });
    expect(r1.rematch?.next).toBeUndefined();
    const [x, y] = await Promise.all([post(rematch, "rematch", B, jb), post(rematch, "rematch", A, ja)]);
    const vx = (await x.json()) as MatchView;
    const vy = (await y.json()) as MatchView;
    const nb = vx.rematch?.next ?? (await getView(B, jb.matchId, jb.seat)).rematch?.next;
    const na = vy.rematch?.next ?? (await getView(A, ja.matchId, ja.seat)).rematch?.next;
    expect(na && nb).toBeTruthy();
    expect(na!.matchId).toBe(nb!.matchId);
    expect(na!.matchId).not.toBe(ja.matchId);
    expect(na!.seed).toBe(nb!.seed);
    const nv = await getView(A, na!.matchId, na!.seat);
    expect(nv.state).toBe("lobby");
    // Имя из профиля — всем после фильтра (решение владельца, duels.md, начало), а код друга случайному сопернику не уходит.
    expect(nv.opp?.card.name).toBe("Әсем");
    expect(nv.opp?.card.code).not.toBe(B.code);
    expect(nv.opp?.card.code).toMatch(/^~[A-Za-z0-9_-]{10}$/);
  });
});

describe("комната с другом", () => {
  it("создать → войти по коду → хозяин узнаёт место → играем «10 вопросов»", async () => {
    const A = await player("Аян", 12);
    const B = await player("Әсем", 2);
    const res = await room.POST(req("POST", "/api/duel/room", { cookie: A.cookie, body: { mode: "ten", lv: 12, deckTag: DECK_TAG } }));
    expect(res.status).toBe(200);
    const r = (await res.json()) as { code: string; url: string; matchId: string };
    expect(r.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(r.url).toBe(`/duel/r/${r.code}`);
    const lobby = await getView(A, r.matchId);
    expect(lobby.state).toBe("lobby");
    expect(lobby.opp).toBeNull();
    expect(lobby.join).toBeUndefined();

    // Своя ссылка — self; чужой код — expired; другая версия — 409.
    const self = await roomJoin.POST(req("POST", `/api/duel/room/${r.code}/join`, { cookie: A.cookie, body: { lv: 12, deckTag: DECK_TAG } }), params({ code: r.code }));
    expect(self.status).toBe(409);
    expect(await self.json()).toMatchObject({ error: "self", matchId: r.matchId });
    const none = await roomJoin.POST(req("POST", "/api/duel/room/ZZZZZZ/join", { cookie: B.cookie, body: { lv: 2, deckTag: DECK_TAG } }), params({ code: "ZZZZZZ" }));
    expect(none.status).toBe(404);
    const old = await roomJoin.POST(req("POST", `/api/duel/room/${r.code}/join`, { cookie: B.cookie, body: { lv: 2, deckTag: "old" } }), params({ code: r.code }));
    expect(old.status).toBe(409);

    // Нижний регистр и похожие буквы в коде из ссылки.
    const jr = await roomJoin.POST(req("POST", `/api/duel/room/${r.code.toLowerCase()}/join`, { cookie: B.cookie, body: { lv: 2, deckTag: DECK_TAG } }), params({ code: r.code.toLowerCase() }));
    expect(jr.status).toBe(200);
    const jb = ((await jr.json()) as { join: MatchJoin }).join;
    expect(jb.mode).toBe("ten");
    expect(jb.band).toBe(1); // меньшая полоса из двух
    // Третий — full.
    const C = await player("Дана");
    const full = await roomJoin.POST(req("POST", `/api/duel/room/${r.code}/join`, { cookie: C.cookie, body: { lv: 2, deckTag: DECK_TAG } }), params({ code: r.code }));
    expect(full.status).toBe(409);
    expect((await full.json()).error).toBe("full");

    const hostView = await getView(A, r.matchId);
    expect(hostView.join?.matchId).toBe(r.matchId);
    expect(hostView.opp?.card.name).toBe("Әсем");
    // В комнате с другом его код виден (это друг по ссылке).
    expect(hostView.opp?.card.code).toBe(B.code);
    const ja0 = hostView.join!;
    // Друг готов сразу, а хозяин ещё в мессенджере (вкладка скрыта): через 10 с матч не отменён.
    const vb0 = (await (await post(ready, "ready", B, jb)).json()) as MatchView;
    expect(vb0.state).toBe("lobby");
    goTo(clock.serverNow() + 10_000);
    expect((await getView(B, r.matchId, jb.seat)).state).toBe("lobby");
    // Хозяин вернулся и готов: старт назначен — через 5 с, места переподписаны с ним.
    const va = (await (await post(ready, "ready", A, ja0)).json()) as MatchView;
    expect(va.state).toBe("countdown");
    const ja = va.join!;
    // Старт — через 5 с после второй готовности (часы могли сдвинуться на миллисекунды с момента запроса).
    const left = ja.startAt - clock.serverNow();
    expect(left).toBeLessThanOrEqual(5_000);
    expect(left).toBeGreaterThan(4_900);
    const jb1 = (await getView(B, r.matchId, jb.seat)).join!;
    expect(jb1.startAt).toBe(ja.startAt);
    goTo(ja.startAt + 3_000);
    // Повторная готовность после срока не «отменяет» засчитанную (первая отметка — HSETNX).
    expect(((await (await post(ready, "ready", B, jb1)).json()) as MatchView).state).toBe("playing");
    const res1 = (await (await post(answers, "answers", B, jb1, { answers: [{ i: 0, a: correct(jb1, 0), ms: 2_800 }] })).json()) as { view: MatchView };
    expect(res1.view.you.correct).toBe(1);
    // Лимит задания вышел по часам сервера — тайм-аут, даже если клиент прислал малое ms.
    goTo(ja.startAt + 26_000);
    const t = (await (await post(answers, "answers", A, ja, { answers: [{ i: 0, a: correct(ja, 0), ms: 5_000 }] })).json()) as { accepted: { ok: boolean }[] };
    expect(t.accepted[0].ok).toBe(false);
  });

  it("хозяин закрыл комнату — друг получает expired", async () => {
    const A = await player("Аян");
    const B = await player("Әсем");
    const r = (await (await room.POST(req("POST", "/api/duel/room", { cookie: A.cookie, body: { mode: "blitz", lv: 3, deckTag: DECK_TAG } }))).json()) as { code: string; matchId: string };
    const v = (await (await leave.POST(req("POST", `/api/duel/m/${r.matchId}/leave`, { cookie: A.cookie }), params({ id: r.matchId }))).json()) as MatchView;
    expect(v.state).toBe("cancelled");
    const jr = await roomJoin.POST(req("POST", `/api/duel/room/${r.code}/join`, { cookie: B.cookie, body: { lv: 3, deckTag: DECK_TAG } }), params({ code: r.code }));
    expect(jr.status).toBe(404);
  });

  it("тема обязательна для режима «по теме»", async () => {
    const A = await player();
    const bad = await room.POST(req("POST", "/api/duel/room", { cookie: A.cookie, body: { mode: "topic", lv: 3, deckTag: DECK_TAG } }));
    expect(bad.status).toBe(400);
  });

  it("чужой матч не виден", async () => {
    const { ja } = await pairUp();
    const C = await player("Дана");
    const res = await view.GET(req("GET", `/api/duel/m/${ja.matchId}`, { cookie: C.cookie }), params({ id: ja.matchId }));
    expect(res.status).toBe(404);
  });
});

describe("выключатели, сбои и тестовые часы", () => {
  it("нет SOCIAL_SECRET — 503 social_disabled", async () => {
    vi.stubEnv("SOCIAL_SECRET", "");
    const res = await queue.POST(req("POST", "/api/duel/queue", { body: { lv: 1, deckTag: DECK_TAG } }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("social_disabled");
    const v = await view.GET(req("GET", "/api/duel/m/abcdefabcdef"), params({ id: "abcdefabcdef" }));
    expect(v.status).toBe(503);
  });

  it("SOCIAL_RANDOM=0 — очередь выключена (503 random_disabled), комнаты работают", async () => {
    const A = await player();
    vi.stubEnv("SOCIAL_RANDOM", "0");
    const res = await queue.POST(req("POST", "/api/duel/queue", { cookie: A.cookie, body: { lv: 1, deckTag: DECK_TAG } }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("random_disabled");
    const r = await room.POST(req("POST", "/api/duel/room", { cookie: A.cookie, body: { mode: "blitz", lv: 3, deckTag: DECK_TAG } }));
    expect(r.status).toBe(200);
  });

  it("Upstash не ответил — 503 social_unavailable", async () => {
    const A = await player();
    const fetchMock = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    holder.kv = createUpstashKv("https://x.upstash.io", "tok", null, fetchMock);
    vi.stubEnv("SOCIAL_MEMORY_OK", "");
    const res = await queue.POST(req("POST", "/api/duel/queue", { cookie: A.cookie, body: { lv: 1, deckTag: DECK_TAG } }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("social_unavailable");
  });

  it("лог: маршрут с id матча и число команд Redis", async () => {
    const { A, ja } = await pairUp();
    infos = [];
    await getView(A, ja.matchId, ja.seat);
    expect(infos.some((l) => l.includes(`route=duel.view m=${ja.matchId.slice(0, 6)}`) && /cmds=2\b/.test(l))).toBe(true);
  });

  it("POST /api/duel/test/clock: 404 без DUEL_TEST_HOOKS и на Vercel", async () => {
    const call = () => testClock.POST(req("POST", "/api/duel/test/clock", { body: { advanceMs: 1000 } }));
    const ok = await call();
    expect(ok.status).toBe(200);
    expect((await ok.json()).offsetMs).toBe(1000);
    vi.stubEnv("VERCEL", "1");
    expect((await call()).status).toBe(404);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DUEL_TEST_HOOKS", "");
    expect((await call()).status).toBe(404);
  });
});

describe("доработки по ревью Ф4", () => {
  it("комната: никто из двоих не готов за 60 с после входа друга — отмена no_ready", async () => {
    const A = await player("Аян");
    const B = await player("Әсем");
    const r = (await (await room.POST(req("POST", "/api/duel/room", { cookie: A.cookie, body: { mode: "blitz", lv: 3, deckTag: DECK_TAG } }))).json()) as { code: string; matchId: string };
    const jr = await roomJoin.POST(req("POST", `/api/duel/room/${r.code}/join`, { cookie: B.cookie, body: { lv: 3, deckTag: DECK_TAG } }), params({ code: r.code }));
    const jb = ((await jr.json()) as { join: MatchJoin }).join;
    await post(ready, "ready", B, jb);
    goTo(clock.serverNow() + 59_000);
    expect((await getView(B, r.matchId, jb.seat)).state).toBe("lobby");
    goTo(clock.serverNow() + 2_000);
    const v = await getView(B, r.matchId, jb.seat);
    expect(v.state).toBe("cancelled");
    expect(v.cancelled).toBe("no_ready");
  });

  it("блок-лист: заблокированный не входит в комнату (как «закрыта») и не сводится в очереди", async () => {
    const A = await player("Аян");
    const B = await player("Әсем");
    await holder.kv!.sadd(`pl:blk:${A.pid}`, [B.pid]);
    const r = (await (await room.POST(req("POST", "/api/duel/room", { cookie: A.cookie, body: { mode: "blitz", lv: 3, deckTag: DECK_TAG } }))).json()) as { code: string };
    const jr = await roomJoin.POST(req("POST", `/api/duel/room/${r.code}/join`, { cookie: B.cookie, body: { lv: 3, deckTag: DECK_TAG } }), params({ code: r.code }));
    expect(jr.status).toBe(404);
    expect((await jr.json()).error).toBe("expired");
    // Очередь: в обе стороны — A блокирует B; B не может захватить A, и A не захватывает B.
    const ra = (await join(A)) as { state: string; ticket: string };
    const rb = (await join(B)) as { state: string; ticket: string };
    expect(ra.state).toBe("waiting");
    expect(rb.state).toBe("waiting");
    expect((await poll(A, ra.ticket, true)).state).toBe("waiting");
    expect((await poll(B, rb.ticket, true)).state).toBe("waiting");
    expect(await holder.kv!.zcard(`du:q:blitz:${DECK_TAG}`)).toBe(2);
  });

  it("билет подписан: самодельный, чужой и просроченный — 404", async () => {
    const A = await player("Аян");
    const B = await player("Әсем");
    const ra = (await join(A)) as { ticket: string };
    // Своя полоса и «давнее» начало ради широкого допуска — подпись не сходится.
    const [id, , , sig] = ra.ticket.split(".");
    const forged = `${id}.4.${(Date.now() - 60_000).toString(36)}.${sig}`;
    const f = await ticketRoute.GET(req("GET", `/api/duel/queue/${forged}?try=1`, { cookie: A.cookie }), params({ ticket: forged }));
    expect(f.status).toBe(404);
    // Чужой билет (подписан для A).
    const other = await ticketRoute.GET(req("GET", `/api/duel/queue/${ra.ticket}?try=1`, { cookie: B.cookie }), params({ ticket: ra.ticket }));
    expect(other.status).toBe(404);
    const del = await ticketRoute.DELETE(req("DELETE", `/api/duel/queue/${ra.ticket}`, { cookie: B.cookie }), params({ ticket: ra.ticket }));
    expect(del.status).toBe(404);
    // Старше срока очереди.
    goTo(clock.serverNow() + 121_000);
    const old = await ticketRoute.GET(req("GET", `/api/duel/queue/${ra.ticket}`, { cookie: A.cookie }), params({ ticket: ra.ticket }));
    expect(old.status).toBe(404);
  });

  it("захватчик выбрал Бита, а его попытка уже захватила соперника: отмена возвращает это место", async () => {
    const A = await player("Аян");
    const B = await player("Әсем");
    const ra = (await join(A)) as { ticket: string };
    await holder.kv!.zrem(`du:q:blitz:${DECK_TAG}`, [`${ra.ticket}|${A.pid}`]);
    const rb = (await join(B)) as { state: string; ticket: string };
    expect(rb.state).toBe("waiting");
    await holder.kv!.zadd(`du:q:blitz:${DECK_TAG}`, clock.serverNow(), `${ra.ticket}|${A.pid}`);
    // Попытка B захватила A, но ответ потерялся (ученик уже нажал «Сыграть с Битом»).
    const lost = await poll(B, rb.ticket, true);
    expect(lost.state).toBe("matched");
    const c = await cancel(B, rb.ticket);
    expect(c.state).toBe("matched");
    expect((c as { join: MatchJoin }).join.matchId).toBe((lost as { join: MatchJoin }).join.matchId);
    const pa = await poll(A, ra.ticket, false);
    expect((pa as { join: MatchJoin }).join.matchId).toBe((lost as { join: MatchJoin }).join.matchId);
  });

  it("отмена во время попытки: попытка не ставит билет обратно в очередь («призрак»)", async () => {
    const A = await player("Аян");
    const ra = (await join(A)) as { ticket: string };
    const real = holder.kv!;
    // Отмена приходит, пока попытка A идёт: перед её ZADD.
    let injected = false;
    holder.kv = {
      ...real,
      pipeline: (async (ops: { op: string; member?: string }[]) => {
        if (!injected && ops.some((o) => o.op === "zadd" && o.member === `${ra.ticket}|${A.pid}`)) {
          injected = true;
          await cancelRaw(A, ra.ticket);
        }
        return real.pipeline(ops as never);
      }) as typeof real.pipeline,
    };
    const r = await poll(A, ra.ticket, true);
    holder.kv = real;
    expect(injected).toBe(true);
    expect(r.state).toBe("cancelled");
    expect(await real.zcard(`du:q:blitz:${DECK_TAG}`)).toBe(0);
    // Повторная попытка по отменённому билету — тоже cancelled.
    expect((await poll(A, ra.ticket, true)).state).toBe("cancelled");
  });

  it("сбой начисления после записи итога: матч не «висит», итог виден обоим", async () => {
    const { A, B, ja, jb } = await startMatch();
    goTo(ja.startAt + 5_000);
    await post(answers, "answers", A, ja, { answers: [0, 1, 2, 3, 4].map((k, n) => ({ i: k, a: correct(ja, k), ms: 800 + n })) });
    goTo(ja.endsAt + 3_500);
    const real = holder.kv!;
    let failed = 0;
    holder.kv = {
      ...real,
      pipeline: (async (ops: { op: string }[]) => {
        if (!failed && ops.some((o) => o.op === "zincrBy" || o.op === "lpush")) {
          failed++;
          throw new TypeError("fetch failed");
        }
        return real.pipeline(ops as never);
      }) as typeof real.pipeline,
    };
    const va = await getView(A, ja.matchId, ja.seat);
    holder.kv = real;
    expect(failed).toBe(1);
    expect(va.state).toBe("finished");
    expect(va.result?.winner).toBe("you");
    const vb = await getView(B, jb.matchId, jb.seat);
    expect(vb.state).toBe("finished");
    expect(vb.result?.winner).toBe("opp");
  });

  it("ответ, записанный после итога, не меняет показанный счёт", async () => {
    const { A, B, ja, jb } = await startMatch();
    goTo(ja.startAt + 5_000);
    await post(answers, "answers", A, ja, { answers: [{ i: 0, a: correct(ja, 0), ms: 900 }] });
    goTo(ja.endsAt + 3_500);
    const fin = await getView(A, ja.matchId, ja.seat);
    expect(fin.state).toBe("finished");
    expect(fin.you.score).toBe(2);
    // Гонка: ответ B проверен по снимку до итога и записан HSETNX уже после него.
    await holder.kv!.hsetnx(`du:m:${ja.matchId}`, "b:0", `1.${jb.endsAt - jb.startAt}.900.0`);
    const va = await getView(A, ja.matchId, ja.seat);
    const vb = await getView(B, jb.matchId, jb.seat);
    expect(va.opp?.score).toBe(0);
    expect(va.oppTl).toEqual([]);
    expect(va.result?.winner).toBe("you");
    expect(vb.you.score).toBe(0);
    expect(vb.opp?.score).toBe(2);
  });

  it("история случайного матча без кода соперника; комнаты — с кодом", async () => {
    const { A, ja } = await startMatch();
    await post(leave, "leave", A, ja);
    const [hist] = await holder.kv!.pipeline([{ op: "lrange", key: `du:h:${A.pid}`, start: 0, stop: 0 }] as const);
    const row = JSON.parse((hist as string[])[0]) as { opp: string; kind: string };
    expect(row.kind).toBe("live");
    expect(row.opp).toBe("");
  });

  it("расход команд Redis на матч «Блиц» (по логам [social] m=<id6>) — в бюджете ≤ 240", async () => {
    holder.noBurst = true;
    const { A, B, ja, jb } = await pairUp();
    infos = [];
    const id6 = ja.matchId.slice(0, 6);
    // VS: готовность и опрос лобби 2 с.
    await post(ready, "ready", A, ja);
    await post(ready, "ready", B, jb);
    for (let k = 0; k < 2; k++) {
      await getView(A, ja.matchId, ja.seat);
      await getView(B, jb.matchId, jb.seat);
    }
    // Игра 60 с, как useDuel: ответ раз в ~2,4 с; пачка уходит через 1,5 с после первого неотправленного ответа;
    // отдельный опрос — только если 3 с ничего не отправлялось.
    const sides = [
      [A, ja],
      [B, jb],
    ] as const;
    const next = [0, 0];
    const lastSend = [0, 0];
    const firstPending = [0, 0];
    for (let t = 250; t <= 60_000; t += 250) {
      goTo(ja.startAt + t);
      for (let s = 0; s < 2; s++) {
        const [p, j] = sides[s];
        if (!firstPending[s] && next[s] < 25 && (next[s] + 1) * 2_400 <= t) firstPending[s] = t;
        if (firstPending[s] && t - firstPending[s] >= 1_500) {
          const batch = [];
          while (next[s] < 25 && (next[s] + 1) * 2_400 <= t && batch.length < 5) {
            batch.push({ i: next[s], a: correct(j, next[s]), ms: 2_400 });
            next[s]++;
          }
          await post(answers, "answers", p, j, { answers: batch });
          lastSend[s] = t;
          firstPending[s] = 0;
        } else if (t - lastSend[s] >= 3_000) {
          await getView(p, j.matchId, j.seat);
          lastSend[s] = t;
        }
      }
    }
    // Итоги: «доиграл» и опрос 2 с до 15 с.
    goTo(ja.endsAt + 500);
    await post(done, "done", A, ja);
    await post(done, "done", B, jb);
    for (let k = 0; k < 7; k++) {
      await getView(A, ja.matchId, ja.seat);
      await getView(B, jb.matchId, jb.seat);
    }
    const total = infos.filter((l) => l.includes(` m=${id6} `)).reduce((sum, l) => sum + Number(/cmds=(\d+)/.exec(l)?.[1] ?? 0), 0);
    process.stdout.write(`[test] blitz match cmds=${total}\n`);
    expect(total).toBeGreaterThan(50);
    expect(total).toBeLessThanOrEqual(240);
  });
});

async function cancelRaw(p: Player, ticket: string) {
  return ticketRoute.DELETE(req("DELETE", `/api/duel/queue/${ticket}`, { cookie: p.cookie }), params({ ticket }));
}

describe("жалоба на живого соперника (слияние Ф3+Ф4)", () => {
  const report = (p: Player, body: unknown, seat?: string) =>
    reportRoute.POST(req("POST", "/api/social/report", { cookie: p.cookie, seat, body, headers: { origin: "http://localhost" } }));

  it("адресат — по матчу и своему месту, код из тела не принимается; чужое место — 400", async () => {
    const { A, B, ja, jb } = await pairUp();
    // B жалуется на «~метку» A: сервер сам находит pid A по месту B (сторона «другая»).
    const r = await report(B, { matchId: jb.matchId, reason: "cheat", where: "result", code: "ZZZZZZZZ" }, jb.seat);
    expect(r.status).toBe(200);
    const rep = await holder.kv!.zrange(`mod:rep:${A.pid}:cheat`, 0, -1);
    expect(rep.map((e) => e.member)).toEqual([B.pid]);
    expect(await holder.kv!.zcard(`mod:rep:${B.pid}:cheat`)).toBe(0);
    // Место A с телом B (чужой игрок) или место другого матча — 400, ничего не пишется.
    expect((await report(B, { matchId: jb.matchId, reason: "name", where: "result" }, ja.seat)).status).toBe(400);
    expect((await report(B, { matchId: "abcdefabcdef", reason: "name", where: "result" }, jb.seat)).status).toBe(400);
    expect((await report(B, { matchId: jb.matchId, reason: "name", where: "result" }, "garbage")).status).toBe(400);
    expect(await holder.kv!.zcard(`mod:rep:${A.pid}:name`)).toBe(0);
  });
});
