"use client";

import type { Scene } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { CodeBlock } from "./CodeScene";
import { buildWebDoc, webFrameHeight } from "./web";

type WebScene = Extract<Scene, { kind: "web" }>;

/** Подпись над панелью. */
function PanelTitle({ children }: { children: string }) {
  return <div className="mb-1 text-[13px] font-extrabold text-muted">{children}</div>;
}

/** HTML-код и его вид в «браузере»: iframe без скриптов (sandbox пустой), высота по размеру разметки. */
export function WebScene({ scene }: { scene: WebScene }) {
  const { t } = useT();
  const htmlLines = scene.html.split("\n");
  const cssLines = scene.css?.split("\n");
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
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-2.5 py-1.5">
            <span aria-hidden className="flex gap-1">
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
            </span>
            <span className="min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-0.5 font-mono text-[13px] text-muted">index.html</span>
          </div>
          {/* sandbox="" — без allow-scripts: скрипты и обработчики в iframe не выполняются */}
          <iframe
            title={t("scene.browser")}
            sandbox=""
            srcDoc={buildWebDoc(scene.html, scene.css)}
            className="block w-full border-0 bg-white"
            style={{ height: webFrameHeight(scene.html) }}
          />
        </div>
      </div>
    </div>
  );
}
