/* Исполнитель Python в браузере: классический Web Worker + Pyodide.
 *
 * Запускается НЕ по адресу /py-worker.js, а из Blob внутри <iframe sandbox="allow-scripts"> (src/lib/python/sandbox.ts):
 * origin «null», сети нет (CSP connect-src 'none'). Поэтому здесь только абсолютные адреса, а файлы Pyodide
 * приходят байтами от страницы (runner.ts качает их с jsDelivr через обычный HTTP-кэш).
 *
 * Сообщения:
 *   { type: "init", indexURL, files: { имя: ArrayBuffer } } → { type: "status", status: "ready" } | { type: "status", status: "error", message }
 *   { id, code, stdin, trace }             → { id, stdout, stderr, error?, steps? }  (у шага — out: длина вывода на этот момент)
 *
 * Бесконечный цикл здесь не ловим: главный поток (src/lib/python/runner.ts) удаляет iframe вместе с воркером по таймеру.
 */
"use strict";

// Обвязка на Python: запуск кода ученика в файле <main>, input() из stdin, трассировка sys.settrace.
const HARNESS = String.raw`
import sys, json, builtins, traceback, linecache

_MAX_STEPS = 1000
_MAX_OUT = 200000
_SIMPLE = (int, float, complex, bool, str, bytes, type(None), list, tuple, dict, set, frozenset, range)

class TooManySteps(BaseException):
    pass

class _Out:
    def __init__(self):
        self.parts = []
        self.size = 0
        self.u16 = 0
    def write(self, s):
        s = str(s)
        if self.size < _MAX_OUT:
            part = s[: _MAX_OUT - self.size]
            self.parts.append(part)
            # Длина в единицах UTF-16 — чтобы JS мог отрезать вывод «на момент шага» через slice.
            self.u16 += len(part.encode("utf-16-le")) // 2
        self.size += len(s)
        return len(s)
    def flush(self):
        pass
    def getvalue(self):
        v = "".join(self.parts)
        if self.size > _MAX_OUT:
            v += "\n..."
        return v

def _repr(v):
    try:
        r = repr(v)
    except BaseException:
        r = "<?>"
    if len(r) > 120:
        r = r[:117] + "..."
    return r

def _vars(ns):
    out = []
    for k, v in ns.items():
        if k.startswith("__") or not isinstance(v, _SIMPLE):
            continue
        out.append([k, _repr(v), type(v).__name__])
    return out

def _main_line(tb):
    line = None
    for fr in traceback.extract_tb(tb):
        if fr.filename == "<main>":
            line = fr.lineno
    return line

def _format_tb(e):
    # Только кадры кода ученика: служебные строки обвязки не показываем.
    lines = []
    frames = [fr for fr in traceback.extract_tb(e.__traceback__) if fr.filename == "<main>"]
    if frames:
        lines.append("Traceback (most recent call last):\n")
        lines.extend(traceback.format_list(frames))
    lines.extend(traceback.format_exception_only(type(e), e))
    return "".join(lines)

def run(code, stdin_text, trace):
    out = _Out()
    err = _Out()
    steps = [] if trace else None
    error = None
    lines_in = stdin_text.replace("\r\n", "\n").replace("\r", "\n").split("\n") if stdin_text else []
    if lines_in and lines_in[-1] == "":
        lines_in.pop()
    pos = [0]

    def _input(prompt=""):
        out.write(str(prompt))
        if pos[0] >= len(lines_in):
            raise EOFError("input(): not enough input lines")
        s = lines_in[pos[0]]
        pos[0] += 1
        return s

    linecache.cache["<main>"] = (len(code), None, [l + "\n" for l in code.split("\n")], "<main>")
    ns = {"__name__": "__main__", "__builtins__": builtins}

    def _local(frame, event, arg):
        if event == "line":
            if len(steps) >= _MAX_STEPS:
                raise TooManySteps("too many steps")
            scope = None if frame.f_code.co_name == "<module>" else frame.f_code.co_name
            steps.append({"line": frame.f_lineno, "vars": _vars(frame.f_locals), "out": out.u16, "scope": scope})
        return _local

    def _global(frame, event, arg):
        if frame.f_code.co_filename == "<main>":
            return _local
        return None

    old = (sys.stdout, sys.stderr, builtins.input)
    sys.stdout, sys.stderr, builtins.input = out, err, _input
    try:
        compiled = compile(code, "<main>", "exec")
        if trace:
            sys.settrace(_global)
        try:
            exec(compiled, ns)
        finally:
            sys.settrace(None)
    except SyntaxError as e:
        error = {"type": type(e).__name__, "message": e.msg or str(e), "line": e.lineno}
        err.write("".join(traceback.format_exception_only(type(e), e)))
    except TooManySteps:
        error = {"type": "TooManySteps", "message": "more than %d steps" % _MAX_STEPS, "line": steps[-1]["line"] if steps else None}
    except BaseException as e:
        if isinstance(e, SystemExit) and (e.code is None or e.code == 0):
            pass
        else:
            error = {"type": type(e).__name__, "message": str(e), "line": _main_line(e.__traceback__)}
            err.write(_format_tb(e))
    finally:
        sys.stdout, sys.stderr, builtins.input = old
    if steps is not None:
        # Последний шаг — состояние после выполнения (line = 0: программа завершена или остановлена).
        steps.append({"line": 0, "vars": _vars(ns), "out": out.u16, "scope": None})
    return json.dumps({"stdout": out.getvalue(), "stderr": err.getvalue(), "error": error, "steps": steps}, ensure_ascii=False)
`;

