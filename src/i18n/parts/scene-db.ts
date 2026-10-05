import type { L } from "@/lib/types";

// Этап 16Б, волна 3 (сцена db-schema и расширения table; ТЗ — docs/specs/stage16b-wave3*.md). Ключи — `scene.db.*, scene.table.*`.
// Казахский — литературный, термины по глоссарию НЦТ, без глаголов с родом в русском. Вычитано моделью, носителем — нет.
export const sceneDbDict = {
  // --- схема БД: пересказ для скринридера и подписи значков ---
  "scene.db.aria": { ru: "Схема базы данных. Таблицы: {tables}.", kk: "Деректер қорының сызбасы. Кестелер: {tables}." },
  "scene.db.ariaTable": { ru: "{name} — поля: {fields}", kk: "{name} — өрістер: {fields}" },
  "scene.db.ariaLinks": { ru: " Связи: {links}.", kk: " Байланыстар: {links}." },
  "scene.db.ariaLink": { ru: "{from} ссылается на {to}, связь {card}", kk: "{from} өрісі {to} өрісіне сілтейді, байланыс {card}" },
  "scene.db.ariaHl": { ru: " Выделено: {items}.", kk: " Бөлектелген: {items}." },
  "scene.db.pk": { ru: "первичный ключ", kk: "бастапқы кілт" },
  "scene.db.fk": { ru: "внешний ключ", kk: "сыртқы кілт" },
  // --- таблица: подписи для скринридера (состояния строк, «было»), строка формул ---
  "scene.table.struck": { ru: "удалённая строка", kk: "жойылған жол" },
  "scene.table.dim": { ru: "строка не учитывается", kk: "жол ескерілмейді" },
  "scene.table.rejected": { ru: "строка отклонена", kk: "жол қабылданбады" },
  "scene.table.new": { ru: "новая строка", kk: "жаңа жол" },
  "scene.table.was": { ru: "было", kk: "бұрын" },
  "scene.table.range": { ru: "Выделен диапазон {range}", kk: "{range} ауқымы бөлектелген" },
  "scene.table.arrow": { ru: "Стрелка: {from} → {to}", kk: "Көрсеткі: {from} → {to}" },
  "scene.table.joinMatch": { ru: "Совпадают строки: {pairs}", kk: "Сәйкес жолдар: {pairs}" },
  "scene.table.formulaBar": { ru: "Строка формул", kk: "Формулалар жолы" },
} satisfies Record<string, L>;
