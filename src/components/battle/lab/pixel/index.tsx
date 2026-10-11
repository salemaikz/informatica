"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, m, useAnimationControls, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import type { BattleEvent, BattleScreenProps, BattleVariant, Fighter } from "../types";
import { Background } from "./Background";
import { Dissolve, PixelStar, Slash, SpriteView } from "./Sprite";
import { HEROES } from "./sprites";

// Вариант «pixel»: ретро-JRPG. Спрайты 32×32 из прямоугольников, тёмно-синие окна с двойной белой рамкой.

const MONO = "font-mono font-extrabold uppercase tracking-wide";
const SHADOW = { textShadow: "2px 2px 0 #000" } as const;

function Win({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("relative rounded-lg p-3 text-white", MONO, className)}
      style={{
        background: "linear-gradient(#1b30b4, #0b1568)",
        boxShadow: "0 0 0 2px #05081f, inset 0 0 0 2px #ffffff, inset 0 0 0 4px #0b1568, inset 0 0 0 5px #cfd8ff",
        ...SHADOW,
      }}
    >
      {children}
    </div>
  );
}

const hpTone = (hp: number) => (hp > 50 ? "bg-success" : hp >= 25 ? "bg-warning" : "bg-danger");

/** Сегментная полоска здоровья: 20 делений по 5%. */
function HpBar({ hp }: { hp: number }) {
  const on = Math.ceil(Math.max(0, hp) / 5);
  return (
    <div className="flex gap-px rounded-sm bg-black p-0.5" role="progressbar" aria-valuenow={hp} aria-valuemin={0} aria-valuemax={100}>
      {Array.from({ length: 20 }, (_, i) => (
        <span key={i} className={cn("h-3 flex-1", i < on ? hpTone(hp) : "bg-white/15")} />
      ))}
    </div>
  );
}

const fmtTime = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const nameOf = (f: Fighter) => f.name.toUpperCase();
const verbReceives = (f: Fighter) => (f.name.toLowerCase() === "вы" ? "ПОЛУЧАЕТЕ" : "ПОЛУЧАЕТ");

function messageOf(e: BattleEvent | null, you: Fighter, opp: Fighter): { text: string; tone: string } {
  if (!e) return { text: `${nameOf(opp)} ВЫХОДИТ НА БОЙ! ВЫБЕРИТЕ ОТВЕТ.`, tone: "" };
  switch (e.kind) {
    case "hit": return { text: `${nameOf(opp)} ПОЛУЧАЕТ ${e.dmg} УРОНА!`, tone: "" };
    case "crit": return { text: `КРИТИЧЕСКИЙ УДАР! ${nameOf(opp)} ПОЛУЧАЕТ ${e.dmg} УРОНА!`, tone: "text-streak" };
    case "taken": return { text: `${nameOf(you)} ${verbReceives(you)} ${e.dmg} УРОНА!`, tone: "" };
    case "miss": return { text: "ОШИБКА! ВЫ ОГЛУШЕНЫ!", tone: "text-warning" };
    case "ko": return { text: `ПОБЕДА! ${nameOf(opp)} ПОВЕРЖЕН. ПОЛУЧЕН ОПЫТ!`, tone: "text-gold" };
    case "lose": return { text: "ВЫ ПОВЕРЖЕНЫ... БИТВА ПРОИГРАНА.", tone: "text-danger" };
  }
}

/** Печатающаяся строка сообщения. */
function Typed({ text, nonce, reduce }: { text: string; nonce: number; reduce: boolean | null }) {
  if (reduce) return <>{text}</>;
  return (
    <span key={nonce} aria-label={text}>
      {[...text].map((ch, i) => (
        <m.span key={i} aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02, duration: 0 }}>
          {ch}
        </m.span>
      ))}
    </span>
  );
}

