"use client";

import type { Scene } from "@/lib/types";

type WaveSceneData = Extract<Scene, { kind: "wave" }>;

/** Заготовка (этап 16Б, волна 3): рисунок делает исполнитель по ТЗ docs/specs/stage16b-wave3-scenes.md. */
export function WaveScene({ scene }: { scene: WaveSceneData }) {
  return <div data-stub={scene.kind} className="h-16" aria-hidden="true" />;
}
