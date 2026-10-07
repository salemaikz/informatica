import type { CSSProperties, ReactNode } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "@fontsource-variable/nunito";
import "@fontsource-variable/jetbrains-mono";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const entrance = { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) };
export const mono: CSSProperties = { fontFamily: "'JetBrains Mono Variable', monospace", fontWeight: 700 };

export function ReelCanvas({ children, background, color = "#15253a" }: { children: ReactNode; background: string; color?: string }) {
  return <AbsoluteFill style={{ background, color, fontFamily: "'Nunito Variable', sans-serif", overflow: "hidden" }}>{children}</AbsoluteFill>;
}

export function SceneHeading({ children, color = "inherit", top = 234 }: { children: ReactNode; color?: string; top?: number }) {
  const frame = useCurrentFrame();
  return <div style={{ position: "absolute", left: 90, right: 90, top, fontSize: 92, fontWeight: 950, lineHeight: 1.06, letterSpacing: -3, whiteSpace: "pre-line", color, opacity: interpolate(frame, [0, 16], [0, 1], clamp), translate: interpolate(frame, [0, 22], ["0px 36px", "0px 0px"], entrance) }}>{children}</div>;
}

export function Eyebrow({ children, color = "inherit" }: { children: ReactNode; color?: string }) {
  return <div style={{ position: "absolute", left: 90, right: 90, top: 128, fontSize: 34, fontWeight: 850, letterSpacing: 2.5, color }}>{children}</div>;
}

export function Note({ children, top = 1400, color = "inherit", style }: { children: ReactNode; top?: number; color?: string; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  return <div style={{ position: "absolute", left: 90, right: 90, top, fontSize: 48, fontWeight: 750, lineHeight: 1.2, color, opacity: interpolate(frame, [12, 28], [0, 1], clamp), ...style }}>{children}</div>;
}

export function BackgroundMusic({ track }: { track: "quiet-focus" | "bit-arcade" }) {
  const { fps } = useVideoConfig();
  return <Audio name={track === "quiet-focus" ? "Quiet Focus" : "Bit Arcade"} src={staticFile(`media/music/${track}.wav`)} loop loopVolumeCurveBehavior="extend" premountFor={fps} volume={(frame) => interpolate(frame, [0, 24, 570, 600], [0, 0.62, 0.62, 0], clamp)} />;
}

export function ReelProgress({ color }: { color: string }) {
  const frame = useCurrentFrame();
  return <div style={{ position: "absolute", left: 90, right: 90, top: 1552, height: 8, background: `${color}25`, borderRadius: 4 }}><div style={{ width: `${interpolate(frame, [0, 599], [0, 100], clamp)}%`, height: 8, borderRadius: 4, background: color }} /></div>;
}

export function DarkBackdrop() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#101722" }}>
    <div style={{ position: "absolute", width: 1000, height: 1000, left: 310, top: 30, borderRadius: "50%", background: "radial-gradient(circle, #1b526e66, #10172200 68%)", translate: `${Math.sin(frame / 90) * 35}px ${Math.cos(frame / 100) * 24}px` }} />
    <svg width="1080" height="1920" style={{ position: "absolute", opacity: 0.15 }}><defs><pattern id="ig-dark-grid" width="90" height="90" patternUnits="userSpaceOnUse"><path d="M 90 0 L 0 0 0 90" fill="none" stroke="#79dcff" strokeWidth="1" /></pattern></defs><rect width="1080" height="1920" fill="url(#ig-dark-grid)" /></svg>
  </AbsoluteFill>;
}

export function PaperBackdrop() {
  return <AbsoluteFill style={{ background: "#fff3dc" }}><svg width="1080" height="1920" style={{ position: "absolute", opacity: 0.2 }}><defs><pattern id="ig-paper-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.3" fill="#d7974f" /></pattern></defs><rect width="1080" height="1920" fill="url(#ig-paper-dots)" /></svg><div style={{ position: "absolute", left: 24, right: 24, top: 28, bottom: 28, border: "3px solid #dfbd87", borderRadius: 14 }} /></AbsoluteFill>;
}

export function LightBackdrop() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#f4f8fc" }}><div style={{ position: "absolute", width: 1000, height: 1000, borderRadius: "50%", background: "radial-gradient(circle, #beeaff99, #f4f8fc00 68%)", top: 130, left: 60, translate: `${Math.sin(frame / 100) * 22}px 0px` }} /><div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, #ccf3e777, #f4f8fc00 68%)", top: 860, left: -160 }} /></AbsoluteFill>;
}
