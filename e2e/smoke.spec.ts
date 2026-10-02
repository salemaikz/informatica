import { expect, test } from "@playwright/test";

// Дымовой тест без обращений к ИИ: онбординг → главная → начало урока → тренировка.

test("онбординг и первые шаги урока", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await page.waitForURL("**/onboarding");
  await page.getByText("Русский").click();
  // «Сначала задание»: три мини-задания (лампочки → 1011₂ → что больше) до анкеты
  await page.getByRole("button", { name: "Лампочка 4: выключена" }).click();
  await page.getByRole("button", { name: "Лампочка 1: выключена" }).click();
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText("+10 XP")).toBeVisible();
  await page.getByRole("button", { name: "Дальше" }).click();
  await page.getByRole("button", { name: "11", exact: true }).click();
  await page.getByRole("button", { name: "Проверить" }).click();
  await page.getByRole("button", { name: "Дальше" }).click();
  await page.getByRole("button", { name: "1000₂" }).click();
  await page.getByRole("button", { name: "Проверить" }).click();
  await page.getByRole("button", { name: "Дальше" }).click();
  // Анкета: имя (необязательно), класс, цель, стиль, дневная цель
  await page.getByPlaceholder("Твоё имя").fill("Тест");
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: /Продолжить|Поехали/ }).click();
  await page.waitForURL("**/learn");
  await expect(page.getByText("Привет, Тест!")).toBeVisible();

  await page.getByRole("link", { name: "Начать" }).first().click();
  await page.waitForURL("**/lesson/ns-1-bits");
  // Ситуация: квест «Побег из компьютера»
  await expect(page.getByText("Побег из компьютера")).toBeVisible();
  await page.locator("footer button").last().click();

  // Песочница: «Продолжить» откроется, когда ламп станет 5 (32 сигнала)
  await expect(page.locator("footer button").last()).toBeDisabled();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Добавить лампу" }).click();
  await expect(page.getByText("Получилось!")).toBeVisible();
  await page.locator("footer button").last().click();
  await page.locator("footer button").last().click(); // теория → дальше

  // Неверный ответ → красная панель с правильным ответом
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText("Неверно")).toBeVisible();
  await expect(page.locator("footer")).toContainText("2");

  expect(errors).toEqual([]);
});

test("тренировка по навыку генерирует задания", async ({ page }) => {
  await page.goto("/onboarding");
  await page.evaluate(() =>
    localStorage.setItem(
      "informatica-v1",
      JSON.stringify({
        state: {
          onboarded: true,
          profile: { name: "Т", lang: "kk", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "dark", sound: false, createdAt: 1 },
          lessons: { "ns-1-binary": { completions: 1, bestAccuracy: 1, lastAt: 1, totalXp: 100 } },
        },
        version: 1,
      }),
    ),
  );
  await page.goto("/practice");
  await expect(page.getByText("Ақылды жаттығу")).toBeVisible();
  await page.goto("/drill?mode=skill&skill=ns.dec2bin");
  await expect(page.locator("main h1")).toContainText(/екілік|Екілік/);
});

test("ссылка на урок открывается без онбординга", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/lesson/ns-1-bits");
  await expect(page).toHaveURL(/\/lesson\/ns-1-bits/);
  await expect(page.getByText("Побег из компьютера")).toBeVisible();
  expect(errors).toEqual([]);
});
