import { expect, test, type Page } from "@playwright/test";
import { dismissTour } from "./tour";

// Дымовой тест без обращений к ИИ: онбординг → диагностика → главная (проводник) → начало урока → тренировка.

/**
 * Онбординг ЕНТ до главной (язык и имя уже выбраны): «Продолжить» → ЕНТ → «Пока не знаю» (дата) → «Пока не знаю» (цель)
 * → «Поехали» → диагностика → «Пропустить» → /learn (окна тарифов после онбординга нет, #104) → проводник закрыт.
 */
async function finishOnboarding(page: Page) {
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("button", { name: /Готовлюсь к ЕНТ/ }).click();
  await expect(page.getByText("Когда у тебя ЕНТ?")).toBeVisible();
  await page.getByRole("button", { name: "Пока не знаю" }).click();
  await expect(page.getByText("Сколько баллов хочешь набрать?")).toBeVisible();
  await page.getByRole("button", { name: "Пока не знаю" }).click();
  await page.getByRole("button", { name: "Поехали" }).click();
  // После онбординга ЕНТ — входная диагностика; пропускаем.
  await page.waitForURL("**/diagnostic?from=onboarding");
  await page.getByRole("button", { name: "Пропустить", exact: true }).click();
  await page.waitForURL("**/learn");
  await dismissTour(page);
}

/**
 * «Основы знаю»: настоящую диагностику в e2e не пройти (верных ответов не видно), поэтому ставим то, что она ставит
 * при знакомых основах, — profile.skipBasics (раздел «Старт» не рекомендуется первым).
 */
async function knowBasics(page: Page) {
  await page.evaluate(() => {
    const raw = localStorage.getItem("informatica-v1");
    const saved = raw ? JSON.parse(raw) : { state: {}, version: 1 };
    saved.state.profile = { ...saved.state.profile, skipBasics: true };
    localStorage.setItem("informatica-v1", JSON.stringify(saved));
  });
  await page.reload();
}

test("новичок начинает с раздела «Старт: компьютер с нуля»", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByText("Русский").click();
  await page.getByPlaceholder("Твоё имя").fill("Новичок");
  await finishOnboarding(page);
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
  await finishOnboarding(page);
  await knowBasics(page);
  await expect(page.getByRole("link", { name: "Начать" }).first()).toBeVisible();

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
  // Вход оплачен на первом «Продолжить» (#40, этап 15): было 5, стало 4 — за вход, а не за ошибку.
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
            // Проводник первого входа (#104) уже пройден — не закрывает экран.
            tips: { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1 },
        },
        version: 1,
      }),
    ),
  );
  await page.goto("/practice");
  await expect(page.getByText("Ақылды жаттығу")).toBeVisible();
  await page.goto("/drill?mode=skill&skill=ns.dec2bin");
  // Задание 10 → 2 на казахском: перевод в екілік жүйе или «включи биты» (вид bits — навык ns.dec2bin с этапа 10).
  await expect(page.locator("main h1")).toContainText(/екілік|Екілік|бит/);
});
