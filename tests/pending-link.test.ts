import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PENDING_LINK_KEY, PENDING_LINK_TTL_MS, pendingLinkOf, savePendingLink, takePendingLink } from "@/lib/pending-link";

// Ссылка-вызов, которая переживает онбординг (#73). Принимаем только /exam/run с валидными kind + seed + ch.
const GOOD = "/exam/run?kind=mini&seed=42&ch=14-19-a9zq";

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

const setWindow = (w: unknown) => {
  (globalThis as { window?: unknown }).window = w;
};

let store: ReturnType<typeof fakeStorage>;
beforeEach(() => {
  store = fakeStorage();
  setWindow({ localStorage: store });
});
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("pending-link: что принимаем", () => {
  it("вызов на пробник — да, в каноничной записи", () => {
    expect(pendingLinkOf(GOOD)).toBe(GOOD);
    expect(pendingLinkOf("/exam/run?ch=14-19-a9zq&seed=42&kind=mini&utm=1")).toBe(GOOD);
    expect(pendingLinkOf("/exam/run?kind=topic&seed=7&topics=t04,t05&ch=3-19-abcd")).toBe("/exam/run?kind=topic&seed=7&topics=t04%2Ct05&ch=3-19-abcd");
  });

  it("всё остальное — нет", () => {
    for (const bad of [
      "//evil.com/exam/run?kind=mini&seed=42&ch=14-19-a9zq",
      "https://evil.com/exam/run?kind=mini&seed=42&ch=14-19-a9zq",
      "/\\evil.com",
      "/exam/run?kind=mini&seed=42", // нет ch
      "/exam/run?kind=mini&ch=14-19-a9zq", // нет seed
      "/exam/run?kind=mini&seed=x&ch=14-19-a9zq",
      "/exam/run?kind=hack&seed=1&ch=14-19-a9zq",
      "/exam/run?kind=mini&seed=1&ch=30-19-a9zq", // ch не проходит проверку
      "/exam/run?kind=unit&seed=1&unit=u3&ch=14-19-a9zq", // у контрольной вызова нет
      "/exam/result/abc",
      "/exam/runner?kind=mini&seed=1&ch=14-19-a9zq",
      "/r/x1-abc",
      "/",
      "",
      "/exam/run?" + "a".repeat(400),
    ]) {
      expect(pendingLinkOf(bad), bad).toBeNull();
    }
    for (const bad of [null, undefined, 5, {}, ["/exam/run"]]) expect(pendingLinkOf(bad)).toBeNull();
  });
});

describe("pending-link: хранение", () => {
  it("сохранить и взять один раз", () => {
    savePendingLink(GOOD, 1000);
    expect(takePendingLink(2000)).toBe(GOOD);
    expect(takePendingLink(2000)).toBeNull();
    expect(store.raw.has(PENDING_LINK_KEY)).toBe(false);
  });

  it("чужие адреса не сохраняются", () => {
    savePendingLink("//evil.com", 1000);
    savePendingLink("/exam/run?kind=mini", 1000);
    savePendingLink("/exam/run?kind=mini&seed=1", 1000);
    savePendingLink("/learn", 1000);
    expect(store.raw.size).toBe(0);
    expect(takePendingLink(1000)).toBeNull();
  });

  it("срок — час", () => {
    savePendingLink(GOOD, 1000);
    expect(takePendingLink(1000 + PENDING_LINK_TTL_MS)).toBe(GOOD);
    savePendingLink(GOOD, 1000);
    expect(takePendingLink(1000 + PENDING_LINK_TTL_MS + 1)).toBeNull();
    expect(store.raw.size).toBe(0);
  });

  it("мусор в хранилище — null и ключ удалён", () => {
    for (const raw of [
      "",
      "{",
      "null",
      "[]",
      "5",
      '{"href":5,"at":1}',
      '{"href":"/exam/run?kind=mini&seed=1","at":1}',
      '{"href":"//evil.com","at":1}',
      `{"href":"${GOOD}","at":"1"}`,
      `{"href":"${GOOD}"}`,
    ]) {
      store.raw.set(PENDING_LINK_KEY, raw);
      expect(takePendingLink(1000), raw).toBeNull();
      expect(store.raw.has(PENDING_LINK_KEY)).toBe(false);
    }
  });

  it("запись с «будущим» временем далеко вперёд не принимается", () => {
    store.raw.set(PENDING_LINK_KEY, JSON.stringify({ href: GOOD, at: 1000 + 10 * PENDING_LINK_TTL_MS }));
    expect(takePendingLink(1000)).toBeNull();
  });

  it("хранилище недоступно или бросает — без ошибок", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(() => savePendingLink(GOOD, 1)).not.toThrow();
    expect(takePendingLink(1)).toBeNull();
    const boom = () => {
      throw new Error("denied");
    };
    setWindow({ localStorage: { getItem: boom, setItem: boom, removeItem: boom } });
    expect(() => savePendingLink(GOOD, 1)).not.toThrow();
    expect(takePendingLink(1)).toBeNull();
  });
});

