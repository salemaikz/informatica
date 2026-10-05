"use client";

import { Pointer } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BIT_SIZE, type BitPlacement, type GuideAction } from "@/lib/guide";
import { playSound } from "@/lib/sound";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { Mascot, type Mood } from "@/components/mascot/Mascot";
import { Button } from "@/components/ui/Button";

/** Печать: ~40 знаков в секунду; после точки и запятой — короткие паузы, как в речи. */
const CHAR_MS = 25;
const PAUSE_MS: Record<string, number> = { ".": 220, "!": 220, "?": 220, ":": 140, ",": 100, "—": 100 };
/** Слог «голоска» — на каждые 2–3 буквы, не чаще раза в 70 мс. */
const SYLLABLE_MS = 70;
const LETTER = /\p{L}|\p{N}/u;

/** Покачивание головой «нет». */
const SHAKE = [0, -14, 12, -8, 5, 0];

/** Пружина выезда Бита: из-за нижнего края с лёгким «прыжком» и наклоном. */
const BIT_SPRING = { type: "spring", stiffness: 320, damping: 15, mass: 0.9 } as const;

/**
 * Печатает реплику и «говорит» её: возвращает, сколько знаков уже видно, и как допечатать сразу.
 * Темп — по часам (расписание каждой буквы), а не по числу тиков: медленная отрисовка не замедляет речь.
 * Состояние меняется только из таймера и обработчика касания.
 */
function useTyping(text: string, key: string, instant: boolean, sound: boolean, delayMs: number) {
  const [typed, setTyped] = useState<{ key: string; n: number }>({ key, n: 0 });
  /** Реплика, которую допечатали касанием: таймер её больше не трогает. */
  const finished = useRef<string | null>(null);
  const n = instant ? text.length : typed.key === key ? typed.n : 0;

  useEffect(() => {
    if (instant || !text) return;
    // Когда появляется каждая буква (мс от начала): ровный темп и паузы после знаков препинания.
    const at: number[] = [];
    let acc = delayMs;
    for (const ch of text) {
      acc += CHAR_MS;
      at.push(acc);
      acc += PAUSE_MS[ch] ?? 0;
    }
    const start = Date.now();
    let shown = 0;
    let since = 0;
    let lastTalk = -Infinity;
    let every = 2;
    let timer = 0;
    const tick = () => {
      if (finished.current === key) return;
      const elapsed = Date.now() - start;
      let next = shown;
      while (next < at.length && at[next] <= elapsed) {
        // Пробел и знаки — пауза в «голосе»: следующий слог — через пару букв.
        since = LETTER.test(text[next]) ? since + 1 : 0;
        next++;
      }
      if (next !== shown) {
        shown = next;
        setTyped({ key, n: shown });
        const now = Date.now();
        if (sound && since >= every && now - lastTalk >= SYLLABLE_MS) {
          playSound("bitTalk");
          lastTalk = now;
          since = 0;
          every = 2 + Math.round(Math.random());
        }
      }
      if (shown < at.length) timer = window.setTimeout(tick, 20);
    };
    timer = window.setTimeout(tick, delayMs);
    return () => window.clearTimeout(timer);
  }, [text, key, instant, sound, delayMs]);

  const finish = () => {
    finished.current = key;
    setTyped({ key, n: text.length });
  };
  return { n: Math.min(n, text.length), done: n >= text.length, finish };
}

export interface BitPopupProps {
  place: BitPlacement;
  mood: Mood;
  /** Ключ реплики (сцена + шаг): новая реплика — печать заново. */
  stepKey: string;
  /** Реплика; null — Бит молчит (ждёт цель), пузыря нет. */
  text: string | null;
  action: GuideAction;
  /** Последний шаг: «Понятно» вместо «Дальше». */
  last: boolean;
  /** Шаг с затемнением: пузырь — модальный диалог. */
  modal: boolean;
  reduce: boolean;
  sound: boolean;
  /** Счётчик «нажали на затемнение»: Бит качает головой. */
  shake: number;
  onNext: () => void;
  onSkip: () => void;
}

/**
 * Бит-проводник: выезжает снизу из угла (дом плавающей кнопки Бита), рядом — пузырь с печатающейся репликой и «голоском».
 * Между шагами Бит остаётся на месте — меняются реплика и настроение; в конце уезжает вниз (exit в AnimatePresence).
 * «Меньше анимаций»: без прыжков (только проявление), текст сразу целиком, звук — один «буп» при появлении.
 */
