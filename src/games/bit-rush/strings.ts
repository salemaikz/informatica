import type { L } from "@/lib/types";

export const S = {
  score: { ru: "Очки", kk: "Ұпай" },
  combo: { ru: "Комбо", kk: "Комбо" },
  seconds: { ru: "{n} с", kk: "{n} с" },
  correct: { ru: "Верно!", kk: "Дұрыс!" },
  wrong: { ru: "Неверно", kk: "Қате" },
  answerWas: { ru: "Правильный ответ: {a}", kk: "Дұрыс жауап: {a}" },
  tapToContinue: { ru: "Нажми, чтобы продолжить", kk: "Жалғастыру үшін бас" },
  timeUp: { ru: "Время!", kk: "Уақыт бітті!" },
  typeAnswer: { ru: "Введи ответ", kk: "Жауапты енгіз" },
  erase: { ru: "Стереть", kk: "Өшіру" },
  ok: { ru: "OK", kk: "OK" },
  clockPlus: { ru: "+{n} с", kk: "+{n} с" },
  clockMinus: { ru: "−4 с", kk: "−4 с" },
  fast: { ru: "Быстро!", kk: "Жылдам!" },
  announceRight: { ru: "Верно", kk: "Дұрыс" },
  announceWrong: { ru: "Неверно. Правильный ответ: {a}", kk: "Қате. Дұрыс жауап: {a}" },
  retryTag: { ru: "Повтор", kk: "Қайталау" },
  progress: { ru: "Вопрос {n} из {total}", kk: "{n}-сұрақ, барлығы {total}" },
  announceTimeout: { ru: "Время вышло. Правильный ответ: {a}", kk: "Уақыт бітті. Дұрыс жауап: {a}" },
} satisfies Record<string, L>;
