import { expect, test, type Page } from "@playwright/test";

// Этап 16В: Бит-проводник (P2a) и плавающая кнопка Бита (P2b) вместе, на свежем профиле. Без обращений к ИИ.
// Путь: приветствие на «Учиться» до шага «Нажми «Начать»» → (подставляем пройденный урок) → обзор nav целиком, включая
// шаг про кнопку Бита → чат-панель открыть и закрыть → «Практика»: сцена page-practice появляется (закрытая панель
// не считается открытым окном).

const STORE = "informatica-v1";
const PROFILE = { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "light", sound: false, createdAt: 1 };

/** Сохранение ученика: онбординг пройден, окно тарифов не всплывает; tips и lessons — как задано. */
async function writeSave(page: Page, extra: Record<string, unknown>) {
  await page.evaluate(
    ([key, profile, more]) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          state: { onboarded: true, profile, paywall: { lastShownAt: 4102444800000, views: 1 }, ...(more as Record<string, unknown>) },
          version: 2,
        }),
      ),
    [STORE, PROFILE, extra] as const,
  );
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Сколько раз кнопка Бита появлялась в DOM с загрузки страницы (счётчик в window, ставится до скриптов приложения). */
const dockSeen = (page: Page) => page.evaluate(() => (window as unknown as { __dockSeen?: number }).__dockSeen ?? 0);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.addInitScript(() => {
    const w = window as unknown as { __dockSeen?: number };
    w.__dockSeen = 0;
    let was = false;
    new MutationObserver(() => {
      const now = !!document.querySelector('[data-tour="bit-dock"]');
      if (now && !was) w.__dockSeen = (w.__dockSeen ?? 0) + 1;
      was = now;
    }).observe(document, { childList: true, subtree: true });
  });
});

