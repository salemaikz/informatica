import { expect, test, type Page } from "@playwright/test";

// Прогресс ученика (#71): шкала курса, слабые места, разделы и темы на «Прогрессе»; вёрстка телефона без прокрутки вбок.

const dayKey = (ago: number) => {
  const d = new Date(Date.now() - ago * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function seed(page: Page, opts: { lang?: "ru" | "kk"; theme?: "light" | "dark"; track?: "ent" | "school" } = {}) {
  const { lang = "ru", theme = "dark", track = "ent" } = opts;
  await page.goto("/onboarding");
  await page.evaluate(
    ({ lg, th, tr, today, week }) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: lg, grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: th, sound: false, createdAt: 1, track: tr },
            // Один слабый навык (низкая оценка) и один уверенный: у слабого — своя кнопка «Потренировать».
            skills: {
              "ns.bin2dec": { attempts: 5, correct: 1, mastery: 0.3, lastSeen: Date.now() },
              "ns.dec2bin": { attempts: 6, correct: 6, mastery: 0.9, lastSeen: Date.now() },
            },
            skillDays: {
              [today]: { "ns.bin2dec": { n: 4, s: 1, sec: 200 } },
              [week]: { "ns.dec2bin": { n: 6, s: 6, sec: 300 } },
            },
            days: { [today]: { xp: 40, answers: 10, correct: 7, seconds: 500, asked: 10, score: 7, hinted: 2, skipped: 1 } },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            hearts: { count: 5, updatedAt: 0, day: "" },
          },
          version: 1,
        }),
      ),
    { lg: lang, th: theme, tr: track, today: dayKey(0), week: dayKey(9) },
  );
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test("«Прогресс» на телефоне: шкала, слабые места, разделы, темы; без прокрутки вбок, тёмная и светлая темы", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 360, height: 740 });

  for (const theme of ["dark", "light"] as const) {
    await seed(page, { theme });
    await page.goto("/stats");
    const main = page.locator("main");
    await expect(main.getByText(/Пройдено \d+% курса/)).toBeVisible();
    await expect(main.getByRole("heading", { name: "Слабые места" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Разделы курса" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Темы ЕНТ" })).toBeVisible();

    // Слабый навык и его адресная кнопка
    await expect(main.getByText("Перевод 2 → 10").first()).toBeVisible();
    await expect(main.locator('a[href="/drill?mode=skill&skill=ns.bin2dec"]').first()).toBeVisible();

    // Темы: мини-графики с подписью для диктора; переключатель 7 / 30 дней
    expect(await main.locator('svg[role="img"][aria-label]').count()).toBeGreaterThanOrEqual(13);
    const seven = main.getByRole("button", { name: "7 дней" });
    await seven.click();
    await expect(seven).toHaveAttribute("aria-pressed", "true");

    // Честные цифры: «сам / с подсказкой / пропущено», активное время
    await expect(main.getByText("без подсказки: 7 · с подсказкой: 2 · пропущено: 1")).toBeVisible();
    await expect(main.getByText("активное время")).toBeVisible();

    expect(await overflow(page), theme).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("«Прогресс» по-казахски: темы ҰБТ и слабые места, без прокрутки вбок", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page, { lang: "kk" });
  await page.goto("/stats");
  const main = page.locator("main");
  await expect(main.getByRole("heading", { name: "ҰБТ тақырыптары" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Әлсіз тұстар" })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

test("школьный трек: шкала класса, разделы программы, без тем ЕНТ", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page, { track: "school" });
  await page.goto("/stats");
  const main = page.locator("main");
  await expect(main.getByText(/Пройдено \d+% программы 11 класса/)).toBeVisible();
  await expect(main.getByRole("heading", { name: "Разделы программы" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Темы ЕНТ" })).toHaveCount(0);
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});
