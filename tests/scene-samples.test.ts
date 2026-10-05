import { describe, expect, it } from "vitest";
import { SCENE_SAMPLES } from "@/components/scenes/samples";
import { validateScene } from "./validate";

// Образцы сцен волны 3 (галерея /dev/scenes) проходят проверку параметров — как сцены в уроках.

describe("образцы сцен волны 3", () => {
  for (const g of SCENE_SAMPLES) {
    it(`${g.group}: есть образцы и все корректны`, () => {
      expect(g.scenes.length).toBeGreaterThan(0);
      for (const [i, scene] of g.scenes.entries()) expect(validateScene(scene), `${g.group}[${i}]`).toEqual([]);
    });
  }
});
