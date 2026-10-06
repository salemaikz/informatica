import { expect, test, type Page } from "@playwright/test";

// v0.8: навигация из четырёх групп с подразделами (ИИ-чат — плавающая кнопка Бита, этап 16В), хаб «Материалы», магазин со строкой сердечек,
// страница плана подготовки и «Тест по разделу» на карте курса.

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Дата «ГГГГ-ММ-ДД» через n дней от сегодня (по местному времени, как считает приложение). */
function dayKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function seed(page: Page, profile: Record<string, unknown> = {}) {
  await page.goto("/onboarding");
  await page.evaluate(
    (extra) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "dark", sound: false, createdAt: 1, ...extra },
            lessons: { "ns-1-bits": { completions: 1, bestAccuracy: 1, lastAt: 1, totalXp: 100 } },
            // Окно тарифов уже показано — не всплывает в автотестах.
            paywall: { lastShownAt: 4102444800000, views: 1 },
            // Проводник первого входа (#104) уже пройден — не закрывает экран.
            tips: { welcome: 1, "lesson-first": 1, "lesson-icons": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1, "page-shop": 1, "page-profile": 1 },
          },
          version: 2,
        }),
      ),
    profile,
  );
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

test("нижняя панель: четыре группы (без ИИ-чата), каждая открывается", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/learn");
  const bottom = page.getByRole("navigation", { name: "Главное меню" });
  await expect(bottom.getByRole("link")).toHaveCount(4);
  for (const name of ["Учиться", "Практика", "Материалы", "Прогресс"]) {
    await expect(bottom.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(bottom.getByRole("link", { name: "ИИ-чат" })).toHaveCount(0);

  const groups: [string, RegExp][] = [
    ["Практика", /\/practice$/],
    ["Материалы", /\/materials$/],
    ["Прогресс", /\/stats$/],
    ["Учиться", /\/learn$/],
  ];
  for (const [name, url] of groups) {
    await bottom.getByRole("link", { name, exact: true }).click();
    await expect(page, name).toHaveURL(url);
    await expect(bottom.getByRole("link", { name, exact: true }), name).toHaveAttribute("aria-current", "page");
    await expect(page.locator("main").getByRole("heading").first(), name).toBeVisible();
  }
  // В шапке нет ни поиска, ни аватара.
  await expect(page.locator("header").getByRole("link", { name: "Поиск" })).toHaveCount(0);
  await expect(page.locator("header img")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("подразделы «Практики»: Пробный ЕНТ и Практикум кода", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/practice");
  const tabs = page.getByRole("navigation", { name: "Подразделы" });
  await expect(tabs.getByRole("link")).toHaveCount(4);
  await expect(tabs.getByRole("link", { name: "Тренировка" })).toHaveAttribute("aria-current", "page");

  await tabs.getByRole("link", { name: "Пробный ЕНТ" }).click();
  await expect(page).toHaveURL(/\/exam$/);
  await expect(tabs.getByRole("link", { name: "Пробный ЕНТ" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await tabs.getByRole("link", { name: "Практикум кода" }).click();
  await expect(page).toHaveURL(/\/code$/);
  await expect(tabs.getByRole("link", { name: "Практикум кода" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await tabs.getByRole("link", { name: "Тренировка" }).click();
  await expect(page).toHaveURL(/\/practice$/);
  expect(errors).toEqual([]);
});

test("«Материалы»: карточки Конспекты, Теория, Шпаргалка, Поиск", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);

  // Карточки различаем по описанию: таблетки подразделов над ними называются так же, но без описания.
  const cards = {
    notes: /Заметок: \d+/,
    theory: /Справочник по всем темам/,
    cheat: /Единицы, степени двойки/,
    search: /Найти тему, урок или термин/,
  };

  await page.goto("/materials");
  await expect(page.getByRole("heading", { name: "Материалы" })).toBeVisible();
  for (const [key, re] of Object.entries(cards)) {
    await expect(page.locator("main").getByText(re), key).toBeVisible();
  }

  await page.locator("main").getByRole("link", { name: cards.notes }).click();
  await expect(page).toHaveURL(/\/notes$/);

  await page.goto("/materials");
  await page.locator("main").getByRole("link", { name: cards.theory }).click();
  await expect(page).toHaveURL(/\/theory$/);

  await page.goto("/materials");
  await page.locator("main").getByRole("link", { name: cards.search }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByPlaceholder("Тема или слово…")).toBeVisible();

  // «Шпаргалка» не страница: открывает панель «Инструменты» сразу на вкладке шпаргалки.
  await page.goto("/materials");
  await page.locator("main").getByRole("button", { name: cards.cheat }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "Шпаргалка" })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("group", { name: "Разделы шпаргалки" })).toBeVisible();
  await expect(page).toHaveURL(/\/materials$/);
  expect(errors).toEqual([]);
});

test("магазин: строка сердечек «5 из 5», карточки баланса нет", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/shop");
  await expect(page.getByRole("heading", { name: "Магазин" })).toBeVisible();
  const status = page.getByRole("group", { name: "Сердечки и бустер опыта" });
  await expect(status).toBeVisible();
  await expect(status).toContainText("5 из 5");
  await expect(page.getByText("Твой баланс")).toHaveCount(0);
  // Полный запас — недоступен, пока запас полный; сердечко тратится на вход, а не за ошибку.
  await expect(page.getByRole("button", { name: "Купить: Полный запас" })).toBeDisabled();
  await expect(page.getByText("Запас полный").first()).toBeVisible();
  await expect(page.getByText(/Сердечко тратится на вход в урок, тренировку, тест или игру/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Как работают сердечки" })).toBeVisible();
  await expect(page.getByText(/за ошибку в уроке/)).toHaveCount(0);
  // Чипы остались в шапке и ведут в магазин.
  await expect(page.getByLabel(/^Чипы: \d+\. Открыть магазин/).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("план подготовки: недели до даты ЕНТ и карточка на главной", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, { examDate: dayKey(70) });

  // Карточка плана на карте курса ведёт на страницу плана.
  await page.goto("/learn");
  const card = page.getByRole("link", { name: /Неделя 1 из \d+/ });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("href", "/plan");
  await card.click();
  await expect(page).toHaveURL(/\/plan$/);

  await expect(page.getByRole("heading", { name: "План подготовки" })).toBeVisible();
  await expect(page.getByText(/^До ЕНТ /)).toBeVisible();
  const weeks = page.getByRole("button", { name: /^Неделя \d+, / });
  // 70 дней от сегодняшнего дня включительно — 11 недель.
  expect(await weeks.count()).toBeGreaterThanOrEqual(10);
  // Текущая неделя раскрыта, остальные свёрнуты; раскрытие по нажатию работает.
  await expect(weeks.first()).toHaveAttribute("aria-expanded", "true");
  await expect(weeks.nth(1)).toHaveAttribute("aria-expanded", "false");
  await weeks.nth(1).click();
  await expect(weeks.nth(1)).toHaveAttribute("aria-expanded", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  // Назад — на карту курса.
  await page.getByRole("link", { name: "К карте курса" }).click();
  await expect(page).toHaveURL(/\/learn$/);
  expect(errors).toEqual([]);
});

test("тест по разделу на карте: шторка и запуск", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/learn");
  const node = page.getByRole("button", { name: /^Тест по разделу/ }).first();
  await node.scrollIntoViewIfNeeded();
  // Банк заданий подгружается отдельным куском — пока он грузится, узел недоступен.
  await expect(node).toBeEnabled();
  await expect(node).toHaveAttribute("aria-haspopup", "dialog");
  await node.click();

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: /^Тест по разделу: / })).toBeVisible();
  await expect(sheet.getByText(/Заданий: \d+/)).toBeVisible();
  // Тест по разделу стоит 2 сердечка (#40): значок цены в шторке.
  await expect(sheet.getByRole("img", { name: /Цена входа в сердечках: 1/ })).toBeVisible();
  await sheet.getByRole("button", { name: "Начать" }).click();

  await page.waitForURL(/\/exam\/run\?.*kind=unit/);
  await expect(page.getByRole("heading", { name: /^Тест по разделу: / })).toBeVisible();
  // В тесте по разделу до 20 заданий (если в банке меньше — столько, сколько есть).
  const pill = page.getByText(/^Заданий: \d+$/);
  await expect(pill).toBeVisible();
  const n = Number((await pill.textContent())!.match(/\d+/)![0]);
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThanOrEqual(20);
  await expect(page.getByRole("button", { name: "Начать" }).getByRole("img", { name: /Цена входа в сердечках: 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Начать" }).click();
  await expect(page.getByText("Задание 1").first()).toBeVisible();
  // Списана ровно одна цена входа (тест по разделу — 1 сердечко, #120): было 5, стало 4.
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("informatica-v1") ?? "{}").state?.hearts?.count))
    .toBe(4);
  expect(errors).toEqual([]);
});
