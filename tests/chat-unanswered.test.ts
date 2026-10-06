import { describe, expect, it } from "vitest";
import { unansweredTail } from "@/components/chat/helpers";
import type { ChatMsg } from "@/lib/chats";
import type { TutorTurn } from "@/components/ai/useTutor";

// Вопрос остался без ответа (ушли со страницы до первого текста, перезагрузка) — «Ответ не пришёл» и «Повторить».

const msg = (role: ChatMsg["role"], extra: Partial<ChatMsg> = {}): ChatMsg => ({ id: Math.random().toString(36), role, content: "x", at: 1, ...extra });

describe("unansweredTail", () => {
  it("последний — вопрос ученика: да", () => {
    expect(unansweredTail([msg("user")])).toBe(true);
    expect(unansweredTail([msg("user"), msg("assistant"), msg("user")])).toBe(true);
  });
  it("последний — ответ Бита или итог «Дай задачи»: нет", () => {
    expect(unansweredTail([msg("user"), msg("assistant")])).toBe(false);
    expect(unansweredTail([msg("assistant", { quiz: { correct: 3, total: 5, grade: 3, mistakes: [] } as never })])).toBe(false);
  });
  it("пустая лента: нет", () => {
    expect(unansweredTail([])).toBe(false);
  });
  it("нить шторки ИИ (TutorTurn) — то же правило", () => {
    const open: TutorTurn[] = [{ role: "user", content: "Вопрос" }];
    const done: TutorTurn[] = [...open, { role: "assistant", content: "Ответ" }];
    expect(unansweredTail(open)).toBe(true);
    expect(unansweredTail(done)).toBe(false);
  });
});
