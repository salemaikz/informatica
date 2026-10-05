import type { L } from "@/lib/types";

// Этап 16Б (docs/specs/stage16b.md). Ключи — `xp.*`. Казахский — литературный, термины по глоссарию НЦТ,
// без глаголов с родом в русском. Вычитано моделью, носителем — нет.
export const xpSignDict = {
  "xp.combo": { ru: "Комбо ×{n}", kk: "Комбо ×{n}" },
  "xp.comboHint": { ru: "Верные ответы подряд: от 3 — бонус к XP", kk: "Қатарынан дұрыс жауаптар: 3-тен бастап XP-ге бонус" },
  "xp.chips": { ru: "Чипы", kk: "Чиптер" },
  "xp.chipsPlus.one": { ru: "+{n} чип", kk: "+{n} чип" },
  "xp.chipsPlus.few": { ru: "+{n} чипа", kk: "+{n} чип" },
  "xp.chipsPlus.many": { ru: "+{n} чипов", kk: "+{n} чип" },
  "xp.rate.one": { ru: "{xp} XP = {n} чип", kk: "{xp} XP = {n} чип" },
  "xp.rate.few": { ru: "{xp} XP = {n} чипа", kk: "{xp} XP = {n} чип" },
  "xp.rate.many": { ru: "{xp} XP = {n} чипов", kk: "{xp} XP = {n} чип" },
  "xp.streakLit": { ru: "Огонь загорелся", kk: "От тұтанды" },
  "xp.streakDays": { ru: "Серия: {n} дн.", kk: "Серия: {n} күн" },
  "xp.reward.one": { ru: "до +{xp} XP · ≈ {chips} чип", kk: "+{xp} XP дейін · ≈ {chips} чип" },
  "xp.reward.few": { ru: "до +{xp} XP · ≈ {chips} чипа", kk: "+{xp} XP дейін · ≈ {chips} чип" },
  "xp.reward.many": { ru: "до +{xp} XP · ≈ {chips} чипов", kk: "+{xp} XP дейін · ≈ {chips} чип" },
} satisfies Record<string, L>;
