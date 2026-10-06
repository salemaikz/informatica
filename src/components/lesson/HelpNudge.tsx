"use client";

import { Lightbulb, Sparkles } from "lucide-react";
import { m } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { canOfferHelp, helpDue, startHelpClock, tickHelpClock } from "@/lib/help-timer";
import { playSound } from "@/lib/sound";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { AiCost } from "@/components/economy/AiCost";
import { useGuideUi } from "@/components/guide/guide-state";
import { Mascot } from "@/components/mascot/Mascot";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { Button } from "@/components/ui/Button";

// «Нужна помощь?» по времени чтения (этап 16В, P8; ТЗ — docs/specs/stage16c.md, §11): Бит выезжает из-за нижней панели урока
// и садится на её верхнюю кромку у кнопки «Проверить», когда ученик долго думает над заданием или читает: Бит виден целиком,
// над ним пузырь с текстом и кнопками (на 360 px ничего не срезано панелью). Не модально, без затемнения; кнопки ведут
// в уже существующие пути помощи плеера (подсказка, «Спросить Бита») — новых вызовов ИИ нет. Формулы и правила — lib/help-timer.ts.

/** Как часто проверяем часы шага, мс. */
const TICK_MS = 1_000;
/** Запас внизу страницы, пока плашка на экране: её не должно быть нечем «закрыть», последнее задание остаётся доступным, px. */
export const HELP_NUDGE_PAD = 192;

/** Открыта шторка или окно поверх урока (выход, «нет сердечек», шторка Бита, калькулятор, черновик). */
const modalOpen = (): boolean => !!document.querySelector('[role="dialog"][aria-modal="true"]');

export type HelpKind = "hint" | "simpler";

interface Offer {
  offerKey: string;
  kind: HelpKind;
}

/**
 * Часы шага и решение «показать ли плашку». Время идёт, пока вкладка видна и нет паузы (шторка, окно, сцена проводника);
 * `stepKey` сменился — счёт заново. Один раз на шаг (`offerKey`), не больше трёх раз за жизнь компонента (урок или тренировка),
 * и не на шаге, где ученик уже взял помощь (`markHelped`). Плашка уезжает, когда ученик что-то сделал на шаге (`touch` изменился)
 * или нажал «Нет, спасибо». Состояние меняется только из таймера, обработчиков и при смене `touch` (во время рендера — как рекомендует React).
 */
