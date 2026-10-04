import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKUP_LIMITS,
  BACKUP_STATE_KEYS,
  buildBackup,
  cleanBackup,
  cleanIdb,
  cleanState,
  ECONOMY_CAPS,
  noteImageIds,
  parseBackup,
  summarizeBackup,
  type IdbSnapshot,
} from "@/lib/backup";
import { exportBackup, importBackup } from "@/lib/backup-idb";
import { deleteMessages, loadMessages, saveMessages } from "@/lib/chat-store";
import { MAX_MESSAGES } from "@/lib/chats";
import { deleteImages, getImage } from "@/lib/note-images";
import { loadScratch, saveScratch } from "@/lib/scratch";
import { useApp } from "@/lib/store";
import { sanitizeHistory } from "@/lib/history";

// Поддельная IndexedDB (idb-keyval): данные в Map, чтение и запись можно «сломать».
const fakeIdb = vi.hoisted(() => ({ data: new Map<string, unknown>(), ctl: { failSet: false, failGet: false } }));
vi.mock("idb-keyval", () => {
  const k = (key: unknown, store?: { name: string }) => `${store?.name ?? "default"}:${String(key)}`;
  return {
    createStore: (name: string) => ({ name }),
    get: async (key: unknown, store?: { name: string }) => {
      if (fakeIdb.ctl.failGet) throw new Error("read failed");
      return fakeIdb.data.get(k(key, store));
    },
    set: async (key: unknown, value: unknown, store?: { name: string }) => {
      if (fakeIdb.ctl.failSet) throw new Error("quota");
      fakeIdb.data.set(k(key, store), value);
    },
    del: async (key: unknown, store?: { name: string }) => void fakeIdb.data.delete(k(key, store)),
    delMany: async (keys: unknown[], store?: { name: string }) => void keys.forEach((key) => fakeIdb.data.delete(k(key, store))),
  };
});
vi.stubGlobal("indexedDB", {});

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const JPG = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const WEBP = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

const state = () => ({
  profile: { name: "Айым", lang: "kk", theme: "dark", dailyGoalXp: 100 },
  xp: 340,
  streak: { current: 4, best: 9, lastDay: "2026-10-03", freezes: 1, frozenDays: ["2026-09-30"] },
  days: { "2026-10-03": { xp: 40, answers: 12, correct: 10, seconds: 600, lessons: 1 } },
  skills: { "ns.bin2dec": { attempts: 10, correct: 8, mastery: 0.7, lastSeen: 5 } },
  lessons: { "ns-1-binary": { completions: 2, bestAccuracy: 0.9, lastAt: 1000, totalXp: 60, firstAt: 500, via: "learn", stage: 2, dueAt: 9000 } },
  mistakes: [{ id: "m1", stepId: "q1", lessonId: "ns-1-binary", skill: "ns.bin2dec", prompt: "?", given: "1", expected: "2", at: 5 }],
  achievements: { xp_500: 123 },
  newAchievements: ["xp_500"],
  notebook: {
    folders: [],
    notes: [{ id: "n1", folderId: "sys-general", title: "Т", body: "Фото ![](note-img:iabc123)", source: "own", images: ["iabc123"], createdAt: 1, updatedAt: 2 }],
  },
  memory: "любит примеры",
  chat: [{ id: "c1", role: "user", content: "привет", at: 1 }],
  aiUsage: { day: "2026-10-03", count: 2, free: 2 },
  maxCombo: 5,
  games: { bingo: { best: 100, plays: 2, lastAt: 7 } },
  exams: [{ id: "e1", kind: "full", seed: 5, at: 9, points: 30, maxPoints: 50, durationSec: 3000, byTopic: { t01: { points: 2, max: 2 } }, title: "Пробный" }],
  hearts: { count: 3, updatedAt: 99, day: "2026-10-03" },
  wallet: { chips: 77, earned: 120, spent: 43 },
  ledger: [{ id: "l1", at: 1, amount: 5, reason: "xp" }],
  boost: { mult: 2, until: 3_601_000 },
  practiceHearts: { day: "2026-10-03", count: 1 },
  paywall: { lastShownAt: 8, views: 2 },
  history: [{ id: "h1", at: 1, kind: "lesson", title: "Урок", correct: 3, total: 4, durationSec: 60, xp: 10, wrong: [], fixed: [] }],
  chats: [{ id: "chat1", title: "Вопрос", mode: "free", createdAt: 1, updatedAt: 2, preview: "привет", count: 2 }],
  codeTasks: { "py-1": { solved: true, attempts: 2, at: 4 } },
  // Не входят в копию:
  plan: { tier: "unlimited", until: 9e12, trial: true, trialUsed: true },
  onboarded: true,
});