describe("pending-link: ссылки соцчасти (Ф3 дуэлей)", () => {
  const TOKEN = "AbCdEfGhIjKlMnOpQrSt_-"; // 22 символа base64url
  const CH = "Ab_-12cdEF"; // 10 символов

  it("/f/<22> и /duel/c/<10> принимаются; query и hash отбрасываются", () => {
    expect(pendingLinkOf(`/f/${TOKEN}`)).toBe(`/f/${TOKEN}`);
    expect(pendingLinkOf(`/duel/c/${CH}`)).toBe(`/duel/c/${CH}`);
    expect(pendingLinkOf(`/f/${TOKEN}?utm_source=wa#x`)).toBe(`/f/${TOKEN}`);
    expect(pendingLinkOf(`/duel/c/${CH}#top`)).toBe(`/duel/c/${CH}`);
  });

  it("другая длина, лишние сегменты, обход пути, чужой домен — отказ", () => {
    for (const bad of [
      `/f/${TOKEN}x`,
      `/f/${TOKEN.slice(1)}`,
      `/f/${TOKEN}/`,
      `/f/${TOKEN}/accept`,
      `/duel/c/${CH}0`,
      `/duel/c/${CH.slice(1)}`,
      `/duel/c/${CH}/../../owner`,
      `/duel/c/../../${CH}`,
      `/f/..%2F..%2Fowner123456`,
      `//evil.example/f/${TOKEN}`,
      `https://evil.example/duel/c/${CH}`,
      `/duel/c/${CH.slice(0, 9)}.`,
      `/F/${TOKEN}`,
      `/f/${TOKEN}`.padEnd(301, "?"),
    ])
      expect(pendingLinkOf(bad), bad).toBeNull();
  });

  it("слияние Ф3+Ф4: и ссылки соцчасти, и комната живой дуэли /duel/r/<код>", () => {
    expect(pendingLinkOf(`/f/${TOKEN}`)).toBe(`/f/${TOKEN}`);
    expect(pendingLinkOf("/duel/r/abc12z")).toBe("/duel/r/ABC12Z");
    // Хвосты (метки рекламы мессенджеров, якорь) отбрасываются — как у ссылок соцчасти.
    expect(pendingLinkOf("/duel/r/ABC12Z#x")).toBe("/duel/r/ABC12Z");
    expect(pendingLinkOf("/duel/r/K7Q2XM?fbclid=IwAR0abc")).toBe("/duel/r/K7Q2XM");
    expect(pendingLinkOf(`/duel/c/${CH}?fbclid=IwAR0abc`)).toBe(`/duel/c/${CH}`);
  });

  it("сохраняется и возвращается после онбординга", () => {
    savePendingLink(`/duel/c/${CH}?from=share`, 1000);
    expect(takePendingLink(2000)).toBe(`/duel/c/${CH}`);
  });
});
