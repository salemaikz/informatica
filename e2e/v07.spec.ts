import { expect, test, type Locator, type Page } from "@playwright/test";

// v0.7: Практикум (/code: Excel, HTML/CSS, JavaScript), чаты с Битом 2.0 (список, «Дай задачи», меню чата), настройка «Старт».
// Без вызовов OpenAI и без Pyodide / sql.js (грузятся с CDN): Python и SQL здесь не запускаем.

async function seed(page: Page, extra: Record<string, unknown> = {}) {
  await page.goto("/onboarding");
  await page.evaluate(
    (more) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "dark", sound: false, createdAt: 1 },
            lessons: { "ns-1-bits": { completions: 1, bestAccuracy: 1, lastAt: 1, totalXp: 100 } },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            // Проводник первого входа (#104) уже пройден — не закрывает экран.
            tips: { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1, "page-shop": 1, "page-profile": 1 },
            ...more,
          },
          version: 2,
        }),
      ),
    extra,
  );
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Заменить весь код в редакторе CodeMirror (фокус → Ctrl+A → вставка текста одним куском). */
async function setEditorCode(page: Page, editorLabel: string, code: string) {
  const editor = page.getByRole("textbox", { name: editorLabel });
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(code);
}

// ---------- 1. Практикум: хаб и Excel ----------

test("/code: хаб с языками, Excel — ошибка, затем верная формула в E1", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/code");
  await expect(page.getByRole("heading", { name: "Практикум", level: 1 })).toBeVisible();

  // Карточки языков (в реестре их пять) — ссылки на /code/<язык>.
  const langs: [string, string][] = [
    ["python", "Python"],
    ["sql", "SQL"],
    ["web", "HTML и CSS"],
    ["js", "JavaScript"],
    ["excel", "Excel"],
  ];
  for (const [id, title] of langs) {
    const card = page.locator(`main a[href="/code/${id}"]`);
    await expect(card, id).toBeVisible();
    await expect(card, id).toContainText(title);
  }
  // Работа с Excel: «Продолжить/Начни» ведёт на первую задачу — отдельная ссылка, не путаем с карточкой.
  await page.locator('main a[href="/code/excel"]').click();
  await page.waitForURL("**/code/excel");
  await expect(page.getByRole("heading", { name: "Excel", level: 1 })).toBeVisible();

  await page.locator('main a[href="/code/excel/xl-1-sum"]').click();
  await page.waitForURL("**/code/excel/xl-1-sum");
  await expect(page.getByText("Сумма чисел в строке").first()).toBeVisible();

  // Рабочая область: адрес выбранной ячейки — E1 (первая ячейка, которую нужно заполнить), строка формул, сетка.
  const bar = page.getByRole("textbox", { name: "Строка формул: содержимое выбранной ячейки" });
  await expect(bar).toBeVisible();
  await expect(page.getByLabel("Адрес выбранной ячейки")).toHaveText("E1");
  await expect(page.getByRole("button", { name: "Ячейка A1, значение: 12" })).toBeVisible();
  const cellE1 = page.getByRole("button", { name: /^Ячейка E1,/ });
  await expect(cellE1).toBeVisible();

  // Неверно: число вручную вместо формулы.
  await cellE1.click();
  await bar.fill("33");
  await bar.press("Enter");
  await expect(page.getByRole("button", { name: "Ячейка E1, значение: 33" })).toBeVisible();
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  const fail = page.getByRole("status").filter({ hasText: "Пока не верно" });
  await expect(fail).toBeVisible();
  await expect(fail).toContainText("В ячейке E1 должна быть формула");
  await expect(page.getByText("Верно!", { exact: true })).toHaveCount(0);

  // Верно: формула с функцией СУММ.
  await page.getByRole("button", { name: /^Ячейка E1,/ }).click();
  await bar.fill("=СУММ(A1:D1)");
  await bar.press("Enter");
  await expect(page.getByRole("button", { name: "Ячейка E1, значение: 33" })).toBeVisible();
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  const ok = page.getByRole("status").filter({ hasText: "Верно!" });
  await expect(ok).toBeVisible();
  await expect(ok).toContainText(/\+\d+ XP/);
  await expect(ok.getByRole("link", { name: "Следующая задача" })).toBeVisible();
  await expect(page.getByText("Пока не верно")).toHaveCount(0);

  // Решённая задача отмечена в списке, прогресс на карточке языка вырос.
  await page.goto("/code/excel");
  await expect(page.locator('main a[href="/code/excel/xl-1-sum"]').getByRole("img", { name: "Решено" })).toBeVisible();
  await expect(page.getByText(/^Решено: 1 из \d+$/).first()).toBeVisible();
  expect(errors).toEqual([]);
});

// ---------- 2. HTML/CSS и JavaScript ----------

