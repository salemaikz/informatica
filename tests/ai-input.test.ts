import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { StudentContext } from "@/lib/ai-types";
import { cacheTask } from "@/lib/ai-cache";

const { clipEnd, FEEDBACK_SUMMARY_MAX_CHARS, feedbackSummary, fitInput, historyChars, messagesChars, renderContext, sanitizeContext, sanitizeHistory, sanitizeTask } = await import(
  "@/server/context"
);
const { INPUT_BUDGET } = await import("@/server/openai");
const { checkSolutionPrompt, lessonFeedbackPrompt, tutorSystemPrompt } = await import("@/server/prompts");

// v0.9.1: бюджет входа одного запроса к ИИ (INPUT_BUDGET, fitInput). Маленький запрос не меняется, большой укладывается,
// последний вопрос ученика цел, системные правила не трогаются.

const word = (n: number, ch = "я") => ch.repeat(n);
const msg = (role: "user" | "assistant", content: string) => ({ role, content });

/** Контекст с заполненными полями на потолках sanitizeContext. */
function maxContext(lang: "ru" | "kk" = "ru") {
  return sanitizeContext({
    name: word(40),
    lang,
    grade: "9",
    track: "school",
    goal: "ent",
    style: "steps",
    level: 12,
    xp: 3400,
    streak: 5,
    weak: Array.from({ length: 8 }, () => word(60, "а")),
    strong: Array.from({ length: 8 }, () => word(60, "б")),
    mistakes: Array.from({ length: 6 }, () => ({ q: word(220, "в"), given: word(80, "г"), expected: word(80, "д") })),
    notes: word(800, "н"),
    lessons: Array.from({ length: 20 }, () => word(80, "у")),
  });
}

/** Обычный ученик: короткие списки и заметки. */
const smallContext = () =>
  sanitizeContext({
    name: "Айгерим",
    lang: "ru",
    grade: "9",
    track: "ent",
    goal: "ent",
    style: "short",
    level: 3,
    xp: 240,
    streak: 2,
    weak: ["Системы счисления (30%)"],
    strong: ["Биты и байты (90%)"],
    mistakes: [{ q: "Переведи 5 в двоичную", given: "11", expected: "101" }],
    notes: "Степени двойки: 1, 2, 4, 8",
    lessons: ["Биты", "Байты"],
  });

/** Потолочные значения полей задания каждой ветки промпта: практикум, теория шага, обычное задание. */
const taskVariants = () =>
  [
    { ide: word(40, "p"), prompt: word(600), theory: word(1500), code: word(2000), error: word(500), answered: false },
    { prompt: word(600), theory: word(1500), answered: true },
    {
      prompt: word(600),
      options: Array.from({ length: 8 }, () => word(120)),
      correct: word(200),
      given: word(200),
      explanation: word(800),
      hint: word(500),
      whyWrong: word(600),
      answered: true,
    },
  ].map((t) => sanitizeTask(t)!);

const MODES = ["chat", "hint", "ask", "explain"] as const;
const CHAT_MODES = ["free", "explain", "tasks", "check", "ent"] as const;

describe("бюджеты входа", () => {
  it("tutor 16 000, фото-проверка 6 000, отзыв 6 000 символов", () => {
    expect(INPUT_BUDGET).toEqual({ tutor: 16_000, check: 6_000, feedback: 6_000 });
  });
});

describe("fitInput: маленький запрос не меняется", () => {
  it("обычный чат: те же объекты, trimmed = false", () => {
    const ctx = smallContext();
    const history = [msg("user", "Что такое бит?"), msg("assistant", "Бит — 0 или 1."), msg("user", "А байт?")];
    const fit = fitInput({ budget: INPUT_BUDGET.tutor, ctx, history, base: (c) => tutorSystemPrompt(c, "chat").length });
    expect(fit.ctx).toBe(ctx);
    expect(fit.history).toBe(history);
    expect(fit.trimmed).toBe(false);
    expect(fit.chars).toBe(tutorSystemPrompt(ctx, "chat").length + historyChars(history));
    expect(fit.chars).toBeLessThan(INPUT_BUDGET.tutor / 2);
  });

  it("запрос ровно в бюджет не обрезается, на символ больше — обрезается", () => {
    const ctx = smallContext();
    const history = [msg("user", word(100)), msg("user", word(100))];
    const size = 500 + historyChars(history);
    expect(fitInput({ budget: size, ctx, history, base: () => 500 }).trimmed).toBe(false);
    const over = fitInput({ budget: size - 1, ctx, history, base: () => 500 });
    expect(over.trimmed).toBe(true);
    expect(over.history).toEqual([history[1]]);
  });
});

