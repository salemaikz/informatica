"use client";

import type { Scene } from "@/lib/types";

// ЗАГЛУШКА (v0.7): рисует исполнитель-художник по ТЗ docs/specs/basics.md. Пропсы не менять.
export function FilesScene({ scene }: { scene: Extract<Scene, { kind: "files" }> }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-4 text-center text-sm font-bold text-muted" data-stub="files">
      {scene.kind}
    </div>
  );
}
