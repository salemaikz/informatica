import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { TASKS } from "@/lib/ide/js/tasks";
import { checkJs, normalizeOutput, sameOutput, RUN_TIMEOUT_MS, type JsRun } from "@/lib/ide/js/check";
import { ideWebDict } from "@/i18n/parts/ide-web";
import { IDE_REGISTRY } from "@/components/ide/registry";

// Реальный файл воркера (public/ide/js-worker.js) гоняется в node:vm с поддельными self/postMessage —
// проверяем именно тот код, который выполнит браузер: перехват console.log, ошибки, таймеры.

const workerSource = readFileSync("public/ide/js-worker.js", "utf8");

interface WorkerMsg {
  type: string;
  id?: number;
  level?: string;
  text?: string;
  line?: number | null;
  ms?: number;
  cut?: boolean;
}

/** Запуск кода в «воркере»: ждём сообщение done (в том числе отложенный вывод), без done за timeoutMs — таймаут. */
function runInWorker(code: string, timeoutMs = 2000): Promise<{ msgs: WorkerMsg[]; stdout: string; error: { line: number | null; text: string } | null; done: boolean; cut: boolean }> {
  return new Promise((resolve) => {
    const msgs: WorkerMsg[] = [];
    const sandbox: Record<string, unknown> = {
      postMessage: (m: WorkerMsg) => {
        msgs.push(m);
        if (m.type === "done") finish(true);
      },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      // то, что в воркере есть, а ученику не нужно, — проверим, что отключается
      fetch: () => "network",
      XMLHttpRequest: function () {},
    };
    sandbox.self = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(workerSource, ctx);
    const timer = setTimeout(() => finish(false), timeoutMs);
    let settled = false;
    function finish(done: boolean) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const logs = msgs.filter((m) => m.type === "log");
      const err = msgs.find((m) => m.type === "error");
      const doneMsg = msgs.find((m) => m.type === "done");
      resolve({
        msgs,
        stdout: logs.map((m) => m.text).join("\n"),
        error: err ? { line: err.line ?? null, text: err.text ?? "" } : null,
        done,
        cut: !!doneMsg?.cut,
      });
    }
    vm.runInContext(`onmessage({ data: { type: "run", id: 7, code: ${JSON.stringify(code)} } })`, ctx, { timeout: 1000 });
  });
}

const out = async (code: string) => (await runInWorker(code)).stdout;

describe("normalizeOutput / sameOutput", () => {
  it("убирает пробелы в конце строк и пустые строки в конце", () => {
    expect(normalizeOutput("1  \n2\t\n\n\n")).toBe("1\n2");
    expect(normalizeOutput("a\r\nb\r\n")).toBe("a\nb");
    expect(sameOutput("17\n", "17")).toBe(true);
    expect(sameOutput("1\n2", "1\n\n2")).toBe(false);
    expect(sameOutput("08", "8")).toBe(false);
  });
});

describe("checkJs (с подставным запуском)", () => {
  const check = { kind: "js" as const, stdout: "16\n9" };
  const ok: JsRun = async () => ({ stdout: "16\n9\n" });

  it("совпавший вывод — верно", async () => {
    expect(await checkJs(check, "x", ok)).toEqual({ ok: true, passed: 1, total: 1 });
  });
  it("несовпавший вывод: сообщение и пример «ожидалось / получено»", async () => {
    const r = await checkJs(check, "x", async () => ({ stdout: "16\n10" }));
    expect(r.ok).toBe(false);
    expect(r.sample).toEqual({ expected: "16\n9", got: "16\n10" });
    expect((r.message as { ru: string }).ru).toContain("не совпал");
    expect((r.message as { kk: string }).kk).toContain("сәйкес келмеді");
  });
  it("ошибка выполнения — с номером строки на обоих языках", async () => {
    const r = await checkJs(check, "x", async () => ({ stdout: "", error: { line: 4, text: "ReferenceError: q is not defined" } }));
    expect(r.ok).toBe(false);
    const msg = r.message as { ru: string; kk: string };
    expect(msg.ru).toContain("строка 4");
    expect(msg.ru).toContain("ReferenceError");
    expect(msg.kk).toContain("4-жол");
  });
  it("ошибка без строки — без «строка»", async () => {
    const r = await checkJs(check, "x", async () => ({ stdout: "", error: { line: null, text: "SyntaxError: Unexpected token" } }));
    expect((r.message as { ru: string }).ru).not.toContain("строка");
  });
  it("таймаут и сбой запуска — отдельные сообщения", async () => {
    const t = await checkJs(check, "x", async () => ({ stdout: "", timedOut: true }));
    expect((t.message as { ru: string }).ru).toContain("бесконечный цикл");
    const l = await checkJs(check, "x", async () => ({ stdout: "", loadFailed: true }));
    expect((l.message as { ru: string }).ru).toContain("запустить JavaScript");
  });
  it("пустой код не запускается", async () => {
    let calls = 0;
    const r = await checkJs(check, " \n", async () => {
      calls++;
      return { stdout: "" };
    });
    expect(calls).toBe(0);
    expect(r.ok).toBe(false);
  });
  it("таймаут из спецификации — 3 с", () => {
    expect(RUN_TIMEOUT_MS).toBe(3000);
  });
});

