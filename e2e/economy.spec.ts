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
            // Проводник первого входа (#104) уже пройден — не закрывает экран.
            tips: { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1 },
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
  // Новичку дарят 20 чипов — на бустер (40) не хватает, поэтому кладём 100 в кошелёк.
  await seed(page, { wallet: { chips: 100, earned: 100, spent: 0 } });
  await page.goto("/shop");
  await expect(page.getByRole("heading", { name: "Магазин" })).toBeVisible();
  await expect(page.getByLabel("Чипы: 100. Открыть магазин").first()).toBeVisible();
  // Бустер ×2 на 15 минут стоит 40 чипов: 100 → 60.
  await page.getByRole("button", { name: /^Купить: .*15 мин/ }).first().click();
  await expect(page.getByLabel("Чипы: 60. Открыть магазин").first()).toBeVisible();

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

test("магазин: полный запас — цена за недостающие, правила «Как работают сердечки»", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Остался 1 из 5: не хватает 4 — «Полный запас (+4)» стоит 4 × 45 = 180 (сердечко — 60, три — 150).
  await seed(page, { wallet: { chips: 300, earned: 300, spent: 0 }, hearts: { count: 1, updatedAt: Date.now(), day: "2099-01-01" } });
  await page.goto("/shop");
  await expect(page.getByRole("heading", { name: "Магазин" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Купить: \+1 сердечко/ })).toContainText("60");
  await expect(page.getByRole("button", { name: /^Купить: \+3 сердечка/ })).toContainText("150");
  const refill = page.getByRole("button", { name: "Купить: Полный запас (+4)" });
  await expect(refill).toContainText("180");

  // Сердечко — плата за вход: цены из констант, бесплатное, восстановление по тарифам, возврат за тренировку.
  await expect(page.getByRole("heading", { name: "Как работают сердечки" })).toBeVisible();
  await expect(page.getByText("Сердечко — плата за вход, а не за ошибку.")).toBeVisible();
  // Цена 2 — большой урок и тест по разделу (экстерна больше нет, #96).
  await expect(page.getByRole("img", { name: "Цена входа в сердечках: 2" })).toHaveCount(2);
  await expect(page.getByRole("img", { name: "Цена входа в сердечках: 1" })).toHaveCount(4);
  await expect(page.getByText("Чат с Битом")).toBeVisible();
  await expect(page.getByText("запас 5, +1 за 6 ч")).toBeVisible();
  await expect(page.getByText("запас 10, +1 за 3 ч")).toBeVisible();
  await expect(page.getByText("Тренировка возвращает сердечко: от 6 заданий, верно от 70%, до 3 раз в день.")).toBeVisible();

  // Покупка полного запаса: 300 − 180 = 120 чипов, сердечек 5.
  await refill.click();
  await expect(page.getByLabel("Чипы: 120. Открыть магазин").first()).toBeVisible();
  await expect(page.getByLabel("Сердечки: 5. Открыть магазин").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("магазин: полный запас не продаётся, пока не хватает меньше четырёх", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Осталось 3 из 5: «Полный запас (+2)» невыгоден, тройка не помещается — берём по одному.
  await seed(page, { wallet: { chips: 300, earned: 300, spent: 0 }, hearts: { count: 3, updatedAt: Date.now(), day: "2099-01-01" } });
  await page.goto("/shop");
  await expect(page.getByRole("button", { name: "Купить: Полный запас (+2)" })).toBeDisabled();
  // Не хватает двух: тройка тоже не поместится — «Выгоднее по одному».
  await expect(page.getByText("Выгоднее по одному", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Купить: \+3 сердечка/ })).toBeDisabled();
  await expect(page.getByText("Столько не поместится — бери по одному")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Купить: \+1 сердечко/ })).toBeEnabled();
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
