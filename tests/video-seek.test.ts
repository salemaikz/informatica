import { describe, expect, it } from "vitest";
import { RATES, clampFrame, formatRate, sanitizeRate, seekFrame, stepRate } from "@/videos/seek";

describe("clampFrame", () => {
  it("держит кадр в 0…duration−1", () => {
    expect(clampFrame(-10, 300)).toBe(0);
    expect(clampFrame(150, 300)).toBe(150);
    expect(clampFrame(300, 300)).toBe(299);
    expect(clampFrame(9999, 300)).toBe(299);
  });
  it("округляет и переживает мусор", () => {
    expect(clampFrame(10.6, 300)).toBe(11);
    expect(clampFrame(Number.NaN, 300)).toBe(0);
    expect(clampFrame(5, 0)).toBe(0);
  });
});

describe("seekFrame", () => {
  it("±5 с при 30 fps = ±150 кадров", () => {
    expect(seekFrame(300, 5, 30, 3000)).toBe(450);
    expect(seekFrame(300, -5, 30, 3000)).toBe(150);
  });
  it("не выходит за границы", () => {
    expect(seekFrame(100, -5, 30, 3000)).toBe(0);
    expect(seekFrame(2900, 5, 30, 3000)).toBe(2999);
  });
});

describe("скорость", () => {
  it("sanitizeRate принимает только известные значения", () => {
    expect(sanitizeRate("1.5")).toBe(1.5);
    expect(sanitizeRate(0.75)).toBe(0.75);
    expect(sanitizeRate("3")).toBe(1);
    expect(sanitizeRate(null)).toBe(1);
    expect(sanitizeRate("abc")).toBe(1);
    expect(sanitizeRate("1.5abc")).toBe(1);
    expect(sanitizeRate("")).toBe(1);
    expect(sanitizeRate(" 0.5 ")).toBe(0.5);
    expect(sanitizeRate({})).toBe(1);
    expect(sanitizeRate(Number.POSITIVE_INFINITY)).toBe(1);
  });
  it("stepRate двигается по лесенке и стоит на краях", () => {
    expect(stepRate(1, 1)).toBe(1.25);
    expect(stepRate(1, -1)).toBe(0.75);
    expect(stepRate(2, 1)).toBe(2);
    expect(stepRate(RATES[0], -1)).toBe(RATES[0]);
    // неизвестное текущее значение сначала приводится к 1×
    expect(stepRate(3, 1)).toBe(1.25);
  });
  it("formatRate", () => {
    expect(formatRate(1)).toBe("1×");
    expect(formatRate(0.75)).toBe("0.75×");
  });
});
