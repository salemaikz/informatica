"use client";

import { Mascot } from "@/components/mascot/Mascot";
import { ArtSvg, CodePlate, Floor, Keypad, NIGHT, Stars, Wall } from "./parts";

/** Комната квеста: стены, окно, плакат с нулями и единицами, закрытая дверь с замком и Бит у входа. */
export function RoomArt({ code }: { code?: string }) {
  return (
    <div className="relative">
      <ArtSvg>
        <Wall height={150} />
        <Floor y={150} />
        <ellipse cx="108" cy="180" rx="74" ry="13" className="fill-gold-soft stroke-gold/50" strokeWidth="1.5" />

        {/* плакат */}
        <rect x="22" y="40" width="50" height="66" rx="4" className="fill-surface stroke-border" strokeWidth="2" />
        <rect x="29" y="47" width="36" height="8" rx="3" className="fill-gold" />
        {["0110", "1001", "1100", "0011"].map((row, i) => (
          <text key={row} x="47" y={72 + i * 8.5} textAnchor="middle" dominantBaseline="central" fontSize="8.5" fontWeight={800} letterSpacing="1.5" className="fill-primary font-mono">
            {row}
          </text>
        ))}

        {/* окно */}
        <rect x="104" y="34" width="64" height="64" rx="9" className="fill-surface stroke-border" strokeWidth="3" />
        <rect x="110" y="40" width="52" height="52" rx="5" style={{ fill: NIGHT }} />
        <Stars points={[[121, 49, 1.2], [148, 47, 1.1], [154, 60, 1], [126, 62, 1]]} />
        <path d="M143 76 a7 7 0 1 0 5 10 a5.6 5.6 0 1 1 -5 -10z" className="fill-gold" />
        <path d="M136 40 V92 M110 66 H162" className="stroke-border" strokeWidth="2.2" />

        {/* дверь */}
        <CodePlate code={code} x={212} y={8} w={92} h={24} maxFont={15} />
        <rect x="222" y="40" width="72" height="110" rx="5" className="fill-primary-strong" />
        <rect x="227" y="45" width="62" height="105" rx="3" className="fill-primary" />
        <rect x="234" y="53" width="34" height="38" rx="4" className="fill-primary-strong/25" />
        <rect x="234" y="98" width="34" height="42" rx="4" className="fill-primary-strong/25" />
        <circle cx="279" cy="104" r="4.6" className="fill-gold" />
        <Keypad x={192} y={80} scale={0.62} />
      </ArtSvg>
      <div className="pointer-events-none absolute bottom-[3%] left-[12%] w-[28%]">
        <Mascot mood="happy" size={92} className="h-auto w-full" />
      </div>
    </div>
  );
}
