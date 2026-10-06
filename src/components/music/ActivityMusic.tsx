"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Music2, VolumeX } from "lucide-react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { enterActivityMusic, exitActivityMusic, getMusicSnapshot, getServerMusicSnapshot, setMusicEnabled, setMusicTrack, subscribeMusic, type MusicTrack } from "@/lib/sound";
import { musicStrings as s } from "./strings";

export function ActivityMusic({ mode, active = true, className }: { mode: "game" | "test"; active?: boolean; className?: string }) {
  const { l } = useT();
  const [owner] = useState(() => Symbol("activity-music"));
  const music = useSyncExternalStore(subscribeMusic, getMusicSnapshot, getServerMusicSnapshot);
  useEffect(() => {
    if (!active) return;
    enterActivityMusic(owner, mode === "game" ? "game" : "focus");
    return () => exitActivityMusic(owner);
  }, [active, mode, owner]);

  return <div className={cn("flex flex-wrap items-center gap-2", className)}>
    <button type="button" aria-pressed={music.enabled && music.playing} onClick={() => setMusicEnabled(!(music.enabled && music.playing))} className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", music.playing ? "border-primary/30 bg-primary-soft text-primary" : "border-border bg-surface text-muted")}>
      {music.playing ? <Music2 size={17} aria-hidden /> : <VolumeX size={17} aria-hidden />}{l(music.playing ? s.off : s.on)}
    </button>
    <select aria-label={l(s.track)} value={music.track} onChange={(event) => setMusicTrack(event.currentTarget.value as MusicTrack)} className="min-h-11 min-w-0 max-w-full rounded-xl border border-border bg-surface px-3 text-xs font-bold text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <option value="game">{l(s.game)}</option><option value="focus">{l(s.focus)}</option>
    </select>
    {music.unavailable && <p role="status" className="w-full text-xs text-muted">{l(s.unavailable)}</p>}
  </div>;
}
