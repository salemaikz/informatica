import type { ReactElement } from "react";
import type { HardwareId } from "@/lib/types";
import { CaseArt, CoolerArt, CpuArt, GpuArt, HddArt, MotherboardArt, PsuArt, RamArt, SsdArt } from "./internals/parts";
import { CdArt, CloudArt, ExtHddArt, FlashArt, SdArt } from "./internals/media";

/** Рисунки, которые рисует этот модуль: детали системного блока и носители. */
export const INTERNAL_IDS = [
  "case",
  "motherboard",
  "cpu",
  "cooler",
  "ram",
  "ssd",
  "hdd",
  "gpu",
  "psu",
  "flash",
  "sd",
  "cd",
  "cloud",
  "ext-hdd",
] as const satisfies readonly HardwareId[];

export type InternalId = (typeof INTERNAL_IDS)[number];

const ART: Record<InternalId, () => ReactElement> = {
  case: CaseArt,
  motherboard: MotherboardArt,
  cpu: CpuArt,
  cooler: CoolerArt,
  ram: RamArt,
  ssd: SsdArt,
  hdd: HddArt,
  gpu: GpuArt,
  psu: PsuArt,
  flash: FlashArt,
  sd: SdArt,
  cd: CdArt,
  cloud: CloudArt,
  "ext-hdd": ExtHddArt,
};

// Каждая функция возвращает <svg> c viewBox="0 0 120 90" (плоский «учебниковый» стиль, цвета — токены темы).
export const INTERNAL_ART: Partial<Record<HardwareId, () => ReactElement>> = ART;
