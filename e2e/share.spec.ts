import { expect, test, type Page } from "@playwright/test";

// Этап 13, пакет A: лист «Поделиться» (итоги пробника, шкала курса), страница /r/<код> без онбординга и превью ссылки.

const KK_CODE = "x1-m-14-19-k-3051234567-a9zq";

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function seed(page: Page, extra: Record<string, unknown> = {}) {
  await page.goto("/onboarding");
  await page.evaluate(
    (more) => {
      // Сегодня по местному времени — как считает приложение.
      const today = () => {
        const d = new Date();
        const p = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      };
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "light", sound: false, createdAt: 1 },
            lessons: { "ns-1-bits": { completions: 1, bestAccuracy: 1, lastAt: 1, totalXp: 100 } },
            streak: { current: 3, best: 5, lastDay: today(), freezes: 0 },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            // Проводник первого входа (#104) уже пройден — не закрывает экран.
            tips: { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1 },
            ...more,
          },
          version: 2,
        }),
      );
    },
    extra,
  );
}

/** Нажать «Скопировать ссылку» в листе и прочитать буфер: буфер очищаем заранее и ждём «Ссылка скопирована», чтобы проверка могла упасть. */
async function copyLink(page: Page, sheet: ReturnType<Page["getByRole"]>): Promise<string> {
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await sheet.getByRole("button", { name: "Скопировать ссылку" }).click();
  await expect(sheet.getByText("Ссылка скопирована").first()).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).not.toBe("");
  return link;
}

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

test("итоги мини-ЕНТ: «Поделиться результатом» рисует картинку и копирует ссылку /r/x1-…", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/exam/run?kind=mini&seed=42");
  await page.getByRole("button", { name: "Начать" }).click();
  await expect(page.getByText("Задание 1").first()).toBeVisible();
  await page.getByRole("button", { name: "Завершить" }).first().click();
  await page.getByRole("button", { name: "Завершить и показать результат" }).click();
  await page.waitForURL("**/exam/result/**");

  await page.getByRole("button", { name: "Поделиться результатом" }).click();
  const sheet = page.getByRole("dialog", { name: "Поделиться результатом" });
  await expect(sheet).toBeVisible();
  // Картинка нарисована в обработчике нажатия: 1080 × 1920.
  const img = sheet.getByRole("img", { name: "Карточка с результатом" });
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight])).toEqual([1080, 1920]);

  const link = await copyLink(page, sheet);
  expect(new URL(link).pathname).toMatch(/^\/r\/x1-m-\d+-\d+-r-42-[a-z0-9]{4}$/);
  // Сообщение результата — не вызов.
  const resultMsg = decodeURIComponent((await sheet.getByRole("link", { name: "WhatsApp" }).getAttribute("href")) ?? "");
  expect(resultMsg).toContain("Мой результат");
  // Имени в ссылке нет.
  expect(link).not.toContain("%D0%A2");

  // На устройстве без системного меню для картинок — «Сохранить картинку».
  const native = await page.evaluate(() => typeof navigator.canShare === "function" && typeof navigator.share === "function");
  if (!native) await expect(sheet.getByRole("button", { name: "Сохранить картинку" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  // «Вызвать друга»: без картинки, та же ссылка.
  await page.getByRole("button", { name: "Вызвать друга" }).click();
  const ch = page.getByRole("dialog", { name: "Вызвать друга" });
  await expect(ch).toBeVisible();
  await expect(ch.getByRole("img")).toHaveCount(0);
  // Буфер очищается перед копированием: старая ссылка шага 1 не может «подтвердить» копирование вызова.
  expect(new URL(await copyLink(page, ch)).pathname).toBe(new URL(link).pathname);
  const challengeMsg = decodeURIComponent((await ch.getByRole("link", { name: "WhatsApp" }).getAttribute("href")) ?? "");
  expect(challengeMsg).toContain("Пройди этот же вариант");
  expect(challengeMsg).not.toContain("Мой результат");
  expect(errors).toEqual([]);
});

test("«Прогресс»: «Поделиться» курсом и серией дают ссылки c1 и s1", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/stats");

  // Курс
  await page.getByRole("button", { name: "Поделиться" }).first().click();
  let sheet = page.getByRole("dialog", { name: "Поделиться прогрессом" });
  await expect(sheet.getByRole("img", { name: "Карточка с результатом" })).toBeVisible();
  expect(new URL(await copyLink(page, sheet)).pathname).toMatch(/^\/r\/c1-\d+-\d+-r$/);
  await page.keyboard.press("Escape");

  // Серия (плитка «Серия дней»)
  await page.getByRole("button", { name: "Поделиться" }).last().click();
  sheet = page.getByRole("dialog", { name: "Поделиться серией" });
  await expect(sheet.getByRole("img", { name: "Карточка с результатом" })).toBeVisible();
  expect(new URL(await copyLink(page, sheet)).pathname).toMatch(/^\/r\/s1-\d+-\d+-r$/);
  expect(errors).toEqual([]);
});

