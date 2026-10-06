// Порог «тест по разделу сдан»: лёгкий модуль без импортов (стор есть на каждой странице, `lib/exam` тянет сборку вариантов ЕНТ).

/** Доля баллов, с которой тест по разделу сдан: непройденные уроки раздела засчитываются. */
export const UNIT_PASS_RATIO = 0.8;

/** Тест по разделу сдан: доля баллов не меньше UNIT_PASS_RATIO. */
export const unitPassed = (points: number, max: number): boolean => max > 0 && Number.isFinite(points) && points / max >= UNIT_PASS_RATIO;

/**
 * Полный пробный ЕНТ «завершён»: отвечено не меньше половины заданий варианта (asked — весь вариант).
 * Единое правило: по нему платятся чипы за пробный ЕНТ (recordExam) и считается достижение «Пять пробников».
 */
export const fullExamCounts = (answered: number, asked: number): boolean => answered > 0 && answered >= Math.ceil(asked / 2);

/** Поля попытки, нужные правилу награды за пробный ЕНТ. */
export interface FullExamFacts {
  id: string;
  kind: string;
  seed: number;
  at: number;
  points: number;
  answered?: number;
  questions?: number;
  /** +5 за эту попытку выдано; у старых попыток поля нет — считаем выданным, если попытка засчитана. */
  chips?: boolean;
}

const sameDay = (a: number, b: number): boolean => {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};

/**
 * Чипы за пробный ЕНТ (#122): +5 только если такого варианта (seed) ещё нет среди засчитанных полных попыток
 * и сегодня ещё не было засчитанной полной попытки. `before` — прежние попытки (без текущей).
 */
export function fullExamChipsAllowed(before: FullExamFacts[], cur: Pick<FullExamFacts, "id" | "seed" | "at">): boolean {
  const done = before.filter(
    (e) =>
      e.kind === "full" &&
      e.id !== cur.id &&
      (typeof e.answered === "number" ? fullExamCounts(e.answered, Math.max(e.answered, e.questions ?? 0)) : e.points > 0),
  );
  return !done.some((e) => e.seed === cur.seed || (e.chips !== false && sameDay(e.at, cur.at)));
}

/**
 * Урок засчитывается, если отвечено не меньше 70% предъявленных заданий (пропуск — не ответ; повторы ошибок не считаются).
 * Один пропуск зачёт не снимает: пропустить можно только решение по фото и задачу с кодом — по уважительной причине
 * (нет камеры, Python не загрузился), а в коротком уроке из трёх заданий один пропуск — уже 67%.
 */
export const LESSON_COUNT_RATIO = 0.7;
export function lessonCounted(r: { asked?: number; skipped?: number; answers: { retry?: boolean; skipped?: boolean }[] }): boolean {
  const first = r.answers.filter((a) => !a.retry);
  const asked = r.asked ?? first.length;
  if (asked <= 0) return true;
  const skipped = r.skipped ?? first.filter((a) => a.skipped).length;
  if (skipped <= 1) return true;
  return (asked - skipped) / asked >= LESSON_COUNT_RATIO - 1e-9;
}