const snapshot = (): IdbSnapshot => ({
  chats: {
    chat1: [
      { id: "m1", role: "user", content: "привет", at: 1 },
      { id: "m2", role: "assistant", content: "Здравствуй!", at: 2 },
    ],
  },
  images: { iabc123: PNG },
  scratch: [{ id: "p1", text: "заметка", updatedAt: 1 }],
});

/** Копия как через файл: сериализация и разбор. */
const viaFile = (file: unknown) => JSON.parse(JSON.stringify(file)) as unknown;

describe("buildBackup: полная копия v3", () => {
  it("состав: версия, все поля стора, раздел idb; тарифа и onboarded нет", () => {
    const { file, droppedImages } = buildBackup(state(), snapshot(), 1234);
    expect(file.app).toBe("informatica");
    expect(file.version).toBe(3);
    expect(file.exportedAt).toBe(1234);
    for (const k of BACKUP_STATE_KEYS) expect(file, k).toHaveProperty(k);
    expect("plan" in file).toBe(false);
    expect("onboarded" in file).toBe(false);
    expect(file.idb).toEqual({
      chats: snapshot().chats,
      images: { iabc123: PNG },
      scratch: [{ id: "p1", text: "заметка", updatedAt: 1 }],
    });
    expect(droppedImages).toBe(0);
  });

  it("то, что собрали, читается обратно без потерь (круг файл → разбор)", () => {
    const { file } = buildBackup(state(), snapshot(), 1);
    const parsed = parseBackup(viaFile(file))!;
    expect(parsed.version).toBe(3);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.droppedImages).toBe(0);
    const { app: _a, exportedAt: _e, idb, ...fields } = file;
    void _a;
    void _e;
    expect(parsed.state).toEqual({ ...fields, version: 3 });
    expect(parsed.idb).toEqual(idb);
    // Повторная сборка из разобранного — тот же результат (проверка идемпотентна).
    const again = buildBackup(parsed.state, parsed.idb as unknown as IdbSnapshot, 1).file;
    expect(again).toEqual(file);
  });

  it("чипы, кошелёк, журнал, история тестов, чаты, задачи кода и сердечки — теперь в копии", () => {
    const { file } = buildBackup(state(), snapshot(), 1);
    expect(file.wallet).toEqual({ chips: 77, earned: 120, spent: 43 });
    expect(file.ledger).toEqual([{ id: "l1", at: 1, amount: 5, reason: "xp" }]);
    expect((file.history as { id: string }[])[0].id).toBe("h1");
    expect((file.chats as { id: string }[])[0].id).toBe("chat1");
    expect(file.codeTasks).toEqual({ "py-1": { solved: true, attempts: 2, at: 4 } });
    expect(file.hearts).toEqual({ count: 3, updatedAt: 99, day: "2026-10-03" });
    expect(file.boost).toEqual({ mult: 2, until: 3_601_000 });
  });

  it("компактный JSON: без отступов (штрихи черновика иначе раздули бы файл втрое)", () => {
    const text = JSON.stringify(buildBackup(state(), snapshot(), 1).file);
    expect(text).not.toContain("\n");
  });

  it("не прогресс — понятная ошибка, а не тихая пустая копия", () => {
    expect(() => buildBackup({ hello: 1 }, snapshot(), 1)).toThrow();
  });
});

