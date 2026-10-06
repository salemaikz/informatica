import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ALL_TIPS } from "./tour";

// Этап 16Д, Ф4 (docs/specs/duels.md §11): живые дуэли на двух контекстах браузера (две cookie — два игрока).
// Запуск — со своим сервером (соцчасть в памяти, тестовые часы): npx playwright test -c playwright.duel-live.config.ts.
// Под общим конфигом (сервер без соцчасти) сценарии пропускаются.
// 1) комната по ссылке: друг входит кнопкой, пока вкладка хозяина скрыта (хозяин в мессенджере) — матч не отменяется
//    и стартует, когда хозяин вернулся; оба отвечают, полоса соперника обновляется ≤ 3 с после приёма ответа,
//    перемотка часов → итоги совпадают с обеих сторон, сердечко −1 у каждого;
// 2) случайный соперник: оба ищут → матч, на VS — имя соперника;
// 3) один в поиске → кнопка Бита с 3 с → матч с ботом, чип «бот»;
// 4) комната истекла → «Создать свою комнату» открывает лобби на той же странице; «Без имени» не заменяется именем профиля.
// Первый живой вход без профиля соцчасти — экран имени (имя из профиля подставлено, ученик подтверждает).

type Item = { shape: "choice" | "statement"; step?: { correct: number }; statement?: { value: boolean } };
type Join = { matchId: string; seed: number; band: number; mode: string; startAt: number };

async function player(browser: Browser, name: string): Promise<{ ctx: BrowserContext; page: Page; errors: string[] }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/onboarding");
  await page.evaluate(
    ({ tips, name }) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name, lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "system", sound: false, createdAt: 1 },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            tips,
            hearts: { count: 5, updatedAt: 0, day: "" },
          },
          version: 1,
        }),
      ),
    { tips: ALL_TIPS, name },
  );
  return { ctx, page, errors };
}

const hearts = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("informatica-v1") ?? "{}").state?.hearts?.count);

/** Место в матче из sessionStorage (его кладёт экран) и набор заданий того же seed. */
async function matchOf(page: Page): Promise<{ join: Join; items: Item[] }> {
  const id = new URL(page.url()).searchParams.get("m")!;
  const join = (await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? "null"), `informatica-duel-seat:${id}`)) as Join;
  const res = await page.request.get(`/api/duel/deck?mode=${join.mode}&band=${join.band}&seed=${join.seed}`);
  expect(res.ok()).toBe(true);
  return { join, items: ((await res.json()) as { items: Item[] }).items };
}

async function answer(page: Page, it: Item) {
  if (it.shape === "statement") await page.locator(`[data-answer="${it.statement!.value}"]`).click();
  else await page.locator(`[data-option="${it.step!.correct}"]`).click();
}

