// Разметка картинки превью ссылки /r/<код> (1200 × 630) для ImageResponse (satori): только flex-вёрстка, шрифт Nunito
// (assets/fonts, подключает opengraph-image.tsx). Светлая палитра (CARD_COLORS). Без React-хуков: исполняется на сервере.
// Язык и числа — из кода ссылки; подписи — из словаря по меткам (строки из адреса не выводятся).

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { CARD_COLORS as C } from "@/lib/share-card";
import { sharePercent, type ShareResult } from "@/lib/share-code";
import { APP_NAME } from "@/lib/site-meta";
import { metaDict } from "@/i18n/parts/meta";
import { landingModel } from "./landing";
import { lessonTexts, tr } from "./labels";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_FONT = "Nunito";

const FLAME_PATH = "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4";

/** Маскот «Бит» (упрощённо, как в Mascot.tsx): тело, экран, глаза, улыбка. */
function Mascot({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <line x1="60" y1="14" x2="60" y2="27" stroke={C.primaryStrong} strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="11" r="6.5" fill={C.gold} />
      <rect x="9" y="54" width="12" height="24" rx="6" fill={C.primaryStrong} />
      <rect x="99" y="54" width="12" height="24" rx="6" fill={C.primaryStrong} />
      <rect x="17" y="26" width="86" height="78" rx="28" fill={C.primary} />
      <rect x="28" y="42" width="64" height="50" rx="17" fill="#10263d" />
      <rect x="42" y="55" width="11" height="15" rx="5" fill="#7fe3ff" />
      <rect x="67" y="55" width="11" height="15" rx="5" fill="#7fe3ff" />
      <path d="M50 75 Q60 84 70 75" stroke="#7fe3ff" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

const row = (extra: CSSProperties = {}): CSSProperties => ({ display: "flex", alignItems: "center", ...extra });

function Shell({ children, mascot = 84 }: { children: ReactNode; mascot?: number }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.primary, fontFamily: OG_FONT, padding: "36px 56px 48px" }}>
      <div style={row({ gap: 18, height: 96 })}>
        <Mascot size={mascot} />
        <div style={{ display: "flex", fontSize: 54, fontWeight: 900, color: "#ffffff" }}>{APP_NAME}</div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          background: C.surface,
          borderRadius: 44,
          padding: "30px 52px 34px",
          justifyContent: "space-between",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Bar({ ratio, showPct = true }: { ratio: number; showPct?: boolean }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div style={row({ gap: 24, width: "100%" })}>
      <div style={{ display: "flex", flex: 1, height: 30, borderRadius: 15, background: C.border }}>
        <div style={{ display: "flex", width: `${pct}%`, minWidth: pct > 0 ? 30 : 0, height: 30, borderRadius: 15, background: C.primary }} />
      </div>
      {showPct && <div style={{ display: "flex", fontSize: 44, fontWeight: 900, color: C.text, width: 120, justifyContent: "flex-end" }}>{Math.round(pct)}%</div>}
    </div>
  );
}

const muted = (size: number): CSSProperties => ({ display: "flex", fontSize: size, fontWeight: 800, color: C.muted });

/** Дерево картинки превью. `null` — битый код: брендовая заглушка (как public/og.png), а не ошибка. */
export function ogImageTree(r: ShareResult | null): ReactElement {
  if (!r) {
    return (
      <Shell>
        <div style={row({ gap: 40, flex: 1 })}>
          <Mascot size={230} />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 96, fontWeight: 900, color: C.primaryStrong }}>{APP_NAME}</div>
            <div style={muted(40)}>{metaDict["meta.title"].ru}</div>
            <div style={muted(40)}>{metaDict["meta.title"].kk}</div>
          </div>
        </div>
      </Shell>
    );
  }
  const m = landingModel(r, r.lang);
  const lang = r.lang;
  if (r.t === "exam") {
    const of = m.suffix ?? "";
    const num = <div style={{ display: "flex", fontSize: 190, fontWeight: 900, color: C.text, lineHeight: 1 }}>{m.big}</div>;
    const suffix = <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: C.muted }}>{of}</div>;
    return (
      <Shell>
        <div style={muted(40)}>{m.chip}</div>
        <div style={row({ gap: 28, alignItems: "baseline" })}>{m.suffixFirst ? [<div key="s" style={{ display: "flex" }}>{suffix}</div>, <div key="n" style={{ display: "flex" }}>{num}</div>] : [<div key="n" style={{ display: "flex" }}>{num}</div>, <div key="s" style={{ display: "flex" }}>{suffix}</div>]}</div>
        <Bar ratio={m.ratio ?? 0} />
        <div style={{ display: "flex", fontSize: 32, fontWeight: 900, color: C.primaryStrong }}>{m.text}</div>
      </Shell>
    );
  }
  if (r.t === "course") {
    const p = sharePercent(r.done, r.total);
    return (
      <Shell>
        <div style={muted(40)}>{tr(lang, "share.card.lead")}</div>
        <div style={{ display: "flex", fontSize: 190, fontWeight: 900, color: C.text, lineHeight: 1 }}>{`${p}%`}</div>
        <Bar ratio={p / 100} showPct={false} />
        <div style={{ display: "flex", fontSize: 32, fontWeight: 900, color: C.primaryStrong }}>{`${m.lines[0]} · ${m.lines[1]}`}</div>
      </Shell>
    );
  }
  if (r.t === "lesson") {
    const lt = lessonTexts(lang, r);
    return (
      <Shell>
        <div style={muted(40)}>{lt.lead}</div>
        <div style={{ display: "flex", fontSize: 190, fontWeight: 900, color: C.text, lineHeight: 1 }}>{`${r.accuracy}%`}</div>
        <Bar ratio={r.accuracy / 100} showPct={false} />
        <div style={{ display: "flex", fontSize: 32, fontWeight: 900, color: C.primaryStrong }}>{lt.stats}</div>
      </Shell>
    );
  }
  return (
    <Shell>
      <div style={muted(40)}>{m.eyebrow}</div>
      <div style={row({ gap: 36 })}>
        <svg width={170} height={170} viewBox="0 0 24 24">
          <path d={FLAME_PATH} fill={C.streakSoft} stroke={C.streak} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: "flex", fontSize: 190, fontWeight: 900, color: C.text, lineHeight: 1 }}>{m.big}</div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: C.muted }}>{m.suffix}</div>
      </div>
      <div style={{ display: "flex", fontSize: 32, fontWeight: 900, color: C.primaryStrong }}>{m.lines[0]}</div>
    </Shell>
  );
}
