import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import "@fontsource-variable/nunito";
import "@fontsource-variable/jetbrains-mono";
import { Quest } from "./scenes/Quest";
import { Kitchen } from "./scenes/Kitchen";
import { Dialogue } from "./scenes/Dialogue";
import { Arcade } from "./scenes/Arcade";
import { storyFrame, timeline } from "./timing";
import type { LabLang, Variant } from "./registry";

export type LabProps = { variant: Variant; lang: LabLang; subtitles: boolean };
const scenes = { cartoon: Quest, board: Dialogue, notebook: Kitchen, motion: Arcade };

export function LabVideo({ variant, subtitles }: LabProps) {
  const frame = useCurrentFrame();
  const Scene = scenes[variant];
  return (
    <AbsoluteFill style={{ fontFamily: '"Nunito Variable", sans-serif' }}>
      <Scene frame={storyFrame(frame, variant)} />
      {timeline(variant).map((beat) => (
        <Sequence key={beat.index} from={beat.from} durationInFrames={beat.frames} layout="none">
          {beat.hasAudio && <Html5Audio src={staticFile(`media/videos/lab/voice/${variant}/${beat.index}.mp3`)} />}
          {subtitles && <div style={{ position: "absolute", bottom: 28, left: 40, right: 40, padding: "16px 22px", borderRadius: 22, background: "#101b29ee", color: "white", fontSize: 36, fontWeight: 700, textAlign: "center", lineHeight: 1.22 }}>{beat.text}</div>}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
