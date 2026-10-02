import { beforeEach, describe, expect, it } from "vitest";
import { mergeState, migrateState, useApp } from "@/lib/store";
import type { AnswerRecord, SessionResult } from "@/lib/types";
import { bumpStreak, liveStreak, streakAtRisk, type Streak } from "@/lib/gamification";
import { DAY_MS, dueLessons, lessonXpFactor, REPLAY_XP, scaleXp, scheduleAfter } from "@/lib/review";
import { migrateLegacyNotes, notesInFolder, repairNotebook, systemFolderId, titleFromBody } from "@/lib/notebook";

const answer = (over: Partial<AnswerRecord> = {}): AnswerRecord => ({
  stepId: "q1",
  skill: "ns.bin2dec",
  correct: true,
  score: 1,
  given: "5",
  expected: "5",
  prompt: "?",
  retry: false,
  timeMs: 1000,
  ...over,
});

const lessonResult = (over: Partial<SessionResult> = {}): SessionResult => ({
  kind: "lesson",
  lessonId: "ns-2-read",
  title: "t",
  answers: [answer()],
  xp: 10,
  maxCombo: 1,
  durationSec: 60,
  accuracy: 1,
  ...over,
});

describe("серия: заморозки", () => {
  it("каждые 7 дней — заморозка, не больше двух", () => {
    let s: Streak = { current: 6, best: 6, lastDay: "2026-10-01", freezes: 0 };
    s = bumpStreak(s, "2026-10-02");
    expect(s.current).toBe(7);
    expect(s.freezes).toBe(1);
    s = bumpStreak({ ...s, current: 13, freezes: 2 }, "2026-10-03");
    expect(s.freezes).toBe(2);
  });

  it("пропуск дня закрывается заморозкой, двух дней при одной заморозке — нет", () => {
    const base = { current: 9, best: 9, lastDay: "2026-10-01", freezes: 1 };
    const saved = bumpStreak(base, "2026-10-03");
    expect(saved.current).toBe(10);
    expect(saved.freezes).toBe(0);
    expect(saved.frozenDays).toEqual(["2026-10-02"]);
    expect(bumpStreak(base, "2026-10-04").current).toBe(1);
  });

  it("живая серия учитывает заморозки, риск — когда сегодня ещё не занимались", () => {
    const s = { current: 5, best: 5, lastDay: "2026-10-01", freezes: 1 };
    expect(liveStreak(s, "2026-10-03")).toBe(5);
    expect(liveStreak(s, "2026-10-04")).toBe(0);
    expect(streakAtRisk(s, "2026-10-02")).toBe(true);
    expect(streakAtRisk({ ...s, lastDay: "2026-10-02" }, "2026-10-02")).toBe(false);
    expect(streakAtRisk({ current: 0, best: 0, lastDay: null }, "2026-10-02")).toBe(false);
  });
});

