import { expect, test, type Page } from "@playwright/test";

// v0.6: магазин, окно тарифов и пробный период, история тестов с работой над ошибками, школьная карта.

async function seed(page: Page, extra: Record<string, unknown> = {}) {
  await page.goto("/onboarding");
  await page.evaluate(
    (more) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "dark", sound: false, createdAt: 1 },
            lessons: { "ns-1-bits": { completions: 1, bestAccuracy: 1, lastAt: 1, totalXp: 100 } },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            ...more,
          },
          version: 2,
        }),
      ),
    extra,
  );
}

test("магазин: покупка бустера за чипы, окно тарифов и пробный период", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await page.goto("/shop");
  await expect(page.getByRole("heading", { name: "Магазин" })).toBeVisible();
  // Новичку — 100 чипов.
  await expect(page.getByLabel("Чипы: 100. Открыть магазин").first()).toBeVisible();
  await page.getByRole("button", { name: /^Купить: .*15/ }).first().click();
  await expect(page.getByLabel("Чипы: 40. Открыть магазин").first()).toBeVisible();

  // Покупка за деньги — честное «Оплата скоро».
  await page.goto("/plans?from=shop");
  await expect(page.getByText("Учись без ограничений")).toBeVisible();
  await page.getByRole("button", { name: /Выбрать/ }).first().click();
  await expect(page.getByText("Оплата скоро появится")).toBeVisible();
  await page.getByRole("button", { name: "Понятно" }).click();

  // Пробный период: «Безлимит» на 7 дней, сердечки без ограничений.
  await page.getByRole("button", { name: /Попробовать «Безлимит»/ }).first().click();
  await page.getByRole("button", { name: "Начать" }).click();
  await page.waitForURL("**/learn");
  await expect(page.getByLabel("Сердечки без ограничений. Открыть магазин").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("история тестов: ошибка из урока исправляется работой над ошибками этого теста", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page, {
    history: [
      {
        id: "h1",
        at: 1790000000000,
        kind: "check",
        title: "Проверка",
        lessonId: "ns-1-bits",
        correct: 2,
        total: 3,
        durationSec: 60,
        xp: 20,
        wrong: [{ stepId: "missing-step", skill: "ns.bin2dec", prompt: "Сколько будет 101₂?", given: "6", expected: "5" }],
        fixed: [],
      },
    ],
  });
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "История тестов" })).toBeVisible();
  await page.getByText("Проверка").first().click();
  await page.waitForURL("**/history/h1");
  await expect(page.getByText("Сколько будет 101₂?")).toBeVisible();
  await page.getByRole("link", { name: /Исправить ошибки этого теста/ }).click();
  await page.waitForURL("**/drill?mode=history**");
  // Исходного шага нет — подставлено свежее задание банка на тот же навык.
  await expect(page.locator("footer button").last()).toBeVisible();
  expect(errors).toEqual([]);
});

test("школьная программа: переключатель трека и карта класса", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await page.goto("/learn");
  await page.getByRole("group", { name: "Режим обучения" }).getByRole("button", { name: "Школа" }).click();
  // Профиль — 11 класс: показывается программа 11 класса.
  await expect(page.getByText("Программа 11 класса")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
