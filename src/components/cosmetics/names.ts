import { cosmeticDef, type CosmeticId } from "@/lib/cosmetics";
import type { DictKey } from "@/i18n/dict";

type Translate = (key: DictKey, params?: Record<string, string | number>) => string;

/** Название украшения («Неон», «Охотник за багами»). */
export const cosmeticName = (id: CosmeticId, t: Translate): string => t(`cosmetics.name.${id}`);

/** Название со слотом — для подписей: «Рамка «Неон»» (история чипов, приз кейса, доступность). */
export function cosmeticWhat(id: CosmeticId, t: Translate): string {
  const def = cosmeticDef(id);
  return def ? t(`cosmetics.what.${def.slot}`, { name: cosmeticName(id, t) }) : "";
}
