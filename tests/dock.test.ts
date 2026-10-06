import { describe, expect, it } from "vitest";
import {
  CLOSE_SWIPE_PX,
  DOCK_PAGES,
  dockVisible,
  HIDE_SWIPE_PX,
  nextHopDelayMs,
  pickDockChat,
  releaseVelocity,
  REVEAL_SWIPE_PX,
  SCROLL_AWAY_PX,
  scrollAwayStep,
  swipeClosesSheet,
  swipeHidesDock,
  swipeRevealsDock,
} from "@/lib/dock";
import type { ChatMeta } from "@/lib/chats";
import { dockDict } from "@/i18n/parts/dock";
import { dict } from "@/i18n/dict";
import { defaultProfile, mergeState, useApp } from "@/lib/store";
import { NAV_GROUPS, hubGroup } from "@/components/app/nav";

const chat = (id: string, updatedAt: number, over: Partial<ChatMeta> = {}): ChatMeta => ({
  id,
  title: "",
  mode: "free",
  createdAt: updatedAt,
  updatedAt,
  preview: "",
  count: 0,
  ...over,
});

describe("dockVisible: где живёт плавающая кнопка Бита", () => {
  it.each(DOCK_PAGES)("главная страница %s — показывать", (p) => {
    expect(dockVisible(p)).toBe(true);
  });

  it("игнорирует хвостовой слэш и query", () => {
    expect(dockVisible("/learn/")).toBe(true);
    expect(dockVisible("/shop?x=1")).toBe(true);
    expect(dockVisible("/stats#top")).toBe(true);
  });

  it.each([
    "/tutor",
    "/tutor/abc123",
    "/lesson/ns-1-bits",
    "/drill",
    "/game/bet",
    "/exam/run",
    "/exam/result/1",
    "/diagnostic",
    "/onboarding",
    "/code/python/py-1",
    "/notes/abc",
    "/theory/ns-1-bits",
    "/history/xyz",
    "/plans",
    "/feedback",
    "/",
    "/examples",
  ])("%s — не показывать", (p) => {
    expect(dockVisible(p)).toBe(false);
  });

  it("все хабы подразделов навигации — главные страницы кнопки", () => {
    for (const g of NAV_GROUPS) {
      expect(dockVisible(g.href), g.id).toBe(true);
      for (const s of g.subs) if (s.href && s.href !== "/plans") expect(dockVisible(s.href), s.id).toBe(true);
    }
    // Всё, где рисуется строка подразделов, — главные страницы.
    for (const p of ["/practice", "/exam", "/code", "/history", "/notes", "/theory", "/search", "/materials", "/stats", "/shop", "/profile"]) {
      expect(hubGroup(p), p).not.toBeNull();
      expect(dockVisible(p), p).toBe(true);
    }
  });
});

describe("pickDockChat: какой чат открыть в панели", () => {
  it("чатов нет — undefined (панель создаст новый)", () => {
    expect(pickDockChat([])).toBeUndefined();
  });

  it("берёт последний по updatedAt, закрепление не в счёт", () => {
    const list = [chat("a", 100, { pinned: true }), chat("b", 300), chat("c", 200)];
    expect(pickDockChat(list)?.id).toBe("b");
  });

  it("при равенстве — первый в списке (в сторе новые чаты стоят первыми)", () => {
    expect(pickDockChat([chat("new", 100), chat("old", 100)])?.id).toBe("new");
  });

  it("пустой свежий чат тоже «последний» — его переиспользуем, а не плодим новые", () => {
    const list = [chat("empty", 500, { count: 0 }), chat("talk", 400, { count: 6 })];
    expect(pickDockChat(list)?.id).toBe("empty");
  });
});

