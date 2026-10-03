"use client";

import type { Scene } from "@/lib/types";

// ЗАГЛУШКА (v0.7): рисует исполнитель-художник по ТЗ docs/specs/basics.md. Пропсы не менять.
export function HardwareScene({ scene }: { scene: Extract<Scene, { kind: "hardware" }> }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-4 text-center text-sm font-bold text-muted" data-stub="hardware">
      {scene.kind}
    </div>
  );
}
