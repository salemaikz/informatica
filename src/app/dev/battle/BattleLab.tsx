"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { BATTLE_VARIANTS } from "@/components/battle/lab/variants";
import type { BattleEvent, BattleEventKind, DemoQuestion } from "@/components/battle/lab/types";

// Демо-бой для сравнения стилей: состояние боя ведёт страница, вариант только рисует. Числа урона условные —
// настоящая формула в lib/duel/battle.ts. ?v=robots — открыть вариант; ?theme=dark|light — тема.

const QUESTIONS: DemoQuestion[] = [
  { prompt: "Переведите 1011₂ в десятичную систему", options: ["9", "11", "13", "10"], correct: 1 },
  { prompt: "Сколько бит в одном байте?", options: ["4", "8", "16", "10"], correct: 1 },
  { prompt: "Что выведет print(7 // 2)?", options: ["3", "3.5", "4", "1"], correct: 0 },
  { prompt: "Чему равно 1 AND 0?", options: ["1", "0", "2", "10"], correct: 1 },
];

const HP = 100;
const CLOCK_MS = 90_000;
const NEXT_MS = 700;
const STUN_MS = 1_500;
const CRIT_COMBO = 5;

interface Fight {
  youHp: number;
  oppHp: number;
  combo: number;
  event: BattleEvent | null;
  q: number;
  picked: number | null;
  stunned: boolean;
  startedAt: number;
}

const fresh = (): Fight => ({ youHp: HP, oppHp: HP, combo: 0, event: null, q: 0, picked: null, stunned: false, startedAt: Date.now() });

