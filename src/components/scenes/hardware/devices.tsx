import type { ReactElement } from "react";
import type { HardwareId } from "@/lib/types";

// ЗАГЛУШКА: рисунки устройств ввода/вывода и «компьютеров вокруг нас» рисует художник A2 по docs/specs/basics.md.
// Каждая функция возвращает <svg> c viewBox="0 0 120 90".
export const DEVICE_ART: Partial<Record<HardwareId, () => ReactElement>> = {};
