import type { SkillBank } from "./types";

// ЗАГЛУШКА: банк навыка «base.keys» пишет автор урока base-7-keys (docs/specs/basics.md). Экспорт не менять.
export const BANKS: SkillBank[] = [
  {
    skill: "base.keys",
    question: (level) => ({
      id: "p:base.keys:stub",
      type: "choice",
      skill: "base.keys",
      level,
      prompt: { ru: "Скоро здесь будут задания", kk: "Жақында мұнда тапсырмалар болады" },
      options: [{ ru: "Понятно", kk: "Түсінікті" }, { ru: "Ждём", kk: "Күтеміз" }],
      correct: 0,
      explanation: { ru: "Урок готовится.", kk: "Сабақ әзірленуде." },
      hint: { ru: "Урок готовится.", kk: "Сабақ әзірленуде." },
    }),
  },
];
