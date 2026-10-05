import { expect, test, type Page } from "@playwright/test";

// Этап 11 (v0.10): сердечки — плата за вход, а не за ошибки (#40); незаконченный урок можно продолжить (#41).
// Этап 15 (F2): вход списывается, когда урок начался (первое «Продолжить» или первый ответ), а не только при ответе;
// теория урока (`/theory/<id>`) стоит 0,5. Этап 16В: бесплатной тренировки нет — при нуле сердечек путь: ждать, купить за чипы, «Безлимит».
// Урок ns-1-bits: 0 история → 1 теория → 2 песочница (цель: 5 ламп) → 3 теория → 4 задание «1 бит» (верно «2», вариант «1» — ошибка)
// → 5 теория → 6 задание «3 лампочки» (верно «8», вариант «3» — ошибка).

async function seed(page: Page, hearts = 5, extra: Record<string, unknown> = {}) {
  await page.goto("/onboarding");
  await page.evaluate(
    ([n, more]) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "dark", sound: false, createdAt: 1 },
            // Восстановление идёт от updatedAt: ставим «сейчас», чтобы сердечки не вернулись сами за время теста.
            hearts: { count: n, updatedAt: Date.now(), day: "" },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            // Проводник первого входа (#104) уже пройден — не закрывает экран.
            tips: { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1 },
            ...(more as Record<string, unknown>),
          },
          version: 2,
        }),
      ),
    [hearts, extra] as const,
  );
}

/** Сердечки в сохранении (стор пишет в localStorage сразу). */
const savedHearts = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("informatica-v1") ?? "{}").state?.hearts?.count);

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const hearts = (page: Page, n: number) => page.getByLabel(`Сердечки: ${n}`);
/** Главная кнопка нижней панели: «Проверить» / «Продолжить». */
const footerButton = (page: Page) => page.locator("footer button").last();

/** От первого шага до первого задания: история, теория, песочница, теория. Первое «Продолжить» — урок начался, вход оплачен. */
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

/** То же, когда история уже пройдена (первое «Продолжить» нажато): теория, песочница, теория. */
async function toFirstQuestionFromTheory(page: Page) {
  const next = footerButton(page);
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

test("урок: вход списывается, когда урок начался (первое «Продолжить»), ошибки сердечки не снимают", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/lesson/ns-1-bits");
  // Открыл урок — пока бесплатно.
  await expect(hearts(page, 5)).toBeVisible();

  // Первое «Продолжить» на истории — урок начался: 5 → 4. Дальше теория и песочница ничего не стоят.
  await footerButton(page).click();
  await expect(hearts(page, 4)).toBeVisible();
  await toFirstQuestionFromTheory(page);
  await expect(hearts(page, 4)).toBeVisible();

  // Первый ответ (даже неверный) вход повторно не списывает.
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

  // Последнее сердечко уходит на вход (первое «Продолжить») — урок идёт до конца без окон «Сердечки закончились».
  await expect(hearts(page, 0)).toBeVisible();
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
  await toFirstQuestion(page); // первое «Продолжить» снова стоит сердечко
  await expect(hearts(page, 3)).toBeVisible();
  await answer(page, "2");
  await expect(hearts(page, 3)).toBeVisible();
  expect(errors).toEqual([]);
});

