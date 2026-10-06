import { describe, expect, it } from "vitest";
import { FRIEND_CODE_ALPHABET, formatFriendCode, generateFriendCode, isFriendCode, normalizeFriendCode } from "@/lib/friend-code";

const bytes = (...b: number[]) => () => Uint8Array.from(b);

describe("код друга", () => {
  it("алфавит Крокфорда: 32 знака, без I, L, O, U", () => {
    expect(FRIEND_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(FRIEND_CODE_ALPHABET).size).toBe(32);
    for (const c of "ILOU") expect(FRIEND_CODE_ALPHABET).not.toContain(c);
  });

  it("40 бит → 8 знаков без перекоса", () => {
    expect(generateFriendCode(bytes(0, 0, 0, 0, 0))).toBe("00000000");
    expect(generateFriendCode(bytes(255, 255, 255, 255, 255))).toBe("ZZZZZZZZ");
    expect(generateFriendCode(bytes(0b00001000, 0b01000011, 0, 0, 1))).toBe("111G0001");
    expect(() => generateFriendCode(bytes(1, 2))).toThrow();
  });

  it("случайные коды: формат, разные, все знаки встречаются", () => {
    const codes = new Set<string>();
    const chars = new Set<string>();
    for (let k = 0; k < 2000; k++) {
      const c = generateFriendCode();
      expect(isFriendCode(c)).toBe(true);
      codes.add(c);
      for (const ch of c) chars.add(ch);
    }
    expect(codes.size).toBe(2000);
    expect(chars.size).toBe(32);
  });

  it("показ и разбор ввода: регистр, дефисы, пробелы, похожие знаки, кириллица", () => {
    expect(formatFriendCode("K7QF29XM")).toBe("K7QF-29XM");
    expect(normalizeFriendCode("K7QF-29XM")).toBe("K7QF29XM");
    expect(normalizeFriendCode(" k7qf 29xm ")).toBe("K7QF29XM");
    expect(normalizeFriendCode("k7qf–29xm")).toBe("K7QF29XM");
    expect(normalizeFriendCode("O0IL-1234")).toBe("00111234");
    expect(normalizeFriendCode("U0000000")).toBe("V0000000");
    // Русская раскладка: К, Т, Х, М, Р, Е — похожие буквы; О — ноль.
    expect(normalizeFriendCode("К7QF-29ХМ")).toBe("K7QF29XM");
    expect(normalizeFriendCode("РЕТО-0000")).toBe("PET00000");
    expect(normalizeFriendCode("K7QF​29XM")).toBe("K7QF29XM");
  });

  it("негодный ввод — null", () => {
    for (const bad of ["", "K7QF-29X", "K7QF-29XMM", "K7QF-29X!", "Ж7QF-29XM", "K7QF/29XM", "x".repeat(40), null, 12345678, undefined]) {
      expect(normalizeFriendCode(bad)).toBeNull();
    }
    expect(isFriendCode("K7QF-29XM")).toBe(false);
    expect(isFriendCode("k7qf29xm")).toBe(false);
    expect(isFriendCode("K7QF29XI")).toBe(false);
  });
});
