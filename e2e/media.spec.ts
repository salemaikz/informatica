import { expect, test, type Page } from "@playwright/test";

// Этап 16Г, F2: панель видеоплеера на двух языках с полным экраном и фоновая музыка (выключена по умолчанию).
async function seed(page: Page, lang: "ru" | "kk", music?: { enabled: boolean; track: string }) {
  await page.goto("/onboarding");
  await page.evaluate(
    ({ lang, music }) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang, grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "system", sound: true, createdAt: 1, ...(music ? { music } : {}) },
            lessons: {},
            paywall: { lastShownAt: 4102444800000, views: 1 },
            tips: { welcome: 1, "lesson-first": 1, "lesson-icons": 1, intro: 1, "learn-next": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1, "page-shop": 1, "page-profile": 1 },
            hearts: { count: 5, updatedAt: 0, day: "" },
          },
          version: 1,
        }),
      ),
    { lang, music },
  );
}

const LABELS = {
  ru: { controls: "Управление видео", play: "Воспроизвести видео", mute: "Выключить звук видео", full: "На весь экран", exit: "Выйти из полного экрана", seek: "Позиция воспроизведения" },
  kk: { controls: "Бейнені басқару", play: "Бейнені ойнату", mute: "Бейненің дыбысын өшіру", full: "Толық экран", exit: "Толық экраннан шығу", seek: "Ойнату орны" },
} as const;

for (const lang of ["ru", "kk"] as const) {
  test(`видеоплеер: подписи на ${lang}, полный экран открывается и закрывается`, async ({ page }) => {
    await seed(page, lang);
    await page.goto("/lesson/ns-1-binary");
    const L = LABELS[lang];
    const player = page.getByTestId("video-player");
    await expect(player).toBeVisible();
    await expect(player.getByRole("button", { name: L.play })).toBeVisible();
    await expect(player.getByRole("button", { name: L.mute })).toBeVisible();
    await expect(player.getByRole("slider", { name: L.seek })).toBeVisible();
    await expect(player.getByRole("group", { name: L.controls })).toBeVisible();
    // Встроенная английская панель Remotion не показывается
    await expect(player.getByText("Play", { exact: true })).toHaveCount(0);

    await player.getByRole("button", { name: L.full }).click();
    await expect(player).toHaveAttribute("data-fullscreen", "true");
    await page.screenshot({ path: `/tmp/claude-0/shots/media/player-fullscreen-${lang}.png` });
    await player.getByRole("button", { name: L.exit }).click();
    await expect(player).toHaveAttribute("data-fullscreen", "false");

    // Воспроизведение: кнопка превращается в «Приостановить»
    await player.getByRole("button", { name: L.play }).click();
    await expect(player.getByRole("button", { name: lang === "ru" ? "Приостановить видео" : "Бейнені кідірту" })).toBeVisible();
  });
}

test("фоновая музыка: по умолчанию выключена, включается в профиле, выключатель в игре", async ({ page }) => {
  await seed(page, "ru");
  await page.goto("/profile");
  const row = page.getByTestId("music-row");
  await expect(row.getByText("Фоновая музыка")).toBeVisible();
  await expect(row.getByRole("button", { name: "Вкл", exact: true })).toHaveAttribute("aria-pressed", "false");
  await row.getByRole("button", { name: "Вкл", exact: true }).click();
  await expect(row.getByRole("button", { name: "Bit Arcade" })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("informatica-v1") ?? "{}").state?.profile?.music);
  expect(saved).toEqual({ enabled: true, track: "auto" });

  // В игре — выключатель в шапке; нажатие выключает музыку
  await page.goto("/game/bit-rush");
  await page.getByRole("button", { name: "Играть" }).click();
  const toggle = page.getByTestId("music-toggle");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("informatica-v1") ?? "{}").state?.profile?.music?.enabled);
  expect(after).toBe(false);
});

test("фоновая музыка: у урока выключатель в панели инструментов, в шапке урока лишнего нет", async ({ page }) => {
  await seed(page, "ru", { enabled: false, track: "auto" });
  await page.goto("/lesson/ns-1-bits");
  await expect(page.locator("[data-tour='lesson-progress']")).toBeVisible();
  await page.getByRole("button", { name: "Инструменты" }).first().click();
  const toggle = page.getByTestId("music-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
});
