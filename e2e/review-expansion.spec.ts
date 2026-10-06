import { test, expect } from '@playwright/test';

async function seed(page: import('@playwright/test').Page, patch: Record<string, unknown> = {}) {
  await page.addInitScript((patch) => {
    if (localStorage.getItem('informatica-v1')) return;
    const now = Date.now();
    const today = new Date(now);
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (patch.aiUsage && typeof patch.aiUsage === 'object') patch.aiUsage = { ...patch.aiUsage, day: todayKey };
    const yesterday = new Date(now - 86_400_000);
    const day = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    localStorage.setItem('informatica-v1', JSON.stringify({ state: { onboarded: true, profile: { name: 'Проверка', lang: 'ru', theme: 'dark', sound: false }, xp: 650, streak: { current: 1, best: 1, lastDay: day }, hearts: { count: 5, refilledAt: now }, chips: 120, lessons: { 'ns-1-binary': { completions: 1, bestAccuracy: 1, lastAt: now, totalXp: 50 } }, ...patch }, version: 0 }));
  }, patch);
}

test('общая подсказка работает при исчерпанном личном лимите и не обращается к модели', async ({ page }) => {
  await seed(page, { aiUsage: { count: 60 } });
  let customCalls = 0;
  page.on('request', request => { if (request.url().includes('/api/ai/tutor')) customCalls++; });
  await page.goto('/drill?mode=skill&skill=ns.bin2dec');
  await page.getByRole('button', { name: 'Начать занятие', exact: true }).click();
  await page.getByRole('button', { name: 'Подсказка', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('разряд');
  await expect(page.getByRole('dialog')).not.toContainText('Не удалось');
  expect(customCalls).toBe(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('informatica-v1')!).state.aiUsage.count)).toBe(60);
});

test('без сердец нельзя начать код, повторение или пробник', async ({ page }) => {
  await seed(page, { hearts: { count: 0, refilledAt: Date.now() } });
  for (const url of ['/code-practice', '/drill?mode=skill&skill=py.loops']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: 'Сердца закончились' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Начать занятие' })).toBeDisabled();
  }
  await page.goto('/ent');
  await page.getByRole('button', { name: 'Вариант 1', exact: true }).click();
  await page.getByRole('button', { name: 'Открыть вариант' }).click();
  await expect(page.getByRole('button', { name: 'Начать занятие' })).toBeDisabled();
});

test('пустой пробник не даёт чипов и не загрязняет аналитику; полный вариант содержит40вопросов', async ({ page }) => {
  await seed(page);
  await page.goto('/ent');
  await page.getByRole('button', { name: 'Вариант 2', exact: true }).click();
  await page.getByRole('button', { name: 'Открыть вариант' }).click();
  await page.getByRole('button', { name: 'Начать занятие' }).click();
  await expect(page.getByText('Отвечено: 0 из 40')).toBeVisible();
  await page.getByRole('button', { name: 'Завершить тест' }).click();
  await page.getByRole('button', { name: 'Проверить тест' }).click();
  await expect(page.getByRole('heading', { name: 'Результат теста' })).toBeVisible();
  await expect(page.getByText('0/50', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('informatica-v1')!).state.chips)).toBe(120);
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('informatica-v1')!).state.questionStats))).toHaveLength(0);
});

test('огонь продолжающейся серии активен, кейс открывается и оформление надевается', async ({ page }) => {
  await seed(page);
  await page.goto('/shop');
  const flame = page.locator('[title="Серия дней"]').first();
  await expect(flame).toHaveClass(/text-streak/);
  await page.getByRole('button', { name: 'Открыть кейс', exact: true }).click();
  await expect(page.getByText('Новое оформление', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Надеть', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('informatica-v1')!).state.equippedCosmeticId)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/audit-assets/2026-10-06/case-equipped-mobile-dark.png' });
});

test('полный пробник записывает 40 первых попыток и ровно одну награду +5', async ({ page }) => {
  await seed(page);
  await page.goto('/ent');
  await page.getByRole('button', { name: 'Вариант 3', exact: true }).click();
  await page.getByRole('button', { name: 'Открыть вариант' }).click();
  await page.getByRole('button', { name: 'Начать занятие' }).click();
  for (let i = 0; i < 40; i++) {
    if (await page.getByRole('radio').count()) await page.getByRole('radio').first().click();
    else if (await page.getByRole('checkbox').count()) await page.getByRole('checkbox').first().click();
    else for (const select of await page.getByRole('combobox').all()) {
      if (await select.locator('option[value="0"]').count()) await select.selectOption('0');
    }
    if (i < 39) await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  }
  await expect(page.getByText('Отвечено: 40 из 40')).toBeVisible();
  await page.getByRole('button', { name: 'Завершить тест' }).click();
  await page.getByRole('button', { name: 'Проверить тест' }).click();
  await expect(page.getByRole('heading', { name: 'Результат теста' })).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('informatica-v1')!).state);
  expect(Object.keys(state.questionStats)).toHaveLength(40);
  expect(state.chipHistory.filter((entry: { reason: string }) => entry.reason === 'ent')).toMatchObject([{ amount: 5 }]);
  expect(state.hearts.count).toBe(4);
  await page.screenshot({ path: 'docs/audit-assets/2026-10-06/ent-results-mobile-dark.png' });
});
