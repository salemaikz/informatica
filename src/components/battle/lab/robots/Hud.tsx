"use client";

import { m } from "motion/react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Fighter } from "../types";
import { Robot } from "./Robot";

// HUD в духе мобильного файтинга: полоски здоровья-параллелограммы, аватары, таймер, счётчик комбо.

const hpTone = (hp: number) => (hp > 50 ? "bg-success" : hp >= 25 ? "bg-warning" : "bg-danger");

function Bar({ hp, right }: { hp: number; right?: boolean }) {
  const w = `${Math.max(0, Math.min(100, hp))}%`;
  return (
    <div className="relative h-[22px] -skew-x-[14deg] overflow-hidden rounded-[4px] border-2 border-white/85 bg-black/60 shadow-[0_2px_0_rgba(0,0,0,0.5)]">
      {/* «Призрак» урона: догоняет с задержкой. */}
      <m.div
        className={cn("absolute inset-y-0 bg-white/85", right ? "right-0" : "left-0")}
        initial={false}
        animate={{ width: w }}
        transition={{ delay: 0.45, duration: 0.5, ease: "easeOut" }}
      />
      <m.div
        className={cn("absolute inset-y-0", right ? "right-0" : "left-0", hpTone(hp))}
        initial={false}
        animate={{ width: w }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="h-1/2 w-full bg-white/30" />
      </m.div>
    </div>
  );
}

function Side({ f, right, dead }: { f: Fighter; right?: boolean; dead: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-end gap-2", right && "flex-row-reverse")}>
      <div className="relative size-[42px] shrink-0 overflow-hidden rounded-xl border-2 border-white/85 bg-[#0d1535] shadow-[0_2px_0_rgba(0,0,0,0.5)]">
        <div className={cn("size-full", right && "-scale-x-100")}>
          <Robot skin={f.skin} bust idle={false} dead={dead} />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className={cn("flex items-baseline gap-1.5 text-white", right && "flex-row-reverse")}>
          <span className="truncate text-[15px] font-black uppercase leading-none [text-shadow:0_2px_0_rgba(0,0,0,0.6)]">{f.name}</span>
        </div>
        <Bar hp={f.hp} right={right} />
        <div className={cn("flex items-center gap-1.5 text-[11px] font-extrabold leading-none tabular-nums text-white/85", right && "flex-row-reverse")}>
          <span>{Math.round(f.hp)}/100</span>
          <span className="whitespace-nowrap rounded bg-white/20 px-1 py-0.5 text-[10px] leading-none text-white">ур. {f.level}</span>
        </div>
      </div>
    </div>
  );
}

export function Hud({ you, opp, timeLeftMs }: { you: Fighter; opp: Fighter; timeLeftMs: number }) {
  const sec = Math.ceil(timeLeftMs / 1000);
  const low = sec <= 10;
  return (
    <div className="absolute inset-x-0 top-0 z-30 flex items-start gap-2 px-2.5 pt-2.5">
      <Side f={you} dead={you.hp <= 0} />
      <div
        className={cn(
          "mt-0.5 grid h-[52px] w-[62px] shrink-0 place-items-center text-center [clip-path:polygon(25%_0,75%_0,100%_25%,100%_75%,75%_100%,25%_100%,0_75%,0_25%)]",
          low ? "bg-danger" : "bg-white/90",
        )}
      >
        <div className={cn("grid h-[46px] w-[56px] place-items-center bg-[#0b1230] [clip-path:polygon(25%_0,75%_0,100%_25%,100%_75%,75%_100%,25%_100%,0_75%,0_25%)]")}>
          <div className="flex flex-col items-center">
            <span className={cn("text-[19px] font-black leading-none tabular-nums", low ? "text-danger motion-safe:animate-pulse" : "text-white")}>
              {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
            </span>
            <span className="mt-0.5 text-[8px] font-extrabold uppercase tracking-widest text-white/60">время</span>
          </div>
        </div>
      </div>
      <Side f={opp} right dead={opp.hp <= 0} />
    </div>
  );
}

/** Счётчик комбо сбоку арены: «Комбо ×3» и пять делений до крита. */
export function ComboBadge({ combo }: { combo: number }) {
  if (combo < 2) return null;
  const ready = combo >= 5;
  return (
    <m.div
      key={combo}
      initial={{ scale: 0.6, x: -18, opacity: 0 }}
      animate={{ scale: [0.6, 1.22, 1], x: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="absolute left-2 top-[84px] z-30 origin-left -skew-x-[8deg] rounded-md border-2 border-white/80 bg-[#150b00]/80 px-2.5 py-1 shadow-[0_3px_0_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center gap-1.5 text-streak">
        <Flame className="size-5 fill-current" aria-hidden />
        <span className="text-[11px] font-extrabold uppercase leading-none tracking-wider text-white/85">Комбо</span>
        <span className="text-[26px] font-black italic leading-none [text-shadow:0_2px_0_rgba(0,0,0,0.6)]">×{combo}</span>
      </div>
      <div className="mt-1 flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-sm", i < combo ? "bg-streak" : "bg-white/20")} />
        ))}
      </div>
      {ready && <div className="mt-0.5 text-center text-[9px] font-black uppercase tracking-widest text-streak">крит готов</div>}
    </m.div>
  );
}
