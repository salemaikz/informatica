import { describe, expect, it } from "vitest";
import { NAV_GROUPS, groupOf, hubGroup, normalizePath, subOf, underPath, visibleGroups, visibleSubs } from "@/components/app/nav";
import { ENT_ONLY_PATHS } from "@/lib/school";
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
    // ИИ-чат — плавающий Бит, не вкладка: /tutor работает, но вне групп навигации (ни одна вкладка не подсвечена).
    ["/tutor", null],
    ["/tutor/chat/1", null],
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
  it("четыре группы в нужном порядке (без «ИИ-чата»)", () => {
    expect(NAV_GROUPS.map((g) => g.id)).toEqual(["learn", "practice", "materials", "progress"]);
  });
  it("в навигации нет ссылки на /tutor и фиолетовых групп", () => {
    for (const g of NAV_GROUPS) {
      expect(g.href).not.toMatch(/^\/tutor/);
      expect(g.match.some((m) => m.startsWith("/tutor"))).toBe(false);
      expect(g.ai).toBeFalsy();
    }
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

describe("школьный трек: ЕНТ-подразделы скрыты (#52)", () => {
  const ids = (g: { subs: { id: string }[] }) => g.subs.map((s) => s.id);
  const practice = NAV_GROUPS.find((g) => g.id === "practice")!;

  it("трек ЕНТ: меню как было", () => {
    expect(visibleGroups(true)).toBe(NAV_GROUPS);
    expect(ids({ subs: visibleSubs(practice) })).toEqual(["train", "exam", "code", "history"]);
    expect(hubGroup("/practice")).toBe(practice);
  });

  it("школьный трек: в «Практике» нет «Пробного ЕНТ», остальные подразделы на месте", () => {
    expect(ids({ subs: visibleSubs(practice, false) })).toEqual(["train", "code", "history"]);
    const groups = visibleGroups(false);
    expect(groups.map((g) => g.id)).toEqual(NAV_GROUPS.map((g) => g.id));
    expect(ids(groups.find((g) => g.id === "practice")!)).toEqual(["train", "code", "history"]);
    // остальные группы не тронуты
    for (const id of ["materials", "progress"] as const) expect(ids(groups.find((g) => g.id === id)!)).toEqual(ids(NAV_GROUPS.find((g) => g.id === id)!));
  });

  it("исходный NAV_GROUPS не меняется при фильтрации", () => {
    visibleGroups(false);
    hubGroup("/practice", false);
    expect(ids(practice)).toEqual(["train", "exam", "code", "history"]);
  });

  it("hubGroup для школьного трека отдаёт ту же группу без ЕНТ-подраздела; страница /exam остаётся «хабом»", () => {
    for (const p of ["/practice", "/exam", "/code", "/history"]) {
      const g = hubGroup(p, false);
      expect(g?.id, p).toBe("practice");
      expect(ids(g!), p).not.toContain("exam");
    }
    expect(hubGroup("/learn", false)).toBeNull();
    expect(hubGroup("/exam/run", false)).toBeNull();
  });

  it("помечены ent ровно подразделы с ЕНТ-путями (/exam, /plan) — согласовано с lib/school", () => {
    const flagged = NAV_GROUPS.flatMap((g) => g.subs).filter((s) => s.ent);
    expect(flagged.map((s) => s.id)).toEqual(["exam"]);
    for (const s of flagged) expect((ENT_ONLY_PATHS as readonly string[]).includes(s.href!), s.id).toBe(true);
    // и наоборот: подраздел с ЕНТ-путём не остался без пометки
    for (const s of NAV_GROUPS.flatMap((g) => g.subs)) if (s.href && (ENT_ONLY_PATHS as readonly string[]).includes(s.href)) expect(s.ent, s.id).toBe(true);
  });
});
