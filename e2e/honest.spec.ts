import { expect, test, type Page } from "@playwright/test";
import { lessonBinary } from "../src/content/lessons/ns-1-binary";
import { lessonBits } from "../src/content/lessons/ns-1-bits";
import { withEntBoss } from "../src/lib/ent-boss";
import { lessonSig } from "../src/lib/lesson-run";
import type { AnswerRecord, EntMatchStep, Lesson, MultiStep } from "../src/lib/types";

// Этап 12 (v0.11), пакет P4: честные цифры в итогах урока (#66) — пропуск и подсказка не дают «100%».
// Чтобы не проходить урок целиком, ученика «возвращаем» в конец незаконченного урока: сохранение прохождения (#41)
// кладём в localStorage заранее (вход оплачен, окно без повторной платы не истекло), а последнее задание проходим руками.
// ИИ в тестах не нужен: отзыв после урока при 503 показывает статический текст.

type Seed = { lessonRuns: Record<string, unknown>; days?: Record<string, unknown> };

async function seed(page: Page, { lessonRuns, days }: Seed) {
  await page.route("**/api/ai/**", (route) => route.fulfill({ status: 503, body: "" }));
  await page.goto("/onboarding");
  await page.evaluate(
    ({ runs, dayStat }) => {
      // День — по местной дате браузера, как у стора (todayKey).
      const d = new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      localStorage.setItem(
        "informatica-v1",
        JSON.stringify({
          state: {
            onboarded: true,
            profile: { name: "Т", lang: "ru", grade: "11", goal: "ent", style: "short", dailyGoalXp: 50, theme: "dark", sound: false, createdAt: 1 },
            hearts: { count: 5, updatedAt: Date.now(), day: "" },
            paywall: { lastShownAt: 4102444800000, views: 1 },
            // Проводник первого входа (#104) уже пройден — не закрывает экран.
            tips: { welcome: 1, "lesson-first": 1, "after-first": 1, nav: 1, "page-practice": 1, "page-tutor": 1, "page-materials": 1, "page-progress": 1, "page-school": 1 },
            lessonRuns: runs,
            ...(dayStat ? { days: { [key]: dayStat } } : {}),
          },
          version: 2,
        }),
      );
    },
    { runs: lessonRuns, dayStat: days ?? null },
  );
}

/** Верный ответ с первой попытки — запись в сохранении. */
const correct = (stepId: string, skill: string): AnswerRecord => ({ stepId, skill, correct: true, score: 1, given: "1", expected: "1", prompt: "?", retry: false, timeMs: 2000 });

/**
 * Сохранение урока на шаге stepId: все шаги до него пройдены, вход оплачен только что.
 * Шаги — как у плеера: с «боссом урока» (withEntBoss, этап 14), иначе отпечаток sig не совпадёт и сохранение сбросится.
 */