/** Боец: движение по событию, мигание при попадании, дыхание, рассыпание при нокауте. */
function Fighting({
  role, skin, event, dead, winner, stunned, className,
}: {
  role: "you" | "opp"; skin: string; event: BattleEvent | null; dead: boolean; winner: boolean; stunned?: boolean; className: string;
}) {
  const reduce = useReducedMotion();
  const move = useAnimationControls();
  const blink = useAnimationControls();
  useEffect(() => {
    if (!event || reduce) return;
    const k = event.kind;
    const mine = role === "you";
    const attack = (mine && (k === "hit" || k === "crit")) || (!mine && k === "taken");
    const struck = (mine && k === "taken") || (!mine && (k === "hit" || k === "crit"));
    const dir = mine ? 1 : -1;
    if (attack) {
      void move.start({ x: [0, 0, dir * 60, dir * 60, 0], y: [0, 0, -dir * 36, -dir * 36, 0], transition: { duration: 0.8, times: [0, 0.1, 0.4, 0.6, 1], ease: "easeOut" } });
    } else if (struck) {
      void blink.start({ opacity: [1, 0, 1, 0, 1, 0, 1], transition: { duration: 0.7, delay: 0.3, ease: "linear" } });
      void move.start({ x: [0, 0, -dir * 14, 0], transition: { duration: 0.7, times: [0, 0.4, 0.55, 1], ease: "easeOut" } });
    } else if (mine && k === "miss") {
      void move.start({ x: [0, -8, 8, -8, 8, 0], transition: { duration: 0.5 } });
    }
  }, [event, role, reduce, move, blink]);

  return (
    <m.div className={cn("absolute", className)} animate={move}>
      <m.div className="h-full w-full" animate={blink}>
        <m.div
          className="relative h-full w-full"
          animate={reduce || dead ? undefined : winner ? { y: [0, 0, -16, 0] } : { y: [0, 0, -4, -4] }}
          transition={winner ? { duration: 0.8, repeat: Infinity, ease: "easeOut" } : { duration: 1.6, repeat: Infinity, times: [0, 0.5, 0.5, 1], ease: "linear" }}
        >
          {dead ? <Dissolve skin={skin} /> : <SpriteView skin={skin} className="h-full w-full" tint={stunned ? "grayscale(0.7) brightness(0.8)" : undefined} />}
        </m.div>
      </m.div>
    </m.div>
  );
}

function Banner({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div
      className={cn("pointer-events-none absolute inset-x-0 text-center", MONO, className)}
      style={{ textShadow: "3px 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000" }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: [0.4, 1.25, 1] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </m.div>
  );
}

function Damage({ value, big, className }: { value: number; big?: boolean; className: string }) {
  return (
    <m.div
      aria-hidden
      className={cn("pointer-events-none absolute z-20", MONO, big ? "text-5xl text-streak" : "text-3xl text-danger", className)}
      style={{ textShadow: "3px 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000" }}
      initial={{ opacity: 0, y: 0, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 0], y: [0, -14, -34, -56], scale: [0.5, 1.3, 1, 1] }}
      transition={{ duration: 1.1, delay: 0.3, times: [0, 0.2, 0.7, 1], ease: "easeOut" }}
    >
      −{value}
    </m.div>
  );
}

