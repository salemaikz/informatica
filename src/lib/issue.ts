// «Сообщить об ошибке»: что именно ученик считает ошибкой (задание или ответ ИИ) и где это было.
// Тип общий для кнопки (components/issue), маршрута /api/issue и мест, где кнопка стоит.

export type IssueKind = "task" | "ai";

export type IssueWhere = "lesson" | "drill" | "exam" | "chat" | "panel";

export interface IssueTarget {
  kind: IssueKind;
  where: IssueWhere;
  /** id задания или шага (для ответа ИИ — id задания, к которому был ответ, если есть). */
  itemId?: string;
  lessonId?: string;
  /** Короткий текст для разбора: условие задания или ответ ИИ (на сервере обрезается). */
  snippet?: string;
}
