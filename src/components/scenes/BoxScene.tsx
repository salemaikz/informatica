"use client";

import type { Scene } from "@/lib/types";

type BoxSceneData = Extract<Scene, { kind: "box" }>;

/** Заготовка (этап 16Б, волна 3): рисунок делает исполнитель по ТЗ docs/specs/stage16b-wave3-scenes.md. */
export function BoxScene({ scene }: { scene: BoxSceneData }) {
  return <div data-stub={scene.kind} className="h-16" aria-hidden="true" />;
}
