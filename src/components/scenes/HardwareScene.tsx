"use client";

import { m } from "motion/react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { springSoft } from "@/components/motion/presets";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import type { HardwareId, IconName, Scene } from "@/lib/types";
import { HARDWARE_ART, HARDWARE_NAMES } from "./hardware";
import { iconFor } from "./icons";

type HardwareSceneData = Extract<Scene, { kind: "hardware" }>;

/** Запасная иконка, если рисунка для устройства нет. */
const FALLBACK_ICON: Record<HardwareId, IconName> = {
  case: "box", motherboard: "cpu", cpu: "cpu", cooler: "zap", ram: "memory", ssd: "hard-drive", hdd: "hard-drive", gpu: "monitor", psu: "battery",
  flash: "usb", sd: "memory", cd: "repeat", cloud: "cloud", "ext-hdd": "hard-drive",
  keyboard: "keyboard", mouse: "mouse", touchpad: "mouse", touchscreen: "phone", mic: "mic", webcam: "camera", scanner: "scanner", gamepad: "zap",
  monitor: "monitor", printer: "printer", speakers: "speaker", headphones: "speaker", projector: "monitor",
  desktop: "monitor", laptop: "laptop", phone: "phone", tablet: "phone", smartwatch: "clock", atm: "calculator", pos: "calculator", car: "settings", server: "server", router: "router",
  switch: "network", hub: "network", modem: "router", "access-point": "wifi", nic: "network", "cable-utp": "link", "cable-fiber": "link",
  "printer-dot": "printer", "printer-inkjet": "printer", "printer-laser": "printer", plotter: "printer", "pen-tablet": "image",
  sensor: "zap", "vr-headset": "cube", "robot-vacuum": "bot", drone: "bot", manipulator: "bot",
};

/**
 * Галерея рисунков устройств и деталей: сетка карточек (на телефоне 2 колонки, на широком экране 3; один рисунок — крупно по центру),
 * под рисунком — название. highlight — рамка primary, остальное чуть приглушено. labels: false — без подписей.
 */
export function HardwareScene({ scene }: { scene: HardwareSceneData }) {
  const { t, l } = useT();
  const reduce = useReduceMotion();
  const labels = scene.labels !== false;
  const highlight = scene.highlight ?? [];
  const single = scene.items.length === 1;

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-wrap justify-center gap-2.5",
        single ? "max-w-[280px]" : "max-w-xl",
      )}
    >
      {scene.items.map((id, i) => {
        const Art = HARDWARE_ART[id];
        const Icon = iconFor(FALLBACK_ICON[id]);
        const lit = highlight.includes(id);
        const dim = highlight.length > 0 && !lit;
        const name = l(HARDWARE_NAMES[id]);
        return (
          <m.div
            key={id}
            role="img"
            aria-label={lit ? `${name} (${t("basics.hw.selected")})` : name}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: dim ? 0.55 : 1, y: 0 }}
            transition={{ ...springSoft, delay: reduce ? 0 : Math.min(i, 8) * 0.05 }}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border bg-surface p-2",
              single ? "basis-full" : "basis-[calc(50%-5px)] min-[480px]:basis-[calc(33.333%-7px)]",
              lit ? "border-primary bg-primary-soft ring-2 ring-primary" : "border-border",
            )}
          >
            <div className="w-full">
              {Art ? (
                <Art />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center text-muted">
                  <Icon className="size-1/3" strokeWidth={1.6} aria-hidden="true" />
                </div>
              )}
            </div>
            {labels && (
              <span
                aria-hidden="true"
                className={cn(
                  "px-1 text-center font-bold leading-tight",
                  single ? "text-base" : "text-[13px]",
                  lit ? "text-ink-primary" : "text-text",
                )}
              >
                {name}
              </span>
            )}
          </m.div>
        );
      })}
    </div>
  );
}
