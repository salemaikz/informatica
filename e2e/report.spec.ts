import { devices, expect, test, type Browser, type Page } from "@playwright/test";

// Отчёт родителю (#74): профиль → «Отчёт для родителей» → ссылка; ссылку открывают на чистом устройстве
// (новый контекст: без онбординга и без данных ученика), имя — только по переключателю, ru/kk, телефон 390 px, тёмная тема.

const dayKey = (ago: number) => {
  const d = new Date(Date.now() - ago * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function seed(page: Page, opts: { lang?: "ru" | "kk"; theme?: "light" | "dark"; name?: string } = {}) {
  const { lang = "ru", theme = "dark", name = "Айдана" } = opts;
  await page.goto("/onboarding");
  await page.evaluate(
    ({ lg, th, nm, today, ago }) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: nm, lang: lg, grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: th, sound: false, createdAt: 1, track: "ent" },
            xp: 345,
            streak: { current: 4, best: 6, lastDay: today, freezes: 0 },
            skills: {
              "ns.bin2dec": { attempts: 5, correct: 1, mastery: 0.3, lastSeen: Date.now() },
              "ns.dec2bin": { attempts: 6, correct: 6, mastery: 0.9, lastSeen: Date.now() },
            },
            days: {
              [today]: { xp: 40, answers: 10, correct: 7, seconds: 1500, lessons: 2, asked: 10, score: 7, hinted: 2, skipped: 1 },
              [ago]: { xp: 20, answers: 6, correct: 6, seconds: 600, lessons: 1, asked: 6, score: 6 },
            },
            exams: [{ id: "e1", kind: "mini", seed: 7, at: Date.now() - 3600_000, points: 9, maxPoints: 19, durationSec: 900, byTopic: { t01: { points: 1, max: 2 } } }],
            paywall: { lastShownAt: 4102444800000, views: 1 },
            hearts: { count: 5, updatedAt: 0, day: "" },
          },
          version: 2,
        }),
      ),
    { lg: lang, th: theme, nm: name, today: dayKey(0), ago: dayKey(2) },
  );
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** Чистое устройство: новый контекст без сохранений, телефонная ширина, тёмная системная тема. */
async function cleanDevice(browser: Browser) {
  const context = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  return { context, page: await context.newPage() };
}

async function openSheet(page: Page) {
  await page.goto("/profile");
  await page.getByRole("button", { name: /Отчёт для родителей/ }).click();
  const dialog = page.getByRole("dialog", { name: "Отчёт для родителей" });
  await expect(dialog.getByRole("link", { name: "Посмотреть отчёт" })).toBeVisible();
  return dialog;
}

