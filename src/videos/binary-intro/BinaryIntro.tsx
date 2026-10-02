import { AbsoluteFill, Easing, Html5Audio, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Lang } from "@/lib/types";
import { Mascot } from "@/components/mascot/Mascot";
import { SCENES } from "./script";
import durations from "./durations.json";

// Видео «Как компьютер считает» — Remotion-композиция 1080×1080.
// Проигрывается прямо в браузере через @remotion/player: ни рендера, ни хранения mp4, ни CDN-трафика за видео.

export const FPS = 30;
export const SIZE = 1080;
const PAD_SEC = 0.6;

const C = {
  bg: "#f6f7fb",
  text: "#1b2333",
  muted: "#6b7487",
  primary: "#1a91d6",
  primarySoft: "#e4f3fc",
  gold: "#f0b400",
  goldSoft: "#fff6d6",
  success: "#21b26f",
  border: "#e3e7ef",
  surface: "#ffffff",
};

const FONT = '"Nunito Variable", system-ui, sans-serif';
const MONO = '"JetBrains Mono Variable", ui-monospace, monospace';

export function sceneTimeline(lang: Lang) {
  const table = (durations as Record<string, Record<string, number>>)[lang] ?? {};
  let from = 0;
  return SCENES.map((s) => {
    const sec = (table[s.id] ?? s.fallbackSec) + PAD_SEC;
    const frames = Math.ceil(sec * FPS);
    const item = { scene: s, from, frames, hasAudio: s.id in table };
    from += frames;
    return item;
  });
}

export function totalFrames(lang: Lang) {
  return sceneTimeline(lang).reduce((a, s) => a + s.frames, 0);
}

// ---------- Общие элементы ----------

function useAppear(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 140 } });
}

function Heading({ children }: { children: string }) {
  const p = useAppear(0);
  return (
    <div
      style={{
        position: "absolute",
        top: 90,
        left: 60,
        right: 60,
        textAlign: "center",
        fontSize: 66,
        fontWeight: 900,
        color: C.text,
        opacity: p,
        transform: `translateY(${(1 - p) * 30}px)`,
      }}
    >
      {children}
    </div>
  );
}

