"use client";

import { useMemo } from "react";
import { Archive, File, FileCode, FileText, Folder, FolderOpen, HardDrive, Image, Music, Video, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import type { Scene } from "@/lib/types";
import { flattenTree, normalizePath, pathState, windowsPath, type FileKind } from "./files";

type FilesData = Extract<Scene, { kind: "files" }>;

const KIND_ICON: Record<FileKind, LucideIcon> = {
  doc: FileText,
  image: Image,
  music: Music,
  video: Video,
  code: FileCode,
  archive: Archive,
  generic: File,
};

/** Ширина одного уровня вложенности, px. */
const INDENT = 20;

/**
 * Дерево папок: отступы и направляющие линии, иконки папок и файлов (по расширению), выделенный путь —
 * цель в primary, папки на пути — мягче. Под деревом — путь в стиле Windows.
 */
export function FilesScene({ scene }: { scene: FilesData }) {
  const { t } = useT();
  const rows = useMemo(() => flattenTree(scene.tree), [scene.tree]);
  const active = normalizePath(scene.active);

  return (
    <div className="mx-auto w-full max-w-md">
      <div role="img" aria-label={scene.active ? `${t("basics.files.aria")}. ${t("basics.files.selected", { path: windowsPath(scene.active) })}` : t("basics.files.aria")} className="rounded-2xl border border-border bg-surface p-2">
        {/* корень — диск C: */}
        <div aria-hidden="true" className="flex h-8 items-center gap-2 px-1.5 text-sm font-extrabold text-text">
          <HardDrive className="size-[18px] shrink-0 text-muted" strokeWidth={2} aria-hidden="true" />
          {t("basics.files.disk")}
        </div>
        {rows.map((r) => {
          const state = pathState(r.path, active);
          const on = state === "active";
          const trail = state === "ancestor";
          const Icon = r.isFolder ? (on || trail ? FolderOpen : Folder) : KIND_ICON[r.kind];
          return (
            <div
              key={r.path}
              aria-hidden="true"
              className={cn("flex h-8 items-stretch rounded-lg text-sm", on && "bg-primary-soft ring-2 ring-primary")}
            >
              {/* направляющие вложенности */}
              {Array.from({ length: r.depth + 1 }, (_, d) => (
                <span key={d} aria-hidden="true" className="shrink-0 border-l border-border" style={{ width: INDENT, marginLeft: d === 0 ? 9 : 0 }} />
              ))}
              <span className="flex min-w-0 items-center gap-2 pr-2">
                <Icon
                  className={cn("size-[18px] shrink-0", on || trail || r.isFolder ? "text-ink-primary" : "text-muted")}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span className={cn("truncate", on ? "font-extrabold text-ink-primary" : trail ? "font-bold text-text" : r.isFolder ? "font-bold text-text" : "font-semibold text-text")}>
                  {r.name}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {scene.active && (
        <div className="mt-3 rounded-2xl bg-surface px-3 py-2.5 ring-1 ring-border">
          <div className="text-xs font-bold text-muted">{t("basics.files.path")}</div>
          <div className="mt-0.5 break-all font-mono text-sm font-bold leading-snug text-text">{windowsPath(scene.active)}</div>
        </div>
      )}
    </div>
  );
}
