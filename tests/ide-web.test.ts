import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { TASKS } from "@/lib/ide/web/tasks";
import { colorKey, extractStyleText, hasCssRule, normalizeSelector, normalizeValue, parseCss, sheetFromHtml } from "@/lib/ide/web/css";
import {
  buildCheckDoc,
  buildCheckerScript,
  buildPreviewDoc,
  CHECKER_CORE,
  checkWeb,
  CHECK_MESSAGE_KIND,
  isDomRule,
  parseCheckReply,
  type DomRule,
  type DomRunner,
} from "@/lib/ide/web/checks";
import { ideWebDict } from "@/i18n/parts/ide-web";
import { IDE_REGISTRY } from "@/components/ide/registry";

// Правила структуры считает скрипт-проверщик; в браузере он работает в iframe, а в тестах — на DOM из happy-dom.
const evalCore = new Function("doc", "rules", `${CHECKER_CORE}\nreturn ideEval(doc, rules);`) as (doc: unknown, rules: unknown[]) => boolean[];

function parse(html: string) {
  const win = new Window();
  return new win.DOMParser().parseFromString(html, "text/html");
}

/** Подставной «iframe»: тот же проверщик на разобранном happy-dom документе. */
const happyRunner: DomRunner = async (code, rules) => evalCore(parse(code), rules);

describe("css: нормализация", () => {
  it("селектор: регистр, пробелы, комбинаторы, запятые", () => {
    expect(normalizeSelector("  H1  ")).toBe("h1");
    expect(normalizeSelector("ul>li")).toBe("ul > li");
    expect(normalizeSelector("ul   >   LI")).toBe("ul > li");
    expect(normalizeSelector("h1,H2 ,p")).toBe("h1, h2, p");
    expect(normalizeSelector("a[title~=x]")).toBe("a[title~=x]");
    expect(normalizeSelector("li:nth-child(2n+1)")).toBe("li:nth-child(2n+1)");
  });
  it("значение: регистр, пробелы, !important", () => {
    expect(normalizeValue("  Blue  !IMPORTANT ")).toBe("blue");
    expect(normalizeValue("rgb( 255 , 0 , 0 )")).toBe("rgb(255,0,0)");
    expect(normalizeValue("1px   solid  red;")).toBe("1px solid red");
  });
  it("цвета: имя, #rgb, #rrggbb, rgb() — одно и то же", () => {
    expect(colorKey("RED")).toBe("#ff0000");
    expect(colorKey("#F00")).toBe("#ff0000");
    expect(colorKey("#ff0000")).toBe("#ff0000");
    expect(colorKey("rgb(255, 0, 0)")).toBe("#ff0000");
    expect(colorKey("10px")).toBe("10px");
  });
});

