import { Series, useVideoConfig } from "remotion";
import type { InstagramReelProps } from "./script";
import { BackgroundMusic, ReelProgress } from "./shared";
import { InviteHelloScene } from "./InviteHelloScene";
import { InviteLessonScene } from "./InviteLessonScene";
import { InviteQuestionScene } from "./InviteQuestionScene";
import { InviteCtaScene } from "./InviteCtaScene";

export function InviteReel({ lang, music = false }: InstagramReelProps) {
  const { fps } = useVideoConfig();
  return <>
    <Series>
      <Series.Sequence name="Знакомство / Танысу" durationInFrames={150} premountFor={fps}><InviteHelloScene lang={lang} /></Series.Sequence>
      <Series.Sequence name="Урок / Сабақ" durationInFrames={150} premountFor={fps}><InviteLessonScene lang={lang} /></Series.Sequence>
      <Series.Sequence name="Вопрос и разбор / Сұрақ пен түсіндіру" durationInFrames={150} premountFor={fps}><InviteQuestionScene lang={lang} /></Series.Sequence>
      <Series.Sequence name="Приглашение / Шақыру" durationInFrames={150} premountFor={fps}><InviteCtaScene lang={lang} /></Series.Sequence>
    </Series>
    <ReelProgress color="#1277b3" />
    {music ? <BackgroundMusic track="quiet-focus" /> : null}
  </>;
}