test("отчёт: ссылка с профиля открывается на чистом устройстве без онбординга; имени нет", async ({ page, browser }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  const dialog = await openSheet(page);

  // Переключатель имени есть и по умолчанию выключен; у «Копировать» — ссылка /report#d=…
  const nameSwitch = dialog.getByRole("switch", { name: "Показать имя" });
  await expect(nameSwitch).toHaveAttribute("aria-checked", "false");
  const href = await dialog.getByRole("link", { name: "Посмотреть отчёт" }).getAttribute("href");
  // «Посмотреть отчёт» — своя ссылка с меткой «me=1» (свой просмотр не считается открытием получателем);
  // получателю уходит чистая ссылка без метки (её проверяем ниже на чистом устройстве).
  expect(href).toMatch(/\/report#d=[A-Za-z0-9_-]+&me=1$/);
  expect(href!.length).toBeLessThan(1500);
  const clean = href!.replace(/&me=1$/, "");

  // Свой просмотр: метка после чтения убирается из адреса, чтобы скопированный адрес был чистым
  const [preview] = await Promise.all([page.context().waitForEvent("page"), dialog.getByRole("link", { name: "Посмотреть отчёт" }).click()]);
  await expect(preview.locator("main").getByRole("heading", { name: "Отчёт об успехах" })).toBeVisible();
  await expect(preview).toHaveURL(/\/report#d=[A-Za-z0-9_-]+$/);
  await preview.close();

  const fresh = await cleanDevice(browser);
  const rp = fresh.page;
  const rErrors: string[] = [];
  rp.on("pageerror", (e) => rErrors.push(e.message));
  await rp.goto(clean);
  await expect(rp).toHaveURL(/\/report#d=/); // не ушло на онбординг
  const main = rp.locator("main");
  await expect(main).toHaveAttribute("lang", "ru"); // язык отчёта — на корне страницы
  await expect(main.getByRole("heading", { name: "Отчёт об успехах" })).toBeVisible();
  await expect(main.getByText("Ученик", { exact: true })).toBeVisible();
  await expect(main.getByText("Айдана")).toHaveCount(0);
  await expect(main.getByText("345")).toBeVisible(); // XP
  await expect(main.getByText("Дней с занятиями: 2 из 7")).toBeVisible();
  await expect(main.getByText("Время занятий: 35 мин")).toBeVisible();
  await expect(main.getByText("Точность ответов: 81%")).toBeVisible(); // (7 + 6) / 16
  await expect(main.getByRole("heading", { name: "Прогноз балла по информатике" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Освоение тем ЕНТ" })).toBeVisible();
  await expect(main.getByText("нет данных").first()).toBeVisible(); // темы без собственных данных не выглядят освоенными
  await expect(main.getByText("9 из 19")).toBeVisible(); // пробник
  await expect(main.getByText("Данные — только в этой ссылке, у нас они не хранятся.")).toBeVisible();
  expect(await overflow(rp)).toBeLessThanOrEqual(0);

  // Переключатель языка на странице
  await main.getByRole("button", { name: "Қазақша" }).click();
  await expect(main.getByRole("heading", { name: "Үлгерім туралы есеп" })).toBeVisible();
  await expect(main).toHaveAttribute("lang", "kk");
  await main.getByRole("button", { name: "Русский" }).click();
  await expect(main.getByRole("heading", { name: "Отчёт об успехах" })).toBeVisible();
  await expect(main).toHaveAttribute("lang", "ru");

  // Кнопка «Узнать об Informatica» → главная (у нового устройства — онбординг), но сама ссылка не ушла на сервер
  await expect(main.getByRole("link", { name: "Узнать об Informatica" })).toHaveAttribute("href", "/");
  // На чистом устройстве отчёт не создал сохранений ученика
  expect((await rp.evaluate(() => localStorage.getItem("informatica-v1"))) ?? "").not.toContain('"onboarded":true');

  expect(errors).toEqual([]);
  expect(rErrors).toEqual([]);
  await fresh.context.close();
});

test("отчёт: «Показать имя» добавляет имя; язык отчёта — язык ученика, можно сменить; ссылка пересобирается", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { lang: "kk" });
  await page.goto("/profile");
  await page.getByRole("button", { name: /Ата-аналарға арналған есеп/ }).click();
  const dialog = page.getByRole("dialog", { name: "Ата-аналарға арналған есеп" });
  const view = dialog.getByRole("link", { name: "Есепті қарау" });
  await expect(view).toBeVisible();
  const hrefKk = await view.getAttribute("href");

  // Имя включаем — ссылка меняется
  await dialog.getByRole("switch", { name: "Атыңды көрсету" }).click();
  await expect.poll(async () => dialog.getByRole("link", { name: "Есепті қарау" }).getAttribute("href")).not.toBe(hrefKk);
  const hrefName = await dialog.getByRole("link", { name: "Есепті қарау" }).getAttribute("href");

  const fresh = await cleanDevice(browser);
  await fresh.page.goto(hrefName!.replace(/&me=1$/, ""));
  const main = fresh.page.locator("main");
  await expect(main.getByRole("heading", { name: "Үлгерім туралы есеп" })).toBeVisible(); // язык ученика — казахский
  await expect(main.getByText("Айдана")).toBeVisible();
  expect(await overflow(fresh.page)).toBeLessThanOrEqual(0);

  // Язык отчёта в окне — русский → отчёт открывается по-русски, имя осталось
  await dialog.getByRole("button", { name: "Русский" }).click();
  await expect.poll(async () => dialog.getByRole("link").first().getAttribute("href")).not.toBe(hrefName);
  const hrefRu = await dialog.getByRole("link").first().getAttribute("href");
  await fresh.page.goto(hrefRu!.replace(/&me=1$/, ""));
  await expect(fresh.page.locator("main").getByRole("heading", { name: "Отчёт об успехах" })).toBeVisible();
  await expect(fresh.page.locator("main").getByText("Айдана")).toBeVisible();
  await fresh.context.close();

  // Снова открыть окно — имя снова выключено (не «залипает»)
  await dialog.getByRole("button", { name: "Жабу" }).last().click();
  await page.getByRole("button", { name: /Ата-аналарға арналған есеп/ }).click();
  await expect(page.getByRole("dialog").getByRole("switch", { name: "Атыңды көрсету" })).toHaveAttribute("aria-checked", "false");
});

test("отчёт: без имени в профиле переключателя нет; повреждённая и пустая ссылки — понятные карточки", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { name: "" });
  const dialog = await openSheet(page);
  await expect(dialog.getByRole("switch")).toHaveCount(0);

  const fresh = await cleanDevice(browser);
  const rp = fresh.page;
  await rp.goto("/report#d=zAAAA");
  await expect(rp.getByText("Ссылка повреждена", { exact: true })).toBeVisible();
  await expect(rp.getByRole("link", { name: "Узнать об Informatica" })).toBeVisible();
  await rp.goto("/report");
  await expect(rp.getByText(/нет данных отчёта/)).toBeVisible();
  await expect(rp.getByText(/Откройте ссылку целиком/)).toBeVisible(); // к родителю — на «вы»
  expect(await overflow(rp)).toBeLessThanOrEqual(0);

  // Метаданные: не индексируется, адрес дальше не передаётся
  expect(await rp.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
  expect(await rp.locator('meta[name="referrer"]').getAttribute("content")).toBe("no-referrer");
  await fresh.context.close();
});
