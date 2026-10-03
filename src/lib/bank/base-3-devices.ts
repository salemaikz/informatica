import type { SkillBank } from "./types";

// ЗАГЛУШКА: банк навыка «base.devices» пишет автор урока base-3-devices (docs/specs/basics.md). Экспорт не менять.
export const BANKS: SkillBank[] = [
  {
    skill: "base.devices",
    question: (level) => ({
      id: "p:base.devices:stub",
      type: "choice",
      skill: "base.devices",
      level,
      prompt: { ru: "Скоро здесь будут задания", kk: "Жақында мұнда тапсырмалар болады" },
      options: [{ ru: "Понятно", kk: "Түсінікті" }, { ru: "Ждём", kk: "Күтеміз" }],
      correct: 0,
      explanation: { ru: "Урок готовится.", kk: "Сабақ әзірленуде." },
      hint: { ru: "Урок готовится.", kk: "Сабақ әзірленуде." },
    }),
  },
];
