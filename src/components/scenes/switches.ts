// Сцена switches: электрическая цепь с ключами и лампой (чистая логика: горит ли лампа, раскладка, цвета проводов).

import type { Scene } from "@/lib/types";
import type { Pt } from "./circuit";

export type SwitchesScene = Extract<Scene, { kind: "switches" }>;
export type SwitchMode = SwitchesScene["mode"];
export type Bit = 0 | 1;

/** Ширина рисунка (viewBox). */
export const SW_W = 320;

/** Число ключей режима (если не задано значениями или именами). */
export const defaultKeyCount = (mode: SwitchMode): number => (mode === "not" ? 1 : 2);

/** Положения ключей: заданные значения, недостающие — 0 (разомкнут / не нажат). */
export function switchValues(scene: SwitchesScene): Bit[] {
  const k = scene.values?.length ?? scene.names?.length ?? defaultKeyCount(scene.mode);
  return Array.from({ length: k }, (_, i) => (scene.values?.[i] === 1 ? 1 : 0));
}

/** Имена ключей: заданные, иначе A, B, C. */
export function switchNames(scene: SwitchesScene, k: number): string[] {
  return Array.from({ length: k }, (_, i) => scene.names?.[i] ?? String.fromCharCode(65 + i));
}

/**
 * Горит ли лампа. and — ключи последовательно (все замкнуты); or — параллельно (хотя бы один);
 * not — кнопка-размыкатель (нажата — цепь разорвана); xor — коридорная схема (положения разные).
 */
export function lampOn(mode: SwitchMode, values: Bit[]): boolean {
  switch (mode) {
    case "and":
      return values.length > 0 && values.every((v) => v === 1);
    case "or":
      return values.some((v) => v === 1);
    case "not":
      return values[0] !== 1;
    case "xor":
      return values[0] !== values[1];
  }
}

export type SwitchKind = "spst" | "button" | "spdt";

export interface SwitchPart {
  kind: SwitchKind;
  name: string;
  value: Bit;
  /** Ось рычажка (spst, spdt) или центр кнопки (button). */
  pivot: Pt;
  /** Контакты: spst — один (правый), button — два (слева и справа), spdt — два (верхний и нижний). */
  contacts: Pt[];
  /** Конец рычажка при текущем положении (spst, spdt); у button — не используется. */
  lever: Pt;
  /** Рычажок лежит на контакте — ток может пройти через этот ключ. */
  closed: boolean;
  /** Центр подписи «имя = значение» (базовая линия). */
  label: Pt;
}

export interface SwitchWire {
  points: Pt[];
  /** По проводу идёт ток (лампа горит и провод на пути тока). */
  live: boolean;
}

export interface SwitchesLayout {
  width: number;
  height: number;
  mode: SwitchMode;
  on: boolean;
  /** Середина (линия лампы и батарейки). */
  mid: number;
  battery: Pt;
  lamp: Pt;
  parts: SwitchPart[];
  wires: SwitchWire[];
  /** Точки-узлы (где параллельные ветки отходят от общего провода). */
  junctions: Pt[];
  /** Положение подписи «лампа: 1/0». */
  lampLabel: Pt;
}

/** Размеры рисунка. */
export const SW_GEO = {
  battery: [34, 0] as Pt,
  /** Центр лампы по x и её радиус. */
  lampX: 284,
  lampR: 15,
  /** Полуширина ключа (ось — контакт), угол поднятого рычажка. */
  half: 24,
  openAngle: 28,
  /** Расстояние между ветками параллельной схемы. */
  branch: 72,
  /** Отступ сверху до первой линии (место под поднятый рычажок). */
  top: 40,
  /** Края обратного провода. */
  retL: 14,
  retR: 308,
  /** Контакты переключателя xor: смещение по вертикали. */
  twoWay: 26,
  /** Сдвиг кнопки вниз при нажатии. */
  press: 12,
} as const;

/** Конец рычажка однополюсного ключа: замкнут — на правом контакте, разомкнут — поднят под углом. */
export function leverEnd(pivot: Pt, closed: boolean): Pt {
  const len = SW_GEO.half * 2;
  if (closed) return [pivot[0] + len, pivot[1]];
  const a = (SW_GEO.openAngle * Math.PI) / 180;
  return [pivot[0] + len * Math.cos(a), pivot[1] - len * Math.sin(a)];
}

