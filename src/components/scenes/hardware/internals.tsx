import type { ReactElement } from "react";
import type { HardwareId } from "@/lib/types";

// ЗАГЛУШКА: рисунки деталей и носителей (case, motherboard, cpu, cooler, ram, ssd, hdd, gpu, psu, flash, sd, cd, cloud, ext-hdd)
// рисует художник A1 по docs/specs/basics.md. Каждая функция возвращает <svg> c viewBox="0 0 120 90".
export const INTERNAL_ART: Partial<Record<HardwareId, () => ReactElement>> = {};