describe("css: разбор", () => {
  it("селектор → свойства, без учёта регистра и пробелов", () => {
    const s = parseCss("H1 {  COLOR :  Blue ;font-size:20PX }\n.note{background-color:yellow}");
    expect(hasCssRule(s, "h1", "color", "blue")).toBe(true);
    expect(hasCssRule(s, " H1 ", "Color", "BLUE")).toBe(true);
    expect(hasCssRule(s, "h1", "font-size", "20px")).toBe(true);
    expect(hasCssRule(s, "h1", "color")).toBe(true);
    expect(hasCssRule(s, "h1", "color", "red")).toBe(false);
    expect(hasCssRule(s, "h2", "color")).toBe(false);
    expect(hasCssRule(s, ".note", "background-color", "yellow")).toBe(true);
  });
  it("комментарии, списки селекторов, повторы (последнее побеждает)", () => {
    const s = parseCss("/* h1 { color: red } */ h1, h2 { color: red } h1 { color: green; }");
    expect(hasCssRule(s, "h1", "color", "green")).toBe(true);
    expect(hasCssRule(s, "h1", "color", "red")).toBe(false);
    expect(hasCssRule(s, "h2", "color", "red")).toBe(true);
  });
  it("цвет по смыслу: red = #f00 = rgb()", () => {
    const s = parseCss("p { color: #F00 } a { color: rgb(0, 0, 255) }");
    expect(hasCssRule(s, "p", "color", "red")).toBe(true);
    expect(hasCssRule(s, "a", "color", "blue")).toBe(true);
    expect(hasCssRule(s, "a", "color", "red")).toBe(false);
  });
  it("background-color находится и в сокращённом background", () => {
    const s = parseCss(".a { background: yellow url(x.png) no-repeat } .b { background: #ff0 }");
    expect(hasCssRule(s, ".a", "background-color", "yellow")).toBe(true);
    expect(hasCssRule(s, ".b", "background-color", "yellow")).toBe(true);
    expect(hasCssRule(s, ".b", "background-color", "red")).toBe(false);
  });
  it("@media разворачивается, @keyframes и @import пропускаются", () => {
    const s = parseCss('@import url("x.css"); @keyframes k { from { color: red } } @media (min-width: 1px) { p { color: red } } h1 { color: blue }');
    expect(hasCssRule(s, "p", "color", "red")).toBe(true);
    expect(hasCssRule(s, "from", "color")).toBe(false);
    expect(hasCssRule(s, "h1", "color", "blue")).toBe(true);
  });
  it("точка с запятой внутри url(...) не рвёт объявление", () => {
    const s = parseCss('p { background: url("data:image/png;base64,AAA") ; color: red }');
    expect(hasCssRule(s, "p", "color", "red")).toBe(true);
  });
  it("мусор и незакрытые скобки не ломают разбор", () => {
    expect(() => parseCss("h1 { color: red")).not.toThrow();
    expect(hasCssRule(parseCss("h1 { color: red"), "h1", "color", "red")).toBe(true);
    expect(() => parseCss("}}{{ ;;; @")).not.toThrow();
    expect(hasCssRule(parseCss("__proto__ { color: red }"), "__proto__", "color", "red")).toBe(true);
  });
  it("extractStyleText: все блоки <style>, регистр тега не важен", () => {
    const html = "<STYLE>h1{color:red}</STYLE><p></p><style media=screen>p{color:blue}</style>";
    expect(extractStyleText(html)).toContain("h1{color:red}");
    expect(hasCssRule(sheetFromHtml(html), "p", "color", "blue")).toBe(true);
    expect(extractStyleText("<p>нет стилей</p>")).toBe("");
  });
});

describe("проверщик структуры (на DOM из happy-dom)", () => {
  const doc = parse('<body><h1> My  SITE </h1><ul><li>A</li><li>B</li></ul><a href="X.html" class="l">Go</a><img src="a.png" alt=" "><img src="b.png"></body>');
  const run = (rules: DomRule[]) => evalCore(doc, rules);

  it("exists: count — ровно, min — не меньше, по умолчанию хотя бы один", () => {
    const why = { ru: "", kk: "" };
    expect(run([{ type: "exists", selector: "li", count: 2, why }])).toEqual([true]);
    expect(run([{ type: "exists", selector: "li", count: 3, why }])).toEqual([false]);
    expect(run([{ type: "exists", selector: "li", min: 2, why }])).toEqual([true]);
    expect(run([{ type: "exists", selector: "li", min: 3, why }])).toEqual([false]);
    expect(run([{ type: "exists", selector: "h1", why }])).toEqual([true]);
    expect(run([{ type: "exists", selector: "table", why }])).toEqual([false]);
    expect(run([{ type: "exists", selector: "li", count: 2, min: 3, why }])).toEqual([false]);
  });
  it("text: без учёта регистра, лишних пробелов; проверяется любой подходящий элемент", () => {
    const why = { ru: "", kk: "" };
    expect(run([{ type: "text", selector: "h1", equals: "my site", why }])).toEqual([true]);
    expect(run([{ type: "text", selector: "li", equals: "b", why }])).toEqual([true]);
    expect(run([{ type: "text", selector: "li", equals: "c", why }])).toEqual([false]);
    expect(run([{ type: "text", selector: "h2", equals: "x", why }])).toEqual([false]);
  });
  it("attr: значение без регистра; без equals — атрибут не пустой", () => {
    const why = { ru: "", kk: "" };
    expect(run([{ type: "attr", selector: "a", name: "href", equals: "x.html", why }])).toEqual([true]);
    expect(run([{ type: "attr", selector: "a", name: "href", why }])).toEqual([true]);
    expect(run([{ type: "attr", selector: "a", name: "target", why }])).toEqual([false]);
    expect(run([{ type: "attr", selector: "img", name: "src", why }])).toEqual([true]);
    expect(run([{ type: "attr", selector: "img", name: "alt", why }])).toEqual([false]); // alt=" " — пусто
  });
  it("неверный селектор не ломает проверку, а даёт «нет»", () => {
    expect(run([{ type: "exists", selector: "h1[[", why: { ru: "", kk: "" } }])).toEqual([false]);
  });
});