test("урок: открыл и сразу вышел — сердечко не списывается", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/lesson/ns-1-bits");
  await expect(page.getByText("Побег из компьютера")).toBeVisible();
  await page.getByRole("button", { name: "Выйти" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Выйти" }).click();
  await page.waitForURL("**/learn");
  expect(await savedHearts(page)).toBe(5);
  expect(errors).toEqual([]);
});

test("урок: сердечек нет — на входе «Сердечки закончились»: время до следующего, купить за чипы, «Безлимит»; бесплатной тренировки нет", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, 0);
  await page.goto("/lesson/ns-1-bits");
  await expect(page.getByRole("heading", { name: "Сердечки закончились" })).toBeVisible();
  await expect(page.getByText(/Следующее сердечко через/)).toBeVisible();
  await expect(page.getByRole("button", { name: /\+1 сердечко/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Безлимит/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Тренировка вернёт сердечко/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Тренировка — бесплатно" })).toHaveCount(0);
  await expect(page.getByText("Пока почитай теорию урока")).toHaveCount(0);
  // Урок не открылся.
  await expect(page.locator("footer")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("тренировка стоит сердечко: сердечек нет — на входе «Сердечки закончились», тренировка не открылась", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, 0);
  await page.goto("/drill?mode=skill&skill=ns.dec2bin");
  await expect(page.getByRole("heading", { name: "Сердечки закончились" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Безлимит/ })).toBeVisible();
  // Задание не показано, плеера нет.
  await expect(page.locator("footer")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("тренировка: открыл и закрыл — бесплатно, сердечки в плеере видны, возврата за тренировку нет", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, 3);
  await page.goto("/drill?mode=skill&skill=ns.dec2bin");
  // Вход спишется при первом ответе (как у урока): пока 3.
  await expect(hearts(page, 3)).toBeVisible();
  await page.getByRole("button", { name: "Выйти" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Выйти" }).click();
  await page.waitForURL("**/practice");
  expect(await savedHearts(page)).toBe(3);
  expect(errors).toEqual([]);
});

// ---------- Теория урока за 0,5 (этап 15, F2.3) ----------

/** Сердечки в шапке приложения (кнопка-ссылка в магазин): «Сердечки: 4,5. Открыть магазин». */
const headerHearts = (page: Page, n: string) => page.getByLabel(`Сердечки: ${n}. Открыть магазин`).first();

test("теория: первый экран бесплатный, прокрутка списывает 0,5, повторное чтение в течение суток — бесплатно", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/theory/ns-1-bits");
  await expect(page.getByText(/Чтение стоит 0,5/)).toBeVisible();
  await expect(headerHearts(page, "5")).toBeVisible();

  // Листает дальше первого экрана — 5 → 4,5; запятая и в шапке, и в записи.
  await page.mouse.wheel(0, 2500);
  await expect(headerHearts(page, "4,5")).toBeVisible();
  await expect(page.getByText(/Конспект оплачен/)).toBeVisible();
  expect(await savedHearts(page)).toBe(4.5);

  // Повторное чтение: снова листаем — ничего не списывается.
  await page.reload();
  await expect(page.getByText(/Конспект оплачен/)).toBeVisible();
  await page.mouse.wheel(0, 2500);
  await expect(headerHearts(page, "4,5")).toBeVisible();
  expect(await savedHearts(page)).toBe(4.5);
  expect(errors).toEqual([]);
});

test("теория: пройденный урок читается бесплатно", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, 5, { lessons: { "ns-1-bits": { completions: 1, bestAccuracy: 1, lastAt: Date.now(), totalXp: 20 } } });
  await page.goto("/theory/ns-1-bits");
  await expect(page.getByText("Урок пройден — читать бесплатно")).toBeVisible();
  await page.mouse.wheel(0, 2500);
  await expect(headerHearts(page, "5")).toBeVisible();
  expect(await savedHearts(page)).toBe(5);
  expect(errors).toEqual([]);
});

test("теория: сердечек нет — дальше первого экрана замок и окно «Сердечки закончились»", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, 0);
  await page.goto("/theory/ns-1-bits");
  await expect(page.getByText(/Чтение стоит 0,5/)).toBeVisible(); // страница показана — можно листать
  await page.mouse.wheel(0, 2500);
  const sheet = page.getByRole("dialog", { name: "Сердечки закончились" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(/Чтение конспекта стоит 0,5/)).toBeVisible();
  await sheet.getByRole("button", { name: "Выйти" }).click();
  await page.waitForURL("**/theory");
  expect(await savedHearts(page)).toBe(0);
  expect(errors).toEqual([]);
});
