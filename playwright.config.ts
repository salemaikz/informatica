import { defineConfig, devices } from "@playwright/test";

// Сквозные тесты: npm run e2e (сам поднимает production-сервер на порту 3100).
// В облачной среде Claude Code: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100",
    ...devices["Pixel 7"],
    timezoneId: "Asia/Almaty",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100/onboarding",
    timeout: 240_000,
    reuseExistingServer: true,
  },
});
