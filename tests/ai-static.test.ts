import { describe, expect, it } from "vitest";
import { staticAiText } from "@/lib/ai-static";

describe("staticAiText", () => {
  it("подсказка — только hint автора, без разбора", () => {
    expect(staticAiText("hint", { hint: "Начни с..", explanation: "Потому что" })).toBe("Начни с..");
    expect(staticAiText("hint", { explanation: "Потому что" })).toBeUndefined();
    expect(staticAiText("hint", { hint: "  " })).toBeUndefined();
  });
  it("разбор — whyWrong + объяснение, иначе одно объяснение", () => {
    expect(staticAiText("explain", { whyWrong: "A", explanation: "B" })).toBe("A\n\nB");
    expect(staticAiText("explain", { explanation: "B" })).toBe("B");
    expect(staticAiText("explain", {})).toBeUndefined();
  });
  it("вопрос — бесплатного текста нет", () => {
    expect(staticAiText("ask", { hint: "x", explanation: "y" })).toBeUndefined();
  });
});
