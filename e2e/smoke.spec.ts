import { expect, test, type Page } from "@playwright/test";

// Дымовой тест без обращений к ИИ: онбординг → главная → начало урока → тренировка.

/** Шаги онбординга до главной; на шаге «С чего начнём?» — «с нуля» или «основы знаю». */
async function finishOnboarding(page: Page, skipBasics: boolean) {
  const next = page.getByRole("button", { name: /Продолжить|Поехали/ });
  while (!(await page.getByText("С чего начнём?").isVisible())) await next.click();
  await page.getByText(skipBasics ? "Основы знаю — сразу к темам ЕНТ" : "С нуля: как устроен компьютер").click();
  while (!page.url().includes("/plans")) {
    await next.click();
    await page.waitForTimeout(150);
  }
  // После онбординга — окно тарифов; закрываем «Продолжить бесплатно».
  await page.waitForURL("**/plans?from=onboarding");
  await page.getByRole("button", { name: "Продолжить бесплатно" }).click();
  await page.waitForURL("**/learn");
}

test("новичок начинает с раздела «Старт: компьютер с нуля»", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByText("Русский").click();
  await page.getByPlaceholder("Твоё имя").fill("Новичок");
  await finishOnboarding(page, false);
  await page.getByRole("link", { name: "Начать" }).first().click();
  await page.waitForURL("**/lesson/base-1-computer");
  await expect(page.locator("footer button").last()).toBeVisible();
});

test("онбординг и первые шаги урока", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await page.waitForURL("**/onboarding");
  await page.getByText("Русский").click();
  await page.getByPlaceholder("Твоё имя").fill("Тест");
  await finishOnboarding(page, true);
  await expect(page.getByText("Привет, Тест!")).toBeVisible();

  await page.getByRole("link", { name: "Начать" }).first().click();
  await page.waitForURL("**/lesson/ns-1-bits");
  // Ситуация: квест «Побег из компьютера»
  await expect(page.getByText("Побег из компьютера")).toBeVisible();
  await page.locator("footer button").last().click();
  await page.locator("footer button").last().click(); // «Где живут биты» (системный блок) → дальше

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
  // Ошибка с первой попытки стоит сердечко: было 5, стало 4.
  await expect(page.getByLabel("Сердечки: 4")).toBeVisible();

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
          // Окно тарифов уже показано — не всплывает в автотестах.
          paywall: { lastShownAt: 4102444800000, views: 1 },
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
