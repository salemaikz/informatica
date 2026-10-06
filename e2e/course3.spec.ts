import { expect, test, type Page } from "@playwright/test";

// Этап 14 (P2): узлы «Практика» и «Повторение» на карте курса, мини-тест группы (#81).
// Группа «Ветвления» (раздел «Python»): после неё — узел «Практика» (12 заданий), в конце раздела — «Повторение».
// Мини-тест стоит 1 сердечко по «Начать» (как «Проверить себя»); практика и повторение — тоже 1 сердечко, списывается при открытии
// (этап 16В: бесплатной тренировки нет; этап 16Г, #120: при входе). Без обращений к ИИ.

const NODE_ID = "practice:py-2a-if";

async function seed(page: Page, hearts = 5, theme: "light" | "dark" = "light") {
  await page.goto("/onboarding");
  await page.evaluate(
    ([n, th]) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: th, sound: false, createdAt: 1 },
            // Восстановление идёт от updatedAt: ставим «сейчас», чтобы сердечки не вернулись сами за время теста.
            hearts: { count: n, updatedAt: Date.now(), day: "" },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            // Проводник первого входа (#104) уже пройден — не закрывает экран.
            tips: { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1, "page-shop": 1, "page-profile": 1 },
          },
          version: 2,
        }),
      ),
    [hearts, theme] as const,
  );
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const hearts = (page: Page, n: number) => page.getByLabel(`Сердечки: ${n}`);
const practiceNode = (page: Page) => page.getByRole("button", { name: /^Практика: Ветвления/ });
const results = (page: Page) => page.getByRole("heading", { level: 1, name: "Тренировка завершена!" });

/** Отвечает на текущее задание чем попало: ввод — «0», варианты — по очереди, пока не станет доступна «Проверить»; «пары» — перебором. */
async function answerAny(page: Page) {
  const main = page.locator("main");
  const check = page.getByRole("button", { name: "Проверить", exact: true });
  if (await main.locator("input").count()) {
    await main.locator("input").first().fill("0");
    return;
  }
  // «Соответствие» ЕНТ: у каждого пункта (radiogroup) — первый номер.
  const groups = main.getByRole("radiogroup");
  const g = await groups.count();
  if (g) {
    for (let i = 0; i < g; i++) await groups.nth(i).getByRole("radio").first().click();
    return;
  }
  const options = main.locator("button[aria-pressed]");
  const n = await options.count();
  if (n) {
    // single/multi — хватит первого варианта; «соответствие» — по одному номеру у каждого пункта.
    for (let i = 0; i < n && !(await check.isEnabled()); i++) await options.nth(i).click();
    return;
  }
  // «Соединить пары»: две колонки плиток; верная пара гасит левую плитку, шаг сдаётся сам.
  const columns = main.locator(".grid.grid-cols-2 > div");
  const free = (side: number) => columns.nth(side).locator("button:not([disabled])");
  for (let guard = 0; guard < 40 && (await free(0).count()) > 0; guard++) {
    const left = await free(0).count();
    const right = await free(1).count();
    for (let r = 0; r < right && (await free(0).count()) === left; r++) {
      await free(0).first().click();
      await free(1).nth(r).click();
    }
  }
}

/** Проходит сессию до итогов; возвращает, сколько шагов (с повторами ошибок) пройдено. */
async function playThrough(page: Page, max = 60, beforeAnswer?: () => Promise<void>) {
  const check = page.getByRole("button", { name: "Проверить", exact: true });
  const next = page.getByRole("button", { name: "Продолжить", exact: true });
  for (let i = 0; i < max; i++) {
    await expect(check.or(next).or(results(page)).first()).toBeVisible();
    if (await results(page).isVisible()) return i;
    if (!(await next.isVisible())) {
      await beforeAnswer?.();
      await answerAny(page);
      if (await check.isVisible()) await check.click();
    }
    await expect(next).toBeVisible();
    await next.click();
  }
  throw new Error("сессия не закончилась");
}

