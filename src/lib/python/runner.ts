// Клиент исполнителя Python: одна песочница на вкладку, очередь запусков, таймауты.
// Песочница — скрытый <iframe sandbox="allow-scripts"> (origin «null», CSP без сети — см. sandbox.ts), внутри — Web Worker
// из текста public/py-worker.js. Файлы Pyodide качаем здесь (обычный HTTP-кэш страницы) и передаём в песочницу байтами.
// Бесконечный цикл: через 5 с iframe удаляется (вместе с воркером) и сразу создаётся новый.

import { parseReply, PYODIDE_FILES, PYODIDE_INDEX_URL, SANDBOX_FLAGS, sandboxSrcdoc, type WorkerReply } from "./sandbox";
import { PY_LIMITS, type LoadState, type PyError, type RunResult } from "./types";

export type { LoadState, PyError, PyStep, PyVar, RunResult } from "./types";

/** Песочница: iframe и подписка на его сообщения (уже проверенные parseReply). */
interface Sandbox {
  listen(fn: (r: WorkerReply) => void): () => void;
  post(msg: unknown, transfer?: Transferable[]): void;
  dispose(): void;
}

let sandbox: Sandbox | null = null;
let ready: Promise<void> | null = null;
let state: LoadState = "idle";
let nextId = 1;
let queue: Promise<unknown> = Promise.resolve();
let workerSource: Promise<string> | null = null;
const listeners = new Set<() => void>();

function setState(s: LoadState) {
  if (state === s) return;
  state = s;
  listeners.forEach((fn) => fn());
}

/** Текущее состояние загрузки Python (для useSyncExternalStore). */
export function getLoadState(): LoadState {
  return state;
}

