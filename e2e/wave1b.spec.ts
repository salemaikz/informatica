import { expect, test, type Page } from "@playwright/test";

// Этап 16Б, волна 1Б: кейс за новый уровень (приз решает код, касание — сразу приз), чипы за дела, а не за опыт (#105).
// Без обращений к ИИ.

const STORE = "informatica-v1";
const TIPS = { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1, "page-shop": 1, "page-profile": 1 };

async function seed(page: Page, extra: Record<string, unknown> = {}) {
  await page.goto("/onboarding");
  await page.evaluate(
    ([key, tips, more]) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", track: "ent", style: "short", dailyGoalXp: 50, theme: "dark", sound: false, createdAt: 1 },
            hearts: { count: 2, updatedAt: Date.now(), day: "" },
            wallet: { chips: 20, earned: 20, spent: 0 },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            pushAsk: { lastAt: 4102444800000, count: 5 },
            tips,
            ...(more as Record<string, unknown>),
          },
          version: 2,
        }),
      ),
    [STORE, TIPS, extra] as const,
  );
}

const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").state ?? {}, STORE);

test("кейс за уровень: открывается сам на «Учиться», касание сразу показывает приз, приз выдан и кейс ушёл из очереди", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page, { xp: 300, pendingCases: [3] });
  await page.goto("/learn");

  const dialog = page.getByRole("dialog", { name: /Кейс за новый уровень/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Открыть кейс" }).click();
  // Касание во время прокрутки — сразу приз.
  await dialog.click({ position: { x: 40, y: 40 } });
  await expect(dialog.getByText("Твой приз")).toBeVisible({ timeout: 5000 });

  const before = { chips: 20, hearts: 2, xp: 300 };
  const s = await saved(page);
  expect(s.pendingCases ?? []).toEqual([]);
  // Приз — XP, чипы, сердечки, бустер или украшение профиля (оно попадает в cosmetics.owned).
  const changed =
    s.wallet.chips > before.chips || s.hearts.count > before.hearts || s.xp > before.xp || (s.boost?.until ?? 0) > Date.now() || (s.cosmetics?.owned?.length ?? 0) > 0;
  expect(changed).toBe(true);

  await dialog.getByRole("button", { name: "Отлично" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole("dialog", { name: /Кейс за новый уровень/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("кейс «Позже» — остаётся в карточке «Кейс ждёт» на главной", async ({ page }) => {
  await seed(page, { xp: 300, pendingCases: [3] });
  await page.goto("/learn");
  const dialog = page.getByRole("dialog", { name: /Кейс за новый уровень/ });
  await dialog.getByRole("button", { name: "Позже" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Кейс за уровень 3 ждёт")).toBeVisible();
  expect((await saved(page)).pendingCases).toEqual([3]);
});

test("магазин: «Как заработать чипы» — за дела, а не за опыт", async ({ page }) => {
  await seed(page);
  await page.goto("/shop");
  await expect(page.getByText(/5 XP = 2 чипа/)).toHaveCount(0);
});