describe("воркер: перехват console.log (node:vm)", () => {
  it("строки как есть, числа, несколько аргументов", async () => {
    expect(await out('console.log("Hello, world!"); console.log(1 + 2); console.log("a", 1, true, null, undefined)')).toBe("Hello, world!\n3\na 1 true null undefined");
  });
  it("число с плавающей точкой и -0", async () => {
    expect(await out("console.log(0.1 + 0.2); console.log(-0); console.log(7 / 2)")).toBe("0.30000000000000004\n-0\n3.5");
  });
  it("массивы и объекты — как в Node, строки внутри в кавычках", async () => {
    expect(await out('console.log([1, 2, 3]); console.log(["a", "b"]); console.log({ a: 1, b: "x" }); console.log([]); console.log({})')).toBe("[ 1, 2, 3 ]\n[ 'a', 'b' ]\n{ a: 1, b: 'x' }\n[]\n{}");
  });
  it("вложенность глубже трёх уровней сворачивается, циклические ссылки не зацикливают", async () => {
    expect(await out("console.log({ a: { b: { c: { d: 1 } } } })")).toBe("{ a: { b: { c: [Object] } } }");
    expect(await out("const o = {}; o.self = o; console.log(o)")).toBe("{ self: [Circular] }");
  });
  it("форматирование %s %d %i %f %j и %%", async () => {
    expect(await out('console.log("%s = %d", "x", 42); console.log("%i|%f", "7.9", "2.5"); console.log("%j", {a: 1}); console.log("100%%", 5)')).toBe("x = 42\n7|2.5\n{\"a\":1}\n100% 5");
  });
  it("функции, ошибки, null-объекты, BigInt", async () => {
    expect(await out("function f() {} console.log(f); console.log(new Error('boom')); console.log(10n)")).toBe("[Function: f]\nError: boom\n10n");
  });
  it("console.info/debug — вывод, warn/error — тоже вывод с уровнем", async () => {
    const r = await runInWorker('console.info("i"); console.debug("d"); console.warn("w"); console.error("e")');
    expect(r.stdout).toBe("i\nd\nw\ne");
    expect(r.msgs.filter((m) => m.type === "log").map((m) => m.level)).toEqual(["log", "log", "warn", "error"]);
  });
  it("console.group отступает, alert выводит в то же окно", async () => {
    expect(await out('console.group("G"); console.log("in"); console.groupEnd(); console.log("out"); alert("hi")')).toBe("G\n  in\nout\nhi");
  });
  it("неизвестные методы console не падают на распространённых", async () => {
    const r = await runInWorker('console.time("t"); console.timeEnd("t"); console.table([1]); console.assert(false, "oops"); console.count(); console.count()');
    expect(r.error).toBeNull();
    expect(r.stdout).toBe("[ 1 ]\nAssertion failed: oops\ndefault: 1\ndefault: 2");
  });
  it("каждый запуск сообщает done с временем; ошибки нет", async () => {
    const r = await runInWorker("1 + 1");
    expect(r.done).toBe(true);
    expect(r.error).toBeNull();
    expect(r.msgs.at(-1)?.type).toBe("done");
    expect(r.msgs.every((m) => m.type === "ready" || m.id === 7)).toBe(true);
  });
  it("сообщения «ready» воркер шлёт при загрузке", () => {
    const sent: WorkerMsg[] = [];
    const sandbox: Record<string, unknown> = { postMessage: (m: WorkerMsg) => sent.push(m), setTimeout, clearTimeout, setInterval, clearInterval };
    sandbox.self = sandbox;
    vm.runInContext(workerSource, vm.createContext(sandbox));
    expect(sent).toEqual([{ type: "ready" }]);
  });
});

