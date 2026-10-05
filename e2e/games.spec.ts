import { expect, test, type Page } from "@playwright/test";

// Каждая мини-игра открывается, стартует и рисует игровое поле без ошибок.
// Запуск игры стоит сердечко (#40): тесты идут с полным запасом, отдельный тест проверяет списание и «Сердечки закончились».
const GAME_IDS = ["bit-rush", "bit-flip", "bit-sort", "bug-hunt", "tower", "truth", "memo", "bingo", "cipher", "bet", "boss", "build"];

type HeartsSeed = { count: number; updatedAt: number; day: string };

async function seed(page: Page, hearts: HeartsSeed) {
  await page.goto("/onboarding");
  await page.evaluate(
    (h) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "system", sound: false, createdAt: 1 },
            lessons: { "ns-1-binary": { completions: 1, bestAccuracy: 1, lastAt: 1, totalXp: 100 } },
            // Окно тарифов уже показано — не всплывает в автотестах.
            paywall: { lastShownAt: 4102444800000, views: 1 },
            hearts: h,
          },
          version: 1,
        }),
      ),
    hearts,
  );
}

/** Полный запас бесплатного тарифа (5 сердечек). */
const FULL: HeartsSeed = { count: 5, updatedAt: 0, day: "" };

/** Сердечки в сохранении (стор пишет в localStorage сразу). */
const savedHearts = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("informatica-v1") ?? "{}").state?.hearts?.count);

for (const id of GAME_IDS) {
  test(`мини-игра ${id} запускается`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await seed(page, FULL);
    await page.goto("/practice");
    await page.locator(`a[href^="/game/${id}"]`).click();
    await page.waitForURL(new RegExp(`/game/${id}(\\?|$)`));
    await page.getByRole("button", { name: "Играть" }).click();
    // Игровое поле: появились интерактивные элементы, правила скрылись
    await expect(page.getByText("Правила")).toHaveCount(0);
    await expect(page.locator("main button").first()).toBeVisible();
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });
}

test("игра: «Играть» списывает сердечко, цена видна на кнопке", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page, FULL);
  await page.goto("/practice");
  // Цена входа на карточке игры и на кнопке «Играть»; строка про цену во вступлении.
  await expect(page.locator('a[href^="/game/bit-rush"]').getByRole("img", { name: /Цена входа в сердечках: 1/ })).toBeVisible();
  await page.locator('a[href^="/game/bit-rush"]').click();
  await page.waitForURL(/\/game\/bit-rush/);
  const play = page.getByRole("button", { name: "Играть" });
  await expect(play.getByRole("img", { name: /Цена входа в сердечках: 1/ })).toBeVisible();
  await expect(page.getByText(/Каждый запуск игры стоит 1 сердечко/)).toBeVisible();
  // Само открытие экрана ничего не списывает.
  expect(await savedHearts(page)).toBe(5);
  await play.click();
  await expect(page.getByText("Правила")).toHaveCount(0);
  await expect.poll(() => savedHearts(page)).toBe(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("игра: при 0 сердечек «Играть» открывает «Сердечки закончились» и не запускает игру", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Сердечки только что потрачены: за тест (раз в 6 часов по сердечку) не восстановятся.
  await seed(page, { count: 0, updatedAt: Date.now(), day: "" });
  await page.goto("/game/bit-rush");
  await page.getByRole("button", { name: "Играть" }).click();
  const sheet = page.getByRole("dialog", { name: "Сердечки закончились" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Сердечки закончились" })).toBeVisible();
  // Игра не началась, правила на месте, ничего не списано.
  await expect(page.getByText("Правила")).toBeVisible();
  expect(await savedHearts(page)).toBe(0);
  // «Выйти» ведёт к тренировкам.
  await sheet.getByRole("button", { name: "Выйти" }).click();
  await page.waitForURL(/\/practice$/);
  expect(errors).toEqual([]);
});
