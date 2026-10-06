import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeState, defaultProfile, useApp } from "@/lib/store";
import { DEFAULT_MUSIC, MUSIC_FILES, resolveTrack, sanitizeMusic, shouldPlayMusic, type MusicInputs } from "@/lib/music-pref";
import { fitBox, formatClock } from "@/videos/seek";

const base: MusicInputs = { pref: { enabled: true, track: "auto" }, sound: true, activity: "game", videoPlaying: false, hidden: false };

describe("настройка музыки", () => {
  it("по умолчанию выключена, трек — авто", () => {
    expect(DEFAULT_MUSIC).toEqual({ enabled: false, track: "auto" });
    expect(defaultProfile.music).toEqual({ enabled: false, track: "auto" });
  });
  it("санитайзер: мусор → выключено; допустимые значения сохраняются", () => {
    expect(sanitizeMusic(undefined)).toEqual(DEFAULT_MUSIC);
    expect(sanitizeMusic("on")).toEqual(DEFAULT_MUSIC);
    expect(sanitizeMusic({ enabled: "yes", track: "pop" })).toEqual(DEFAULT_MUSIC);
    expect(sanitizeMusic({ enabled: true, track: "arcade" })).toEqual({ enabled: true, track: "arcade" });
    expect(sanitizeMusic({ enabled: true, track: "focus" })).toEqual({ enabled: true, track: "focus" });
  });
  it("старое сохранение без music загружается с выключенной музыкой", () => {
    const st = mergeState({ onboarded: true, profile: { lang: "kk", sound: true } } as never, useApp.getState());
    expect(st.profile.music).toEqual(DEFAULT_MUSIC);
    const st2 = mergeState({ profile: { music: { enabled: true, track: "focus" } } } as never, useApp.getState());
    expect(st2.profile.music).toEqual({ enabled: true, track: "focus" });
  });
});

describe("выбор трека и условия игры", () => {
  it("авто: игры — Bit Arcade, учёба — Quiet Focus; явный выбор сильнее занятия", () => {
    expect(resolveTrack("auto", "game")).toBe("arcade");
    expect(resolveTrack("auto", "focus")).toBe("focus");
    expect(resolveTrack("focus", "game")).toBe("focus");
    expect(resolveTrack("arcade", "focus")).toBe("arcade");
  });
  it("играет только при включённой музыке, звуке, экране-владельце, без видео и в видимой вкладке", () => {
    expect(shouldPlayMusic(base)).toBe(true);
    expect(shouldPlayMusic({ ...base, pref: { enabled: false, track: "auto" } })).toBe(false);
    expect(shouldPlayMusic({ ...base, sound: false })).toBe(false);
    expect(shouldPlayMusic({ ...base, activity: null })).toBe(false);
    expect(shouldPlayMusic({ ...base, videoPlaying: true })).toBe(false);
    expect(shouldPlayMusic({ ...base, hidden: true })).toBe(false);
  });
  it("файлы треков — сжатые (ogg/m4a), не WAV", () => {
    for (const f of Object.values(MUSIC_FILES)) {
      expect(f.ogg).toMatch(/\.ogg$/);
      expect(f.m4a).toMatch(/\.m4a$/);
    }
  });
});

describe("панель видео: время и вписывание", () => {
  it("formatClock: м:сс", () => {
    expect(formatClock(0, 30)).toBe("0:00");
    expect(formatClock(30 * 65, 30)).toBe("1:05");
    expect(formatClock(-5, 30)).toBe("0:00");
    expect(formatClock(NaN, 30)).toBe("0:00");
  });
  it("fitBox: вписывает по меньшей стороне, мусор → 0", () => {
    expect(fitBox(800, 400, 1)).toEqual({ w: 400, h: 400 });
    expect(fitBox(300, 900, 1)).toEqual({ w: 300, h: 300 });
    expect(fitBox(0, 400, 1)).toEqual({ w: 0, h: 0 });
  });
});

