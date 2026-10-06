"use client";

import { Player, type CallbackListener, type PlayerRef } from "@remotion/player";
import { Captions, CaptionsOff, Gauge, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type SyntheticEvent } from "react";
import type { Lang } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { VIDEOS } from "./registry";
import { setMusicVideoPlaying } from "@/lib/music";
import { RATES, RATE_STORAGE_KEY, SEEK_STEP_SEC, fitBox, formatClock, formatRate, sanitizeRate, seekFrame, stepRate } from "./seek";

/** Окно двойного касания, мс. */
const DOUBLE_TAP_MS = 320;
/** Сколько висит всплывающее «−5 с», мс. */
const FLASH_MS = 650;

function readRate(): number {
  try {
    return sanitizeRate(localStorage.getItem(RATE_STORAGE_KEY));
  } catch {
    return 1;
  }
}

function writeRate(rate: number) {
  try {
    localStorage.setItem(RATE_STORAGE_KEY, String(rate));
  } catch {
    // хранилище недоступно — скорость просто не запомнится
  }
}

/** Элементы, которым стрелки нужны самим (поля ввода, слайдеры, группы радиокнопок, вкладки, списки). */
const OWN_KEYS_SELECTOR =
  "input, textarea, select, [role='slider'], [role='spinbutton'], [role='textbox'], [role='radiogroup'], [role='tablist'], [role='listbox'], [role='menu'], [role='grid']";

/** Клавиши не наши: фокус в элементе со своими стрелками или открыто модальное окно поверх плеера. */
function keysBelongElsewhere(target: EventTarget | null, wrap: HTMLElement): boolean {
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest(OWN_KEYS_SELECTOR))) return true;
  for (const dlg of document.querySelectorAll("[aria-modal='true']")) {
    if (!dlg.contains(wrap)) return true;
  }
  return false;
}

/** Кнопка панели: зона касания 44×44 px. */
const ctl =
  "flex h-11 min-w-11 items-center justify-center gap-1 rounded-xl px-1 text-sm font-bold text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary aria-pressed:text-primary";

type FsEl = HTMLDivElement & { webkitRequestFullscreen?: () => void };
type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };

export default function PlayerInner({ videoId, lang, title }: { videoId: string; lang: Lang; title?: string }) {
  const { t } = useT();
  const [subtitles, setSubtitles] = useState(true);
  const [rate, setRate] = useState(readRate);
  const [rateOpen, setRateOpen] = useState(false);
  const [flash, setFlash] = useState<{ id: number; dir: -1 | 1 } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [frame, setFrame] = useState(0);
  // Полный экран: настоящий (Fullscreen API) или «псевдо» — фиксированный слой, если API нет (iPhone) или отказал.
  const [realFs, setRealFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const playerRef = useRef<PlayerRef>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef<{
    at: number;
    dir: -1 | 1;
    wasPlaying: boolean;
  } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashId = useRef(0);
  const ratesId = useId();
  const fullscreen = realFs || pseudoFs;

  const meta = VIDEOS[videoId];
  const fps = meta?.fps ?? 30;
  const duration = meta ? meta.durationInFrames(lang) : 0;
  const last = Math.max(0, duration - 1);

  /** Перемотка на sec секунд; пауза/воспроизведение не меняются. */
  const seekBy = useCallback(
    (sec: number) => {
      const p = playerRef.current;
      if (!p) return;
      const f = seekFrame(p.getCurrentFrame(), sec, fps, duration);
      p.seekTo(f);
      setFrame(f);
    },
    [fps, duration],
  );

  const seekTo = useCallback(
    (f: number) => {
      const p = playerRef.current;
      if (!p) return;
      const clamped = Math.min(last, Math.max(0, Math.round(f)));
      p.seekTo(clamped);
      setFrame(clamped);
    },
    [last],
  );

  const toggle = useCallback((e?: SyntheticEvent) => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isPlaying()) p.pause();
    else p.play(e);
  }, []);

  const changeRate = useCallback((next: number) => {
    setRate(next);
    writeRate(next);
  }, []);

  const enterFullscreen = useCallback(async () => {
    const el = rootRef.current as FsEl | null;
    if (!el) return;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return;
      }
      if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        return;
      }
    } catch {
      // отказ браузера — переходим к полному экрану слоем
    }
    setPseudoFs(true);
  }, []);

  const exitFullscreen = useCallback(() => {
    setPseudoFs(false);
    const d = document as FsDoc;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else if (d.webkitFullscreenElement) d.webkitExitFullscreen?.();
  }, []);

  // События плеера: воспроизведение, позиция, звук. Пока видео играет, фоновая музыка на паузе.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onPlay: CallbackListener<"play"> = () => {
      setPlaying(true);
      setMusicVideoPlaying(true);
    };
    const onPause: CallbackListener<"pause"> = () => {
      setPlaying(false);
      setMusicVideoPlaying(false);
    };
    const onEnded: CallbackListener<"ended"> = () => {
      setPlaying(false);
      setMusicVideoPlaying(false);
    };
    const onTime: CallbackListener<"timeupdate"> = (e) => setFrame(e.detail.frame);
    const onSeeked: CallbackListener<"seeked"> = (e) => setFrame(e.detail.frame);
    const onMute: CallbackListener<"mutechange"> = (e) => setMuted(e.detail.isMuted);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("ended", onEnded);
    p.addEventListener("timeupdate", onTime);
    p.addEventListener("seeked", onSeeked);
    p.addEventListener("mutechange", onMute);
    return () => {
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("ended", onEnded);
      p.removeEventListener("timeupdate", onTime);
      p.removeEventListener("seeked", onSeeked);
      p.removeEventListener("mutechange", onMute);
      setMusicVideoPlaying(false);
    };
  }, [meta]);

  // Настоящий полный экран: следим за состоянием (выход по Esc/жесту приходит отсюда).
  useEffect(() => {
    const onChange = () => {
      const d = document as FsDoc;
      setRealFs((document.fullscreenElement ?? d.webkitFullscreenElement) === rootRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // «Псевдо» полный экран: Esc закрывает слой.
  useEffect(() => {
    if (!pseudoFs) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPseudoFs(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pseudoFs]);

  // В полном экране видео вписываем в оставшееся место над панелью (мерим область).
  useEffect(() => {
    const el = stageRef.current;
    if (!fullscreen || !el) return;
    const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullscreen]);

  // Клавиатура: ←/→ — ±5 с, «<» / «>» — скорость; Пробел/K, Home/End — когда фокус на плеере. Не мешаем полям и слайдерам.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const wrap = rootRef.current;
      if (!wrap || keysBelongElsewhere(e.target, wrap)) return;
      const r = wrap.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight) return;
      const inside = e.target instanceof Node && wrap.contains(e.target);
      const onButton = e.target instanceof HTMLElement && !!e.target.closest("button, a");
      if (e.key === "ArrowLeft") seekBy(-SEEK_STEP_SEC);
      else if (e.key === "ArrowRight") seekBy(SEEK_STEP_SEC);
      else if (inside && ((e.key === " " && !onButton) || e.code === "KeyK")) toggle();
      else if (inside && e.key === "Home") seekTo(0);
      else if (inside && e.key === "End") seekTo(last);
      // по e.code — чтобы «<»/«>» работали и в русской раскладке
      else if (e.shiftKey && (e.code === "Comma" || e.key === "<")) changeRate(stepRate(rate, -1));
      else if (e.shiftKey && (e.code === "Period" || e.key === ">")) changeRate(stepRate(rate, 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seekBy, seekTo, toggle, changeRate, rate, last]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const showFlash = (dir: -1 | 1) => {
    flashId.current += 1;
    setFlash({ id: flashId.current, dir });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  };

  // Двойное касание левой/правой половины (только touch): ±5 с. Одиночное касание проходит к Remotion (play/pause).
  // Remotion переключает play/pause уже на первом касании, поэтому при двойном возвращаем прежнее состояние
  // и не пускаем второе касание дальше. Панель управления — вне этой области, её касания не перехватываем.
  const onTapCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch" || !e.isPrimary) return;
    const player = playerRef.current;
    if (!player) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dir: -1 | 1 = e.clientX < rect.left + rect.width / 2 ? -1 : 1;
    const prev = lastTap.current;
    if (prev && prev.dir === dir && e.timeStamp - prev.at < DOUBLE_TAP_MS) {
      e.stopPropagation();
      // серия касаний (как в YouTube): каждое следующее быстрое касание той же половины — ещё ±5 с
      lastTap.current = { at: e.timeStamp, dir, wasPlaying: prev.wasPlaying };
      if (player.isPlaying() !== prev.wasPlaying) {
        if (prev.wasPlaying) player.play();
        else player.pause();
      }
      seekBy(dir * SEEK_STEP_SEC);
      showFlash(dir);
      return;
    }
    lastTap.current = { at: e.timeStamp, dir, wasPlaying: player.isPlaying() };
  };

  if (!meta) return null;
  const clockNow = formatClock(frame, fps);
  const clockTotal = formatClock(duration, fps);
  const box = fullscreen ? fitBox(area.w, area.h, meta.width / meta.height) : null;
  return (
    <div
      ref={rootRef}
      data-testid="video-player"
      data-fullscreen={fullscreen ? "true" : "false"}
      className={cn(
        "overflow-hidden bg-surface",
        fullscreen ? "flex h-dvh w-full flex-col" : "rounded-3xl border-2 border-border",
        pseudoFs && "fixed inset-0 z-[60]",
      )}
    >
      {/* Сцена: касания (двойное касание ±5 с). touch-manipulation — браузер не масштабирует страницу двойным касанием */}
      <div
        ref={stageRef}
        role="group"
        tabIndex={0}
        aria-label={title ?? t("video.controls")}
        className={cn(
          "relative touch-manipulation outline-none focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primary",
          fullscreen && "flex min-h-0 flex-1 items-center justify-center bg-black",
        )}
        onPointerDownCapture={onTapCapture}
      >
        <div className="relative" style={box ? { width: box.w, height: box.h } : { width: "100%" }}>
          <Player
            ref={playerRef}
            component={meta.component}
            inputProps={{ lang, subtitles }}
            durationInFrames={duration}
            compositionWidth={meta.width}
            compositionHeight={meta.height}
            fps={meta.fps}
            playbackRate={rate}
            controls={false}
            clickToPlay
            allowFullscreen={false}
            showVolumeControls={false}
            spaceKeyToPlayOrPause={false}
            acknowledgeRemotionLicense
            showPosterWhenUnplayed
            renderPoster={() => (
              <div className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-4 bg-bg/80 backdrop-blur-[2px]">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-action-primary text-white shadow-[0_6px_0_var(--action-primary-edge)]">
                  <Play size={36} fill="currentColor" className="ml-1" />
                </span>
                {title && <span className="px-6 text-center text-xl font-extrabold">{title}</span>}
              </div>
            )}
            style={{
              width: "100%",
              aspectRatio: `${meta.width} / ${meta.height}`,
            }}
          />
          <AnimatePresence>
            {flash && (
              <m.div
                key={flash.id}
                aria-hidden
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-4 py-2 text-base font-extrabold text-white",
                  flash.dir < 0 ? "left-[12%]" : "right-[12%]",
                )}
              >
                {t(flash.dir < 0 ? "video.back5" : "video.fwd5")}
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div
        role="group"
        aria-label={t("video.controls")}
        className={cn("shrink-0 border-t-2 border-border bg-surface px-2 py-1", fullscreen && "pb-[max(0.25rem,env(safe-area-inset-bottom))]")}
      >
        <div className="flex items-center gap-1">
          <button type="button" onClick={(e) => toggle(e)} aria-label={t(playing ? "video.pause" : "video.play")} title={t(playing ? "video.pause" : "video.play")} className={ctl}>
            {playing ? <Pause size={22} fill="currentColor" aria-hidden /> : <Play size={22} fill="currentColor" aria-hidden />}
          </button>
          <span aria-hidden className="shrink-0 font-mono text-xs tabular-nums text-muted">
            {clockNow} / {clockTotal}
          </span>
          <input
            type="range"
            min={0}
            max={last}
            step={1}
            value={Math.min(frame, last)}
            onChange={(e) => seekTo(e.currentTarget.valueAsNumber)}
            aria-label={t("video.seek")}
            aria-valuetext={t("video.seek.value", { cur: clockNow, total: clockTotal })}
            className="h-11 min-w-0 flex-1 cursor-pointer accent-primary focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
        </div>
        <div className="flex items-center">
          <button type="button" onClick={() => seekBy(-SEEK_STEP_SEC)} aria-label={t("video.back5.aria")} title={t("video.back5.aria")} className={cn(ctl, "relative")}>
            <RotateCcw size={26} strokeWidth={2} aria-hidden />
            <span aria-hidden className="absolute pt-px text-[10px] font-extrabold">
              {SEEK_STEP_SEC}
            </span>
          </button>
          <button type="button" onClick={() => seekBy(SEEK_STEP_SEC)} aria-label={t("video.fwd5.aria")} title={t("video.fwd5.aria")} className={cn(ctl, "relative")}>
            <RotateCw size={26} strokeWidth={2} aria-hidden />
            <span aria-hidden className="absolute pt-px text-[10px] font-extrabold">
              {SEEK_STEP_SEC}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              const p = playerRef.current;
              if (p?.isMuted()) p.unmute();
              else p?.mute();
            }}
            aria-label={t(muted ? "video.unmute" : "video.mute")}
            title={t(muted ? "video.unmute" : "video.mute")}
            className={ctl}
          >
            {muted ? <VolumeX size={22} aria-hidden /> : <Volume2 size={22} aria-hidden />}
          </button>
          <div className="ml-auto flex items-center">
            <button
              type="button"
              onClick={() => setSubtitles((s) => !s)}
              aria-pressed={subtitles}
              aria-label={t("video.subtitles")}
              title={t("video.subtitles")}
              className={ctl}
            >
              {subtitles ? <Captions size={22} aria-hidden /> : <CaptionsOff size={22} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => setRateOpen((o) => !o)}
              aria-expanded={rateOpen}
              aria-controls={ratesId}
              aria-label={t("video.speed.aria", { rate: formatRate(rate) })}
              title={t("video.speed.aria", { rate: formatRate(rate) })}
              className={cn(ctl, "aria-expanded:bg-surface-2 aria-expanded:text-primary")}
            >
              <Gauge size={18} aria-hidden /> {formatRate(rate)}
            </button>
            <button
              type="button"
              onClick={() => (fullscreen ? exitFullscreen() : void enterFullscreen())}
              aria-label={t(fullscreen ? "video.exitFullscreen" : "video.fullscreen")}
              title={t(fullscreen ? "video.exitFullscreen" : "video.fullscreen")}
              data-testid="video-fullscreen"
              className={ctl}
            >
              {fullscreen ? <Minimize size={22} aria-hidden /> : <Maximize size={22} aria-hidden />}
            </button>
          </div>
        </div>
        {rateOpen && (
          <div id={ratesId} role="group" aria-label={t("video.speed.pick")} className="mb-1 mt-1 flex w-full gap-1 rounded-2xl bg-surface-2 p-1">
            {RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  changeRate(r);
                  setRateOpen(false);
                }}
                aria-pressed={r === rate}
                className={cn(
                  "min-h-11 flex-1 rounded-xl px-1 text-sm font-bold text-muted hover:text-text",
                  r === rate && "bg-action-primary text-white hover:text-white",
                )}
              >
                {formatRate(r)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