describe("fitInput: история — старые сообщения отбрасываются первыми", () => {
  it("остаются самые свежие, порядок сохраняется, контекст цел", () => {
    const ctx = maxContext();
    const history = Array.from({ length: 5 }, (_, i) => msg(i % 2 ? "assistant" : "user", `${i}`.repeat(1000)));
    // 5 × 1000 + 1000 = 6000; бюджет 3500 → отбрасываем три самых старых
    const fit = fitInput({ budget: 3500, ctx, history, base: () => 1000 });
    expect(fit.history).toEqual(history.slice(3));
    expect(fit.ctx).toBe(ctx);
    expect(fit.chars).toBe(3000);
    expect(fit.trimmed).toBe(true);
  });

  it("последний вопрос остаётся целиком (2000 символов), даже если бюджет невозможен; контекст сведён к основе", () => {
    const ctx = maxContext();
    const last = msg("user", word(2000, "q"));
    const history = [msg("user", word(2000)), msg("assistant", word(2000)), last];
    const fit = fitInput({ budget: 500, ctx, history, base: (c) => 300 + renderContext(c).length });
    expect(fit.history).toEqual([last]);
    expect(fit.chars).toBeGreaterThan(500); // правила + основа + вопрос не поддаются ужатию
    expect(fit.ctx.notes).toBe("");
    expect(fit.ctx.mistakes).toEqual([]);
    expect(fit.ctx.lessons).toEqual([]);
    expect(fit.ctx.weak).toEqual([]);
    expect(fit.ctx.strong).toEqual([]);
    // основа и режим обучения на месте
    expect(fit.ctx).toMatchObject({ name: ctx.name, lang: "ru", grade: "9", track: "school", goal: "ent", style: "steps", level: 12, xp: 3400, streak: 5 });
  });

  it("пустая история (подсказка, разбор ошибки) не ломается", () => {
    const fit = fitInput({ budget: 100, ctx: maxContext(), history: [], base: (c) => renderContext(c).length });
    expect(fit.history).toEqual([]);
    expect(fit.trimmed).toBe(true);
  });
});

describe("fitInput: контекст ужимается с конца необязательных частей", () => {
  const ctx = maxContext();
  const history = [msg("user", "вопрос")];
  const base = (c: StudentContext) => 1000 + renderContext(c).length;
  const full = base(ctx) + historyChars(history);

  it("сначала заметки ученика (с конца), ошибки целы", () => {
    const fit = fitInput({ budget: full - 100, ctx, history, base });
    expect(fit.ctx.notes).toHaveLength(700);
    expect(fit.ctx.mistakes).toEqual(ctx.mistakes);
    expect(fit.chars).toBeLessThanOrEqual(full - 100);
  });

  it("потом ошибки по одной с конца; уроки и темы — позже", () => {
    const budget = full - 800 - 100; // заметки уйдут целиком, и ещё около 100 символов
    const fit = fitInput({ budget, ctx, history, base });
    expect(fit.ctx.notes).toBe("");
    expect(fit.ctx.mistakes.length).toBeLessThan(6);
    expect(fit.ctx.mistakes).toEqual(ctx.mistakes.slice(0, fit.ctx.mistakes.length));
    expect(fit.ctx.lessons).toEqual(ctx.lessons);
    expect(fit.chars).toBeLessThanOrEqual(budget);

    // а если бюджет совсем мал — уходят ошибки, уроки, сильные и слабые темы
    const hard = fitInput({ budget: 600, ctx, history, base });
    expect(hard.ctx.notes).toBe("");
    expect(hard.ctx.mistakes).toEqual([]);
    expect(hard.ctx.lessons).toEqual([]);
    expect(hard.ctx.strong).toEqual([]);
    expect(hard.ctx.weak).toEqual([]);
  });

  it("«памяти ИИ» в контексте нет: поле из запроса отбрасывается, в промпт не попадает (этап 16В, L)", () => {
    const raw = { ...smallContext(), memory: "- любит примеры; помнит про степени двойки" };
    const clean = sanitizeContext(raw);
    expect("memory" in clean).toBe(false);
    expect(renderContext(clean)).not.toContain("помнит про степени двойки");
    expect(renderContext(clean)).not.toMatch(/памят/i);
    expect(lessonFeedbackPrompt(clean)).not.toContain("помнит про степени двойки");
  });

  it("не мутирует вход и сохраняет лишние поля контекста (track)", () => {
    const before = structuredClone({ ctx, history });
    const fit = fitInput({ budget: 800, ctx, history, base });
    expect({ ctx, history }).toEqual(before);
    expect(fit.ctx.track).toBe("school");
    expect(fit.ctx).not.toBe(ctx);
  });

  it("завершается, даже если размер от контекста не зависит", () => {
    const fit = fitInput({ budget: 10, ctx, history, base: () => 99_999 });
    expect(fit.chars).toBe(99_999 + historyChars(history));
    expect(fit.ctx.notes).toBe("");
    expect(fit.ctx.mistakes).toEqual([]);
  });
});

