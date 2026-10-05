// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { UNITS, getLesson } from "@/content/course";
import { ENT_TOPICS } from "@/content/ent-topics";
import { dict, type DictKey } from "@/i18n/dict";
import StatsPage from "@/app/(main)/stats/page";
import { CourseProgressBadge, CourseProgressCard } from "@/components/progress/CourseProgressCard";
import { SkillsMasteryCard, needsText } from "@/components/progress/SkillsMasteryCard";
import { TopicTable } from "@/components/progress/TopicTable";
import { UnitProgressList } from "@/components/progress/UnitProgressList";
import { WeakSpotsCard } from "@/components/progress/WeakSpotsCard";
import { formatDate, formatDuration, percent, sparkGeometry, toneOfRatio } from "@/components/progress/format";
import type { SkillStat } from "@/lib/mastery";
import { useApp, type AppState, type DayStat } from "@/lib/store";
import { todayKey } from "@/lib/text";

// Экраны прогресса (#71) отрисовываем в DOM: шкала курса, разделы, темы, слабые места, статистика.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

const DAY = 86_400_000;
const dayKey = (ago: number) => todayKey(new Date(Date.now() - ago * DAY));
const stat = (mastery: number, extra: Partial<SkillStat> = {}): SkillStat => ({ attempts: 5, correct: 3, mastery, lastSeen: Date.now(), ...extra });
const dayStat = (over: Partial<DayStat> = {}): DayStat => ({ xp: 0, answers: 0, correct: 0, seconds: 0, ...over });
const tRu = (key: DictKey, params?: Record<string, string | number>) => dict[key].ru.replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k] ?? `{${k}}`));