function Screen({ you, opp, combo, event, question, picked, stunned, onAnswer, timeLeftMs }: BattleScreenProps) {
  const reduce = useReducedMotion();
  const [cur, setCur] = useState(0);
  const shake = useAnimationControls();
  useEffect(() => {
    if (!event || reduce) return;
    const k = event.kind;
    if (k === "crit") void shake.start({ x: [0, -10, 10, -8, 8, -5, 5, -2, 0], y: [0, 4, -4, 3, -3, 0, 0, 0, 0], transition: { duration: 0.6, delay: 0.3 } });
    else if (k === "hit" || k === "taken" || k === "ko") void shake.start({ x: [0, -6, 6, -4, 4, -2, 0], transition: { duration: 0.4, delay: 0.3 } });
  }, [event, reduce, shake]);

  const oppDead = opp.hp <= 0;
  const youDead = you.hp <= 0;
  const k = event?.kind;
  const msg = messageOf(event, you, opp);
  const sprite = (id: string) => HEROES.find((h) => h.id === id)?.sprite ?? "warrior";
  const done = oppDead || youDead;

  return (
    <div className="flex flex-col gap-2 bg-bg p-2">
      {/* ------------------------------------------------ арена */}
      <m.div animate={shake} className="relative w-full overflow-hidden rounded-lg border-2 border-black" style={{ aspectRatio: "390 / 342" }}>
        <Background />

        <Fighting role="opp" skin={sprite(opp.skin)} event={event} dead={oppDead} winner={youDead} className="left-[26%] top-[7%] h-[56%] w-[49.2%]" />
        <Fighting role="you" skin={sprite(you.skin)} event={event} dead={youDead} winner={oppDead} stunned={stunned} className="left-[1%] top-[57%] h-[41%] w-[36%]" />

        {/* удар по сопернику / по вам */}
        {event && (k === "hit" || k === "crit" || k === "ko") && (
          <div key={`s${event.nonce}`} className="pointer-events-none absolute left-[25%] top-[14%] h-[44%] w-[50%]">
            <m.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0 }}>
              <Slash big={k === "crit"} />
            </m.div>
          </div>
        )}
        {event && k === "taken" && (
          <div key={`t${event.nonce}`} className="pointer-events-none absolute left-[0%] top-[52%] h-[40%] w-[38%]">
            <m.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0 }}>
              <Slash />
            </m.div>
          </div>
        )}
        {event && (k === "hit" || k === "crit" || k === "ko") && event.dmg > 0 && (
          <Damage key={`d${event.nonce}`} value={event.dmg} big={k === "crit"} className="left-1/2 top-[22%] -translate-x-1/2" />
        )}
        {event && k === "taken" && <Damage key={`d${event.nonce}`} value={event.dmg} className="left-[19%] top-[54%] -translate-x-1/2" />}

        {/* вспышка крита */}
        {event && k === "crit" && (
          <m.div key={`f${event.nonce}`} aria-hidden className="pointer-events-none absolute inset-0 z-30 bg-white" initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 1, 0.1, 0.7, 0] }} transition={{ duration: 0.6, delay: 0.25, ease: "linear" }} />
        )}

        {/* оглушение: звёзды над головой */}
        <AnimatePresence>
          {stunned && !done && (
            <m.div key="stun" className="pointer-events-none absolute left-[2%] top-[50%] h-8 w-24" exit={{ opacity: 0 }}>
              {[0, 1, 2].map((i) => (
                <m.div key={i} className="absolute left-1/2 top-1/2" animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear", delay: -i * 0.4 }} style={{ width: 0, height: 0 }}>
                  <PixelStar className="absolute -left-2 h-4 w-4" />
                </m.div>
              ))}
            </m.div>
          )}
        </AnimatePresence>

        {/* плашки */}
        <Win className="absolute left-2 top-2 w-[128px] !p-2 text-[11px] leading-tight">
          <div className="flex justify-between">
            <span className="truncate">{nameOf(opp)}</span>
            <span>УР {opp.level}</span>
          </div>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[10px] text-gold">HP</span>
            <div className="flex-1"><HpBar hp={opp.hp} /></div>
          </div>
        </Win>
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
          <Win className="!px-2.5 !py-1.5 text-[11px]">ВРЕМЯ {fmtTime(timeLeftMs)}</Win>
          {combo >= 2 && (
            <m.div key={combo} initial={{ scale: 1.4 }} animate={{ scale: 1 }}>
              <Win className="!px-2.5 !py-1.5 text-[11px] text-streak">КОМБО ×{combo}</Win>
            </m.div>
          )}
        </div>
        <Win className="absolute bottom-2 right-2 w-[48%] !p-2 text-[11px] leading-tight">
          <div className="flex justify-between">
            <span className="truncate">{nameOf(you)}</span>
            <span>УР {you.level}</span>
          </div>
          <div className="mt-1 text-sm">
            <span className="text-gold">HP</span> {Math.max(0, Math.round(you.hp))}/100
          </div>
          <div className="mt-1"><HpBar hp={you.hp} /></div>
        </Win>

        {/* баннеры */}
        <AnimatePresence>
          {k === "crit" && !done && (
            <Banner key={`c${event?.nonce}`} className="top-[40%] z-40 text-2xl text-streak">КРИТИЧЕСКИЙ УДАР!</Banner>
          )}
          {stunned && !done && <Banner key="stun" className="top-[40%] z-40 text-2xl text-warning">ВЫ ОГЛУШЕНЫ!</Banner>}
          {oppDead && <Banner key="win" className="top-[36%] z-40 text-5xl text-gold">ПОБЕДА!</Banner>}
          {youDead && !oppDead && <Banner key="lose" className="top-[36%] z-40 text-4xl text-danger">ПОРАЖЕНИЕ</Banner>}
        </AnimatePresence>
      </m.div>

      {/* ------------------------------------------------ сообщение */}
      <Win className="flex min-h-[72px] items-center text-sm leading-6">
        <p className={cn("pr-5", msg.tone)}>
          <Typed text={msg.text} nonce={event?.nonce ?? 0} reduce={reduce} />
        </p>
        <m.span aria-hidden className="absolute bottom-2 right-3 text-xs" animate={reduce ? undefined : { y: [0, 0, 3, 3] }} transition={{ duration: 0.8, repeat: Infinity, times: [0, 0.5, 0.5, 1], ease: "linear" }}>
          ▼
        </m.span>
      </Win>

      {/* ------------------------------------------------ команды */}
      <Win className="!p-3">
        <p className="mb-2 border-b-2 border-dashed border-white/40 pb-2 text-sm leading-5 text-gold">{question.prompt}</p>
        <ul className="flex flex-col">
          {question.options.map((o, i) => {
            const state = picked === null ? "idle" : i === question.correct ? "right" : i === picked ? "wrong" : "idle";
            const locked = stunned || picked !== null || done;
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onAnswer(i)}
                  onMouseEnter={() => setCur(i)}
                  onFocus={() => setCur(i)}
                  className={cn(
                    "group flex h-12 w-full items-center gap-2 rounded px-2 text-left text-lg",
                    state === "right" && "bg-success text-white",
                    state === "wrong" && "bg-danger text-white",
                    state === "idle" && !locked && "hover:bg-white/10 focus-visible:bg-white/10",
                    locked && state === "idle" && "opacity-50",
                  )}
                >
                  <span className="w-5 text-center">
                    {state !== "idle" ? "►" : !locked && cur === i && <Cursor />}
                  </span>
                  <span>{o}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Win>
    </div>
  );
}

