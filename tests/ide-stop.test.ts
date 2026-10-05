import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkPython, MSG_STOPPED, type PyRun } from "@/lib/ide/python/check";
import { checkJs, MSG_STOPPED as JS_MSG_STOPPED } from "@/lib/ide/js/check";

// «Стоп» в практикуме (этап 14): запуск завершается с `stopped`, а не зависает; проверка не считает остановку попыткой.
// Воркеры подменяем: настоящий Pyodide в тестах не нужен — проверяем протокол runner'ов.

type Handler = (ev: { data: unknown }) => void;

class FakeWorker {
  static all: FakeWorker[] = [];
  terminated = false;
  posted: { type: string; id?: number }[] = [];
  onmessage: Handler | null = null;
  onerror: ((ev: { preventDefault(): void; message?: string }) => void) | null = null;
  private listeners = new Map<string, Set<Handler>>();
  constructor(
    public url: string,
    public opts?: unknown,
  ) {
    FakeWorker.all.push(this);
  }
  addEventListener(type: string, fn: Handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: Handler) {
    this.listeners.get(type)?.delete(fn);
  }
  postMessage(msg: { type: string; id?: number }) {
    this.posted.push(msg);
  }
  terminate() {
    this.terminated = true;
  }
  /** Сообщение воркера → основному потоку. */
  emit(data: unknown) {
    for (const fn of this.listeners.get("message") ?? []) fn({ data });
    this.onmessage?.({ data });
  }
}

const tick = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  FakeWorker.all = [];
  vi.stubGlobal("Worker", FakeWorker);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runPython + stopPython", () => {
  it("«Стоп» во время выполнения: запуск завершается, вывод до остановки сохранён, воркер убит", async () => {
    const { runPython, stopPython } = await import("@/lib/ide/python/runner");
    const p = runPython({ code: "while True: pass" });
    await tick();
    const w = FakeWorker.all[0];
    const id = w.posted[0].id;
    w.emit({ type: "start", id });
    w.emit({ type: "stdout", id, text: "1\n" });
    stopPython();
    const r = await p;
    expect(r.stopped).toBe(true);
    expect(r.stdout).toBe("1\n");
    expect(r.timedOut).toBeUndefined();
    expect(r.loadFailed).toBeUndefined();
    expect(w.terminated).toBe(true);
  });

  it("«Стоп» во время загрузки Python: тоже останавливает, статус «загрузка» был показан", async () => {
    const { runPython, stopPython } = await import("@/lib/ide/python/runner");
    const seen: string[] = [];
    const p = runPython({ code: "print(1)", onStatus: (s) => seen.push(s) });
    await tick();
    const w = FakeWorker.all[0];
    w.emit({ type: "loading", id: w.posted[0].id });
    stopPython();
    const r = await p;
    expect(seen).toEqual(["loading"]);
    expect(r.stopped).toBe(true);
    expect(r.loadFailed).toBeUndefined();
    expect(w.terminated).toBe(true);
  });

  it("после остановки следующий запуск создаёт новый воркер и проходит как обычно", async () => {
    const { runPython, stopPython } = await import("@/lib/ide/python/runner");
    const first = runPython({ code: "while True: pass" });
    await tick();
    stopPython();
    await first;
    const second = runPython({ code: "print(2)" });
    await tick();
    expect(FakeWorker.all.length).toBe(2);
    const w = FakeWorker.all[1];
    const id = w.posted[0].id;
    w.emit({ type: "start", id });
    w.emit({ type: "stdout", id, text: "2\n" });
    w.emit({ type: "done", id, ms: 3 });
    const r = await second;
    expect(r.stopped).toBeUndefined();
    expect(r.stdout).toBe("2\n");
  });

  it("запуски в очереди за остановленным не стартуют", async () => {
    const { runPython, stopPython } = await import("@/lib/ide/python/runner");
    const a = runPython({ code: "while True: pass" });
    const b = runPython({ code: "print(1)" });
    await tick();
    expect(FakeWorker.all.length).toBe(1);
    stopPython();
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.stopped).toBe(true);
    expect(rb.stopped).toBe(true);
    expect(FakeWorker.all.length).toBe(1);
  });

  it("stopPython без запуска ничего не ломает", async () => {
    const { runPython, stopPython } = await import("@/lib/ide/python/runner");
    stopPython();
    const p = runPython({ code: "print(1)" });
    await tick();
    const w = FakeWorker.all[0];
    w.emit({ type: "start", id: w.posted[0].id });
    w.emit({ type: "done", id: w.posted[0].id, ms: 1 });
    expect((await p).stopped).toBeUndefined();
  });
});

describe("checkPython и «Стоп»", () => {
  const check = { kind: "python" as const, tests: [{ stdout: "1" }, { stdout: "2" }, { stdout: "3" }] };

  it("остановка прерывает проверку на первом же тесте: остальные не запускаются", async () => {
    let calls = 0;
    const run: PyRun = async () => {
      calls++;
      return { stdout: "", stopped: true };
    };
    const r = await checkPython(check, "print(1)", run);
    expect(calls).toBe(1);
    expect(r.ok).toBe(false);
    expect(r.message).toEqual(MSG_STOPPED);
  });

  it("остановка после пройденных тестов сохраняет число пройденных", async () => {
    let n = 0;
    const run: PyRun = async () => (++n < 3 ? { stdout: String(n) } : { stdout: "", stopped: true });
    const r = await checkPython(check, "print(1)", run);
    expect(r.passed).toBe(2);
    expect(r.message).toEqual(MSG_STOPPED);
  });
});

describe("checkJs и «Стоп»", () => {
  it("остановленный запуск — не «не совпало»", async () => {
    const r = await checkJs({ kind: "js", stdout: "1" }, "console.log(1)", async () => ({ stdout: "", stopped: true }));
    expect(r.ok).toBe(false);
    expect(r.message).toEqual(JS_MSG_STOPPED);
  });
});

describe("runJs + stopJs", () => {
  it("«Стоп» завершает запуск: вывод до остановки сохранён, воркер убит", async () => {
    const { runJs, stopJs } = await import("@/lib/ide/js/runner");
    const p = runJs("while (true) {}");
    const w = FakeWorker.all[0];
    w.emit({ type: "ready" });
    const id = w.posted[0].id;
    w.emit({ type: "log", id, level: "log", text: "a" });
    stopJs();
    const r = await p;
    expect(r.stopped).toBe(true);
    expect(r.lines.map((l) => l.text)).toEqual(["a"]);
    expect(r.timedOut).toBeUndefined();
    expect(w.terminated).toBe(true);
  });

  it("новый запуск прерывает предыдущий, а не оставляет его висеть", async () => {
    const { runJs } = await import("@/lib/ide/js/runner");
    const first = runJs("while (true) {}");
    const second = runJs("console.log(1)");
    expect((await first).stopped).toBe(true);
    const w = FakeWorker.all[1];
    w.emit({ type: "ready" });
    w.emit({ type: "done", id: w.posted[0].id, ms: 1 });
    expect((await second).stopped).toBeUndefined();
  });
});
