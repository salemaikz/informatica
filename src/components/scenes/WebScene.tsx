"use client";

import { useState } from "react";
import type { Scene } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { CodeBlock } from "./CodeScene";
import { buildWebDoc, webFrameHeight, webHtml } from "./web";

type WebScene = Extract<Scene, { kind: "web" }>;

/** Подпись над панелью. */
function PanelTitle({ children }: { children: string }) {
  return <div className="mb-1 text-[13px] font-extrabold text-muted">{children}</div>;
}

/** HTML-код и его вид в «браузере»: iframe без скриптов (sandbox пустой), высота по размеру разметки. */
export function WebScene({ scene }: { scene: WebScene }) {
  const { t, lang } = useT();
  const html = webHtml(scene, lang);
  const doc = buildWebDoc(html, scene.css);
  // Документ, который iframe уже отрисовал (событие load): пока он не отрисован, под iframe видна подложка.
  // Если load пришёл до гидратации (iframe попал в серверный HTML) и событие потеряно, подложка просто остаётся под белой страницей — она её закрывает.
  const [loadedDoc, setLoadedDoc] = useState<string | null>(null);
  const loaded = loadedDoc === doc;
  const htmlLines = html.split("\n");
  const cssLines = scene.css?.split("\n");
  const browser = (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-2.5 py-1.5">
        <span aria-hidden className="flex gap-1">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-0.5 font-mono text-[13px] text-muted">index.html</span>
      </div>
      {/* Подложка «страница загружается»: лежит под iframe и видна, пока документ не отрисован (или не отрисуется совсем):
          пустого окна браузера ученик не увидит. Страница в iframe белая и закрывает подложку целиком. */}
      <div className="relative bg-white" style={{ height: webFrameHeight(html) }}>
        {!loaded && (
          <div aria-hidden data-web-placeholder="" className="absolute inset-0 flex flex-col gap-2.5 p-3">
            <div className="h-5 w-2/5 rounded bg-muted/25" />
            <div className="h-3 w-3/5 rounded bg-muted/15" />
            <div className="h-3 w-1/2 rounded bg-muted/15" />
          </div>
        )}
        {/* sandbox="" — без allow-scripts: скрипты и обработчики в iframe не выполняются */}
        <iframe
          title={t("scene.browser")}
          sandbox=""
          srcDoc={doc}
          onLoad={() => setLoadedDoc(doc)}
          className="relative block size-full border-0 bg-transparent"
        />
      </div>
    </div>
  );
  if (scene.page) {
    // Только окно браузера на всю ширину, без панели кода.
    return <div className="mx-auto w-full max-w-xl">{browser}</div>;
  }
  return (
    <div className="mx-auto grid w-full max-w-xl gap-3 min-[560px]:max-w-3xl min-[560px]:grid-cols-2">
      <div className="min-w-0">
        <PanelTitle>{t("scene.code")}</PanelTitle>
        <div className="flex flex-col gap-2">
          <CodeBlock lines={htmlLines} lang="html" />
          {cssLines && (
            <div>
              <PanelTitle>{t("scene.css")}</PanelTitle>
              <CodeBlock lines={cssLines} lang="css" />
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <PanelTitle>{t("scene.browser")}</PanelTitle>
        {browser}
      </div>
    </div>
  );
}
