// Цвет уровня освоения навыка (токены, обе темы): итоги урока и «Практика».
// Отдельный модуль: «Практика» не тянет за собой экран итогов урока с содержимым всех уроков (этап 16).

export const MASTERY_COLOR = {
  new: "var(--border)",
  weak: "var(--danger)",
  progress: "var(--warning)",
  mastered: "var(--success)",
} as const;
