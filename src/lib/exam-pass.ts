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
