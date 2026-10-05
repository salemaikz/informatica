import { describe, expect, it } from "vitest";
import { LESSONS } from "@/content/course";
import { buildCheck } from "@/lib/drill";
import { withEntBoss } from "@/lib/ent-boss";

// Этап 16: урок с «боссом» и набор «Проверить себя» собирает сервер (app/lesson/[id]/page.tsx) и передаёт в браузер.
// Пропсы серверного компонента должны быть простыми данными: без функций, классов и Map — иначе урок сломается
// при передаче. JSON-копия ловит функции (пропадают) и Date/Map/Set (меняют вид).

const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("урок для страницы урока — простые данные", () => {
  it("каждый урок с «боссом» без потерь переживает передачу с сервера", () => {
    for (const lesson of Object.values(LESSONS)) {
      const boosted = withEntBoss(lesson);
      expect(plain(boosted), lesson.id).toEqual(boosted);
    }
  });

  it("набор «Проверить себя» каждого урока — тоже", () => {
    for (const lesson of Object.values(LESSONS)) {
      const check = buildCheck(withEntBoss(lesson), 7);
      expect(plain(check), lesson.id).toEqual(check);
    }
  });
});