describe("воркер: ошибки", () => {
  it("ReferenceError: текст и номер строки кода ученика", async () => {
    const r = await runInWorker('console.log("a");\nconsole.log("b");\nconsole.log(missing);');
    expect(r.stdout).toBe("a\nb");
    expect(r.error).toEqual({ line: 3, text: "ReferenceError: missing is not defined" });
    expect(r.done).toBe(true);
  });
  it("ошибка внутри функции — строка из тела функции", async () => {
    const r = await runInWorker("function f(x) {\n  return x.y.z;\n}\nf({});");
    expect(r.error?.text).toContain("TypeError");
    expect(r.error?.line).toBe(2);
  });
  it("SyntaxError — текст ошибки (строка может быть неизвестна)", async () => {
    const r = await runInWorker("let = ;");
    expect(r.error?.text).toContain("SyntaxError");
    expect(r.done).toBe(true);
  });
  it("throw нестандартного значения", async () => {
    const r = await runInWorker('throw "text"');
    expect(r.error?.text).toBe("Uncaught 'text'");
  });
  it("после ошибки вывод до неё сохраняется, воркер всё равно сообщает done", async () => {
    const r = await runInWorker('console.log(1); null.x;');
    expect(r.stdout).toBe("1");
    expect(r.msgs.map((m) => m.type)).toEqual(["ready", "log", "error", "done"]);
  });
});

describe("воркер: асинхронность", () => {
  it("setTimeout и Promise дожидаются, порядок как в браузере", async () => {
    const code = 'setTimeout(() => console.log("timeout"), 20); Promise.resolve().then(() => console.log("promise")); console.log("sync");';
    expect(await out(code)).toBe("sync\npromise\ntimeout");
  });
  it("async/await с ожиданием таймера", async () => {
    const code = 'const wait = (ms) => new Promise((r) => setTimeout(r, ms)); (async () => { await wait(10); console.log("after"); })(); console.log("before");';
    expect(await out(code)).toBe("before\nafter");
  });
  it("clearTimeout снимает таймер — воркер не ждёт его", async () => {
    const r = await runInWorker('const t = setTimeout(() => console.log("never"), 5000); clearTimeout(t); console.log("ok");', 1000);
    expect(r.done).toBe(true);
    expect(r.stdout).toBe("ok");
  });
  it("setInterval без clearInterval не завершается (основной поток остановит по таймауту)", async () => {
    const r = await runInWorker("setInterval(() => {}, 10);", 300);
    expect(r.done).toBe(false);
  });
  it("setInterval с clearInterval завершается", async () => {
    const r = await runInWorker('let n = 0; const h = setInterval(() => { n++; console.log(n); if (n === 3) clearInterval(h); }, 5);');
    expect(r.done).toBe(true);
    expect(r.stdout).toBe("1\n2\n3");
  });
});

describe("воркер: ограничения", () => {
  it("длинный вывод обрезается (cut), программа не падает", async () => {
    const r = await runInWorker("for (let i = 0; i < 5000; i++) console.log(i);");
    expect(r.cut).toBe(true);
    expect(r.msgs.filter((m) => m.type === "log").length).toBeLessThanOrEqual(2000);
    expect(r.done).toBe(true);
  });
  it("сеть и прочее отключены", async () => {
    expect(await out('console.log(typeof fetch, typeof XMLHttpRequest, typeof importScripts, typeof WebSocket)')).toBe("undefined undefined undefined undefined");
  });
  it("prompt/confirm не зависают", async () => {
    expect(await out("console.log(prompt('x'), confirm('y'))")).toBe("null false");
  });
  it("состояние запусков не смешивается: let в одном запуске не виден в другом", async () => {
    // каждый запуск — новый воркер: два независимых контекста
    expect(await out("let x = 5; console.log(x)")).toBe("5");
    expect(await out("console.log(typeof x)")).toBe("undefined");
  });
});

