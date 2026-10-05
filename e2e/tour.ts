import { expect, type Page } from "@playwright/test";

// Проводник первого входа (#104) в e2e: тесты, которые не про него, ставят подсказки «уже показаны» в сохранение
// или закрывают проводник Escape (так же, как «Пропустить»).

/** Все подсказки проводника отмечены показанными (поле `tips` стора, lib/tips.ts). */
export const ALL_TIPS = Object.fromEntries(
  ["welcome", "lesson-first", "after-first", "nav", "page-practice", "page-tutor", "page-materials", "page-progress", "page-school"].map((id) => [id, 1]),
);

/** Ждёт приветствие проводника на /learn и закрывает его (Escape закрывает весь проводник). */
export async function dismissTour(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Подсказка Бита" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
}
