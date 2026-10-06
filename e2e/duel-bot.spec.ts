import { expect, test, type Page } from "@playwright/test";
import { ALL_TIPS } from "./tour";

// Этап 16Д, Ф1: дуэль с Битом от «Практики» до истории. Бот всегда помечен «бот» (VS, матч, итоги, история),
// сердечко списывается ровно одно — в конце отсчёта. Верные ответы берём из того же набора (GET /api/duel/deck).

async function seed(page: Page) {
  await page.goto("/onboarding");
  await page.evaluate(
    (tips) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Аян", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "system", sound: false, createdAt: 1 },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            tips,
            hearts: { count: 5, updatedAt: 0, day: "" },
          },
          version: 1,
        }),
      ),
    ALL_TIPS,
  );
}

const savedHearts = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("informatica-v1") ?? "{}").state?.hearts?.count);

type Item = { i: number; shape: "choice" | "statement"; step?: { correct: number }; statement?: { value: boolean } };

test("дуэль с Битом: «Практика» → хаб → Блиц → итоги → история", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page);
  // Часы страницы подменены: минуту блица прокручиваем, а не ждём.
  await page.clock.install();
  await page.goto("/practice");
  // Карточка «Дуэли» на «Практике» (не пункт бокового меню).
  await page.getByRole("link", { name: /Соревнуйся с Битом/ }).click();
  await page.waitForURL(/\/duel$/);
  await expect(page.getByRole("heading", { name: "Дуэли", level: 1 })).toBeVisible();
  await expect(page.getByTestId("duel-recent")).toContainText("Здесь появятся твои дуэли");
  expect(await savedHearts(page)).toBe(5);

  await page.locator('[data-tour="duel-bot"]').click();
  await page.waitForURL(/\/duel\/play\?mode=blitz&seed=\d+$/);
  const seedParam = new URL(page.url()).searchParams.get("seed");

  // VS: чип «бот», сердечко ещё не списано
  const vs = page.getByTestId("duel-vs");
  await expect(vs).toBeVisible();
  await expect(vs.getByTestId("bot-chip")).toHaveText("бот");
  expect(await savedHearts(page)).toBe(5);

  // Конец отсчёта — матч; в матче Бит тоже с чипом «бот»
  await page.clock.runFor(5_000);
  await expect(page.getByTestId("duel-item")).toBeVisible();
  await expect(page.getByTestId("duel-opp").getByTestId("bot-chip")).toBeVisible();
  await expect.poll(() => savedHearts(page)).toBe(4);

  // Ученик нового профиля — уровень 1, полоса 1: тот же набор, что видит экран.
  const res = await page.request.get(`/api/duel/deck?mode=blitz&band=1&seed=${seedParam}`);
  expect(res.ok()).toBe(true);
  const deck = (await res.json()) as { items: Item[] };
  for (let k = 0; k < 4; k++) {
    const card = page.getByTestId("duel-item");
    await expect(card).toHaveAttribute("data-item", String(k));
    const it = deck.items[k];
    if (it.shape === "statement") await page.locator(`[data-answer="${it.statement!.value}"]`).click();
    else await page.locator(`[data-option="${it.step!.correct}"]`).click();
    await page.clock.runFor(300);
  }
  await expect(page.getByTestId("duel-you-score")).toHaveText("8");

  // Минута блица прошла — итоги
  await page.clock.runFor(61_000);
  const result = page.getByTestId("duel-result");
  await expect(result).toBeVisible();
  await expect(result.getByTestId("bot-chip")).toBeVisible();
  await expect(page.getByTestId("duel-final-score")).toContainText(/^8 : -?\d+$/);
  await expect(page.getByTestId("duel-xp")).toHaveText(/^\+\d+$/);
  // Сердечко — ровно одно за матч
  expect(await savedHearts(page)).toBe(4);

  await page.getByRole("button", { name: "К дуэлям" }).click();
  await page.waitForURL(/\/duel$/);
  const recent = page.getByTestId("duel-recent");
  await expect(recent).toContainText("Блиц");
  await expect(recent).toContainText("Бит");
  await expect(recent.getByTestId("bot-chip")).toBeVisible();
  await expect(recent).toContainText(/8 : -?\d+/);
  expect(await savedHearts(page)).toBe(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
