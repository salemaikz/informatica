import type { SkillBank } from "./types";

// ЗАГЛУШКА: банк навыка «base.info» пишет автор урока base-8-info (docs/specs/basics.md). Экспорт не менять.
export const BANKS: SkillBank[] = [
  {
    skill: "base.info",
    question: (level) => ({
      id: "p:base.info:stub",
      type: "choice",
      skill: "base.info",
      level,
      prompt: { ru: "Скоро здесь будут задания", kk: "Жақында мұнда тапсырмалар болады" },
      options: [{ ru: "Понятно", kk: "Түсінікті" }, { ru: "Ждём", kk: "Күтеміз" }],
      correct: 0,
      explanation: { ru: "Урок готовится.", kk: "Сабақ әзірленуде." },
      hint: { ru: "Урок готовится.", kk: "Сабақ әзірленуде." },
    }),
  },
];
