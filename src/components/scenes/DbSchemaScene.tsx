"use client";

import type { Scene } from "@/lib/types";

type DbSchemaSceneData = Extract<Scene, { kind: "db-schema" }>;

/** Заготовка (этап 16Б, волна 3): рисунок делает исполнитель по ТЗ docs/specs/stage16b-wave3-scenes.md. */
export function DbSchemaScene({ scene }: { scene: DbSchemaSceneData }) {
  return <div data-stub={scene.kind} className="h-16" aria-hidden="true" />;
}
