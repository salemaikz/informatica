import { BookOpen, ListOrdered, Scale, Zap, type LucideIcon } from "lucide-react";
import type { DictKey } from "@/i18n/dict";
import { ENT_TOPICS } from "@/content/ent-topics";
import { UNITS } from "@/content/course-map";
import { BAND_LEVELS, DUEL_MODES } from "@/lib/duel/modes";
import type { DuelBand, DuelModeId } from "@/lib/duel/types";
import type { L } from "@/lib/types";

// Подписи и иконки режимов дуэли для экранов (в lib/duel/modes.ts иконка — только строка-имя).

export const MODE_ICON: Record<DuelModeId, LucideIcon> = { blitz: Zap, truth: Scale, ten: ListOrdered, topic: BookOpen };

export const MODE_TITLE: Record<DuelModeId, DictKey> = {
  blitz: "duel.mode.blitz",
  truth: "duel.mode.truth",
  ten: "duel.mode.ten",
  topic: "duel.mode.topic",
};

type T = (key: DictKey, params?: Record<string, string | number>) => string;

/** Короткое описание режима: секунды общих часов или число заданий. */
export function modeDesc(t: T, mode: DuelModeId): string {
  const m = DUEL_MODES[mode];
  const sec = Math.round((m.clockMs ?? 0) / 1000);
  switch (mode) {
    case "blitz":
      return t("duel.mode.blitz.desc", { sec });
    case "truth":
      return t("duel.mode.truth.desc", { sec });
    case "ten":
      return t("duel.mode.ten.desc", { n: m.n });
    case "topic":
      return t("duel.mode.topic.desc", { n: m.n });
  }
}

/** Подпись полосы бота: «ур. 5–9» / «ур. 20+». */
export function bandLabel(t: T, band: DuelBand): string {
  const b = BAND_LEVELS[band];
  return b.to == null ? t("duel.bot.levelUp", { from: b.from }) : t("duel.bot.level", { from: b.from, to: b.to });
}

/** Название темы: тема ЕНТ или раздел курса (лёгкие каталоги, без содержимого уроков). null — неизвестная тема. */
export function topicTitle(topic: string): L | "school" | null {
  const ent = ENT_TOPICS.find((x) => x.id === topic);
  if (ent) return ent.title;
  if (topic === "school") return "school";
  return UNITS.find((u) => u.id === topic)?.title ?? null;
}