// Контроллер: подменяем Audio, window и document (окружение vitest — node).
describe("контроллер музыки", () => {
  const plays: string[] = [];
  let pauses = 0;
  let docHidden = false;
  const docListeners: Record<string, (() => void)[]> = {};

  class FakeAudio {
    loop = false;
    preload = "";
    volume = 1;
    private s = "";
    getAttribute() {
      return this.s || null;
    }
    set src(v: string) {
      this.s = v;
    }
    canPlayType(type: string) {
      return type.includes("ogg") ? "probably" : "";
    }
    play() {
      plays.push(this.s);
      return Promise.resolve();
    }
    pause() {
      pauses++;
    }
  }

  type M = typeof import("@/lib/music");
  let m: M;
  beforeEach(async () => {
    plays.length = 0;
    pauses = 0;
    docHidden = false;
    for (const k of Object.keys(docListeners)) delete docListeners[k];
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("window", { addEventListener: () => {} });
    vi.stubGlobal("document", {
      get hidden() {
        return docHidden;
      },
      addEventListener: (ev: string, cb: () => void) => (docListeners[ev] ??= []).push(cb),
    });
    vi.resetModules();
    m = await import("@/lib/music");
  });
  afterEach(() => {
    m.resetMusicForTests();
    vi.unstubAllGlobals();
  });
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("выключено по настройке — не играет, даже на экране-владельце", async () => {
    const owner = Symbol("a");
    m.setMusicPref({ enabled: false, track: "auto" }, true);
    m.enterMusic(owner, "game");
    await flush();
    expect(plays).toEqual([]);
    expect(m.getMusicSnapshot().playing).toBe(false);
  });

  it("включено: игра — bit-arcade.ogg, выход останавливает", async () => {
    const owner = Symbol("a");
    m.setMusicPref({ enabled: true, track: "auto" }, true);
    m.enterMusic(owner, "game");
    await flush();
    expect(plays).toEqual(["/media/music/bit-arcade.ogg"]);
    expect(m.getMusicSnapshot().playing).toBe(true);
    m.exitMusic(owner);
    expect(m.getMusicSnapshot().playing).toBe(false);
    expect(m.getMusicSnapshot().activity).toBe(null);
    expect(pauses).toBeGreaterThan(0);
  });

  it("урок — quiet-focus; «Звук» выключен — тишина", async () => {
    const owner = Symbol("a");
    m.setMusicPref({ enabled: true, track: "auto" }, false);
    m.enterMusic(owner, "focus");
    await flush();
    expect(plays).toEqual([]);
    m.setMusicPref({ enabled: true, track: "auto" }, true);
    await flush();
    expect(plays).toEqual(["/media/music/quiet-focus.ogg"]);
  });

  it("видео урока ставит музыку на паузу, после видео — возвращает", async () => {
    const owner = Symbol("a");
    m.setMusicPref({ enabled: true, track: "auto" }, true);
    m.enterMusic(owner, "focus");
    await flush();
    expect(m.getMusicSnapshot().playing).toBe(true);
    m.setMusicVideoPlaying(true);
    expect(m.getMusicSnapshot().playing).toBe(false);
    m.setMusicVideoPlaying(false);
    await flush();
    expect(m.getMusicSnapshot().playing).toBe(true);
  });

  it("скрытая вкладка — пауза, видимая — продолжение; старый владелец не гасит нового", async () => {
    const a = Symbol("a");
    const b = Symbol("b");
    m.setMusicPref({ enabled: true, track: "auto" }, true);
    m.enterMusic(a, "focus");
    await flush();
    docHidden = true;
    docListeners.visibilitychange?.forEach((f) => f());
    await flush();
    expect(m.getMusicSnapshot().playing).toBe(false);
    docHidden = false;
    docListeners.visibilitychange?.forEach((f) => f());
    await flush();
    expect(m.getMusicSnapshot().playing).toBe(true);
    m.enterMusic(b, "game");
    m.exitMusic(a);
    await flush();
    expect(m.getMusicSnapshot().activity).toBe("game");
    expect(m.getMusicSnapshot().playing).toBe(true);
  });

  it("отказ автозапуска — тихо, unavailable; не бросает", async () => {
    FakeAudio.prototype.play = () => Promise.reject(new Error("NotAllowedError"));
    const owner = Symbol("a");
    m.setMusicPref({ enabled: true, track: "auto" }, true);
    m.enterMusic(owner, "game");
    await flush();
    expect(m.getMusicSnapshot().playing).toBe(false);
    expect(m.getMusicSnapshot().unavailable).toBe(true);
  });
});
