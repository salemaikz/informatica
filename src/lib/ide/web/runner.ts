import { buildCheckDoc, DOM_CHECK_TIMEOUT_MS, parseCheckReply, randomNonce, type DomRule } from "./checks";

// Запуск проверщика структуры в скрытом изолированном iframe (только в браузере).
// sandbox="allow-scripts" без allow-same-origin: у страницы ученика «пустое» происхождение — она не видит ни приложение,
// ни его хранилище. Ответ — только postMessage: берём сообщение от нашего окна и с нашим nonce, остальные игнорируем.

/** Выполнить правила структуры на странице ученика. null — ответа нет (≤ 2 с) или проверка не запустилась. */
export function runDomRules(code: string, rules: DomRule[], timeoutMs: number = DOM_CHECK_TIMEOUT_MS): Promise<boolean[] | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }
    const nonce = randomNonce();
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.title = "check";
    frame.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;visibility:hidden;pointer-events:none";

    let done = false;
    const timer = setTimeout(() => finish(null), timeoutMs);
    const finish = (result: boolean[] | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      frame.remove();
      resolve(result);
    };
    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== frame.contentWindow) return;
      const results = parseCheckReply(ev.data, nonce, rules.length);
      if (results) finish(results);
    };

    window.addEventListener("message", onMessage);
    frame.srcdoc = buildCheckDoc(code, nonce, rules);
    document.body.appendChild(frame);
  });
}
