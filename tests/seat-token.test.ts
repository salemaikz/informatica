import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { signSeat, verifySeat, readSeat, signStart, verifyStart, withinWindow, SEAT_HEADER, SEAT_MAX_SPAN_MS } = await import("@/server/duel/seat");
type Seat = import("@/server/duel/seat").SeatClaims;

const SECRET = "test-secret";
const seat: Seat = {
  m: "m_abc123XYZ",
  s: "a",
  pid: "AbCdEfGhIjKlMnOpQrStUv",
  mode: "blitz",
  seed: 123456789,
  band: 2,
  n: 40,
  startAt: 1_700_000_000_000,
  endsAt: 1_700_000_060_000,
  deckTag: "d3adb33f",
};

/** Подменить поле в полезной нагрузке, оставив старую подпись. */
const tamper = (token: string, patch: Record<string, unknown>) => {
  const [payload, sig] = token.split(".");
  const o = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return `${Buffer.from(JSON.stringify({ ...o, ...patch })).toString("base64url")}.${sig}`;
};

afterEach(() => vi.unstubAllEnvs());

describe("подписанное место в матче", () => {
  it("подписывает и проверяет: все поля на месте", () => {
    const token = signSeat(seat, SECRET);
    expect(verifySeat(token, SECRET)).toEqual(seat);
    expect(token.length).toBeLessThan(400);
  });

  it("подмена любого поля ломает подпись", () => {
    const token = signSeat(seat, SECRET);
    for (const patch of [{ s: "b" }, { seed: 1 }, { pid: "ZZZZZZZZZZZZZZZZZZZZZZ" }, { endsAt: seat.endsAt + 60_000 }, { deckTag: "other" }, { m: "m_other12" }]) {
      expect(verifySeat(tamper(token, patch), SECRET)).toBeNull();
    }
  });

  it("чужой секрет, обрезанная подпись, мусор — null", () => {
    const token = signSeat(seat, SECRET);
    expect(verifySeat(token, "другой секрет")).toBeNull();
    expect(verifySeat(token.slice(0, -1), SECRET)).toBeNull();
    expect(verifySeat(`${token}x`, SECRET)).toBeNull();
    for (const junk of [null, undefined, 42, "", ".", "abc", "a.b.c", "x".repeat(5000)]) expect(verifySeat(junk, SECRET)).toBeNull();
  });

  it("старт нельзя предъявить как место и наоборот (вид токена в подписи)", () => {
    const { m, s, ...deck } = seat;
    void m;
    void s;
    const start = signStart(deck, SECRET);
    expect(verifyStart(start, SECRET)).toEqual(deck);
    expect(verifySeat(start, SECRET)).toBeNull();
    expect(verifyStart(signSeat(seat, SECRET), SECRET)).toBeNull();
  });

  it("старт против записи несёт id вызова; тема обязательна для режима topic", () => {
    const { m, s, ...deck } = seat;
    void m;
    void s;
    const t = signStart({ ...deck, mode: "topic", topic: "ent-08", n: 10, ch: "ch_123456" }, SECRET);
    expect(verifyStart(t, SECRET)).toMatchObject({ mode: "topic", topic: "ent-08", ch: "ch_123456" });
    expect(() => signStart({ ...deck, mode: "topic" }, SECRET)).toThrow(/invalid/);
  });

  it("неверные поля не подписываются (ошибка кода маршрута)", () => {
    expect(() => signSeat({ ...seat, band: 5 as 1 }, SECRET)).toThrow();
    expect(() => signSeat({ ...seat, mode: "chess" as "blitz" }, SECRET)).toThrow();
    expect(() => signSeat({ ...seat, endsAt: seat.startAt }, SECRET)).toThrow();
    expect(() => signSeat({ ...seat, endsAt: seat.startAt + SEAT_MAX_SPAN_MS + 1 }, SECRET)).toThrow();
    expect(() => signSeat({ ...seat, seed: 1.5 }, SECRET)).toThrow();
    expect(() => signSeat({ ...seat, pid: "short" }, SECRET)).toThrow();
  });

  it("лишние поля в токен не попадают", () => {
    const token = signSeat({ ...seat, extra: "x" } as Seat, SECRET);
    expect(verifySeat(token, SECRET)).toEqual(seat);
  });

  it("читается из заголовка x-duel-seat; секрет по умолчанию — SOCIAL_SECRET", () => {
    vi.stubEnv("SOCIAL_SECRET", "env-secret");
    const token = signSeat(seat);
    const req = new Request("http://localhost/api/duel/m/x/answers", { headers: { [SEAT_HEADER]: token } });
    expect(readSeat(req)).toEqual(seat);
    expect(readSeat(req, SECRET)).toBeNull();
    vi.stubEnv("SOCIAL_SECRET", "");
    expect(() => signSeat(seat)).toThrow(/SOCIAL_SECRET/);
  });

  it("окно приёма ответов: [startAt, endsAt + 3 с]", () => {
    expect(withinWindow(seat, seat.startAt - 1)).toBe(false);
    expect(withinWindow(seat, seat.startAt)).toBe(true);
    expect(withinWindow(seat, seat.endsAt + 3000)).toBe(true);
    expect(withinWindow(seat, seat.endsAt + 3001)).toBe(false);
  });
});

describe("часы сервера и тестовый сдвиг", () => {
  it("сдвиг только при DUEL_TEST_HOOKS=1 и никогда при VERCEL=1", async () => {
    const { serverNow, setClockOffset, advanceClock, clockOffset, resetClock, clockHooksEnabled } = await import("@/server/clock");
    resetClock();
    vi.stubEnv("DUEL_TEST_HOOKS", "");
    expect(setClockOffset(5000)).toBe(false);
    expect(advanceClock(5000)).toBeNull();
    expect(Math.abs(serverNow() - Date.now())).toBeLessThan(50);

    vi.stubEnv("DUEL_TEST_HOOKS", "1");
    expect(clockHooksEnabled()).toBe(true);
    expect(setClockOffset(20_000)).toBe(true);
    expect(advanceClock(5000)).toBe(25_000);
    expect(serverNow() - Date.now()).toBeGreaterThanOrEqual(24_950);
    expect(setClockOffset(10 * 86_400_000)).toBe(true);
    expect(clockOffset()).toBe(86_400_000); // потолок — сутки

    // На Vercel крючок выключен, даже если переменная осталась; сдвиг перестаёт действовать сразу.
    vi.stubEnv("VERCEL", "1");
    expect(clockHooksEnabled()).toBe(false);
    expect(Math.abs(serverNow() - Date.now())).toBeLessThan(50);
    expect(setClockOffset(1)).toBe(false);
    resetClock();
  });
});
