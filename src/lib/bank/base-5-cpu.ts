import type { SkillBank } from "./types";

// ЗАГЛУШКА: банк навыка «base.cpu» пишет автор урока base-5-cpu (docs/specs/basics.md). Экспорт не менять.
export const BANKS: SkillBank[] = [
  {
    skill: "base.cpu",
    question: (level) => ({
      id: "p:base.cpu:stub",
      type: "choice",
      skill: "base.cpu",
      level,
      prompt: { ru: "Скоро здесь будут задания", kk: "Жақында мұнда тапсырмалар болады" },
      options: [{ ru: "Понятно", kk: "Түсінікті" }, { ru: "Ждём", kk: "Күтеміз" }],
      correct: 0,
      explanation: { ru: "Урок готовится.", kk: "Сабақ әзірленуде." },
      hint: { ru: "Урок готовится.", kk: "Сабақ әзірленуде." },
    }),
  },
];
