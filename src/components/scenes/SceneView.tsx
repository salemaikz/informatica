"use client";

import type { ReactNode } from "react";
import type { Scene } from "@/lib/types";
import { cn } from "@/lib/cn";
import { BinaryScene } from "./BinaryScene";
import { CoinsScene } from "./CoinsScene";
import { DecimalScene } from "./DecimalScene";
import { LadderScene } from "./LadderScene";
import { LampsScene } from "./LampsScene";
import { QuestSceneView } from "./QuestScene";

function Body({ scene }: { scene: Scene }): ReactNode {
  switch (scene.kind) {
    case "binary":
      return <BinaryScene scene={scene} />;
    case "ladder":
      return <LadderScene scene={scene} />;
    case "lamps":
      return <LampsScene scene={scene} />;
    case "coins":
      return <CoinsScene scene={scene} />;
    case "decimal":
      return <DecimalScene scene={scene} />;
    case "quest":
      return <QuestSceneView scene={scene} />;
  }
}

/**
 * Рисует параметризованную сцену (двоичная запись, лесенка, лампочки, монеты, десятичное число, квест).
 * Сцены того же вида, идущие подряд (шаги разбора), не пересоздаются: элементы стабильны и анимируют изменения флагов.
 */
export function SceneView({ scene, className }: { scene: Scene; className?: string }) {
  return (
    <div data-scene={scene.kind} className={cn(scene.kind !== "quest" && "rounded-3xl bg-surface-2/60 px-3 py-5", className)}>
      <Body scene={scene} />
    </div>
  );
}
