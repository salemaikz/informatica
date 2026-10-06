import { expect, test, type Page } from "@playwright/test";
import { ALL_TIPS } from "./tour";

// Этап 16Д, Ф3 (docs/specs/duels.md §11): два ученика на двух контекстах браузера.
//   1) имена для соревнований → A даёт код → B подаёт заявку → A принимает → топ друзей показывает обоих;
//   2) A записывает вызов («10 вопросов») → ссылка /duel/c/<id> → B принимает и играет против записи → итог у A во входящих.
// Нужен свой сервер с соцчасть в памяти: npx playwright test -c playwright.duels-friends.config.ts (там DUEL_SOCIAL_E2E=1).
// Верные ответы берём из того же набора (GET /api/duel/deck по seed подписанного старта).

test.skip(process.env.DUEL_SOCIAL_E2E !== "1", "нужен сервер соцчасти: playwright.duels-friends.config.ts");

async function seed(page: Page, name: string) {
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
}

const savedHearts = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("informatica-v1") ?? "{}").state?.hearts?.count);

type Item = { i: number; shape: "choice" | "statement"; step?: { correct: number; options: unknown[] }; statement?: { value: boolean } };

/** Имя для соревнований: подставлено из профиля → «Сохранить» → виден мой код. */
async function socialName(page: Page, expected: string): Promise<string> {
  await page.goto("/duel/friends");
  const input = page.getByTestId("social-name-input");
  await expect(input).toHaveValue(expected);
  await page.getByTestId("social-name-save").click();
  const code = page.getByTestId("my-friend-code");
  await expect(code).toHaveText(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  return (await code.textContent())!.trim();
}

/** Сыграть «10 вопросов»: правильно первые `right`, остальные — неверно; ≥ 0,8 с на задание (быстрее сервер помечает). */
async function playTen(page: Page, deck: Item[], right: number) {
  for (let k = 0; k < deck.length; k++) {
    const card = page.getByTestId("duel-item");
    await expect(card).toHaveAttribute("data-item", String(k), { timeout: 15_000 });
    await page.waitForTimeout(850);
    const it = deck[k];
    const ok = it.step!.correct;
    const pick = k < right ? ok : (ok + 1) % it.step!.options.length;
    await page.locator(`[data-option="${pick}"]`).click();
  }
}

test("друзья по коду, топ друзей, вызов и итог во входящих", async ({ browser }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const ctxA = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const ctxB = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.message));
  await seed(a, "Айжан");
  await seed(b, "Болат");

  // 1. Имена и код друга
  const codeA = await socialName(a, "Айжан");
  await socialName(b, "Болат");

  await b.getByTestId("add-code-input").fill(codeA.toLowerCase());
  await b.getByTestId("add-code-send").click();
  await expect(b.getByTestId("add-code-note")).toContainText("Заявка отправлена");

  await a.reload();
  const req = a.getByTestId("friend-request");
  await expect(req).toContainText("Болат");
  await req.getByTestId("request-accept").click();
  await expect(a.getByTestId("friend-list").getByTestId("friend-row")).toContainText("Болат");
  // Топ друзей: оба (кэш топа сброшен принятием заявки)
  await a.reload();
  const top = a.getByTestId("friends-top");
  await expect(top.locator("li")).toHaveCount(2);
  await expect(top).toContainText("Айжан");
  await expect(top).toContainText("Болат");
  expect(await a.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  // 2. A записывает вызов: хаб → «Вызвать друга» → «10 вопросов»
  await a.goto("/duel");
  await a.getByTestId("duel-invite").click();
  const startRes = a.waitForResponse((r) => r.url().endsWith("/api/duel/start") && r.request().method() === "POST");
  await a.getByTestId("duel-invite-sheet").locator('[data-mode="ten"]').click();
  await a.waitForURL(/\/duel\/rec\?mode=ten&r=[a-z0-9]+$/);
  const start = (await (await startRes).json()) as { seed: number; band: number };
  await expect(a.getByTestId("duel-vs-rival")).toContainText("Запись для друга");
  expect(await savedHearts(a)).toBe(5);
  const deckA = ((await (await a.request.get(`/api/duel/deck?mode=ten&band=${start.band}&seed=${start.seed}`)).json()) as { items: Item[] }).items;
  await playTen(a, deckA, 10);
  const share = a.getByTestId("duel-ch-share");
  await expect(share).toBeVisible({ timeout: 20_000 });
  const url = (await share.getAttribute("data-url"))!;
  expect(url).toMatch(/^\/duel\/c\/[A-Za-z0-9_-]{10}$/);
  expect(await savedHearts(a)).toBe(4);

  // 3. B принимает вызов и играет против записи
  await b.goto(url);
  await expect(b.getByTestId("duel-ch-from")).toContainText("Айжан вызывает тебя");
  await expect(b.getByTestId("duel-ch-score")).toHaveText("10");
  const acceptRes = b.waitForResponse((r) => /\/api\/duel\/challenge\/[^/]+\/accept$/.test(r.url()));
  await b.getByTestId("duel-ch-accept").click();
  const acc = (await (await acceptRes).json()) as { start: { seed: number; band: number } };
  await expect(b.getByTestId("duel-vs-rival").getByTestId("ghost-chip")).toBeVisible();
  const deckB = ((await (await b.request.get(`/api/duel/deck?mode=ten&band=${acc.start.band}&seed=${acc.start.seed}`)).json()) as { items: Item[] }).items;
  expect(deckB.map((x) => x.i)).toEqual(deckA.map((x) => x.i));
  await expect(b.getByTestId("duel-opp").getByTestId("ghost-chip")).toBeVisible({ timeout: 15_000 });
  await playTen(b, deckB, 6);
  const skip = b.getByRole("button", { name: "Показать итоги" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  const result = b.getByTestId("duel-result");
  await expect(result).toBeVisible({ timeout: 20_000 });
  await expect(b.getByTestId("duel-result-rival")).toContainText("Айжан");
  // Проигрыш записи, но принятый вызов засчитан: +1 в топ друзей
  await expect(b.getByTestId("duel-week-pts")).toContainText("+1", { timeout: 15_000 });
  expect(await savedHearts(b)).toBe(4);

  // 4. У A во входящих — итог Болата; в топе у Болата 1 очко
  await a.goto("/duel");
  const inbox = a.getByTestId("duel-inbox");
  await expect(inbox).toContainText("Болат", { timeout: 15_000 });
  await expect(inbox.getByTestId("duel-inbox-item")).toContainText("10 : 6");
  await a.goto("/duel/friends");
  await expect(a.getByTestId("friends-top").locator('li', { hasText: "Болат" }).getByTestId("top-score")).toHaveText("1");

  expect(await b.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});
