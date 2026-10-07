"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Film, BookOpen, Music2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { VIDEO_VARIANTS, type VariantLanguage } from "@/videos/variants-2026-10-07/catalog";

import { variantStrings as s } from "@/videos/variants-2026-10-07/script";

const Preview = dynamic(() => import("./VariantPlayer"), { ssr: false, loading: () => <div className="aspect-square rounded-3xl bg-surface-2" /> });
const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

export default function VariantGallery() {
  const { lang: profileLanguage } = useT();
  const [chosenLanguage, setLanguage] = useState<VariantLanguage | null>(null);
  const lang = chosenLanguage ?? (profileLanguage === "kk" ? "kk" : "ru");
  const [id, setId] = useState("shelf");
  const [music, setMusic] = useState(false);
  const meta = VIDEO_VARIANTS.find((item) => item.id === id) ?? VIDEO_VARIANTS[0];
  return <main lang={lang} className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
    <Link href="/video-lab/review-2026-10-06" className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-muted hover:text-primary", focus)}><ArrowLeft size={18} aria-hidden />{s.back[lang]}</Link>
    <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-extrabold sm:text-4xl">{s.title[lang]}</h1><p className="mt-3 max-w-2xl leading-relaxed text-muted">{s.intro[lang]}</p></div>
      <div className="flex gap-2" aria-label="Русский / Қазақша">{(["ru", "kk"] as const).map((language) => <button key={language} type="button" aria-pressed={lang === language} onClick={() => setLanguage(language)} className={cn("min-h-11 rounded-xl border px-4 font-extrabold", lang === language ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface", focus)}>{language === "ru" ? "Русский" : "Қазақша"}</button>)}</div>
    </div>
    <div className="my-6 grid gap-6 md:grid-cols-2">{(["lesson", "instagram"] as const).map((kind) => <section key={kind} aria-label={s.choose[lang]}>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">{kind === "lesson" ? <BookOpen size={20} aria-hidden /> : <Film size={20} aria-hidden />}{s[kind === "lesson" ? "lessons" : "instagram"][lang]}</h2>
      <div className="grid gap-2">{VIDEO_VARIANTS.filter((item) => item.kind === kind).map((item) => <button key={item.id} type="button" data-variant={item.id} aria-pressed={id === item.id} onClick={() => { setId(item.id); setMusic(false); }} className={cn("flex min-h-14 items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left font-extrabold", id === item.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface", focus)}>{item.title[lang]}<span className="shrink-0 text-xs font-semibold text-muted">{item.frames / 30} {s.seconds[lang]}</span></button>)}</div>
    </section>)}</div>
    <div className="grid items-start gap-5 lg:grid-cols-[1.25fr_1fr]">
      <div className={cn("mx-auto w-full", meta.kind === "instagram" && "max-w-[430px]")}><Preview key={`${id}-${lang}`} meta={meta} lang={lang} music={music} /></div>
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-2xl font-extrabold">{meta.title[lang]}</h2><p className="mt-3 leading-relaxed text-muted">{meta.description[lang]}</p>
        <p className="mt-5 rounded-2xl bg-primary-soft p-4 text-sm font-bold leading-relaxed text-primary">{s.drafts[lang]}</p>
        {meta.music && <div className="mt-5"><label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold"><input type="checkbox" checked={music} onChange={(event) => setMusic(event.currentTarget.checked)} className="size-5 accent-primary" /><Music2 size={20} aria-hidden />{s.music[lang]}</label><p className="mt-2 text-sm leading-relaxed text-muted">{s.musicDescription[lang]}</p></div>}
      </div>
    </div>
    <section className="mt-10">
      <h2 className="text-2xl font-extrabold">{s.visualTitle[lang]}</h2><p className="mt-3 max-w-3xl leading-relaxed text-muted">{s.visualIntro[lang]}</p>
      <div className="mt-5 grid gap-5 md:grid-cols-3">{(["paper", "workshop", "comic"] as const).map((style) => <figure key={style} className="overflow-hidden rounded-2xl border border-border bg-surface"><Image src={`/media/variants-2026-10-07/${style}-${lang}.svg`} alt={s[style][lang]} width={1600} height={1200} unoptimized className="h-auto w-full" /><figcaption className="p-4"><h3 className="font-extrabold">{s[style][lang]}</h3><a href={`/media/variants-2026-10-07/${style}-${lang}.svg`} target="_blank" rel="noreferrer" className={cn("mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-primary", focus)}>{s.open[lang]}<ArrowUpRight size={16} aria-hidden /></a></figcaption></figure>)}</div>
    </section>
  </main>;
}