/** Экран имени при первом живом входе: подтвердить подставленное имя профиля. */
async function confirmName(page: Page) {
  await expect(page.getByTestId("duel-live-name")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("social-name-save").click();
}

async function socialOn(page: Page): Promise<boolean> {
  const res = await page.request.get("/api/social/home");
  return res.status() === 200;
}

test("комната по ссылке: двое отвечают, полоса соперника, итоги совпадают, сердечко −1 у каждого", async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const A = await player(browser, "Аян");
  const B = await player(browser, "Әсем");
  test.skip(!(await socialOn(A.page)), "соцчасть выключена: нужен сервер playwright.duel-live.config.ts");

  await A.page.goto("/duel");
  await A.page.getByTestId("duel-room").click();
  await confirmName(A.page);
  await A.page.waitForURL(/\/duel\/live\?m=/);
  const code = (await A.page.getByTestId("duel-room-code").textContent())!.trim();
  expect(code).toMatch(/^[0-9A-Z]{6}$/);

  // Хозяин ушёл отправлять ссылку: вкладка скрыта, опрос на паузе.
  const setHidden = (page: Page, hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  await setHidden(A.page, true);

  // Ссылка сама в комнату не входит (превью мессенджера) — только кнопка.
  await B.page.goto(`/duel/r/${code}`);
  await expect(B.page.getByTestId("duel-room-invite")).toBeVisible();
  await B.page.getByTestId("duel-room-enter").click();
  await confirmName(B.page);
  await expect(B.page.getByTestId("duel-opp-card")).toContainText("Аян", { timeout: 15_000 });
  // Дольше прежнего окна готовности (6 с): матч не отменён, друг ждёт хозяина.
  await B.page.waitForTimeout(8_000);
  await expect(B.page.getByTestId("duel-live-cancelled")).toHaveCount(0);
  await setHidden(A.page, false);
  // Оба на VS с карточкой соперника (имя из профиля), сердечко ещё не списано.
  await expect(A.page.getByTestId("duel-opp-card")).toContainText("Әсем", { timeout: 15_000 });
  expect(await hearts(A.page)).toBe(5);
  expect(await hearts(B.page)).toBe(5);

  // Отсчёт по серверному старту → матч.
  await expect(A.page.getByTestId("duel-item")).toBeVisible({ timeout: 15_000 });
  await expect(B.page.getByTestId("duel-item")).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => hearts(A.page)).toBe(4);
  await expect.poll(() => hearts(B.page)).toBe(4);
  await expect(A.page.getByTestId("duel-opp-name")).toHaveText("Әсем");

  const ma = await matchOf(A.page);
  const mb = await matchOf(B.page);
  expect(ma.join.matchId).toBe(mb.join.matchId);
  // A отвечает верно на 3 задания (не быстрее 0,7 с: иначе сервер считает ответ неправдоподобным).
  for (let k = 0; k < 3; k++) {
    await expect(A.page.getByTestId("duel-item")).toHaveAttribute("data-item", String(k));
    await A.page.waitForTimeout(800);
    await answer(A.page, ma.items[k]);
  }
  await expect(A.page.getByTestId("duel-you-score")).toHaveText("6");
  // Сервер принял ответы A → у B полоса соперника обновляется не позже чем через 3 с (опрос «на связи» 3 с).
  await A.page.waitForResponse((r) => r.url().includes("/answers") && r.status() === 200, { timeout: 5_000 });
  const accepted = Date.now();
  await expect(B.page.getByTestId("duel-opp-score")).toHaveText("6", { timeout: 3_500 });
  expect(Date.now() - accepted).toBeLessThanOrEqual(3_500);
  // B отвечает на одно верно.
  await B.page.waitForTimeout(800);
  await answer(B.page, mb.items[0]);
  await expect(B.page.getByTestId("duel-you-score")).toHaveText("2");
  await expect(A.page.getByTestId("duel-opp-score")).toHaveText("2", { timeout: 5_000 });

  // Перематываем серверные часы за конец блица — итоги у обоих.
  await B.page.waitForTimeout(1_800); // ответ B успел уйти пачкой
  const clock = await A.page.request.post("/api/duel/test/clock", { data: { advanceMs: 61_000 }, headers: { origin: baseURL! } });
  expect(clock.ok()).toBe(true);
  await expect(A.page.getByTestId("duel-result")).toBeVisible({ timeout: 20_000 });
  await expect(B.page.getByTestId("duel-result")).toBeVisible({ timeout: 20_000 });
  await expect(A.page.getByTestId("duel-final-score")).toHaveText("6 : 2");
  await expect(B.page.getByTestId("duel-final-score")).toHaveText("2 : 6");
  await expect(A.page.getByRole("heading", { name: "Победа" })).toBeVisible();
  await expect(A.page.getByTestId("duel-opp-name")).toHaveText("Әсем");
  // Жалоба (компонент Ф3, адресат — по матчу и месту): имя Аяна сразу скрыто у Әсем, сервер ответил 2xx.
  await B.page.getByTestId("report-player").click();
  const sent = B.page.waitForResponse((r) => r.url().endsWith("/api/social/report") && r.request().method() === "POST");
  await B.page.locator('[data-reason="name"]').click();
  expect((await sent).status()).toBe(200);
  expect((await sent).request().headers()["x-duel-seat"]).toBeTruthy();
  await expect(B.page.getByRole("button", { name: "Заблокировать" })).toBeVisible();
  await B.page.getByRole("button", { name: "Закрыть" }).last().click();
  await expect(B.page.getByTestId("duel-opp-name")).toHaveText(/^Игрок \d{4}$/);
  // У живого соперника нет чипа «бот».
  await expect(A.page.getByTestId("duel-result").getByTestId("bot-chip")).toHaveCount(0);
  expect(await hearts(A.page)).toBe(4);
  expect(await hearts(B.page)).toBe(4);

  // Реванш: A просит — B видит просьбу; оба согласны → новый матч (новый id), снова VS; выход до старта — без сердечка.
  const firstId = ma.join.matchId;
  await A.page.getByTestId("duel-rematch").click();
  await expect(A.page.getByTestId("duel-rematch")).toBeDisabled();
  await expect(B.page.getByTestId("duel-rematch-offer")).toBeVisible({ timeout: 5_000 });
  await B.page.getByTestId("duel-rematch").click();
  await expect(A.page.getByTestId("duel-opp-card")).toContainText("Әсем", { timeout: 10_000 });
  await expect(B.page.getByTestId("duel-opp-card")).toContainText("Игрок", { timeout: 10_000 });
  expect(new URL(A.page.url()).searchParams.get("m")).not.toBe(firstId);
  await A.page.getByRole("button", { name: "Закрыть" }).first().click();
  await A.page.waitForURL(/\/duel$/);
  await expect(B.page.getByTestId("duel-live-cancelled")).toBeVisible({ timeout: 15_000 });
  expect(await hearts(A.page)).toBe(4);
  expect(await hearts(B.page)).toBe(4);
  expect(A.errors).toEqual([]);
  expect(B.errors).toEqual([]);
  await A.ctx.close();
  await B.ctx.close();
});

