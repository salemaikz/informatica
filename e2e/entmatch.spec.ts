import { expect, test, type Locator, type Page } from "@playwright/test";
import { lessonBits } from "../src/content/lessons/ns-1-bits";
import { withEntBoss } from "../src/lib/ent-boss";
import { lessonSig } from "../src/lib/lesson-run";
import type { ChoiceStep, EntMatchStep, Text } from "../src/lib/types";

// Этап 14, пакет P3 (#84): «босс урока» — настоящее ЕНТ-«соответствие» 2×4 и «несколько верных» на 6 в конце урока.
// Чтобы не проходить урок целиком, ученика «возвращаем» на последнее задание ЕНТ незаконченного урока: сохранение
// прохождения (#41) кладём в localStorage заранее (вход оплачен), последнее задание проходим руками, дальше —
// шаг entmatch и шаг multi, которые код вставил в урок. ИИ в тестах не нужен.

const boss = withEntBoss(lessonBits);
const at = boss.steps.findIndex((s) => s.type === "entmatch");
const entmatch = boss.steps[at] as EntMatchStep;
const lastEnt = boss.steps[at - 1] as ChoiceStep;
if (at < 1 || lastEnt.type !== "choice") throw new Error("перед entmatch ожидалось задание choice");
const ru = (t: Text) => (typeof t === "string" ? t : t.ru);

/** Сохранение урока на последнем задании ЕНТ (перед вставленным «соответствием»). */
function runBeforeBoss() {
  const now = Date.now();
  return {
    lessonId: boss.id,
    sig: lessonSig(boss.steps),
    queue: boss.steps.map((s) => ({ id: s.id, retry: false })),
    pos: at - 1,
    done: at - 1,
    records: [],
    xp: 20,
    combo: 2,
    maxCombo: 2,
    skipped: 0,
    activeMs: 60_000,
    xpFactor: 1,
    chipsEarned: 0,
    cost: 1,
    startedAt: now - 120_000,
    updatedAt: now,
    paidAt: now,
  };
}

async function seed(page: Page, theme: "light" | "dark" = "dark") {
  await page.route("**/api/ai/**", (route) => route.fulfill({ status: 503, body: "" }));
  await page.goto("/onboarding");
  await page.evaluate(
    ({ run, theme }) =>
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme, sound: false, createdAt: 1 },
            hearts: { count: 5, updatedAt: Date.now(), day: "" },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            // Проводник первого входа (#104) уже пройден — не закрывает экран.
            tips: { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1, "page-shop": 1, "page-profile": 1 },
            lessonRuns: { [run.lessonId]: run },
          },
          version: 2,
        }),
      ),
    { run: runBeforeBoss(), theme },
  );
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Главная кнопка нижней панели: «Проверить» / «Продолжить». */
const footerButton = (page: Page) => page.locator("footer button").last();

/** С экрана «Урок не закончен» — на сохранённое задание, верный ответ, дальше — на «соответствие». */
async function toEntMatch(page: Page) {
  await page.goto(`/lesson/${boss.id}`);
  await expect(page.getByRole("heading", { name: "Урок не закончен" })).toBeVisible();
  await page.getByRole("button", { name: /Продолжить/ }).click();
  await page.getByRole("button", { name: ru(lastEnt.options[lastEnt.correct]), exact: true }).click();
  await page.getByRole("button", { name: "Проверить" }).click();
  await footerButton(page).click();
  await expect(page.getByRole("radiogroup")).toHaveCount(2);
}

const row = (page: Page, i: number) => page.getByRole("radiogroup", { name: new RegExp(`^${"AB"[i]} —`) });
const num = (group: Locator, n: number) => group.getByRole("radio", { name: `Описание ${n + 1}` });
/** Номер, который заведомо не верный для пункта. */
const wrongFor = (i: number) => (entmatch.answer[i] + 1) % 4;

