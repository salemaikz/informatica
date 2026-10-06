"use client";

import { Heart, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { useLevel } from "@/lib/hooks";
import { playSound } from "@/lib/sound";
import type { DuelBand, DuelModeId } from "@/lib/duel/types";
import { useT } from "@/i18n/useT";
import { Avatar } from "@/components/app/Avatar";
import { LevelBadge } from "@/components/app/LevelBadge";
import { AvatarFrame } from "@/components/cosmetics/AvatarFrame";
import { TitleTag } from "@/components/cosmetics/TitleTag";
import { Mascot } from "@/components/mascot/Mascot";
import { useHearts } from "@/components/economy/useEconomy";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { BotChip } from "./BotChip";
import { MODE_ICON, MODE_TITLE, bandLabel } from "./mode-meta";
import { RivalAvatar, RivalChip, useRivalName, type Rival } from "./rival";

// Экран «VS» и отсчёт 3-2-1 перед матчем (этап 16Д): карточка ученика (имя из профиля, уровень, надетые рамка и титул)
// против соперника (rival.tsx): Бит (маскот, чип «бот», полоса уровня), запись друга (чип «запись»), запись своего вызова
// или живой игрок (Ф4: карточка с сервера). Сердечко списывает DuelPlay / ChallengePlay / LivePlay в конце отсчёта (onGo — из таймера). Живой матч: отсчёт привязан к серверному старту (goAt — локальное
// время старта), пока соперник не готов — вместо отсчёта waitText.

/** Сколько показываем «VS» до отсчёта, мс. */
export const VS_INTRO_MS = 1200;
/** Шаг отсчёта, мс. */
export const COUNT_STEP_MS = 1000;

export function VsScreen({
  mode,
  topicLabel,
  band,
  running,
  onGo,
  onClose,
  rival,
  goAt,
  waitText,
}: {
  mode: DuelModeId;
  topicLabel?: string;
  band: DuelBand;
  /** Соперник: запись друга, запись своего вызова или живой игрок; по умолчанию — Бит. */
  rival?: Rival;
  /** false — отсчёт стоит (например, открыто окно «Сердечки закончились»). */
  running: boolean;
  onGo: () => void;
  onClose: () => void;
  /** Когда «Старт!» по часам устройства (живой матч); нет — VS 1,2 с и отсчёт 3-2-1 от показа. */
  goAt?: number;
  /** Отсчёт ещё не идёт (running=false): что показать вместо него. */
  waitText?: string;
}) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const hearts = useHearts();
  const sound = useApp((s) => s.profile.sound);
  const name = useApp((s) => s.profile.name);
  const avatar = useApp((s) => s.profile.avatar);
  const equipped = useApp((s) => s.cosmetics.equipped);
  const { level } = useLevel();
  const rivalName = useRivalName();
  // null — ещё «VS»; 3, 2, 1; 0 — «Старт!».
  const [count, setCount] = useState<number | null>(null);
  const goRef = useRef(onGo);
  useEffect(() => {
    goRef.current = onGo;
  });

  useEffect(() => {
    if (!running) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, Math.max(0, ms)));
    // Живой матч: «Старт!» ровно в goAt; опоздали к числу — оно пропускается.
    const base = goAt != null ? goAt - Date.now() - 3 * COUNT_STEP_MS : VS_INTRO_MS;
    [3, 2, 1].forEach((n, k) => {
      const ms = base + k * COUNT_STEP_MS;
      if (goAt != null && ms < -COUNT_STEP_MS / 2) return;
      at(ms, () => {
        setCount(n);
        if (sound) playSound("tap");
      });
    });
    at(base + 3 * COUNT_STEP_MS, () => {
      setCount(0);
      goRef.current();
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [running, sound, goAt]);

  const Icon = MODE_ICON[mode];
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-2xl items-center px-4">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
          <X size={24} />
        </button>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-5 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
        <p className="flex max-w-full items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-sm font-extrabold text-ink-primary">
          <Icon size={16} aria-hidden className="shrink-0" />
          <span className="truncate">{topicLabel ? `${t(MODE_TITLE[mode])}: ${topicLabel}` : t(MODE_TITLE[mode])}</span>
        </p>

        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-stretch gap-2" data-testid="duel-vs">
          <div className={cn("flex min-w-0 flex-col items-center gap-2 rounded-3xl border-2 border-primary/40 bg-surface p-3 text-center", !reduce && "animate-rise-in")}>
            <AvatarFrame frame={equipped.frame} size={60} reserve>
              <Avatar config={avatar} name={name} size={60} />
            </AvatarFrame>
            <p className="w-full truncate font-extrabold">{name || t("duel.you")}</p>
            <LevelBadge level={level} size="sm" />
            <TitleTag title={equipped.title} size="sm" className="max-w-full" />
          </div>
          <span className="self-center text-sm font-black uppercase text-muted">{t("duel.vs")}</span>
          {rival && rival.kind !== "bot" ? (
            <div className={cn("flex min-w-0 flex-col items-center gap-2 rounded-3xl border-2 border-border bg-surface p-3 text-center", !reduce && "animate-rise-in")}
              data-testid={rival.kind === "human" ? "duel-opp-card" : "duel-vs-rival"}
            >
              <span className="flex h-[75px] w-[75px] items-center justify-center">
                <RivalAvatar rival={rival} size={60} />
              </span>
              <p className="line-clamp-3 w-full font-extrabold [overflow-wrap:anywhere]" data-testid={rival.kind === "human" ? "duel-opp-name" : undefined}>
                {rivalName(rival)}
              </p>
              <RivalChip rival={rival} />
              {rival.kind !== "solo" && rival.card && <LevelBadge level={rival.card.lv} size="sm" />}
              {rival.kind !== "solo" && rival.card?.title && <TitleTag title={rival.card.title} size="sm" className="max-w-full" />}
            </div>
          ) : (
            <div className={cn("flex min-w-0 flex-col items-center gap-2 rounded-3xl border-2 border-border bg-surface p-3 text-center", !reduce && "animate-rise-in")}>
              <span className="flex h-[75px] w-[75px] items-center justify-center">
                <Mascot mood="happy" size={64} />
              </span>
              <p className="flex max-w-full items-center gap-1.5 font-extrabold">
                <span className="truncate">{t("duel.bot.name")}</span>
              </p>
              <BotChip />
              <p className="text-xs font-extrabold text-muted">{bandLabel(t, band)}</p>
            </div>
          )}
        </div>

        <div className="flex min-h-28 flex-1 items-center justify-center" aria-live="polite">
          {count === null && !running && waitText && (
            <p className="font-bold text-muted motion-safe:animate-pulse" role="status" data-testid="duel-vs-wait">
              {waitText}
            </p>
          )}
          {count !== null && (
            <span key={count} className={cn("font-black tabular-nums text-primary", count === 0 ? "text-4xl" : "text-7xl", !reduce && "animate-pop")}>
              {count === 0 ? t("duel.go") : count}
            </span>
          )}
        </div>

        {rival?.kind !== "human" && (
          <p className="text-center text-xs font-semibold text-muted">
            {t(rival?.kind === "ghost" ? "duel.ch.ghostNote" : rival?.kind === "solo" ? "duel.rec.note" : "duel.bot.note")}
          </p>
        )}
        {!hearts.unlimited && (
          <p className="flex items-center gap-2 rounded-2xl bg-heart-soft px-3 py-2 text-sm font-bold text-ink-heart">
            <Heart size={16} fill="currentColor" className="shrink-0" aria-hidden />
            {t("duel.cost.note")}
          </p>
        )}
      </main>
    </div>
  );
}
