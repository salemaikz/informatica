import { expect, test, type Page } from "@playwright/test";

// Этап 3: новые экраны открываются без ошибок, любой урок доступен, мини-ЕНТ проходится до результата.

async function seed(page: Page, lang: "ru" | "kk" = "ru") {
  await page.goto("/onboarding");
  await page.evaluate(
    (lg) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: lg, grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "dark", sound: false, createdAt: 1 },
            lessons: { "ns-1-binary": { completions: 1, bestAccuracy: 1, lastAt: 1, totalXp: 100 } },
            // Окно тарифов уже показано — не всплывает в автотестах.
            paywall: { lastShownAt: 4102444800000, views: 1 },
          },
          version: 1,
        }),
      ),
    lang,
  );
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const PAGES = ["/learn", "/theory", "/theory/py-1-vars", "/search", "/notes", "/exam", "/profile", "/stats", "/practice", "/materials", "/shop"];

test("новые экраны открываются без ошибок", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("main").getByRole("heading").first(), path).toBeVisible();
  }
  // Без горизонтальной прокрутки на телефоне
  await page.goto("/learn");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("навигация: группы, подразделы, шпаргалка", async ({ page }) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page);
  await page.goto("/practice");
  // Нижняя панель — пять групп; строка подразделов видна на главной странице подраздела.
  const bottom = page.getByRole("navigation", { name: "Главное меню" });
  await expect(bottom.getByRole("link")).toHaveCount(5);
  const tabs = page.getByRole("navigation", { name: "Подразделы" });
  await expect(tabs.getByRole("link", { name: "Пробный ЕНТ" })).toBeVisible();
  await tabs.getByRole("link", { name: "Пробный ЕНТ" }).click();
  await expect(page).toHaveURL(/\/exam$/);
  await expect(tabs.getByRole("link", { name: "Пробный ЕНТ" })).toHaveAttribute("aria-current", "page");
  // Материалы: хаб, «Шпаргалка» открывает инструменты.
  await bottom.getByRole("link", { name: "Материалы" }).click();
  await expect(page).toHaveURL(/\/materials$/);
  // «Шпаргалка» есть и в строке подразделов, и карточкой хаба — жмём таблетку (точное имя).
  await tabs.getByRole("button", { name: "Шпаргалка", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // В шапке больше нет поиска и аватара.
  await page.keyboard.press("Escape");
  await expect(page.locator("header").getByRole("link", { name: "Поиск" })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("поиск находит тему", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/search");
  await page.getByPlaceholder("Тема или слово…").fill("цикл");
  await expect(page.locator('main a[href^="/theory/"], main a[href^="/lesson/"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("дальний урок открывается сразу", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, "kk");
  await page.goto("/lesson/db-2-select");
  await expect(page.locator("footer button").last()).toBeVisible();
  expect(errors).toEqual([]);
});

test("мини-ЕНТ: старт, ответ, завершение, результат", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/exam/run?kind=mini&seed=42");
  await page.getByRole("button", { name: "Начать" }).click();
  await expect(page.getByText("Задание 1").first()).toBeVisible();
  await page.getByRole("button", { name: "Завершить" }).first().click();
  await page.getByRole("button", { name: "Завершить и показать результат" }).click();
  await page.waitForURL("**/exam/result/**");
  await expect(page.getByText("из 19").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "По темам" })).toBeVisible();
  expect(errors).toEqual([]);
});