describe("повторение и XP за повтор", () => {
  const now = Date.UTC(2026, 9, 2);
  it("множитель: первый раз 1, второй 0.5, дальше 0.3, по расписанию 0.75", () => {
    expect(lessonXpFactor(undefined, now)).toBe(1);
    const st = { completions: 1, bestAccuracy: 1, lastAt: now, totalXp: 50, dueAt: now + DAY_MS };
    expect(lessonXpFactor(st, now)).toBe(REPLAY_XP.second);
    expect(lessonXpFactor({ ...st, completions: 3 }, now)).toBe(REPLAY_XP.later);
    expect(lessonXpFactor({ ...st, completions: 3 }, now + 2 * DAY_MS)).toBe(REPLAY_XP.review);
    expect(scaleXp(10, 0.3)).toBe(3);
    expect(scaleXp(1, 0.3)).toBe(1);
    expect(scaleXp(0, 0.3)).toBe(0);
  });

  it("расписание: хорошо по сроку — ступень вверх; плохо — с начала; раньше срока — без роста", () => {
    const first = scheduleAfter(undefined, 1, now);
    expect(first).toEqual({ stage: 0, dueAt: now + DAY_MS });
    const st = { completions: 1, bestAccuracy: 1, lastAt: now, totalXp: 0, stage: 0, dueAt: now + DAY_MS };
    expect(scheduleAfter(st, 0.9, now + DAY_MS).stage).toBe(1);
    expect(scheduleAfter(st, 0.7, now + DAY_MS).stage).toBe(0);
    expect(scheduleAfter({ ...st, stage: 3 }, 0.5, now + DAY_MS).stage).toBe(0);
    expect(scheduleAfter({ ...st, stage: 2, dueAt: now + 5 * DAY_MS }, 1, now).stage).toBe(2);
    expect(scheduleAfter({ ...st, stage: 5 }, 1, now + DAY_MS).stage).toBe(5);
  });

  it("dueLessons — от самых остывших, старые сохранения без расписания тоже попадают", () => {
    const lessons = {
      a: { completions: 1, bestAccuracy: 1, lastAt: now - 10 * DAY_MS, totalXp: 0, dueAt: now - 3 * DAY_MS },
      b: { completions: 1, bestAccuracy: 1, lastAt: now - 3 * DAY_MS, totalXp: 0 },
      c: { completions: 1, bestAccuracy: 1, lastAt: now, totalXp: 0, dueAt: now + DAY_MS },
    };
    expect(dueLessons(lessons, now).map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("стор v2", () => {
  beforeEach(() => useApp.getState().resetProgress());

  it("повтор урока даёт меньше бонусного XP, «без ошибок» — только за первый раз", () => {
    const s = useApp.getState();
    expect(s.finishSession(lessonResult()).bonusXp).toBe(40);
    expect(useApp.getState().finishSession(lessonResult()).bonusXp).toBe(10);
    expect(useApp.getState().finishSession(lessonResult()).bonusXp).toBe(6);
    const st = useApp.getState().lessons["ns-2-read"];
    expect(st.completions).toBe(3);
    expect(st.via).toBe("learn");
    expect(st.dueAt).toBeGreaterThan(Date.now());
    expect(useApp.getState().days[Object.keys(useApp.getState().days)[0]].lessons).toBe(3);
  });

  it("проверить себя — половина бонуса; экстерн и игра засчитывают урок без XP", () => {
    expect(useApp.getState().finishSession(lessonResult({ via: "check", lessonId: "ns-3-write" })).bonusXp).toBe(20);
    const xp = useApp.getState().xp;
    useApp.getState().completeLessons(["ns-1-bits", "ns-4-traps"], "extern", 0.9);
    expect(useApp.getState().xp).toBe(xp);
    expect(useApp.getState().lessons["ns-1-bits"].via).toBe("extern");
    expect(useApp.getState().lessons["ns-4-traps"].completions).toBe(1);
  });

  it("конспекты: папки, записи, перенос при удалении папки, закрепление", () => {
    const s = useApp.getState();
    const folder = s.createFolder("  Формулы  ", "gold");
    expect(useApp.getState().notebook.folders.find((f) => f.id === folder)?.name).toBe("Формулы");
    const a = useApp.getState().createNote({ folderId: folder, body: "# I = K · i\nобъём сообщения" });
    const b = useApp.getState().createNote({ folderId: folder, body: "второе" });
    expect(useApp.getState().notebook.notes.find((n) => n.id === a)?.title).toBe("I = K · i");
    useApp.getState().updateNote(a, { pinned: true });
    expect(notesInFolder(useApp.getState().notebook, folder).map((n) => n.id)).toEqual([a, b]);
    useApp.getState().deleteFolder(folder);
    expect(useApp.getState().notebook.notes.every((n) => n.folderId === systemFolderId("general"))).toBe(true);
    useApp.getState().deleteFolder(systemFolderId("ai"));
    expect(useApp.getState().notebook.folders.some((f) => f.id === systemFolderId("ai"))).toBe(true);
    expect(useApp.getState().achievements.explorer).toBeTruthy();
  });

  it("ответ ИИ (совместимость saveToNotes) попадает в папку «Ответы Бита» с уроком", () => {
    const id = useApp.getState().saveToNotes("ns-2-read", "**Подсказка** про веса");
    const note = useApp.getState().notebook.notes.find((n) => n.id === id)!;
    expect(note.folderId).toBe(systemFolderId("ai"));
    expect(note.lessonId).toBe("ns-2-read");
    expect(note.source).toBe("ai");
  });

  it("удаление записи возвращает её картинки", () => {
    const id = useApp.getState().createNote({ source: "scratch", body: "![](note-img:x1)", images: ["x1"] });
    expect(useApp.getState().deleteNote(id)).toEqual(["x1"]);
    expect(useApp.getState().deleteNote("nope")).toEqual([]);
  });

  it("пробный ЕНТ: история, освоение навыков, без XP", () => {
    useApp.getState().recordExam(
      { id: "e1", kind: "mini", seed: 42, at: Date.now(), points: 12, maxPoints: 19, durationSec: 900, byTopic: { t04: { points: 3, max: 4 } } },
      { "ns.bin2dec": [1, 0, 1], "logic.ops": [0.5] },
    );
    const st = useApp.getState();
    expect(st.exams).toHaveLength(1);
    expect(st.xp).toBe(0);
    expect(st.skills["ns.bin2dec"].attempts).toBe(3);
    expect(st.achievements.exam_first).toBeTruthy();
  });

  it("импорт резервной копии: проверка формата и миграция v1", () => {
    expect(useApp.getState().importProgress({ hello: 1 })).toBe(false);
    const ok = useApp.getState().importProgress({
      xp: 120,
      profile: { name: "Айым", lang: "kk" },
      notes: { general: { own: "моя заметка", saved: [] } },
      lessons: { "ns-2-read": { completions: 1, bestAccuracy: 0.9, lastAt: 1000, totalXp: 50 } },
    });
    expect(ok).toBe(true);
    const st = useApp.getState();
    expect(st.xp).toBe(120);
    expect(st.profile.lang).toBe("kk");
    expect(st.profile.avatar).toEqual({ kind: "initial", color: "primary" });
    expect(st.notebook.notes[0].body).toBe("моя заметка");
    expect(st.lessons["ns-2-read"].dueAt).toBe(1000 + DAY_MS);
  });
});

describe("миграция и проверка сохранений", () => {
  it("v1 → v2: заметки и ответы ИИ переезжают в папки", () => {
    const nb = migrateLegacyNotes(
      {
        general: { own: "общая", saved: [{ id: "s1", text: "ответ ИИ", at: 5 }] },
        "ns-2-read": { own: "", saved: [{ id: "s2", text: "разбор", at: 6 }] },
      },
      100,
    );
    expect(nb.notes.map((n) => [n.folderId, n.source, n.lessonId ?? null])).toEqual([
      [systemFolderId("general"), "own", null],
      [systemFolderId("ai"), "ai", null],
      [systemFolderId("ai"), "ai", "ns-2-read"],
    ]);
  });

  it("мусор в хранилище не ломает конспекты и профиль", () => {
    const nb = repairNotebook({ folders: [null, { id: 3 }], notes: [{ id: "a", body: "x", folderId: "nope" }, "bad"] });
    expect(nb.folders.some((f) => f.system === "general")).toBe(true);
    expect(nb.notes).toHaveLength(1);
    expect(nb.notes[0].folderId).toBe(systemFolderId("general"));
    const merged = mergeState(
      { profile: { avatar: { kind: "photo", data: "javascript:alert(1)" }, reminder: { time: "99:99" }, targetScore: 500 } },
      useApp.getState(),
    );
    expect(merged.profile.avatar.kind).toBe("initial");
    expect(merged.profile.reminder.time).toBe("19:00");
    expect(merged.profile.targetScore).toBe(35);
    const v1 = migrateState({ notes: { general: { own: "x" } }, lessons: {} }, 1);
    expect(v1.notebook?.notes).toHaveLength(1);
    expect("notes" in v1).toBe(false);
  });

  it("заголовок по первой строке без разметки и картинок", () => {
    expect(titleFromBody("![](note-img:1)\n## **Шифр** Цезаря")).toBe("Шифр Цезаря");
    expect(titleFromBody("")).toBe("");
  });
});

describe("повторение в сторе", () => {
  beforeEach(() => useApp.getState().resetProgress());
  it("markReviewed сдвигает расписание пройденного урока и не трогает непройденный", () => {
    useApp.getState().finishSession(lessonResult());
    const before = useApp.getState().lessons["ns-2-read"];
    useApp.setState({ lessons: { "ns-2-read": { ...before, dueAt: Date.now() - 1000 } } });
    useApp.getState().markReviewed(["ns-2-read", "ns-9-none"], 0.9);
    const after = useApp.getState().lessons["ns-2-read"];
    expect(after.stage).toBe(1);
    expect(after.completions).toBe(1);
    expect(after.dueAt).toBeGreaterThan(Date.now() + 2 * DAY_MS);
    expect(useApp.getState().lessons["ns-9-none"]).toBeUndefined();
  });
});
