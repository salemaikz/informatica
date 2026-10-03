"use client";

import type { Scene } from "@/lib/types";

// ЗАГЛУШКА (v0.7): рисует исполнитель-художник по ТЗ docs/specs/basics.md. Пропсы не менять.
export function SizesScene({ scene }: { scene: Extract<Scene, { kind: "sizes" }> }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-4 text-center text-sm font-bold text-muted" data-stub="sizes">
      {scene.kind}
    </div>
  );
}