test("урок: после заданий ЕНТ — «соответствие» A/B × 1–4, верно оба пункта: 2 балла", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await toEntMatch(page);

  // Бланк как на ЕНТ: пометка формата, описания 1–4, два пункта с номерами; «Проверить» ждёт оба ответа.
  await expect(page.getByText("Формат ЕНТ")).toBeVisible();
  await expect(page.getByText("Для каждого пункта выбери одно описание")).toBeVisible();
  await expect(page.getByRole("list", { name: "Описания" }).getByRole("listitem")).toHaveCount(4);
  await expect(page.getByRole("radio")).toHaveCount(8);
  const check = page.getByRole("button", { name: "Проверить" });
  await expect(check).toBeDisabled();
  await num(row(page, 0), entmatch.answer[0]).click();
  await expect(num(row(page, 0), entmatch.answer[0])).toHaveAttribute("aria-checked", "true");
  await expect(check).toBeDisabled();
  await num(row(page, 1), entmatch.answer[1]).click();
  await expect(check).toBeEnabled();

  await check.click();
  await expect(page.getByText("2 балла")).toBeVisible();
  await expect(num(row(page, 0), entmatch.answer[0])).toHaveClass(/border-success/);
  await expect(num(row(page, 1), entmatch.answer[1])).toHaveClass(/border-success/);
  await expect(page.locator("footer").getByText("Неверно")).toHaveCount(0);
  await expect(page.locator("footer").getByText("Почти!")).toHaveCount(0);

  // Дальше — «несколько верных» на 6 вариантов (тоже вставлено уроком).
  await footerButton(page).click();
  await expect(page.getByText("Выбери все верные варианты")).toBeVisible();
  await expect(page.getByText("Формат ЕНТ")).toBeVisible();
  await expect(page.locator("main button[aria-pressed]")).toHaveCount(6);
  expect(errors).toEqual([]);
});

test("урок: «соответствие» — один пункт верно: 1 балл, янтарным; неверный номер красный, верный зелёный", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, "light");
  await toEntMatch(page);

  await num(row(page, 0), entmatch.answer[0]).click();
  await num(row(page, 1), wrongFor(1)).click();
  await page.getByRole("button", { name: "Проверить" }).click();

  await expect(page.getByText("1 балл", { exact: true })).toBeVisible();
  await expect(page.locator("footer").getByText("Почти!")).toBeVisible();
  await expect(page.getByText("Правильный ответ:")).toBeVisible();
  await expect(num(row(page, 0), entmatch.answer[0])).toHaveClass(/border-success/);
  await expect(num(row(page, 1), wrongFor(1))).toHaveClass(/border-danger/);
  await expect(num(row(page, 1), entmatch.answer[1])).toHaveClass(/border-success/);
  // После проверки выбор заблокирован.
  await expect(num(row(page, 1), 0)).toBeDisabled();
  expect(errors).toEqual([]);
});

test("урок: «соответствие» — оба пункта неверно: 0 баллов", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await toEntMatch(page);

  await num(row(page, 0), wrongFor(0)).click();
  await num(row(page, 1), wrongFor(1)).click();
  await page.getByRole("button", { name: "Проверить" }).click();

  await expect(page.getByText("0 баллов")).toBeVisible();
  await expect(page.locator("footer").getByText("Неверно")).toBeVisible();
  await expect(num(row(page, 0), wrongFor(0))).toHaveClass(/border-danger/);
  await expect(num(row(page, 0), entmatch.answer[0])).toHaveClass(/border-success/);
  expect(errors).toEqual([]);
});

test("урок: «соответствие» — один номер можно выбрать у обоих пунктов; цифры и стрелки на клавиатуре", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page);
  await toEntMatch(page);

  // Цифра выбирает описание для первого пункта без ответа, потом для следующего.
  await page.keyboard.press("3");
  await page.keyboard.press("3");
  await expect(num(row(page, 0), 2)).toHaveAttribute("aria-checked", "true");
  await expect(num(row(page, 1), 2)).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Проверить" })).toBeEnabled();

  // Стрелка вправо внутри пункта — к соседнему номеру (как у радиокнопок).
  await num(row(page, 0), 2).focus();
  await page.keyboard.press("ArrowRight");
  await expect(num(row(page, 0), 3)).toHaveAttribute("aria-checked", "true");
  await expect(num(row(page, 0), 2)).toHaveAttribute("aria-checked", "false");
  expect(errors).toEqual([]);
});

test("урок: «соответствие» на 360 px — без горизонтальной прокрутки, номера не меньше 44 px", async ({ page }) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page);
  await toEntMatch(page);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const i of [0, 1]) {
    for (let n = 0; n < 4; n++) {
      const box = await num(row(page, i), n).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  expect(errors).toEqual([]);
});
