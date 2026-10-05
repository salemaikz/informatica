import "server-only";
import { LESSONS } from "@/content/course";
import { withEntBoss } from "@/lib/ent-boss";
import { GAMES, GAMES_WIP } from "@/games/registry";
import type { AnalyticsEvent } from "@/lib/analytics";
import type { DrillMode } from "@/lib/drill";
import { BOOST_PACKS, CHIP_PACKS, HEART_PASSES, SHOP_ITEMS } from "@/lib/economy";

// Идентификаторы в событиях приходят от клиента — им нельзя доверять: выдуманные id раздули бы суточный хеш (поля `ls:<урок>:…`,
// `tk:<шаг>:…`) и общее хранилище (ревью этапа 12, C2). Поэтому сервер сверяет id измерений с реестрами контента, которые у него
// есть, а неизвестное сводит к литералу `other`: число полей за сутки ограничено контентом, а не клиентом.
// Проверяемое: урок (LESSONS), задание (`<урок>:<шаг>` или голый id шага — для старых клиентов), игра (реестр), режим тренировки,
// товар за ₸ (экономика), шаг онбординга. Чистая функция без обращений к хранилищу: покрыта tests/analytics-ids.test.ts.

/** Куда сводится неизвестный идентификатор. */
export const OTHER_ID = "other";

/** Режимы тренировки (lib/drill.ts → DrillMode). Тест сверяет список с подписями страницы владельца. */
export const DRILL_MODES: readonly DrillMode[] = ["smart", "mistakes", "skill", "review", "extern", "topic", "history", "practice", "recap", "minitest", "context", "codeview"];
/** Шаги короткого онбординга (app/onboarding/page.tsx → StepId). */
export const ONBOARDING_STEPS: readonly string[] = ["lang", "name", "track", "date", "target", "grade"];

let lazy: { lessons: ReadonlySet<string>; tasks: ReadonlySet<string>; bareSteps: ReadonlySet<string>; games: ReadonlySet<string>; items: ReadonlySet<string> } | null = null;

/** Реестры строятся один раз за жизнь копии сервера. */
function registries() {
  if (lazy) return lazy;
  const tasks = new Set<string>();
  const bareSteps = new Set<string>();
  // Шаги урока вместе с «боссом» ЕНТ, который вставляет код (этап 14): клиент шлёт и их id (ent:…).
  for (const lesson of Object.values(LESSONS)) {
    for (const s of withEntBoss(lesson).steps) {
      tasks.add(`${lesson.id}:${s.id}`);
      bareSteps.add(s.id);
    }
  }
  lazy = {
    lessons: new Set(Object.keys(LESSONS)),
    tasks,
    bareSteps,
    games: new Set([...GAMES, ...GAMES_WIP].map((g) => g.id)),
    items: new Set([...SHOP_ITEMS.map((i) => i.id), ...CHIP_PACKS.map((p) => p.id), ...HEART_PASSES.map((p) => p.id), ...BOOST_PACKS.map((p) => p.id)]),
  };
  return lazy;
}

const known = (set: ReadonlySet<string>, id: string): string => (set.has(id) ? id : OTHER_ID);

const DRILL_SET: ReadonlySet<string> = new Set(DRILL_MODES);
const ONB_SET: ReadonlySet<string> = new Set(ONBOARDING_STEPS);

/** Урок: id из LESSONS, иначе `other`. */
export const lessonId = (id: string): string => known(registries().lessons, id);

/** Задание: `<урок>:<шаг>` существующего шага; голый id шага — только если он есть в каком-нибудь уроке (старые клиенты); иначе `other`. */
export function taskKey(step: string): string {
  const r = registries();
  return r.tasks.has(step) || r.bareSteps.has(step) ? step : OTHER_ID;
}

/**
 * Событие с проверенными идентификаторами: неизвестный урок, шаг, игра, режим, товар или шаг онбординга заменяются на `other`.
 * Остальные поля (перечисления и числа) уже проверены схемой (lib/analytics-schema.ts).
 */
export function canonicalEvent(ev: AnalyticsEvent): AnalyticsEvent {
  const r = registries();
  switch (ev.e) {
    case "lesson_start":
    case "lesson_quit":
    case "lesson_finish":
    case "resume_choice":
      return { ...ev, lesson: known(r.lessons, ev.lesson) };
    case "task":
      return { ...ev, step: taskKey(ev.step) };
    case "drill_start":
    case "drill_finish":
      return { ...ev, mode: known(DRILL_SET, ev.mode) };
    case "game_start":
    case "game_finish":
    case "game_quit":
      return { ...ev, game: known(r.games, ev.game) };
    case "shop_click":
      return { ...ev, item: known(r.items, ev.item) };
    case "onb_step":
      return { ...ev, step: known(ONB_SET, ev.step) };
    default:
      return ev;
  }
}