export function useHelpNudge(opts: {
  /** Шаг на экране, ждёт ответа/чтения, плашка в этом режиме разрешена. */
  enabled: boolean;
  kind: HelpKind | null;
  /** Ключ счёта: сменился — часы заново (шаг; у разбора — ещё и подшаг). */
  stepKey: string;
  /** Ключ шага для правила «один раз на шаг» (повтор того же задания после ошибки — тот же шаг). */
  offerKey: string;
  afterMs: number;
  /** Меняется, когда ученик взаимодействует с шагом (ответ, открытый подшаг, достигнутая цель): плашка тогда убирается. */
  touch: unknown;
  /** Нужна ли пауза из-за состояния самого плеера (открыты окна выхода, «нет сердечек», шторка ИИ). */
  paused: boolean;
}): { kind: HelpKind | null; dismiss: () => void; markHelped: () => void } {
  const { enabled, kind, stepKey, offerKey, afterMs, touch, paused } = opts;
  const [offer, setOffer] = useState<Offer | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [seenTouch, setSeenTouch] = useState(touch);
  const offered = useRef<string[]>([]);
  const helped = useRef<string[]>([]);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  });

  useEffect(() => {
    if (!enabled || kind === null) return;
    let clock = startHelpClock(Date.now());
    const id = window.setInterval(() => {
      const running = document.visibilityState === "visible" && !pausedRef.current && !useGuideUi.getState().active && !modalOpen();
      clock = tickHelpClock(clock, Date.now(), running);
      if (!helpDue(clock, afterMs)) return;
      window.clearInterval(id);
      if (!canOfferHelp(offered.current, offerKey, helped.current.includes(offerKey))) return;
      offered.current = [...offered.current, offerKey];
      setOffer({ offerKey, kind });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled, kind, stepKey, offerKey, afterMs]);

  // Ученик что-то сделал на шаге (выбрал ответ, открыл подшаг): плашка уезжает и на этом шаге больше не вернётся.
  if (!Object.is(seenTouch, touch)) {
    setSeenTouch(touch);
    if (offer?.offerKey === offerKey) setDismissed(offerKey);
  }

  const visible = enabled && !!offer && offer.offerKey === offerKey && dismissed !== offerKey;
  const dismiss = useCallback(() => setDismissed(offerKey), [offerKey]);
  // Ученик сам взял помощь на этом шаге (подсказка, «Спросить Бита»): плашка не нужна и больше не появится.
  const markHelped = useCallback(() => {
    helped.current = [...helped.current, offerKey];
    setDismissed(offerKey);
  }, [offerKey]);
  return { kind: visible ? offer.kind : null, dismiss, markHelped };
}

/** Невидимое расширение зоны касания малой кнопки (36 → 44 px). */
const HIT_AREA = "after:absolute after:-inset-1";

/** Пружина выглядывания Бита. */
const PEEK_SPRING = { type: "spring", stiffness: 340, damping: 20, mass: 0.8 } as const;

/**
 * Бит выезжает из-за нижней панели урока и предлагает помощь. Ставится первым ребёнком нижней панели (`fixed`):
 * в начале выезда он ещё под фоном панели (она рисуется позже и закрывает его), в конце стоит на её верхней кромке целиком —
 * без отрицательного нижнего отступа, чтобы панель не срезала голову. Кнопка помощи — цвета `ai`, «Нет, спасибо» — тихая.
 * «Меньше анимаций»: без прыжка, только проявление; звук — один «буп» при появлении.
 */
export function HelpNudge({
  kind,
  freeHint,
  onHint,
  onAsk,
  onNo,
}: {
  kind: HelpKind;
  /** Подсказка автора есть — «Подсказка» бесплатна, цену не показываем (как на кнопке в задании). */
  freeHint: boolean;
  onHint: () => void;
  onAsk: () => void;
  onNo: () => void;
}) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const sound = useApp((s) => s.profile.sound);

  useEffect(() => {
    if (sound) playSound("bitPop");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- звук только при появлении
  }, []);

  const hint = kind === "hint";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full">
      <div className="mx-auto flex w-full max-w-2xl justify-end px-4">
        <div className="relative flex w-full max-w-[344px] flex-col items-end">
          <m.div
            role="group"
            aria-label={t("help16c.aria")}
            className="pointer-events-auto relative mb-1.5 w-full rounded-2xl border-2 border-border bg-surface px-3.5 pb-3 pt-2.5 shadow-[0_12px_32px_rgb(0_0_0/0.22)]"
            style={{ transformOrigin: "90% 100%" }}
            initial={{ opacity: 0, scale: reduce ? 1 : 0.85, y: reduce ? 0 : 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduce ? 1 : 0.92, transition: { duration: 0.15 } }}
            // Без задержки: пузырь появляется вместе с Битом (с задержкой кадр с «замороженными» часами показывал Бита без текста).
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
          >
            <span aria-hidden className="absolute -bottom-[9px] right-7 h-4 w-4 rotate-45 border-b-2 border-r-2 border-border bg-surface" />
            <p role="status" className="relative text-[15px] font-semibold leading-snug">
              {t(hint ? "help16c.hintText" : "help16c.simplerText")}
            </p>
            <div className="relative mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <Button
                variant="ai"
                size="sm"
                icon={hint ? <Lightbulb size={16} aria-hidden /> : <Sparkles size={16} aria-hidden />}
                onClick={hint ? onHint : onAsk}
                // sm = 36 px: зону касания расширяем до 44 (правила RULES 2.10).
                className={cn("relative max-w-full", HIT_AREA)}
              >
                {t(hint ? "help16c.hint" : "help16c.ask")}
                {/* Подсказка автора бесплатна; цена — только если ответит ИИ (как на кнопке «Подсказка» в задании). */}
                {!(hint && freeHint) && <AiCost kind={hint ? "hint" : "ask"} variant="solid" short />}
              </Button>
              <Button variant="ghost" size="sm" onClick={onNo} className={cn("relative", HIT_AREA)}>
                {t("help16c.no")}
              </Button>
            </div>
          </m.div>
          {/* Бит: выезжает из-за панели и садится на её кромку целиком (data-help-bit — метка для теста вёрстки). */}
          <m.div
            aria-hidden
            data-help-bit=""
            className="mr-2 h-14 w-14 shrink-0"
            initial={{ y: reduce ? 0 : 64, opacity: reduce ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduce ? 0 : 64, opacity: reduce ? 0 : 1, transition: { duration: 0.22, ease: "easeIn" } }}
            transition={reduce ? { duration: 0.15 } : PEEK_SPRING}
          >
            <Mascot mood={hint ? "thinking" : "happy"} size={56} className="drop-shadow-[0_4px_8px_rgb(0_0_0/0.25)]" />
          </m.div>
        </div>
      </div>
    </div>
  );
}