test("HTML/CSS: предпросмотр, стартовый код не проходит, решение проходит", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/code/web/web-1-h1");
  await expect(page.getByText("Заголовок").first()).toBeVisible();

  const preview = page.locator('iframe[title="Предпросмотр страницы"]');
  await expect(preview).toBeAttached();
  const check = page.getByRole("button", { name: "Проверить", exact: true });

  // Стартовый код: заголовка нет — проверка не проходит.
  await check.click();
  await expect(page.getByRole("status").filter({ hasText: "Пока не верно" })).toBeVisible();

  // Решение: <h1>My site</h1> в <body>.
  await setEditorCode(page, "Код HTML и CSS", "<!DOCTYPE html>\n<html>\n<body>\n<h1>My site</h1>\n</body>\n</html>");
  // На телефоне предпросмотр — на вкладке «Страница»: он обновляется с задержкой 300 мс и показывает заголовок.
  await page.getByRole("tab", { name: "Страница" }).click();
  await expect(preview).toBeVisible();
  await expect(page.frameLocator('iframe[title="Предпросмотр страницы"]').locator("h1")).toHaveText("My site");

  await check.click();
  const ok = page.getByRole("status").filter({ hasText: "Верно!" });
  await expect(ok).toBeVisible();
  await expect(ok).toContainText(/\+\d+ XP/);
  expect(errors).toEqual([]);
});

test("JavaScript: запуск в воркере и проверка задачи", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/code/js/js-1-log");
  await expect(page.getByText("Вывод строки").first()).toBeVisible();
  const check = page.getByRole("button", { name: "Проверить", exact: true });

  // Стартовый код ничего не печатает — не верно.
  await check.click();
  await expect(page.getByRole("status").filter({ hasText: "Пока не верно" })).toBeVisible();

  await setEditorCode(page, "Код на JavaScript", 'console.log("Hello, world!");');
  await page.getByRole("button", { name: "Запустить", exact: true }).click();
  const out = page.getByRole("region", { name: /Вывод/ });
  await expect(out).toContainText("Hello, world!");

  await check.click();
  const ok = page.getByRole("status").filter({ hasText: "Верно!" });
  await expect(ok).toBeVisible();
  await expect(ok).toContainText(/\+\d+ XP/);
  expect(errors).toEqual([]);
});

// ---------- 3. Чаты с Битом 2.0 ----------

/** Ответить на текущее задание «Дай задачи» любым ответом — по виду задания (в ленте те же компоненты, что в уроках). */
async function answerAnyStep(quiz: Locator) {
  const check = quiz.getByRole("button", { name: "Проверить", exact: true });
  const boxes = quiz.getByRole("textbox");
  if ((await boxes.count()) > 0) {
    // «Введи ответ» или пропуски в примере.
    for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).fill("1");
  } else if ((await quiz.getByText("Соедини пары", { exact: false }).count()) > 0) {
    // Пары: перебором; когда пары кончатся, ответ отправляется сам.
    const left = quiz.locator("div.grid-cols-2 > div:nth-child(1) > button:enabled");
    const right = quiz.locator("div.grid-cols-2 > div:nth-child(2) > button:enabled");
    for (let guard = 0; guard < 40 && (await left.count()) > 0; guard++) {
      const before = await left.count();
      await left.first().click();
      for (let j = 0; j < (await right.count()); j++) {
        await right.nth(j).click();
        if ((await left.count()) < before) break;
      }
    }
  } else if ((await quiz.getByText("Нажимай по порядку").count()) > 0) {
    // Порядок: нажимаем карточки внизу, пока они не кончатся.
    const pool = quiz.locator("ol + div > button");
    for (let guard = 0; guard < 12 && (await pool.count()) > 0; guard++) await pool.first().click();
  } else if ((await quiz.getByRole("button", { name: "0", exact: true }).count()) > 0) {
    // Лесенка деления: во всех строках выбираем остаток 0.
    const zeros = quiz.getByRole("button", { name: "0", exact: true });
    for (let i = 0; i < (await zeros.count()); i++) await zeros.nth(i).click();
  } else {
    // Выбор варианта, несколько вариантов, «лампочки».
    await quiz.locator("button[aria-pressed]").first().click();
  }
  // У пар проверка уже сработала сама.
  if (await check.isVisible()) {
    await expect(check).toBeEnabled();
    await check.click();
  }
}