export function BattleLab() {
  const params = useSearchParams();
  const theme = params.get("theme");
  const updateProfile = useApp((s) => s.updateProfile);
  useEffect(() => {
    if (theme === "dark" || theme === "light") updateProfile({ theme });
  }, [theme, updateProfile]);

  const [vid, setVid] = useState(() => BATTLE_VARIANTS.find((v) => v.id === params.get("v"))?.id ?? BATTLE_VARIANTS[0].id);
  const variant = BATTLE_VARIANTS.find((v) => v.id === vid) ?? BATTLE_VARIANTS[0];
  const [youSkin, setYouSkin] = useState(variant.skins[0].id);
  const [oppSkin, setOppSkin] = useState(variant.skins[Math.min(2, variant.skins.length - 1)].id);
  const [fight, setFight] = useState<Fight>(fresh);
  const [now, setNow] = useState(() => Date.now());
  const nonce = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const pickVariant = (id: typeof vid) => {
    const v = BATTLE_VARIANTS.find((x) => x.id === id) ?? BATTLE_VARIANTS[0];
    setVid(v.id);
    setYouSkin(v.skins[0].id);
    setOppSkin(v.skins[Math.min(2, v.skins.length - 1)].id);
    setFight(fresh());
  };

  const ev = (kind: BattleEventKind, dmg: number): BattleEvent => ({ kind, dmg, nonce: ++nonce.current });

  const nextQuestion = () =>
    later(NEXT_MS, () => setFight((f) => (f.youHp <= 0 || f.oppHp <= 0 ? f : { ...f, q: (f.q + 1) % QUESTIONS.length, picked: null })));

  /** Ваш удар: обычный или крит (по комбо или принудительно). */
  const strike = (forceCrit = false) =>
    setFight((f) => {
      if (f.youHp <= 0 || f.oppHp <= 0) return f;
      const combo = forceCrit ? Math.max(f.combo + 1, CRIT_COMBO) : f.combo + 1;
      const crit = combo >= CRIT_COMBO;
      const dmg = crit ? 26 : 12 + (combo % 3);
      const oppHp = Math.max(0, f.oppHp - dmg);
      return { ...f, combo, oppHp, event: ev(oppHp === 0 ? "ko" : crit ? "crit" : "hit", dmg) };
    });

  const miss = () => {
    setFight((f) => (f.youHp <= 0 || f.oppHp <= 0 ? f : { ...f, combo: 0, stunned: true, event: ev("miss", 0) }));
    later(STUN_MS, () => setFight((f) => ({ ...f, stunned: false })));
  };

  const taken = () =>
    setFight((f) => {
      if (f.youHp <= 0 || f.oppHp <= 0) return f;
      const youHp = Math.max(0, f.youHp - 12);
      return { ...f, youHp, event: ev(youHp === 0 ? "lose" : "taken", 12) };
    });

  const onAnswer = (i: number) => {
    const q = QUESTIONS[fight.q];
    if (fight.picked !== null || fight.stunned || fight.youHp <= 0 || fight.oppHp <= 0) return;
    setFight((f) => ({ ...f, picked: i }));
    if (i === q.correct) strike();
    else miss();
    nextQuestion();
  };

  const timeLeftMs = Math.max(0, CLOCK_MS - (now - fight.startedAt));
  const oppName = "Айгерим";

  const controls: [string, () => void][] = [
    ["Удар", () => strike()],
    ["Крит", () => strike(true)],
    ["Удар по мне", taken],
    ["Ошибка", miss],
    ["Нокаут", () => setFight((f) => ({ ...f, oppHp: 0, event: ev("ko", f.oppHp) }))],
    ["Проигрыш", () => setFight((f) => ({ ...f, youHp: 0, event: ev("lose", f.youHp) }))],
    ["Сначала", () => setFight(fresh())],
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold">Битва: варианты стиля</h1>
        <p className="text-muted">Отвечайте на вопрос в экране — или жмите кнопки, чтобы посмотреть удары, крит, нокаут.</p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Варианты">
        {BATTLE_VARIANTS.map((v, k) => (
          <button
            key={v.id}
            type="button"
            data-variant-tab={v.id}
            onClick={() => pickVariant(v.id)}
            className={cn(
              "rounded-xl border-2 px-4 py-2 font-bold",
              v.id === vid ? "border-primary bg-primary-soft text-ink-primary" : "border-border bg-surface",
            )}
          >
            {k + 1}. {v.title}
          </button>
        ))}
      </nav>

      <p className="font-semibold">{variant.pitch}</p>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div data-battle-screen={variant.id} className="mx-auto w-full max-w-[400px] shrink-0 overflow-hidden rounded-[28px] border-2 border-border bg-bg shadow-lg">
          <variant.Screen
            you={{ name: "Вы", level: 7, hp: fight.youHp, skin: youSkin }}
            opp={{ name: oppName, level: 8, hp: fight.oppHp, skin: oppSkin }}
            combo={fight.combo}
            event={fight.event}
            question={QUESTIONS[fight.q]}
            picked={fight.picked}
            stunned={fight.stunned}
            onAnswer={onAnswer}
            timeLeftMs={timeLeftMs}
          />
        </div>

        <aside className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {controls.map(([label, fn]) => (
              <button key={label} type="button" onClick={fn} className="rounded-xl border-2 border-border bg-surface px-3 py-2 text-sm font-bold">
                {label}
              </button>
            ))}
          </div>

          <SkinPicker title="Ваш скин" value={youSkin} onPick={setYouSkin} variant={variant} />
          <SkinPicker title="Скин соперника" value={oppSkin} onPick={setOppSkin} variant={variant} />
        </aside>
      </div>
    </main>
  );
}

function SkinPicker({
  title,
  value,
  onPick,
  variant,
}: {
  title: string;
  value: string;
  onPick: (id: string) => void;
  variant: (typeof BATTLE_VARIANTS)[number];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-extrabold">{title}</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {variant.skins.map((s) => (
          <button
            key={s.id}
            type="button"
            data-skin={s.id}
            onClick={() => onPick(s.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border-2 bg-surface p-2",
              s.id === value ? "border-primary" : "border-border",
            )}
          >
            <variant.SkinPreview skin={s.id} size={72} />
            <span className="text-center text-xs font-bold leading-tight">{s.name}</span>
            <span className={cn("text-[11px] font-semibold", `text-rarity-${s.rarity}`)}>{RARITY[s.rarity]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const RARITY = { common: "обычный", rare: "редкий", epic: "эпический", legendary: "легендарный" } as const;