describe("задачи JavaScript", () => {
  it("10 задач, id уникальны, уровни растут A→C", () => {
    expect(TASKS).toHaveLength(10);
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length);
    const levels = TASKS.map((t) => t.level);
    expect(levels).toEqual([...levels].sort());
    expect(levels[0]).toBe(1);
    expect(levels[levels.length - 1]).toBe(3);
  });
  it("двуязычные тексты, без навыка курса, проверка js", () => {
    for (const task of TASKS) {
      expect(task.lang, task.id).toBe("js");
      expect(task.skill, task.id).toBeUndefined();
      for (const f of [task.title, task.prompt, task.hint!]) {
        expect(f?.ru?.trim(), task.id).toBeTruthy();
        expect(f?.kk?.trim(), task.id).toBeTruthy();
      }
      expect(task.starter.trim(), task.id).toBeTruthy();
      expect(task.solution.trim(), task.id).toBeTruthy();
      expect(task.check.kind, task.id).toBe("js");
      if (task.check.kind === "js") expect(task.check.stdout.trim(), task.id).toBeTruthy();
    }
  });
  it("в казахских текстах нет эмодзи, латинской «i» внутри кириллицы и «бинарлы»", () => {
    const all = TASKS.map((t) => `${t.title.kk} ${t.prompt.kk} ${t.hint?.kk}`).join(" ");
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/\p{Script=Cyrillic}i|i\p{Script=Cyrillic}/u);
    expect(all).not.toContain("бинар");
  });
  it("реестр подхватывает задачи", () => {
    expect(IDE_REGISTRY.js.tasks).toBe(TASKS);
  });

  it("js-3-if: ошибка «> 18» вместо «>= 18» не проходит", async () => {
    const task = TASKS.find((x) => x.id === "js-3-if")!;
    if (task.check.kind !== "js") throw new Error("kind");
    const run: JsRun = async (code) => {
      const r = await runInWorker(code);
      return { stdout: r.stdout, error: r.error };
    };
    expect((await checkJs(task.check, task.solution.replace(">= 18", "> 18"), run)).ok).toBe(false);
  });

  it("js-8-even: печать всех чисел без условия не проходит", async () => {
    const task = TASKS.find((x) => x.id === "js-8-even")!;
    if (task.check.kind !== "js") throw new Error("kind");
    const run: JsRun = async (code) => {
      const r = await runInWorker(code);
      return { stdout: r.stdout, error: r.error };
    };
    expect((await checkJs(task.check, "for (let i = 1; i <= 10; i++) console.log(i);", run)).ok).toBe(false);
  });
  it("js-9-filter и js-10-palindrome: альтернативные решения принимаются, неверные нет", async () => {
    const run: JsRun = async (code) => {
      const r = await runInWorker(code);
      return { stdout: r.stdout, error: r.error };
    };
    const chk = (id: string) => {
      const t = TASKS.find((x) => x.id === id)!;
      if (t.check.kind !== "js") throw new Error("kind");
      return t.check;
    };
    const alt9 = 'const nums = [5, 12, 7, 8, 3, 10, 4];\nconst r = [];\nfor (const x of nums) { if (x % 2 === 0) r.push(x * x); }\nconsole.log(r.join(" "));';
    expect((await checkJs(chk("js-9-filter"), alt9, run)).ok).toBe(true);
    expect((await checkJs(chk("js-9-filter"), 'console.log([12, 8, 10, 4].join(" "))', run)).ok).toBe(false);
    const CALLS10 = ["level", "python", "kazak", "alpha"].map((w) => `console.log(isPalindrome("${w}"));`).join("\n");
    const alt10 = `function isPalindrome(s) {\n  for (let i = 0; i < s.length / 2; i++) { if (s[i] !== s[s.length - 1 - i]) return "no"; }\n  return "yes";\n}\n${CALLS10}`;
    expect((await checkJs(chk("js-10-palindrome"), alt10, run)).ok).toBe(true);
    expect((await checkJs(chk("js-10-palindrome"), `function isPalindrome(s) { return "yes"; }\n${CALLS10}`, run)).ok).toBe(false);
    // только первый и последний символ: «alpha» выдаёт себя за палиндром
    expect((await checkJs(chk("js-10-palindrome"), `function isPalindrome(s) { return s[0] === s[s.length - 1] ? "yes" : "no"; }\n${CALLS10}`, run)).ok).toBe(false);
    // в стартовом коде переменная result объявлена через let — её можно переприсвоить
    const viaStarter = TASKS.find((x) => x.id === "js-9-filter")!.starter.replace("// ...", 'result = nums.filter((x) => x % 2 === 0).map((x) => x * x);');
    expect((await checkJs(chk("js-9-filter"), viaStarter, run)).ok).toBe(true);
  });

  for (const task of TASKS) {
    if (task.check.kind !== "js") continue;
    const check = task.check;
    it(`${task.id}: эталон даёт ожидаемый вывод`, async () => {
      const r = await runInWorker(task.solution);
      expect(r.error, task.id).toBeNull();
      expect(normalizeOutput(r.stdout), task.id).toBe(normalizeOutput(check.stdout));
    });
    it(`${task.id}: эталон проходит checkJs`, async () => {
      const run: JsRun = async (code) => {
        const r = await runInWorker(code);
        return { stdout: r.stdout, error: r.error };
      };
      expect((await checkJs(check, task.solution, run)).ok, task.id).toBe(true);
    });
    it(`${task.id}: начальный код не засчитывается`, async () => {
      const run: JsRun = async (code) => {
        const r = await runInWorker(code);
        return { stdout: r.stdout, error: r.error };
      };
      expect((await checkJs(check, task.starter, run)).ok, task.id).toBe(false);
    });
  }
});

describe("словарь ideweb.* (JavaScript-часть)", () => {
  it("есть все ключи рабочей области JavaScript", () => {
    for (const k of ["run", "running", "editor.aria", "note", "out.title", "out.idle", "out.empty", "out.cut", "out.time", "err.title", "err.line", "timeout", "timeout.hint", "loadFail"]) {
      expect(Object.keys(ideWebDict), k).toContain(`ideweb.js.${k}`);
    }
  });
});
