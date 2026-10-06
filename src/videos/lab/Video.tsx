import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import "@fontsource-variable/nunito";
import "@fontsource-variable/jetbrains-mono";
import { Quest } from "./scenes/Quest";
import { Kitchen } from "./scenes/Kitchen";
import { Dialogue } from "./scenes/Dialogue";
import { Arcade } from "./scenes/Arcade";
import { KitchenClear } from "./scenes/KitchenClear";
import { BitWorkshop } from "./scenes/BitWorkshop";
import { BitPhone } from "./scenes/BitPhone";
import { BitCounter } from "./scenes/BitCounter";
import { BitDetective } from "./scenes/BitDetective";
import { BitBakery } from "./scenes/BitBakery";
import { BinaryEncode } from "./scenes/BinaryEncode";
import { BinaryDecode } from "./scenes/BinaryDecode";
import { isSilent, storyFrame, timeline } from "./timing";
import type { LabLang, Variant } from "./registry";

export type LabProps = { variant: Variant; lang: LabLang; subtitles: boolean };
const scenes = { "binary-encode": BinaryEncode, "binary-decode": BinaryDecode, "bit-detective": BitDetective, "bit-bakery": BitBakery, "bit-phone": BitPhone, "bit-counter": BitCounter, "kitchen-clear": KitchenClear, "bit-workshop": BitWorkshop, cartoon: Quest, board: Dialogue, notebook: Kitchen, motion: Arcade };

function explanation(index: number, progress: number, text: string) {
  if (index === 4) return progress < .27
    ? "Добавляем единицу к единице. Цифры 2 в двоичной записи нет."
    : progress < .6
      ? "Две единицы заменяем одной двойкой и переносим её на одно место влево."
      : "На экране три места: 010₂ = 2₁₀. Единица теперь стоит в месте двойки.";
  if (index === 5) return progress < .38
    ? "11₂ — это 3. Добавляем 1: две единицы превращаются в одну двойку."
    : progress < .76
      ? "Теперь две двойки заменяем одной четвёркой. Перенос идёт ещё на одно место влево."
      : "100₂ = 4₁₀. Единственная единица стоит в месте четвёрки.";
  if (index === 6) return progress < 52 / 225
    ? "Справа вес 1. Это 2⁰: нулевая степень даёт единицу."
    : progress < 104 / 225
      ? "На шаг левее вес удваивается: 2¹ = 2."
      : "Ещё левее: 2² = 4. Основание 2 даёт веса 1, 2, 4, 8…";
  return text;
}

export function LabVideo({ variant, subtitles }: LabProps) {
  const frame = useCurrentFrame();
  const Scene = scenes[variant];
  const silent = isSilent(variant);
  const workshop = variant === "bit-phone" || variant === "bit-counter";
  return (
    <AbsoluteFill style={{ fontFamily: '"Nunito Variable", sans-serif', background: silent ? "#f6f7fb" : undefined }}>
      <AbsoluteFill style={silent ? { transform: "scale(.9)", transformOrigin: "top center" } : undefined}>
        <Scene frame={storyFrame(frame, variant)} />
      </AbsoluteFill>
      {timeline(variant).map((beat) => (
        <Sequence key={beat.index} from={beat.from} durationInFrames={beat.frames} layout="none">
          {beat.hasAudio && <Html5Audio src={staticFile(`media/videos/lab/voice/${variant}/${beat.index}.mp3`)} />}
          {(subtitles || silent) && <div style={{ position: "absolute", bottom: silent ? 240 : 28, left: 40, right: 40, padding: "14px 22px", borderRadius: 22, background: "#101b29ee", color: "white", fontSize: silent ? 32 : 36, fontWeight: 700, textAlign: "center", lineHeight: 1.22 }}>{silent && workshop ? explanation(beat.index, (frame - beat.from) / beat.frames, beat.text) : beat.text}</div>}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
