"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Captions, Cat, Check, ChefHat, Cpu, Download, Film, Gamepad2, Gauge, ListOrdered, MessageSquare, Smartphone, SquareStack, Store, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { LabVideo } from "@/videos/lab/Video";
import { STYLES, FPS, SIZE } from "@/videos/lab/registry";
import { durationFor, isSilent } from "@/videos/lab/timing";
import { strings, type LabLanguage } from "./strings";
import { reviewStrings } from "@/videos/review-2026-10-06/script";

type Variant = (typeof STYLES)[number]["id"];
type PreviewProps = { variant: Variant; lang: LabLanguage; subtitles: boolean };
const isStoryVariant = (variant: string) => variant === "bit-detective" || variant === "bit-bakery";
const isDirectVariant = (variant: string) => variant === "binary-encode" || variant === "binary-decode";
const isSilentVariant = (variant: Variant) => isSilent(variant);

const Preview = dynamic(async () => {
  const { Player } = await import("@remotion/player");
  return function VideoPreview(props: PreviewProps) {
    return (
      <Player
        component={LabVideo}
        inputProps={props}
        durationInFrames={durationFor(props.variant)}
        compositionWidth={SIZE}
        compositionHeight={SIZE}
        fps={FPS}
        controls
        moveToBeginningWhenEnded={false}
        clickToPlay
        allowFullscreen
        spaceKeyToPlayOrPause
        acknowledgeRemotionLicense
        showVolumeControls={!isSilentVariant(props.variant)}
        style={{ width: "100%", aspectRatio: "1" }}
      />
    );
  };
}, {
  ssr: false,
  loading: () => <div className="aspect-square w-full animate-pulse bg-surface-2" />,
});

const OriginalPreview = dynamic(() => import("./OriginalPreview"), {
  ssr: false,
  loading: () => <div className="aspect-square w-full animate-pulse bg-surface-2" />,
});

const icons = { "binary-encode": SquareStack, "binary-decode": ListOrdered, "bit-detective": Cat, "bit-bakery": Store, "bit-phone": Smartphone, "bit-counter": Gauge, "kitchen-clear": ChefHat, "bit-workshop": Cpu, cartoon: Film, board: MessageSquare, notebook: ChefHat, motion: Gamepad2 };
const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

export default function Gallery() {
  const lang: LabLanguage = "ru";
  const [variant, setVariant] = useState<Variant>("binary-encode");
  const [subtitles, setSubtitles] = useState(false);
  const [originalOpen, setOriginalOpen] = useState(false);
  const t = (key: Exclude<keyof typeof strings, "criteria">) => strings[key].ru;
  const selectedIndex = STYLES.findIndex((style) => style.id === variant);
  const selected = STYLES[selectedIndex];
  const silent = isSilentVariant(variant);
  const seconds = Math.ceil(durationFor(variant) / FPS);
  const move = (direction: number) => setVariant(STYLES[(selectedIndex + direction + STYLES.length) % STYLES.length].id);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-10" lang={lang}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/learn" className={cn("inline-flex items-center gap-2 rounded-lg text-sm font-bold text-muted hover:text-primary", focus)}>
          <ArrowLeft size={17} aria-hidden /> {t("back")}
        </Link>
      </div>

      <header className="mb-6 max-w-2xl">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-widest text-primary">{t("eyebrow")}</p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{t("intro")}</p>
        <Link href="/video-lab/review-2026-10-06" className={cn("mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary-soft px-4 text-sm font-extrabold text-primary", focus)}>{reviewStrings.title[lang]} <ArrowRight size={17} aria-hidden /></Link>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={t("styles")}>
        {STYLES.map((style, i) => {
          const Icon = icons[style.id];
          return (
            <button key={style.id} type="button" onClick={() => setVariant(style.id)} aria-pressed={variant === style.id}
              className={cn("flex min-h-16 items-center gap-2 rounded-2xl border-2 px-3 py-3 text-left text-sm font-extrabold transition-colors", variant === style.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-text hover:border-primary/40", focus)}>
              <Icon size={21} className="shrink-0" aria-hidden />
              <span><span className="mb-0.5 block text-[10px] opacity-60">{String(i + 1).padStart(2, "0")} · {i < 2 ? t("new") : t("previousTrials")}</span>{style.name[lang]}</span>
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section aria-label={selected.name[lang]}>
          <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
            <Preview key={`${variant}-${lang}`} variant={variant} lang={lang} subtitles={silent || subtitles} />
            <div className="flex items-center justify-between gap-2 border-t border-border p-3">
              <span className="flex items-center gap-1.5 text-xs font-bold text-muted">{silent ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}{t(silent ? "silent" : "voice")}</span>
              {silent ? <span className="inline-flex min-h-9 items-center gap-1.5 px-2 text-sm font-bold text-muted"><Captions size={18} aria-hidden />{t("onScreen")}</span> :
                <button type="button" aria-pressed={subtitles} onClick={() => setSubtitles((value) => !value)}
                  className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold", subtitles ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted", focus)}>
                  <Captions size={18} aria-hidden />{t("subtitles")}
                </button>}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => move(-1)} aria-label={t("previous")} className={cn("flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 hover:bg-surface-2", focus)}>
              <ArrowLeft size={18} aria-hidden />
            </button>
            <button type="button" onClick={() => move(1)} className={cn("flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-white hover:bg-primary-strong", focus)}>
              {t("next")} <ArrowRight size={18} aria-hidden />
            </button>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-3xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between gap-3 text-xs font-bold text-muted">
              <span>{t("example")}</span><span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1">{seconds} {t("seconds")}</span>
            </div>
            <p className="mb-5 font-mono text-2xl font-extrabold sm:text-3xl">{selected.example}</p>
            <h2 className="text-xl font-extrabold">{selected.name[lang]}</h2>
            <p className="mt-2 leading-relaxed text-muted">{selected.description[lang]}</p>
            {silent && <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-muted">{t(isDirectVariant(variant) ? "directTiming" : isStoryVariant(variant) ? "storyTiming" : "timing")}</p>}
            <a href={`/video-lab/${variant}.mp4`} download className={cn("mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-extrabold hover:bg-surface-2", focus)}>
              <Download size={17} aria-hidden />{t("download")}
            </a>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t(silent ? "silentDownloadNote" : "downloadNote")}</p>
          </section>
          <section className="rounded-3xl border border-primary/20 bg-primary-soft p-5">
            <h2 className="text-base font-extrabold">{t("recommendation")}</h2>
            <p className="mt-2 text-sm leading-relaxed">{t("recommendationText")}</p>
          </section>
          <section className="px-1">
            <h2 className="mb-3 text-sm font-extrabold">{t("compare")}</h2>
            <ul className="space-y-2 text-sm text-muted">
              {strings.criteria.ru.map((criterion) => <li key={criterion} className="flex items-center gap-2"><Check size={16} className="shrink-0 text-primary" aria-hidden />{criterion}</li>)}
            </ul>
          </section>
        </aside>
      </div>
      <details className="mt-7 rounded-3xl border border-border bg-surface p-5" onToggle={(event) => setOriginalOpen(event.currentTarget.open)}>
        <summary className={cn("cursor-pointer rounded-lg font-extrabold", focus)}>{t("originalTitle")}</summary>
        <p className="my-4 text-sm leading-relaxed text-muted">{t("originalNote")}</p>
        {originalOpen && <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-border"><OriginalPreview /></div>}
      </details>
      <p className="mt-7 border-t border-border pt-5 text-center text-xs leading-relaxed text-muted">{t("draft")}</p>
    </main>
  );
}
