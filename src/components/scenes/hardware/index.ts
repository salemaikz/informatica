import type { ReactElement } from "react";
import type { HardwareId } from "@/lib/types";
import { INTERNAL_ART } from "./internals";
import { DEVICE_ART } from "./devices";

export { HARDWARE_NAMES } from "./names";

/** Все рисунки сцены hardware: id → компонент-рисунок (viewBox 0 0 120 90). Нет рисунка — сцена показывает иконку. */
export const HARDWARE_ART: Partial<Record<HardwareId, () => ReactElement>> = { ...INTERNAL_ART, ...DEVICE_ART };
