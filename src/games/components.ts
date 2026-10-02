"use client";

import { lazy, type LazyExoticComponent } from "react";
import type { GameComponent } from "./types";

// Компоненты мини-игр: id → ленивый компонент (код игры грузится только при её открытии).
export const GAME_COMPONENTS: Record<string, LazyExoticComponent<GameComponent>> = {
  "bit-rush": lazy(() => import("./bit-rush/Game")),
  "bit-flip": lazy(() => import("./bit-flip/Game")),
  "bit-sort": lazy(() => import("./bit-sort/Game")),
  "bug-hunt": lazy(() => import("./bug-hunt/Game")),
};
