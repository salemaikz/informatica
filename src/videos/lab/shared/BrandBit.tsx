// Геометрия и цвета из логотипа и Mascot.tsx; движение зависит только от кадра.
export function BrandBit({ frame, size = 160, mood = "neutral" }: { frame: number; size?: number; mood?: "neutral" | "thinking" | "happy" | "celebrate" }) {
  const happy = mood === "happy" || mood === "celebrate";
  const blink = frame % 132 > 126;
  const lift = mood === "celebrate" ? Math.abs(Math.sin(frame / 9)) * 5 : Math.sin(frame / 24) * 1.5;
  return <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Бит" style={{ overflow: "visible", transform: `translateY(${-lift}px)` }}>
    <ellipse cx="60" cy="110" rx="35" ry="5" fill="#1b2333" opacity=".1" />
    <g>
      <g transform={`rotate(${Math.sin(frame / 19) * 3} 60 27)`}><line x1="60" y1="14" x2="60" y2="27" stroke="#1277b3" strokeWidth="4" strokeLinecap="round" /><circle cx="60" cy="11" r="6.5" fill="#f0b400" /></g>
      <rect x="9" y="54" width="12" height="24" rx="6" fill="#1277b3" /><rect x="99" y="54" width="12" height="24" rx="6" fill="#1277b3" />
      <rect x="17" y="26" width="86" height="78" rx="28" fill="#1a91d6" /><rect x="25" y="30" width="70" height="16" rx="8" fill="#fff" opacity=".18" />
      <rect x="28" y="42" width="64" height="50" rx="17" fill="#10263d" />
      <g fill="none" stroke="#7fe3ff" strokeWidth="5" strokeLinecap="round">
        {blink ? <path d="M40 63 h12 M68 63 h12" /> : happy ? <path d="M39 64 q7 -9 14 0 M67 64 q7 -9 14 0" /> : <><circle cx="46" cy="62" r="3" fill="#7fe3ff" />{mood === "thinking" ? <path d="M68 62 h12" /> : <circle cx="74" cy="62" r="3" fill="#7fe3ff" />}</>}
        <path d={happy ? "M50 75 q10 9 20 0" : mood === "thinking" ? "M52 78 h16" : "M53 76 q7 5 14 0"} strokeWidth="4" />
      </g>
      <circle cx="35" cy="80" r="4" fill="#ff8fb1" opacity=".55" /><circle cx="85" cy="80" r="4" fill="#ff8fb1" opacity=".55" />
    </g>
  </svg>;
}
