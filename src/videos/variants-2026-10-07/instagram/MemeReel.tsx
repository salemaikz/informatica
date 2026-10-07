import { Series, useVideoConfig } from "remotion";
import type { InstagramReelProps } from "./script";
import { BackgroundMusic, ReelProgress } from "./shared";
import { MemeSetupScene } from "./MemeSetupScene";
import { MemeErrorScene } from "./MemeErrorScene";
import { MemeIndexScene } from "./MemeIndexScene";
import { MemeFixedScene } from "./MemeFixedScene";

export function MemeReel({ lang, music = false }: InstagramReelProps) {
  const { fps } = useVideoConfig();
  return <>
    <Series>
      <Series.Sequence name="Знакомая мысль / Таныс ой" durationInFrames={150} premountFor={fps}><MemeSetupScene lang={lang} /></Series.Sequence>
      <Series.Sequence name="Ответ списка / Тізімнің жауабы" durationInFrames={150} premountFor={fps}><MemeErrorScene lang={lang} /></Series.Sequence>
      <Series.Sequence name="Адреса / Мекенжайлар" durationInFrames={150} premountFor={fps}><MemeIndexScene lang={lang} /></Series.Sequence>
      <Series.Sequence name="Исправление / Түзету" durationInFrames={150} premountFor={fps}><MemeFixedScene lang={lang} /></Series.Sequence>
    </Series>
    <ReelProgress color="#94663b" />
    {music ? <BackgroundMusic track="bit-arcade" /> : null}
  </>;
}
