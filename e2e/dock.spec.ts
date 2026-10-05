import { expect, test, type Page } from "@playwright/test";
import { ALL_TIPS } from "./tour";

// Этап 16В, пакет P2b: плавающая кнопка Бита (ИИ-чат вместо вкладки). Без обращений к ИИ: проверяем кнопку, свайп, панель и места, где её нет.

const STORE = "informatica-v1";

async function seed(page: Page, profile: Record<string, unknown> = {}) {
  await page.goto("/onboarding");
  await page.evaluate(
    ([key, extra, tips]) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "light", sound: false, createdAt: 1, ...(extra as Record<string, unknown>) },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            tips,
          },
          version: 2,
        }),
      ),
    [STORE, profile, ALL_TIPS] as const,
  );
}

const hidden = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").state?.profile?.bitHidden, STORE);

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Перетаскивание мышью из центра элемента на dx пикселей (свайп без касаний). */
async function dragBy(page: Page, box: { x: number; y: number; width: number; height: number }, dx: number) {
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(x + (dx * i) / 8, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
});

test("кнопка Бита: есть на главных страницах, нет на /tutor, в уроке и на внутренних экранах", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  const dock = page.getByRole("button", { name: "Спросить Бита" });
  for (const path of ["/learn", "/practice", "/materials", "/stats", "/shop", "/profile"]) {
    await page.goto(path);
    await expect(dock, path).toBeVisible();
  }
  for (const path of ["/tutor", "/lesson/ns-1-bits", "/code/python"]) {
    await page.goto(path);
    await expect(page.locator("main, body").first(), path).toBeVisible();
    await expect(dock, path).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("кнопка Бита: свайп вправо прячет за край, состояние сохраняется, свайп влево и касание возвращают", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/learn");
  const dock = page.getByRole("button", { name: "Спросить Бита" });
  const tab = page.getByRole("button", { name: "Показать Бита" });
  await expect(dock).toBeVisible();
  await expect(tab).toHaveCount(0);

  // Короткий недотянутый свайп — кнопка остаётся, панель не открылась.
  await dragBy(page, (await dock.boundingBox())!, 18);
  await page.waitForTimeout(400);
  await expect(dock).toBeVisible();
  expect(await hidden(page)).toBeFalsy();
  await expect(page.locator("[data-bit-panel]")).toHaveCount(0);

  // Свайп вправо — кнопка уехала, у края остался язычок.
  await dragBy(page, (await dock.boundingBox())!, 90);
  await expect(tab).toBeVisible();
  await expect(dock).toHaveCount(0);
  expect(await hidden(page)).toBe(true);

  // Перезагрузка: язычок на месте.
  await page.reload();
  await expect(tab).toBeVisible();
  await expect(dock).toHaveCount(0);

  // Свайп влево по язычку — кнопка вернулась.
  await dragBy(page, (await tab.boundingBox())!, -50);
  await expect(dock).toBeVisible();
  await expect(tab).toHaveCount(0);
  expect(await hidden(page)).toBe(false);

  // Спрятать снова и вернуть касанием.
  await dragBy(page, (await dock.boundingBox())!, 90);
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(dock).toBeVisible();
  expect(await hidden(page)).toBe(false);
  expect(errors).toEqual([]);
});

test("кнопка Бита: касание открывает чат-панель, «Все чаты» ведёт в /tutor, Escape и крестик закрывают", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/stats");
  const dock = page.getByRole("button", { name: "Спросить Бита" });
  await dock.click();

  const panel = page.getByRole("dialog", { name: "Чат с Битом" });
  await expect(panel).toBeVisible();
  await expect(dock).toHaveCount(0); // пока панель открыта, кнопки нет
  await expect(panel.getByPlaceholder("Спроси что угодно…")).toBeVisible();
  // Чатов не было — создан один «свободный».
  const chats = () => page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").state?.chats ?? []).map((c: { mode: string }) => c.mode), STORE);
  expect(await chats()).toEqual(["free"]);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(dock).toBeVisible();

  // Второе открытие — тот же чат, новый не создаётся.
  await dock.click();
  await expect(panel).toBeVisible();
  expect(await chats()).toEqual(["free"]);
  await panel.getByRole("button", { name: "Закрыть" }).click();
  await expect(panel).toBeHidden();

  // «Все чаты» → страница со списком; кнопки на /tutor нет.
  await dock.click();
  await panel.getByRole("link", { name: "Все чаты" }).click();
  await page.waitForURL("**/tutor");
  await expect(page.getByRole("heading", { name: "Чаты с Битом" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Спросить Бита" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("кнопка Бита: прячется, пока открыты «Инструменты»; не закрывает «Продолжить» и конец страницы", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/learn");
  const dock = page.getByRole("button", { name: "Спросить Бита" });
  await expect(dock).toBeVisible();

  // «Продолжить» в карточке урока выше кнопки Бита (360 px), а конец страницы прокручивается выше неё.
  const cta = page.locator('[data-tour="continue"]').first();
  await expect(cta).toBeVisible();
  const [c, d] = [await cta.boundingBox(), await dock.boundingBox()];
  expect(c && d && c.y + c.height < d.y).toBe(true);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const [m, d2] = [await page.locator("main").boundingBox(), await dock.boundingBox()];
  expect(m && d2 && m.y + m.height <= d2.y).toBe(true);

  await page.getByRole("button", { name: "Инструменты" }).first().click();
  await expect(page.getByRole("dialog", { name: "Инструменты" })).toBeVisible();
  await expect(dock).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dock).toBeVisible();
  expect(errors).toEqual([]);
});

test("кнопка Бита: нижняя панель из четырёх вкладок, на компьютере в боковом меню нет «ИИ-чата»", async ({ page }) => {
  await seed(page);
  await page.goto("/learn");
  await expect(page.getByRole("navigation", { name: "Главное меню" }).getByRole("link")).toHaveCount(4);
  await page.setViewportSize({ width: 1280, height: 800 });
  const side = page.locator("aside nav");
  await expect(side.getByRole("link", { name: "Учиться" })).toBeVisible();
  await expect(side.getByRole("link", { name: "ИИ-чат" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Спросить Бита" })).toBeVisible();
});
