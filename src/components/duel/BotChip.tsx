"use client";

import { Bot } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";

/**
 * Метка «бот» у Бита-соперника (docs/specs/duels.md §4): во всех местах — VS, матч, итоги, история. Нейтральный цвет,
 * не фиолетовый `ai`: бот играет по таблице, это не ИИ.
 */
export function BotChip({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <span
      data-testid="bot-chip"
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-border bg-surface-2 px-2 py-px text-[11px] font-extrabold text-muted", className)}
    >
      <Bot size={12} strokeWidth={2.6} aria-hidden />
      {t("duel.bot.chip")}
    </span>
  );
}
