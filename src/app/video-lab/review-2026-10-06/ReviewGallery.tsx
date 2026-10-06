"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Code2, Ticket } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { RangeVideo } from "@/videos/review-2026-10-06/RangeVideo";
import { LogicVideo } from "@/videos/review-2026-10-06/LogicVideo";
import { REVIEW_FPS, REVIEW_FRAMES, REVIEW_SIZE, reviewStrings as s, type ReviewVideoId, type ReviewLanguage } from "@/videos/review-2026-10-06/script";

const Preview = dynamic(async () => {
  const { Player } = await import("@remotion/player");
  return function ReviewPreview({ variant, lang }: { variant: ReviewVideoId; lang: ReviewLanguage }) {
    return <Player component={variant === "python-range" ? RangeVideo : LogicVideo} inputProps={{ lang }} durationInFrames={REVIEW_FRAMES[variant]} compositionWidth={REVIEW_SIZE} compositionHeight={REVIEW_SIZE} fps={REVIEW_FPS} controls clickToPlay spaceKeyToPlayOrPause moveToBeginningWhenEnded={false} allowFullscreen acknowledgeRemotionLicense showVolumeControls={false} style={{ width: "100%", aspectRatio: "1" }} />;
  };
}, { ssr: false, loading: () => <div className="aspect-square rounded-3xl bg-surface-2" /> });

export default function ReviewGallery() {
  const { l, lang } = useT();
  const [variant, setVariant] = useState<ReviewVideoId>("python-range");
  const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
  return <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
    <Link href="/video-lab" className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-muted hover:text-primary", focus)}><ArrowLeft size={18} aria-hidden />{l(s.back)}</Link>
    <h1 className="mt-5 text-3xl font-extrabold sm:text-4xl">{l(s.title)}</h1>
    <p className="mt-3 max-w-2xl leading-relaxed text-muted">{l(s.intro)}</p>
    <div className="my-6 grid gap-3 sm:grid-cols-2">
      {[{ id: "python-range" as const, Icon: Code2, title: s.rangeTitle }, { id: "logic-club" as const, Icon: Ticket, title: s.logicTitle }].map(({ id, Icon, title }) => <button key={id} type="button" aria-pressed={variant === id} onClick={() => setVariant(id)} className={cn("flex min-h-14 items-center gap-3 rounded-2xl border-2 p-4 text-left font-extrabold", variant === id ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface", focus)}><Icon size={22} aria-hidden />{l(title)}</button>)}
    </div>
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="overflow-hidden rounded-3xl border border-border bg-surface"><Preview key={`${variant}-${lang}`} variant={variant} lang={lang} /></div>
      <div className="rounded-3xl border border-border bg-surface p-5">
        <h2 className="text-xl font-extrabold">{l(variant === "python-range" ? s.rangeTitle : s.logicTitle)}</h2>
        <p className="mt-3 leading-relaxed text-muted">{l(variant === "python-range" ? s.rangeDescription : s.logicDescription)}</p>
        <p className="mt-5 rounded-2xl bg-primary-soft p-4 text-sm font-bold leading-relaxed text-primary">{l(s.local)}</p>
      </div>
    </div>
    <section className="mt-8 rounded-3xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-xl font-extrabold">{l(s.musicTitle)}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{l(s.musicDescription)}</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{[{ name: s.musicGame, file: "bit-arcade" }, { name: s.musicFocus, file: "quiet-focus" }].map(({ name, file }) => <div key={file} className="min-w-0"><p className="mb-2 text-sm font-bold">{l(name)}</p><audio controls loop preload="none" src={`/media/music/${file}.wav`} className="w-full" /></div>)}</div>
    </section>
  </main>;
}
