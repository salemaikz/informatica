import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ReactNode } from "react";
import "@fontsource-variable/nunito";
import "@fontsource-variable/jetbrains-mono";

export const palette = { bg: "#101722", ink: "#f1f6fd", muted: "#98a8bf", surface: "#1c283a", primary: "#58c3ff", green: "#7addab", danger: "#ff8597", gold: "#f5c55e", purple: "#bc9aff" };

export function ReviewFrame({ label, title, caption, children, accent = palette.primary }: { label: string; title: string; caption: string; children: ReactNode; accent?: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <AbsoluteFill style={{ background: palette.bg, color: palette.ink, fontFamily: '"Nunito Variable", sans-serif', padding: "90px 84px" }}>
    <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: `radial-gradient(circle, ${accent}15, transparent 70%)`, right: -140, top: 100 }} />
    <div style={{ position: "relative", opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" }) }}>
      <div style={{ color: accent, fontSize: 28, fontWeight: 900, letterSpacing: 4, textTransform: "uppercase", marginBottom: 18 }}>Informatica / {label}</div>
      <div style={{ fontSize: 84, fontWeight: 950, letterSpacing: -3, lineHeight: 1.06, minHeight: 180 }}>{title}</div>
    </div>
    <div style={{ position: "absolute", left: 84, right: 84, top: 330, height: 355 }}>{children}</div>
    <div style={{ position: "absolute", left: 84, right: 84, top: 748, fontSize: 44, lineHeight: 1.25, fontWeight: 750 }}>{caption}</div>
    <div style={{ position: "absolute", left: 84, right: 84, bottom: 65, height: 6, borderRadius: 10, background: palette.surface, overflow: "hidden" }}>
      <div style={{ width: `${100 * frame / (durationInFrames - 1)}%`, height: "100%", borderRadius: 10, background: accent }} />
    </div>
  </AbsoluteFill>;
}
