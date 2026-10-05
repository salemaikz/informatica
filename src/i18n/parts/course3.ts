import type { L } from "@/lib/types";

// Курс 3.0 (этап 14, #46): узлы «Практика» и «Повторение» на карте, мини-тест группы, микроуроки (ru + kk).
// Ключи — `course3.*`. Пакет P2 дописывает свои ключи сюда; заголовки сессий ниже использует DrillScreen (каркас).
export const course3Dict = {
  "course3.practice.title": { ru: "Практика: {group}", kk: "Практика: {group}" },
  "course3.recap.title": { ru: "Повторение: {unit}", kk: "Қайталау: {unit}" },
  "course3.minitest.title": { ru: "Мини-тест: {group}", kk: "Шағын тест: {group}" },
  "course3.empty": {
    ru: "Здесь пока нечего тренировать — сначала пройди хотя бы один урок группы.",
    kk: "Мұнда әзірге жаттығатын ештеңе жоқ — алдымен топтың кемінде бір сабағын өт.",
  },

  // ---- Узлы на карте (P2) ----
  "course3.node.practice": { ru: "Практика", kk: "Практика" },
  "course3.node.recap": { ru: "Повторение", kk: "Қайталау" },
  "course3.node.aria": { ru: "{kind}: {title}, {state}", kk: "{kind}: {title}, {state}" },
  "course3.node.state.new": { ru: "пока не пройдено", kk: "әзірге өтілмеген" },
  "course3.node.state.recommended": { ru: "рекомендуем пройти", kk: "өтуді ұсынамыз" },
  "course3.node.state.done.one": { ru: "пройдено {n} раз", kk: "{n} рет өтілді" },
  "course3.node.state.done.few": { ru: "пройдено {n} раза", kk: "{n} рет өтілді" },
  "course3.node.state.done.many": { ru: "пройдено {n} раз", kk: "{n} рет өтілді" },
  "course3.node.best": { ru: "Лучший результат: {best}%", kk: "Үздік нәтиже: {best}%" },

  // ---- Лист узла (P2) ----
  "course3.sheet.practice.desc": {
    ru: "{n} заданий: эта тема, прошлые темы и начало курса. Бесплатно.",
    kk: "{n} тапсырма: осы тақырып, өткен тақырыптар және курстың басы. Тегін.",
  },
  "course3.sheet.recap.desc": {
    ru: "{n} заданий: весь раздел, прошлые темы и начало курса. Бесплатно.",
    kk: "{n} тапсырма: бүкіл бөлім, өткен тақырыптар және курстың басы. Тегін.",
  },
  "course3.sheet.new": { ru: "Пока не пройдено", kk: "Әзірге өтілмеген" },
  "course3.sheet.done.one": { ru: "Пройдено {n} раз · лучший результат {best}%", kk: "{n} рет өтілді · үздік нәтиже {best}%" },
  "course3.sheet.done.few": { ru: "Пройдено {n} раза · лучший результат {best}%", kk: "{n} рет өтілді · үздік нәтиже {best}%" },
  "course3.sheet.done.many": { ru: "Пройдено {n} раз · лучший результат {best}%", kk: "{n} рет өтілді · үздік нәтиже {best}%" },
  "course3.sheet.start": { ru: "Начать практику", kk: "Практиканы бастау" },
  "course3.sheet.startRecap": { ru: "Начать повторение", kk: "Қайталауды бастау" },
  "course3.sheet.test": { ru: "Мини-тест", kk: "Шағын тест" },
  "course3.sheet.testHint": {
    ru: "{n} заданий в формате ЕНТ. Итог — баллами, как на экзамене.",
    kk: "{n} тапсырма ҰБТ форматында. Қорытындысы — емтихандағыдай балмен.",
  },
  "course3.sheet.testBest": { ru: "Мини-тест: лучший результат {best}%", kk: "Шағын тест: үздік нәтиже {best}%" },

  // ---- Итоги мини-теста (P2) ----
  "course3.minitest.points": { ru: "Баллы как на ЕНТ: {points} из {max}", kk: "ҰБТ бойынша балл: {points} / {max}" },
  "course3.minitest.weak": { ru: "Слабое место: {skill}", kk: "Әлсіз тұс: {skill}" },
  "course3.toMap": { ru: "К карте курса", kk: "Курс картасына" },
} satisfies Record<string, L>;
