import type { L } from "@/lib/types";

// Этап 16Б (docs/specs/stage16b.md). Ключи — `resume.*`. Казахский — литературный, термины по глоссарию НЦТ,
// без глаголов с родом в русском. Вычитано моделью, носителем — нет.
export const resumeDict = {
  "resume.label": { ru: "Незаконченный урок", kk: "Аяқталмаған сабақ" },
  "resume.cta": { ru: "Продолжить: {title}", kk: "Жалғастыру: {title}" },
  "resume.step": { ru: "Шаг {x} из {y}", kk: "{x}-қадам / {y}" },
  "resume.pick": { ru: "Выбери слово", kk: "Сөзді таңда" },
  "resume.chip": { ru: "Слово: {word}", kk: "Сөз: {word}" },
  "resume.blankN": { ru: "Пропуск {n}", kk: "Бос орын {n}" },
} satisfies Record<string, L>;
