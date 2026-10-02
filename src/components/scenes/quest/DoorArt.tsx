"use client";

import { m } from "motion/react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { ArtSvg, CodePlate, Floor, Keypad, Sparkle, SuccessBadge, Wall } from "./parts";

const FRAME = "M110 152 V90 a50 50 0 0 1 100 0 V152 Z";
const INNER = "M116 152 V90 a44 44 0 0 1 88 0 V152 Z";

/** Дверь с кодовым замком: закрытая (код на табличке над дверью) или открытая (свет из проёма). */
export function DoorArt({ open, code }: { open: boolean; code?: string }) {
  const reduce = useReduceMotion();
  const pulse = reduce ? undefined : { opacity: [0.7, 1, 0.7] };

  return (
    <ArtSvg>
      <Wall />
      <Floor />
      <rect x="120" y="159" width="80" height="9" rx="4.5" className="fill-gold-soft stroke-gold/50" strokeWidth="1.5" />
      <CodePlate code={code} x={80} y={8} w={160} />

      <path d={FRAME} className="fill-primary-strong" />
      {open ? (
        <g>
          <path d={INNER} className="fill-gold-soft" />
          <m.path d={INNER} className="fill-gold/40" animate={pulse} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
          <path d="M126 152 V92 a34 34 0 0 1 68 0 V152 Z" className="fill-gold/30" />
          <m.polygon
            points="116,152 204,152 272,200 48,200"
            className="fill-gold/25"
            animate={pulse}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
          />
          {/* створка, распахнутая к зрителю */}
          <polygon points="116,88 92,76 92,162 116,152" className="fill-primary stroke-primary-strong" strokeWidth="2" strokeLinejoin="round" />
          <polygon points="111,101 98,94 98,148 111,142" className="fill-primary-strong/25" />
          <circle cx="97" cy="124" r="3.6" className="fill-gold" />
          <Sparkle x={252} y={62} s={8} />
          <Sparkle x={278} y={92} s={6} delay={0.8} />
          <Sparkle x={58} y={50} s={6} delay={1.4} />
          <SuccessBadge x={286} y={32} />
        </g>
      ) : (
        <g>
          <path d={INNER} className="fill-primary" />
          <path d="M126 108 V92 a30 30 0 0 1 60 0 V108 Z" className="fill-primary-strong/25" />
          <rect x="126" y="116" width="60" height="28" rx="5" className="fill-primary-strong/25" />
          <circle cx="195" cy="122" r="5.5" className="fill-gold" />
          <circle cx="195" cy="122" r="5.5" fill="none" className="stroke-warning-strong" strokeWidth="1.5" />
        </g>
      )}

      <Keypad x={226} y={88} ok={open} />
    </ArtSvg>
  );
}
