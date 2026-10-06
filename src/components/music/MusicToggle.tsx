"use client";

import { Music, Music2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { getMusicSnapshot, getServerMusicSnapshot, subscribeMusic } from "@/lib/music";
import { useApp } from "@/lib/store";

/** Состояние музыки для экрана: включена ли, играет ли, есть ли экран-владелец. */
export function useMusicState() {
  const music = useApp((s) => s.profile.music);
  const sound = useApp((s) => s.profile.sound);
  const snap = useSyncExternalStore(subscribeMusic, getMusicSnapshot, getServerMusicSnapshot);
  const update = useApp((s) => s.updateProfile);
  return {
    enabled: music.enabled,
    sound,
    activity: snap.activity,
    playing: snap.playing,
    unavailable: snap.unavailable,
    toggle: () => update({ music: { ...music, enabled: !music.enabled } }),
  };
}

/**
 * Кнопка-выключатель музыки. «icon» — квадрат 40×40 для шапки игры; «row» — строка с подписью (панель инструментов).
 * Не рисует ничего, если у экрана нет музыки (нет владельца, например пробный ЕНТ).
 */
export function MusicToggle({ variant = "icon", className }: { variant?: "icon" | "row"; className?: string }) {
  const { t } = useT();
  const m = useMusicState();
  if (!m.activity) return null;
  const on = m.enabled;
  const label = t(on ? "music.off" : "music.on");
  const Icon = on && m.playing ? Music2 : Music;
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={m.toggle}
        aria-pressed={on}
        aria-label={t("music.title")}
        title={label}
        data-testid="music-toggle"
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
          on ? "bg-primary-soft text-ink-primary" : "text-muted hover:bg-surface-2 hover:text-text",
          className,
        )}
      >
        <Icon size={22} aria-hidden />
      </button>
    );
  }
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={m.toggle}
        aria-pressed={on}
        data-testid="music-toggle"
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-2xl border-2 px-3 text-left text-sm font-extrabold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
          on ? "border-primary/30 bg-primary-soft text-ink-primary" : "border-border bg-surface text-muted hover:bg-surface-2",
        )}
      >
        <Icon size={20} className="shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{t("music.title")}</span>
        <span className="shrink-0 text-xs">{label}</span>
      </button>
      {on && !m.sound && (
        <p role="status" className="text-xs font-semibold text-muted">
          {t("music.needSound")}
        </p>
      )}
      {on && m.sound && m.unavailable && (
        <p role="status" className="text-xs font-semibold text-muted">
          {t("music.unavailable")}
        </p>
      )}
    </div>
  );
}
