import { defineConfig, devices } from "@playwright/test";

// Сквозные тесты: npm run e2e (сам поднимает production-сервер на порту 3100; другой порт — E2E_PORT, например
// для нескольких рабочих копий одновременно: чужой сервер на 3100 был бы переиспользован с чужим кодом).
// В облачной среде Claude Code: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
const PORT = Number(process.env.E2E_PORT) || 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    // Уведомления разрешены заранее: иначе окно «Включить напоминания» (PushAskAgent) закрывало бы экран во всех сценариях.
    timezoneId: "Asia/Almaty",
    permissions: ["notifications"],
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/onboarding`,
    timeout: 240_000,
    reuseExistingServer: true,
  },
});