export function layoutSwitches(scene: SwitchesScene): SwitchesLayout {
  const G = SW_GEO;
  const values = switchValues(scene);
  const k = values.length;
  const names = switchNames(scene, k);
  const on = lampOn(scene.mode, values);
  const parts: SwitchPart[] = [];
  const wires: SwitchWire[] = [];
  const junctions: Pt[] = [];

  // Концы основной линии: правая клемма батарейки и левая клемма лампы.
  const xb = 38;
  const xl = G.lampX - G.lampR;
  const wire = (points: Pt[], live = on) => wires.push({ points, live });
  let mid: number;
  let labelDy = 30;
  let bottom: number;

  if (scene.mode === "and" || scene.mode === "not") {
    const isNot = scene.mode === "not";
    mid = G.top + (isNot ? 12 : 0);
    labelDy = isNot ? 46 : 30;
    bottom = mid + labelDy + 22;
    let prev = xb;
    const span = xl - xb;
    for (let i = 0; i < k; i++) {
      const cx = xb + (span * (i + 0.5)) / k;
      const left = cx - G.half;
      const right = cx + G.half;
      wire([[prev, mid], [left, mid]]);
      prev = right;
      if (isNot) {
        // Кнопка-размыкатель: пружина прижимает перемычку к контактам, нажатие отводит её вниз.
        const pressed = values[i] === 1;
        parts.push({ kind: "button", name: names[i], value: values[i], pivot: [cx, mid], contacts: [[left, mid], [right, mid]], lever: [cx, mid], closed: !pressed, label: [cx, mid + labelDy] });
      } else {
        const closed = values[i] === 1;
        parts.push({ kind: "spst", name: names[i], value: values[i], pivot: [left, mid], contacts: [[right, mid]], lever: leverEnd([left, mid], closed), closed, label: [cx, mid + labelDy] });
      }
    }
    wire([[prev, mid], [xl, mid]]);
  } else if (scene.mode === "or") {
    mid = G.top + ((k - 1) * G.branch) / 2;
    labelDy = 22;
    bottom = mid + ((k - 1) * G.branch) / 2 + labelDy + 14;
    const xa = 96;
    const xz = 208;
    const cx = (xa + xz) / 2;
    const first = mid - ((k - 1) * G.branch) / 2;
    wire([[xb, mid], [xa, mid]]);
    wire([[xz, mid], [xl, mid]]);
    // Шины слева и справа.
    // Шина режется на отрезки между ветками и узлом: ток идёт лишь там, где за отрезком (дальше от узла) есть замкнутая ветка.
    const ysAll = [...new Set([mid, ...values.map((_, i) => first + i * G.branch)])].sort((p, q) => p - q);
    const closedY = values.map((v, i) => (v === 1 ? first + i * G.branch : null)).filter((y): y is number => y !== null);
    for (let j = 0; j + 1 < ysAll.length; j++) {
      const [y1, y2] = [ysAll[j], ysAll[j + 1]];
      const live = on && (y2 <= mid ? closedY.some((y) => y <= y1) : closedY.some((y) => y >= y2));
      wire([[xa, y1], [xa, y2]], live);
      wire([[xz, y1], [xz, y2]], live);
    }
    junctions.push([xa, mid], [xz, mid]);
    for (let i = 0; i < k; i++) {
      const y = first + i * G.branch;
      const left = cx - G.half;
      const right = cx + G.half;
      const closed = values[i] === 1;
      wire([[xa, y], [left, y]], on && closed);
      wire([[right, y], [xz, y]], on && closed);
      parts.push({ kind: "spst", name: names[i], value: values[i], pivot: [left, y], contacts: [[right, y]], lever: leverEnd([left, y], closed), closed, label: [cx, y + labelDy] });
    }
  } else {
    // Коридорная схема: два переключателя, провода между ними идут крест-накрест.
    mid = G.top + 4;
    labelDy = G.twoWay + 24;
    bottom = mid + labelDy + 22;
    const p1: Pt = [70, mid];
    const p2: Pt = [254, mid];
    const c1x = 110;
    const c2x = 214;
    const up = -G.twoWay;
    const down = G.twoWay;
    const [a, b] = [values[0], values[1]];
    wire([[xb, mid], p1]);
    wire([p2, [xl, mid]]);
    // Провод 1: верхний контакт первого — нижний второго; провод 2: нижний первого — верхний второго.
    wire([[c1x, mid + up], [c2x, mid + down]], on && a === 0);
    wire([[c1x, mid + down], [c2x, mid + up]], on && a === 1);
    parts.push({
      kind: "spdt",
      name: names[0],
      value: a,
      pivot: p1,
      contacts: [[c1x, mid + up], [c1x, mid + down]],
      lever: [c1x, mid + (a === 0 ? up : down)],
      closed: true,
      label: [(p1[0] + c1x) / 2, mid + labelDy],
    });
    // Положение «0» — рычажок вверх, у обоих переключателей; провода скрещены, поэтому лампа горит при разных положениях.
    parts.push({
      kind: "spdt",
      name: names[1],
      value: b,
      pivot: p2,
      contacts: [[c2x, mid + up], [c2x, mid + down]],
      lever: [c2x, mid + (b === 0 ? up : down)],
      closed: true,
      label: [(p2[0] + c2x) / 2, mid + labelDy],
    });
  }

  // Батарейка слева и лампа справа на средней линии; обратный провод — снизу.
  const battery: Pt = [G.battery[0], mid];
  const lamp: Pt = [G.lampX, mid];
  wire([[30, mid], [G.retL, mid], [G.retL, bottom], [G.retR, bottom], [G.retR, mid], [G.lampX + G.lampR, mid]]);
  return {
    width: SW_W,
    height: bottom + 14,
    mode: scene.mode,
    on,
    mid,
    battery,
    lamp,
    parts,
    wires,
    junctions,
    lampLabel: [G.lampX, mid - G.lampR - 12],
  };
}

/** Строка points для SVG-polyline. */
export const pointsOf = (pts: Pt[]): string => pts.map(([x, y]) => `${x},${y}`).join(" ");
