// Web Worker «Практикума»: JavaScript ученика с перехватом console.log и ошибок.
// На каждый запуск основной поток создаёт НОВЫЙ воркер (чистое состояние) и убивает его по таймауту (worker.terminate()).
// Протокол (основной поток -> воркеру):
//   { type: "run", id, code }
// Воркер -> основной поток:
//   { type: "ready" }                       — скрипт воркера загружен (до этого ошибка = не удалось загрузить)
//   { type: "log", id, level, text }        — строка вывода (console.log/info/debug/warn/error/…, alert)
//   { type: "error", id, text, line }       — ошибка программы («ReferenceError: x is not defined»), line — если известна
//   { type: "done", id, ms, cut }           — программа завершилась (в том числе отложенные setTimeout/Promise)
// Сеть, хранилища и вложенные воркеры в воркере отключены: код ученика работает только с языком.
// Файл вынимают тесты (tests/ide-js.test.ts) и гоняют в node:vm — внутри нет зависимостей от браузера, кроме self/postMessage.

(function () {
  "use strict";

  var G = self;
  var LINE_LIMIT = 2000; // строк вывода
  var CHAR_LIMIT = 100000; // символов вывода

  // Сохраняем нужное до отключения опасного.
  var post = G.postMessage.bind(G);
  var origSetTimeout = G.setTimeout;
  var origClearTimeout = G.clearTimeout;
  var origSetInterval = G.setInterval;
  var origClearInterval = G.clearInterval;
  var now = typeof G.performance !== "undefined" && G.performance.now ? function () { return G.performance.now(); } : function () { return Date.now(); };
  var indirectEval = G.eval;

  // ----- Отключаем сеть, хранилища и пр. -----
  ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "Worker", "SharedWorker", "BroadcastChannel"].forEach(function (name) {
    try {
      Object.defineProperty(G, name, { value: undefined, configurable: true, writable: true });
    } catch (e) {
      /* нет такого свойства — ничего страшного */
    }
  });

  // ----- Форматирование значений (как в Node/браузере, но в одну строку) -----
  function quote(s) {
    var q = s.indexOf("'") === -1 ? "'" : s.indexOf('"') === -1 ? '"' : "`";
    return q + s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n") + q;
  }

  function inspect(v, depth, seen) {
    var t = typeof v;
    if (v === null) return "null";
    if (t === "undefined") return "undefined";
    if (t === "string") return quote(v);
    if (t === "number") return Object.is(v, -0) ? "-0" : String(v);
    if (t === "bigint") return String(v) + "n";
    if (t === "boolean") return String(v);
    if (t === "symbol") return v.toString();
    if (t === "function") return "[Function: " + (v.name || "(anonymous)") + "]";
    if (seen.indexOf(v) !== -1) return "[Circular]";
    if (v instanceof Error) return v.name + ": " + v.message;
    if (Array.isArray(v)) {
      if (depth > 2) return "[Array]";
      if (v.length === 0) return "[]";
      seen.push(v);
      var items = [];
      var shown = Math.min(v.length, 100);
      for (var i = 0; i < shown; i++) items.push(i in v ? inspect(v[i], depth + 1, seen) : "<empty>");
      if (v.length > shown) items.push("... " + (v.length - shown) + " more items");
      seen.pop();
      return "[ " + items.join(", ") + " ]";
    }
    if (v instanceof Date) return isNaN(v.getTime()) ? "Invalid Date" : v.toISOString();
    if (v instanceof RegExp) return String(v);
    if (v instanceof Map || v instanceof Set) {
      if (depth > 2) return "[" + v.constructor.name + "]";
      seen.push(v);
      var parts = [];
      v.forEach(function (val, key) {
        parts.push(v instanceof Map ? inspect(key, depth + 1, seen) + " => " + inspect(val, depth + 1, seen) : inspect(val, depth + 1, seen));
      });
      seen.pop();
      return v.constructor.name + "(" + v.size + ") { " + parts.join(", ") + (parts.length ? " " : "") + "}";
    }
    if (depth > 2) return "[Object]";
    var keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    seen.push(v);
    var props = keys.map(function (k) {
      var key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : quote(k);
      var val;
      try {
        val = inspect(v[k], depth + 1, seen);
      } catch (e) {
        val = "[Getter]";
      }
      return key + ": " + val;
    });
    seen.pop();
    return "{ " + props.join(", ") + " }";
  }

  /** Аргумент в строку: строки как есть, остальное — через inspect. */
  function plain(v) {
    return typeof v === "string" ? v : inspect(v, 0, []);
  }

  /** console.log("%s = %d", …): поддержка %s %d %i %f %j %o %O %%. */
  function formatArgs(args) {
    var first = args[0];
    var rest = 1;
    var out;
    if (typeof first === "string" && first.indexOf("%") !== -1 && args.length > 1) {
      out = first.replace(/%[sdifjoO%]/g, function (m) {
        if (m === "%%") return "%";
        if (rest >= args.length) return m;
        var a = args[rest++];
        switch (m) {
          case "%s": return typeof a === "string" ? a : inspect(a, 1, []);
          case "%d": return typeof a === "bigint" ? a + "n" : String(Number(a));
          case "%i": return String(parseInt(a, 10));
          case "%f": return String(parseFloat(a));
          case "%j":
            try { return JSON.stringify(a); } catch (e) { return "[Circular]"; }
          default: return inspect(a, 0, []);
        }
      });
    } else {
      out = args.length ? plain(first) : "";
    }
    var extra = [];
    for (; rest < args.length; rest++) extra.push(plain(args[rest]));
    return extra.length ? (out ? out + " " : "") + extra.join(" ") : out;
  }

  // ----- Вывод -----
  var runId = 0;
  var lines = 0;
  var chars = 0;
  var cut = false;
  var indent = "";
  var pending = 0; // отложенные таймеры (setTimeout/setInterval), которые ещё не сработали или не сняты

  function emit(level, text) {
    if (lines >= LINE_LIMIT || chars >= CHAR_LIMIT) {
      cut = true;
      return;
    }
    var out = indent && text ? text.split("\n").map(function (l) { return indent + l; }).join("\n") : text;
    lines++;
    chars += out.length;
    post({ type: "log", id: runId, level: level, text: out });
  }

  function logger(level) {
    return function () {
      emit(level, formatArgs(Array.prototype.slice.call(arguments)));
    };
  }

  var counts = {};
  var consoleObj = {
    log: logger("log"),
    info: logger("log"),
    debug: logger("log"),
    dir: logger("log"),
    warn: logger("warn"),
    error: logger("error"),
    trace: function () {},
    clear: function () {},
    time: function () {},
    timeEnd: function () {},
    timeLog: function () {},
    group: function () {
      if (arguments.length) emit("log", formatArgs(Array.prototype.slice.call(arguments)));
      indent += "  ";
    },
    groupEnd: function () {
      indent = indent.slice(2);
    },
    table: function (data) {
      emit("log", formatArgs([data]));
    },
    assert: function (cond) {
      if (!cond) {
        var rest = Array.prototype.slice.call(arguments, 1);
        emit("error", "Assertion failed" + (rest.length ? ": " + formatArgs(rest) : ""));
      }
    },
    count: function (label) {
      var k = label === undefined ? "default" : String(label);
      counts[k] = (counts[k] || 0) + 1;
      emit("log", k + ": " + counts[k]);
    },
  };
  consoleObj.groupCollapsed = consoleObj.group;
  G.console = consoleObj;

  // alert() выводит в то же окно; prompt/confirm в воркере нет — возвращаем «отказ».
  G.alert = function (msg) {
    emit("log", msg === undefined ? "" : plain(msg));
  };
  G.confirm = function () {
    return false;
  };
  G.prompt = function () {
    return null;
  };

  // ----- Таймеры: считаем, чтобы дождаться отложенного вывода -----
  var timers = new Map(); // handle -> «снять со счёта» (ключ — сам handle: число в браузере, объект в Node)
  G.setTimeout = function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    pending++;
    var fired = false;
    var h = origSetTimeout(function () {
      timers.delete(h);
      if (!fired) {
        fired = true;
        pending--;
      }
      if (typeof fn === "function") fn.apply(G, args);
    }, ms);
    timers.set(h, function () {
      if (!fired) {
        fired = true;
        pending--;
      }
    });
    return h;
  };
  G.clearTimeout = function (h) {
    var release = timers.get(h);
    if (release) release();
    timers.delete(h);
    origClearTimeout(h);
  };
  G.setInterval = function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    pending++;
    var cleared = false;
    var h = origSetInterval(function () {
      if (typeof fn === "function") fn.apply(G, args);
    }, ms);
    timers.set(h, function () {
      if (!cleared) {
        cleared = true;
        pending--;
      }
    });
    return h;
  };
  G.clearInterval = function (h) {
    var release = timers.get(h);
    if (release) release();
    timers.delete(h);
    origClearInterval(h);
  };

  // ----- Ошибки -----
  /** Номер строки кода ученика из стека (Chrome: «<anonymous>:3:7)», Firefox: «> eval:3:7»). null — не нашли. */
  function lineOf(err) {
    var stack = err && typeof err.stack === "string" ? err.stack : "";
    var m = /,\s*<anonymous>:(\d+):\d+\)/.exec(stack) || /> eval:(\d+):\d+/.exec(stack);
    return m ? Number(m[1]) : null;
  }

  function describe(err) {
    if (err instanceof Error) return (err.name || "Error") + ": " + err.message;
    try {
      return "Uncaught " + inspect(err, 0, []);
    } catch (e) {
      return "Uncaught error";
    }
  }

  var failed = false;
  var finished = false;
  var started = 0;
  function fail(err) {
    if (failed || finished) return;
    failed = true;
    post({ type: "error", id: runId, text: describe(err), line: lineOf(err) });
    finish();
  }

  function finish() {
    if (finished) return;
    finished = true;
    post({ type: "done", id: runId, ms: Math.round(now() - started), cut: cut });
  }

  // Ошибки в таймерах и необработанные промисы тоже показываем как ошибку программы.
  G.onerror = function (message, src, line, col, err) {
    fail(err || new Error(String(message)));
    return true;
  };
  G.onunhandledrejection = function (ev) {
    fail(ev && ev.reason !== undefined ? ev.reason : new Error("Unhandled promise rejection"));
    if (ev && ev.preventDefault) ev.preventDefault();
  };

  /** Ждём, пока кончатся таймеры и промисы (не дольше таймаута основного потока — он убьёт воркер). */
  function whenIdle() {
    if (finished) return;
    if (pending > 0) origSetTimeout(whenIdle, 10);
    // Небольшая пауза: браузер сообщает о необработанном промисе (unhandledrejection) не сразу.
    else origSetTimeout(function () {
      if (pending > 0) whenIdle();
      else finish();
    }, 20);
  }

  G.onmessage = function (ev) {
    var msg = ev && ev.data;
    if (!msg || msg.type !== "run") return;
    runId = msg.id;
    started = now();
    try {
      indirectEval(String(msg.code));
    } catch (err) {
      fail(err);
      return;
    }
    whenIdle();
  };

  post({ type: "ready" });
})();