export function subscribeLoadState(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function createSandbox(): Sandbox {
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", SANDBOX_FLAGS);
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.title = "Python";
  frame.style.display = "none";
  frame.srcdoc = sandboxSrcdoc();
  const subs = new Set<(r: WorkerReply) => void>();
  const onMessage = (ev: MessageEvent) => {
    // Origin у песочницы «null» — сверяем окно-источник; форму сообщения проверяет parseReply.
    if (!ev.source || ev.source !== frame.contentWindow) return;
    const reply = parseReply(ev.data);
    if (reply) subs.forEach((fn) => fn(reply));
  };
  window.addEventListener("message", onMessage);
  document.body.appendChild(frame);
  return {
    listen(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    post(msg, transfer = []) {
      frame.contentWindow?.postMessage(msg, "*", transfer);
    },
    dispose() {
      window.removeEventListener("message", onMessage);
      subs.clear();
      frame.remove(); // вместе с документом iframe завершается и воркер
    },
  };
}

function fetchOk(url: string): Promise<Response> {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url.split("/").pop()}: HTTP ${r.status}`);
    return r;
  });
}

/** Текст воркера (с нашего адреса, держим в памяти) и файлы Pyodide (с CDN; повторно — из HTTP-кэша браузера). */
async function loadFiles(): Promise<{ src: string; files: Record<string, ArrayBuffer> }> {
  if (!workerSource) {
    const p = fetchOk("/py-worker.js").then((r) => r.text());
    workerSource = p;
    p.catch(() => {
      if (workerSource === p) workerSource = null;
    });
  }
  const [src, bufs] = await Promise.all([workerSource, Promise.all(PYODIDE_FILES.map((f) => fetchOk(PYODIDE_INDEX_URL + f).then((r) => r.arrayBuffer())))]);
  const files: Record<string, ArrayBuffer> = {};
  PYODIDE_FILES.forEach((f, i) => (files[f] = bufs[i]));
  return { src, files };
}

function kill() {
  sandbox?.dispose();
  sandbox = null;
  ready = null;
}

/**
 * Загружает Pyodide (один раз на песочницу). Промис отклоняется только при настоящей ошибке (нет сети, CDN недоступен);
 * долгую загрузку ограничивает runOnce — сама загрузка при этом продолжается и пригодится следующей попытке.
 */
export function preloadPython(): Promise<void> {
  if (ready) return ready;
  if (typeof Worker === "undefined" || typeof document === "undefined") {
    setState("error");
    return Promise.reject(new Error("no Worker"));
  }
  const box = createSandbox();
  sandbox = box;
  setState("loading");
  const files = loadFiles();
  const p = new Promise<void>((resolve, reject) => {
    let booted = false;
    const off = box.listen((r) => {
      if (r.type === "hello") {
        // Загрузчик iframe готов: отдаём ему воркер и файлы Pyodide (ArrayBuffer — передачей, без копии).
        if (booted) return;
        booted = true;
        files.then(
          ({ src, files: f }) => {
            box.post({ type: "boot", src });
            box.post({ type: "init", indexURL: PYODIDE_INDEX_URL, files: f }, Object.values(f));
          },
          () => {},
        );
      } else if (r.type === "status") {
        if (r.status === "ready") {
          off();
          if (sandbox === box) setState("ready");
          resolve();
        } else fail(new Error(r.message));
      }
    });
    function fail(e: unknown) {
      off();
      if (sandbox === box) {
        kill();
        setState("error");
      }
      reject(e instanceof Error ? e : new Error(String(e)));
    }
    files.catch(fail);
  });
  ready = p;
  // Чтобы не было «unhandled rejection», если preload вызван без await.
  p.catch(() => {});
  return p;
}

/** Ждёт промис не дольше ms; по таймауту — ошибка (сам промис продолжает выполняться). */
function within<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

const emptyResult = (error: PyError, timedOut = false): RunResult => ({ stdout: "", stderr: "", error, steps: null, timedOut });

async function runOnce(code: string, stdin: string, trace: boolean): Promise<RunResult> {
  try {
    const started = Date.now();
    await within(preloadPython(), PY_LIMITS.loadMs, "load timeout").catch((e: unknown) => {
      // Сбой сети бывает разовым: одна автоматическая повторная попытка в пределах тех же 30 с.
      const left = PY_LIMITS.loadMs - (Date.now() - started);
      if (left < 1000 || (e instanceof Error && e.message === "load timeout")) throw e;
      return within(preloadPython(), left, "load timeout");
    });
  } catch (e) {
    return emptyResult({ type: "LoadError", message: e instanceof Error ? e.message : String(e), line: null });
  }
  const box = sandbox;
  if (!box) return emptyResult({ type: "LoadError", message: "no worker", line: null });
  const id = nextId++;
  return new Promise<RunResult>((resolve) => {
    const off = box.listen((r) => {
      if (r.type !== "result" || r.id !== id) return;
      done();
      resolve({
        stdout: r.stdout,
        stderr: r.stderr,
        error: r.error,
        steps: r.steps ? r.steps.map(({ out, ...s }) => ({ ...s, stdout: r.stdout.slice(0, out) })) : trace ? [] : null,
        timedOut: false,
      });
    });
    const timer = setTimeout(() => {
      done();
      // Бесконечный цикл (или слишком долгая программа): удаляем песочницу вместе с воркером и сразу готовим новую.
      kill();
      setState("idle");
      void preloadPython().catch(() => {});
      resolve(emptyResult({ type: "Timeout", message: `> ${PY_LIMITS.runMs / 1000} s`, line: null }, true));
    }, PY_LIMITS.runMs);
    function done() {
      clearTimeout(timer);
      off();
    }
    box.post({ id, code, stdin, trace });
  });
}

/** Выполняет код Python. Запуски идут по очереди; ошибки возвращаются в `error`, промис не отклоняется. */
export function runPython(code: string, opts: { stdin?: string; trace?: boolean } = {}): Promise<RunResult> {
  const job = queue.then(() => runOnce(code, opts.stdin ?? "", Boolean(opts.trace)));
  queue = job.catch(() => {});
  return job;
}
