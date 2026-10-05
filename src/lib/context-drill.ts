import { UNITS } from "@/content/course";
import { ENT_POOL } from "@/content/ent";
import { entRef, entStepFromRef } from "./ent-steps";
import { shuffleEntItem } from "./exam";
import type { EntContext, EntItem, QuestionStep } from "./types";

// Контекстные задания в практикуме (этап 14, решение #85): программа на Python и 5 вопросов к ней, как на ЕНТ.
// Задание проходит в плеере тренировки (режим context): 5 шагов, у сцены с программой — кнопка «Запустить» (scene.run).
// Чистая логика без React (тесты — tests/context-drill.test.ts).

const isContext = (item: EntItem): item is EntContext => item.kind === "context";

/** id урока из id задания ЕНТ («py-2-if:ctx-cinema» → «py-2-if»). */
export const contextLessonId = (itemId: string): string => itemId.split(":")[0];

/** Порядковый номер урока в курсе (по UNITS); неизвестный урок — в самый конец. */
let lessonOrder: Map<string, number> | null = null;
function orderOf(lessonId: string): number {
  if (!lessonOrder) {
    lessonOrder = new Map();
    let n = 0;
    for (const unit of UNITS) for (const lesson of unit.lessons) if (!lessonOrder.has(lesson.id)) lessonOrder.set(lesson.id, n++);
  }
  return lessonOrder.get(lessonId) ?? Number.MAX_SAFE_INTEGER;
}

/** Все контекстные задания из банка ЕНТ (t06, t07 и др.) в порядке курса: по порядку уроков в UNITS, внутри урока — как в банке. */
export function contextItems(): EntContext[] {
  return ENT_POOL.filter(isContext)
    .map((item, i) => ({ item, i, o: orderOf(contextLessonId(item.id)) }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map((x) => x.item);
}

/**
 * Сессия по одному контекстному заданию: 5 вопросов, у сцены с программой на Python — кнопка «Запустить» (scene.run).
 * Варианты перемешаны по seed (в банке верный вариант чаще стоит первым). Неизвестный id — [].
 */
export function buildContextDrill(itemId: string, seed = 0): QuestionStep[] {
  const item = ENT_POOL.find((i): i is EntContext => isContext(i) && i.id === itemId);
  if (!item) return [];
  const shuffled = [shuffleEntItem(item, seed)];
  const steps: QuestionStep[] = [];
  for (let n = 0; n < item.questions.length; n++) {
    const step = entStepFromRef(entRef(item.id, n), shuffled);
    if (!step) continue;
    const scene = step.scene;
    // Сцену копируем: объект из банка ЕНТ общий, правка на месте попала бы в пробный ЕНТ.
    steps.push(scene?.kind === "code" && scene.lang === "python" ? { ...step, scene: { ...scene, run: true } } : step);
  }
  return steps;
}
