import type { L } from "@/lib/types";
import type { CheckResult, IdeCheck, WebRule } from "../types";
import { hasCssRule, sheetFromHtml } from "./css";

// Проверка задач HTML/CSS (docs/specs/ide.md, I3).
// Правила структуры (exists / text / attr) проверяет скрипт-«проверщик» ВНУТРИ изолированного iframe
// (sandbox="allow-scripts", без allow-same-origin): страница ученика не видит приложение, а приложение — её DOM.
// Связь только через postMessage со случайным nonce; чужие сообщения игнорируются. CSS-правила — разбором текста <style>.

export type DomRule = Exclude<WebRule, { type: "css" }>;
export type WebCheck = Extract<IdeCheck, { kind: "web" }>;

export const isDomRule = (r: WebRule): r is DomRule => r.type !== "css";

/** Сколько ждём ответ проверщика из iframe, мс. */
export const DOM_CHECK_TIMEOUT_MS = 2000;

/** Метка сообщений проверщика (вместе с nonce отсекает чужие сообщения). */
export const CHECK_MESSAGE_KIND = "ide-web-check";

/**
 * Ядро проверщика — обычный JS (ES5) в строке, чтобы его можно было вставить в iframe и прогнать в тестах (happy-dom).
 * ideEval(document, rules) → массив true/false по правилам.
 */
export const CHECKER_CORE = String.raw`
function ideNorm(s) {
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase();
}
function ideEval(doc, rules) {
  var out = [];
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    var ok = false;
    try {
      var els = doc.querySelectorAll(r.selector);
      if (r.type === "exists") {
        var min = r.min != null ? r.min : (r.count != null ? 0 : 1);
        ok = (r.count == null || els.length === r.count) && els.length >= min;
      } else if (r.type === "text") {
        var want = ideNorm(r.equals);
        for (var a = 0; a < els.length; a++) if (ideNorm(els[a].textContent) === want) ok = true;
      } else if (r.type === "attr") {
        for (var b = 0; b < els.length; b++) {
          var el = els[b];
          if (!el.hasAttribute(r.name)) continue;
          var val = el.getAttribute(r.name);
          var nv = ideNorm(val).replace(/\/+$/, "");
          if (r.equals == null ? ideNorm(val) !== "" : nv === ideNorm(r.equals).replace(/\/+$/, "")) ok = true;
        }
      }
    } catch (e) {
      ok = false;
    }
    out.push(ok);
  }
  return out;
}
`;

/** JSON для вставки в <script>: «<» и разделители строк экранируются, чтобы нельзя было закрыть тег. */
const safeJson = (v: unknown) =>
  JSON.stringify(v).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);

/** Правила без поля why — в iframe уходит только то, что нужно проверщику. */
function stripRule(r: DomRule): Record<string, unknown> {
  const out: Record<string, unknown> = { type: r.type, selector: r.selector };
  if (r.type === "exists") {
    if (r.count !== undefined) out.count = r.count;
    if (r.min !== undefined) out.min = r.min;
  } else if (r.type === "text") out.equals = r.equals;
  else {
    out.name = r.name;
    if (r.equals !== undefined) out.equals = r.equals;
  }
  return out;
}

/** Скрипт проверщика: ждёт конца разбора страницы, считает правила и шлёт результат родителю. */
export function buildCheckerScript(nonce: string, rules: DomRule[]): string {
  return `(function(){var NONCE=${safeJson(nonce)};var RULES=${safeJson(rules.map(stripRule))};${CHECKER_CORE}
function go(){var res=null;try{res=ideEval(document,RULES);}catch(e){}
parent.postMessage({kind:${safeJson(CHECK_MESSAGE_KIND)},nonce:NONCE,results:res},"*");}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",function(){setTimeout(go,0);});}else{setTimeout(go,0);}
})();`;
}

/** Убрать <!DOCTYPE> в начале — мы ставим свой. */
const stripDoctype = (code: string) => code.replace(/^\s*<!doctype[^>]*>/i, "");

