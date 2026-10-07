import { AbsoluteFill, Interactive } from "remotion";
import type { ReactNode } from "react";
import { lessonFonts } from "../typography";

export const notebookColors = { paper: "#fffcf3", ink: "#203b69", muted: "#57708d", blue: "#356da3", gold: "#f4d36a", green: "#257663", red: "#c95152" };

export function NotebookPage({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return <AbsoluteFill style={{ backgroundColor: "#e9e4d9", color: notebookColors.ink, fontFamily: lessonFonts.text }}>
    <div style={{ position: "absolute", inset: "62px 52px", backgroundColor: notebookColors.paper, borderRadius: 6, boxShadow: "8px 15px 0 #c9c2b4" }} />
    <svg viewBox="0 0 1080 1080" style={{ position: "absolute", inset: 0 }} aria-hidden="true"><line x1="112" x2="112" y1="84" y2="1000" stroke="#e5ad9d" strokeWidth="3" />{[420,500,580,660,740,820,900,980].map((y) => <line key={y} x1="92" x2="986" y1={y} y2={y} stroke="#d8e2eb" strokeWidth="2" />)}</svg>
    <div style={{ position: "absolute", left: 140, top: 103, fontSize: 44, fontWeight: 850, color: notebookColors.blue }}>Informatica · Python</div>
    <Interactive.Div name="Notebook title" style={{ position: "absolute", left: 140, right: 95, top: 182, whiteSpace: "pre-line", fontSize: 84, lineHeight: 1.07, letterSpacing: -2, fontWeight: 850, rotate: "-1deg" }}>{title}</Interactive.Div>
    {children}
    <Interactive.Div name="Notebook explanation" style={{ position: "absolute", left: 140, right: 95, top: 855, fontSize: 44, fontWeight: 750, lineHeight: 1.2 }}>{caption}</Interactive.Div>
  </AbsoluteFill>;
}

export function NotebookArray({ selected = -1, negative = false }: { selected?: number; negative?: boolean }) {
  return <div style={{ position: "absolute", top: 461, left: 226, width: 644, fontFamily: lessonFonts.code }}>
    <span style={{ position: "absolute", left: -76, top: 13, fontSize: 98, color: notebookColors.ink }}>[</span>
    {[4,7,9].map((value,i) => <div key={value} style={{ position: "absolute", left: i * 230, width: 150, height: 142, fontSize: 104, textAlign: "center", fontWeight: 800, color: notebookColors.ink }}>
      <div style={{ position: "absolute", left: 4, top: 18, width: 143, height: 118, backgroundColor: selected === i ? "#f4d36a9c" : "transparent", rotate: "-3deg", borderRadius: "9px 18px 7px 13px" }} />
      <span style={{ position: "relative" }}>{value}</span>
      {i < 2 && <span style={{ position: "absolute", right: -36, top: 13, fontSize: 87 }}>,</span>}
      <div style={{ position: "absolute", top: 156, left: 16, width: 120, fontSize: 55, color: notebookColors.blue }}>{negative ? i - 3 : i}</div>
    </div>)}
    <span style={{ position: "absolute", left: 632, top: 13, fontSize: 98, color: notebookColors.ink }}>]</span>
  </div>;
}

export function NotebookPen() {
  return <svg width="64" height="138" viewBox="0 0 64 138" aria-hidden="true"><path d="M12 10 L44 10 L44 100 L28 128 L12 100 Z" fill="#356da3" stroke="#203b69" strokeWidth="3" /><path d="M12 100 L44 100 L28 128 Z" fill="#dfbd90" /><path d="M24 120 L32 120 L28 128 Z" fill="#203b69" /><path d="M19 18 L19 94" stroke="#72a4d1" strokeWidth="6" /></svg>;
}