describe("fitInput: тяжёлый реальный запрос укладывается в бюджет tutor", () => {
  it("потолочный контекст + потолочное задание + история на потолке: все режимы, оба языка, ≤ 16 000", () => {
    const rawHistory = Array.from({ length: 14 }, (_, i) => msg(i % 2 ? "assistant" : "user", word(2500, "ж")));
    let trimmedSome = false;
    for (const lang of ["ru", "kk"] as const) {
      const ctx = maxContext(lang);
      const history = sanitizeHistory(rawHistory);
      const last = history[history.length - 1];
      for (const task of [undefined, ...taskVariants()]) {
        for (const mode of MODES) {
          for (const chatMode of mode === "chat" ? CHAT_MODES : [undefined]) {
            const opts = { chatMode, topic: "Системы счисления" };
            const fit = fitInput({ budget: INPUT_BUDGET.tutor, ctx, history, base: (c) => tutorSystemPrompt(c, mode, task, opts).length });
            const label = `${lang}/${mode}/${chatMode ?? "-"}/${task ? Object.keys(task).length : "no-task"}`;
            expect(fit.chars, label).toBeLessThanOrEqual(INPUT_BUDGET.tutor);
            expect(fit.chars, label).toBe(tutorSystemPrompt(fit.ctx, mode, task, opts).length + historyChars(fit.history));
            expect(fit.history[fit.history.length - 1], label).toEqual(last);
            expect(fit.ctx.name, label).toBe(ctx.name);
            trimmedSome ||= fit.trimmed;
          }
        }
      }
    }
    expect(trimmedSome).toBe(true); // бюджет в самом деле срабатывает на тяжёлых запросах
  });

  it("обычный ученик (не потолок) в каждом режиме проходит без обрезки", () => {
    const ctx = smallContext();
    const history = [msg("user", "Объясни перевод в двоичную"), msg("assistant", word(600)), msg("user", "Ещё пример")];
    for (const mode of MODES) {
      const fit = fitInput({ budget: INPUT_BUDGET.tutor, ctx, history, base: (c) => tutorSystemPrompt(c, mode, { prompt: "Сколько бит в байте?" }).length });
      expect(fit.trimmed, mode).toBe(false);
    }
  });
});

describe("кэшируемый путь укладывается в бюджет по построению", () => {
  it("нейтральный промпт с потолочным заданием и приписками ≤ 16 000 во всех режимах и языках", () => {
    for (const lang of ["ru", "kk"] as const) {
      const ctx = maxContext(lang);
      for (const raw of taskVariants()) {
        for (const mode of MODES) {
          const task = cacheTask(mode, raw);
          const system = tutorSystemPrompt({ ...ctx, style: "short" }, mode, task, { neutral: true, noLeak: true });
          // быстрый вопрос-кнопка или реплика «Дай подсказку» — десятки символов
          expect(system.length + 100, `${lang}/${mode}`).toBeLessThanOrEqual(INPUT_BUDGET.tutor);
          expect(system.length + 100, `${lang}/${mode}`).toBeLessThan(INPUT_BUDGET.tutor * 0.75);
        }
      }
    }
  });
});

