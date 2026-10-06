import { expect, test } from "@playwright/test";

// Каждая мини-игра открывается, стартует и рисует игровое поле без ошибок.
const GAME_IDS = ["bit-rush", "bit-flip", "bit-sort", "bug-hunt"];

for (const id of GAME_IDS) {
  test(`мини-игра ${id} запускается`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.getItem("informatica-v1") || localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "system", sound: false, createdAt: 1 },
            lessons: { "ns-1-binary": { completions: 1, bestAccuracy: 1, lastAt: 1, totalXp: 100 } },
          },
          version: 1,
        }),
      ),
    );
    await page.goto("/onboarding");
    await page.goto("/practice");
    await page.locator(`a[href="/game/${id}"]`).click();
    await page.waitForURL(`**/game/${id}`);
    await expect(page.getByRole("button", { name: /^Играть/ })).toContainText("1 сердце");
    await page.getByRole("button", { name: /^Играть/ }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("informatica-v1")!).state.hearts.count)).toBe(4);
    // Игровое поле: появились интерактивные элементы, правила скрылись
    await expect(page.getByText("Правила")).toHaveCount(0);
    await expect(page.locator("main button").first()).toBeVisible();
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });
}
