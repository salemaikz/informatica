"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Code, Eye, Loader2, SquareCheckBig } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { WorkspaceProps } from "@/lib/ide/types";
import { buildPreviewDoc, checkWeb } from "@/lib/ide/web/checks";
import { runDomRules } from "@/lib/ide/web/runner";

// Рабочая область HTML/CSS: редактор + живой предпросмотр в изолированном iframe.
// На телефоне — переключатель «Код / Страница», на десктопе — рядом. Проверка структуры — скрипт в отдельном скрытом iframe
// (runner.ts), CSS — разбор <style>; всё в браузере, без сервера.

type Tab = "code" | "page";

/** Пауза после последнего нажатия клавиши до обновления страницы, мс. */
const PREVIEW_DELAY_MS = 300;

export function Workspace({ task, code, onCodeChange, onCheck }: WorkspaceProps) {
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
  const srcDoc = useMemo(() => buildPreviewDoc(previewCode), [previewCode]);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function check() {
    if (!webCheck || checking) return;
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
            aria-selected={tab === id}
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
        <div className={cn("min-w-0", tab !== "code" && "hidden lg:block")}>
          <CodeEditor value={code} onChange={onCodeChange} language="html" ariaLabel={t("ideweb.editor.aria")} minHeight={320} />
        </div>

        <section aria-label={t("ideweb.preview.title")} className={cn("min-w-0 space-y-2", tab !== "page" && "hidden lg:block")}>
          <h3 className="hidden text-xs font-extrabold uppercase tracking-wide text-muted lg:block">{t("ideweb.preview.title")}</h3>
          {/* Изоляция: sandbox="allow-scripts" БЕЗ allow-same-origin — у страницы пустое происхождение, доступа к приложению нет.
              Белый фон — как у «листа» браузера: страница ученика рисуется независимо от темы приложения. */}
          <iframe
            title={t("ideweb.preview.aria")}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            srcDoc={srcDoc}
            className="h-80 w-full rounded-2xl border-2 border-border lg:h-[26rem]"
            style={{ background: "#fff" }}
          />
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
