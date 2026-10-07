import { expect, test } from "@playwright/test";

test("медиагалерея открывается при запрете записи локального прогресса", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Storage quota exceeded", "QuotaExceededError"); };
  });
  await page.goto("/video-lab/variants-2026-10-07");
  await expect(page.getByRole("heading", { name: "Новые визуалы и видео", exact: true })).toBeVisible();
  await expect(page.locator("button[data-variant]")).toHaveCount(6);
  await page.locator('button[data-variant="teach"]').click();
  await expect(page.getByRole("checkbox", { name: "Фоновая музыка" })).not.toBeChecked();
  const seek = page.getByRole("slider", { name: "Позиция воспроизведения" });
  await seek.focus();
  await seek.press("End");
  await expect(page.locator('[data-preview-canvas="teach"]')).toContainText("Сравни и запомни");
  await page.getByRole("button", { name: "Қазақша", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Жаңа көрнекіліктер мен бейнелер", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Бейнені ойнату", exact: true })).toBeVisible();
});
