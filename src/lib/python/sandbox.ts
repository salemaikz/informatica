// Песочница для кода ученика (чистая логика, без React): разметка iframe, CSP и проверка сообщений.
//
// Код может прийти по чужой ссылке (/python?code=…), поэтому воркер живёт в <iframe sandbox="allow-scripts"> —
// у него непрозрачный origin «null»: нет доступа к нашему IndexedDB/localStorage/cookie и к /api/*.
// CSP iframe наследует и воркер из Blob: сеть закрыта полностью (connect-src 'none').
// Файлы Pyodide качает страница (runner.ts) и передаёт байтами: у iframe с origin «null» в Chrome нет
// HTTP-кэша, и иначе 5+ МБ скачивались бы заново при каждом открытии страницы.

import type { PyError, PyStep } from "./types";
import { PY_LIMITS } from "./types";

/** Флаги sandbox: только скрипты. Без allow-same-origin — иначе iframe получит наш origin. */
export const SANDBOX_FLAGS = "allow-scripts";

export const PYODIDE_VERSION = "0.29.5";
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
/** Всё, что Pyodide загружает при старте (проверено по сетевому журналу). */
export const PYODIDE_FILES = ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"] as const;
export type PyodideFile = (typeof PYODIDE_FILES)[number];

/**
 * Загрузчик внутри iframe: принимает сообщения только от родителя.
 * Первое — { type: "boot", src } (текст py-worker.js) → воркер из Blob; дальше всё пересылается воркеру
 * (ArrayBuffer из files — передачей, без копии). Ответы воркера уходят родителю как есть.
 * Меняешь текст → обнови BOOTSTRAP_SHA256 (tests/python-sandbox.test.ts покажет нужное значение).
 */
export const BOOTSTRAP =
  '(function(){var w=null;function up(m){parent.postMessage(m,"*")}' +
  'function fail(e){up({type:"status",status:"error",message:String((e&&e.message)||e||"worker error")})}' +
  'addEventListener("message",function(e){if(e.source!==parent)return;var d=e.data;' +
  'if(w){var t=[],f=d&&d.files;if(f&&typeof f==="object")for(var k in f)if(f[k]instanceof ArrayBuffer)t.push(f[k]);w.postMessage(d,t);return}' +
  'if(!d||d.type!=="boot"||typeof d.src!=="string")return;' +
  'try{w=new Worker(URL.createObjectURL(new Blob([d.src],{type:"text/javascript"})));' +
  'w.onmessage=function(ev){up(ev.data)};w.onerror=function(ev){ev.preventDefault();fail(ev.message)}}catch(err){fail(err)}});' +
  'up({type:"hello"})})();';

/** SHA-256 (base64) текста BOOTSTRAP — для script-src вместо 'unsafe-inline'. */
export const BOOTSTRAP_SHA256 = "XA+zfuPGl/e12Rb55NQDDr7ug/SRvE2oyqKAHehBrlU=";

/**
 * CSP iframe (её же наследует воркер из Blob):
 * - скрипты: только наш загрузчик (по хэшу) и blob: (py-worker.js и файлы Pyodide из переданных байтов);
 * - 'wasm-unsafe-eval' — компиляция WebAssembly; 'unsafe-eval' Pyodide не нужен (pyodide.code.run_js блокируется);
 * - сеть закрыта: fetch/XHR/WebSocket к любому адресу (и к нашему /api/ai/*) отклоняются.
 */
export const SANDBOX_CSP = [
  "default-src 'none'",
  `script-src 'sha256-${BOOTSTRAP_SHA256}' blob: 'wasm-unsafe-eval'`,
  "worker-src blob:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

/** Разметка srcdoc: CSP — до единственного скрипта. Пользовательских данных здесь нет. */
export function sandboxSrcdoc(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}"></head><body><script>${BOOTSTRAP}</script></body></html>`;
}

/** Шаг от воркера: вместо текста вывода — его длина (срез делает runner.ts, без копирования через postMessage). */
export type WorkerStep = Omit<PyStep, "stdout"> & { out: number };

export interface WorkerResult {
  id: number;
  stdout: string;
  stderr: string;
  error: PyError | null;
  steps: WorkerStep[] | null;
}

export type WorkerReply =
  | { type: "hello" }
  | { type: "status"; status: "ready" }
  | { type: "status"; status: "error"; message: string }
  | ({ type: "result" } & WorkerResult);

/** Предел строки в ответе (вывод воркер режет до 200 000 символов Python; здесь — с запасом на UTF-16). */
const MAX_TEXT = 1_000_000;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_TEXT;
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

function parseError(v: unknown): PyError | null | undefined {
  if (v === undefined || v === null) return null;
  if (!isObj(v) || !isText(v.type) || !isText(v.message)) return undefined;
  if (v.line !== null && v.line !== undefined && !isCount(v.line)) return undefined;
  return { type: v.type, message: v.message, line: (v.line as number | null | undefined) ?? null };
}

function parseStep(v: unknown): WorkerStep | null {
  if (!isObj(v) || !isCount(v.line) || !isCount(v.out) || !Array.isArray(v.vars)) return null;
  if (v.scope !== undefined && !isText(v.scope)) return null;
  const vars: WorkerStep["vars"] = [];
  for (const x of v.vars) {
    if (!isObj(x) || !isText(x.name) || !isText(x.value) || !isText(x.type)) return null;
    vars.push({ name: x.name, value: x.value, type: x.type });
  }
  return v.scope === undefined ? { line: v.line, vars, out: v.out } : { line: v.line, vars, out: v.out, scope: v.scope as string };
}

/**
 * Проверяет сообщение из песочницы. Внутри неё работает чужой код (через модуль js он может слать что угодно),
 * поэтому берём только известные формы с правильными типами; всё остальное — null (игнорируется).
 */
export function parseReply(data: unknown): WorkerReply | null {
  if (!isObj(data)) return null;
  if (data.type === "hello") return { type: "hello" };
  if (data.type === "status") {
    if (data.status === "ready") return { type: "status", status: "ready" };
    if (data.status === "error") return { type: "status", status: "error", message: isText(data.message) ? data.message.slice(0, 500) : "load error" };
    return null;
  }
  if (data.type !== undefined) return null;
  if (!isCount(data.id) || data.id === 0 || !isText(data.stdout) || !isText(data.stderr)) return null;
  const error = parseError(data.error);
  if (error === undefined) return null;
  let steps: WorkerStep[] | null = null;
  if (data.steps !== undefined && data.steps !== null) {
    if (!Array.isArray(data.steps) || data.steps.length > PY_LIMITS.maxSteps + 1) return null;
    steps = [];
    for (const s of data.steps) {
      const step = parseStep(s);
      if (!step) return null;
      steps.push(step);
    }
  }
  return { type: "result", id: data.id, stdout: data.stdout, stderr: data.stderr, error, steps };
}
