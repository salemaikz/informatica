"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Code, Eye, Loader2, Play, SquareCheckBig } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { WorkspaceProps } from "@/lib/ide/types";
import { buildPreviewDoc, checkWeb, hasScripts } from "@/lib/ide/web/checks";
import { runDomRules } from "@/lib/ide/web/runner";

// Рабочая область HTML/CSS: редактор + живой предпросмотр в изолированном iframe.
// На телефоне — переключатель «Код / Страница», на десктопе — рядом. Проверка структуры — скрипт в отдельном скрытом iframe
// (runner.ts), CSS — разбор <style>; всё в браузере, без сервера.

type Tab = "code" | "page";

/** Пауза после последнего нажатия клавиши до обновления страницы, мс. */
const PREVIEW_DELAY_MS = 300;

export function Workspace({ task, code, onCodeChange, onCheck, beforeRun }: WorkspaceProps) {
  const { t } = useT();
  const webCheck = task?.check.kind === "web" ? task.check : null;
  const [tab, setTab] = useState<Tab>("code");
  const [checking, setChecking] = useState(false);

  // Страница обновляется с задержкой, чтобы не перезагружать iframe на каждую букву.
  const [previewCode, setPreviewCode] = useState(code);
  useEffect(() => {
    const id = setTimeout(() => setPreviewCode(code), PREVIEW_DELAY_MS);
    return () => clearTimeout(id);
  }, [code]);
  // Скрипты ученика запускаются только по кнопке и только для этой версии кода (правка — снова выключено).
  const [scriptsFor, setScriptsFor] = useState<string | null>(null);
  const scriptsOn = scriptsFor === previewCode;
  const needsRun = hasScripts(previewCode) && !scriptsOn;
  const srcDoc = useMemo(() => buildPreviewDoc(previewCode, scriptsOn), [previewCode, scriptsOn]);
  // Ключ: «Запустить скрипты» перезагружает страницу, даже если код не менялся.
  const [runKey, setRunKey] = useState(0);
  function runScripts() {
    if (beforeRun && !beforeRun()) return;
    setPreviewCode(code);
    setScriptsFor(code);
    setRunKey((k) => k + 1);
  }

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function check() {
    if (!webCheck || checking) return;
    if (beforeRun && !beforeRun()) return;
    setChecking(true);
    const res = await checkWeb(webCheck, code, runDomRules);
    if (!mounted.current) return;
    setChecking(false);
    onCheck(res);
  }

  const tabs: { id: Tab; icon: typeof Code; label: string }[] = [
    { id: "code", icon: Code, label: t("ideweb.tab.code") },
    { id: "page", icon: Eye, label: t("ideweb.tab.page") },
  ];

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label={t("ideweb.tabs.aria")} className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1 lg:hidden">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`ideweb-tab-${id}`}
            aria-controls={`ideweb-panel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next: Tab = id === "code" ? "page" : "code";
                setTab(next);
                document.getElementById(`ideweb-tab-${next}`)?.focus();
              }
            }}
            onClick={() => setTab(id)}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-extrabold transition-colors",
              "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
              tab === id ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-text",
            )}
          >
            <Icon size={18} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div role="tabpanel" id="ideweb-panel-code" aria-labelledby="ideweb-tab-code" className={cn("min-w-0", tab !== "code" && "hidden lg:block")}>
          <CodeEditor value={code} onChange={onCodeChange} language="html" ariaLabel={t("ideweb.editor.aria")} minHeight={320} />
        </div>

        <section role="tabpanel" id="ideweb-panel-page" aria-labelledby="ideweb-tab-page" className={cn("min-w-0 space-y-2", tab !== "page" && "hidden lg:block")}>
          <h3 className="hidden text-xs font-extrabold uppercase tracking-wide text-muted lg:block">{t("ideweb.preview.title")}</h3>
          {/* Изоляция: sandbox="allow-scripts" БЕЗ allow-same-origin — у страницы пустое происхождение, доступа к приложению нет.
              Белый фон — как у «листа» браузера: страница ученика рисуется независимо от темы приложения. */}
          <iframe
            key={runKey}
            title={t("ideweb.preview.aria")}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            srcDoc={srcDoc}
            className="h-80 w-full rounded-2xl border-2 border-border lg:h-[26rem]"
            style={{ background: "#fff" }}
          />
          {needsRun && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-strong">
              <p className="min-w-0 flex-1 font-semibold">{t("ideweb.preview.scripts")}</p>
              <Button variant="secondary" size="sm" onClick={runScripts} icon={<Play size={16} aria-hidden />}>
                {t("ideweb.preview.runScripts")}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted">
            {t("ideweb.preview.live")} {t("ideweb.preview.note")}
          </p>
        </section>
      </div>

      {webCheck && (
        <Button
          variant="success"
          size="lg"
          block
          disabled={checking}
          onClick={check}
          icon={checking ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <SquareCheckBig size={20} aria-hidden />}
        >
          {checking ? t("ideweb.checking") : t("ideweb.check")}
        </Button>
      )}
    </div>
  );
}