let pyPromise = null;

const WASM_TYPE = { "pyodide.asm.wasm": "application/wasm", "pyodide-lock.json": "application/json" };

/** Pyodide из переданных байтов: скрипты — через blob:, остальное Pyodide берёт fetch-ем, который на время загрузки отвечает из files. */
async function boot(indexURL, files) {
  const urls = ["pyodide.js", "pyodide.asm.js"].map((name) => URL.createObjectURL(new Blob([files[name]], { type: "text/javascript" })));
  try {
    importScripts(...urls);
  } finally {
    urls.forEach((u) => URL.revokeObjectURL(u));
  }
  const nativeFetch = self.fetch;
  self.fetch = (input, init) => {
    const url = String(input && typeof input === "object" && "url" in input ? input.url : input);
    const name = url.startsWith(indexURL) ? url.slice(indexURL.length) : "";
    if (Object.prototype.hasOwnProperty.call(files, name)) {
      return Promise.resolve(new Response(files[name], { headers: { "Content-Type": WASM_TYPE[name] || "application/octet-stream" } }));
    }
    return nativeFetch.call(self, input, init);
  };
  try {
    const py = await self.loadPyodide({ indexURL });
    py.runPython(HARNESS);
    return py;
  } finally {
    self.fetch = nativeFetch;
  }
}

function load(msg) {
  if (!pyPromise) {
    const files = msg && msg.files;
    const indexURL = msg && msg.indexURL;
    if (typeof indexURL !== "string" || !/^https:\/\//.test(indexURL) || !files || typeof files !== "object") {
      return Promise.reject(new Error("no Pyodide files"));
    }
    pyPromise = boot(indexURL, files);
    pyPromise.catch(() => {
      pyPromise = null;
    });
  }
  return pyPromise;
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  if (msg.type === "init") {
    try {
      await load(msg);
      self.postMessage({ type: "status", status: "ready" });
    } catch (e) {
      self.postMessage({ type: "status", status: "error", message: String((e && e.message) || e) });
    }
    return;
  }
  const id = msg.id;
  if (typeof id !== "number") return;
  try {
    const py = await load(null);
    const run = py.globals.get("run");
    const json = run(String(msg.code || ""), String(msg.stdin || ""), Boolean(msg.trace));
    run.destroy();
    const res = JSON.parse(json);
    const out = { id, stdout: res.stdout, stderr: res.stderr };
    if (res.error) out.error = res.error;
    if (res.steps) {
      // Вывод на момент шага — только длина (out): весь вывод отправляем один раз, срезы делает runner.ts.
      // Иначе до 1000 копий вывода (до 200 000 символов каждая) уходили бы через postMessage.
      out.steps = res.steps.map((s) => ({
        line: s.line,
        vars: s.vars.map((v) => ({ name: v[0], value: v[1], type: v[2] })),
        out: s.out,
        scope: s.scope || undefined,
      }));
    }
    self.postMessage(out);
  } catch (e) {
    self.postMessage({ id, stdout: "", stderr: String((e && e.message) || e), error: { type: "InternalError", message: String((e && e.message) || e), line: null } });
  }
};
