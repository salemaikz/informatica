"use client";

import type { ReactNode } from "react";
import type { Scene } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { BinaryScene } from "./BinaryScene";
import { CardsScene } from "./CardsScene";
import { CircuitScene } from "./CircuitScene";
import { CodeScene } from "./CodeScene";
import { CoinsScene } from "./CoinsScene";
import { DecimalScene } from "./DecimalScene";
import { FlowScene } from "./FlowScene";
import { LadderScene } from "./LadderScene";
import { LampsScene } from "./LampsScene";
import { PixelsScene } from "./PixelsScene";
import { QuestSceneView } from "./QuestScene";
import { TableScene } from "./TableScene";
import { WebScene } from "./WebScene";

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
    case "table":
      return <TableScene scene={scene} />;
    case "code":
      return <CodeScene scene={scene} />;
    case "circuit":
      return <CircuitScene scene={scene} />;
    case "flow":
      return <FlowScene scene={scene} />;
    case "cards":
      return <CardsScene scene={scene} />;
    case "pixels":
      return <PixelsScene scene={scene} />;
    case "web":
      return <WebScene scene={scene} />;
  }
}

/**
 * Рисует параметризованную сцену (двоичная запись, лесенка, лампочки, монеты, десятичное число, квест,
 * таблица, код, логическая схема, блок-схема, карточки, растр, веб-страница).
 * Сцены того же вида, идущие подряд (шаги разбора), не пересоздаются: элементы стабильны и анимируют изменения флагов.
 */
export function SceneView({ scene, className }: { scene: Scene; className?: string }) {
  const { l } = useT();
  // Подпись новых сцен рисуется здесь, под сценой; у квеста и «старых» сцен своя вёрстка.
  const caption = "caption" in scene && scene.kind !== "quest" ? scene.caption : undefined;
  return (
    <div data-scene={scene.kind} className={cn(scene.kind !== "quest" && "rounded-3xl bg-surface-2/60 px-3 py-5", className)}>
      <Body scene={scene} />
      {caption && <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-snug text-muted">{l(caption)}</p>}
    </div>
  );
}
