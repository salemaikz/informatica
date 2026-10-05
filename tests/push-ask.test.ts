import { describe, expect, it } from "vitest";
import {
  EMPTY_PUSH_ASK,
  iosNeedsInstall,
  isPushAskScreen,
  sanitizePushAsk,
  shouldAskPush,
  type PushAskState,
  type PushPermission,
} from "@/lib/push-ask";

// Окно «Включить напоминания» (этап 15, F3): ритм показа 3/7 дней, состояния разрешения, экраны, определение iPhone.

const DAY = 86_400_000;
const CREATED = Date.UTC(2026, 9, 1, 10); // регистрация: 1 октября 2026
const at = (days: number) => CREATED + days * DAY;
const shown = (days: number, count = 1): PushAskState => ({ lastAt: at(days), count });
const ask = (permission: PushPermission, state: PushAskState, days: number, pushOn = false) => shouldAskPush(permission, state, CREATED, at(days), pushOn);

describe("shouldAskPush: первый показ", () => {
  it("ни разу не показывали — сразу, в день регистрации", () => {
    expect(ask("default", EMPTY_PUSH_ASK, 0)).toBe("ask");
  });
  it("и в любой другой день, если окно ещё ни разу не показывали (например, давний ученик)", () => {
    expect(ask("default", EMPTY_PUSH_ASK, 2)).toBe("ask");
    expect(ask("default", EMPTY_PUSH_ASK, 400)).toBe("ask");
  });
  it("регистрации в данных нет (createdAt = 0) — первый показ всё равно сразу", () => {
    expect(shouldAskPush("default", EMPTY_PUSH_ASK, 0, at(0), false)).toBe("ask");
  });
});

describe("shouldAskPush: ритм «3 дня, потом 7»", () => {
  it("в первую неделю повтор — не раньше чем через 3 дня", () => {
    expect(ask("default", shown(0), 0)).toBeNull();
    expect(ask("default", shown(0), 1)).toBeNull();
    expect(ask("default", shown(0), 2.99)).toBeNull();
    expect(ask("default", shown(0), 3)).toBe("ask");
  });
  it("3-й и 6-й день первой недели: показы подряд через 3 дня", () => {
    expect(ask("default", shown(3, 2), 5.9)).toBeNull();
    expect(ask("default", shown(3, 2), 6)).toBe("ask");
  });
  it("после недели с регистрации — раз в 7 дней", () => {
    // Последний показ на 6-й день, сейчас 9-й: 3 дня прошло, но неделя с регистрации уже позади — ждём 7.
    expect(ask("default", shown(6, 3), 9)).toBeNull();
    expect(ask("default", shown(6, 3), 12.99)).toBeNull();
    expect(ask("default", shown(6, 3), 13)).toBe("ask");
  });
  it("ровно на границе недели действует недельный ритм", () => {
    expect(ask("default", shown(4, 2), 7)).toBeNull(); // 3 дня с показа, но это уже 7-й день → ждём 7 дней
    expect(ask("default", shown(4, 2), 11)).toBe("ask");
  });
  it("давний ученик: после показа — только через 7 дней", () => {
    expect(ask("default", shown(100), 105)).toBeNull();
    expect(ask("default", shown(100), 107)).toBe("ask");
  });
  it("часы переведены назад (последний показ «в будущем») — не блокирует показ навсегда", () => {
    expect(ask("default", shown(50), 10)).toBe("ask");
  });
  it("счётчик 0, но время есть, или наоборот — считается «не показывали»", () => {
    expect(ask("default", { lastAt: at(1), count: 0 }, 1)).toBe("ask");
    expect(ask("default", { lastAt: 0, count: 2 }, 1)).toBe("ask");
  });
});

