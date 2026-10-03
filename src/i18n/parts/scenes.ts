import type { L } from "@/lib/types";

// Строки сцен-иллюстраций (ru + kk). Префикс ключей — scene.
export const scenesDict = {
  // Панели сцены «код» и «web»
  "scene.vars": { ru: "Переменные", kk: "Айнымалылар" },
  "scene.output": { ru: "Вывод", kk: "Нәтиже" },
  "scene.output.empty": { ru: "пока ничего не выведено", kk: "әзірге ештеңе шығарылған жоқ" },
  "scene.code": { ru: "Код", kk: "Код" },
  "scene.css": { ru: "Стили", kk: "Стильдер" },
  "scene.browser": { ru: "В браузере", kk: "Браузерде" },

  // Логические вентили (подпись под рамкой)
  "scene.op.and": { ru: "И", kk: "ЖӘНЕ" },
  "scene.op.or": { ru: "ИЛИ", kk: "НЕМЕСЕ" },
  "scene.op.not": { ru: "НЕ", kk: "ЕМЕС" },
  "scene.op.nand": { ru: "И-НЕ", kk: "ЖӘНЕ-ЕМЕС" },
  "scene.op.nor": { ru: "ИЛИ-НЕ", kk: "НЕМЕСЕ-ЕМЕС" },
  "scene.op.xor": { ru: "XOR", kk: "XOR" },

  // Описания для экранных дикторов
  "scene.circuit.aria": { ru: "Логическая схема", kk: "Логикалық схема" },
  "scene.flow.aria": { ru: "Блок-схема", kk: "Блок-схема" },
  "scene.pixels.aria": { ru: "Растровая картинка {w}×{h} пикселей", kk: "Растрлық сурет: {w}×{h} пиксель" },
  "scene.pixels.row": { ru: "Строка {n}", kk: "{n}-жол" },

  // Круги Эйлера (сцена venn): описание для экранных дикторов. После названий множеств окончаний нет (имена бывают любые).
  "scene.venn.aria": { ru: "Круги Эйлера. Множества: {sets}.", kk: "Эйлер дөңгелектері. Жиындар: {sets}." },
  "scene.venn.universe": { ru: "Универсум: {name}.", kk: "Әмбебап жиын: {name}." },
  "scene.venn.values": { ru: "В областях: {list}.", kk: "Аймақтарда: {list}." },
  "scene.venn.highlight": { ru: "Выделено: {list}.", kk: "Бөлектелгені: {list}." },
  "scene.venn.only": { ru: "только {x}", kk: "тек {x}" },
  "scene.venn.and2": { ru: "{a} и {b} (пересечение)", kk: "{a} және {b} (қиылысу)" },
  "scene.venn.and3": { ru: "{a} и {b}, без {c}", kk: "{a} және {b}, {c} жоқ" },
  "scene.venn.all3": { ru: "{a}, {b} и {c} одновременно", kk: "{a}, {b} және {c} бірден" },
  "scene.venn.out2": { ru: "ни {a}, ни {b}", kk: "{a} емес, {b} емес" },
  "scene.venn.out3": { ru: "ни {a}, ни {b}, ни {c}", kk: "{a} емес, {b} емес, {c} емес" },
} satisfies Record<string, L>;
