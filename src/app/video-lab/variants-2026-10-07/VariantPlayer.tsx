"use client";

import { Player, type PlayerRef, type CallbackListener } from "@remotion/player";
import { Maximize, Minimize, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { playerStrings as s } from "@/videos/player-strings";
import type { VariantLanguage, VariantMeta } from "@/videos/variants-2026-10-07/catalog";

const clock = (frame: number) => `${Math.floor(frame / 1800)}:${String(Math.floor(frame / 30) % 60).padStart(2, "0")}`;
const control = "flex size-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-primary";

export default function VariantPlayer({ meta, lang, music }: { meta: VariantMeta; lang: VariantLanguage; music: boolean }) {
  const player = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fullscreenContainer, setFullscreenContainer] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const ref = player.current;
    if (!ref) return;
    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);
    const time: CallbackListener<"timeupdate"> = (event) => setFrame(event.detail.frame);
    const seek: CallbackListener<"seeked"> = (event) => setFrame(event.detail.frame);
    const full: CallbackListener<"fullscreenchange"> = (event) => setFullscreenContainer(event.detail.isFullscreen ? ref.getContainerNode() : null);
    ref.addEventListener("play", play); ref.addEventListener("pause", pause); ref.addEventListener("ended", pause);
    ref.addEventListener("timeupdate", time); ref.addEventListener("seeked", seek); ref.addEventListener("fullscreenchange", full);
    return () => {
      ref.removeEventListener("play", play); ref.removeEventListener("pause", pause); ref.removeEventListener("ended", pause);
      ref.removeEventListener("timeupdate", time); ref.removeEventListener("seeked", seek); ref.removeEventListener("fullscreenchange", full);
    };
  }, []);
  const toggle = (event?: SyntheticEvent) => { const ref = player.current; if (ref?.isPlaying()) ref.pause(); else ref?.play(event); };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === " " || event.key.toLowerCase() === "k") { event.preventDefault(); toggle(event); }
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault(); player.current?.seekTo(Math.min(meta.frames - 1, Math.max(0, (player.current?.getCurrentFrame() ?? 0) + (event.key === "ArrowLeft" ? -150 : 150))));
    }
  };
  const controls = <div role="group" aria-label={s.controls[lang]} onPointerDown={(event) => event.stopPropagation()} className={`flex items-center gap-3 border-t border-border bg-surface p-3 ${fullscreenContainer ? "absolute inset-x-0 bottom-0 z-50" : ""}`}>
    <button type="button" aria-label={s[playing ? "pause" : "play"][lang]} onClick={toggle} className={control}>{playing ? <Pause size={20} aria-hidden /> : <Play size={20} aria-hidden />}</button>
    <input type="range" aria-label={s.seek[lang]} aria-valuetext={`${clock(frame)} / ${clock(meta.frames)}`} min={0} max={meta.frames - 1} step={1} value={frame} onChange={(event) => player.current?.seekTo(event.currentTarget.valueAsNumber)} className="h-11 min-w-0 flex-1 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-primary" />
    <span className="shrink-0 font-mono text-xs tabular-nums text-muted" aria-hidden>{clock(frame)} / {clock(meta.frames)}</span>
    <button type="button" aria-label={s[fullscreenContainer ? "exitFullscreen" : "fullscreen"][lang]} onClick={() => { const ref = player.current; if (ref?.isFullscreen()) ref.exitFullscreen(); else ref?.requestFullscreen(); }} className={control}>{fullscreenContainer ? <Minimize size={20} aria-hidden /> : <Maximize size={20} aria-hidden />}</button>
  </div>;
  return <div className="overflow-hidden rounded-3xl border border-border bg-surface">
    <div role="group" aria-label={meta.title[lang]} tabIndex={0} onKeyDown={keyboard} className="focus-visible:outline-2 focus-visible:outline-primary">
      <div data-preview-canvas={meta.id}><Player ref={player} component={meta.component} inputProps={{ lang, music }} durationInFrames={meta.frames} compositionWidth={meta.width} compositionHeight={meta.height} fps={30} controls={false} clickToPlay allowFullscreen spaceKeyToPlayOrPause={false} initiallyMuted={false} moveToBeginningWhenEnded={false} acknowledgeRemotionLicense style={{ width: "100%", aspectRatio: `${meta.width}/${meta.height}` }} /></div>
    </div>
    {fullscreenContainer ? createPortal(controls, fullscreenContainer) : controls}
  </div>;
}
