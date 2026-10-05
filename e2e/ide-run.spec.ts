import { expect, test, type Page } from "@playwright/test";

// Этап 14, пакет P4: «Стоп» у запуска Python, контекстные задания с запуском программы, сбой загрузки Python.
// Python (Pyodide) грузится с CDN при первом запуске. Тестам с настоящим Python даём до 2 минут и несколько попыток:
// нет доступа к CDN (офлайн-среда, нестабильный прокси) — тест пропускается с пометкой, а не падает; сообщение о сбое
// загрузки проверяет отдельный тест (запрос к CDN обрывается).
// В облачной среде CDN доступен через прокси со своим сертификатом — поэтому ignoreHTTPSErrors (на обычной машине не мешает).
// Шаг урока `code` проверяется на тестовом уроке вручную (настоящие шаги появятся с контент-пакетом C9a).

test.use({ ignoreHTTPSErrors: true });

const PYTHON_LOAD_MS = 120_000;
const LOAD_ATTEMPTS = 3;

async function seed(page: Page) {
  await page.goto("/onboarding");
  await page.evaluate(() =>
    localStorage.setItem(
      "informatica-v1",
      JSON.stringify({
        state: {
          onboarded: true,
          profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "light", sound: false, createdAt: 1 },
          lessons: {},
          paywall: { lastShownAt: 4102444800000, views: 1 },
            // Проводник первого входа (#104) уже пройден — не закрывает экран.
            tips: { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1 },
          hearts: { count: 5, updatedAt: 0, day: "" },
        },
        version: 1,
      }),
    ),
  );
}

/** Заменить код в редакторе (CodeMirror): выделить всё и вставить текст. */
async function setEditorCode(page: Page, code: string) {
  await page.locator(".cm-content").first().click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(code);
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  // Сбой сети при загрузке Pyodide с CDN воркер сообщает как «Failed to fetch» — приложение его обрабатывает
  // (сообщение «Не удалось загрузить Python»), поэтому здесь это не ошибка страницы.
  page.on("pageerror", (e) => {
    if (!/Failed to fetch|NetworkError|Load failed/i.test(e.message)) errors.push(e.message);
  });
  return errors;
}

/**
 * Нажимает «Запустить», пока Python не ответит (после «Время: N мс» значит запуск прошёл). Не загрузился с нескольких
 * попыток — false (нет доступа к CDN).
 */
async function runUntilPythonLoads(page: Page): Promise<boolean> {
  for (let attempt = 0; attempt < LOAD_ATTEMPTS; attempt++) {
    await page.getByRole("button", { name: "Запустить" }).click();
    const ok = page.getByText("Время:");
    const failed = page.getByText(/Не удалось загрузить Python/);
    await expect(ok.or(failed)).toBeVisible({ timeout: PYTHON_LOAD_MS });
    if (await ok.isVisible()) return true;
  }
  return false;
}

const outputOf = (page: Page) => page.getByRole("region", { name: "Вывод" }).locator("pre");