describe("жесты", () => {
  it("свайп вправо по кнопке: от 40 px или быстрый взмах", () => {
    expect(swipeHidesDock(HIDE_SWIPE_PX, 0)).toBe(true);
    expect(swipeHidesDock(HIDE_SWIPE_PX - 1, 0)).toBe(false);
    expect(swipeHidesDock(15, 0.8)).toBe(true); // взмах
    expect(swipeHidesDock(5, 2)).toBe(false); // почти без сдвига — не считается
    expect(swipeHidesDock(-80, 0)).toBe(false); // влево кнопку не прячет
    expect(swipeHidesDock(80, -2)).toBe(true); // сдвиг важнее скорости назад
  });

  it("свайп влево по язычку: от 24 px или взмах", () => {
    expect(swipeRevealsDock(-REVEAL_SWIPE_PX, 0)).toBe(true);
    expect(swipeRevealsDock(-(REVEAL_SWIPE_PX - 1), 0)).toBe(false);
    expect(swipeRevealsDock(-12, -0.9)).toBe(true);
    expect(swipeRevealsDock(-3, -3)).toBe(false);
    expect(swipeRevealsDock(60, 0)).toBe(false);
  });

  it("свайп вниз по ручке шторки: от 100 px или взмах", () => {
    expect(swipeClosesSheet(CLOSE_SWIPE_PX, 0)).toBe(true);
    expect(swipeClosesSheet(CLOSE_SWIPE_PX - 1, 0)).toBe(false);
    expect(swipeClosesSheet(40, 0.9)).toBe(true);
    expect(swipeClosesSheet(10, 5)).toBe(false);
    expect(swipeClosesSheet(-50, -1)).toBe(false);
  });

  it("скорость отпускания: по последним 100 мс", () => {
    expect(releaseVelocity([])).toBe(0);
    expect(releaseVelocity([{ t: 0, v: 0 }])).toBe(0);
    // 50 px за 50 мс = 1 px/мс
    expect(releaseVelocity([{ t: 0, v: 0 }, { t: 50, v: 50 }])).toBeCloseTo(1);
    // старые точки (раньше 100 мс до конца) не в счёт: рывок ушёл, палец почти остановился
    const slow = [
      { t: 0, v: 0 },
      { t: 20, v: 100 },
      { t: 200, v: 105 },
      { t: 260, v: 106 },
    ];
    expect(releaseVelocity(slow)).toBeCloseTo((106 - 105) / 60);
    // влево — отрицательная
    expect(releaseVelocity([{ t: 0, v: 100 }, { t: 40, v: 60 }])).toBeCloseTo(-1);
    // одинаковое время — не делим на ноль
    expect(releaseVelocity([{ t: 5, v: 0 }, { t: 5, v: 50 }])).toBe(0);
  });
});

describe("подпрыгивание Бита", () => {
  it("раз в 32–48 секунд", () => {
    expect(nextHopDelayMs(0)).toBe(32_000);
    expect(nextHopDelayMs(1)).toBe(48_000);
    expect(nextHopDelayMs(0.5)).toBe(40_000);
    // r вне 0…1 не выводит за границы
    expect(nextHopDelayMs(-3)).toBe(32_000);
    expect(nextHopDelayMs(9)).toBe(48_000);
  });
});

describe("profile.bitHidden", () => {
  it("по умолчанию кнопка видна", () => {
    expect(defaultProfile.bitHidden).toBe(false);
  });

  it("старые сохранения без поля и мусор → false; true сохраняется", () => {
    const base = useApp.getState();
    expect(mergeState({ profile: { name: "Т" } }, base).profile.bitHidden).toBe(false);
    expect(mergeState({ profile: { bitHidden: "да" } }, base).profile.bitHidden).toBe(false);
    expect(mergeState({ profile: { bitHidden: 1 } }, base).profile.bitHidden).toBe(false);
    expect(mergeState({ profile: { bitHidden: true } }, base).profile.bitHidden).toBe(true);
  });

  it("updateProfile меняет и возвращает флаг", () => {
    useApp.getState().updateProfile({ bitHidden: true });
    expect(useApp.getState().profile.bitHidden).toBe(true);
    useApp.getState().updateProfile({ bitHidden: false });
    expect(useApp.getState().profile.bitHidden).toBe(false);
  });
});

describe("строки dock.*", () => {
  it("у всех ключей есть ru и kk, они попали в общий словарь и без эмодзи", () => {
    const keys = Object.keys(dockDict);
    expect(keys.length).toBeGreaterThan(0);
    for (const [key, v] of Object.entries(dockDict)) {
      expect(key.startsWith("dock."), key).toBe(true);
      expect(v.ru.trim(), key).toBeTruthy();
      expect(v.kk.trim(), key).toBeTruthy();
      expect(v.kk, key).not.toBe(v.ru);
      expect(v.ru + v.kk, key).not.toMatch(/\p{Extended_Pictographic}/u);
      expect((dict as Record<string, { ru: string; kk: string }>)[key], key).toEqual(v);
    }
  });
});

describe("scrollAwayStep: кнопка уходит в тень при прокрутке вниз", () => {
  it("мелкие сдвиги копятся до порога; от порога кнопка «ушла»", () => {
    let st = scrollAwayStep(0, 10);
    expect(st).toEqual({ acc: 10, away: false });
    st = scrollAwayStep(st.acc, SCROLL_AWAY_PX - 10);
    expect(st.away).toBe(true);
    st = scrollAwayStep(st.acc, 5);
    expect(st.away).toBe(true);
  });

  it("прокрутка вверх сбрасывает счёт и возвращает кнопку сразу", () => {
    expect(scrollAwayStep(100, -1)).toEqual({ acc: 0, away: false });
    expect(scrollAwayStep(scrollAwayStep(100, -3).acc, 10).away).toBe(false); // после «вверх» счёт с нуля
  });
});
