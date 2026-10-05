"use client";

import type { Scene } from "@/lib/types";

type GraphSceneData = Extract<Scene, { kind: "graph" }>;

/** Заготовка (этап 16Б, волна 3): рисунок делает исполнитель по ТЗ docs/specs/stage16b-wave3-scenes.md. */
export function GraphScene({ scene }: { scene: GraphSceneData }) {
  return <div data-stub={scene.kind} className="h-16" aria-hidden="true" />;
}