describe("shouldAskPush: состояния разрешения", () => {
  it("разрешено в браузере — не показываем", () => {
    expect(ask("granted", EMPTY_PUSH_ASK, 0)).toBeNull();
    expect(ask("granted", shown(0), 30)).toBeNull();
  });
  it("уже включено в профиле — не показываем, даже если разрешение ещё «default»", () => {
    expect(ask("default", EMPTY_PUSH_ASK, 0, true)).toBeNull();
    expect(ask("denied", EMPTY_PUSH_ASK, 0, true)).toBeNull();
  });
  it("браузер не умеет уведомления — не показываем", () => {
    expect(ask("unsupported", EMPTY_PUSH_ASK, 0)).toBeNull();
    expect(ask("unsupported", shown(0), 30)).toBeNull();
  });
  it("запрещено в браузере — окно-подсказка «разреши в настройках браузера» с тем же ритмом", () => {
    expect(ask("denied", EMPTY_PUSH_ASK, 0)).toBe("blocked-help");
    expect(ask("denied", shown(0), 2)).toBeNull();
    expect(ask("denied", shown(0), 3)).toBe("blocked-help");
    expect(ask("denied", shown(6, 3), 9)).toBeNull();
    expect(ask("denied", shown(6, 3), 13)).toBe("blocked-help");
  });
  it("iPhone без экрана «Домой» — подсказка про установку: сразу, дальше раз в 7 дней (даже в первую неделю)", () => {
    expect(ask("needs-install", EMPTY_PUSH_ASK, 0)).toBe("install-help");
    expect(ask("needs-install", shown(0), 3)).toBeNull();
    expect(ask("needs-install", shown(0), 6.99)).toBeNull();
    expect(ask("needs-install", shown(0), 7)).toBe("install-help");
    expect(ask("needs-install", shown(40), 46)).toBeNull();
    expect(ask("needs-install", shown(40), 47)).toBe("install-help");
  });
});

describe("isPushAskScreen", () => {
  it("главные экраны — да", () => {
    for (const p of ["/learn", "/practice", "/plan", "/stats", "/materials", "/learn/"]) expect(isPushAskScreen(p), p).toBe(true);
  });
  it("урок, тест, игра, тренировка, чат, профиль, онбординг, тарифы — нет", () => {
    for (const p of ["/", "/lesson/ns-1-bits", "/exam/run", "/exam", "/game/sort", "/drill", "/tutor", "/profile", "/onboarding", "/plans", "/diagnostic", "/practice/x"]) {
      expect(isPushAskScreen(p), p).toBe(false);
    }
  });
});

describe("iosNeedsInstall", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
  const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

  it("iPhone в обычной вкладке — нужна установка", () => {
    expect(iosNeedsInstall({ ua: IPHONE, standalone: false })).toBe(true);
  });
  it("iPhone с экрана «Домой» — установка не нужна", () => {
    expect(iosNeedsInstall({ ua: IPHONE, standalone: true })).toBe(false);
  });
  it("iPad в режиме «как компьютер» (назвался Mac, но с сенсорным экраном) — нужна установка", () => {
    expect(iosNeedsInstall({ ua: MAC, platform: "MacIntel", maxTouchPoints: 5, standalone: false })).toBe(true);
  });
  it("Mac и Android — нет", () => {
    expect(iosNeedsInstall({ ua: MAC, platform: "MacIntel", maxTouchPoints: 0, standalone: false })).toBe(false);
    expect(iosNeedsInstall({ ua: ANDROID, platform: "Linux armv81", maxTouchPoints: 5, standalone: false })).toBe(false);
  });
});

describe("sanitizePushAsk", () => {
  it("мусор из localStorage превращается в «не показывали»", () => {
    expect(sanitizePushAsk(null)).toEqual(EMPTY_PUSH_ASK);
    expect(sanitizePushAsk("x")).toEqual(EMPTY_PUSH_ASK);
    expect(sanitizePushAsk([1, 2])).toEqual(EMPTY_PUSH_ASK);
    expect(sanitizePushAsk({ lastAt: -5, count: Number.NaN })).toEqual(EMPTY_PUSH_ASK);
  });
  it("нормальное значение сохраняется, дроби округляются вниз", () => {
    expect(sanitizePushAsk({ lastAt: 1_700_000_000_000.9, count: 2.7 })).toEqual({ lastAt: 1_700_000_000_000, count: 2 });
  });
});
