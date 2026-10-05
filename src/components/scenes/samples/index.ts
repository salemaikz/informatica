import type { Scene } from "@/lib/types";
import { SAMPLES as numberline } from "./numberline";
import { SAMPLES as tape } from "./tape";
import { SAMPLES as chart } from "./chart";
import { SAMPLES as graph } from "./graph";
import { SAMPLES as grid } from "./grid";
import { SAMPLES as dbSchema } from "./db-schema";
import { SAMPLES as box } from "./box";
import { SAMPLES as wave } from "./wave";
import { SAMPLES as gates } from "./gates";
import { SAMPLES as switches } from "./switches";
import { SAMPLES as web } from "./web";
import { SAMPLES as extended } from "./extended";

// Образцы сцен волны 3 (этап 16Б): галерея /dev/scenes (только при SCENES_GALLERY=1) и проверка tests/scene-samples.test.ts.
// Каждый исполнитель дополняет только файл своей сцены.

export const SCENE_SAMPLES: { group: string; scenes: Scene[] }[] = [
  { group: "numberline", scenes: numberline },
  { group: "tape", scenes: tape },
  { group: "chart", scenes: chart },
  { group: "graph", scenes: graph },
  { group: "grid", scenes: grid },
  { group: "db-schema", scenes: dbSchema },
  { group: "box", scenes: box },
  { group: "wave", scenes: wave },
  { group: "gates", scenes: gates },
  { group: "switches", scenes: switches },
  { group: "web", scenes: web },
  { group: "extended", scenes: extended },
];
