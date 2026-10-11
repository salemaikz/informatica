"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { m, useAnimationControls } from "motion/react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BattleEvent, BattleScreenProps, BattleVariant } from "../types";
import { ArenaBg } from "./Arena";
import { CritBanner, DamageNumber, Flash, GlitchTag, ImpactFx, KoBanner, ShortCircuit } from "./Fx";
import { ComboBadge, Hud } from "./Hud";
import { POSE, Robot, useRobotCtl, type AnimationControls, type RobotCtl } from "./Robot";
import { SKINS } from "./skins";

// Вариант «Роботы-Биты»: арена 2D-файтинга, вид сбоку. Роботы — из геометрии маскота Бит, в полный рост.

interface FCtl extends RobotCtl {
  root: AnimationControls;
}

function useFCtl(): FCtl {
  const r = useRobotCtl();
  const root = useAnimationControls();
  return useMemo(() => ({ ...r, root }), [r.fU, r.fF, r.bU, r.bF, r.hurt, root]); // eslint-disable-line react-hooks/exhaustive-deps
}

type Mode = "hit" | "crit" | "ko";
type KF = (number | string)[];

/** Запуск ключевых кадров свойства с общим массивом времён. */
function go(c: AnimationControls, props: Record<string, KF>, dur: number, times: number[], ease: "easeOut" | "easeInOut" | "linear" = "easeOut", delay = 0) {
  void c.start({ ...props, transition: { duration: dur, times, ease, delay } });
}

const G = POSE.guard;
const arms = (c: FCtl, a: Pose4, dur: number, times: number[], delay = 0) => {
  go(c.fU, { rotate: a.fU }, dur, times, "easeOut", delay);
  go(c.fF, { rotate: a.fF }, dur, times, "easeOut", delay);
  go(c.bU, { rotate: a.bU }, dur, times, "easeOut", delay);
  go(c.bF, { rotate: a.bF }, dur, times, "easeOut", delay);
};
type Pose4 = { fU: KF; fF: KF; bU: KF; bF: KF };
const seqPose = (names: (keyof typeof POSE)[]): Pose4 => ({
  fU: names.map((n) => POSE[n].fU),
  fF: names.map((n) => POSE[n].fF),
  bU: names.map((n) => POSE[n].bU),
  bF: names.map((n) => POSE[n].bF),
});

/** Мгновенно вернуть бойца в стойку. */
function restNow(c: FCtl) {
  c.root.stop();
  c.root.set({ x: 0, y: 0, rotate: 0, scale: 1, scaleY: 1, opacity: 1, filter: "brightness(1)" });
  for (const [k, v] of [["fU", G.fU], ["fF", G.fF], ["bU", G.bU], ["bF", G.bF]] as const) {
    c[k].stop();
    c[k].set({ rotate: v });
  }
  c.hurt.stop();
  c.hurt.set({ opacity: 0 });
}

