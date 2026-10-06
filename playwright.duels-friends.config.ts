import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Ф3 дуэлей (docs/specs/duels.md §11): друзья и вызовы на двух контекстах браузера. Свой сервер со своими переменными —
// соцчасть в памяти процесса (SOCIAL_MEMORY_OK=1), секрет подписи, тестовые крючки; чужой сервер не переиспользуется.
//   E2E_PORT=3351 PW_CHROMIUM_PATH=… npx playwright test -c playwright.duels-friends.config.ts
// Общий набор (playwright.config.ts) этот сценарий пропускает: там сервер без соцчасти.
process.env.DUEL_SOCIAL_E2E = "1";
const PORT = Number(process.env.E2E_PORT) || 3351;

export default defineConfig({
  ...base,
  testMatch: /duel-friends\.spec\.ts$/,
  timeout: 180_000,
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `${process.env.E2E_SKIP_BUILD === "1" ? "" : "npm run build && "}npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/onboarding`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { ...(process.env as Record<string, string>), SOCIAL_MEMORY_OK: "1", SOCIAL_SECRET: "test", DUEL_TEST_HOOKS: "1" },
  },
});
