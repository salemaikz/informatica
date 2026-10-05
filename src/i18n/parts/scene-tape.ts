import type { L } from "@/lib/types";

// Этап 16Б, волна 3 (сцена tape; ТЗ — docs/specs/stage16b-wave3*.md). Ключи — `scene.tape.*`.
// Казахский — литературный, термины по глоссарию НЦТ, без глаголов с родом в русском. Вычитано моделью, носителем — нет.
export const sceneTapeDict = {
  "scene.tape.empty": { ru: "пусто", kk: "бос" },
  "scene.tape.stop": { ru: "не включая", kk: "қоспағанда" },
  "scene.tape.aria": { ru: "Лента, ячеек: {n}. Содержимое: {cells}.", kk: "Таспа, ұяшық саны: {n}. Мазмұны: {cells}." },
  "scene.tape.ariaName": { ru: "Имя: {name}.", kk: "Аты: {name}." },
  "scene.tape.ariaAlias": { ru: "Второе имя той же ленты: {alias}.", kk: "Сол таспаның екінші аты: {alias}." },
  "scene.tape.ariaSlice": { ru: "Срез берёт ячейки: {cells}.", kk: "Тілім мына ұяшықтарды алады: {cells}." },
  "scene.tape.ariaEmpty": { ru: "Срез пустой.", kk: "Тілім бос." },
  "scene.tape.ariaHighlight": { ru: "Выделены ячейки: {cells}.", kk: "Ерекшеленген ұяшықтар: {cells}." },
  "scene.tape.ariaDim": { ru: "Приглушены ячейки: {cells}.", kk: "Күңгірттелген ұяшықтар: {cells}." },
  "scene.tape.ariaPointer": { ru: "Указатель {label}, ячейка {at}.", kk: "Нұсқағыш {label}, ұяшық {at}." },
  "scene.tape.ariaSwap": { ru: "Обмен: ячейки {a} и {b}.", kk: "Орын ауыстыру: ұяшықтар {a} және {b}." },
  "scene.tape.ariaGroup": { ru: "Группа: ячейки {from}–{to}, {label}.", kk: "Топ: ұяшықтар {from}–{to}, {label}." },
  "scene.tape.ariaAfter": { ru: "После: {cells}.", kk: "Кейін: {cells}." },
} satisfies Record<string, L>;