test("случайный соперник: двое ищут → матч", async ({ browser }) => {
  test.setTimeout(90_000);
  const A = await player(browser, "Дана");
  const B = await player(browser, "Ерлан");
  test.skip(!(await socialOn(A.page)), "соцчасть выключена: нужен сервер playwright.duel-live.config.ts");
  await A.page.goto("/duel");
  await A.page.getByTestId("duel-find").click();
  await confirmName(A.page);
  await expect(A.page.getByTestId("duel-search")).toBeVisible();
  await B.page.goto("/duel");
  await B.page.getByTestId("duel-find").click();
  await confirmName(B.page);
  await expect(A.page.getByTestId("duel-opp-card")).toContainText("Ерлан", { timeout: 15_000 });
  await expect(B.page.getByTestId("duel-opp-card")).toContainText("Дана", { timeout: 15_000 });
  await expect(A.page.getByTestId("bot-chip")).toHaveCount(0);
  // Сердечко не списано до конца отсчёта; выход до старта — отмена без сердечка.
  expect(await hearts(A.page)).toBe(5);
  await B.page.getByRole("button", { name: "Закрыть" }).first().click();
  await B.page.waitForURL(/\/duel$/);
  await expect(A.page.getByTestId("duel-live-cancelled")).toBeVisible({ timeout: 15_000 });
  expect(await hearts(A.page)).toBe(5);
  expect(await hearts(B.page)).toBe(5);
  expect(A.errors).toEqual([]);
  await A.ctx.close();
  await B.ctx.close();
});

test("один в поиске: кнопка Бита с 3 с → матч с ботом, чип «бот»", async ({ browser }) => {
  test.setTimeout(60_000);
  const A = await player(browser, "Аружан");
  test.skip(!(await socialOn(A.page)), "соцчасть выключена: нужен сервер playwright.duel-live.config.ts");
  await A.page.goto("/duel");
  await A.page.getByTestId("duel-find").click();
  await confirmName(A.page);
  await expect(A.page.getByTestId("duel-search")).toBeVisible();
  await expect(A.page.getByTestId("duel-search-bot")).toHaveCount(0);
  const bot = A.page.getByTestId("duel-search-bot");
  await expect(bot).toBeVisible({ timeout: 6_000 });
  await expect(bot.getByTestId("bot-chip")).toHaveText("бот");
  await bot.click();
  await A.page.waitForURL(/\/duel\/play\?mode=blitz&seed=\d+$/);
  await expect(A.page.getByTestId("duel-vs").getByTestId("bot-chip")).toBeVisible();
  expect(await hearts(A.page)).toBe(5);
  expect(A.errors).toEqual([]);
  await A.ctx.close();
});

test("комната истекла → «Создать свою комнату» открывает лобби; «Без имени» остаётся без имени", async ({ browser }) => {
  test.setTimeout(60_000);
  const A = await player(browser, "Аня");
  test.skip(!(await socialOn(A.page)), "соцчасть выключена: нужен сервер playwright.duel-live.config.ts");
  // Несуществующий матч — экран «комната истекла».
  await A.page.goto("/duel/live?m=AAAAAAAAAAAA");
  await expect(A.page.getByTestId("duel-live-error")).toBeVisible({ timeout: 15_000 });
  await A.page.getByRole("button", { name: "Создать свою комнату" }).click();
  // Тот же маршрут /duel/live, другой адрес — новый экран: сначала имя, ученик выбирает «Без имени».
  await expect(A.page.getByTestId("duel-live-name")).toBeVisible({ timeout: 15_000 });
  await A.page.getByRole("button", { name: "Без имени" }).click();
  await expect(A.page.getByTestId("duel-lobby")).toBeVisible({ timeout: 15_000 });
  const me1 = (await (await A.page.request.get("/api/social/me")).json()) as { player: { nameState: string; name: string | null } };
  expect(me1.player).toMatchObject({ nameState: "none", name: null });
  // Новый уровень (профиль на сервере устарел) и новый живой вход: имя «Аня» из профиля приложения не публикуется.
  await A.page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("informatica-v1") ?? "{}");
    raw.state.xp = 5_000;
    localStorage.setItem("informatica-v1", JSON.stringify(raw));
    sessionStorage.removeItem("informatica-duel-player");
  });
  await A.page.goto("/duel/live?room=blitz");
  await expect(A.page.getByTestId("duel-lobby")).toBeVisible({ timeout: 15_000 });
  const me2 = (await (await A.page.request.get("/api/social/me")).json()) as { player: { nameState: string; name: string | null; lv: number } };
  expect(me2.player).toMatchObject({ nameState: "none", name: null });
  expect(me2.player.lv).toBeGreaterThan(1);
  expect(A.errors).toEqual([]);
  await A.ctx.close();
});