/** Удар: атакующий a бьёт защищающегося d. */
function strike(a: FCtl, d: FCtl, mode: Mode) {
  if (mode === "hit") {
    const T = 0.8;
    const t = [0, 0.1, 0.24, 0.5, 1];
    go(a.root, { x: [0, -10, 62, 62, 0], rotate: [0, -2, 3, 3, 0] }, T, t);
    arms(a, seqPose(["guard", "wind", "punch", "punch", "guard"]), T, t);
    const td = [0, 0.26, 0.34, 0.5, 1];
    go(d.root, { x: [0, 0, -20, -20, 0], rotate: [0, 0, -8, -8, 0], filter: ["brightness(1)", "brightness(1)", "brightness(2.8)", "brightness(1)", "brightness(1)"] }, T, td);
    arms(d, seqPose(["guard", "guard", "hurt", "hurt", "guard"]), T, td);
    go(d.hurt, { opacity: [0, 0, 1, 1, 0] }, T, td, "linear");
  } else if (mode === "crit") {
    const T = 1.2;
    const t = [0, 0.16, 0.34, 0.6, 1];
    go(a.root, { x: [0, -16, 58, 58, 0], y: [0, 12, -50, -50, 0], scaleY: [1, 0.9, 1.06, 1, 1], rotate: [0, -4, 7, 4, 0] }, T, t);
    arms(a, seqPose(["guard", "wind", "upper", "upper", "guard"]), T, t);
    const td = [0, 0.36, 0.48, 0.72, 1];
    go(d.root, { x: [0, 0, -26, -26, 0], y: [0, 0, -70, -10, 0], rotate: [0, 0, -20, -12, 0], filter: ["brightness(1)", "brightness(1)", "brightness(3)", "brightness(1)", "brightness(1)"] }, T, td);
    arms(d, seqPose(["guard", "guard", "hurt", "hurt", "guard"]), T, td);
    go(d.hurt, { opacity: [0, 0, 1, 1, 0] }, T, td, "linear");
  } else {
    const T = 1.7;
    const t = [0, 0.1, 0.22, 0.42, 0.7, 1];
    go(a.root, { x: [0, -10, 62, 62, 8, 8], y: [0, 0, 0, 0, -36, 0], rotate: [0, -2, 3, 3, 0, 0] }, T, t);
    arms(a, seqPose(["guard", "wind", "punch", "punch", "win", "win"]), T, t);
    const td = [0, 0.2, 0.3, 0.55, 0.85, 1];
    go(d.root, { x: [0, 0, -20, 12, 52, 52], y: [0, 0, -30, 6, 10, 10], scaleY: [1, 1, 1, 0.94, 0.9, 0.9], rotate: [0, 0, -12, -20, -24, -24], filter: ["brightness(1)", "brightness(1)", "brightness(3)", "brightness(1)", "brightness(1)", "brightness(1)"] }, T, td);
    arms(d, seqPose(["guard", "guard", "hurt", "limp", "limp", "limp"]), T, td);
    go(d.hurt, { opacity: [0, 0, 1, 0, 0, 0] }, T, td, "linear");
  }
}

/** Ошибка: короткое замыкание, 1,5 с. */
function glitch(c: FCtl) {
  const T = 1.5;
  go(c.root, { x: [0, -6, 6, -5, 5, -4, 4, -3, 0, 0], y: [0, 3, 3, 3, 3, 3, 3, 3, 0, 0], opacity: [1, 0.55, 1, 0.7, 1, 0.75, 1, 1, 1, 1] }, T, [0, 0.06, 0.12, 0.2, 0.28, 0.4, 0.5, 0.6, 0.72, 1], "linear");
  const t = [0, 0.12, 0.88, 1];
  go(c.fU, { rotate: [G.fU, POSE.stun.fU, POSE.stun.fU, G.fU] }, T, t);
  go(c.fF, { rotate: [G.fF, POSE.stun.fF, POSE.stun.fF, G.fF] }, T, t);
  go(c.bU, { rotate: [G.bU, POSE.stun.bU, POSE.stun.bU, G.bU] }, T, t);
  go(c.bF, { rotate: [G.bF, POSE.stun.bF, POSE.stun.bF, G.bF] }, T, t);
}

function Fighter({
  side,
  skin,
  ctl,
  dead,
  stunned,
  hit,
  z,
}: {
  side: "you" | "opp";
  skin: string;
  ctl: FCtl;
  dead: boolean;
  stunned: boolean;
  hit: { nonce: number; crit: boolean; delay: number } | null;
  z: number;
}) {
  return (
    <div className="absolute bottom-[18px] h-[251px] w-[176px]" style={{ [side === "you" ? "left" : "right"]: -2, zIndex: z }}>
      <div className={cn("size-full", side === "opp" && "-scale-x-100")}>
        <m.div className="relative size-full" initial={{ x: 0, y: 0, rotate: 0, scale: 1 }} animate={ctl.root} style={{ transformOrigin: "50% 94%" }}>
          <Robot skin={skin} ctl={ctl} dead={dead} stunned={stunned} />
          {hit && <ImpactFx key={hit.nonce} crit={hit.crit} delay={hit.delay} />}
          {stunned && <ShortCircuit />}
        </m.div>
      </div>
    </div>
  );
}

