"use client";

import dynamic from "next/dynamic";
import { BinaryIntro, totalFrames } from "@/videos/binary-intro/BinaryIntro";

const OriginalPlayer = dynamic(async () => {
  const { Player } = await import("@remotion/player");
  return function OriginalVideoPlayer() {
    return <Player
      component={BinaryIntro}
      inputProps={{ lang: "ru", subtitles: false }}
      durationInFrames={totalFrames("ru")}
      compositionWidth={1080}
      compositionHeight={1080}
      fps={30}
      controls
      clickToPlay
      allowFullscreen
      showVolumeControls
      spaceKeyToPlayOrPause
      moveToBeginningWhenEnded={false}
      acknowledgeRemotionLicense
      style={{ width: "100%", aspectRatio: "1" }}
    />;
  };
}, {
  ssr: false,
  loading: () => <div className="aspect-square w-full animate-pulse bg-surface-2" />,
});

export default function OriginalPreview() {
  return <OriginalPlayer />;
}