test("«Стоп» останавливает бесконечный цикл в песочнице Python", async ({ page }) => {
  test.setTimeout(PYTHON_LOAD_MS * LOAD_ATTEMPTS + 60_000);
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/code/python");
  await page.getByRole("tab", { name: "Песочница" }).click();

  // Прогрев: первый запуск грузит Python (после него цикл успеет стартовать, а «Стоп» остановит именно программу).
  await setEditorCode(page, "print(1)\n");
  test.skip(!(await runUntilPythonLoads(page)), "Python не загрузился (нет доступа к CDN)");

  // Бесконечный цикл: кнопка «Запустить» превращается в «Стоп».
  await setEditorCode(page, "while True:\n    pass\n");
  await page.getByRole("button", { name: "Запустить" }).click();
  const stop = page.getByRole("button", { name: "Стоп" });
  await expect(stop).toBeVisible();
  await expect(page.getByText("Выполняется…")).toBeVisible();
  await stop.click();

  // Нейтральный статус вместо «работает слишком долго», кнопка вернулась.
  await expect(page.getByText("Программа остановлена")).toBeVisible();
  await expect(page.getByText(/работает слишком долго/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Запустить" })).toBeVisible();
  expect(errors).toEqual([]);

  // После остановки Python работает: следующий запуск проходит (воркер создаётся заново; без CDN — только пометка).
  await setEditorCode(page, "print(42)\n");
  if (await runUntilPythonLoads(page)) await expect(outputOf(page)).toHaveText("42");
  else test.info().annotations.push({ type: "note", description: "после «Стоп» Python не загрузился повторно (CDN)" });
});

test("«Стоп» останавливает бесконечный цикл в песочнице JavaScript", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/code/js");
  await page.getByRole("tab", { name: "Песочница" }).click();
  await setEditorCode(page, "while (true) {}\n");
  await page.getByRole("button", { name: "Запустить" }).click();
  const stop = page.getByRole("button", { name: "Стоп" });
  await expect(stop).toBeVisible();
  await stop.click();
  await expect(page.getByText("Программа остановлена")).toBeVisible();
  await expect(page.getByText(/работает слишком долго/)).toHaveCount(0);
  // Следующий запуск работает.
  await setEditorCode(page, "console.log(42)\n");
  await page.getByRole("button", { name: "Запустить" }).click();
  await expect(page.getByRole("region", { name: "Вывод" }).locator("pre")).toHaveText("42");
  expect(errors).toEqual([]);
});

test("«Стоп» во время загрузки Python тоже работает", async ({ page }) => {
  test.setTimeout(PYTHON_LOAD_MS);
  await seed(page);
  await page.goto("/code/python");
  await page.getByRole("tab", { name: "Песочница" }).click();
  await page.getByRole("button", { name: "Запустить" }).click();
  // Сразу после нажатия идёт загрузка (или уже выполнение) — «Стоп» доступен в любой момент.
  const stop = page.getByRole("button", { name: "Стоп" });
  await expect(stop).toBeVisible();
  await stop.click();
  await expect(page.getByText("Программа остановлена")).toBeVisible();
  await expect(page.getByRole("button", { name: "Запустить" })).toBeVisible();
});

test("нет сети к Python: понятное сообщение, а не зависание", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  // Загрузка Pyodide идёт с CDN (из воркера) — обрываем её.
  await page.context().route(/cdn\.jsdelivr\.net/, (route) => route.abort());
  await page.goto("/code/python");
  await page.getByRole("tab", { name: "Песочница" }).click();
  await page.getByRole("button", { name: "Запустить" }).click();
  await expect(page.getByText(/Не удалось загрузить Python/)).toBeVisible({ timeout: 30_000 });
  // Кнопка снова «Запустить» — можно повторить.
  await expect(page.getByRole("button", { name: "Запустить" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("контекстные задания: карточка в практикуме, список, переход в тренировку", async ({ page }) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page);
  await page.goto("/code");
  await page.getByRole("link", { name: /Контекстные задания/ }).click();
  await expect(page).toHaveURL(/\/code\/context$/);
  await expect(page.getByRole("heading", { name: "Контекстные задания" })).toBeVisible();
  await expect(page.getByText("Программа и 5 вопросов к ней — как на ЕНТ. Программу можно запустить.")).toBeVisible();

  const cards = page.locator('main a[href^="/drill?mode=context"]');
  expect(await cards.count()).toBeGreaterThan(10);
  // Список не выходит за экран телефона.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const card = page.locator('main a[href="/drill?mode=context&item=py-1-vars%3Acash-change"]');
  await expect(card).toContainText("5 вопросов");
  await card.click();
  await expect(page).toHaveURL(/\/drill\?mode=context&item=py-1-vars/);
  await expect(page.getByRole("button", { name: "Запустить" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("контекстное задание: программу можно запустить со своим вводом", async ({ page }) => {
  test.setTimeout(PYTHON_LOAD_MS * LOAD_ATTEMPTS + 60_000);
  const errors = trackErrors(page);
  await seed(page);
  await page.goto(`/drill?mode=context&item=${encodeURIComponent("py-1-vars:cash-change")}`);

  // Программа читает input() — есть поле «Ввод»; вопрос с вариантами виден рядом с программой.
  const input = page.getByLabel("Ввод", { exact: true });
  await expect(input).toBeVisible();
  await expect(page.getByRole("button", { name: "Проверить" })).toBeVisible();
  await input.fill("3\n500\n");
  // «360» и «2 40»: 120·3 = 360, сдача 140 = 2 монеты по 50 и 40.
  test.skip(!(await runUntilPythonLoads(page)), "Python не загрузился (нет доступа к CDN)");
  await expect(outputOf(page)).toHaveText("360\n2 40");
  expect(errors).toEqual([]);
});

test("контекстное задание: пустой ввод — подсказка про поле «Ввод»", async ({ page }) => {
  test.setTimeout(PYTHON_LOAD_MS * LOAD_ATTEMPTS + 60_000);
  await seed(page);
  await page.goto(`/drill?mode=context&item=${encodeURIComponent("py-1-vars:cash-change")}`);
  test.skip(!(await runUntilPythonLoads(page)), "Python не загрузился (нет доступа к CDN)");
  await expect(page.getByText(/добавь строки в поле «Ввод»/)).toBeVisible();
});

test("несуществующее контекстное задание: пустой экран с возвратом", async ({ page }) => {
  await seed(page);
  await page.goto("/drill?mode=context&item=no-such%3Aitem");
  await expect(page.getByRole("link", { name: "Назад" })).toHaveAttribute("href", "/code/context");
});