function Box({ children, accent, size = 150, delay = 0, style }: { children: React.ReactNode; accent?: boolean; size?: number; delay?: number; style?: React.CSSProperties }) {
  const p = useAppear(delay);
  return (
    <div
      style={{
        width: size,
        height: size * 1.15,
        borderRadius: 36,
        border: `6px solid ${accent ? C.gold : C.border}`,
        background: accent ? C.goldSoft : C.surface,
        boxShadow: accent ? `0 0 50px ${C.gold}88` : `0 8px 0 ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: MONO,
        fontWeight: 800,
        fontSize: size * 0.62,
        color: C.text,
        transform: `scale(${p})`,
        transition: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Tag({ children, color = C.primary, bg = C.primarySoft, delay = 0 }: { children: React.ReactNode; color?: string; bg?: string; delay?: number }) {
  const p = useAppear(delay);
  return (
    <div
      style={{
        marginTop: 22,
        padding: "6px 18px",
        borderRadius: 16,
        background: bg,
        color,
        fontFamily: MONO,
        fontWeight: 800,
        fontSize: 40,
        opacity: p,
        transform: `translateY(${(1 - p) * 20}px)`,
      }}
    >
      {children}
    </div>
  );
}

function Lamp({ on, size = 200 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {on && <circle cx="50" cy="42" r="40" fill={C.gold} opacity="0.25" />}
      <path d="M50 12 a26 26 0 0 1 16 46 v10 h-32 v-10 a26 26 0 0 1 16 -46 z" fill={on ? C.gold : "#d5dbe6"} stroke={on ? "#c98507" : "#aab3c3"} strokeWidth="3" />
      <rect x="36" y="70" width="28" height="7" rx="3" fill="#8a94a6" />
      <rect x="38" y="79" width="24" height="7" rx="3" fill="#8a94a6" />
      {on && <path d="M42 46 l8 -10 l8 10" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />}
    </svg>
  );
}

/** Субтитры: делим текст на фразы и показываем их пропорционально длине. */
function Subtitles({ text, frames }: { text: string; frames: number }) {
  const frame = useCurrentFrame();
  const parts = text.match(/[^.!?:]+[.!?:]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const usable = frames - PAD_SEC * FPS;
  let acc = 0;
  let current = parts[parts.length - 1];
  for (const p of parts) {
    const end = ((acc + p.length) / total) * usable;
    if (frame < end) {
      current = p;
      break;
    }
    acc += p.length;
  }
  return (
    <div style={{ position: "absolute", left: 50, right: 50, bottom: 150, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          background: "rgba(16, 24, 40, 0.78)",
          color: "#fff",
          borderRadius: 22,
          padding: "14px 26px",
          fontSize: 38,
          fontWeight: 700,
          lineHeight: 1.3,
          textAlign: "center",
          maxWidth: 960,
        }}
      >
        {current}
      </div>
    </div>
  );
}

// ---------- Сцены ----------

type SceneProps = { lang: Lang; frames: number };

const L = {
  on: { ru: "ток есть", kk: "ток бар" },
  off: { ru: "тока нет", kk: "ток жоқ" },
  hundreds: { ru: "сотни", kk: "жүздік" },
  tens: { ru: "десятки", kk: "ондық" },
  ones: { ru: "единицы", kk: "бірлік" },
  remainder: { ru: "ост.", kk: "қалд." },
  read: { ru: "читаем снизу вверх", kk: "төменнен жоғары оқимыз" },
};

function FloatingBits() {
  const frame = useCurrentFrame();
  const items = Array.from({ length: 18 }, (_, i) => ({
    x: (i * 137) % 1000 + 20,
    y: (i * 251) % 1000,
    d: i % 2 ? "1" : "0",
    s: 40 + ((i * 7) % 5) * 12,
    v: 0.6 + ((i * 3) % 5) * 0.25,
  }));
  return (
    <>
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: it.x,
            top: ((it.y - frame * it.v * 2) % 1080 + 1080) % 1080,
            fontFamily: MONO,
            fontWeight: 800,
            fontSize: it.s,
            color: C.primary,
            opacity: 0.12,
          }}
        >
          {it.d}
        </div>
      ))}
    </>
  );
}

function TitleScene({ lang }: SceneProps) {
  const p = useAppear(4);
  const t = useAppear(12);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <FloatingBits />
      <div style={{ transform: `scale(${p})` }}>
        <Mascot mood="happy" size={300} />
      </div>
      <div style={{ marginTop: 30, fontSize: 78, fontWeight: 900, color: C.text, textAlign: "center", padding: "0 60px", opacity: t, transform: `translateY(${(1 - t) * 30}px)` }}>
        {SCENES[0].heading[lang]}
      </div>
      <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 56, fontWeight: 800, color: C.primary, opacity: t }}>0 · 1</div>
    </AbsoluteFill>
  );
}

function LampsScene({ lang, frames }: SceneProps) {
  const frame = useCurrentFrame();
  const split = Math.round(frames * 0.42);
  const showBig = frame >= split;
  const gridOpacity = interpolate(frame, [split - 10, split], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Heading>{SCENES[1].heading[lang]}</Heading>
      {!showBig && (
        <div style={{ position: "absolute", top: 260, left: 140, right: 140, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 26, opacity: gridOpacity }}>
          {Array.from({ length: 24 }, (_, i) => {
            const on = Math.floor(frame / 6 + i * 1.7) % 3 !== 0;
            return (
              <div key={i} style={{ display: "flex", justifyContent: "center" }}>
                <Lamp on={on} size={110} />
              </div>
            );
          })}
        </div>
      )}
      {showBig && (
        <Sequence from={split} layout="none">
          <div style={{ position: "absolute", top: 280, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 140 }}>
            {[true, false].map((on, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Box size={110} delay={i * 8} accent={on} style={{ height: 300, width: 260, flexDirection: "column", fontSize: 0 }}>
                  <Lamp on={on} size={200} />
                </Box>
                <Tag delay={10 + i * 8}>{on ? 1 : 0}</Tag>
                <div style={{ marginTop: 10, fontSize: 40, fontWeight: 800, color: C.muted }}>{on ? L.on[lang] : L.off[lang]}</div>
              </div>
            ))}
          </div>
        </Sequence>
      )}
    </AbsoluteFill>
  );
}

function DecimalScene({ lang, frames }: SceneProps) {
  const frame = useCurrentFrame();
  const digits = ["3", "4", "5"];
  const labels = [L.hundreds, L.tens, L.ones];
  const weights = ["×100", "×10", "×1"];
  const sumAt = Math.round(frames * 0.55);
  const sum = interpolate(frame, [sumAt, sumAt + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Heading>{SCENES[2].heading[lang]}</Heading>
      <div style={{ position: "absolute", top: 270, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 40 }}>
        {digits.map((d, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Box delay={6 + i * 8} size={170}>
              {d}
            </Box>
            <Tag delay={20 + i * 10}>{weights[i]}</Tag>
            <div style={{ marginTop: 8, fontSize: 34, fontWeight: 800, color: C.muted, opacity: interpolate(frame, [30 + i * 10, 40 + i * 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
              {labels[i][lang]}
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", top: 760, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontWeight: 800, fontSize: 70, color: C.text, opacity: sum, transform: `scale(${0.9 + sum * 0.1})` }}>
        300 + 40 + 5 = <span style={{ color: C.primary }}>345</span>
      </div>
    </AbsoluteFill>
  );
}

function WeightsScene({ lang, frames }: SceneProps) {
  const frame = useCurrentFrame();
  const weights = [8, 4, 2, 1];
  const step = Math.round((frames * 0.55) / 4);
  const startAt = Math.round(frames * 0.35);
  return (
    <AbsoluteFill>
      <Heading>{SCENES[3].heading[lang]}</Heading>
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 34 }}>
        {weights.map((w, i) => {
          const order = 3 - i; // появляются справа налево: 1, 2, 4, 8
          const at = startAt + order * step;
          const shown = frame >= at;
          return (
            <div key={w} style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: shown ? 1 : 0.25 }}>
              <Box size={160} delay={order * 4}>
                {shown ? "?" : ""}
              </Box>
              {shown && (
                <Sequence from={at} layout="none">
                  <Tag color="#c98507" bg={C.goldSoft}>
                    {w}
                  </Tag>
                </Sequence>
              )}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          top: 720,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: MONO,
          fontWeight: 800,
          fontSize: 60,
          color: C.primary,
          opacity: interpolate(frame, [startAt + 3 * step, startAt + 3 * step + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        ×2 ← ×2 ← ×2
      </div>
    </AbsoluteFill>
  );
}

function ExampleScene({ lang, frames }: SceneProps) {
  const frame = useCurrentFrame();
  const bits = "1011".split("");
  const weights = [8, 4, 2, 1];
  const lightAt = Math.round(frames * 0.35);
  const sumAt = Math.round(frames * 0.62);
  const resultAt = Math.round(frames * 0.85);
  const terms = ["8", "2", "1"];
  return (
    <AbsoluteFill>
      <Heading>{SCENES[4].heading[lang]}</Heading>
      <div style={{ position: "absolute", top: 280, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 30 }}>
        {bits.map((b, i) => {
          const lit = b === "1" && frame >= lightAt + i * 6;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Box size={160} delay={i * 5} accent={lit}>
                {b}
              </Box>
              <Tag delay={14 + i * 5} color={lit ? "#c98507" : C.muted} bg={lit ? C.goldSoft : "#eef1f6"}>
                {weights[i]}
              </Tag>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 760, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontWeight: 800, fontSize: 76, color: C.text }}>
        {terms.map((term, i) => {
          const o = interpolate(frame, [sumAt + i * 10, sumAt + i * 10 + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <span key={i} style={{ opacity: o }}>
              {i > 0 ? " + " : ""}
              {term}
            </span>
          );
        })}
        <span style={{ opacity: interpolate(frame, [resultAt, resultAt + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), color: C.success }}> = 11</span>
      </div>
    </AbsoluteFill>
  );
}

function DivisionScene({ lang, frames }: SceneProps) {
  const frame = useCurrentFrame();
  const rows = [
    [13, 6, 1],
    [6, 3, 0],
    [3, 1, 1],
    [1, 0, 1],
  ];
  const firstAt = Math.round(frames * 0.3);
  const rowStep = Math.round(frames * 0.1);
  const arrowAt = firstAt + rowStep * 4 + 6;
  const arrow = interpolate(frame, [arrowAt, arrowAt + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill>
      <Heading>{SCENES[5].heading[lang]}</Heading>
      <div style={{ position: "absolute", top: 230, left: 150, display: "flex", flexDirection: "column", gap: 22 }}>
        {rows.map(([v, q, r], i) => {
          const o = interpolate(frame, [firstAt + i * rowStep, firstAt + i * rowStep + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                opacity: o,
                transform: `translateX(${(1 - o) * -40}px)`,
                display: "flex",
                alignItems: "center",
                gap: 22,
                fontFamily: MONO,
                fontWeight: 800,
                fontSize: 64,
                color: C.text,
                background: C.surface,
                border: `5px solid ${C.border}`,
                borderRadius: 28,
                padding: "10px 30px",
              }}
            >
              <span style={{ width: 90, textAlign: "right" }}>{v}</span>
              <span style={{ color: C.muted }}>: 2 =</span>
              <span style={{ width: 50 }}>{q}</span>
              <span style={{ fontFamily: FONT, fontSize: 32, color: C.muted }}>{L.remainder[lang]}</span>
              <span style={{ background: C.goldSoft, color: "#c98507", borderRadius: 16, padding: "0 18px" }}>{r}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 240, right: 140, height: 440, width: 20, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div style={{ height: `${arrow * 100}%`, background: C.primary, borderRadius: 10, position: "relative" }}>
          {arrow > 0.05 && (
            <div style={{ position: "absolute", top: -34, left: -22, width: 0, height: 0, borderLeft: "32px solid transparent", borderRight: "32px solid transparent", borderBottom: `40px solid ${C.primary}` }} />
          )}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 760,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: interpolate(frame, [arrowAt + 14, arrowAt + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 800, color: C.muted }}>{L.read[lang]}</div>
        <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: 84, color: C.primary }}>
          1101<sub style={{ fontSize: 40 }}>2</sub>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function OutroScene({ lang }: SceneProps) {
  const p = useAppear(2);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <FloatingBits />
      <div style={{ transform: `scale(${p})` }}>
        <Mascot mood="celebrate" size={300} />
      </div>
      <div style={{ marginTop: 26, fontSize: 84, fontWeight: 900, color: C.text, opacity: p }}>{SCENES[6].heading[lang]}</div>
    </AbsoluteFill>
  );
}

const SCENE_COMPONENTS: Record<string, React.FC<SceneProps>> = {
  title: TitleScene,
  lamps: LampsScene,
  decimal: DecimalScene,
  weights: WeightsScene,
  example: ExampleScene,
  division: DivisionScene,
  outro: OutroScene,
};

export interface BinaryIntroProps extends Record<string, unknown> {
  lang: Lang;
  subtitles: boolean;
}

export const BinaryIntro: React.FC<BinaryIntroProps> = ({ lang, subtitles }) => {
  const timeline = sceneTimeline(lang);
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${C.border}66 2px, transparent 2px), linear-gradient(90deg, ${C.border}66 2px, transparent 2px)`,
          backgroundSize: "60px 60px",
        }}
      />
      {timeline.map(({ scene, from, frames, hasAudio }) => {
        const Comp = SCENE_COMPONENTS[scene.id];
        return (
          <Sequence key={scene.id} from={from} durationInFrames={frames} premountFor={FPS}>
            <Comp lang={lang} frames={frames} />
            {hasAudio && <Html5Audio src={`/media/videos/binary-intro/${lang}/${scene.id}.mp3`} />}
            {subtitles && <Subtitles text={scene.narration[lang]} frames={frames} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
