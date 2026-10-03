"use client";

import { m } from "motion/react";
import { springSoft } from "@/components/motion/presets";
import { useT } from "@/i18n/useT";
import type { QuestArt, Scene } from "@/lib/types";
import { DoorArt } from "./quest/DoorArt";
import { LockerArt } from "./quest/LockerArt";
import { RoomArt } from "./quest/RoomArt";
import { WindowLampsArt } from "./quest/WindowLampsArt";

type QuestScene = Extract<Scene, { kind: "quest" }>;

function Art({ art, code }: { art: QuestArt; code?: string }) {
  switch (art) {
    case "door":
      return <DoorArt open={false} code={code} />;
    case "door-open":
      return <DoorArt open code={code} />;
    case "locker":
      return <LockerArt open={false} code={code} />;
    case "locker-open":
      return <LockerArt open code={code} />;
    case "window-lamps":
      return <WindowLampsArt code={code} />;
    case "room":
      return <RoomArt code={code} />;
  }
}

/** Иллюстрация сюжета: плоский SVG ~16:10 (не выше ~220 px на телефоне) и подпись под ней. */
export function QuestSceneView({ scene }: { scene: QuestScene }) {
  const { l } = useT();
  return (
    <figure className="mx-auto w-full max-w-[352px]">
      <m.div
        key={scene.art}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springSoft}
        className="overflow-hidden rounded-3xl border-2 border-border bg-surface"
      >
        <Art art={scene.art} code={scene.code} />
      </m.div>
      {scene.caption && <figcaption className="mt-2.5 text-center text-sm font-semibold leading-snug text-muted [overflow-wrap:anywhere]">{l(scene.caption)}</figcaption>}
    </figure>
  );
}
