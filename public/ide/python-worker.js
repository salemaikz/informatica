// Web Worker «Практикума»: Python (Pyodide, WebAssembly) в браузере ученика.
// Протокол (сообщения основного потока -> воркеру):
//   { type: "init" }                                  — прогреть Pyodide (необязательно)
//   { type: "run", id, code, stdin, trace? }          — выполнить программу
// Воркер -> основной поток:
//   { type: "loading", id? }       — началась загрузка Pyodide (≈ 10 МБ один раз, дальше из кэша браузера)
//   { type: "ready" }              — ответ на init
//   { type: "start", id }          — запуск программы (с этого момента идёт таймаут)
//   { type: "stdout", id, text }   — кусок вывода print()
//   { type: "trace", id, trace }   — пошаговая трассировка { steps, truncated, out, error }
//   { type: "done", id, ms }       — программа завершилась
//   { type: "error", id, line, text }                 — ошибка программы (последняя строка трассировки и номер строки)
//   { type: "error", id, kind: "load", text }         — не удалось загрузить Pyodide (нет сети)
// Таймаут и перезапуск воркера делает основной поток (worker.terminate()).
//
// ВАЖНО: Pyodide 314+ больше не поддерживает «классические» воркеры (importScripts) — только модульные.
// Поэтому воркер создаётся как `new Worker(url, { type: "module" })`, а Pyodide подключается через import().

// Версия проверена: `npm view pyodide version` (latest = 314.0.7) и HEAD-запрос на CDN.
const PYODIDE_VERSION = "314.0.7";
const BASE = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";

// Python-часть: запуск программы ученика, перехват ввода-вывода, трассировка (sys.settrace).
// Внутри нет обратных кавычек и «${» — исходник вынимают тесты (tests/ide-python.test.ts) и гоняют системным python3.
const RUNNER = String.raw`
import sys, io, json, builtins

_IDE_FILE = "<program>"
_IDE_STEP_LIMIT = 300
_IDE_OUT_LIMIT = 100000
_IDE_TRACE_OUT_LIMIT = 20000


class _IdeStop(BaseException):
    """Остановка трассировки по лимиту шагов (не ошибка ученика)."""


class _IdeOut:
    """Вывод программы: копит текст и отправляет кусками (по строкам или по 2000 символов)."""

    def __init__(self, emit, limit, keep):
        self.emit = emit
        self.limit = limit
        self.keep = keep
        self.parts = []
        self.pending = ""
        self.n = 0
        self.cut = False
        self.encoding = "utf-8"

    def write(self, s):
        if not isinstance(s, str):
            s = str(s)
        size = len(s)
        room = self.limit - self.n
        if size > room:
            s = s[:max(room, 0)]
            self.cut = True
        if s:
            self.n += len(s)
            if self.keep:
                self.parts.append(s)
            self.pending += s
            if "\n" in s or len(self.pending) >= 2000:
                self.flush()
        return size

    def flush(self):
        if self.pending and self.emit is not None:
            text = self.pending
            self.pending = ""
            self.emit(text)
        else:
            self.pending = ""

    def isatty(self):
        return False

    def writable(self):
        return True

    def text(self):
        return "".join(self.parts)


def _ide_fmt(v, depth=0):
    """Значение простой переменной в виде строки; None — переменную в таблице не показываем."""
    t = type(v)
    if v is None or t is bool or t is float:
        return repr(v)
    if t is int:
        r = repr(v)
        return r if len(r) <= 40 else r[:40] + "…"
    if t is str:
        return repr(v if len(v) <= 40 else v[:40] + "…")
    if t in (list, tuple, set, frozenset) and depth < 2:
        items = list(v)[:10]
        parts = []
        for x in items:
            s = _ide_fmt(x, depth + 1)
            if s is None:
                return None
            parts.append(s)
        if len(v) > 10:
            parts.append("…")
        body = ", ".join(parts)
        if t is list:
            return "[" + body + "]"
        if t is tuple:
            return "(" + body + (",)" if len(v) == 1 else ")")
        return "{" + body + "}" if parts else "set()"
    if t is dict and depth < 2:
        parts = []
        for i, (k, x) in enumerate(v.items()):
            if i >= 10:
                parts.append("…")
                break
            ks = _ide_fmt(k, depth + 1)
            xs = _ide_fmt(x, depth + 1)
            if ks is None or xs is None:
                return None
            parts.append(ks + ": " + xs)
        return "{" + ", ".join(parts) + "}"
    return None


def _ide_err(e):
    line = None
    tb = e.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == _IDE_FILE:
            line = tb.tb_lineno
        tb = tb.tb_next
    msg = str(e)
    name = type(e).__name__
    return {"line": line, "text": name + (": " + msg if msg else "")}


def _ide_snapshot(mapping):
    names = []
    for k, v in list(mapping.items()):
        if k.startswith("_"):
            continue
        s = _ide_fmt(v)
        if s is not None:
            names.append([k, s])
    return names


def _ide_make_tracer(steps, out, state):
    def record(frame, end):
        if len(steps) >= _IDE_STEP_LIMIT and not end:
            state["truncated"] = True
            raise _IdeStop()
        fn = frame.f_code.co_name
        steps.append({
            "line": None if end else frame.f_lineno,
            "fn": None if fn == "<module>" else fn,
            "vars": _ide_snapshot(frame.f_locals),
            "out": out.n,
        })

    def local(frame, event, arg):
        if event == "line":
            record(frame, False)
        elif event == "return" and frame.f_code.co_name == "<module>":
            record(frame, True)
        return local

    def glob(frame, event, arg):
        code = frame.f_code
        if code.co_filename != _IDE_FILE:
            return None
        if code.co_name.startswith("<") and code.co_name != "<module>":
            return None
        return local

    return glob


def _ide_run(code, stdin_text, trace, emit):
    keep = bool(trace)
    out = _IdeOut(emit, _IDE_TRACE_OUT_LIMIT if keep else _IDE_OUT_LIMIT, keep)
    saved = (sys.stdin, sys.stdout, sys.stderr)
    sys.stdin = io.StringIO(stdin_text or "")
    sys.stdout = out
    sys.stderr = out
    steps = []
    state = {"truncated": False}
    error = None
    g = {"__name__": "__main__", "__builtins__": builtins}
    try:
        try:
            co = compile(code, _IDE_FILE, "exec")
        except SyntaxError as e:
            msg = e.msg or ""
            error = {"line": e.lineno, "text": type(e).__name__ + (": " + msg if msg else "")}
            co = None
        if co is not None:
            if keep:
                sys.settrace(_ide_make_tracer(steps, out, state))
            try:
                exec(co, g)
            except _IdeStop:
                pass
            except SystemExit:
                pass
            except BaseException as e:
                error = _ide_err(e)
            finally:
                sys.settrace(None)
            # Итоговый шаг (состояние после последней строки) — и когда программа упала с ошибкой.
            if keep and steps and steps[-1]["line"] is not None and not state["truncated"]:
                steps.append({"line": None, "fn": None, "vars": _ide_snapshot(g), "out": out.n})
    finally:
        sys.stdin, sys.stdout, sys.stderr = saved
        out.flush()
    res = {"error": error, "cut": out.cut}
    if keep:
        res["trace"] = {"steps": steps, "truncated": state["truncated"], "out": out.text(), "error": error}
    return json.dumps(res)
`;

