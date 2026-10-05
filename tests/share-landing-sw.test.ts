import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// public/sw.js как есть: страницы /r/<код> (#72) не кэшируем — каждая ссылка уникальна.
const code = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const sandbox: Record<string, unknown> = {
  self: { addEventListener: () => undefined, registration: {}, clients: {}, location: { search: "", origin: "https://x.test" } },
  URL,
};
runInNewContext(code, sandbox);
const routeFor = sandbox.routeFor as (req: unknown, origin: string) => string;
const ORIGIN = "https://x.test";
const req = (path: string, mode = "navigate") => ({ method: "GET", url: ORIGIN + path, mode, headers: new Headers() });

describe("sw: /r/ не кэшируется", () => {
  it("переход на страницу — только сеть (без сети «Нет интернета»), в кэш не пишем", () => {
    expect(routeFor(req("/r/x1-m-14-19-k-1-a9zq"), ORIGIN)).toBe("net");
    expect(routeFor(req("/r"), ORIGIN)).toBe("net");
  });
  it("картинки превью и клиентские запросы — мимо воркера", () => {
    expect(routeFor(req("/r/x1-m-14-19-k-1-a9zq/opengraph-image-1f2e3d", "no-cors"), ORIGIN)).toBe("ignore");
    expect(routeFor(req("/r/x1-m-14-19-k-1-a9zq/twitter-image", "no-cors"), ORIGIN)).toBe("ignore");
    expect(routeFor(req("/r/x1-m-14-19-k-1-a9zq?_rsc=1", "cors"), ORIGIN)).toBe("ignore");
  });
  it("похожие адреса — как раньше", () => {
    expect(routeFor(req("/result"), ORIGIN)).toBe("page");
    expect(routeFor(req("/reports", "navigate"), ORIGIN)).toBe("page");
  });
});
