import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BOOTSTRAP,
  BOOTSTRAP_SHA256,
  parseReply,
  PYODIDE_FILES,
  PYODIDE_INDEX_URL,
  PYODIDE_VERSION,
  SANDBOX_CSP,
  SANDBOX_FLAGS,
  sandboxSrcdoc,
} from "@/lib/python/sandbox";

const result = (extra: Record<string, unknown> = {}) => ({ id: 3, stdout: "ok\n", stderr: "", ...extra });
const step = (extra: Record<string, unknown> = {}) => ({ line: 1, vars: [{ name: "x", value: "5", type: "int" }], out: 0, ...extra });

describe("python sandbox: parseReply", () => {
  it("служебные сообщения", () => {
    expect(parseReply({ type: "hello" })).toEqual({ type: "hello" });
    expect(parseReply({ type: "status", status: "ready" })).toEqual({ type: "status", status: "ready" });
    expect(parseReply({ type: "status", status: "error", message: "CDN" })).toEqual({ type: "status", status: "error", message: "CDN" });
    expect(parseReply({ type: "status", status: "error" })).toEqual({ type: "status", status: "error", message: "load error" });
    expect(parseReply({ type: "status", status: "error", message: "x".repeat(2000) })).toMatchObject({ message: "x".repeat(500) });
  });

  it("результат: пустые error/steps → null, шаги и ошибка сохраняются", () => {
    expect(parseReply(result())).toEqual({ type: "result", id: 3, stdout: "ok\n", stderr: "", error: null, steps: null });
    const r = parseReply(result({ error: { type: "NameError", message: "name 'y' is not defined", line: 2 }, steps: [step(), step({ line: 0, out: 3, scope: "f" })] }));
    expect(r).toEqual({
      type: "result",
      id: 3,
      stdout: "ok\n",
      stderr: "",
      error: { type: "NameError", message: "name 'y' is not defined", line: 2 },
      steps: [
        { line: 1, vars: [{ name: "x", value: "5", type: "int" }], out: 0 },
        { line: 0, vars: [{ name: "x", value: "5", type: "int" }], out: 3, scope: "f" },
      ],
    });
    // Ошибка без строки (SyntaxError без lineno) и scope: undefined (так шлёт воркер).
    expect(parseReply(result({ error: { type: "SyntaxError", message: "x", line: null }, steps: [step({ scope: undefined })] }))).toMatchObject({
      error: { line: null },
      steps: [{ line: 1 }],
    });
  });

  it("лишние поля отбрасываются", () => {
    const r = parseReply(result({ evil: "<img>", steps: [step({ extra: 1, vars: [{ name: "a", value: "1", type: "int", html: "x" }] })] }));
    expect(r).not.toHaveProperty("evil");
    expect(r && r.type === "result" && r.steps?.[0]).toEqual({ line: 1, vars: [{ name: "a", value: "1", type: "int" }], out: 0 });
  });

  it.each([
    ["null", null],
    ["строка", "hello"],
    ["массив", [1, 2]],
    ["неизвестный type", { type: "boot", src: "x" }],
    ["status без статуса", { type: "status", status: "maybe" }],
    ["id не число", result({ id: "3" })],
    ["id 0", result({ id: 0 })],
    ["id дробный", result({ id: 1.5 })],
    ["stdout не строка", result({ stdout: 5 })],
    ["stdout слишком длинный", result({ stdout: "x".repeat(1_000_001) })],
    ["stderr нет", { id: 1, stdout: "" }],
    ["error без message", result({ error: { type: "X" } })],
    ["error.line строка", result({ error: { type: "X", message: "m", line: "2" } })],
    ["steps не массив", result({ steps: "x" })],
    ["шаг без vars", result({ steps: [{ line: 1, out: 0 }] })],
    ["шаг с out < 0", result({ steps: [step({ out: -1 })] })],
    ["переменная не строка", result({ steps: [step({ vars: [{ name: "x", value: 5, type: "int" }] })] })],
    ["scope не строка", result({ steps: [step({ scope: 7 })] })],
    ["слишком много шагов", result({ steps: Array.from({ length: 1002 }, () => step()) })],
  ])("отклоняет: %s", (_, data) => {
    expect(parseReply(data)).toBeNull();
  });
});

describe("python sandbox: iframe и CSP", () => {
  const html = sandboxSrcdoc();

  it("sandbox — только allow-scripts (без allow-same-origin)", () => {
    expect(SANDBOX_FLAGS).toBe("allow-scripts");
    expect(SANDBOX_FLAGS).not.toMatch(/same-origin|top-navigation|popups|forms|modals/);
  });

  it("CSP в meta стоит до скрипта; разметка без внешних ресурсов", () => {
    const meta = html.indexOf('http-equiv="Content-Security-Policy"');
    expect(meta).toBeGreaterThan(0);
    expect(meta).toBeLessThan(html.indexOf("<script>"));
    expect(html).toContain(`content="${SANDBOX_CSP}"`);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).not.toMatch(/src=|href=/);
  });

  it("CSP строгая: сети нет, eval нет, inline — только по хэшу", () => {
    const dirs = Object.fromEntries(SANDBOX_CSP.split(/;\s*/).map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));
    expect(dirs["default-src"]).toEqual(["'none'"]);
    expect(dirs["connect-src"]).toEqual(["'none'"]);
    expect(dirs["worker-src"]).toEqual(["blob:"]);
    expect(dirs["script-src"]).toEqual([`'sha256-${BOOTSTRAP_SHA256}'`, "blob:", "'wasm-unsafe-eval'"]);
    expect(SANDBOX_CSP).not.toMatch(/'unsafe-eval'|'unsafe-inline'|https?:|\*/);
  });

  it("хэш в CSP совпадает с текстом загрузчика", () => {
    const actual = createHash("sha256").update(BOOTSTRAP, "utf8").digest("base64");
    expect(BOOTSTRAP_SHA256, `обнови BOOTSTRAP_SHA256 в src/lib/python/sandbox.ts на ${actual}`).toBe(actual);
    expect(html).toContain(`<script>${BOOTSTRAP}</script>`);
  });

  it("загрузчик принимает сообщения только от родителя и не исполняет присланный текст сам", () => {
    expect(BOOTSTRAP).toContain("e.source!==parent");
    expect(BOOTSTRAP).not.toMatch(/eval|Function\(|innerHTML|document\.write|location/);
    expect(BOOTSTRAP).not.toContain("</script");
  });
});

describe("python sandbox: воркер", () => {
  const worker = readFileSync("public/py-worker.js", "utf8");

  it("файлы Pyodide — с абсолютного адреса jsDelivr нужной версии", () => {
    expect(PYODIDE_INDEX_URL).toBe(`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`);
    expect(PYODIDE_FILES).toContain("pyodide.asm.wasm");
    for (const f of ["pyodide.js", "pyodide.asm.js"]) expect(worker).toContain(`"${f}"`);
  });

  it("воркер не обращается к относительным адресам (у Blob-воркера базовый адрес blob:)", () => {
    expect(worker).not.toMatch(/(importScripts|fetch)\(\s*["'`](?!https:)/);
    expect(worker).not.toMatch(/["'`]\/(api|py-worker)/);
  });
});