async function render(node: ReactNode) {
  await act(async () => {
    root.render(node);
  });
}
const text = () => host.textContent ?? "";
const hrefs = () => [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"));
const patch = (p: Partial<AppState>) => act(() => useApp.setState(p));
const setProfile = (p: Partial<ReturnType<typeof useApp.getState>["profile"]>) => act(() => useApp.getState().updateProfile(p));

const allReady = () => UNITS.flatMap((u) => u.lessons).filter((r) => r.status === "available" && getLesson(r.id));

beforeEach(() => {
  useApp.getState().resetProgress();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useApp.getState().resetProgress();
});

describe("помощники format", () => {
  it("percent: зажат в 0..100, мусор — 0", () => {
    expect(percent(0.456)).toBe(46);
    expect(percent(2)).toBe(100);
    expect(percent(-1)).toBe(0);
    expect(percent(NaN)).toBe(0);
  });

  it("цвет по доле: зелёный от 80%, янтарный 50–79%, красный ниже 50%", () => {
    expect(toneOfRatio(0.8)).toBe("success");
    expect(toneOfRatio(0.79)).toBe("warning");
    expect(toneOfRatio(0.5)).toBe("warning");
    expect(toneOfRatio(0.49)).toBe("danger");
    expect(toneOfRatio(NaN)).toBe("danger");
  });

  it("время: 0, меньше минуты, минуты, часы", () => {
    expect(formatDuration(0, tRu)).toBe("0 мин");
    expect(formatDuration(40, tRu)).toBe("<1 мин");
    expect(formatDuration(25 * 60, tRu)).toBe("25 мин");
    expect(formatDuration(2 * 3600 + 5 * 60, tRu)).toBe("2 ч 5 мин");
    expect(formatDuration(3599, tRu)).toBe("1 ч 0 мин");
    expect(formatDuration(NaN, tRu)).toBe("0 мин");
  });

  it("дата без падежей: ДД.ММ.ГГГГ; мусор — пусто", () => {
    expect(formatDate("2026-10-05")).toBe("05.10.2026");
    expect(formatDate("вчера")).toBe("");
  });

  it("мини-график: ломаная через дни с данными, одна точка — кружок, пусто — ничего", () => {
    expect(sparkGeometry([], 72, 24)).toEqual({ d: "", dots: [], count: 0 });
    expect(sparkGeometry([{ acc: null }, { acc: null }], 72, 24)).toEqual({ d: "", dots: [], count: 0 });
    const one = sparkGeometry([{ acc: null }, { acc: 0.5 }, { acc: null }], 72, 24);
    expect(one.d).toBe("");
    expect(one.dots).toHaveLength(1);
    const g = sparkGeometry([{ acc: 1 }, { acc: null }, { acc: 0 }], 72, 24, 2);
    expect(g.count).toBe(2);
    expect(g.d).toBe("M2 2L70 22"); // 100% — сверху, 0% — снизу, пропущенный день не ломает линию
  });
});

describe("CourseProgressCard и CourseProgressBadge", () => {
  it("ЕНТ: 0% в начале, «N из M уроков» только по готовым, подсказка про первый урок", async () => {
    await render(createElement(CourseProgressCard));
    const ready = allReady().length;
    expect(text()).toContain("Пройдено 0% курса");
    expect(text()).toContain(`0 из ${ready} уроков`);
    expect(text()).toContain("Пройди первый урок");
  });

  it("ЕНТ: пройдено столько-то готовых уроков — процент и «Курс пройден» на 100%", async () => {
    const some = Object.fromEntries(allReady().slice(0, 3).map((r) => [r.id, { completions: 1, lastAt: 1, best: 1, dueAt: 1 }]));
    await patch({ lessons: some as never });
    await render(createElement(CourseProgressCard));
    const ready = allReady().length;
    expect(text()).toContain(`Пройдено ${Math.round((3 / ready) * 100)}% курса`);
    expect(text()).toContain(`3 из ${ready} уроков`);
    expect(text()).not.toContain("Пройди первый урок");

    const all = Object.fromEntries(allReady().map((r) => [r.id, { completions: 1, lastAt: 1, best: 1, dueAt: 1 }]));
    await patch({ lessons: all as never });
    expect(text()).toContain("Курс пройден");
    expect(text()).toContain("100%");
  });

  it("skipBasics: раздел «Старт» не входит в счёт, под шкалой — пояснение", async () => {
    await setProfile({ skipBasics: true });
    await render(createElement(CourseProgressCard));
    const readyNoBasics = allReady().length - UNITS.find((u) => u.id === "u0")!.lessons.filter((r) => r.status === "available").length;
    expect(text()).toContain(`0 из ${readyNoBasics} уроков`);
    expect(text()).toContain("Раздел «Старт» скрыт");
  });

  it("школьный трек: процент класса, а не курса", async () => {
    await setProfile({ track: "school", grade: "7" });
    await render(createElement(CourseProgressCard));
    expect(text()).toMatch(/Пройдено \d+% программы 7 класса/);
    expect(text()).not.toContain("курса");
    expect(text()).not.toMatch(/ЕНТ/);
  });

  it("школьный трек без выбранного класса — как курс", async () => {
    await setProfile({ track: "school", grade: "other" });
    await render(createElement(CourseProgressCard));
    expect(text()).toContain("курса");
  });

  it("компактный вариант: одна ссылка на «Прогресс» с процентом, ссылку можно поменять", async () => {
    await render(createElement(CourseProgressBadge));
    expect(hrefs()).toEqual(["/stats"]);
    expect(text()).toMatch(/Курс: 0% · 0 из \d+/);
    await render(createElement(CourseProgressBadge, { href: "/learn" }));
    expect(hrefs()).toEqual(["/learn"]);
    await setProfile({ track: "school", grade: "9" });
    expect(text()).toMatch(/Класс: \d+%/);
  });
});

describe("UnitProgressList", () => {
  it("ЕНТ: строка на каждый раздел курса с «пройдено/готово»", async () => {
    await render(createElement(UnitProgressList));
    for (const u of UNITS) expect(text()).toContain(u.title.ru);
    expect(host.querySelectorAll("li")).toHaveLength(UNITS.length);
    expect(text()).toMatch(/0\/\d+/);
  });

  it("skipBasics убирает раздел «Старт»", async () => {
    await setProfile({ skipBasics: true });
    await render(createElement(UnitProgressList));
    expect(text()).not.toContain("Старт: компьютер с нуля");
    expect(host.querySelectorAll("li")).toHaveLength(UNITS.length - 1);
  });

  it("школьный трек: разделы программы класса, не ЕНТ-курс", async () => {
    await setProfile({ track: "school", grade: "7" });
    await render(createElement(UnitProgressList));
    expect(text()).toContain("Разделы программы");
    expect(text()).not.toContain("Как решать ЕНТ");
  });
});

describe("TopicTable", () => {
  it("13 тем, у каждой мини-график с role=img и подписью; без данных — «—»", async () => {
    await render(createElement(TopicTable));
    expect(host.querySelectorAll("li")).toHaveLength(13);
    const charts = [...host.querySelectorAll('svg[role="img"]')];
    expect(charts).toHaveLength(13);
    for (const c of charts) expect(c.getAttribute("aria-label")).toBeTruthy();
    for (const tp of ENT_TOPICS) expect(text()).toContain(tp.short.ru);
    expect(text()).toContain("Данных пока нет");
  });

  it("школьный трек: таблицы тем ЕНТ нет", async () => {
    await setProfile({ track: "school", grade: "7" });
    await render(createElement(TopicTable));
    expect(text()).toBe("");
  });

  it("точность и время за период; для диктора — скрытая таблица по дням; подпись «Данные с …»", async () => {
    await patch({
      skillDays: { [dayKey(1)]: { "ns.bin2dec": { n: 4, s: 3, sec: 240 } } },
      skills: { "ns.bin2dec": stat(0.5) },
    });
    await render(createElement(TopicTable));
    const row = [...host.querySelectorAll("li")].find((li) => li.textContent?.includes("Счисление"))!;
    expect(row.textContent).toContain("75%");
    expect(row.textContent).toContain("4 · 4 мин");
    expect(row.querySelector(".sr-only table")).toBeTruthy();
    expect(row.querySelectorAll(".sr-only tbody tr")).toHaveLength(1);
    expect(text()).toContain(`Данные с ${formatDate(dayKey(1))}`);
  });

  it("переключатель 7 / 30 дней: старые дни выпадают из 7-дневного окна", async () => {
    await patch({ skillDays: { [dayKey(10)]: { "ns.bin2dec": { n: 5, s: 5 } } } });
    await render(createElement(TopicTable));
    const row = () => [...host.querySelectorAll("li")].find((li) => li.textContent?.includes("Счисление"))!;
    expect(row().textContent).toContain("100%");
    const btn = [...host.querySelectorAll("button")].find((b) => b.textContent === "7 дней")!;
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    await act(async () => btn.click());
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(row().textContent).not.toContain("100%");
    expect(host.querySelectorAll('svg[role="img"]')).toHaveLength(13);
  });

  it("изменение «неделя к неделе» — со знаком и текстом для диктора", async () => {
    await patch({
      skillDays: {
        [dayKey(1)]: { "ns.bin2dec": { n: 10, s: 9 } },
        [dayKey(9)]: { "ns.bin2dec": { n: 10, s: 5 } },
      },
    });
    await render(createElement(TopicTable));
    const row = [...host.querySelectorAll("li")].find((li) => li.textContent?.includes("Счисление"))!;
    expect(row.textContent).toContain("+40");
    expect(row.textContent).toContain("Точность за последние 7 дней: 90%, неделей раньше: 50%");
  });
});

describe("WeakSpotsCard", () => {
  it("данных нет — спокойная подсказка, не «слабых мест нет»", async () => {
    await render(createElement(WeakSpotsCard));
    expect(text()).toContain("Мало данных — реши хотя бы 3 задания по теме");
    expect(text()).not.toContain("Слабых мест пока нет");
    expect(host.querySelector(".text-danger")).toBeNull();
  });

  it("ответов мало (2) — всё ещё «мало данных»", async () => {
    await patch({ skills: { "ns.bin2dec": stat(0.1, { attempts: 2 }) } });
    await render(createElement(WeakSpotsCard));
    expect(text()).toContain("Мало данных");
  });

  it("данные есть, всё хорошо — «Слабых мест пока нет»", async () => {
    await patch({ skills: { "ns.bin2dec": stat(0.9) } });
    await render(createElement(WeakSpotsCard));
    expect(text()).toContain("Слабых мест пока нет");
  });

  it("слабый навык: название, освоение, точность за 30 дней, причина и адресная кнопка", async () => {
    await patch({
      skills: { "ns.bin2dec": stat(0.3) },
      skillDays: { [dayKey(2)]: { "ns.bin2dec": { n: 4, s: 1 } } },
    });
    await render(createElement(WeakSpotsCard));
    expect(text()).toContain("Перевод 2 → 10");
    expect(text()).toContain("освоение 30%");
    expect(text()).toContain("точность за 30 дней 25%");
    expect(text()).toContain("Низкая оценка");
    expect(hrefs()).toContain("/drill?mode=skill&skill=ns.bin2dec");
    expect(text()).toContain("Потренировать");
  });

  it("не больше 5 строк", async () => {
    const ids = ["ns.base", "ns.bin2dec", "ns.dec2bin", "ns.props", "ns.octhex", "ns.anybase", "ns.arith"];
    await patch({ skills: Object.fromEntries(ids.map((id) => [id, stat(0.2)])) });
    await render(createElement(WeakSpotsCard));
    expect(host.querySelectorAll("li")).toHaveLength(5);
  });
});

describe("SkillsMasteryCard (правило «освоено», #67)", () => {
  it("высокая оценка без самостоятельных ответов в разные дни — «в процессе» и чего не хватает", async () => {
    await patch({ skills: { "ns.bin2dec": stat(0.9, { clean: 2, okDays: 1 }) } });
    await render(createElement(SkillsMasteryCard));
    expect(text()).toContain("В процессе");
    expect(text()).toContain("До «освоено»: ещё 2 верных ответа без подсказки, в другой день");
  });

  it("освоено: оценка, 4 самостоятельных ответа и 2 дня — «Освоено», без подсказки «до освоено»", async () => {
    await patch({ skills: { "ns.bin2dec": stat(0.9, { clean: 4, okDays: 2 }) } });
    await render(createElement(SkillsMasteryCard));
    expect(text()).toContain("Освоено");
    expect(text()).not.toContain("До «освоено»");
    expect(text()).toContain("освоено 1 · в процессе 0 · слабо 0");
  });

  it("навыки без ответов не показываются; пусто — «Пока нет данных»", async () => {
    await render(createElement(SkillsMasteryCard));
    expect(text()).toContain("Пока нет данных");
    expect(host.querySelectorAll("li")).toHaveLength(0);
  });

  it("needsText: склонение числа ответов и «в N разных днях»", () => {
    expect(needsText({ clean: 1, days: 0 }, tRu)).toBe("До «освоено»: ещё 1 верный ответ без подсказки");
    expect(needsText({ clean: 3, days: 0 }, tRu)).toBe("До «освоено»: ещё 3 верных ответа без подсказки");
    expect(needsText({ clean: 4, days: 2 }, tRu)).toBe("До «освоено»: ещё 4 верных ответа без подсказки, в 2 разных днях");
    expect(needsText({ clean: 11, days: 0 }, tRu)).toBe("До «освоено»: ещё 11 верных ответов без подсказки");
    expect(needsText({ clean: 0, days: 1 }, tRu)).toBe("До «освоено»: в другой день");
    expect(needsText({ clean: 0, days: 0 }, tRu)).toBe("");
  });
});

describe("страница «Прогресс»", () => {
  const order = (...needles: string[]) => needles.map((n) => text().indexOf(n));

  it("порядок блоков: шкала курса → слабые места → разделы → темы → числа", async () => {
    await render(createElement(StatsPage));
    const [course, weak, units, topics, tiles] = order("Пройдено 0% курса", "Слабые места", "Разделы курса", "Темы ЕНТ", "Время в учёбе");
    for (const i of [course, weak, units, topics, tiles]) expect(i).toBeGreaterThan(-1);
    expect(course).toBeLessThan(weak);
    expect(weak).toBeLessThan(units);
    expect(units).toBeLessThan(topics);
    expect(topics).toBeLessThan(tiles);
  });

  it("школьный трек: шкала класса, разделы программы, без тем ЕНТ", async () => {
    await setProfile({ track: "school", grade: "8" });
    await render(createElement(StatsPage));
    expect(text()).toMatch(/Пройдено \d+% программы 8 класса/);
    expect(text()).toContain("Разделы программы");
    expect(text()).not.toContain("Темы ЕНТ");
    expect(text()).not.toMatch(/до ЕНТ|Прогноз|План недели|Пробные ЕНТ|Цель по баллу/i);
  });

  it("новые дни: точность по баллам, «сам / с подсказкой / пропущено», активное время и игры отдельно", async () => {
    await patch({
      days: {
        [dayKey(0)]: dayStat({ asked: 10, score: 7, hinted: 2, skipped: 1, seconds: 1500, games: 20, gameCorrect: 15, gameSeconds: 600 }),
      },
    });
    await render(createElement(StatsPage));
    expect(text()).toContain("70%");
    expect(text()).toContain("сам: 7 · с подсказкой: 2 · пропущено: 1");
    expect(text()).not.toContain("приблизительно");
    expect(text()).toContain("25 мин");
    expect(text()).toContain("активное время");
    expect(text()).toContain("из них игры: 10 мин");
    expect(text()).toContain("действий: 20 · верных: 15");
  });

  it("только старые дни — «приблизительно: старые дни», без разбивки", async () => {
    await patch({ days: { [dayKey(40)]: dayStat({ answers: 10, correct: 8, seconds: 600 }) } });
    await render(createElement(StatsPage));
    expect(text()).toContain("80%");
    expect(text()).toContain("приблизительно: старые дни");
    expect(text()).not.toContain("с подсказкой:");
  });

  it("точности нет — «—», а не 0%", async () => {
    await render(createElement(StatsPage));
    expect(host.querySelector(".text-3xl")?.textContent).toBe("—");
  });
});
