import { expect, test, type Page } from "@playwright/test";

// Волна 3: новые страницы открываются без ошибок; открытые ссылки работают без онбординга.

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function seed(page: Page) {
  await page.goto("/onboarding");
  await page.evaluate(() =>
    localStorage.setItem(
      "informatica-v1",
      JSON.stringify({
        state: {
          onboarded: true,
          profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "dark", sound: false, createdAt: 1 },
          lessons: { "ns-1-binary": { completions: 1, bestAccuracy: 1, lastAt: 1, totalXp: 100 } },
        },
        version: 1,
      }),
    ),
  );
}

const PAGES = ["/python", "/tutor", "/privacy", "/terms", "/about", "/offline", "/exam/print?kind=mini&seed=7"];

test("новые страницы волны 3 открываются без ошибок", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading").first(), path).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("гость открывает урок, теорию и правовые страницы без онбординга", async ({ page }) => {
  const errors = trackErrors(page);
  for (const path of ["/lesson/py-1-vars", "/theory/db-2-select", "/privacy", "/report", "/restore"]) {
    await page.goto(path);
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname, path).toBe(path);
  }
  expect(errors).toEqual([]);
});

test("испорченные ссылки отчёта и переноса не ломают страницу", async ({ page }) => {
  const errors = trackErrors(page);
  for (const path of ["/report#d=zzz%%%", "/restore#d=r!!!", "/exam/run?kind=mini&seed=1&ch=@@@"]) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();
  }
  expect(errors).toEqual([]);
});