test("проводник и кнопка Бита: приветствие → обзор с шагом про кнопку → чат-панель → сцена «Практики»", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await page.goto("/onboarding");
  await writeSave(page, { tips: {} });
  await page.goto("/learn");

  const bubble = page.getByLabel("Подсказка Бита");
  const dock = page.locator('[data-tour="bit-dock"]');
  const finger = page.locator("[data-guide-finger]");
  const next = () => bubble.getByRole("button", { name: "Дальше" }).click();

  // --- welcome: без цели — статус, без затемнения; кнопки Бита нет с самого начала (не выезжает на миг перед сценой).
  await expect(bubble).toContainText("Привет, Т! Я Бит.");
  await expect(page.getByRole("status", { name: "Подсказка Бита" })).toBeVisible();
  await expect(dock).toHaveCount(0);
  await next();

  // Шаг «Дальше» с целью: модальный диалог, пальца нет; нажатие на саму цель («Начать») — это «Дальше», урок не открывается.
  await expect(bubble).toContainText("Здесь твой следующий урок");
  await expect(page.getByRole("dialog", { name: "Подсказка Бита" })).toBeVisible();
  await expect(finger).toHaveCount(0);
  await page.locator('[data-tour="continue"]').first().click();
  await expect(bubble).toContainText("Сердечки — входы в уроки");
  expect(new URL(page.url()).pathname).toBe("/learn");

  // Сердечки — ссылка в магазин: нажатие на них тоже «Дальше», со страницы не уходим.
  await page.locator('[data-tour="hdr-hearts"]:visible').first().click();
  await expect(bubble).toContainText("Нажми «Начать»");
  expect(new URL(page.url()).pathname).toBe("/learn");

  // Шаг «нажми»: пузырь — статус (не модальный), палец есть, кнопки «Дальше» нет.
  await expect(page.getByRole("status", { name: "Подсказка Бита" })).toBeVisible();
  await expect(finger).toHaveCount(1);
  await expect(bubble.getByRole("button", { name: "Дальше" })).toHaveCount(0);
  expect(await dockSeen(page)).toBe(0);

  // --- «Прошли» первый урок: подставляем сохранение. Уходим на файл того же сайта (уход посреди сцены записывает стор),
  // там пишем новое сохранение и возвращаемся.
  await page.goto("/og.png");
  await writeSave(page, {
    tips: { welcome: 1, "lesson-first": 1, "after-first": 1 },
    lessons: { "ns-1-bits": { completions: 1, bestAccuracy: 1, lastAt: 1, totalXp: 20 } },
  });
  await page.goto("/learn");

  // --- nav: следующий урок → панель → кнопка Бита → чипы.
  await expect(bubble).toContainText("Сюда я кладу следующий урок");
  await expect(dock).toHaveCount(0);
  expect(await dockSeen(page)).toBe(0);
  await next();
  await expect(bubble).toContainText("Практика — тренировки и пробный ЕНТ");
  await next();

  // Шаг про кнопку Бита: кнопка видна, пузырь не мигает (держится дольше ожидания цели и задержки «спрятаться»).
  await expect(bubble).toContainText("А это я!");
  await expect(dock).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(250);
    await expect(bubble, `замер ${i}`).toBeVisible();
    await expect(bubble, `замер ${i}`).toContainText("А это я!");
    await expect(dock, `замер ${i}`).toBeVisible();
  }
  await expect(finger).toHaveCount(0);
  // Нажатие на саму кнопку (она в вырезе) — «Дальше», чат-панель не открывается.
  await dock.click();
  await expect(bubble).toContainText("нажми на чипы");
  await expect(page.locator("[data-bit-panel]")).toHaveCount(0);

  // Шаг «нажми» — палец есть; нажатие на чипы уводит в магазин, там своя сцена.
  await expect(finger).toHaveCount(1);
  await page.locator('[data-tour="hdr-chips"]:visible').first().click();
  await page.waitForURL("**/shop");
  await expect(bubble).toContainText("Закончились сердечки");
  await expect(dock).toHaveCount(0);
  await next();
  await expect(bubble).toContainText("украшения профиля");
  await bubble.getByRole("button", { name: "Понятно" }).click();
  await expect(bubble).toBeHidden();

  // --- Сцен больше нет: кнопка Бита выезжает. Чат-панель открыть и закрыть.
  await expect(dock).toBeVisible();
  await dock.click();
  const panel = page.getByRole("dialog", { name: "Чат с Битом" });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Закрыть" }).click();
  await expect(panel).toBeHidden();
  await expect(dock).toBeVisible();
  // Закрытая панель смонтирована, но окном не считается.
  await expect(page.locator("[data-bit-panel]")).toHaveCount(1);
  await expect(page.locator('[data-bit-panel][role="dialog"], [data-bit-panel][aria-modal="true"]')).toHaveCount(0);

  // --- «Практика»: сцена page-practice появляется, кнопка Бита на это время спрятана.
  await page.getByRole("navigation", { name: "Главное меню" }).getByRole("link", { name: "Практика" }).click();
  await page.waitForURL("**/practice");
  await expect(bubble).toContainText("Тренировка — 10 заданий");
  await expect(dock).toHaveCount(0);
  await next();
  await expect(bubble).toContainText("Игры — те же задания");
  await bubble.getByRole("button", { name: "Понятно" }).click();
  await expect(bubble).toBeHidden();
  await expect(dock).toBeVisible();
  expect(errors).toEqual([]);
});

test("кнопка Бита и клавиатура: стрелка вправо прячет — фокус на язычке; стрелка влево возвращает — фокус на кнопке", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/onboarding");
  await writeSave(page, {
    tips: Object.fromEntries(
      ["welcome", "lesson-first", "after-first", "nav", "page-practice", "page-tutor", "page-materials", "page-progress", "page-school", "page-shop", "page-profile"].map((id) => [id, 1]),
    ),
  });
  await page.goto("/learn");
  const dock = page.getByRole("button", { name: "Спросить Бита" });
  const tab = page.getByRole("button", { name: "Показать Бита" });
  await expect(dock).toBeVisible();
  await dock.focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(dock).toBeFocused();
  // Enter на язычке — тоже возврат с фокусом на кнопке.
  await page.keyboard.press("ArrowRight");
  await expect(tab).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dock).toBeFocused();
  expect(errors).toEqual([]);
});