test("карта: узел «Практика» после группы «Ветвления» — лист, 12 заданий, узел становится пройденным", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/learn");

  const node = practiceNode(page);
  await expect(node).toBeVisible();
  await expect(node).toHaveAttribute("aria-label", "Практика: Ветвления, пока не пройдено");
  // Узел не мельче 44 px (как урок): появляется «выпрыгиванием» только когда попал в экран — прокручиваем и ждём.
  await node.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await node.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await expect.poll(async () => (await node.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await node.click();
  const sheet = page.getByRole("dialog", { name: "Практика: Ветвления" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("12 заданий: эта тема, прошлые темы и начало курса.")).toBeVisible();
  // Цена тренировки видна на кнопке (этап 16В).
  await expect(sheet.getByRole("link", { name: "Начать практику" }).getByRole("img", { name: /Цена входа в сердечках: 1/ })).toBeVisible();
  await expect(sheet.getByText("Пока не пройдено")).toBeVisible();
  await expect(sheet.getByRole("link", { name: /Мини-тест/ })).toHaveAttribute("href", `/drill?mode=minitest&node=${NODE_ID}`);

  await sheet.getByRole("link", { name: "Начать практику" }).click();
  await page.waitForURL("**/drill?mode=practice**");
  await expect(page.getByRole("button", { name: "Проверить", exact: true })).toBeVisible();
  // Практика стоит сердечко (этап 16В), списано сразу при входе (этап 16Г, #120): в шапке плеера 4.
  await expect(hearts(page, 4)).toBeVisible();

  await playThrough(page);
  // Заданий — 12 (первые попытки; ошибки показываются ещё раз в «работе над ошибками»).
  await expect(page.getByText(/без подсказки: \d+ из 12/)).toBeVisible();

  const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem("informatica-v1")!).state.courseNodes?.[id], NODE_ID);
  expect(saved.runs).toBe(1);
  // Вход списан один раз (при открытии), возврата сердечка за тренировку нет: было 5, стало 4.
  const heartsLeft = await page.evaluate(() => JSON.parse(localStorage.getItem("informatica-v1")!).state.hearts.count);
  expect(heartsLeft).toBe(4);

  // «Продолжить» на итогах ведёт на карту (практика начинается с карты): узел пройден.
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.waitForURL("**/learn");
  await expect(practiceNode(page)).toHaveAttribute("aria-label", /Практика: Ветвления, пройдено 1 раз/);
  expect(errors).toEqual([]);
});

test("мини-тест: открывается из листа практики, экран старта и списание сердечка на «Начать»", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, 5, "dark");
  await page.goto("/learn");
  await practiceNode(page).click();
  const sheet = page.getByRole("dialog", { name: "Практика: Ветвления" });
  await expect(sheet.getByText(/6 заданий в формате ЕНТ/)).toBeVisible();
  await sheet.getByRole("link", { name: /Мини-тест/ }).click();
  await page.waitForURL("**/drill?mode=minitest**");

  // Экран старта: число заданий и цена входа; пока не нажата «Начать» — ничего не списано.
  await expect(page.getByText("Заданий: 6")).toBeVisible();
  await expect(hearts(page, 5)).toBeVisible();
  await expect(page.getByRole("button", { name: "Начать" }).getByRole("img", { name: /Цена входа в сердечках: 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Начать" }).click();

  // После «Начать»: плеер со счётчиком 4, первое задание открыто, второго списания при ответе нет.
  await expect(hearts(page, 4)).toBeVisible();
  await expect(page.locator("main button[aria-pressed]").first()).toBeVisible();
  await page.locator("main button[aria-pressed]").first().click();
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await expect(hearts(page, 4)).toBeVisible();
  // Выход: окно предупреждает, что плата за вход уже списана.
  await page.getByRole("button", { name: "Выйти" }).first().click();
  await expect(page.getByText(/Плата за вход уже списана/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("мини-тест: итог — баллы как на ЕНТ, слабое место, «Продолжить» ведёт на карту", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, 5);
  await page.goto(`/drill?mode=minitest&node=${NODE_ID}`);
  await page.getByRole("button", { name: "Начать" }).click();
  await expect(page.locator("main button[aria-pressed]").first()).toBeVisible();
  // В тесте до ответа нет подсказки и «Спросить Бита» (как на ЕНТ).
  await expect(page.getByRole("button", { name: /Подсказка/ })).toHaveCount(0);
  const steps = await playThrough(page, 20);
  // Ошибки в тесте не повторяются в конце: ровно 6 заданий.
  expect(steps).toBe(6);
  // Все шесть заданий — первые ответы «первым вариантом»: баллы считаются из 8 (4 + 2 + 2).
  await expect(page.getByText(/^Баллы как на ЕНТ: \d+ из 8$/)).toBeVisible();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.waitForURL("**/learn");
  const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem("informatica-v1")!).state.courseNodes?.[id], NODE_ID);
  expect(saved.testRuns).toBe(1);
  expect(errors).toEqual([]);
});

test("карта: в конце раздела «Python» — узел «Повторение», лист ведёт на 15 заданий", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/learn");
  const recap = page.getByRole("button", { name: /^Повторение: Python и алгоритмы/ });
  await expect(recap).toBeVisible();
  await recap.click();
  const sheet = page.getByRole("dialog", { name: /^Повторение: / });
  await expect(sheet.getByText(/15 заданий: весь раздел/)).toBeVisible();
  // Мини-теста у повторения нет.
  await expect(sheet.getByRole("link", { name: /Мини-тест/ })).toHaveCount(0);
  await expect(sheet.getByRole("link", { name: "Начать повторение" })).toHaveAttribute("href", "/drill?mode=recap&unit=u3");
  await sheet.getByRole("link", { name: "Начать повторение" }).click();
  await page.waitForURL("**/drill?mode=recap**");
  await expect(page.getByRole("button", { name: "Проверить", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
