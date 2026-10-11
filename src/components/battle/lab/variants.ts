import { variant as creatures } from "./creatures";
import { variant as pixel } from "./pixel";
import { variant as robots } from "./robots";
import { variant as space } from "./space";
import type { BattleVariant } from "./types";

/** Варианты стиля битвы в порядке показа. */
export const BATTLE_VARIANTS: readonly BattleVariant[] = [creatures, robots, pixel, space];
