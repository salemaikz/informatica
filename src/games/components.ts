"use client";

import { lazy, type LazyExoticComponent } from "react";
import type { GameComponent } from "./types";

// Компоненты мини-игр: id → ленивый компонент. Метаданные — в registry.ts.
export const GAME_COMPONENTS: Record<string, LazyExoticComponent<GameComponent>> = {};
