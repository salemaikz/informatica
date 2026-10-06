// Чистая логика фоновой музыки (без React и без Audio) — покрыта tests/music.test.ts.

/** Трек: bit-arcade — для игр, quiet-focus — для урока и тренировки. */
export type MusicTrackId = "arcade" | "focus";
/** Что сейчас идёт на экране: игра или учёба (урок, тренировка). */
export type MusicActivity = "game" | "focus";
/** Выбор трека в профиле: auto — по занятию. */
export type MusicTrackPref = "auto" | MusicTrackId;
export interface MusicPref {
  enabled: boolean;
  track: MusicTrackPref;
}

export const MUSIC_TRACK_PREFS: readonly MusicTrackPref[] = ["auto", "arcade", "focus"];
export const DEFAULT_MUSIC: MusicPref = { enabled: false, track: "auto" };

/** Файлы треков: ogg (Chrome, Firefox) и m4a (Safari); оба — сжатые петли ~64 кбит/с. */
export const MUSIC_FILES: Record<MusicTrackId, { ogg: string; m4a: string }> = {
  arcade: { ogg: "/media/music/bit-arcade.ogg", m4a: "/media/music/bit-arcade.m4a" },
  focus: { ogg: "/media/music/quiet-focus.ogg", m4a: "/media/music/quiet-focus.m4a" },
};

/** Настройка из сохранения (мусор → выключено, трек «авто»). */
export function sanitizeMusic(v: unknown): MusicPref {
  if (!v || typeof v !== "object") return { ...DEFAULT_MUSIC };
  const o = v as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    track: (MUSIC_TRACK_PREFS as readonly unknown[]).includes(o.track) ? (o.track as MusicTrackPref) : "auto",
  };
}

/** Какой трек играть: выбор в профиле, а «авто» — по занятию (игры — Bit Arcade, учёба — Quiet Focus). */
export function resolveTrack(track: MusicTrackPref, activity: MusicActivity): MusicTrackId {
  if (track === "arcade" || track === "focus") return track;
  return activity === "game" ? "arcade" : "focus";
}

export interface MusicInputs {
  pref: MusicPref;
  /** Общий переключатель «Звук» в профиле. */
  sound: boolean;
  /** Экран, которому разрешена музыка; null — тишина (пробный ЕНТ, тесты, итоги, остальные страницы). */
  activity: MusicActivity | null;
  /** Идёт видео урока. */
  videoPlaying: boolean;
  /** Вкладка скрыта. */
  hidden: boolean;
}

/** Играть ли сейчас: включено, звук не выключен, есть занятие, нет видео и вкладка видна. */
export function shouldPlayMusic(i: MusicInputs): boolean {
  return i.pref.enabled && i.sound && i.activity !== null && !i.videoPlaying && !i.hidden;
}
