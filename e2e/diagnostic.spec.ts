import { expect, test, type Page } from "@playwright/test";
import { dismissTour } from "./tour";

// Короткий онбординг и входная диагностика (#70): без обращений к ИИ.

const STORE = "informatica-v1";

/** Язык и имя — первые два экрана онбординга. */
async function langAndName(page: Page) {
  await page.goto("/onboarding");
  await page.getByText("Русский").click();
  await page.getByPlaceholder("Твоё имя").fill("Диагност");
  await page.getByRole("button", { name: "Продолжить" }).click();
}

/** Онбординг ЕНТ до экрана диагностики: ЕНТ → «Пока не знаю» (дата) → «Пока не знаю» (цель) → «Поехали». */
async function toDiagnostic(page: Page) {
  await langAndName(page);
  await page.getByRole("button", { name: /Готовлюсь к ЕНТ/ }).click();
  await page.getByRole("button", { name: "Пока не знаю" }).click();
  await expect(page.getByText("Сколько баллов хочешь набрать?")).toBeVisible();
  await page.getByRole("button", { name: "Пока не знаю" }).click();
  await page.getByRole("button", { name: "Поехали" }).click();
  await page.waitForURL("**/diagnostic?from=onboarding");
  await expect(page.getByText("Короткая проверка")).toBeVisible();
}

/** Сохранённое состояние приложения (zustand persist). */
async function saved(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").state ?? {}, STORE);
}

/**
 * Проходит 10 заданий: чётные — «Не знаю», нечётные — первый вариант и «Дальше»; на последнем — «Показать итог».
 * Задание за заданием проверяет счётчик «N из 10».
 */
async function answerAll(page: Page) {
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  for (let n = 1; n <= 10; n++) {
    await expect(page.getByText(`${n} из 10`, { exact: true })).toBeVisible();
    if (n % 2 === 0) {
      await page.getByRole("button", { name: "Не знаю", exact: true }).click();
    } else {
      await page.locator("article button[aria-pressed]").first().click();
      await page.getByRole("button", { name: /^(Дальше|Показать итог)$/ }).click();
    }
  }
}

test("ЕНТ: 10 заданий («Не знаю» и первый вариант) → итог → /learn без тарифов; не пробник", async ({ page }) => {
  await toDiagnostic(page);
  // Дата и цель — «пока не знаю»: цель не считается выбранной.
  let s = await saved(page);
  expect(s.profile.examDate).toBeNull();
  expect(s.profile.targetScoreSet).toBe(false);
  expect(s.profile.track).toBe("ent");
  expect(s.profile.diagnostic).toBeNull();

  await answerAll(page);

  // Итог: прогноз диапазоном, три слабые темы (минимум пять «Не знаю» — минимум три разные темы), без ответов и разборов.
  await expect(page.getByText("Предварительный прогноз")).toBeVisible();
  await expect(page.getByText(/примерно \d+–\d+ из 50/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Начать с неё" })).toHaveCount(3);

  // Диагностика записана в профиль, но не в историю тестов; серии и XP нет.
  s = await saved(page);
  expect(s.profile.diagnostic.max).toBe(10);
  expect(s.exams ?? []).toHaveLength(0);
  expect(s.xp ?? 0).toBe(0);

  // «Дальше» → сразу главная (окна тарифов после онбординга нет, #104), там — приветствие проводника.
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await page.waitForURL("**/learn");
  await dismissTour(page);
  expect((await saved(page)).paywall?.views ?? 0).toBeLessThanOrEqual(1);
});

test("диагностика: «Пропустить диагностику» посреди заданий — в профиль ничего не пишется, дальше главная", async ({ page }) => {
  await toDiagnostic(page);
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await expect(page.getByText("1 из 10", { exact: true })).toBeVisible();
  await page.locator("article button[aria-pressed]").first().click();
  await page.getByRole("button", { name: "Пропустить диагностику" }).click();
  await page.waitForURL("**/learn");
  expect((await saved(page)).profile.diagnostic).toBeNull();
  await dismissTour(page);
});

test("онбординг ЕНТ: дата и цель сохраняются; шагов пять", async ({ page }) => {
  await langAndName(page);
  await page.getByRole("button", { name: /Готовлюсь к ЕНТ/ }).click();
  await expect(page.getByRole("progressbar", { name: "Шаг 4 из 5" })).toBeVisible();
  const date = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
  await page.locator('input[type="date"]').fill(date);
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.getByRole("progressbar", { name: "Шаг 5 из 5" })).toBeVisible();
  // «Поехали» закрыт, пока цель не выбрана.
  await expect(page.getByRole("button", { name: "Поехали" })).toBeDisabled();
  await page.getByRole("button", { name: "35", exact: true }).click();
  await page.getByRole("button", { name: "Поехали" }).click();
  await page.waitForURL("**/diagnostic?from=onboarding");
  const s = await saved(page);
  expect(s.profile.examDate).toBe(date);
  expect(s.profile.targetScore).toBe(35);
  expect(s.profile.targetScoreSet).toBe(true);
  expect(s.profile.grade).toBe("11");
});

test("школьный трек: четыре экрана, выбор класса, без диагностики — сразу главная", async ({ page }) => {
  await langAndName(page);
  await page.getByRole("button", { name: /Изучаю школьную программу/ }).click();
  await expect(page.getByRole("progressbar", { name: "Шаг 4 из 4" })).toBeVisible();
  // Пока класс не выбран, «Поехали» закрыт.
  await expect(page.getByRole("button", { name: "Поехали" })).toBeDisabled();
  await page.getByRole("button", { name: "8 класс" }).click();
  await page.getByRole("button", { name: "Поехали" }).click();
  await page.waitForURL("**/learn");
  const s = await saved(page);
  expect(s.profile.track).toBe("school");
  expect(s.profile.grade).toBe("8");
  expect(s.profile.diagnostic).toBeNull();
  await dismissTour(page);
});

test("повтор из «Цели»: без from итог ведёт на главную, диагностика пересчитывается", async ({ page }) => {
  await page.goto("/onboarding");
  await page.evaluate((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        state: {
          onboarded: true,
          profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", track: "ent", style: "short", dailyGoalXp: 50, theme: "light", sound: false, createdAt: 1 },
          // Окно тарифов уже показано — не всплывает на главной.
          paywall: { lastShownAt: 4102444800000, views: 1 },
            // Проводник первого входа (#104) уже пройден — не закрывает экран.
            tips: { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1, "page-shop": 1, "page-profile": 1 },
        },
        version: 1,
      }),
    );
  }, STORE);
  await page.goto("/diagnostic");
  await expect(page.getByText("Короткая проверка")).toBeVisible();
  await answerAll(page);
  await expect(page.getByText("Предварительный прогноз")).toBeVisible();
  expect((await saved(page)).profile.diagnostic.max).toBe(10);
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await page.waitForURL("**/learn");
});
