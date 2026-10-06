import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Живые дуэли (этап 16Д, Ф4; docs/specs/duels.md §11): свой сервер со своими переменными — соцчасть в памяти процесса,
// тестовые часы — и никогда чужой уже запущенный (reuseExistingServer: false). Порт — E2E_PORT (по умолчанию 3352).
//   E2E_PORT=3352 npx playwright test -c playwright.duel-live.config.ts
// E2E_SKIP_BUILD=1 — без пересборки (сборка уже есть).
const PORT = Number(process.env.E2E_PORT) || 3352;

export default defineConfig({
  ...base,
  testMatch: /duel-live\.spec\.ts$/,
  workers: 1,
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `${process.env.E2E_SKIP_BUILD ? "" : "npm run build && "}npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/onboarding`,
    timeout: 300_000,
    reuseExistingServer: false,
    // Лог сервера ([social] route=duel.* m=<id6> cmds=N) — в вывод теста: из него считается расход команд на матч.
    stdout: "pipe",
    env: { SOCIAL_MEMORY_OK: "1", SOCIAL_SECRET: "test-e2e-social", DUEL_TEST_HOOKS: "1" },
  },
});
