import { Series, useVideoConfig } from "remotion";
import type { InstagramReelProps } from "./script";
import { BackgroundMusic, ReelProgress } from "./shared";
import { TeachHookScene } from "./TeachHookScene";
import { TeachStringScene } from "./TeachStringScene";
import { TeachRuleScene } from "./TeachRuleScene";
import { TeachCompareScene } from "./TeachCompareScene";

export function TeachReel({ lang, music = false }: InstagramReelProps) {
  const { fps } = useVideoConfig();
  return <>
    <Series>
      <Series.Sequence name="Вопрос / Сұрақ" durationInFrames={150} premountFor={fps}><TeachHookScene lang={lang} /></Series.Sequence>
      <Series.Sequence name="Строка / Жол" durationInFrames={150} premountFor={fps}><TeachStringScene lang={lang} /></Series.Sequence>
      <Series.Sequence name="Правило / Ереже" durationInFrames={150} premountFor={fps}><TeachRuleScene lang={lang} /></Series.Sequence>
      <Series.Sequence name="Сравнение / Салыстыру" durationInFrames={150} premountFor={fps}><TeachCompareScene lang={lang} /></Series.Sequence>
    </Series>
    <ReelProgress color="#79dcff" />
    {music ? <BackgroundMusic track="quiet-focus" /> : null}
  </>;
}
