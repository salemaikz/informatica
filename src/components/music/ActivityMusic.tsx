"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { enterMusic, exitMusic, setMusicPref } from "@/lib/music";
import type { MusicActivity } from "@/lib/music-pref";

/**
 * Невидимый «владелец» музыки: пока смонтирован и active, экрану разрешена фоновая музыка
 * (игра — Bit Arcade, урок и тренировка — Quiet Focus). Сам не рисует ничего; выключатель — MusicToggle.
 * В пробном ЕНТ и тестах не монтируется (или active=false) — там тишина.
 */
export function ActivityMusic({ mode, active = true }: { mode: MusicActivity; active?: boolean }) {
  const music = useApp((s) => s.profile.music);
  const sound = useApp((s) => s.profile.sound);
  const [owner] = useState(() => Symbol("activity-music"));
  useEffect(() => {
    setMusicPref(music, sound);
  }, [music, sound]);
  useEffect(() => {
    if (!active) return;
    setMusicPref(useApp.getState().profile.music, useApp.getState().profile.sound);
    enterMusic(owner, mode);
    return () => exitMusic(owner);
  }, [active, mode, owner]);
  return null;
}
