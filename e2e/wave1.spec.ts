import { expect, test, type Page } from "@playwright/test";
import { dismissTour } from "./tour";

// Этап 16Б, волна 1: проводник первого входа (#104), «Продолжить» ведёт в начатый урок (#102),
// бесплатный ИИ — 3 обращения навсегда, без «сегодня» (#99). Без обращений к ИИ.

const STORE = "informatica-v1";

async function seed(page: Page, extra: Record<string, unknown> = {}) {
  await page.goto("/onboarding");
  await page.evaluate(
    ([key, more]) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", track: "ent", style: "short", dailyGoalXp: 50, theme: "dark", sound: false, createdAt: 1 },
            hearts: { count: 5, updatedAt: Date.now(), day: "" },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            ...(more as Record<string, unknown>),
          },
          version: 2,
        }),
      ),
    [STORE, extra] as const,
  );
}

const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").state ?? {}, STORE);

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("проводник: школьник после онбординга видит приветствие; Escape закрывает весь проводник, перезагрузка его не возвращает", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/onboarding");
  await page.getByText("Русский").click();
  await page.getByPlaceholder("Твоё имя").fill("Аян");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("button", { name: /Изучаю школьную программу/ }).click();
  await page.getByRole("button", { name: "8 класс" }).click();
  await page.getByRole("button", { name: "Поехали" }).click();
  await page.waitForURL("**/learn");

  // Бит выпрыгивает снизу и здоровается (без затемнения — это status, а не dialog).
  const bit = page.getByLabel("Подсказка Бита");
  await expect(bit).toBeVisible();
  await expect(bit).toContainText("Привет, Аян!");
  // Окна тарифов и напоминаний ждут проводник.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await dismissTour(page);
  const tips = (await saved(page)).tips ?? {};
  expect(tips.welcome).toBeTruthy();
  expect(tips.nav).toBeTruthy();

  await page.reload();
  await expect(page.getByRole("link", { name: /Продолжить|Начать/ }).first()).toBeVisible();
  await expect(bit).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("«Продолжить» ведёт в начатый урок, а не в первый на пути", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, {
    tips: { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1, "page-shop": 1, "page-profile": 1 },
  });
  // Начинаем не первый урок пути (первый — «Старт: компьютер с нуля»): ns-1-bits, два шага вперёд.
  await page.goto("/lesson/ns-1-bits");
  const next = page.locator("footer button").last();
  await next.click();
  await next.click();
  await expect.poll(async () => Object.keys((await saved(page)).lessonRuns ?? {})).toContain("ns-1-bits");

  await page.goto("/learn");
  const cta = page.locator('[data-tour="continue"]').first();
  await expect(cta).toContainText("Продолжить:");
  await expect(cta).toHaveAttribute("href", /\/lesson\/ns-1-bits/);
  await expect(page.getByText(/Шаг \d+ из \d+/).first()).toBeVisible();
  await cta.click();
  await page.waitForURL("**/lesson/ns-1-bits");
  expect(errors).toEqual([]);
});

test("ИИ на «Бесплатном»: «осталось 3 из 3» без «сегодня»", async ({ page }) => {
  await seed(page, {
    tips: { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1, "page-shop": 1, "page-profile": 1 },
  });
  await page.goto("/lesson/ns-1-bits");
  const ask = page.getByRole("button", { name: /^Спросить ИИ/ });
  await expect(ask).toHaveAttribute("aria-label", /бесплатно: осталось 3 из 3/);
  await expect(ask).not.toHaveAttribute("aria-label", /Сегодня|сегодня/);
});