function runAt(base: Lesson, stepId: string, records: AnswerRecord[]) {
  const lesson = withEntBoss(base);
  const pos = lesson.steps.findIndex((s) => s.id === stepId);
  if (pos < 0) throw new Error(`нет шага ${stepId}`);
  const now = Date.now();
  return {
    lessonId: lesson.id,
    sig: lessonSig(lesson.steps),
    queue: lesson.steps.map((s) => ({ id: s.id, retry: false })),
    pos,
    done: pos,
    records,
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

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Главная кнопка нижней панели: «Проверить» / «Продолжить». */
const footerButton = (page: Page) => page.locator("footer button").last();

/** С экрана «Урок не закончен» — в плеер, на сохранённый шаг. */
async function resume(page: Page, lessonId: string) {
  await page.goto(`/lesson/${lessonId}`);
  await expect(page.getByRole("heading", { name: "Урок не закончен" })).toBeVisible();
  await page.getByRole("button", { name: /Продолжить/ }).click();
}

/** Плитка итогов или статистики с подписью «Точность»: ближайший блок с рамкой вокруг подписи. */
const accuracyTile = (page: Page) => page.getByText("Точность", { exact: true }).first().locator("xpath=ancestor::div[contains(@class,'border-2')][1]");

// Два задания верно, решение по фото пропущено: 2 из 3 = 67%, а не «100%».
const binaryRun = () =>
  runAt(lessonBinary, "q-solution-45", [correct("q-digits", "ns.base"), correct("q-bits-13", "ns.bin2dec")]);

test("урок: пропуск решения по фото — точность меньше 100%, «пропущено: 1»", async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, { lessonRuns: { [lessonBinary.id]: binaryRun() } });
  await resume(page, lessonBinary.id);

  // Последний шаг — развёрнутое решение: пропускаем.
  await page.getByRole("button", { name: "Пропустить" }).click();

  await expect(page.getByRole("heading", { name: "Урок пройден!" })).toBeVisible();
  await expect(accuracyTile(page)).toContainText("67%");
  await expect(accuracyTile(page)).not.toContainText("100%");
  await expect(page.getByText("без подсказки: 2 из 3")).toBeVisible();
  await expect(page.getByText("пропущено: 1")).toBeVisible();
  // «С подсказкой» при нуле не показываем; пропуск — не ошибка: карточки «Последние ошибки» нет.
  await expect(page.getByText(/с подсказкой:/)).toHaveCount(0);
  await expect(page.getByText("Последние ошибки")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("урок: подсказка до ответа — «с подсказкой: 1», самостоятельных меньше", async ({ page }) => {
  const errors = trackErrors(page);
  const run = runAt(lessonBits, "bits-q-ent-6lamps", [correct("bits-q-bit-values", "ns.base"), correct("bits-q-lamps3", "ns.base")]);
  await seed(page, { lessonRuns: { [lessonBits.id]: run } });
  await resume(page, lessonBits.id);

  // Последнее задание: открываем подсказку (бесплатный текст автора), закрываем и отвечаем верно.
  await page.getByRole("button", { name: /Подсказка/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "64", exact: true }).click();
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText("Неверно")).toHaveCount(0);

  // Дальше — «босс урока», вставленный кодом: «соответствие» и «несколько верных» (ответы берём из самих шагов).
  const boss = withEntBoss(lessonBits).steps;
  const entmatch = boss.find((s) => s.type === "entmatch") as EntMatchStep;
  const multi = boss.find((s) => s.type === "multi" && s.ent && s.options.length === 6) as MultiStep;
  await footerButton(page).click(); // → «соответствие»
  for (const [i, row] of ["A", "B"].entries()) {
    await page.getByRole("radiogroup", { name: new RegExp(`^${row} —`) }).getByRole("radio", { name: `Описание ${entmatch.answer[i] + 1}` }).click();
  }
  await page.getByRole("button", { name: "Проверить" }).click();
  await footerButton(page).click(); // → «несколько верных»
  for (const i of multi.correct) await page.locator("main button[aria-pressed]").nth(i).click();
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText("Неверно")).toHaveCount(0);

  // Потом теория «Где это встречается» и финальная история; потом итоги.
  await footerButton(page).click(); // → теория
  await footerButton(page).click(); // → финальная история
  await footerButton(page).click(); // → итоги

  await expect(page.getByRole("heading", { name: "Урок пройден!" })).toBeVisible();
  await expect(page.getByText("с подсказкой: 1")).toBeVisible();
  await expect(page.getByText("без подсказки: 4 из 5")).toBeVisible();
  // Верный ответ с подсказкой в точность входит, а «пропущено» не появляется.
  await expect(accuracyTile(page)).toContainText("100%");
  await expect(page.getByText(/пропущено:/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("статистика после урока: точность совпадает с итогами урока", async ({ page }) => {
  const errors = trackErrors(page);
  // Два верных ответа до выхода уже лежат и в сохранении урока, и в дне — как после настоящего прохождения.
  await seed(page, {
    lessonRuns: { [lessonBinary.id]: binaryRun() },
    days: { xp: 20, answers: 2, correct: 2, seconds: 0, asked: 2, score: 2 },
  });
  await resume(page, lessonBinary.id);
  await page.getByRole("button", { name: "Пропустить" }).click();
  await expect(page.getByRole("heading", { name: "Урок пройден!" })).toBeVisible();
  await expect(accuracyTile(page)).toContainText("67%");

  // Тот же процент на странице статистики (день: 2 верных задания + 1 пропуск = 2 из 3).
  // Блок ищем по подписи «Точность» и по числу — разметка плиток на странице может меняться.
  await page.goto("/stats");
  await expect(page.locator("div.border-2").filter({ hasText: "Точность" }).filter({ hasText: "67%" }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
