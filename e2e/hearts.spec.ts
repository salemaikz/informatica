import { expect, test, type Page } from "@playwright/test";

// Этап 11 (v0.10): сердечки — плата за вход, а не за ошибки (#40); незаконченный урок можно продолжить (#41).
// Урок ns-1-bits: 0 история → 1 теория → 2 песочница (цель: 5 ламп) → 3 теория → 4 задание «1 бит» (верно «2», вариант «1» — ошибка)
// → 5 теория → 6 задание «3 лампочки» (верно «8», вариант «3» — ошибка).

async function seed(page: Page, hearts = 5) {
  await page.goto("/onboarding");
  await page.evaluate(
    (n) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "dark", sound: false, createdAt: 1 },
            // Восстановление идёт от updatedAt: ставим «сейчас», чтобы сердечки не вернулись сами за время теста.
            hearts: { count: n, updatedAt: Date.now(), day: "" },
            paywall: { lastShownAt: 4102444800000, views: 1 },
          },
          version: 2,
        }),
      ),
    hearts,
  );
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const hearts = (page: Page, n: number) => page.getByLabel(`Сердечки: ${n}`);
/** Главная кнопка нижней панели: «Проверить» / «Продолжить». */
const footerButton = (page: Page) => page.locator("footer button").last();

/** От первого шага до первого задания: история, теория, песочница, теория — всё это бесплатно. */
async function toFirstQuestion(page: Page) {
  const next = footerButton(page);
  await next.click(); // история → теория
  await next.click(); // теория → песочница
  await expect(next).toBeDisabled();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Добавить лампу" }).click();
  await expect(page.getByText("Получилось!")).toBeVisible();
  await next.click(); // песочница → теория
  await next.click(); // теория → первое задание
  await expect(page.getByRole("button", { name: "Проверить" })).toBeVisible();
}

async function answer(page: Page, option: string) {
  await page.getByRole("button", { name: option, exact: true }).click();
  await page.getByRole("button", { name: "Проверить" }).click();
}

test("урок: вход списывается при первом ответе, ошибки сердечки не снимают", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/lesson/ns-1-bits");
  await expect(hearts(page, 5)).toBeVisible();

  // История, теория и песочница — бесплатно.
  await toFirstQuestion(page);
  await expect(hearts(page, 5)).toBeVisible();

  // Первый ответ (даже неверный) стоит сердечко: 5 → 4.
  await answer(page, "1");
  await expect(page.getByText("Неверно")).toBeVisible();
  await expect(hearts(page, 4)).toBeVisible();

  // Дальше ошибки ничего не снимают.
  await footerButton(page).click(); // → теория
  await footerButton(page).click(); // → второе задание
  await answer(page, "3");
  await expect(page.getByText("Неверно")).toBeVisible();
  await expect(hearts(page, 4)).toBeVisible();
  expect(errors).toEqual([]);
});

test("урок: последнее сердечко уходит на вход — дальше урок не блокируется", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, 1);
  await page.goto("/lesson/ns-1-bits");
  await toFirstQuestion(page);

  // Последнее сердечко уходит на вход — урок идёт до конца без окон «Сердечки закончились».
  await answer(page, "2");
  await expect(hearts(page, 0)).toBeVisible();
  await footerButton(page).click(); // → теория
  await footerButton(page).click(); // → второе задание
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await answer(page, "3");
  await expect(page.getByText("Неверно")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("урок: выйти посреди урока и вернуться — «Продолжить» с того же шага, «Начать заново» стоит снова", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/lesson/ns-1-bits");
  await toFirstQuestion(page);
  await answer(page, "2");
  await expect(hearts(page, 4)).toBeVisible();
  await footerButton(page).click(); // → теория (шаг сохранён)

  // Окно выхода обещает сохранение и напоминает про окно без повторной платы.
  await page.getByRole("button", { name: "Выйти" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Прогресс сохранится — урок можно продолжить позже.")).toBeVisible();
  await expect(dialog.getByText(/Вернуться в течение \d+ минут — бесплатно/)).toBeVisible();
  await dialog.getByRole("button", { name: "Выйти" }).click();
  await page.waitForURL("**/learn");

  // Возвращаемся: экран «Урок не закончен», шаг сохранён, продолжение бесплатно (вход уже оплачен).
  await page.goto("/lesson/ns-1-bits");
  await expect(page.getByRole("heading", { name: "Урок не закончен" })).toBeVisible();
  await expect(page.getByText(/^Шаг 6 из \d+$/)).toBeVisible();
  const resume = page.getByRole("button", { name: /Продолжить/ });
  const restart = page.getByRole("button", { name: /Начать заново/ });
  await expect(resume.getByRole("img")).toHaveCount(0);
  await expect(restart.getByRole("img", { name: "Цена входа в сердечках: 1" })).toBeVisible();
  await expect(page.getByText("Сохранённый прогресс урока сбросится")).toBeVisible();

  await resume.click();
  await expect(page.getByRole("heading", { name: "Урок не закончен" })).toHaveCount(0);
  await expect(hearts(page, 4)).toBeVisible();
  // Ответ после продолжения вход повторно не списывает.
  await footerButton(page).click(); // теория → второе задание
  await answer(page, "3");
  await expect(page.getByText("Неверно")).toBeVisible();
  await expect(hearts(page, 4)).toBeVisible();

  // Перезагрузка страницы в течение 20 минут — снова «Продолжить» без повторного списания.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Урок не закончен" })).toBeVisible();
  await expect(hearts(page, 4)).toBeVisible();
  await expect(page.getByRole("button", { name: /Продолжить/ }).getByRole("img")).toHaveCount(0);

  // «Начать заново»: сохранение сбрасывается, урок с первого шага, а первый ответ снова стоит сердечко.
  await page.getByRole("button", { name: /Начать заново/ }).click();
  await expect(page.getByText("Побег из компьютера")).toBeVisible();
  await expect(hearts(page, 4)).toBeVisible();
  await toFirstQuestion(page);
  await answer(page, "2");
  await expect(hearts(page, 3)).toBeVisible();
  expect(errors).toEqual([]);
});

test("урок: сердечек нет — на входе «Сердечки закончились», теорию можно читать", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, 0);
  await page.goto("/lesson/ns-1-bits");
  await expect(page.getByRole("heading", { name: "Сердечки закончились" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Пока почитай теорию урока" })).toBeVisible();
  // Урок не открылся.
  await expect(page.locator("footer")).toHaveCount(0);
  expect(errors).toEqual([]);
});
