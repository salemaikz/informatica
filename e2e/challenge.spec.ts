import { expect, test, type Page } from "@playwright/test";
import { currentPoolTag } from "../src/lib/exam-pool";

// Этап 13, пакет B: вызов друга в пробнике (#73). Ссылка `/exam/run?kind&seed&ch=…`: баннер «У друга: …», вход как у любого
// пробника (−1 сердечко), сравнение после итогов, возврат на вызов после онбординга, вызов переживает перезагрузку.

const POOL = currentPoolTag();
const LINK = `/exam/run?kind=mini&seed=42&ch=14-19-${POOL}`;

async function seed(page: Page, lang: "ru" | "kk" = "ru") {
  await page.goto("/onboarding");
  await page.evaluate(
    (lg) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: lg, grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "dark", sound: false, createdAt: 1 },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            // Проводник первого входа (#104) уже пройден — не закрывает экран.
            tips: { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1 },
            hearts: { count: 5, updatedAt: 0, day: "" },
          },
          version: 1,
        }),
      ),
    lang,
  );
}

const savedHearts = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("informatica-v1") ?? "{}").state?.hearts?.count);

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Онбординг ЕНТ до «Поехали» (язык и имя выбираются на первых шагах). */
async function onboardingToFinish(page: Page) {
  await page.getByText("Русский").click();
  await page.getByPlaceholder("Твоё имя").fill("Новичок");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("button", { name: /Готовлюсь к ЕНТ/ }).click();
  await page.getByRole("button", { name: "Пока не знаю" }).click();
  await page.getByRole("button", { name: "Пока не знаю" }).click();
  await page.getByRole("button", { name: "Поехали" }).click();
}

async function finishExam(page: Page) {
  await page.getByRole("button", { name: "Завершить" }).first().click();
  await page.getByRole("button", { name: "Завершить и показать результат" }).click();
  await page.waitForURL("**/exam/result/**");
}

const bannerText = "У друга: 14 из 19. Сможешь больше?";

test("новый ученик: онбординг → сразу баннер вызова → старт → итог со сравнением, перезагрузка не теряет вызов", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LINK);
  await page.waitForURL("**/onboarding");
  await onboardingToFinish(page);
  // Без диагностики и тарифов — сразу на вариант друга.
  await page.waitForURL(/\/exam\/run\?kind=mini&seed=42&ch=14-19-/);
  await expect(page.getByTestId("challenge-banner")).toContainText(bannerText);
  await expect(page.getByTestId("challenge-banner")).not.toContainText("обновились");
  const before = await savedHearts(page);
  await page.getByRole("button", { name: "Начать" }).click();
  await expect(page.getByText("Задание 1").first()).toBeVisible();
  await expect.poll(() => savedHearts(page)).toBe(before - 1);
  // Перезагрузка посередине: попытка и вызов на месте, сердечко второй раз не списывается.
  await page.reload();
  await expect(page.getByText("Задание 1").first()).toBeVisible();
  expect(await savedHearts(page)).toBe(before - 1);
  // Продолжение из хаба: в адресе нет ни варианта, ни вызова — вызов берётся только из сохранённой попытки (C23).
  await page.goto("/exam/run");
  await expect(page.getByText("Задание 1").first()).toBeVisible();
  expect(page.url()).not.toContain("ch=");
  expect(await savedHearts(page)).toBe(before - 1);
  await finishExam(page);
  const cmp = page.getByTestId("challenge-compare");
  await expect(cmp).toBeVisible();
  await expect(cmp).toHaveAttribute("data-outcome", "less");
  await expect(cmp).toContainText("Меньше на 14 — попробуй ещё раз");
  await expect(cmp).toContainText("У друга: 14 из 19 · у тебя: 0 из 19");
  // Пометка «по доле» только у другого варианта.
  await expect(cmp).not.toContainText("по доле");
  // Ссылка из хранилища израсходована.
  expect(await page.evaluate(() => localStorage.getItem("informatica:pending-link"))).toBeNull();
  expect(errors).toEqual([]);
});

test("ученик с профилем: баннер, старт (−1 сердечко), сравнение «столько же»", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  // Друг набрал 0 из 19 — пустая работа даёт «столько же».
  await page.goto(`/exam/run?kind=mini&seed=42&ch=0-19-${POOL}`);
  await expect(page.getByTestId("challenge-banner")).toContainText("У друга: 0 из 19. Сможешь больше?");
  expect(await savedHearts(page)).toBe(5);
  await page.getByRole("button", { name: "Начать" }).click();
  await expect(page.getByText("Задание 1").first()).toBeVisible();
  await expect.poll(() => savedHearts(page)).toBe(4);
  await finishExam(page);
  const cmp = page.getByTestId("challenge-compare");
  await expect(cmp).toHaveAttribute("data-outcome", "same");
  await expect(cmp).toContainText("Столько же, сколько у друга");
  expect(errors).toEqual([]);
});

test("тег банка другой: баннер предупреждает, сравнение — по доле", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/exam/run?kind=mini&seed=42&ch=14-19-0000");
  await expect(page.getByTestId("challenge-banner")).toContainText("Задания обновились — вариант может отличаться, сравним по доле.");
  await page.getByRole("button", { name: "Начать" }).click();
  await expect(page.getByText("Задание 1").first()).toBeVisible();
  await finishExam(page);
  const cmp = page.getByTestId("challenge-compare");
  await expect(cmp).toContainText("по доле");
  await expect(cmp).toContainText("Меньше на 74% — попробуй ещё раз");
  expect(errors).toEqual([]);
});

test("начатый вариант без вызова: ссылка с вызовом дописывает его в попытку", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await page.goto("/exam/run?kind=mini&seed=42");
  await expect(page.getByTestId("challenge-banner")).toHaveCount(0);
  await page.getByRole("button", { name: "Начать" }).click();
  await expect(page.getByText("Задание 1").first()).toBeVisible();
  await expect.poll(() => savedHearts(page)).toBe(4);
  // Открываем ту же работу по ссылке друга: попытка продолжается (бесплатно), вызов в ней появился.
  await page.goto(LINK);
  await expect(page.getByText("Задание 1").first()).toBeVisible();
  expect(await savedHearts(page)).toBe(4);
  await finishExam(page);
  await expect(page.getByTestId("challenge-compare")).toContainText("Меньше на 14");
  expect(errors).toEqual([]);
});

test("вызов в kk: баннер и сравнение на казахском", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, "kk");
  await page.goto(LINK);
  await expect(page.getByTestId("challenge-banner")).toContainText("Досыңда: 19 ішінен 14. Көбірек жинай аласың ба?");
  await page.getByRole("button", { name: "Бастау" }).click();
  await expect(page.getByText("1-тапсырма").first()).toBeVisible();
  await page.getByRole("button", { name: "Аяқтау" }).first().click();
  await page.getByRole("button", { name: "Аяқтап, нәтижені көрсету" }).click();
  await page.waitForURL("**/exam/result/**");
  await expect(page.getByTestId("challenge-compare")).toContainText("Достан 14 аз");
  expect(errors).toEqual([]);
});

test("чужая ссылка на онбординге не запоминается: без ch после онбординга обычная диагностика", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/exam/run?kind=mini&seed=42");
  await page.waitForURL("**/onboarding");
  expect(await page.evaluate(() => localStorage.getItem("informatica:pending-link"))).toBeNull();
  await onboardingToFinish(page);
  await page.waitForURL("**/diagnostic?from=onboarding");
  expect(errors).toEqual([]);
});
