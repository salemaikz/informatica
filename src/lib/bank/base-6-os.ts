import type { SkillBank } from "./types";

// ЗАГЛУШКА: банк навыка «base.os» пишет автор урока base-6-os (docs/specs/basics.md). Экспорт не менять.
export const BANKS: SkillBank[] = [
  {
    skill: "base.os",
    question: (level) => ({
      id: "p:base.os:stub",
      type: "choice",
      skill: "base.os",
      level,
      prompt: { ru: "Скоро здесь будут задания", kk: "Жақында мұнда тапсырмалар болады" },
      options: [{ ru: "Понятно", kk: "Түсінікті" }, { ru: "Ждём", kk: "Күтеміз" }],
      correct: 0,
      explanation: { ru: "Урок готовится.", kk: "Сабақ әзірленуде." },
      hint: { ru: "Урок готовится.", kk: "Сабақ әзірленуде." },
    }),
  },
];