describe("checkWeb", () => {
  const why = (s: string) => ({ ru: `ru:${s}`, kk: `kk:${s}` });
  const check = {
    kind: "web" as const,
    rules: [
      { type: "exists" as const, selector: "h1", count: 1, why: why("h1") },
      { type: "css" as const, selector: "h1", property: "color", equals: "red", why: why("css") },
      { type: "text" as const, selector: "h1", equals: "Hi", why: why("text") },
    ],
  };

  it("все правила выполнены", async () => {
    const r = await checkWeb(check, "<style>h1{color:red}</style><h1>Hi</h1>", happyRunner);
    expect(r).toEqual({ ok: true, passed: 3, total: 3 });
  });
  it("непройденное правило: считает пройденные, сообщение — why первого провала по порядку", async () => {
    const r = await checkWeb(check, "<h1>Hello</h1>", happyRunner);
    expect(r.ok).toBe(false);
    expect(r.passed).toBe(1);
    expect(r.total).toBe(3);
    expect(r.message).toEqual(why("css"));
  });
  it("DOM-правила уходят в iframe одним пакетом, CSS — нет", async () => {
    const seen: DomRule[][] = [];
    await checkWeb(check, "<h1>Hi</h1>", async (_c, rules) => {
      seen.push(rules);
      return rules.map(() => true);
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].map((r) => r.type)).toEqual(["exists", "text"]);
    expect(seen[0].every(isDomRule)).toBe(true);
  });
  it("только CSS-правила — iframe не запускается", async () => {
    let calls = 0;
    const r = await checkWeb({ kind: "web", rules: [{ type: "css", selector: "p", property: "color", why: why("c") }] }, "<style>p{color:red}</style>", async () => {
      calls++;
      return [];
    });
    expect(calls).toBe(0);
    expect(r.ok).toBe(true);
  });
  it("нет ответа от iframe — отдельное сообщение, не «почему» правила", async () => {
    const r = await checkWeb(check, "<style>h1{color:red}</style><h1>Hi</h1>", async () => null);
    expect(r.ok).toBe(false);
    expect(r.passed).toBe(1);
    expect((r.message as { ru: string }).ru).toContain("Не удалось проверить страницу");
    expect((r.message as { kk: string }).kk).toContain("Бетті тексеру");
  });
  it("пустой код не проверяется", async () => {
    let calls = 0;
    const r = await checkWeb(check, "  \n", async () => {
      calls++;
      return [];
    });
    expect(calls).toBe(0);
    expect(r.ok).toBe(false);
    expect(r.passed).toBe(0);
  });
});