const DELAY = { hit: 0.3, crit: 0.5, ko: 0.32 } as const;

function Screen({ you, opp, combo, event, question, picked, stunned, onAnswer, timeLeftMs }: BattleScreenProps) {
  const yc = useFCtl();
  const oc = useFCtl();
  const shake = useAnimationControls();
  const koRef = useRef(false);

  const nonce = event?.nonce ?? 0;
  const kind = event?.kind;

  // Сценарий анимации по событию.
  useEffect(() => {
    if (!kind) {
      koRef.current = false;
      restNow(yc);
      restNow(oc);
      return;
    }
    const over = kind === "ko" || kind === "lose";
    koRef.current = over;
    restNow(yc);
    restNow(oc);
    shake.stop();
    const quake = (amp: number, delay: number) => go(shake, { x: [0, -amp, amp, -amp * 0.7, amp * 0.5, 0], y: [0, amp * 0.4, -amp * 0.4, amp * 0.3, 0, 0] }, 0.45, [0, 0.15, 0.35, 0.6, 0.8, 1], "linear", delay);
    if (kind === "hit") strike(yc, oc, "hit");
    else if (kind === "crit") {
      strike(yc, oc, "crit");
      quake(10, 0.5);
    } else if (kind === "ko") {
      strike(yc, oc, "ko");
      quake(8, 0.32);
    } else if (kind === "taken") {
      strike(oc, yc, "hit");
      quake(4, 0.3);
    } else if (kind === "lose") {
      strike(oc, yc, "ko");
      quake(8, 0.32);
    } else if (kind === "miss") glitch(yc);
  }, [nonce, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // «× _ ×» у побеждённого появляется чуть позже удара.
  const [lateDead, setLateDead] = useState(0);
  const over = event?.kind === "ko" || event?.kind === "lose";
  useEffect(() => {
    if (!over) return;
    const id = window.setTimeout(() => setLateDead(nonce), 520);
    return () => window.clearTimeout(id);
  }, [over, nonce]);
  const dead = over && lateDead === nonce;

  const hits = hitInfo(event);
  const youHit = hits && (event?.kind === "taken" || event?.kind === "lose") ? hits : null;
  const oppHit = hits && (event?.kind === "hit" || event?.kind === "crit" || event?.kind === "ko") ? hits : null;
  const attackerIsYou = kind === "hit" || kind === "crit" || kind === "ko" || kind === "miss";

  const finished = you.hp <= 0 || opp.hp <= 0;
  const locked = stunned || picked !== null || finished;

  return (
    <div className="flex flex-col bg-bg">
      <div className="relative h-[380px] overflow-hidden bg-[#060a1f]">
        <m.div className="absolute inset-0" animate={shake}>
          <ArenaBg />
          <Fighter side="you" skin={you.skin} ctl={yc} dead={you.hp <= 0 ? dead : false} stunned={stunned} hit={youHit} z={attackerIsYou ? 12 : 10} />
          <Fighter side="opp" skin={opp.skin} ctl={oc} dead={opp.hp <= 0 ? dead : false} stunned={false} hit={oppHit} z={attackerIsYou ? 10 : 12} />
        </m.div>

        <Hud you={you} opp={opp} timeLeftMs={timeLeftMs} />
        <ComboBadge combo={combo} />

        {event && (
          <div key={event.nonce} className="pointer-events-none absolute inset-0 overflow-hidden">
            {(event.kind === "hit" || event.kind === "crit" || event.kind === "ko") && (
              <DamageNumber dmg={event.dmg} crit={event.kind === "crit"} x={304} delay={DELAY[event.kind === "ko" ? "ko" : event.kind]} />
            )}
            {(event.kind === "taken" || event.kind === "lose") && <DamageNumber dmg={event.dmg} crit={false} x={86} delay={DELAY[event.kind === "lose" ? "ko" : "hit"]} />}
            {event.kind === "crit" && (
              <>
                <CritBanner delay={0.3} />
                <Flash delay={0.5} peak={0.5} />
              </>
            )}
            {event.kind === "ko" && (
              <>
                <KoBanner win delay={0.5} />
                <Flash delay={0.32} peak={0.55} />
              </>
            )}
            {event.kind === "lose" && (
              <>
                <KoBanner win={false} delay={0.5} />
                <Flash delay={0.32} peak={0.45} />
              </>
            )}
            {event.kind === "miss" && <GlitchTag x={86} />}
          </div>
        )}
      </div>

      {/* Панель вопроса — на токенах, как остальной интерфейс. */}
      <div className="flex flex-col gap-2.5 border-t-2 border-border bg-surface px-3 pb-4 pt-3">
        <div className="flex min-h-5 items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Вопрос</span>
          {stunned ? (
            <span className="flex items-center gap-1 text-xs font-extrabold text-ink-warning">
              <Zap className="size-3.5 fill-current" aria-hidden />
              Замыкание — ответы отключены
            </span>
          ) : (
            <span className="text-xs font-bold text-muted">Верный ответ — удар</span>
          )}
        </div>
        <p className="min-h-[40px] text-[16px] font-extrabold leading-snug text-text">{question.prompt}</p>
        <div className={cn("grid grid-cols-2 gap-2.5", stunned && "opacity-50")}>
          {question.options.map((o, i) => {
            const isRight = picked !== null && i === question.correct;
            const isWrong = picked === i && i !== question.correct;
            return (
              <button
                key={i}
                type="button"
                disabled={locked}
                onClick={() => onAnswer(i)}
                className={cn(
                  "flex min-h-[52px] items-center gap-2.5 rounded-2xl border-2 border-b-4 px-3 py-2 text-left text-[16px] font-extrabold transition-colors active:translate-y-px",
                  isRight
                    ? "border-success bg-success-soft text-ink-success"
                    : isWrong
                      ? "border-danger bg-danger-soft text-ink-danger"
                      : "border-border bg-surface-2 text-text enabled:hover:border-primary",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg text-[13px] font-black",
                    isRight ? "bg-success text-white" : isWrong ? "bg-danger text-white" : "bg-primary-soft text-ink-primary",
                  )}
                >
                  {"ABCD"[i]}
                </span>
                <span className="min-w-0 truncate">{o}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function hitInfo(e: BattleEvent | null) {
  if (!e) return null;
  if (e.kind === "crit") return { nonce: e.nonce, crit: true, delay: 0.5 };
  if (e.kind === "hit" || e.kind === "taken") return { nonce: e.nonce, crit: false, delay: 0.3 };
  if (e.kind === "ko" || e.kind === "lose") return { nonce: e.nonce, crit: false, delay: 0.32 };
  return null;
}

/** Персонаж в покое — для витрины скинов. */
function SkinPreview({ skin, size }: { skin: string; size: number }) {
  const legendary = skin === "gold";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-gradient-to-b from-[#1d2670] to-[#090d2b]",
        legendary && "from-[#4a3205] to-[#120b02] ring-2 ring-[#ffd34d]/70",
      )}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-x-0 bottom-[4%] top-[2%] flex justify-center">
        <Robot skin={skin} />
      </div>
    </div>
  );
}

export const variant: BattleVariant = {
  id: "robots",
  title: "Роботы-Биты",
  pitch:
    "2D-файтинг: два робота-Бита в полный рост бьются на арене-серверной. Крупные полоски здоровья, таймер, комбо, «КРИТ!» и «K.O.» — ощущение мобильного файтинга. Скины — разные силуэты: капюшон, повязка, купол, шлем-шишак, крылья.",
  skins: SKINS,
  Screen,
  SkinPreview,
};
