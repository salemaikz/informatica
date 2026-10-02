import type { L } from "@/lib/types";

// Строки раздела «холст и черновик» (ru + kk). Казахский — литературный, термины по глоссарию НЦТ.
// Вычитано моделью, носителем — нет.
export const canvasDict = {
  "canvas.marker": { ru: "Маркер", kk: "Маркер" },
  "canvas.color.ink": { ru: "Чернила", kk: "Сия" },
  "canvas.color.blue": { ru: "Синий", kk: "Көк" },
  "canvas.color.red": { ru: "Красный", kk: "Қызыл" },
  "canvas.color.green": { ru: "Зелёный", kk: "Жасыл" },
  "canvas.color.orange": { ru: "Оранжевый", kk: "Қызғылт сары" },
  "canvas.color.yellow": { ru: "Жёлтый маркер", kk: "Сары маркер" },
  "canvas.size": { ru: "Толщина {n}", kk: "Қалыңдығы {n}" },
  "canvas.eraserSize": { ru: "Размер ластика {n}", kk: "Өшіргіш өлшемі {n}" },
  "canvas.colors": { ru: "Цвет", kk: "Түс" },
  "canvas.sizes": { ru: "Размер", kk: "Өлшем" },
  "canvas.fullscreen": { ru: "На весь экран", kk: "Толық экранға" },
  "canvas.exitFullscreen": { ru: "Выйти из полного экрана", kk: "Толық экраннан шығу" },
  "canvas.toNotes": { ru: "В конспект", kk: "Конспектке" },
  "canvas.noteTitle": { ru: "Черновик, лист {n}", kk: "Қаралама, {n}-парақ" },
  "canvas.addPage": { ru: "Добавить лист", kk: "Парақ қосу" },
  "canvas.deletePage": { ru: "Удалить лист", kk: "Парақты жою" },
  "canvas.deleteConfirm": { ru: "Удалить?", kk: "Жоямыз ба?" },
  "canvas.pages": { ru: "Листы черновика", kk: "Қаралама парақтары" },
} satisfies Record<string, L>;
