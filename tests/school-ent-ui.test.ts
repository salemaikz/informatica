// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement, act, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useApp } from "@/lib/store";
import { QuickActions } from "@/components/learn/QuickActions";
import { EntOnly } from "@/components/school/EntOnly";
import { WeekCard } from "@/components/goals/GoalsPanel";
import { HistoryScreen } from "@/components/history/HistoryScreen";
import StatsPage from "@/app/(main)/stats/page";
import { ENT_ONLY_PATHS } from "@/lib/school";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Школьный трек без ЕНТ-элементов (#52): быстрые действия и стража разделов /exam и /plan отрисовываем в DOM.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

async function render(node: ReactNode) {
  await act(async () => {
    root.render(node);
  });
}

const hrefs = () => [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"));
const setTrack = (track: "ent" | "school") => act(() => useApp.getState().updateProfile({ track }));

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useApp.getState().updateProfile({ track: "ent" });
});

describe("быстрые действия", () => {
  it("трек ЕНТ — есть «Тест ЕНТ» (/exam)", async () => {
    await setTrack("ent");
    await render(createElement(QuickActions, { dueCount: 0 }));
    expect(hrefs()).toContain("/exam");
  });

  it("школьный трек — нет ссылки на /exam, остальные действия на месте", async () => {
    await setTrack("school");
    await render(createElement(QuickActions, { dueCount: 0 }));
    expect(hrefs()).not.toContain("/exam");
    expect(hrefs()).toEqual(expect.arrayContaining(["/theory", "/code", "/search"]));
  });
});

describe("EntOnly — страж разделов /exam и /plan", () => {
  const page = () => createElement("div", { "data-testid": "page" }, "СТРАНИЦА РАЗДЕЛА");

  it("трек ЕНТ — страница как есть", async () => {
    await setTrack("ent");
    await render(createElement(EntOnly, null, page()));
    expect(host.textContent).toContain("СТРАНИЦА РАЗДЕЛА");
  });

  it("школьный трек — карточка вместо страницы, с двумя выходами", async () => {
    await setTrack("school");
    await render(createElement(EntOnly, null, page()));
    expect(host.textContent).not.toContain("СТРАНИЦА РАЗДЕЛА");
    expect(host.textContent).toContain("Этот раздел — для подготовки к ЕНТ");
    expect(host.textContent).toContain("Переключиться на ЕНТ");
    expect(hrefs()).toContain("/learn");
    expect(host.textContent).toContain("К школьной программе");
  });

  it("«Переключиться на ЕНТ» меняет трек действием стора и тут же открывает страницу", async () => {
    await setTrack("school");
    await render(createElement(EntOnly, null, page()));
    const btn = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Переключиться на ЕНТ"));
    expect(btn).toBeTruthy();
    await act(async () => btn!.click());
    expect(useApp.getState().profile.track).toBe("ent");
    expect(host.textContent).toContain("СТРАНИЦА РАЗДЕЛА");
  });
});

describe("EntOnly — /exam/run вне оболочки приложения", () => {
  // children в типе обязателен, а линтер не даёт передавать их пропсом — сужаем тип для createElement
  const Fullscreen = EntOnly as ComponentType<{ fullscreen: boolean; children?: ReactNode }>;
  const page = () => createElement("div", null, "ПРОХОЖДЕНИЕ");

  it("школьный трек — та же карточка в спокойном каркасе, прохождения нет", async () => {
    await setTrack("school");
    await render(createElement(Fullscreen, { fullscreen: true }, page()));
    expect(host.textContent).not.toContain("ПРОХОЖДЕНИЕ");
    expect(host.textContent).toContain("Этот раздел — для подготовки к ЕНТ");
    expect(host.textContent).toContain("Переключиться на ЕНТ");
    expect(hrefs()).toContain("/learn");
    expect(host.querySelector(".min-h-dvh")).toBeTruthy();
  });

  it("трек ЕНТ — прохождение как есть", async () => {
    await setTrack("ent");
    await render(createElement(Fullscreen, { fullscreen: true }, page()));
    expect(host.textContent).toContain("ПРОХОЖДЕНИЕ");
    expect(host.textContent).not.toContain("Этот раздел");
  });

  it("на странице каждого ЕНТ-пути из lib/school стоит страж EntOnly (в т.ч. /exam/run)", () => {
    for (const path of ENT_ONLY_PATHS) {
      const file = [join("src/app/(main)", path, "page.tsx"), join("src/app", path, "page.tsx")].find((f) => existsSync(f));
      expect(file, `нет страницы для ${path}`).toBeTruthy();
      expect(readFileSync(file!, "utf8"), path).toContain("<EntOnly");
    }
  });
});

