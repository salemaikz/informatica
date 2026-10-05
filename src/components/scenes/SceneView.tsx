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
import { HardwareScene } from "./HardwareScene";
import { PcInsideScene } from "./PcInsideScene";
import { CpuCycleScene } from "./CpuCycleScene";
import { KeyboardScene } from "./KeyboardScene";
import { SizesScene } from "./SizesScene";
import { FilesScene } from "./FilesScene";
import { LayersScene } from "./LayersScene";
import { VennScene } from "./VennScene";
import { NumberlineScene } from "./NumberlineScene";
import { TapeScene } from "./TapeScene";
import { ChartScene } from "./ChartScene";
import { GraphScene } from "./GraphScene";
import { GridScene } from "./GridScene";
import { DbSchemaScene } from "./DbSchemaScene";
import { BoxScene } from "./BoxScene";
import { WaveScene } from "./WaveScene";
import { GatesScene } from "./GatesScene";
import { SwitchesScene } from "./SwitchesScene";
import { UrlScene } from "./UrlScene";
import { MessageScene } from "./MessageScene";

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
    case "hardware":
      return <HardwareScene scene={scene} />;
    case "pc-inside":
      return <PcInsideScene scene={scene} />;
    case "cpu-cycle":
      return <CpuCycleScene scene={scene} />;
    case "keyboard":
      return <KeyboardScene scene={scene} />;
    case "sizes":
      return <SizesScene scene={scene} />;
    case "files":
      return <FilesScene scene={scene} />;
    case "layers":
      return <LayersScene scene={scene} />;
    case "venn":
      return <VennScene scene={scene} />;
    case "numberline":
      return <NumberlineScene scene={scene} />;
    case "tape":
      return <TapeScene scene={scene} />;
    case "chart":
      return <ChartScene scene={scene} />;
    case "graph":
      return <GraphScene scene={scene} />;
    case "grid":
      return <GridScene scene={scene} />;
    case "db-schema":
      return <DbSchemaScene scene={scene} />;
    case "box":
      return <BoxScene scene={scene} />;
    case "wave":
      return <WaveScene scene={scene} />;
    case "gates":
      return <GatesScene scene={scene} />;
    case "switches":
      return <SwitchesScene scene={scene} />;
    case "url":
      return <UrlScene scene={scene} />;
    case "message":
      return <MessageScene scene={scene} />;
  }
}

/**
 * Рисует параметризованную сцену (двоичная запись, лесенка, лампочки, монеты, десятичное число, квест,
 * таблица, код, логическая схема, блок-схема, карточки, растр, веб-страница, круги Эйлера).
 * Сцены того же вида, идущие подряд (шаги разбора), не пересоздаются: элементы стабильны и анимируют изменения флагов.
 */
export function SceneView({ scene, className }: { scene: Scene; className?: string }) {
  const { l } = useT();
  // Подпись новых сцен рисуется здесь, под сценой; у квеста и «старых» сцен своя вёрстка.
  const caption = "caption" in scene && scene.kind !== "quest" ? scene.caption : undefined;
  return (
    <div data-scene={scene.kind} className={cn(scene.kind !== "quest" && "rounded-3xl bg-surface-2/60 px-3 py-5", className)}>
      <Body scene={scene} />
      {caption && <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-snug text-muted [overflow-wrap:anywhere]">{l(caption)}</p>}
    </div>
  );
}
