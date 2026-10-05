import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PY_FORBID, TASKS } from "@/lib/ide/python/tasks";
import { checkPython, findForbidden, normalizeOutput, sameOutput, type PyRun } from "@/lib/ide/python/check";
import { changedVars, codeLine, highlightFor, outputAt, parseTrace, TRACE_STEP_LIMIT, type TraceData } from "@/lib/ide/python/trace";
import { idePythonDict } from "@/i18n/parts/ide-python";
import { IDE_REGISTRY } from "@/components/ide/registry";

const hasPython = spawnSync("python3", ["--version"]).status === 0;
const dir = mkdtempSync(join(tmpdir(), "ide-python-"));

/** Запуск программы системным python3 (так же, как её запустил бы ученик). */
function runSystem(code: string, stdin: string) {
  const file = join(dir, "prog.py");
  writeFileSync(file, code);
  const r = spawnSync("python3", [file], { input: stdin, encoding: "utf8", timeout: 10000 });
  return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

describe("normalizeOutput", () => {
  it("убирает пробелы в конце строк и пустые строки в конце", () => {
    expect(normalizeOutput("1  \n2\t\n\n\n")).toBe("1\n2");
    expect(normalizeOutput("a\r\nb\r\n")).toBe("a\nb");
    expect(normalizeOutput("")).toBe("");
  });
  it("не трогает пробелы и пустые строки внутри", () => {
    expect(normalizeOutput("  a\n\nb")).toBe("  a\n\nb");
  });
  it("sameOutput игнорирует хвост, но не содержимое", () => {
    expect(sameOutput("8\n", "8")).toBe(true);
    expect(sameOutput("8 \n\n", "8")).toBe(true);
    expect(sameOutput("08", "8")).toBe(false);
    expect(sameOutput("1\n2", "1\n\n2")).toBe(false);
  });
});

describe("checkPython (с подставным запуском)", () => {
  const check = { kind: "python" as const, tests: [{ stdin: "1\n", stdout: "2" }, { stdin: "5\n", stdout: "10" }] };
  const doubler: PyRun = async (_code, stdin) => ({ stdout: `${Number(stdin) * 2}\n` });

  it("все тесты пройдены", async () => {
    expect(await checkPython(check, "print()", doubler)).toEqual({ ok: true, passed: 2, total: 2 });
  });
  it("неверный вывод: считает пройденные и даёт пример", async () => {
    const r = await checkPython(check, "print()", async (_c, stdin) => ({ stdout: stdin === "1\n" ? "2\n" : "99\n" }));
    expect(r.ok).toBe(false);
    expect(r.passed).toBe(1);
    expect(r.total).toBe(2);
    expect(r.sample).toEqual({ input: "5\n", expected: "10", got: "99\n" });
    expect(typeof r.message === "object" && r.message.ru).toContain("тест 2 из 2");
    expect(typeof r.message === "object" && r.message.kk).toContain("2-тест");
  });
  it("ошибка выполнения попадает в сообщение с номером строки", async () => {
    const r = await checkPython(check, "print(x)", async () => ({ stdout: "", error: { line: 3, text: "NameError: name 'x' is not defined" } }));
    expect(r.ok).toBe(false);
    expect(r.passed).toBe(0);
    const msg = r.message as { ru: string; kk: string };
    expect(msg.ru).toContain("строка 3");
    expect(msg.ru).toContain("NameError");
    expect(msg.kk).toContain("3-жол");
  });
  it("таймаут останавливает проверку сразу", async () => {
    let calls = 0;
    const r = await checkPython(check, "while True: pass", async () => {
      calls++;
      return { stdout: "", timedOut: true };
    });
    expect(calls).toBe(1);
    expect(r.ok).toBe(false);
    expect((r.message as { ru: string }).ru).toContain("бесконечный цикл");
  });
  it("не загрузился Python — отдельное сообщение", async () => {
    const r = await checkPython(check, "print()", async () => ({ stdout: "", loadFailed: true }));
    expect(r.ok).toBe(false);
    expect((r.message as { ru: string }).ru).toContain("загрузить Python");
  });
  it("пустой код не запускается", async () => {
    let calls = 0;
    const r = await checkPython(check, "  \n", async () => {
      calls++;
      return { stdout: "" };
    });
    expect(calls).toBe(0);
    expect(r.ok).toBe(false);
  });
  it("хвостовые пробелы и пустые строки не мешают", async () => {
    const r = await checkPython(check, "print()", async (_c, stdin) => ({ stdout: `${Number(stdin) * 2}  \n\n\n` }));
    expect(r.ok).toBe(true);
  });
});

describe("задачи Python", () => {
  it("61 задача, id уникальны, уровни от A до C", () => {
    expect(TASKS).toHaveLength(61);
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length);
    const count = (lv: number) => TASKS.filter((t) => t.level === lv).length;
    // баланс уровней: простых меньше всего не должно быть, сложных — не меньше пятой части новых
    expect(count(1)).toBeGreaterThanOrEqual(10);
    expect(count(2)).toBeGreaterThanOrEqual(15);
    expect(count(3)).toBeGreaterThanOrEqual(8);
    // первые 10 задач — старый порядок A→C
    const first = TASKS.slice(0, 10).map((t) => t.level);
    expect(first).toEqual([...first].sort());
  });
  it("новые навыки курса 2.0: у каждого есть задачи, 5 задач «найди ошибку», 3 «касса»", () => {
    const by = (skill: string) => TASKS.filter((t) => t.skill === skill);
    for (const sk of ["py.io", "py.types", "py.ops", "py.cond", "py.for", "py.while", "py.nested", "py.patterns", "py.strmethods", "py.listops", "py.matrix", "py.params", "py.recursion", "py.sort", "py.search", "py.graphs"]) {
      expect(by(sk).length, sk).toBeGreaterThanOrEqual(1);
    }
    expect(by("py.debug")).toHaveLength(5);
    expect(by("py.context")).toHaveLength(3);
    expect(by("py.patterns").length).toBeGreaterThanOrEqual(3);
  });
  it("этап 14, C9a: 20 новых задач по навыкам из ТЗ и одна на сортировку (для урока «Сортировки»)", () => {
    const fresh = TASKS.filter((t) => Number(t.id.split("-")[1]) >= 41);
    expect(fresh).toHaveLength(21);
    expect(fresh.map((t) => t.id)).toEqual(TASKS.slice(-21).map((t) => t.id)); // дописаны в конец списка
    const by = (...skills: string[]) => fresh.filter((t) => skills.includes(t.skill ?? "")).length;
    expect(by("py.if")).toBe(4);
    expect(by("py.for")).toBe(3);
    expect(by("py.while")).toBe(2);
    expect(by("py.strings", "py.strmethods")).toBe(4);
    expect(by("py.lists", "py.listops")).toBe(3);
    expect(by("py.functions", "py.params")).toBe(2);
    expect(by("py.patterns")).toBe(2);
    expect(by("py.sort")).toBe(1);
    // уровни A/B/C: примерно 8/8/4 (плюс одна B на сортировку)
    expect([1, 2, 3].map((lv) => fresh.filter((t) => t.level === lv).length)).toEqual([8, 9, 4]);
    // в ветвлениях есть elif (цепочка из ≥ 3 веток)
    expect(fresh.filter((t) => t.skill === "py.if" && /\belif\b/.test(t.solution)).length).toBeGreaterThanOrEqual(2);
  });
  it("в каждой задаче несколько тестов с краевыми случаями (≥ 3, кроме «Вывода и арифметики»)", () => {
    for (const task of TASKS) {
      if (task.check.kind !== "python" || task.id === "py-1-hello") continue;
      expect(task.check.tests.length, task.id).toBeGreaterThanOrEqual(3);
    }
  });
  it("«найди ошибку»: заготовка — рабочая по форме программа, отличается от эталона", () => {
    for (const task of TASKS.filter((t) => t.skill === "py.debug")) {
      expect(task.starter.trim(), task.id).not.toBe(task.solution.trim());
      expect(task.starter.length, task.id).toBeGreaterThan(30);
    }
  });
  it("двуязычные тексты, навыки py.*, проверка python", () => {
    for (const task of TASKS) {
      expect(task.lang, task.id).toBe("python");
      expect(task.skill, task.id).toMatch(/^py\./);
      for (const f of [task.title, task.prompt, task.hint!]) {
        expect(f?.ru?.trim(), task.id).toBeTruthy();
        expect(f?.kk?.trim(), task.id).toBeTruthy();
      }
      expect(task.starter, task.id).toBeTruthy();
      expect(task.solution.trim(), task.id).toBeTruthy();
      expect(task.check.kind, task.id).toBe("python");
      if (task.check.kind === "python") expect(task.check.tests.length, task.id).toBeGreaterThanOrEqual(1);
    }
  });
  it("в казахских текстах нет эмодзи и «бинарлы»", () => {
    const all = TASKS.map((t) => `${t.title.kk} ${t.prompt.kk} ${t.hint?.kk}`).join(" ");
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toContain("бинар");
  });
  it("реестр подхватывает задачи", () => {
    expect(IDE_REGISTRY.python.tasks).toBe(TASKS);
  });
  it("перевод в двоичную — вручную: в эталоне нет bin и format", () => {
    const t = TASKS.find((x) => x.id === "py-10-binary")!;
    expect(t.solution).not.toMatch(/\bbin\(|\bformat\(/);
  });

  it("ограничения: bin/format/max запрещены, эталон проходит", async () => {
    const bin = TASKS.find((x) => x.id === "py-10-binary")!;
    const max3 = TASKS.find((x) => x.id === "py-4-max3")!;
    const f10 = PY_FORBID["py-10-binary"];
    for (const bad of ["print(bin(int(input()))[2:])", 'n=int(input())\nprint(f"{n:b}")', 'print("{:b}".format(int(input())))', "print(format(5, 'b'))"]) {
      expect(findForbidden(bad, f10), bad).not.toBeNull();
    }
    expect(findForbidden(bin.solution, f10)).toBeNull();
    expect(findForbidden('# bin(x)\nprint("bin( format(")', f10)).toBeNull();
    expect(findForbidden("print(max(a, b, c))", PY_FORBID["py-4-max3"])).not.toBeNull();
    expect(findForbidden(max3.solution, PY_FORBID["py-4-max3"])).toBeNull();
    let calls = 0;
    const r = await checkPython(bin.check as never, "print(bin(int(input()))[2:])", async () => { calls++; return { stdout: "" }; }, f10);
    expect(r.ok).toBe(false);
    expect(calls).toBe(0);
  });

  it("новые ограничения: эталоны их не нарушают, запрещённые приёмы ловятся", () => {
    const byId = (id: string) => TASKS.find((x) => x.id === id)!;
    for (const [id, rules] of Object.entries(PY_FORBID)) expect(findForbidden(byId(id).solution, rules), id).toBeNull();
    for (const id of Object.keys(PY_FORBID)) expect(byId(id), id).toBeTruthy();
    const bad: Record<string, string[]> = {
      "py-14-ops-digit": ["n = input()\nk = int(input())\nprint(n[-k])", "print(str(5274)[1])"],
      "py-21-pat-maxpos": ["a = [1]\nprint(max(a))", "a = [1]\nprint(a.index(1))"],
      "py-22-pat-reverse": ["print(int(str(input())[::-1]))", "s = input()\nprint(int(s[::-1]))", "s = input()\nprint(s[2] + s[1] + s[0])"],
      "py-23-pat-gcd": ["from math import gcd\nprint(gcd(1, 2))", "import math\nprint(math.gcd(1, 2))"],
      "py-29-rec-fib": ["def fib(n):\n    for i in range(n):\n        pass", "while True:\n    pass"],
      "py-30-sort-bubble": ["a.sort()", "print(sorted(a))"],
      "py-31-search-binary": ["print(a.index(x))", "print(a.find(x))", "print(a.count(x))"],
    };
    Object.assign(bad, {
      "py-44-if-median3": ["print(sorted([a, b, c])[1])", "print(a + b + c - min(a, b, c) - max(a, b, c))", "x = [a, b, c]\nx.sort()\nprint(x[1])"],
      "py-45-for-evens": ["for i in range(1, n + 1):\n    if i % 2 == 0:\n        print(i)"],
      "py-46-for-factorial": ["import math\nprint(math.factorial(n))", "from math import factorial\nprint(factorial(n))"],
      "py-48-while-trips": ["print(b // c)\nprint(b % c)", "for i in range(b):\n    pass"],
    });
    for (const [id, codes] of Object.entries(bad)) for (const code of codes) expect(findForbidden(code, PY_FORBID[id]), `${id}: ${code}`).not.toBeNull();
    // слова в строках и комментариях не считаются нарушением
    expect(findForbidden('# for x in y\nprint("while sorted(a)")', PY_FORBID["py-29-rec-fib"])).toBeNull();
    // while в комментарии или строке — не цикл
    expect(findForbidden('# while\nprint("while")', PY_FORBID["py-48-while-trips"])).not.toBeNull();
    expect(findForbidden("while b >= c:\n    b -= c", PY_FORBID["py-48-while-trips"])).toBeNull();
    // слово min в тексте — не вызов
    expect(findForbidden('print("min(a)")', PY_FORBID["py-44-if-median3"])).toBeNull();
    // своя функция gcd по Евклиду — разрешена
    expect(findForbidden("def gcd(a, b):\n    return a", PY_FORBID["py-23-pat-gcd"])).toBeNull();
  });

  describe.skipIf(!hasPython)("типичные неверные решения отклоняются тестами (python3)", () => {
    const WRONG: Record<string, string[]> = {
      // >= вместо > — номер последнего наибольшего
      "py-21-pat-maxpos": ["n = int(input())\na = list(map(int, input().split()))\nbest = a[0]\npos = 1\nfor i in range(1, n):\n    if a[i] >= best:\n        best = a[i]\n        pos = i + 1\nprint(best)\nprint(pos)\n"],
      // нет проверки существования / нестрогое неравенство
      "py-16-cond-triangle": [
        'a = int(input())\nb = int(input())\nc = int(input())\nif a == b == c:\n    print("equilateral")\nelif a == b or b == c or a == c:\n    print("isosceles")\nelse:\n    print("scalene")\n',
        'a = int(input())\nb = int(input())\nc = int(input())\nif not (a <= b + c and b <= a + c and c <= a + b):\n    print("no")\nelif a == b == c:\n    print("equilateral")\nelif a == b or b == c or a == c:\n    print("isosceles")\nelse:\n    print("scalene")\n',
      ],
      // шаги без break после находки
      "py-31-search-binary": ["n = int(input())\na = list(map(int, input().split()))\nx = int(input())\nlo = 0\nhi = n - 1\nsteps = 0\npos = -1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    steps += 1\n    if a[mid] == x:\n        pos = mid\n    if a[mid] < x:\n        lo = mid + 1\n    else:\n        hi = mid - 1\nprint(pos)\nprint(steps)\n"],
      // только прямая дорога / 0 считается дорогой
      "py-32-graph-two": [
        "n = int(input())\na = [list(map(int, input().split())) for i in range(n)]\nprint(a[0][n - 1] if a[0][n - 1] > 0 else -1)\n",
        "n = int(input())\na = [list(map(int, input().split())) for i in range(n)]\nbest = a[0][n - 1]\nfor k in range(1, n - 1):\n    best = min(best, a[0][k] + a[k][n - 1])\nprint(best)\n",
      ],
      // самая дорогая позиция — по цене, а не по стоимости
      "py-39-cash-receipt": ["n = int(input())\ntotal = 0\nbest = 0\nbp = 0\nfor i in range(n):\n    price, qty = map(int, input().split())\n    total += price * qty\n    if price > bp:\n        bp = price\n        best = price * qty\nprint(total)\nprint(best)\n"],
      // печатает нулевые номиналы / забыт случай без сдачи
      "py-40-cash-change": [
        "m = int(input())\np = int(input())\nd = m - p\nfor x in [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]:\n    print(x, d // x)\n    d %= x\n",
        "m = int(input())\np = int(input())\nd = m - p\nfor x in [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]:\n    if d // x > 0:\n        print(x, d // x)\n    d %= x\n",
      ],
      // нет ветки error / граница 0 в «лёд» / нестрогое сравнение со средним / последняя серия не учтена
      "py-41-if-weekday": ['d = int(input())\nif 1 <= d <= 5:\n    print("weekday")\nelse:\n    print("weekend")\n'],
      "py-42-if-water": ['t = int(input())\nif t < 0:\n    print("ice")\nelif t < 100:\n    print("water")\nelse:\n    print("steam")\n'],
      "py-44-if-median3": ["a = int(input())\nb = int(input())\nc = int(input())\nif a < b < c:\n    print(b)\nelif a < c < b:\n    print(c)\nelse:\n    print(a)\n"],
      "py-45-for-evens": ['n = int(input())\nfor i in range(2, n, 2):\n    print(i, end=" ")\nprint()\n'],
      "py-47-for-steps": ["n = int(input())\ntotal = 0\ngoal = 0\nfor i in range(n):\n    x = int(input())\n    total += x\n    if x > 10000:\n        goal += 1\nprint(total)\nprint(goal)\n"],
      "py-49-while-collatz": ["n = int(input())\nsteps = 0\nwhile n > 1:\n    if n % 2 == 0:\n        n //= 2\n    else:\n        n = 3 * n + 1\n    steps += 1\nprint(steps + 1)\n"],
      "py-51-str-date": ['s = input()\nprint(s[0:2] + "." + s[2:4] + "." + s[4:6])\n'],
      "py-52-str-fence": ["s = input()\nprint(s[::2] + s[1::2][::-1])\n"],
      "py-53-str-compress": ['s = input()\nres = ""\ncount = 1\nfor i in range(1, len(s)):\n    if s[i] == s[i - 1]:\n        count += 1\n    else:\n        res += s[i - 1] + str(count)\n        count = 1\nprint(res)\n'],
      "py-54-list-basket": ['a = input().split()\nx = input()\nif x in a:\n    a.remove(x)\nprint(*a)\n'],
      "py-56-list-jump": ["n = int(input())\na = list(map(int, input().split()))\nbest = 0\nfor i in range(n - 1):\n    best = max(best, a[i + 1] - a[i])\nprint(best)\n"],
      "py-57-func-ticket": ["def ticket(age):\n    if age <= 7:\n        return 0\n    elif age < 18:\n        return 500\n    elif age < 60:\n        return 1000\n    else:\n        return 600\n\n\nn = int(input())\nages = list(map(int, input().split()))\nprint(sum(ticket(a) for a in ages))\n"],
      "py-59-pat-above-avg": ["n = int(input())\na = list(map(int, input().split()))\navg = sum(a) / n\nprint(len([x for x in a if x >= avg]))\n"],
      "py-60-pat-streak": ["n = int(input())\na = list(map(int, input().split()))\nbest = 0\ncur = 0\nfor x in a:\n    if x < 0:\n        cur += 1\n    else:\n        best = max(best, cur)\n        cur = 0\nprint(best)\n"],
      "py-61-sort-median": ["n = int(input())\na = list(map(int, input().split()))\nprint(a[n // 2])\n"],
      // разряд: k-я цифра слева вместо справа
      "py-14-ops-digit": ["n = int(input())\nk = int(input())\nwhile n >= 10 ** k:\n    n //= 10\nprint(n % 10)\n"],
    };
    for (const [id, codes] of Object.entries(WRONG)) {
      const task = TASKS.find((x) => x.id === id)!;
      it(`${id}: неверные решения не проходят`, () => {
        expect(task, id).toBeTruthy();
        if (task.check.kind !== "python") return;
        for (const code of codes) {
          const okAll = task.check.tests.every((test) => {
            const r = runSystem(code, test.stdin ?? "");
            return r.status === 0 && sameOutput(r.stdout, test.stdout);
          });
          expect(okAll, `${id}: ${code}`).toBe(false);
        }
      });
    }
  });

  describe.skipIf(!hasPython)("эталоны (системный python3)", () => {
    for (const task of TASKS) {
      if (task.check.kind !== "python") continue;
      const tests = task.check.tests;
      it(`${task.id}: эталон проходит все тесты`, () => {
        tests.forEach((test, i) => {
          const r = runSystem(task.solution, test.stdin ?? "");
          expect(r.status, `${task.id} тест ${i + 1}: ${r.stderr}`).toBe(0);
          expect(normalizeOutput(r.stdout), `${task.id} тест ${i + 1}`).toBe(normalizeOutput(test.stdout));
        });
      });
      it(`${task.id}: заготовка не решает задачу`, () => {
        const okAll = tests.every((test) => {
          const r = runSystem(task.starter, test.stdin ?? "");
          return r.status === 0 && sameOutput(r.stdout, test.stdout);
        });
        expect(okAll).toBe(false);
      });
    }
  });
});

describe("словарь idepy", () => {
  it("плейсхолдеры в ru и kk совпадают", () => {
    for (const [key, v] of Object.entries(idePythonDict)) {
      expect(key.startsWith("idepy."), key).toBe(true);
      const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(ph(v.kk), key).toEqual(ph(v.ru));
      expect(v.kk).not.toMatch(/\}[а-яәіңғүұқөһ]/i); // после {плейсхолдера} нет падежного окончания
    }
  });
});

describe("трассировка (чистые помощники)", () => {
  const trace: TraceData = {
    steps: [
      { line: 1, fn: null, vars: [], out: 0 },
      { line: 2, fn: null, vars: [["x", "1"]], out: 0 },
      { line: 3, fn: null, vars: [["x", "5"]], out: 2 },
      { line: null, fn: null, vars: [["x", "5"]], out: 4 },
    ],
    truncated: false,
    out: "5\n6\n",
    error: null,
  };
  it("вывод к шагу и подсветка", () => {
    expect(outputAt(trace, 1)).toBe("");
    expect(outputAt(trace, 2)).toBe("5\n");
    expect(outputAt(trace, 3)).toBe("5\n6\n");
    expect(outputAt(trace, 9)).toBe("");
    expect(highlightFor(trace, 2)).toBe(3);
    expect(highlightFor(trace, 3)).toBeUndefined();
    expect(highlightFor({ ...trace, error: { line: 7, text: "E" } }, 3)).toBe(7);
  });
  it("изменившиеся переменные", () => {
    expect([...changedVars(trace, 1)]).toEqual(["x"]);
    expect([...changedVars(trace, 2)]).toEqual(["x"]);
    expect([...changedVars(trace, 3)]).toEqual([]);
    expect([...changedVars(trace, 0)]).toEqual([]);
  });
  it("текст строки и разбор ответа", () => {
    expect(codeLine("a = 1\n  b = 2\n", 2)).toBe("b = 2");
    expect(codeLine("a", null)).toBe("");
    expect(parseTrace(null)).toBeUndefined();
    expect(parseTrace({ steps: [] })?.steps).toEqual([]);
  });
});

// Python-часть воркера (public/ide/python-worker.js) гоняем системным python3: те же функции, что работают в Pyodide.
describe("воркер Pyodide", () => {
  const workerSrc = readFileSync(join(__dirname, "../public/ide/python-worker.js"), "utf8");

  it("версия Pyodide и модульный воркер", () => {
    expect(workerSrc).toMatch(/PYODIDE_VERSION = "\d+\.\d+\.\d+"/);
    expect(workerSrc).toContain("cdn.jsdelivr.net/pyodide/v");
    expect(workerSrc).toContain("pyodide.mjs");
    expect(workerSrc).not.toMatch(/^\s*importScripts\(/m);
    const runner = readFileSync(join(__dirname, "../src/lib/ide/python/runner.ts"), "utf8");
    expect(runner).toContain('type: "module"');
    expect(runner).toContain("terminate");
  });

  it("протокол: все типы сообщений на месте", () => {
    for (const type of ["loading", "start", "stdout", "trace", "done", "error", "ready"]) expect(workerSrc).toContain(`type: "${type}"`);
  });

  const m = workerSrc.match(/String\.raw`([\s\S]*?)`;/);
  it("Python-исходник вынимается", () => {
    expect(m?.[1]).toContain("def _ide_run");
  });

  describe.skipIf(!hasPython || !m)("запуск (python3)", () => {
    writeFileSync(join(dir, "runner.py"), m?.[1] ?? "");
    const driver = [
      "import json, sys",
      "ns = {}",
      `exec(open(${JSON.stringify(join(dir, "runner.py"))}, encoding='utf-8').read(), ns)`,
      "p = json.load(sys.stdin)",
      "chunks = []",
      "res = ns['_ide_run'](p['code'], p['stdin'], p['trace'], chunks.append)",
      "print(json.dumps({'res': json.loads(res), 'out': ''.join(chunks)}))",
    ].join("\n");
    writeFileSync(join(dir, "driver.py"), driver);

    interface Res {
      error: { line: number | null; text: string } | null;
      cut: boolean;
      trace?: TraceData;
    }
    function runWorkerPython(code: string, stdin = "", trace = false): { res: Res; out: string } {
      const r = spawnSync("python3", [join(dir, "driver.py")], { input: JSON.stringify({ code, stdin, trace }), encoding: "utf8", timeout: 20000 });
      if (r.status !== 0) throw new Error(r.stderr);
      return JSON.parse(r.stdout);
    }

    it("print и input", () => {
      const r = runWorkerPython("a = int(input())\nb = int(input())\nprint(a + b)\nprint('Привет')", "3\n4\n");
      expect(r.out).toBe("7\nПривет\n");
      expect(r.res.error).toBeNull();
    });
    it("input с приглашением печатает его в вывод", () => {
      expect(runWorkerPython("x = input('n = ')\nprint(x)", "5\n").out).toBe("n = 5\n");
    });
    it("ошибка: номер строки и последняя строка трассировки; вывод до ошибки сохраняется", () => {
      const r = runWorkerPython("print(1)\nprint(x)\n");
      expect(r.out).toBe("1\n");
      expect(r.res.error?.line).toBe(2);
      expect(r.res.error?.text).toBe("NameError: name 'x' is not defined");
    });
    it("ошибка внутри функции указывает строку программы", () => {
      const r = runWorkerPython("def f(a):\n    return a / 0\n\nprint(f(1))\n");
      expect(r.res.error?.line).toBe(2);
      expect(r.res.error?.text).toContain("ZeroDivisionError");
    });
    it("синтаксическая ошибка", () => {
      const r = runWorkerPython("x = 1\nif x ==\n    print(x)\n");
      expect(r.res.error?.text).toMatch(/^SyntaxError/);
      expect(r.res.error?.line).toBeGreaterThanOrEqual(2);
    });
    it("не хватает входных данных — EOFError", () => {
      const r = runWorkerPython("input()\ninput()", "1\n");
      expect(r.res.error?.text).toMatch(/^EOFError/);
      expect(r.res.error?.line).toBe(2);
    });
    it("exit() — не ошибка", () => {
      const r = runWorkerPython("print('a')\nimport sys\nsys.exit()\nprint('b')");
      expect(r.out).toBe("a\n");
      expect(r.res.error).toBeNull();
    });
    it("каждый запуск с чистыми переменными", () => {
      expect(runWorkerPython("print('x' in globals())").out).toBe("False\n");
    });
    it("состояние не протекает между запусками (builtins, лимит рекурсии)", () => {
      const code = "import builtins, sys\nbuiltins.input = lambda *a: '7'\nsys.setrecursionlimit(50000)\n";
      const drv = [
        "import json, sys",
        "ns = {}",
        `exec(open(${JSON.stringify(join(dir, "runner.py"))}, encoding='utf-8').read(), ns)`,
        "lim = sys.getrecursionlimit()",
        `ns['_ide_run'](${JSON.stringify(code)}, '', False, None)`,
        "ch = []",
        "ns['_ide_run']('print(input())', '1\\n', False, ch.append)",
        "print(json.dumps({'out': ''.join(ch), 'same': lim == sys.getrecursionlimit()}))",
      ].join("\n");
      writeFileSync(join(dir, "leak.py"), drv);
      const r = spawnSync("python3", [join(dir, "leak.py")], { encoding: "utf8", timeout: 20000 });
      expect(JSON.parse(r.stdout)).toEqual({ out: "1\n", same: true });
    });
    it("quiet: приглашение input() не печатается", () => {
      const drv = [
        "import json",
        "ns = {}",
        `exec(open(${JSON.stringify(join(dir, "runner.py"))}, encoding='utf-8').read(), ns)`,
        "ch = []",
        `ns['_ide_run'](${JSON.stringify('a = input("Введите: ")\nprint(a)')}, '5\\n', False, ch.append, True)`,
        "print(json.dumps(''.join(ch)))",
      ].join("\n");
      writeFileSync(join(dir, "quiet.py"), drv);
      const r = spawnSync("python3", [join(dir, "quiet.py")], { encoding: "utf8", timeout: 20000 });
      expect(JSON.parse(r.stdout)).toBe("5\n");
    });
    it("очень длинный вывод обрезается", () => {
      const r = runWorkerPython("print('x' * 300000)");
      expect(r.res.cut).toBe(true);
      expect(r.out.length).toBeLessThanOrEqual(100000);
    });

    it("трассировка: цикл", () => {
      const r = runWorkerPython("x = 1\nfor i in range(3):\n    x += i\nprint(x)\n", "", true);
      const t = r.res.trace!;
      expect(t.truncated).toBe(false);
      expect(t.steps[0].line).toBe(1);
      expect(t.steps[1]).toMatchObject({ line: 2, vars: [["x", "1"]] });
      const lines = t.steps.map((s) => s.line);
      expect(lines.filter((l) => l === 3)).toHaveLength(3);
      const end = t.steps[t.steps.length - 1];
      expect(end.line).toBeNull();
      expect(Object.fromEntries(end.vars)).toEqual({ x: "4", i: "2" });
      expect(t.out).toBe("4\n");
      expect(end.out).toBe(2);
      // вывод по шагам не убывает
      for (let i = 1; i < t.steps.length; i++) expect(t.steps[i].out).toBeGreaterThanOrEqual(t.steps[i - 1].out);
    });
    it("трассировка: функции и значения разных типов", () => {
      const code = "def f(x):\n    y = x * 2\n    return y\n\nnums = [1, 2, 3]\nname = 'ab'\nflag = True\nz = 0.5\nres = f(3)\nprint(res)\n";
      const t = runWorkerPython(code, "", true).res.trace!;
      const inF = t.steps.filter((s) => s.fn === "f");
      expect(inF.length).toBeGreaterThanOrEqual(2);
      expect(Object.fromEntries(inF[inF.length - 1].vars)).toMatchObject({ x: "3", y: "6" });
      const end = Object.fromEntries(t.steps[t.steps.length - 1].vars);
      expect(end).toMatchObject({ nums: "[1, 2, 3]", name: "'ab'", flag: "True", z: "0.5", res: "6" });
      expect(end).not.toHaveProperty("f"); // функции в таблице не показываем
    });
    it("трассировка: длинный список обрезается до 10 элементов", () => {
      const t = runWorkerPython("a = list(range(25))\n", "", true).res.trace!;
      const a = Object.fromEntries(t.steps[t.steps.length - 1].vars).a;
      expect(a).toBe("[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, …]");
    });
    it("трассировка: лимит шагов останавливает даже бесконечный цикл", () => {
      const r = runWorkerPython("n = 0\nwhile True:\n    n += 1\n", "", true);
      const t = r.res.trace!;
      expect(t.truncated).toBe(true);
      expect(t.steps).toHaveLength(TRACE_STEP_LIMIT);
      expect(r.res.error).toBeNull();
    });
    it("трассировка: ошибка попадает в данные трассировки", () => {
      const r = runWorkerPython("x = 1\ny = x / 0\n", "", true);
      expect(r.res.error?.line).toBe(2);
      expect(r.res.trace?.error?.text).toContain("ZeroDivisionError");
      expect(r.res.trace?.steps.map((s) => s.line)).toEqual([1, 2, null]);
    });
    it("трассировка с вводом", () => {
      const t = runWorkerPython("n = int(input())\nprint(n * 2)\n", "21\n", true).res.trace!;
      expect(t.out).toBe("42\n");
      expect(Object.fromEntries(t.steps[t.steps.length - 1].vars)).toEqual({ n: "21" });
    });
  });
});
