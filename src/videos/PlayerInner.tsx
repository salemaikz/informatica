"use client";

import { Player } from "@remotion/player";
import { Captions, CaptionsOff, Play } from "lucide-react";
import { useState } from "react";
import type { Lang } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { VIDEOS } from "./registry";

export default function PlayerInner({ videoId, lang, title }: { videoId: string; lang: Lang; title?: string }) {
  const { t } = useT();
  const [subtitles, setSubtitles] = useState(true);
  const meta = VIDEOS[videoId];
  if (!meta) return null;
  return (
    <div className="overflow-hidden rounded-3xl border-2 border-border bg-surface">
      <Player
        component={meta.component}
        inputProps={{ lang, subtitles }}
        durationInFrames={meta.durationInFrames(lang)}
        compositionWidth={meta.width}
        compositionHeight={meta.height}
        fps={meta.fps}
        controls
        clickToPlay
        allowFullscreen
        showVolumeControls
        spaceKeyToPlayOrPause
        acknowledgeRemotionLicense
        showPosterWhenUnplayed
        renderPoster={() => (
          <div className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-4 bg-bg/80 backdrop-blur-[2px]">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white shadow-[0_6px_0_var(--primary-strong)]">
              <Play size={36} fill="currentColor" className="ml-1" />
            </span>
            {title && <span className="px-6 text-center text-xl font-extrabold">{title}</span>}
          </div>
        )}
        style={{ width: "100%", aspectRatio: `${meta.width} / ${meta.height}` }}
      />
      <div className="flex justify-end border-t-2 border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setSubtitles((s) => !s)}
          aria-pressed={subtitles}
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-sm font-bold text-muted hover:bg-surface-2 aria-pressed:text-primary"
        >
          {subtitles ? <Captions size={18} /> : <CaptionsOff size={18} />} {t("video.subtitles")}
        </button>
      </div>
    </div>
  );
}