test("чаты: пустой список, «Дай задачи» из шторки, итог, меню (переименовать, удалить)", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/tutor");
  await expect(page.getByRole("heading", { name: "Чаты с Битом" })).toBeVisible();

  // Пустой список: пять режимов прямо на странице.
  await expect(page.getByText("Пока нет чатов")).toBeVisible();
  const modes = ["Свободный", "Объясни тему", "Дай задачи", "Проверь решение", "Готовимся к ЕНТ"];
  for (const m of modes) await expect(page.getByRole("button", { name: new RegExp(`^${m}`) }), m).toBeVisible();

  // «Дай задачи» → выбор темы в шторке → чат открыт.
  await page.getByRole("button", { name: /^Дай задачи/ }).click();
  const sheet = page.getByRole("dialog", { name: "Новый чат" });
  await expect(sheet.getByRole("heading", { name: "Выбери тему" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Любая тема" })).toBeVisible();
  await sheet.getByRole("button", { name: "Системы счисления", exact: true }).click();
  await page.waitForURL(/\/tutor\/[a-z0-9]+$/);

  // Шапка чата: режим и тема. Квиз стартует сам и спрашивает, сколько заданий.
  await expect(page.getByText("Сколько заданий решим?")).toBeVisible();
  await page.getByRole("button", { name: /^5\s*заданий/ }).click();

  // 5 заданий: на каждое — любой ответ, «Проверить», разбор без ИИ, «Далее».
  for (let n = 1; n <= 5; n++) {
    const quiz = page.locator("section").filter({ hasText: `Задание ${n} / 5` });
    await expect(quiz).toBeVisible();
    await answerAnyStep(quiz);
    const feedback = quiz.getByRole("status");
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText(/Отлично!|Верно!|Супер!|Так держать!|Почти!|Неверно/);
    await quiz.getByRole("button", { name: n === 5 ? "Завершить" : "Далее", exact: true }).click();
  }

  // Итог в ленте чата.
  await expect(page.getByText("Итог заданий")).toBeVisible();
  await expect(page.getByText(/^\d+ из 5$/)).toBeVisible();
  await expect(page.getByText(/^Оценка: [2-5]$/)).toBeVisible();

  // Назад: чат появился в списке с названием по режиму и теме и превью итога.
  await page.getByRole("button", { name: "К списку чатов" }).click();
  await page.waitForURL("**/tutor");
  const row = page.locator("main li").filter({ hasText: "Дай задачи: Счисление" });
  await expect(row).toBeVisible();
  await expect(row).toContainText(/Итог: \d+ из 5, оценка [2-5]/);

  // «Новый чат»: шторка с пятью режимами; закрывается по Escape.
  await page.getByRole("button", { name: "Новый чат" }).click();
  const newSheet = page.getByRole("dialog", { name: "Новый чат" });
  for (const m of modes) await expect(newSheet.getByRole("button", { name: new RegExp(`^${m}`) }), m).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(newSheet).toBeHidden();

  // Переименовать через «⋯».
  await row.getByRole("button", { name: "Действия с чатом" }).click();
  const menu = page.getByRole("dialog", { name: "Действия с чатом" });
  await menu.getByRole("button", { name: "Переименовать" }).click();
  await menu.getByRole("textbox").fill("Мой тест по счислению");
  await menu.getByRole("button", { name: "Сохранить" }).click();
  await expect(menu).toBeHidden();
  const renamed = page.locator("main li").filter({ hasText: "Мой тест по счислению" });
  await expect(renamed).toBeVisible();
  await expect(page.getByText("Дай задачи: Счисление")).toHaveCount(0);

  // Удалить с подтверждением: список снова пуст.
  await renamed.getByRole("button", { name: "Действия с чатом" }).click();
  const menu2 = page.getByRole("dialog", { name: "Действия с чатом" });
  await menu2.getByRole("button", { name: "Удалить чат" }).click();
  await expect(menu2.getByRole("heading", { name: "Удалить чат?" })).toBeVisible();
  await menu2.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(menu2).toBeHidden();
  await expect(page.getByText("Пока нет чатов")).toBeVisible();
  await expect(page.getByText("Мой тест по счислению")).toHaveCount(0);
  const stored = await page.evaluate(() => (JSON.parse(localStorage.getItem("informatica-v1") ?? "{}").state?.chats ?? []).length);
  expect(stored).toBe(0);
  expect(errors).toEqual([]);
});

test("чаты: пустой чат, из которого сразу вышли, не остаётся в списке", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/tutor");
  await page.getByRole("button", { name: /^Свободный/ }).click();
  await page.waitForURL(/\/tutor\/[a-z0-9]+$/);
  await expect(page.getByRole("button", { name: "Действия с чатом" })).toBeVisible();
  await page.getByRole("button", { name: "К списку чатов" }).click();
  await page.waitForURL("**/tutor");
  await expect(page.getByText("Пока нет чатов")).toBeVisible();
  expect(errors).toEqual([]);
});

// ---------- 4. Настройка «Начинать с раздела Старт» ----------

test("профиль: переключатель «Начинать с раздела «Старт»» сохраняется", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/profile");
  const sw = page.getByRole("switch", { name: "Начинать с раздела «Старт»" });
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");
  const skip = () => page.evaluate(() => JSON.parse(localStorage.getItem("informatica-v1") ?? "{}").state?.profile?.skipBasics);
  expect(await skip()).toBe(true);

  await page.reload();
  const again = page.getByRole("switch", { name: "Начинать с раздела «Старт»" });
  await expect(again).toHaveAttribute("aria-checked", "false");
  await again.click();
  await expect(again).toHaveAttribute("aria-checked", "true");
  expect(await skip()).toBe(false);
  expect(errors).toEqual([]);
});
