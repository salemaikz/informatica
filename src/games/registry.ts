import type { GameMeta } from "./types";

// Реестр мини-игр. Компоненты грузятся лениво — только когда ученик открыл игру.
export const GAMES: GameMeta[] = [];

export function gameById(id: string): GameMeta | undefined {
  return GAMES.find((g) => g.id === id);
}