describe("parseBackup: копии v2 и недоверенный файл", () => {
  /** Что писала версия 2: весь стор (функции пропадают при сериализации) + version: 2, без idb. */
  const v2 = () => ({ ...state(), version: 2 });

  it("копия v2 читается как раньше: прогресс есть, раздела idb нет", () => {
    const p = parseBackup(viaFile(v2()))!;
    expect(p.version).toBe(2);
    expect(p.idb).toBeNull();
    expect(p.state.xp).toBe(340);
    expect(p.state.lessons).toEqual(state().lessons);
    expect(p.state.notebook).toBeDefined();
    expect(p.skipped).toEqual([]);
    expect("plan" in p.state).toBe(false);
    expect("onboarded" in p.state).toBe(false);
  });

  it("не копия Informatica — null", () => {
    for (const bad of [null, undefined, 5, "x", [], {}, { xp: "1", profile: {} }, { xp: -1, profile: {} }, { xp: 1 }, { xp: 1, profile: null }, { xp: NaN, profile: {} }]) {
      expect(parseBackup(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("битые поля пропускаются и перечисляются, импорт целиком не падает", () => {
    const file = {
      ...v2(),
      lessons: null,
      exams: "нет",
      wallet: 5,
      streak: [],
      skills: { "ns.bin2dec": { attempts: 3, correct: 2, mastery: 5, lastSeen: "вчера" }, bad: 7, worse: null },
      ledger: [1, null, { id: "x" }, { id: "ok", at: 1, amount: 2, reason: "lesson" }, { id: "bad-reason", at: 1, amount: 2, reason: "hack" }],
      mistakes: [null, 5, { id: "m", stepId: "s", prompt: 3 }],
    };
    const p = parseBackup(viaFile(file))!;
    expect(p).not.toBeNull();
    expect(p.skipped.sort()).toEqual(["exams", "lessons", "streak", "wallet"]);
    expect("lessons" in p.state).toBe(false);
    expect(p.state.xp).toBe(340);
    // Элементы внутри живых полей: годные остаются, мусор уходит, числа приводятся к допустимым.
    expect(p.state.skills).toEqual({ "ns.bin2dec": { attempts: 3, correct: 2, mastery: 1, lastSeen: 0 } });
    expect(p.state.ledger).toEqual([{ id: "ok", at: 1, amount: 2, reason: "lesson" }]);
    expect(p.state.mistakes).toEqual([{ id: "m", stepId: "s", prompt: "", given: "", expected: "", at: 0 }]);
  });

  it("лишние поля и служебные ключи отбрасываются; прототип не загрязняется", () => {
    const text = '{"xp":5,"profile":{},"junk":1,"onboarded":false,"plan":{"tier":"unlimited"},"lessons":{"__proto__":{"completions":1},"constructor":{"completions":1},"ok":{"completions":2}},"games":{"x":{"best":1,"plays":1,"lastAt":1}}}';
    const p = parseBackup(JSON.parse(text))!;
    expect(Object.keys(p.state).sort()).toEqual(["games", "lessons", "profile", "xp"]);
    expect(p.state.lessons).toEqual({ ok: { completions: 2, bestAccuracy: 0, lastAt: 0, totalXp: 0 } });
    expect(Object.getPrototypeOf(p.state.lessons)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).completions).toBeUndefined();
  });

  it("числа ограничены и не бывают NaN/Infinity/отрицательными", () => {
    const p = parseBackup({
      xp: 12.9,
      profile: {},
      maxCombo: 1e12,
      wallet: { chips: -5, earned: "x", spent: 3.7 },
      days: { "2026-10-01": { xp: -1, answers: 1e999, correct: "5", seconds: 4 }, "не дата": { xp: 1 } },
    })!;
    expect(p.state.xp).toBe(12);
    expect(p.state.maxCombo).toBe(1e6);
    expect(p.state.days).toEqual({ "2026-10-01": { xp: 0, answers: 0, correct: 0, seconds: 4 } });
    expect(JSON.stringify(p.state)).not.toMatch(/null|NaN|Infinity/);
  });

  it("копия, сохранённая прямо из localStorage ({ state, version }), тоже подходит", () => {
    const p = parseBackup({ state: { xp: 9, profile: { name: "А" }, wallet: { chips: 3, earned: 3, spent: 0 } }, version: 2 })!;
    expect(p.version).toBe(2);
    expect(p.state.xp).toBe(9);
    expect(p.state.wallet).toEqual({ chips: 3, earned: 3, spent: 0 });
  });

  it("версия: из файла; без неё — 2, если есть конспекты, иначе 1 (заметки v1 сохраняются только для миграции)", () => {
    expect(parseBackup({ xp: 1, profile: {}, notebook: { folders: [], notes: [] } })!.version).toBe(2);
    const v1 = parseBackup({ xp: 1, profile: {}, notes: { general: { own: "моя", saved: [{ id: "s", text: "ответ", at: 1 }, { id: 5 }] } } })!;
    expect(v1.version).toBe(1);
    expect(v1.state.notes).toEqual({ general: { own: "моя", saved: [{ id: "s", text: "ответ", at: 1 }] } });
    expect("notes" in parseBackup({ version: 2, xp: 1, profile: {}, notes: { general: { own: "x" } } })!.state).toBe(false);
  });

  it("cleanBackup — только состояние (для старых вызовов)", () => {
    expect(cleanBackup(viaFile(v2()))).toEqual(parseBackup(viaFile(v2()))!.state);
    expect(cleanBackup({ xp: "1" })).toBeNull();
  });

  it("конспекты: папки и записи чинятся, лишнее в записях уходит, ссылки на картинки с кривыми id — нет", () => {
    const c = cleanState({
      xp: 1,
      profile: {},
      notebook: {
        folders: [{ id: "f1", name: "Моя", color: "радуга", createdAt: 1 }],
        notes: [
          { id: "a", folderId: "f1", title: "t", body: "b", source: "хакер", junk: 1, images: ["iok12345", "../x", 5], pinned: 1 },
          { id: "b", body: 5 },
        ],
      },
    })!;
    const nb = c.state.notebook as { folders: { id: string; color: string }[]; notes: Record<string, unknown>[] };
    expect(nb.folders.find((f) => f.id === "f1")!.color).toBe("primary");
    expect(nb.notes).toHaveLength(1);
    expect(nb.notes[0].source).toBe("own");
    expect("junk" in nb.notes[0]).toBe(false);
    expect("pinned" in nb.notes[0]).toBe(false);
    expect(nb.notes[0].images).toEqual(["iok12345"]);
  });

  it("noteImageIds: id из списка записи и из ссылок в тексте, без повторов и кривых id", () => {
    const ids = noteImageIds({
      notes: [
        { id: "a", folderId: "f", title: "", body: "![](note-img:iaaa111) ![](note-img:ibbb222)", source: "own", images: ["iaaa111", "icc"], createdAt: 0, updatedAt: 0 },
      ],
    });
    expect(ids).toEqual(["iaaa111", "ibbb222"]);
  });
});

describe("данные IndexedDB в копии", () => {
  const st = () => cleanState({ ...state() })!.state;

  it("фото: только те, на которые ссылаются записи, и только png/jpeg/webp до лимита", () => {
    const n = (id: string) => ({ id: `n${id}`, folderId: "sys-general", title: "", body: `![](note-img:${id})`, source: "own", createdAt: 1, updatedAt: 1 });
    const s = cleanState({
      xp: 1,
      profile: {},
      notebook: { folders: [], notes: ["ipng001", "ijpg001", "iweb001", "isvg001", "igif001", "ihuge01", "ibad001"].map(n) },
    })!.state;
    const huge = `data:image/png;base64,${"A".repeat(Math.ceil((3 * 1024 * 1024 * 4) / 3) + 100)}`;
    const { idb, droppedImages } = cleanIdb(
      {
        images: {
          ipng001: PNG,
          ijpg001: JPG,
          iweb001: WEBP,
          isvg001: "data:image/svg+xml;base64,PHN2Zz4=",
          igif001: "data:image/gif;base64,R0lGODlh",
          ihuge01: huge,
          ibad001: 42,
          iunused1: PNG, // на него никто не ссылается
        },
      },
      s,
    );
    expect(Object.keys(idb.images!).sort()).toEqual(["ijpg001", "ipng001", "iweb001"]);
    expect(droppedImages).toBe(4);
    expect(idb.chats).toBeNull();
    expect(idb.scratch).toBeNull();
  });

  it("бюджет фото: что не поместилось — отбрасывается и считается", () => {
    const body = (id: string) => `![](note-img:${id})`;
    const ids = Array.from({ length: 5 }, (_, i) => `ibig000${i}`);
    const s = cleanState({
      xp: 1,
      profile: {},
      notebook: { folders: [], notes: ids.map((id, i) => ({ id: `n${i}`, folderId: "sys-general", title: "", body: body(id), source: "own", createdAt: 1, updatedAt: 1 })) },
    })!.state;
    const url = `data:image/png;base64,${"A".repeat(1_000_000)}`;
    const raw = { images: Object.fromEntries(ids.map((id) => [id, url])) };
    const { idb, droppedImages } = cleanIdb(raw, s, 2_500_000);
    expect(Object.keys(idb.images!)).toHaveLength(2);
    expect(droppedImages).toBe(3);
  });

  it("сообщения: только чатов из списка, корректные, не больше MAX_MESSAGES (новые)", () => {
    const many = Array.from({ length: MAX_MESSAGES + 30 }, (_, i) => ({ id: `m${i}`, role: i % 2 ? "assistant" : "user", content: `текст ${i}`, at: i }));
    const { idb } = cleanIdb(
      {
        chats: {
          chat1: [...many, null, 5, { id: "x", role: "system", content: "?", at: 1 }, { id: "q", role: "assistant", content: "итог", at: 9, quiz: { correct: 3, total: 4, grade: 4, topic: "t05", mistakes: [{ prompt: "?", given: "1", expected: "2" }, 7] } }],
          stranger: [{ id: "m", role: "user", content: "чужой чат", at: 1 }],
        },
      },
      st(),
    );
    expect(Object.keys(idb.chats!)).toEqual(["chat1"]);
    const msgs = idb.chats!.chat1;
    expect(msgs.length).toBeLessThanOrEqual(MAX_MESSAGES);
    expect(msgs[msgs.length - 1].id).toBe("q");
    expect(msgs[msgs.length - 1].quiz).toEqual({ topic: "t05", correct: 3, total: 4, grade: 4, mistakes: [{ prompt: "?", given: "1", expected: "2" }] });
    expect(msgs.every((m) => m.role === "user" || m.role === "assistant")).toBe(true);
  });

  it("чат со служебным id в список не попадает", () => {
    const chats = cleanState({ xp: 1, profile: {}, chats: [{ id: "__proto__", mode: "free" }, { id: "constructor", mode: "free" }, { id: "ok1", mode: "free" }] })!.state.chats;
    expect(chats).toEqual([expect.objectContaining({ id: "ok1" })]);
  });

  it("сообщения: длинный текст обрезается, общий бюджет не превышается и новые сообщения важнее старых", () => {
    const chats = Array.from({ length: 6 }, (_, i) => ({ id: `chat${i}`, title: "", mode: "free", createdAt: 1, updatedAt: 1, preview: "", count: 0 }));
    const s = cleanState({ xp: 1, profile: {}, chats })!.state;
    const longMsgs = (c: number) => Array.from({ length: MAX_MESSAGES }, (_, i) => ({ id: `m${c}-${i}`, role: "assistant", content: "я".repeat(20_000), at: i }));
    const { idb } = cleanIdb({ chats: Object.fromEntries(chats.map((c, i) => [c.id, longMsgs(i)])) }, s);
    let total = 0;
    for (const msgs of Object.values(idb.chats!)) for (const m of msgs) total += m.content.length;
    expect(Math.max(...Object.values(idb.chats!).flat().map((m) => m.content.length))).toBe(8000);
    expect(total).toBeLessThanOrEqual(BACKUP_LIMITS.chatChars);
    expect(total).toBeGreaterThan(BACKUP_LIMITS.chatChars / 2);
  });

  it("черновик: мусорные листы и штрихи отбрасываются", () => {
    const { idb } = cleanIdb(
      { scratch: [{ id: "p1", text: "ok", updatedAt: 1, strokes: [{ tool: "pen", color: "red", size: 4, points: [[1, 2], [3, 4], ["x", 1]] }, { tool: "laser", points: [[1, 1]] }] }, null, { id: 5 }, { id: "p1", text: "дубль" }] },
      st(),
    );
    expect(idb.scratch).toHaveLength(1);
    expect(idb.scratch![0].strokes).toEqual([{ tool: "pen", color: "red", size: 4, points: [[1, 2], [3, 4]] }]);
  });

  it("раздела нет в файле — null (локальные данные при импорте не трогаем)", () => {
    const { idb } = cleanIdb({}, st());
    expect(idb).toEqual({ chats: null, images: null, scratch: null });
    expect(parseBackup({ xp: 1, profile: {}, idb: "мусор" })!.idb).toBeNull();
  });

  it("экспорт: файл укладывается в лимит, лишние фото отбрасываются и считаются", () => {
    const ids = Array.from({ length: 18 }, (_, i) => `iexp${String(i).padStart(4, "0")}`);
    const url = `data:image/jpeg;base64,${"A".repeat(990_000)}`; // ≈ 0,74 МБ картинки каждая
    const s = { ...state(), notebook: { folders: [], notes: ids.map((id, i) => ({ id: `n${i}`, folderId: "sys-general", title: "", body: `![](note-img:${id})`, source: "own", createdAt: 1, updatedAt: 1 })) } };
    const { file, droppedImages } = buildBackup(s, { chats: {}, images: Object.fromEntries(ids.map((id) => [id, url])), scratch: [] }, 1);
    const text = JSON.stringify(file);
    expect(text.length).toBeLessThanOrEqual(BACKUP_LIMITS.fileBytes);
    expect(Object.keys((file.idb as { images: object }).images)).toHaveLength(16);
    expect(droppedImages).toBe(2);
    // И обратно читается целиком.
    const p = parseBackup(JSON.parse(text))!;
    expect(Object.keys(p.idb!.images!)).toHaveLength(16);
    expect(p.droppedImages).toBe(0);
  });

  it("summarizeBackup: что в копии — для окна подтверждения", () => {
    const p = parseBackup(viaFile(buildBackup(state(), snapshot(), 1).file))!;
    expect(summarizeBackup(p)).toEqual({ version: 3, xp: 340, lessons: 1, chats: 1, images: 1 });
    expect(summarizeBackup(parseBackup({ xp: 5, profile: {} })!)).toEqual({ version: 1, xp: 5, lessons: 0, chats: 0, images: 0 });
  });
});

describe("importProgress в сторе: что восстанавливается", () => {
  const st = () => useApp.getState();
  beforeEach(() => st().resetProgress());

  it("чипы, кошелёк, журнал, история тестов, чаты, задачи кода, сердечки — восстанавливаются; тариф — нет", () => {
    useApp.setState({ plan: { tier: "free" } });
    const p = parseBackup(viaFile(buildBackup(state(), snapshot(), 1).file))!;
    expect(st().importProgress(p.state)).toBe(true);
    const s = st();
    expect(s.onboarded).toBe(true);
    expect(s.xp).toBe(340);
    expect(s.wallet).toEqual({ chips: 77, earned: 120, spent: 43 });
    expect(s.ledger.map((e) => e.id)).toEqual(["l1"]);
    expect(s.history.map((e) => e.id)).toEqual(["h1"]);
    expect(s.chats.map((c) => c.id)).toEqual(["chat1"]);
    expect(s.codeTasks["py-1"]).toEqual({ solved: true, attempts: 2, at: 4 });
    expect(s.hearts.count).toBe(3);
    expect(s.exams.map((e) => e.id)).toEqual(["e1"]);
    expect(s.lessons["ns-1-binary"].dueAt).toBe(9000);
    expect(s.notebook.notes.find((n) => n.id === "n1")?.images).toEqual(["iabc123"]);
    expect(s.profile).toMatchObject({ name: "Айым", lang: "kk", theme: "dark", dailyGoalXp: 100 });
    // Тариф и пробный период из файла не берём.
    expect(s.plan).toEqual({ tier: "free" });
    expect("version" in s).toBe(false);
  });

  it("профиль проверяется по полям: чужие значения заменяются значениями по умолчанию, лишних ключей нет", () => {
    expect(
      st().importProgress({ xp: 1, profile: { lang: "xx", theme: 5, name: 42, dailyGoalXp: -1, goal: "ent", reminder: { time: "99:99", enabled: "да" }, junk: 1, avatar: { kind: "photo", data: "javascript:1" } } }),
    ).toBe(true);
    const pr = st().profile;
    expect(pr.lang).toBe("ru");
    expect(pr.theme).toBe("system");
    expect(pr.name).toBe("");
    expect(pr.dailyGoalXp).toBe(50);
    expect(pr.goal).toBe("ent");
    expect(pr.reminder).toEqual({ enabled: true, time: "19:00", push: false });
    expect(pr.avatar.kind).toBe("initial");
    expect("junk" in pr).toBe(false);
  });

  it("мусорный файл ничего не меняет", () => {
    st().importProgress({ xp: 10, profile: {} });
    expect(st().importProgress({ hello: 1 })).toBe(false);
    expect(st().importProgress(null)).toBe(false);
    expect(st().xp).toBe(10);
  });
});

describe("полная копия и IndexedDB (в тестах — поддельная IndexedDB)", () => {
  afterEach(() => {
    fakeIdb.ctl.failSet = false;
    fakeIdb.ctl.failGet = false;
  });

  it("экспорт → очистка → импорт: чаты, фото и черновик возвращаются, лишнее старое убирается, тариф не меняется", async () => {
    // Ученик на «старом» устройстве.
    useApp.getState().resetProgress();
    useApp.getState().importProgress({ ...state(), onboarded: true });
    await saveMessages("chat1", snapshot().chats.chat1 as never);
    const { putImageWithId } = await import("@/lib/note-images");
    await putImageWithId("iabc123", PNG);
    await saveScratch([{ id: "p1", text: "заметка", updatedAt: 1 }]);

    const { blob, droppedImages } = await exportBackup();
    expect(droppedImages).toBe(0);
    const file = JSON.parse(await blob.text()) as Record<string, unknown>;
    expect(file.version).toBe(3);
    expect((file.idb as { images: Record<string, string> }).images.iabc123).toBe(PNG);

    // «Новое» устройство: пусто, уже есть чужой чат и чужое фото.
    await deleteMessages("chat1");
    await deleteImages(["iabc123"]);
    await saveScratch([]);
    useApp.getState().resetProgress();
    useApp.setState({ plan: { tier: "lite", period: "month", until: 9e12 } });
    useApp.getState().createChat("free", "Чужой чат");
    const strangerId = useApp.getState().chats[0].id;
    await saveMessages(strangerId, [{ id: "z", role: "user", content: "чужой", at: 1 }]);
    expect(await getImage("iabc123")).toBeUndefined();

    const parsed = parseBackup(file)!;
    expect(await importBackup(parsed)).toBe("ok");

    const s = useApp.getState();
    expect(s.wallet.chips).toBe(77);
    expect(s.chats.map((c) => c.id)).toEqual(["chat1"]);
    expect(s.plan.tier).toBe("lite"); // тариф устройства не тронут
    expect((await loadMessages("chat1")).map((m) => m.content)).toEqual(["привет", "Здравствуй!"]);
    expect(await getImage("iabc123")).toBe(PNG);
    expect((await loadScratch()).map((p) => p.text)).toEqual(["заметка"]);
    // Сообщения чата, которого больше нет в прогрессе, не копятся.
    expect(await loadMessages(strangerId)).toEqual([]);
  });

  it("копия v2 (без idb) не стирает чаты и фото на устройстве", async () => {
    await saveMessages("chat1", [{ id: "keep", role: "user", content: "осталось", at: 1 }]);
    const parsed = parseBackup(viaFile({ ...state(), version: 2 }))!;
    expect(parsed.idb).toBeNull();
    expect(await importBackup(parsed)).toBe("ok");
    expect((await loadMessages("chat1")).map((m) => m.content)).toEqual(["осталось"]);
  });
  /** «Старое» устройство: свой чат и своё фото лежат в IndexedDB и в прогрессе. */
  async function oldDevice() {
    useApp.getState().resetProgress();
    useApp.getState().createChat("free", "Старый чат");
    const oldChat = useApp.getState().chats[0].id;
    await saveMessages(oldChat, [{ id: "o", role: "user", content: "старый", at: 1 }]);
    const { putImageWithId } = await import("@/lib/note-images");
    await putImageWithId("iold0001", PNG);
    useApp.setState({
      notebook: { folders: [], notes: [{ id: "nold", folderId: "sys-general", title: "Старая", body: "![](note-img:iold0001)", source: "own", images: ["iold0001"], createdAt: 1, updatedAt: 1 }] } as never,
    });
    return oldChat;
  }

  it("сбой записи в IndexedDB при импорте: прогресс загружен, итог partial, старые чаты и фото НЕ удаляются", async () => {
    const oldChat = await oldDevice();
    const parsed = parseBackup(viaFile(buildBackup(state(), snapshot(), 1).file))!;
    fakeIdb.ctl.failSet = true;
    expect(await importBackup(parsed)).toBe("partial");
    fakeIdb.ctl.failSet = false;
    expect(useApp.getState().wallet.chips).toBe(77); // состояние загружено
    expect((await loadMessages(oldChat)).map((m) => m.content)).toEqual(["старый"]); // чата больше нет в прогрессе, но сообщения целы
    expect(fakeIdb.data.has(`default:informatica:chat:v1:msgs:${oldChat}`)).toBe(true);
    expect(await getImage("iold0001")).toBe(PNG);
    expect(fakeIdb.data.has("informatica-notes:iold0001")).toBe(true);
  });

  it("запись удалась — старое, на что новый прогресс не ссылается, убирается (итог ok)", async () => {
    const oldChat = await oldDevice();
    const parsed = parseBackup(viaFile(buildBackup(state(), snapshot(), 1).file))!;
    expect(await importBackup(parsed)).toBe("ok");
    expect(fakeIdb.data.has(`default:informatica:chat:v1:msgs:${oldChat}`)).toBe(false);
    expect(fakeIdb.data.has("informatica-notes:iold0001")).toBe(false);
    expect(await getImage("iabc123")).toBe(PNG);
  });

  it("сбой чтения IndexedDB при экспорте: unreadable > 0, а не тихо пустые чаты и фото", async () => {
    const chatId = "chat-unread";
    const imgId = "iunread1";
    useApp.getState().resetProgress();
    useApp.getState().importProgress({
      ...state(),
      chats: [{ id: chatId, title: "Вопрос", mode: "free", createdAt: 1, updatedAt: 2, preview: "привет", count: 1 }],
      notebook: { folders: [], notes: [{ id: "n1", folderId: "sys-general", title: "Т", body: `![](note-img:${imgId})`, source: "own", images: [imgId], createdAt: 1, updatedAt: 2 }] },
    });
    fakeIdb.data.set(`default:informatica:chat:v1:msgs:${chatId}`, [{ id: "m1", role: "user", content: "привет", at: 1 }]);
    fakeIdb.data.set(`informatica-notes:${imgId}`, PNG);

    fakeIdb.ctl.failGet = true;
    const broken = await exportBackup();
    expect(broken.unreadable).toBeGreaterThanOrEqual(2); // чат и фото
    fakeIdb.ctl.failGet = false;

    const good = await exportBackup();
    expect(good.unreadable).toBe(0);
    const idb = (JSON.parse(await good.blob.text()) as { idb: { chats: Record<string, unknown[]>; images: Record<string, string> } }).idb;
    expect(idb.chats[chatId]).toHaveLength(1);
    expect(idb.images[imgId]).toBe(PNG);
  });
});

describe("недоверенный файл: потолки экономики и обрезка истории", () => {
  const NOW = 1_800_000_000_000;
  const parse = (extra: Record<string, unknown>) => parseBackup({ xp: 1, profile: {}, ...extra }, NOW)!.state;

  it("кошелёк и журнал чипов зажаты потолком", () => {
    const s = parse({ wallet: { chips: 9e15, earned: 5e9, spent: 2_000_000 }, ledger: [{ id: "l", at: 1, amount: 9e12, reason: "xp" }, { id: "m", at: 1, amount: -9e12, reason: "buy" }] });
    expect(s.wallet).toEqual({ chips: ECONOMY_CAPS.chips, earned: ECONOMY_CAPS.chips, spent: ECONOMY_CAPS.chips });
    expect((s.ledger as { amount: number }[]).map((e) => e.amount)).toEqual([ECONOMY_CAPS.chips, -ECONOMY_CAPS.chips]);
    expect(parse({ wallet: { chips: 500, earned: 900, spent: 400 } }).wallet).toEqual({ chips: 500, earned: 900, spent: 400 });
  });

  it("бустер: срок не дальше самого долгого из продаваемых, множитель не выше самого сильного", () => {
    expect(ECONOMY_CAPS.boostMs).toBe(7 * 24 * 3600_000);
    expect(ECONOMY_CAPS.boostMult).toBe(2);
    expect(parse({ boost: { mult: 3, until: NOW + 365 * 24 * 3600_000 } }).boost).toEqual({ mult: 2, until: NOW + ECONOMY_CAPS.boostMs });
    expect(parse({ boost: { mult: 2, until: NOW + 3600_000 } }).boost).toEqual({ mult: 2, until: NOW + 3600_000 });
    expect(parse({ boost: { mult: 2, until: 5e12 } }).boost).toEqual({ mult: 2, until: NOW + ECONOMY_CAPS.boostMs });
    expect(parse({ boost: "много" }).boost).toBeNull();
  });

  it("сердечки — не больше наибольшего запаса среди тарифов, тренировки в день — не больше дневного предела", () => {
    expect(ECONOMY_CAPS.hearts).toBe(10);
    expect(parse({ hearts: { count: 99, updatedAt: 5, day: "2026-10-03" } }).hearts).toEqual({ count: 10, updatedAt: 5, day: "2026-10-03" });
    expect(parse({ hearts: { count: 4, updatedAt: 5, day: "2026-10-03" } }).hearts).toMatchObject({ count: 4 });
    expect(parse({ practiceHearts: { day: "2026-10-03", count: 99 } }).practiceHearts).toEqual({ day: "2026-10-03", count: 5 });
  });

  it("buildBackup: бустер в копии не дальше потолка от момента экспорта", () => {
    const { file } = buildBackup({ ...state(), boost: { mult: 2, until: 9e12 } }, snapshot(), NOW);
    expect(file.boost).toEqual({ mult: 2, until: NOW + ECONOMY_CAPS.boostMs });
  });

  it("история: длинные строки обрезаются, бесконечные баллы пропадают", () => {
    const long = "я".repeat(5000);
    // 1e999 в JSON читается как Infinity.
    const raw = JSON.parse(
      `[{"id":"${long}","at":1,"kind":"exam","mode":"${long}","title":"${long}","lessonId":"${long}","examId":"${long}","correct":1,"total":2,"points":1e999,"maxPoints":-1e999,"durationSec":5,"xp":3,` +
        `"wrong":[{"stepId":"${long}","lessonId":"${long}","skill":"${long}","prompt":"${long}","given":"${long}","expected":"${long}"}],"fixed":["${long}",5,${JSON.stringify(Array.from({ length: 40 }, (_, i) => `s${i}`)).slice(1, -1)}]}]`,
    );
    const [e] = sanitizeHistory(raw);
    expect(e.id).toHaveLength(80);
    expect(e.title).toHaveLength(160);
    expect(e.mode).toHaveLength(40);
    expect(e.lessonId).toHaveLength(80);
    expect(e.examId).toHaveLength(80);
    expect(e.points).toBeUndefined();
    expect(e.maxPoints).toBeUndefined();
    expect(e.wrong[0].stepId).toHaveLength(120);
    expect(e.wrong[0].skill).toHaveLength(80);
    expect(e.wrong[0].prompt.length).toBeLessThanOrEqual(400);
    expect(e.fixed.length).toBeLessThanOrEqual(25);
    expect(e.fixed[0]).toHaveLength(120);
    expect(e.fixed.every((x) => typeof x === "string")).toBe(true);
    // Обычная запись проходит как есть.
    const ok = { id: "h1", at: 1, kind: "exam", title: "Пробный", points: 30, maxPoints: 50, correct: 1, total: 2, durationSec: 3, xp: 4, wrong: [], fixed: ["a"] };
    expect(sanitizeHistory([ok])[0]).toMatchObject({ id: "h1", title: "Пробный", points: 30, maxPoints: 50, fixed: ["a"] });
  });
});
