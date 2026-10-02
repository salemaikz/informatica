"use client";

import type { Scene } from "@/lib/types";
import { cn } from "@/lib/cn";

// ВРЕМЕННАЯ заглушка: настоящие сцены рисует исполнитель этапа 2 (см. docs/PLAN.md).
/** Рисует параметризованную сцену (двоичная запись, лесенка, лампочки, монеты, квест). */
export function SceneView({ scene, className }: { scene: Scene; className?: string }) {
  return (
    <div className={cn("rounded-3xl bg-surface-2 p-4 text-center font-mono text-sm text-muted", className)} data-scene={scene.kind}>
      {scene.kind}
    </div>
  );
}
