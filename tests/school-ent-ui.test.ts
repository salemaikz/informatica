// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, act, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useApp } from "@/lib/store";
import { QuickActions } from "@/components/learn/QuickActions";
import { EntOnly } from "@/components/school/EntOnly";
import { SchoolMap } from "@/components/school/SchoolMap";
import { WeekCard } from "@/components/goals/GoalsPanel";
import { HistoryScreen } from "@/components/history/HistoryScreen";
import StatsPage from "@/app/(main)/stats/page";
import LearnPage from "@/app/(main)/learn/page";
import { UNITS } from "@/content/course";
import { ENT_TOPICS } from "@/content/ent-topics";
import { schoolPlan } from "@/content/school-program";
import { ENT_ONLY_PATHS, SCHOOL_GRADES, gradeProgress } from "@/lib/school";
import type { Grade, SessionResult } from "@/lib/types";
import { translate } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Страница «Учиться» зовёт useRouter (контрольная раздела) — в тесте приложения-роутера нет.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} }),
  usePathname: () => "/learn",
  useSearchParams: () => new URLSearchParams(),
}));

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

describe("«Учиться»: переключатель режима и общий прогресс школы и ЕНТ (v0.9.1)", () => {
  const BITS = "ns-1-bits";
  const VIEW_KEY = "informatica-learn-view";
  const ru = (key: DictKey, params?: Record<string, string | number>) => translate("ru", key, params);
  const group = (label: DictKey) => host.querySelector<HTMLElement>(`[role="group"][aria-label="${ru(label)}"]`);
  const switchGroup = () => group("school.track.label");
  const clickTrack = async (label: string) => {
    const btn = [...switchGroup()!.querySelectorAll("button")].find((b) => b.textContent === label);
    expect(btn, label).toBeTruthy();
    await act(async () => btn!.click());
  };
  const profile = (track: "ent" | "school", grade: Grade) => act(() => useApp.getState().updateProfile({ track, grade }));
  const session = (lessonId: string): SessionResult => ({
    kind: "lesson",
    lessonId,
    title: "t",
    answers: [{ stepId: "q1", skill: "ns.base", correct: true, score: 1, given: "1", expected: "1", prompt: "?", retry: false, timeMs: 1000 }],
    xp: 10,
    maxCombo: 1,
    durationSec: 60,
    accuracy: 1,
  });
  /** Подпись узла урока на «Пути» («Урок 1: …, пройден»). */
  const nodeLabel = (id: string) => {
    const title = UNITS.flatMap((u) => u.lessons).find((r) => r.id === id)!.title.ru;
    return [...host.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")!).find((a) => a.includes(title));
  };
  const lessonsLine = (done: number, grade: Grade) => ru("school.progress.lessons", { done, total: gradeProgress(schoolPlan(grade as never)!, {}).lessonsTotal });

  beforeEach(() => {
    useApp.getState().resetProgress();
    localStorage.removeItem(VIEW_KEY);
  });
  afterEach(() => {
    useApp.getState().resetProgress();
    localStorage.removeItem(VIEW_KEY);
  });

  it("переключатель «ЕНТ / Школа» — первый элемент страницы в обоих режимах; нажатая кнопка показывает режим; кнопки ≥ 44 px", async () => {
    for (const [track, label] of [["ent", "ЕНТ"], ["school", "Школа"]] as const) {
      await profile(track, "6");
      await render(createElement(LearnPage));
      const g = switchGroup();
      expect(g, track).toBeTruthy();
      expect(host.firstElementChild?.firstElementChild, track).toBe(g);
      expect([...g!.querySelectorAll("button")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent), track).toEqual([label]);
      for (const b of g!.querySelectorAll("button")) expect(b.className).toContain("h-11");
    }
  });

  it("одним нажатием и без перезагрузки: элементы режима появляются и исчезают сразу, переключатель остаётся тем же узлом", async () => {
    await profile("ent", "6");
    await render(createElement(LearnPage));
    const g = switchGroup();
    // режим ЕНТ: пробный ЕНТ, «Путь / Карта ЕНТ», нет выбора класса
    expect(hrefs()).toContain("/exam");
    expect(group("learn2.view.label")).toBeTruthy();
    expect(group("school.grade.label")).toBeNull();

    await clickTrack("Школа");
    expect(useApp.getState().profile.track).toBe("school");
    expect(switchGroup()).toBe(g);
    expect(hrefs()).not.toContain("/exam");
    expect(group("learn2.view.label")).toBeNull();
    expect(group("school.grade.label")).toBeTruthy();
    expect(host.textContent).toContain(ru("school.progress.shared"));

    await clickTrack("ЕНТ");
    expect(useApp.getState().profile.track).toBe("ent");
    expect(switchGroup()).toBe(g);
    expect(hrefs()).toContain("/exam");
    expect(group("learn2.view.label")).toBeTruthy();
    expect(group("school.grade.label")).toBeNull();
    expect(host.textContent).not.toContain(ru("school.progress.shared"));
  });

  it("урок про биты, пройденный в школьном режиме, отмечен пройденным на «Пути» ЕНТ", async () => {
    await profile("school", "5");
    await render(createElement(LearnPage));
    expect(host.textContent).toContain(lessonsLine(0, "5"));

    await act(async () => {
      useApp.getState().finishSession(session(BITS));
    });
    expect(host.textContent).toContain(lessonsLine(1, "5"));

    await clickTrack("ЕНТ");
    const label = nodeLabel(BITS);
    expect(label, "узел урока на «Пути»").toBeTruthy();
    expect(label).toContain(`, ${ru("learn2.state.done")}`);
  });

  it("урок, пройденный в режиме ЕНТ, отмечен в школьной программе (и в 5, и в 10 классе)", async () => {
    await profile("ent", "5");
    await render(createElement(LearnPage));
    expect(nodeLabel(BITS)).not.toContain(`, ${ru("learn2.state.done")}`);

    await act(async () => {
      useApp.getState().finishSession(session(BITS));
    });
    expect(nodeLabel(BITS)).toContain(`, ${ru("learn2.state.done")}`);

    await clickTrack("Школа");
    expect(host.textContent).toContain(lessonsLine(1, "5"));
    await profile("school", "10");
    expect(host.textContent).toContain(lessonsLine(1, "10"));
  });

  it("«Карта ЕНТ»: ответы, данные в школьном режиме, окрашивают тему «Системы счисления»", async () => {
    localStorage.setItem(VIEW_KEY, "ent");
    await profile("school", "5");
    await render(createElement(LearnPage));
    await act(async () => {
      useApp.getState().recordAnswer(session(BITS).answers[0], 5, BITS);
    });
    await clickTrack("ЕНТ");
    const title = ENT_TOPICS.find((x) => x.id === "t04")!.title.ru;
    const tile = [...host.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")!).find((a) => a.startsWith(`Тема ЕНТ: ${title}`));
    expect(tile, "плитка темы t04").toBeTruthy();
    expect(tile).not.toBe(ru("learn2.ent.open.none", { title }));
    expect(tile).toContain("освоение");
  });
});

describe("Школьная карта: строка про общий прогресс", () => {
  beforeEach(() => useApp.getState().resetProgress());
  afterEach(() => useApp.getState().resetProgress());

  it("для каждого класса 5–11 — под всеми разделами программы, на обоих языках", async () => {
    for (const grade of SCHOOL_GRADES) {
      await act(async () => useApp.getState().updateProfile({ track: "school", grade }));
      await render(createElement(SchoolMap));
      const line = [...host.querySelectorAll("p")].find((p) => p.textContent?.includes(translate("ru", "school.progress.shared")));
      expect(line, grade).toBeTruthy();
      const sections = [...host.querySelectorAll("section")];
      expect(sections.length, grade).toBeGreaterThan(1);
      for (const s of sections) expect(s.compareDocumentPosition(line!) & Node.DOCUMENT_POSITION_FOLLOWING, grade).toBeTruthy();
    }
    await act(async () => useApp.getState().updateProfile({ lang: "kk" }));
    expect(host.textContent).toContain(translate("kk", "school.progress.shared"));
  });

  it("класс не выбран («другое») — карты нет, строки тоже нет", async () => {
    await act(async () => useApp.getState().updateProfile({ track: "school", grade: "other" }));
    await render(createElement(SchoolMap));
    expect(host.textContent).not.toContain(translate("ru", "school.progress.shared"));
  });
});