let pyodide = null;
let runner = null;
let loadPromise = null;

function load() {
  if (!loadPromise) {
    loadPromise = (async () => {
      const mod = await import(/* webpackIgnore: true */ BASE + "pyodide.mjs");
      pyodide = await mod.loadPyodide({ indexURL: BASE });
      pyodide.runPython(RUNNER);
      runner = pyodide.globals.get("_ide_run");
    })().catch((e) => {
      loadPromise = null;
      throw e;
    });
  }
  return loadPromise;
}

const errText = (e) => String((e && e.message) || e);

self.onmessage = async (ev) => {
  const m = ev.data || {};
  if (m.type === "init") {
    try {
      if (!pyodide) self.postMessage({ type: "loading" });
      await load();
      self.postMessage({ type: "ready" });
    } catch (e) {
      self.postMessage({ type: "error", kind: "load", text: errText(e) });
    }
    return;
  }
  if (m.type !== "run") return;
  const id = m.id;
  try {
    if (!pyodide) self.postMessage({ type: "loading", id });
    await load();
  } catch (e) {
    self.postMessage({ type: "error", id, kind: "load", text: errText(e) });
    return;
  }
  self.postMessage({ type: "start", id });
  const t0 = Date.now();
  try {
    const raw = runner(String(m.code || ""), String(m.stdin || ""), !!m.trace, (text) => self.postMessage({ type: "stdout", id, text }));
    const res = JSON.parse(raw);
    if (res.trace) self.postMessage({ type: "trace", id, trace: res.trace });
    if (res.error) self.postMessage({ type: "error", id, line: res.error.line, text: res.error.text, ms: Date.now() - t0 });
    else self.postMessage({ type: "done", id, ms: Date.now() - t0, cut: !!res.cut });
  } catch (e) {
    self.postMessage({ type: "error", id, line: null, text: errText(e), ms: Date.now() - t0 });
  }
};
