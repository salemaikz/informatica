import { expect, type Page } from "@playwright/test";

// Бит-проводник (этап 16В, P2a) в e2e: тесты, которые не про него, ставят сцены «уже показаны» в сохранение
// или закрывают проводник Escape (так же, как «Пропустить»).

/** Все сцены проводника отмечены показанными (поле `tips` стора, lib/tips.ts). */
export const ALL_TIPS = Object.fromEntries(
  ["welcome", "lesson-first", "after-first", "nav", "page-practice", "page-tutor", "page-materials", "page-progress", "page-school", "page-shop", "page-profile"].map(
    (id) => [id, 1],
  ),
);

/**
 * Ждёт Бита-проводника на /learn и закрывает его (Escape закрывает весь проводник). Пузырь Бита — «Подсказка Бита»:
 * без затемнения это `status`, с затемнением — `dialog`.
 */
export async function dismissTour(page: Page) {
  const bit = page.getByLabel("Подсказка Бита");
  await expect(bit).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bit).toBeHidden();
}