describe("«Прогресс»: неделя нужна всем, остальное — только ЕНТ", () => {
  it("WeekCard — «Неделя» с уроками и ссылкой на цель в профиле, без слов про ЕНТ", async () => {
    await setTrack("school");
    await render(createElement(WeekCard, { showEdit: true }));
    expect(host.textContent).toContain("Неделя");
    expect(host.textContent).toMatch(/из \d+ уроков/);
    expect(host.textContent).not.toMatch(/ЕНТ|ҰБТ|Прогноз/);
    expect(hrefs()).toContain("/profile#goals");
  });

  it("школьный трек: на странице есть «Неделя», нет прогноза, отсчёта до ЕНТ, плана и пробников", async () => {
    await setTrack("school");
    await render(createElement(StatsPage));
    const text = host.textContent ?? "";
    expect(text).toContain("Неделя");
    expect(text).not.toMatch(/до ЕНТ|Прогноз|План недели|Пробные ЕНТ|Цель по баллу/i);
    expect(hrefs()).not.toContain("/exam");
  });

  it("трек ЕНТ: «Неделя» и ЕНТ-блоки (прогноз, план недели, история пробников) на месте", async () => {
    await setTrack("ent");
    await render(createElement(StatsPage));
    const text = host.textContent ?? "";
    expect(text).toContain("Неделя");
    expect(text).toMatch(/Прогноз/);
    expect(hrefs()).toContain("/exam");
  });
});

describe("История у школьника: без пробного ЕНТ", () => {
  const hasChip = (label: string) => [...host.querySelectorAll("button")].some((b) => b.textContent?.startsWith(label));
  const exam = { id: "x1", at: Date.now(), kind: "exam" as const, title: "", correct: 3, total: 5, durationSec: 60, xp: 0, wrong: [], fixed: [] };
  const lesson = { ...exam, id: "l1", kind: "lesson" as const, title: "Двоичная система" };
  const setHistory = (history: (typeof exam | typeof lesson)[]) => act(() => useApp.setState({ history }));

  afterEach(async () => {
    await act(async () => useApp.setState({ history: [] }));
  });

  it("школьный трек без пробников: нет фильтра «Пробный ЕНТ», подпись нейтральная", async () => {
    await setTrack("school");
    await setHistory([lesson]);
    await render(createElement(HistoryScreen));
    expect(hasChip("Уроки")).toBe(true);
    expect(hasChip("Пробный ЕНТ")).toBe(false);
    expect(host.textContent).not.toMatch(/ЕНТ/);
  });

  it("школьный трек со старыми пробниками: фильтр остаётся, чтобы их найти", async () => {
    await setTrack("school");
    await setHistory([lesson, exam]);
    await render(createElement(HistoryScreen));
    expect(hasChip("Пробный ЕНТ")).toBe(true);
  });

  it("трек ЕНТ: фильтр «Пробный ЕНТ» есть", async () => {
    await setTrack("ent");
    await setHistory([lesson]);
    await render(createElement(HistoryScreen));
    expect(hasChip("Пробный ЕНТ")).toBe(true);
  });

  it("пустая история школьника: текст без пробного ЕНТ и без кнопки /exam", async () => {
    await setTrack("school");
    await render(createElement(HistoryScreen));
    expect(host.textContent).not.toMatch(/ЕНТ/);
    expect(hrefs()).not.toContain("/exam");
    expect(hrefs()).toContain("/learn");
  });
});
