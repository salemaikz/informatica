"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { Captions, CaptionsOff, Gauge, Play, RotateCcw, RotateCw } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Lang } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { VIDEOS } from "./registry";
import { RATES, RATE_STORAGE_KEY, SEEK_STEP_SEC, formatRate, sanitizeRate, seekFrame, stepRate } from "./seek";

/** Нижняя полоса плеера Remotion (контролы) — её двойные касания не перехватываем. */
const CONTROLS_SAFE_PX = 48;
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

const barBtn =
  "flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1 text-sm font-bold text-muted hover:bg-surface-2 aria-pressed:text-primary";
/** Перемотка: круглая стрелка с «5» внутри — компактно, чтобы панель влезала в 360 px в одну строку. */
const seekBtn = "relative flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2";

export default function PlayerInner({ videoId, lang, title }: { videoId: string; lang: Lang; title?: string }) {
  const { t } = useT();
  const [subtitles, setSubtitles] = useState(true);
  const [rate, setRate] = useState(readRate);
  const [rateOpen, setRateOpen] = useState(false);
  const [flash, setFlash] = useState<{ id: number; dir: -1 | 1 } | null>(null);
  const playerRef = useRef<PlayerRef>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef<{
    at: number;
    dir: -1 | 1;
    wasPlaying: boolean;
  } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashId = useRef(0);
  const ratesId = useId();

  const meta = VIDEOS[videoId];
  const fps = meta?.fps ?? 30;
  const duration = meta ? meta.durationInFrames(lang) : 0;

  /** Перемотка на sec секунд; пауза/воспроизведение не меняются. */
  const seekBy = useCallback(
    (sec: number) => {
      const p = playerRef.current;
      if (!p) return;
      p.seekTo(seekFrame(p.getCurrentFrame(), sec, fps, duration));
    },
    [fps, duration],
  );

  const changeRate = useCallback((next: number) => {
    setRate(next);
    writeRate(next);
  }, []);

  // Клавиатура: ←/→ — ±5 с, «<» / «>» — скорость. Не мешаем полям ввода и слайдерам; работаем, только пока плеер виден.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const wrap = wrapRef.current;
      if (!wrap || keysBelongElsewhere(e.target, wrap)) return;
      const r = wrap.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight) return;
      if (e.key === "ArrowLeft") seekBy(-SEEK_STEP_SEC);
      else if (e.key === "ArrowRight") seekBy(SEEK_STEP_SEC);
      // по e.code — чтобы «<»/«>» работали и в русской раскладке
      else if (e.shiftKey && (e.code === "Comma" || e.key === "<")) changeRate(stepRate(rate, -1));
      else if (e.shiftKey && (e.code === "Period" || e.key === ">")) changeRate(stepRate(rate, 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seekBy, changeRate, rate]);

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
  // и не пускаем второе касание дальше.
  const onTapCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch" || !e.isPrimary || document.fullscreenElement) return;
    const player = playerRef.current;
    if (!player) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < 0 || y > rect.height - CONTROLS_SAFE_PX) {
      lastTap.current = null;
      return;
    }
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
  return (
    <div className="overflow-hidden rounded-3xl border-2 border-border bg-surface">
      {/* touch-manipulation — браузер не масштабирует страницу двойным касанием */}
      <div ref={wrapRef} className="relative touch-manipulation" onPointerDownCapture={onTapCapture}>
        <Player
          ref={playerRef}
          component={meta.component}
          inputProps={{ lang, subtitles }}
          durationInFrames={duration}
          compositionWidth={meta.width}
          compositionHeight={meta.height}
          fps={meta.fps}
          playbackRate={rate}
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
      <div className="flex flex-wrap items-center gap-1 border-t-2 border-border px-3 py-2">
        <button
          type="button"
          onClick={() => seekBy(-SEEK_STEP_SEC)}
          aria-label={t("video.back5.aria")}
          className={seekBtn}
        >
          <RotateCcw size={28} strokeWidth={2} aria-hidden />
          <span aria-hidden className="absolute pt-px text-[10px] font-extrabold">
            {SEEK_STEP_SEC}
          </span>
        </button>
        <button
          type="button"
          onClick={() => seekBy(SEEK_STEP_SEC)}
          aria-label={t("video.fwd5.aria")}
          className={seekBtn}
        >
          <RotateCw size={28} strokeWidth={2} aria-hidden />
          <span aria-hidden className="absolute pt-px text-[10px] font-extrabold">
            {SEEK_STEP_SEC}
          </span>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRateOpen((o) => !o)}
            aria-expanded={rateOpen}
            aria-controls={ratesId}
            aria-label={t("video.speed.aria", { rate: formatRate(rate) })}
            className={cn(barBtn, "aria-expanded:bg-surface-2 aria-expanded:text-primary")}
          >
            <Gauge size={18} aria-hidden /> {formatRate(rate)}
          </button>
          <button type="button" onClick={() => setSubtitles((s) => !s)} aria-pressed={subtitles} className={barBtn}>
            {subtitles ? <Captions size={18} /> : <CaptionsOff size={18} />} {t("video.subtitles")}
          </button>
        </div>
        {rateOpen && (
          <div
            id={ratesId}
            role="group"
            aria-label={t("video.speed.pick")}
            className="mt-1 flex w-full gap-1 rounded-2xl bg-surface-2 p-1"
          >
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
                  "min-h-10 flex-1 rounded-xl px-1 text-sm font-bold text-muted hover:text-text",
                  r === rate && "bg-primary text-white hover:text-white",
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
