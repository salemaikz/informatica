// Чистая логика сцены layers: состояние слоя относительно подсветки.

export type LayerState = "active" | "dim" | "normal";

/** Подсвеченный слой — active; когда что-то подсвечено, остальные приглушаются. Без подсветки — все обычные. */
export function layerState(index: number, highlight: number | undefined): LayerState {
  if (highlight === undefined) return "normal";
  return index === highlight ? "active" : "dim";
}