/** Есть ли в коде скрипты или обработчики событий — их автоматически не запускаем. */
export const hasScripts = (code: string) => /<script\b|\bon[a-z]+\s*=|javascript:/i.test(code);

/**
 * Документ для видимого предпросмотра. Ссылки открываются в новом контексте (в песочнице без allow-popups это просто блок),
 * поэтому предпросмотр не «уходит» на чужую страницу. Скрипты ученика по умолчанию запрещены CSP
 * (бесконечный цикл в iframe без отдельного процесса мог бы заморозить всё приложение); allowScripts — по явной кнопке.
 */
export const buildPreviewDoc = (code: string, allowScripts = false) =>
  `<!doctype html>${allowScripts || !hasScripts(code) ? "" : `<meta http-equiv="Content-Security-Policy" content="script-src 'none'">`}<base target="_blank">${stripDoctype(code)}`;

/**
 * Документ для проверки: CSP с nonce разрешает ТОЛЬКО скрипт проверщика — скрипты ученика не выполняются
 * (не могут зависнуть и подделать postMessage). Проверщик стоит ПЕРЕД кодом ученика — незакрытый тег или комментарий
 * в коде его не «проглотит». Скрипт попадает в <head> (парсер сам создаёт html/head), код ученика дополняет документ.
 */
export const buildCheckDoc = (code: string, nonce: string, rules: DomRule[]) =>
  `<!doctype html><meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${nonce}'"><script nonce="${nonce}">${buildCheckerScript(nonce, rules)}</script>${stripDoctype(code)}`;

/** Случайный nonce (в браузере — crypto.getRandomValues). */
export function randomNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Ответ проверщика, если он пришёл с нужным nonce и формой; иначе null (сообщение игнорируется). */
export function parseCheckReply(data: unknown, nonce: string, count: number): boolean[] | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { kind?: unknown; nonce?: unknown; results?: unknown };
  if (d.kind !== CHECK_MESSAGE_KIND || d.nonce !== nonce) return null;
  if (!Array.isArray(d.results) || d.results.length !== count) return null;
  return d.results.map((x) => x === true);
}

/** Запуск правил структуры в iframe (подставляется снаружи: runner.ts в браузере, happy-dom в тестах). null — нет ответа. */
export type DomRunner = (code: string, rules: DomRule[]) => Promise<boolean[] | null>;

export const MSG_EMPTY: L = { ru: "Сначала напишите код страницы.", kk: "Алдымен беттің кодын жазыңыз." };
export const MSG_NO_ANSWER: L = {
  ru: "Не удалось проверить страницу. Проверьте, что все теги и комментарии закрыты, и попробуйте ещё раз.",
  kk: "Бетті тексеру мүмкін болмады. Барлық тегтер мен түсіндірмелердің жабылғанын тексеріп, қайта көріңіз.",
};

/** Проверка задачи: правила по порядку; в сообщении — «почему» первого непройденного правила. */
export async function checkWeb(check: WebCheck, code: string, runDom: DomRunner): Promise<CheckResult> {
  const rules = check.rules;
  const total = rules.length;
  if (!code.trim()) return { ok: false, passed: 0, total, message: MSG_EMPTY };

  const sheet = sheetFromHtml(code);
  const domRules = rules.filter(isDomRule);
  const domResults = domRules.length > 0 ? await runDom(code, domRules) : [];

  let passed = 0;
  let first: WebRule | null = null;
  let domIndex = 0;
  for (const rule of rules) {
    let ok: boolean;
    if (rule.type === "css") ok = hasCssRule(sheet, rule.selector, rule.property, rule.equals);
    else {
      ok = domResults?.[domIndex] === true;
      domIndex++;
    }
    if (ok) passed++;
    else first ??= rule;
  }

  if (!first) return { ok: true, passed, total };
  // Нет ответа от iframe — честно говорим об этом, а не «почему» правила.
  if (domResults === null && isDomRule(first)) return { ok: false, passed, total, message: MSG_NO_ANSWER };
  return { ok: false, passed, total, message: first.why };
}