describe("связь с iframe: postMessage и nonce", () => {
  const rules: DomRule[] = [
    { type: "exists", selector: "h1", count: 1, why: { ru: "", kk: "" } },
    { type: "text", selector: "h1", equals: "x", why: { ru: "", kk: "" } },
  ];
  const nonce = "abc123";

  it("parseCheckReply принимает только ответ с верными kind, nonce и длиной", () => {
    const ok = { kind: CHECK_MESSAGE_KIND, nonce, results: [true, false] };
    expect(parseCheckReply(ok, nonce, 2)).toEqual([true, false]);
    expect(parseCheckReply({ ...ok, nonce: "other" }, nonce, 2)).toBeNull();
    expect(parseCheckReply({ ...ok, kind: "x" }, nonce, 2)).toBeNull();
    expect(parseCheckReply({ ...ok, results: [true] }, nonce, 2)).toBeNull();
    expect(parseCheckReply({ ...ok, results: null }, nonce, 2)).toBeNull();
    expect(parseCheckReply("текст", nonce, 2)).toBeNull();
    expect(parseCheckReply(null, nonce, 2)).toBeNull();
  });
  it("не булевы значения в ответе считаются «нет»", () => {
    expect(parseCheckReply({ kind: CHECK_MESSAGE_KIND, nonce, results: ["true", 1] }, nonce, 2)).toEqual([false, false]);
  });

  it("скрипт проверщика считает правила и шлёт родителю результат с nonce", async () => {
    const doc = parse("<h1>x</h1>");
    const sent: { data: unknown; target: string }[] = [];
    const parent = { postMessage: (data: unknown, target: string) => sent.push({ data, target }) };
    const fakeDoc = { readyState: "complete", querySelectorAll: (q: string) => doc.querySelectorAll(q) };
    new Function("document", "parent", "setTimeout", buildCheckerScript(nonce, rules))(fakeDoc, parent, (fn: () => void) => fn());
    expect(sent).toHaveLength(1);
    expect(parseCheckReply(sent[0].data, nonce, 2)).toEqual([true, true]);
    expect(sent[0].target).toBe("*"); // у sandbox-iframe «пустое» происхождение — другого адреса нет
  });
  it("скрипт ждёт DOMContentLoaded, пока страница разбирается", () => {
    const doc = parse("<h1>x</h1>");
    const listeners: Record<string, () => void> = {};
    const sent: unknown[] = [];
    const fakeDoc = { readyState: "loading", querySelectorAll: (q: string) => doc.querySelectorAll(q), addEventListener: (n: string, f: () => void) => (listeners[n] = f) };
    new Function("document", "parent", "setTimeout", buildCheckerScript(nonce, rules))(fakeDoc, { postMessage: (d: unknown) => sent.push(d) }, (fn: () => void) => fn());
    expect(sent).toHaveLength(0);
    listeners.DOMContentLoaded();
    expect(sent).toHaveLength(1);
  });
  it("в скрипт не попадают тексты why, а «</script>» в правилах не закрывает тег", () => {
    const evil: DomRule[] = [{ type: "text", selector: "p", equals: "</script><b> ", why: { ru: "СЕКРЕТНОЕ", kk: "x" } }];
    const script = buildCheckerScript(nonce, evil);
    expect(script).not.toContain("СЕКРЕТНОЕ");
    expect(script).not.toContain("</script>");
    expect(script).not.toContain(" ");
  });

  it("документ проверки: проверщик стоит перед кодом ученика, doctype один", () => {
    const doc = buildCheckDoc("<!DOCTYPE html>\n<html><body><h1>x</h1><!-- не закрыто", nonce, rules);
    expect(doc.startsWith("<!doctype html><meta http-equiv=\"Content-Security-Policy\"")).toBe(true);
    expect(doc).toContain(`script-src 'nonce-${nonce}'`);
    expect(doc).toContain(`<script nonce="${nonce}">`);
    expect(doc.toLowerCase().match(/<!doctype/g)).toHaveLength(1);
    expect(doc.indexOf("</script>")).toBeLessThan(doc.indexOf("<html>"));
    expect(doc).toContain(nonce);
  });
  it("документ предпросмотра: свой doctype и код ученика без изменений", () => {
    const base = '<!doctype html><base target="_blank">';
    expect(buildPreviewDoc("<h1>x</h1>")).toBe(`${base}<h1>x</h1>`);
    expect(buildPreviewDoc("  <!DOCTYPE html><h1>x</h1>")).toBe(`${base}<h1>x</h1>`);
    expect(buildPreviewDoc("<h1>x</h1>")).not.toContain("<script");
  });
  it("предпросмотр: скрипты ученика закрыты CSP, пока ученик не нажал «Запустить»", () => {
    const code = "<h1>x</h1><script>while(true){}</script>";
    expect(buildPreviewDoc(code)).toContain("script-src 'none'");
    expect(buildPreviewDoc(code, true)).not.toContain("Content-Security-Policy");
  });
  it("ссылка: слэш в конце href не мешает; !important и комментарии в CSS", async () => {
    const withSlash = "<a href=\"https://example.com/\">Open</a>";
    const win = new Window();
    win.document.write(withSlash);
    const doc = win.document;
    expect(new Function(`${CHECKER_CORE}; return ideEval;`)()(doc, [{ type: "attr", selector: "a", name: "href", equals: "https://example.com" }])).toEqual([true]);
    expect(hasCssRule(sheetFromHtml("<style>h1{color:blue !important} h1{color:red}</style>"), "h1", "color", "blue")).toBe(true);
    expect(hasCssRule(sheetFromHtml("<!-- <style>h1{color:blue}</style> -->"), "h1", "color", "blue")).toBe(false);
  });
});

describe("изоляция iframe (по исходникам)", () => {
  const files = ["src/components/ide/web/Workspace.tsx", "src/lib/ide/web/runner.ts"];
  it("sandbox=allow-scripts, без allow-same-origin", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toMatch(/sandbox[=",\s(]+"?allow-scripts"/);
      expect(src.replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, ""), f).not.toContain("allow-same-origin");
    }
  });
  it("приём сообщений: источник — наше окно и nonce", () => {
    const src = readFileSync("src/lib/ide/web/runner.ts", "utf8");
    expect(src).toContain("ev.source !== frame.contentWindow");
    expect(src).toContain("parseCheckReply(ev.data, nonce");
  });
});

