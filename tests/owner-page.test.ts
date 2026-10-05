import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildOwnerReport, retention } from "@/lib/owner-report";
import type { OwnerData } from "@/server/owner-data";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));

const state = vi.hoisted(() => ({ data: null as unknown }));
vi.mock("@/server/owner-data", () => ({
  ownerSession: async () => "ok",
  loadOwnerData: async () => state.data,
}));

const { default: OwnerPage } = await import("@/app/owner/page");

const names = { lesson: () => undefined, task: () => undefined };
const base = (over: Partial<OwnerData>): OwnerData => ({
  period: 7,
  storage: "upstash",
  collecting: true,
  unavailable: false,
  report: buildOwnerReport([], names),
  retention: retention([]),
  issues: [],
  errors: [],
  ...over,
});

const render = async () => renderToString(await OwnerPage({ searchParams: Promise.resolve({}) }));

describe("страница владельца: хранилище не ответило (C3)", () => {
  it("вместо таблиц с нулями — явное предупреждение; чип хранилища и переключатель периода остаются", async () => {
    state.data = base({ unavailable: true });
    const html = await render();
    expect(html).toContain("Хранилище не ответило");
    expect(html).toContain("данные не загружены");
    // Ни одной секции со сводкой: «Пока нет данных» тут было бы ложью.
    expect(html).not.toContain("Пока нет данных");
    expect(html).not.toContain("Воронка уроков");
    expect(html).not.toContain("Жалобы и отзывы");
    expect(html).toContain("Upstash");
  });

  it("данные есть — обычная страница без предупреждения; в диагностике — «Пропустили (кнопкой)»", async () => {
    state.data = base({});
    const html = await render();
    expect(html).not.toContain("Хранилище не ответило");
    expect(html).toContain("Воронка уроков");
    expect(html).toContain("Пропустили (кнопкой)");
    expect(html).not.toContain("или выход");
    expect(html).toContain("Закрытие вкладки");
  });
});
