import { AbsoluteFill, Interactive } from "remotion";
import type { ReactNode } from "react";
import { lessonFonts } from "../typography";

export const shelfColors = { bg: "#f2e4ca", ink: "#332519", wood: "#b57542", lightWood: "#dcaa72", blue: "#235f80", mint: "#2c7456", danger: "#bb3c34", paper: "#fff9ed" };

export function ShelfStage({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return <AbsoluteFill style={{ backgroundColor: shelfColors.bg, color: shelfColors.ink, fontFamily: lessonFonts.text }}>
    <div style={{ position: "absolute", left: 80, top: 100, fontSize: 44, fontWeight: 850, color: shelfColors.blue }}>Informatica · Python</div>
    <Interactive.Div name="Shelf headline" style={{ position: "absolute", left: 80, right: 80, top: 178, fontSize: 86, lineHeight: 1.07, fontWeight: 900, letterSpacing: -2, whiteSpace: "pre-line" }}>{title}</Interactive.Div>
    {children}
    <Interactive.Div name="Shelf explanation" style={{ position: "absolute", left: 80, right: 80, top: 850, fontSize: 44, lineHeight: 1.22, fontWeight: 750 }}>{caption}</Interactive.Div>
  </AbsoluteFill>;
}

/** Все ящики принадлежат одной полке и управляются как один шаблон. */
export function ShelfRow({ active = -1, negative = false }: { active?: number; negative?: boolean }) {
  return <div style={{ position: "absolute", left: 110, top: 485, width: 780 }}>
    <div style={{ position: "absolute", left: -18, top: 195, width: 830, height: 26, borderRadius: 4, backgroundColor: shelfColors.wood, boxShadow: "0 12px 0 #8b5630" }} />
    {[4, 7, 9].map((value, i) => <div key={value} style={{ position: "absolute", left: i * 278, top: 0, width: 228, height: 190, borderRadius: "15px 15px 7px 7px", backgroundColor: shelfColors.lightWood, border: `6px solid ${active === i ? shelfColors.mint : shelfColors.wood}`, boxShadow: "inset 0 -13px 0 #c59058, 0 14px 18px #71502922" }}>
      <div style={{ margin: "27px 34px", backgroundColor: shelfColors.paper, borderRadius: 8, textAlign: "center", fontFamily: lessonFonts.code, fontSize: 102, lineHeight: 1.27, fontWeight: 800, color: shelfColors.ink }}>{value}</div>
      <div style={{ position: "absolute", bottom: 16, left: 85, width: 52, height: 8, borderRadius: 5, backgroundColor: shelfColors.wood }} />
      <div style={{ position: "absolute", top: 267, left: 47, width: 130, textAlign: "center", fontFamily: lessonFonts.code, fontSize: 58, fontWeight: 800, color: active === i ? shelfColors.mint : shelfColors.blue }}>{negative ? i - 3 : i}</div>
    </div>)}
  </div>;
}
