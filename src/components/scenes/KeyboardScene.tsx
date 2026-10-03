"use client";

import { Fragment } from "react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useT } from "@/i18n/useT";
import type { Scene } from "@/lib/types";
import { KB_UNITS, KEY_ROWS, comboText, keyCaption, litKeyIds, type KeyDef } from "./keyboard";

type KeyboardData = Extract<Scene, { kind: "keyboard" }>;

// Размеры в единицах viewBox: клавиша 1 = U, зазор GAP, поля корпуса PAD.
const U = 22;
const GAP = 2.4;
const PAD = 5;
const SMALL_H = 15;
const KEY_H = U - GAP;
const ROW_GAP = GAP;
const VW = KB_UNITS * U + PAD * 2;

/** Верхняя граница каждого ряда и общая высота. */
const ROW_Y: number[] = [];
let acc = PAD;
for (const r of KEY_ROWS) {
  ROW_Y.push(acc);
  acc += (r.small ? SMALL_H : KEY_H) + ROW_GAP + (r.small ? 3 : 0);
}
const VH = acc - ROW_GAP + PAD + 1.5;

const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;
const KEY_FACE = "var(--surface)";
const KEY_FACE_MOD = mix("var(--muted)", 16, "var(--surface)");
const KEY_EDGE = mix("var(--muted)", 40, "var(--surface)");

/** Служебные клавиши (Ctrl, Shift, Enter, F1 …) — темнее букв. */
const isMod = (k: KeyDef) => k.label.length > 1;

/** Рисованные значки: логотип Win (4 квадрата) и стрелки — шрифт-независимо. */
function Glyph({ k, cx, cy, color }: { k: KeyDef; cx: number; cy: number; color: string }) {
  if (k.norm === "win") {
    const s = 3.6;
    const g = 1;
    return (
      <g fill={color}>
        {[0, 1].flatMap((i) => [0, 1].map((j) => <rect key={`${i}${j}`} x={cx - s - g / 2 + i * (s + g)} y={cy - s - g / 2 + j * (s + g)} width={s} height={s} rx={0.6} />))}
      </g>
    );
  }
  // стрелка: треугольник, повёрнутый на нужный угол
  const angle = { "↑": -90, "→": 0, "↓": 90, "←": 180 }[k.norm] ?? 0;
  return <polygon points="5,0 -3.2,-4.6 -3.2,4.6" fill={color} transform={`translate(${cx} ${cy}) rotate(${angle})`} />;
}

/**
 * Упрощённая клавиатура: буквы с мелкими русскими, цифры, F1–F12, управляющие и стрелки.
 * Клавиши из `scene.keys` подсвечены, под клавиатурой — сочетание крупно («Ctrl + C»).
 */
export function KeyboardScene({ scene }: { scene: KeyboardData }) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const lit = litKeyIds(scene.keys);
  const anyLit = lit.size > 0;
  const space = t("basics.kb.space");
  const combo = comboText(scene.keys, space);
  const fade = reduce ? undefined : "fill 200ms ease, opacity 200ms ease";

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={t("basics.kb.aria", { combo })} className="block h-auto w-full">
        <rect x={0} y={0} width={VW} height={VH} rx={10} fill="var(--surface-2)" stroke="var(--border)" strokeWidth={1.5} />
        {KEY_ROWS.map((row, ri) => {
          const h = row.small ? SMALL_H : KEY_H;
          const y = ROW_Y[ri];
          return (
            <g key={ri} aria-hidden="true">
              {row.keys.map((k) => {
                const on = lit.has(k.id);
                const x = PAD + k.x * U;
                const w = k.w * U - GAP;
                const face = on ? "var(--primary)" : isMod(k) ? KEY_FACE_MOD : KEY_FACE;
                const edge = on ? "var(--primary-strong)" : KEY_EDGE;
                const ink = on ? "#fff" : "var(--text)";
                const cx = x + w / 2;
                const cy = y + h / 2;
                const arrow = ["←", "↑", "→", "↓"].includes(k.norm);
                const isSpace = k.norm === "space";
                const label = isSpace ? space : k.label;
                return (
                  <g key={k.id} style={{ opacity: anyLit && !on ? 0.62 : 1, transition: fade }}>
                    <rect x={x} y={y + 1.6} width={w} height={h} rx={3.5} fill={edge} />
                    <rect x={x} y={y} width={w} height={h} rx={3.5} fill={face} stroke={on ? "none" : "var(--border)"} strokeWidth={0.6} style={{ transition: fade }} />
                    {arrow || k.norm === "win" ? (
                      <Glyph k={k} cx={cx} cy={cy} color={on ? "#fff" : "var(--muted)"} />
                    ) : k.sub ? (
                      <>
                        <text x={cx - 1.5} y={cy + 4.2} textAnchor="middle" fontSize={11.5} fontWeight={800} fill={ink}>
                          {label}
                        </text>
                        <text x={x + w - 2.6} y={y + 7.4} textAnchor="end" fontSize={6.4} fontWeight={700} fill={on ? "#fff" : "var(--muted)"}>
                          {k.sub}
                        </text>
                      </>
                    ) : (
                      <text
                        x={cx}
                        y={cy + (row.small ? 2.6 : k.label.length > 1 ? 3 : 4.2)}
                        textAnchor="middle"
                        fontSize={row.small ? 7.4 : k.label.length > 1 ? (k.label.length > 6 ? 7 : 8.6) : 11.5}
                        fontWeight={800}
                        fill={isSpace && !on ? "var(--muted)" : ink}
                      >
                        {label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      <div className="mt-4 text-center" aria-hidden="true">
        <div className="text-xs font-bold text-muted">{t("basics.kb.press")}</div>
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2">
          {scene.keys.map((k, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="text-xl font-extrabold text-muted">+</span>}
              <kbd className="rounded-xl border-2 border-primary bg-primary-soft px-3.5 py-1.5 font-sans text-xl font-extrabold leading-none text-primary shadow-[0_3px_0_var(--primary)]">
                {keyCaption(k, space)}
              </kbd>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
