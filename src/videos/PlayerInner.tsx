"use client";

import { Player, type PlayerRef, type CallbackListener } from "@remotion/player";
import { Captions, CaptionsOff, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { Lang } from "@/lib/types";
import { cn } from "@/lib/cn";
import { VIDEOS, type VideoMeta } from "./registry";
import { playerStrings as s } from "./player-strings";

const clock = (frame: number, fps: number) => {
  const seconds = Math.floor(frame / fps);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
const controlClass = "inline-flex h-11 min-w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function LocalPlayer({ meta, lang, title }: { meta: VideoMeta; lang: Lang; title?: string }) {
  const player = useRef<PlayerRef>(null);
  const [subtitles, setSubtitles] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenContainer, setFullscreenContainer] = useState<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState(0);
  const duration = meta.durationInFrames(lang);
  const label = (key: keyof typeof s) => s[key][lang];

  useEffect(() => {
    const ref = player.current;
    if (!ref) return;
    const play: CallbackListener<"play"> = () => setPlaying(true);
    const pause: CallbackListener<"pause"> = () => setPlaying(false);
    const ended: CallbackListener<"ended"> = () => setPlaying(false);
    const time: CallbackListener<"timeupdate"> = (event) => setFrame(event.detail.frame);
    const seek: CallbackListener<"seeked"> = (event) => setFrame(event.detail.frame);
    const mute: CallbackListener<"mutechange"> = (event) => setMuted(event.detail.isMuted);
    const full: CallbackListener<"fullscreenchange"> = (event) => {
      setFullscreen(event.detail.isFullscreen);
      setFullscreenContainer(event.detail.isFullscreen ? ref.getContainerNode() : null);
    };
    ref.addEventListener("play", play);
    ref.addEventListener("pause", pause);
    ref.addEventListener("ended", ended);
    ref.addEventListener("timeupdate", time);
    ref.addEventListener("seeked", seek);
    ref.addEventListener("mutechange", mute);
    ref.addEventListener("fullscreenchange", full);
    return () => {
      ref.removeEventListener("play", play);
      ref.removeEventListener("pause", pause);
      ref.removeEventListener("ended", ended);
      ref.removeEventListener("timeupdate", time);
      ref.removeEventListener("seeked", seek);
      ref.removeEventListener("mutechange", mute);
      ref.removeEventListener("fullscreenchange", full);
    };
  }, []);

  const toggle = (event?: SyntheticEvent) => {
    const ref = player.current;
    if (ref?.isPlaying()) ref.pause(); else ref?.play(event);
  };
  const seekTo = (value: number) => player.current?.seekTo(Math.min(duration - 1, Math.max(0, value)));
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    // Кнопки и range сохраняют нативное управление с клавиатуры.
    if (event.target !== event.currentTarget) return;
    const ref = player.current;
    if (!ref) return;
    if (event.key === " " || event.key.toLowerCase() === "k") { event.preventDefault(); toggle(event); }
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); seekTo(ref.getCurrentFrame() + (event.key === "ArrowLeft" ? -5 : 5) * meta.fps); }
    else if (event.key === "Home" || event.key === "End") { event.preventDefault(); seekTo(event.key === "Home" ? 0 : duration - 1); }
  };

  const controls = <div role="group" aria-label={label("controls")} onPointerDown={(event) => event.stopPropagation()} className={cn("border-t-2 border-border bg-surface px-3 py-2", fullscreen && "absolute inset-x-0 bottom-0 z-50 bg-surface/95")}>
    <div className="flex items-center gap-3">
      <input type="range" min={0} max={duration - 1} step={1} value={frame} aria-label={label("seek")} aria-valuetext={`${clock(frame, meta.fps)} / ${clock(duration, meta.fps)}`} onChange={(event) => seekTo(event.currentTarget.valueAsNumber)} className="h-8 min-w-0 flex-1 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
      <span aria-hidden className="shrink-0 font-mono text-xs tabular-nums text-muted">{clock(frame, meta.fps)} / {clock(duration, meta.fps)}</span>
    </div>
    <div className="flex items-center gap-1">
      <button type="button" onClick={toggle} aria-label={label(playing ? "pause" : "play")} title={label(playing ? "pause" : "play")} className={controlClass}>{playing ? <Pause size={20} fill="currentColor" aria-hidden /> : <Play size={20} fill="currentColor" aria-hidden />}</button>
      <button type="button" onClick={() => { const ref = player.current; if (ref?.isMuted()) ref.unmute(); else ref?.mute(); }} aria-label={label(muted ? "unmute" : "mute")} title={label(muted ? "unmute" : "mute")} className={controlClass}>{muted ? <VolumeX size={20} aria-hidden /> : <Volume2 size={20} aria-hidden />}</button>
      <button type="button" onClick={() => setSubtitles((value) => !value)} aria-pressed={subtitles} className={cn(controlClass, "gap-1.5 px-2.5 text-xs font-bold aria-pressed:text-primary")}>{subtitles ? <Captions size={18} aria-hidden /> : <CaptionsOff size={18} aria-hidden />}{label("subtitles")}</button>
      <button type="button" onClick={() => { const ref = player.current; if (ref?.isFullscreen()) ref.exitFullscreen(); else ref?.requestFullscreen(); }} aria-label={label(fullscreen ? "exitFullscreen" : "fullscreen")} title={label(fullscreen ? "exitFullscreen" : "fullscreen")} className={cn(controlClass, "ml-auto")}>{fullscreen ? <Minimize size={20} aria-hidden /> : <Maximize size={20} aria-hidden />}</button>
    </div>
  </div>;
  return <div className="overflow-hidden rounded-3xl border-2 border-border bg-surface">
    <div role="group" aria-label={title ?? label("controls")} tabIndex={0} onKeyDown={keyboard} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <Player ref={player} component={meta.component} inputProps={{ lang, subtitles }} durationInFrames={duration} compositionWidth={meta.width} compositionHeight={meta.height} fps={meta.fps} controls={false} clickToPlay allowFullscreen showVolumeControls={false} spaceKeyToPlayOrPause={false} initiallyMuted={false} acknowledgeRemotionLicense showPosterWhenUnplayed renderPoster={() => (
        <button type="button" aria-label={label("play")} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); player.current?.play(event); }} className="absolute inset-0 flex w-full cursor-pointer flex-col items-center justify-center gap-4 bg-bg/80 backdrop-blur-[2px] focus-visible:outline-3 focus-visible:outline-offset-[-6px] focus-visible:outline-primary">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white shadow-[0_6px_0_var(--primary-strong)]"><Play size={36} fill="currentColor" className="ml-1" aria-hidden /></span>
          {title && <span className="px-6 text-center text-xl font-extrabold">{title}</span>}
        </button>
      )} style={{ width: "100%", aspectRatio: `${meta.width} / ${meta.height}` }} />
    </div>
    {fullscreenContainer ? createPortal(controls, fullscreenContainer) : controls}
  </div>;
}

export default function PlayerInner({ videoId, lang, title }: { videoId: string; lang: Lang; title?: string }) {
  const meta = VIDEOS[videoId];
  return meta ? <LocalPlayer key={`${videoId}:${lang}`} meta={meta} lang={lang} title={title} /> : null;
}