export function BitPopup({ place, mood, stepKey, text, action, last, modal, reduce, sound, shake, onNext, onSkip }: BitPopupProps) {
  const { t } = useT();
  // Реплика, с которой Бит появился: она ждёт, пока Бит допрыгнет; следующие — сразу.
  const [firstKey] = useState(stepKey);

  // Появление — «буп» (один раз за выход Бита).
  useEffect(() => {
    if (sound) playSound("bitPop");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- звук только при появлении
  }, []);

  // Нажали на затемнение: Бит качает головой и коротко «бурчит».
  useEffect(() => {
    if (!shake) return;
    if (sound) {
      playSound("bitTalk", { pitch: 360 });
      window.setTimeout(() => playSound("bitTalk", { pitch: 300 }), 110);
    }
  }, [shake, sound]);

  const delay = stepKey === firstKey ? 380 : 120;
  const typing = useTyping(text ?? "", stepKey, reduce, sound, delay);

  const right = place.corner === "br";
  const bitCx = place.bitX + BIT_SIZE / 2;
  // Хвостик пузыря смотрит на Бита: над Битом — снизу, сбоку — с его стороны.
  const tail =
    place.bubble === "above"
      ? { left: Math.max(18, Math.min(bitCx - place.bubbleX - 8, place.bubbleW - 34)), bottom: -9, cls: "border-b-2 border-r-2" }
      : right
        ? { right: -9, bottom: 22, cls: "border-r-2 border-t-2" }
        : { left: -9, bottom: 22, cls: "border-b-2 border-l-2" };

  return (
    <>
      <m.div
        className="pointer-events-auto absolute bottom-0 left-0"
        style={{ width: BIT_SIZE, height: BIT_SIZE }}
        initial={{ x: place.bitX, y: BIT_SIZE + 40, rotate: right ? -16 : 16, opacity: 0 }}
        animate={{ x: place.bitX, y: -place.bitBottom, rotate: 0, opacity: 1 }}
        exit={{ y: BIT_SIZE + 40, rotate: right ? 12 : -12, opacity: reduce ? 0 : 1, transition: { duration: 0.28, ease: "easeIn" } }}
        transition={{ ...BIT_SPRING, opacity: { duration: 0.15 } }}
        onClick={typing.finish}
      >
        {/* «Нет-нет»: каждое нажатие на затемнение — новое покачивание головой (чётное/нечётное — в разные стороны). */}
        <m.div
          className="h-full w-full"
          style={{ transformOrigin: "50% 90%" }}
          initial={false}
          animate={{ rotate: shake && !reduce ? (shake % 2 ? SHAKE : SHAKE.map((v) => -v)) : 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          {/* Каждая новая реплика — маленький «прыжок». */}
          <m.div
            key={stepKey}
            className="h-full w-full"
            initial={{ y: 0 }}
            animate={reduce ? { y: 0 } : { y: [0, -10, 0, -3, 0] }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <Mascot mood={mood} size={BIT_SIZE} className="drop-shadow-[0_6px_10px_rgb(0_0_0/0.25)]" />
          </m.div>
        </m.div>
      </m.div>

      <AnimatePresence mode="wait">
        {text !== null && (
          <m.div
            key={stepKey}
            data-guide=""
            role={modal ? "dialog" : "status"}
            aria-modal={modal ? true : undefined}
            aria-live={modal ? undefined : "polite"}
            aria-label={t("guide.aria")}
            className="pointer-events-auto absolute rounded-2xl border-2 border-border bg-surface px-4 pb-2.5 pt-3 shadow-[0_12px_32px_rgb(0_0_0/0.22)]"
            style={{
              left: place.bubbleX,
              bottom: place.bubbleBottom,
              width: place.bubbleW,
              transformOrigin: place.bubble === "above" ? `${right ? "85%" : "15%"} 100%` : `${right ? "100%" : "0%"} 85%`,
            }}
            initial={{ opacity: 0, scale: reduce ? 1 : 0.8, y: reduce ? 0 : 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduce ? 1 : 0.9, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 420, damping: 26, delay: delay / 1000 - 0.1 }}
            onClick={typing.finish}
          >
            <span aria-hidden className={cn("absolute h-4 w-4 rotate-45 border-border bg-surface", tail.cls)} style={{ left: tail.left, right: tail.right, bottom: tail.bottom }} />
            {/* Печать: невидимый «хвост» текста уже занимает место — строки не прыгают, пузырь не растёт. */}
            <p aria-hidden className="relative text-[15px] font-semibold leading-snug">
              <span>{text.slice(0, typing.n)}</span>
              <span className="text-transparent">{text.slice(typing.n)}</span>
            </p>
            <span className="sr-only">{text}</span>
            <div className="relative mt-2 flex items-center gap-2">
              {action === "tap" ? (
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-extrabold text-primary">
                  <Pointer size={14} aria-hidden className="shrink-0" /> {t("guide.tapHint")}
                </span>
              ) : (
                <span className="flex-1" />
              )}
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("guide.skipAria")}
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip();
                }}
              >
                {t("guide.skip")}
              </Button>
              {/* Фокус — на «Дальше», когда реплика появилась (у шага «нажми» фокус ставит GuideHost — на цель). */}
              {action === "next" && (
                <Button
                  size="md"
                  autoFocus
                  className="min-w-24"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNext();
                  }}
                >
                  {last ? t("guide.ok") : t("guide.next")}
                </Button>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