describe("задачи HTML/CSS", () => {
  it("14 задач, id уникальны, уровни растут A→C", () => {
    expect(TASKS).toHaveLength(14);
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length);
    const levels = TASKS.map((t) => t.level);
    expect(levels).toEqual([...levels].sort());
    expect(levels[0]).toBe(1);
    expect(levels[levels.length - 1]).toBe(3);
  });
  it("двуязычные тексты, навыки web.*, проверка web, у каждого правила есть why", () => {
    for (const task of TASKS) {
      expect(task.lang, task.id).toBe("web");
      expect(task.skill, task.id).toMatch(/^web\.(html|css|content|tables|layout)$/);
      for (const f of [task.title, task.prompt, task.hint!]) {
        expect(f?.ru?.trim(), task.id).toBeTruthy();
        expect(f?.kk?.trim(), task.id).toBeTruthy();
      }
      expect(task.starter.trim(), task.id).toBeTruthy();
      expect(task.solution.trim(), task.id).toBeTruthy();
      expect(task.check.kind, task.id).toBe("web");
      if (task.check.kind === "web") {
        expect(task.check.rules.length, task.id).toBeGreaterThanOrEqual(2);
        for (const rule of task.check.rules) {
          expect(rule.why.ru.trim(), task.id).toBeTruthy();
          expect(rule.why.kk.trim(), task.id).toBeTruthy();
        }
      }
    }
  });
  it("навыки: задачи про CSS — web.css или web.layout, остальные — web.html, web.content или web.tables", () => {
    for (const task of TASKS) {
      if (task.check.kind !== "web") continue;
      const hasCss = task.check.rules.some((r) => r.type === "css");
      expect(task.skill, task.id).toMatch(hasCss ? /^web\.(css|layout)$/ : /^web\.(html|content|tables)$/);
    }
  });
  it("курс 2.0: по 2 задачи на уровень среди новых, все три новых навыка представлены", () => {
    const v2 = TASKS.filter((t) => Number(t.id.split("-")[1]) >= 9);
    expect(v2).toHaveLength(6);
    expect([1, 2, 3].map((lv) => v2.filter((t) => t.level === lv).length)).toEqual([2, 2, 2]);
    expect(new Set(v2.map((t) => t.skill))).toEqual(new Set(["web.content", "web.tables", "web.layout"]));
  });
  it("в казахских текстах нет эмодзи, латинской «i» внутри кириллицы и «бинарлы»", () => {
    const all = TASKS.map((t) => `${t.title.kk} ${t.prompt.kk} ${t.hint?.kk} ${t.check.kind === "web" ? t.check.rules.map((r) => r.why.kk).join(" ") : ""}`).join(" ");
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/\p{Script=Cyrillic}i|i\p{Script=Cyrillic}/u);
    expect(all).not.toContain("бинар");
  });
  it("реестр подхватывает задачи", () => {
    expect(IDE_REGISTRY.web.tasks).toBe(TASKS);
  });

  for (const task of TASKS) {
    if (task.check.kind !== "web") continue;
    const check = task.check;
    it(`${task.id}: эталон проходит все проверки`, async () => {
      const r = await checkWeb(check, task.solution, happyRunner);
      expect(r, task.id).toEqual({ ok: true, passed: check.rules.length, total: check.rules.length });
    });
    it(`${task.id}: начальный код не засчитывается`, async () => {
      const r = await checkWeb(check, task.starter, happyRunner);
      expect(r.ok, task.id).toBe(false);
      expect(r.passed, task.id).toBeLessThan(r.total);
    });
  }

  it("типичные альтернативные решения тоже принимаются", async () => {
    const byId = (id: string) => {
      const t = TASKS.find((x) => x.id === id)!;
      if (t.check.kind !== "web") throw new Error("не web");
      return t.check;
    };
    const go = (id: string, code: string) => checkWeb(byId(id), code, happyRunner);
    expect((await go("web-1-h1", "<h1>my site</h1>")).ok).toBe(true);
    expect((await go("web-2-text", "<p>I study <strong>informatics</strong></p>")).ok).toBe(true);
    expect((await go("web-3-list", "<UL><LI>Python<LI>SQL<LI>HTML</UL>")).ok).toBe(true);
    expect((await go("web-6-table", "<table><tbody><tr><td>1<td>2<tr><td>3<td>4</table>")).ok).toBe(true);
    expect((await go("web-7-color", "<style>H1{color:#00F}</style><h1>x</h1>")).ok).toBe(true);
    expect((await go("web-8-class", '<style>.note{background:yellow;padding:4px}</style><p class="note">x</p>')).ok).toBe(true);
    expect((await go("web-9-ol", "<H2>steps</H2><OL><LI>Open<LI>Write<LI>Save</OL>")).ok).toBe(true);
    expect((await go("web-10-links", '<a target="_blank" href="https://nct.kz/">NCT</a><a href="contacts.html">Contacts</a>')).ok).toBe(true);
    expect((await go("web-11-colspan", '<table><tbody><tr><th colspan=2>Results<tr><td>Math<td>Info</table>')).ok).toBe(true);
    expect((await go("web-12-form", '<form><input id="name" type="text"><label for="name">Name</label><button type="submit">Send</button></form>')).ok).toBe(true);
    expect((await go("web-13-align", "<style>h1{text-align:CENTER}p{color:green}</style><h1>x</h1><p>y</p>")).ok).toBe(true);
    expect((await go("web-13-align", "<style>h1{text-align:center}p{color:rgb(0,128,0)}</style><h1>x</h1><p>y</p>")).ok).toBe(true);
    expect((await go("web-14-box", '<style>.card{width:300px;padding:20px;border:2px dashed red;margin:0 auto}</style><div class="card"><p>x</p></div>')).ok).toBe(true);
  });
  it("типичные ошибки не принимаются", async () => {
    const byId = (id: string) => {
      const t = TASKS.find((x) => x.id === id)!;
      if (t.check.kind !== "web") throw new Error("не web");
      return t.check;
    };
    const go = (id: string, code: string) => checkWeb(byId(id), code, happyRunner);
    expect((await go("web-1-h1", "<h2>My site</h2>")).ok).toBe(false);
    expect((await go("web-1-h1", "<h1>My site</h1><h1>Again</h1>")).ok).toBe(false);
    expect((await go("web-3-list", "<ul><li>Python</li><li>SQL</li></ul>")).ok).toBe(false);
    expect((await go("web-3-list", "<ol><li>Python</li><li>SQL</li><li>HTML</li></ol>")).ok).toBe(false);
    expect((await go("web-5-img", '<img src="cat.jpg">')).ok).toBe(false);
    expect((await go("web-6-table", "<table><tr><td>1</td></tr><tr><td>2</td></tr></table>")).ok).toBe(false);
    expect((await go("web-7-color", "<style>h1{color:red}</style><h1>x</h1>")).ok).toBe(false);
    expect((await go("web-8-class", '<style>.note{background-color:yellow}</style><p class="note">x</p>')).ok).toBe(false);
    expect((await go("web-9-ol", "<h2>Steps</h2><ul><li>Open</li><li>Write</li><li>Save</li></ul>")).ok).toBe(false);
    expect((await go("web-10-links", '<a href="https://nct.kz">NCT</a><a href="contacts.html">Contacts</a>')).ok).toBe(false);
    expect((await go("web-11-colspan", "<table><tr><td>Results</td></tr><tr><td>Math</td><td>Info</td></tr></table>")).ok).toBe(false);
    expect((await go("web-12-form", '<form><label>Name</label><input type="text"><button>Send</button></form>')).ok).toBe(false);
    expect((await go("web-14-box", '<style>.card{width:300px;padding:20px;border:1px solid black}</style><div class="card"><p>x</p></div>')).ok).toBe(false);
  });
});

describe("словарь ideweb.*", () => {
  const entries = Object.entries(ideWebDict);
  it("все ключи с префиксом ideweb., оба языка заполнены", () => {
    expect(entries.length).toBeGreaterThan(10);
    for (const [key, v] of entries) {
      expect(key.startsWith("ideweb."), key).toBe(true);
      expect(v.ru.trim(), key).toBeTruthy();
      expect(v.kk.trim(), key).toBeTruthy();
    }
  });
  it("плейсхолдеры одинаковы в ru и kk, после плейсхолдера нет казахского окончания", () => {
    for (const [key, v] of entries) {
      const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(ph(v.kk), key).toEqual(ph(v.ru));
      expect(v.kk, key).not.toMatch(/\}[а-яәіңғүұқөһ]/i);
    }
  });
  it("нет эмодзи и «бинарлы»", () => {
    const all = entries.map(([, v]) => v.kk).join(" ");
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toContain("бинар");
  });
});