test("/r/<код> без онбординга: тёмная тема, 390 px, язык из кода, «Пройти этот же вариант» ведёт на вариант с вызовом", async ({ page }) => {
  const errors = trackErrors(page);
  await page.emulateMedia({ colorScheme: "dark" });
  const res = await page.goto(`/r/${KK_CODE}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Достың сынақ ҰБТ-дағы нәтижесі" })).toBeVisible();
  await expect(page.locator("main").getByText("19 ішінен", { exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(`/r/${KK_CODE}`);
  expect(await noHorizontalScroll(page)).toBe(true);

  const accept = page.getByRole("link", { name: "Дәл осы нұсқаны шешу" });
  await expect(accept).toHaveAttribute("href", "/exam/run?kind=mini&seed=3051234567&ch=14-19-a9zq");
  await expect(page.getByRole("link", { name: "Дайындалуды бастау" })).toHaveAttribute("href", "/");

  // Переключатель языка — локальный.
  await page.getByRole("button", { name: "RU" }).click();
  await expect(page.getByRole("heading", { name: "Результат друга в пробном ЕНТ" })).toBeVisible();
  await expect(page.locator("main").getByText("из 19", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Пройти этот же вариант" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("/r/мусор — нейтральная карточка Informatica, страница 200, без «Пройти этот же вариант»", async ({ page }) => {
  for (const bad of ["garbage", "x1-m-99-19-k-3051234567-a9zq", "x1-m-014-19-k-1-a9zq"]) {
    const res = await page.goto(`/r/${bad}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Ссылка не открылась" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Начать заниматься" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: /Пройти этот же вариант/ })).toHaveCount(0);
  }
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("превью: один og:image и один twitter:image ведут на картинку этой страницы (PNG), не на /og.png", async ({ page, request }) => {
  await page.goto(`/r/${KK_CODE}`);
  const og = page.locator('meta[property="og:image"]');
  const tw = page.locator('meta[name="twitter:image"]');
  await expect(og).toHaveCount(1);
  await expect(tw).toHaveCount(1);
  const ogUrl = new URL((await og.getAttribute("content")) ?? "");
  const twUrl = new URL((await tw.getAttribute("content")) ?? "");
  expect(ogUrl.pathname).toBe(`/r/${KK_CODE}/opengraph-image`);
  expect(twUrl.pathname).toBe(`/r/${KK_CODE}/twitter-image`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Шағын ҰБТ: 19 ішінен 14");

  for (const u of [ogUrl, twUrl]) {
    const r = await request.get(u.pathname + u.search);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/png");
    expect(r.headers()["cache-control"]).toContain("immutable");
    const body = await r.body();
    expect(body.length).toBeGreaterThan(5_000);
    expect(body.length).toBeLessThan(300 * 1024);
    // PNG-подпись
    expect([...body.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }
});

test("превью: курс, серия и битый код тоже отдают PNG (адрес берём из og:image); у битого кода заголовок общий", async ({ page, request }) => {
  for (const code of ["c1-37-96-r", "c1-3-12-k-g8", "s1-12-30-k", "garbage"]) {
    const res = await page.goto(`/r/${code}`);
    expect(res?.status(), code).toBe(200);
    for (const sel of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      const meta = page.locator(sel);
      await expect(meta, `${code} ${sel}`).toHaveCount(1);
      const u = new URL((await meta.getAttribute("content")) ?? "");
      const r = await request.get(u.pathname + u.search);
      expect(r.status(), `${code} ${u.pathname}`).toBe(200);
      expect(r.headers()["content-type"]).toBe("image/png");
      const body = await r.body();
      expect(body.length, code).toBeGreaterThan(3_000);
      expect([...body.subarray(0, 4)], code).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
    if (code === "garbage") {
      // Битый код — общий заголовок сайта, а не заголовок результата.
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", await page.title());
    }
  }
});
