"use client";

import type { Scene } from "@/lib/types";

type NumberlineSceneData = Extract<Scene, { kind: "numberline" }>;

/** Заготовка (этап 16Б, волна 3): рисунок делает исполнитель по ТЗ docs/specs/stage16b-wave3-scenes.md. */
export function NumberlineScene({ scene }: { scene: NumberlineSceneData }) {
  return <div data-stub={scene.kind} className="h-16" aria-hidden="true" />;
}
