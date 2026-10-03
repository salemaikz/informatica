import { describe, expect, it } from "vitest";
import { NAV_GROUPS, groupOf, hubGroup, normalizePath, subOf, underPath } from "@/components/app/nav";
import { dict } from "@/i18n/dict";

describe("groupOf", () => {
  const cases: [string, string | null][] = [
    ["/learn", "learn"],
    ["/lesson/abc", "learn"],
    ["/practice", "practice"],
    ["/drill", "practice"],
    ["/exam", "practice"],
    ["/exam/run", "practice"],
    ["/exam/result/1", "practice"],
    ["/code", "practice"],
    ["/code/python/py-1", "practice"],
    ["/history", "practice"],
    ["/history/xyz", "practice"],
    ["/game/bet", "practice"],
    ["/tutor", "tutor"],
    ["/tutor/chat/1", "tutor"],
    ["/materials", "materials"],
    ["/notes", "materials"],
    ["/notes/abc", "materials"],
    ["/theory", "materials"],
    ["/theory/py-1-vars", "materials"],
    ["/search", "materials"],
    ["/stats", "progress"],
    ["/shop", "progress"],
    ["/plans", "progress"],
    ["/profile", "progress"],
    ["/", null],
    ["/onboarding", null],
    ["/examples", null],
  ];
  it.each(cases)("%s -> %s", (path, group) => expect(groupOf(path)).toBe(group));
  it("игнорирует хвостовой слэш и query", () => {
    expect(groupOf("/shop/")).toBe("progress");
    expect(groupOf("/notes?x=1")).toBe("materials");
  });
});

describe("subOf", () => {
  it("подраздел по пути", () => {
    expect(subOf("/practice")).toBe("train");
    expect(subOf("/drill")).toBe("train");
    expect(subOf("/game/bet")).toBe("train");
    expect(subOf("/exam/run")).toBe("exam");
    expect(subOf("/code/excel")).toBe("code");
    expect(subOf("/history")).toBe("history");
    expect(subOf("/notes/1")).toBe("notes");
    expect(subOf("/theory")).toBe("theory");
    expect(subOf("/search")).toBe("search");
    expect(subOf("/profile")).toBe("profile");
  });
  it("у хаба «Материалы» и групп без подразделов активного подраздела нет", () => {
    expect(subOf("/materials")).toBeNull();
    expect(subOf("/learn")).toBeNull();
    expect(subOf("/tutor")).toBeNull();
    expect(subOf("/")).toBeNull();
  });
});

describe("hubGroup (где показывать SectionTabs)", () => {
  it.each(["/practice", "/exam", "/code", "/history", "/notes", "/theory", "/search", "/materials", "/stats", "/shop", "/profile", "/shop/"])(
    "%s — показывать",
    (p) => expect(hubGroup(p)).not.toBeNull(),
  );
  it.each(["/learn", "/tutor", "/exam/run", "/exam/result/1", "/code/python", "/code/excel/xl-1-sum", "/history/abc", "/notes/abc", "/theory/py-1-vars", "/drill", "/"])(
    "%s — не показывать",
    (p) => expect(hubGroup(p)).toBeNull(),
  );
  it("группа хаба совпадает с groupOf", () => {
    for (const p of ["/practice", "/notes", "/stats"]) expect(hubGroup(p)?.id).toBe(groupOf(p));
  });
});

describe("конфигурация", () => {
  it("пять групп в нужном порядке", () => {
    expect(NAV_GROUPS.map((g) => g.id)).toEqual(["learn", "practice", "tutor", "materials", "progress"]);
  });
  it("подразделы в нужном порядке", () => {
    const ids = (g: string) => NAV_GROUPS.find((x) => x.id === g)!.subs.map((s) => s.id);
    expect(ids("practice")).toEqual(["train", "exam", "code", "history"]);
    expect(ids("materials")).toEqual(["notes", "theory", "cheat", "search"]);
    expect(ids("progress")).toEqual(["stats", "shop", "plans", "profile"]);
  });
  it("все подписи есть в словаре на двух языках", () => {
    for (const g of NAV_GROUPS) {
      for (const key of [g.label, ...g.subs.map((s) => s.label)]) {
        expect(dict[key].ru, key).toBeTruthy();
        expect(dict[key].kk, key).toBeTruthy();
      }
    }
  });
  it("у каждого подраздела есть ссылка или действие", () => {
    for (const s of NAV_GROUPS.flatMap((g) => g.subs)) expect(Boolean(s.href) || Boolean(s.action), s.id).toBe(true);
  });
  it("подраздел принадлежит группе по своим путям", () => {
    for (const g of NAV_GROUPS) for (const s of g.subs) if (s.href) expect(groupOf(s.href), s.id).toBe(g.id);
  });
});

describe("пути", () => {
  it("normalizePath / underPath", () => {
    expect(normalizePath("/a/b/")).toBe("/a/b");
    expect(normalizePath("/")).toBe("/");
    expect(underPath("/exam/run", "/exam")).toBe(true);
    expect(underPath("/examples", "/exam")).toBe(false);
  });
});
