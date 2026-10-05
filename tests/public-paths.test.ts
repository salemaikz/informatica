import { describe, expect, it } from "vitest";
import { isPublicPath, isRecipientPath } from "@/lib/public-paths";

describe("публичные адреса этапа 13 (#72–#74)", () => {
  it("/report и /r/<код> открываются без онбординга", () => {
    for (const p of ["/report", "/r/x1-m-14-19-k-1-a9zq", "/r/s1-3-3-r", "/r"]) expect(isPublicPath(p), p).toBe(true);
  });

  it("вариант по вызову и остальное — только после онбординга (возврат — через pending-link)", () => {
    for (const p of ["/exam/run", "/exam", "/rx", "/reports", "/report/x", "/exam/print", "/route"]) expect(isPublicPath(p), p).toBe(false);
  });

  it("страницы получателя ссылки: не считаем «активный день»", () => {
    for (const p of ["/report", "/r/s1-3-3-r"]) expect(isRecipientPath(p), p).toBe(true);
    for (const p of ["/", "/onboarding", "/privacy", "/exam/run", "/rx"]) expect(isRecipientPath(p), p).toBe(false);
  });
});