describe("проверка решения по фото: вход в бюджете check", () => {
  it("потолочные поля задания и ответа: промпт + ответ ученика ≤ 6 000", () => {
    for (const lang of ["ru", "kk"] as const) {
      const ctx = maxContext(lang);
      const typed = word(100, "о");
      const task = { prompt: word(600), reference: word(1200), answer: word(100) };
      const chars = messagesChars([{ content: checkSolutionPrompt(ctx, lang, task, typed) }, { content: typed }]);
      expect(chars).toBeLessThanOrEqual(INPUT_BUDGET.check);
    }
  });

  it("clipEnd убирает символы с конца и не уходит в минус", () => {
    expect(clipEnd("абвгд", 2)).toBe("абв");
    expect(clipEnd("абвгд", 0)).toBe("абвгд");
    expect(clipEnd("абвгд", 99)).toBe("");
    expect(clipEnd("слово  ", 1)).toBe("слово");
  });
});

describe("отзыв после урока: вход в бюджете feedback", () => {
  const worstBody = {
    lesson: word(120),
    accuracy: 0.4,
    durationSec: 900,
    mistakes: Array.from({ length: 12 }, () => ({ q: word(300), given: word(100), expected: word(100) })),
    skills: Array.from({ length: 12 }, (_, i) => ({ title: word(80), mastery: i / 12 })),
  };

  it("сводка не длиннее FEEDBACK_SUMMARY_MAX_CHARS: ошибки отбрасываются с конца, первая остаётся", () => {
    const s = feedbackSummary(worstBody);
    expect(s.length).toBeLessThanOrEqual(FEEDBACK_SUMMARY_MAX_CHARS);
    expect(s).toContain("Ошибки:\n- «");
    expect(s).toContain("Освоение тем после урока:");
    const small = feedbackSummary({ ...worstBody, mistakes: [{ q: "q", given: "g", expected: "e" }] });
    expect(small).toContain("- «q» — ответ «g», верно «e»");
  });

  it("обычная сводка — прежнего формата", () => {
    expect(
      feedbackSummary({
        lesson: "Двоичная система",
        accuracy: 0.8,
        durationSec: 300,
        mistakes: [{ q: "Переведи 5", given: "11", expected: "101" }],
        skills: [{ title: "Системы счисления", mastery: 0.6 }],
      }),
    ).toBe("Урок: Двоичная система\nТочность: 80%\nВремя: 5 мин\nОшибки:\n- «Переведи 5» — ответ «11», верно «101»\nОсвоение тем после урока:\n- Системы счисления: 60%");
    expect(feedbackSummary({ lesson: "Урок", accuracy: 1, durationSec: 60 })).toBe("Урок: Урок\nТочность: 100%\nВремя: 1 мин\nОшибок не было.\n");
    expect(feedbackSummary({})).toContain("Ошибок не было.");
  });

  it("потолочный контекст и тяжёлая сводка: ≤ 6 000", () => {
    for (const lang of ["ru", "kk"] as const) {
      const ctx = maxContext(lang);
      const summary = feedbackSummary(worstBody);
      const fit = fitInput({ budget: INPUT_BUDGET.feedback, ctx, history: [], base: (c) => lessonFeedbackPrompt(c).length + summary.length });
      expect(fit.chars, lang).toBeLessThanOrEqual(INPUT_BUDGET.feedback);
      expect(fit.chars, lang).toBe(lessonFeedbackPrompt(fit.ctx).length + summary.length);
    }
  });

  it("промпт отзыва: два поля (feedback, focus), про память и заметки наставника — ни слова", () => {
    for (const lang of ["ru", "kk"] as const) {
      const p = lessonFeedbackPrompt({ ...smallContext(), lang });
      expect(p, lang).toContain("1) feedback");
      expect(p, lang).toContain("2) focus");
      expect(p, lang).not.toMatch(/memory|памят|заметки наставника/i);
    }
  });
});

describe("messagesChars", () => {
  it("строки и текстовые части считаются, картинка — нет", () => {
    const image = `data:image/png;base64,${word(5000, "A")}`;
    expect(
      messagesChars([
        { content: "abc" },
        { content: [{ type: "text", text: "defg" }, { type: "image_url", image_url: { url: image } }] },
        { content: null },
        {},
      ]),
    ).toBe(7);
  });
});
