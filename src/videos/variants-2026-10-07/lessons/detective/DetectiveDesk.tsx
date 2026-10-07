import { AbsoluteFill, Interactive } from "remotion";
import type { ReactNode } from "react";
import { lessonFonts } from "../typography";

export const detectiveColors = { bg: "#101a22", panel: "#1b2b36", ink: "#edf2ec", muted: "#a8bebc", cyan: "#83d4d0", gold: "#efcd7e", red: "#ed7b75", paper: "#f2e8cf", darkInk: "#25313a" };

export function DetectiveDesk({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return <AbsoluteFill style={{ backgroundColor: detectiveColors.bg, color: detectiveColors.ink, fontFamily: lessonFonts.text }}>
    <div style={{ position: "absolute", left: 80, top: 100, fontSize: 44, fontWeight: 850, color: detectiveColors.cyan }}>Informatica · Python</div>
    <Interactive.Div name="Case title" style={{ position: "absolute", top: 179, left: 80, right: 80, fontSize: 84, fontWeight: 900, lineHeight: 1.08, letterSpacing: -2, whiteSpace: "pre-line" }}>{title}</Interactive.Div>
    <div style={{ position: "absolute", left: 80, right: 80, top: 425, height: 367, borderRadius: 24, backgroundColor: detectiveColors.panel, border: "2px solid #314b57" }} />
    {children}
    <Interactive.Div name="Case conclusion" style={{ position: "absolute", left: 80, right: 80, top: 860, fontSize: 44, fontWeight: 750, lineHeight: 1.2 }}>{caption}</Interactive.Div>
  </AbsoluteFill>;
}

export function EvidenceCards({ selected = -1, negative = false }: { selected?: number; negative?: boolean }) {
  return <div style={{ position: "absolute", left: 143, top: 467 }}>
    {[4,7,9].map((value,i) => <div key={value} style={{ position: "absolute", left: i * 280, width: 220, height: 226, paddingTop: 13, backgroundColor: detectiveColors.paper, borderRadius: 7, color: detectiveColors.darkInk, rotate: `${["-3deg", "2deg", "-1deg"][i]}`, boxShadow: "4px 10px 0 #071018", border: `5px solid ${selected === i ? detectiveColors.cyan : "#d6c5a4"}`, textAlign: "center", fontFamily: lessonFonts.code }}>
      <div style={{ fontSize: 54, color: "#64707b", borderBottom: "3px solid #d6c5a4", paddingBottom: 8 }}>{negative ? i - 3 : i}</div>
      <div style={{ fontSize: 104, lineHeight: 1.35, fontWeight: 800 }}>{value}</div>
    </div>)}
  </div>;
}

export function Magnifier() {
  return <svg width="147" height="175" viewBox="0 0 147 175" aria-hidden="true"><circle cx="61" cy="61" r="51" fill="#83d4d014" stroke={detectiveColors.cyan} strokeWidth="9" /><path d="M98 99 L137 158" stroke="#526e7e" strokeWidth="19" strokeLinecap="round" /><path d="M99 98 L137 156" stroke={detectiveColors.cyan} strokeWidth="6" strokeLinecap="round" /><path d="M32 35 Q58 14 82 32" fill="none" stroke="#e1fffd" strokeWidth="5" strokeLinecap="round" /></svg>;
}