/** Мигающий курсор ►. */
function Cursor() {
  const reduce = useReducedMotion();
  return (
    <m.span aria-hidden className="inline-block" animate={reduce ? undefined : { opacity: [1, 1, 0, 0] }} transition={{ duration: 0.9, repeat: Infinity, times: [0, 0.5, 0.5, 1], ease: "linear" }}>
      ►
    </m.span>
  );
}

/** Превью скина: герой в покое на ночном фоне. */
function SkinPreview({ skin, size }: { skin: string; size: number }) {
  const id = HEROES.find((h) => h.id === skin)?.sprite ?? "warrior";
  return (
    <div className="relative overflow-hidden rounded-xl" style={{ width: size, height: size, background: "linear-gradient(#10164f, #3a3a96 70%, #2f7544 70%)" }}>
      <SpriteView skin={id} crop className="absolute inset-1" />
    </div>
  );
}

export const variant: BattleVariant = {
  id: "pixel",
  title: "Пиксельная RPG",
  pitch: "8 бит, ретро-JRPG: спрайты из квадратов, тёмно-синие окна с двойной рамкой, меню команд с курсором ►. Шесть героев с разными силуэтами: у лучника тымак и лук, у батыра шишак и копьё с тугом, у тёмного рыцаря рога и мерцающая аура.",
  skins: HEROES.map(({ id, name, rarity }) => ({ id, name, rarity })),
  Screen,
  SkinPreview,
};
