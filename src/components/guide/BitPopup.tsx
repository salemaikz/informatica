"use client";

import { Pointer } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BIT_SIZE, BUBBLE_TEXT, TAIL_TIP, dockTail, keepDash, sideTail, tailLeft, type BitPlacement, type GuideAction } from "@/lib/guide";
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

/** Вытянутый хвостик пузыря из кнопки Бита: ширина у пузыря (как у квадратика-хвостика на его краю), px. */
const SPIKE_W = 20;

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
  /**
   * Шаг с затемнением и «Дальше»: пузырь — модальный диалог, фокус — на самом пузыре (Enter — «Дальше»; кольцо на кнопке
   * только после Tab, чтобы не спорить с рамкой цели). Шаг «нажми» — не модальный (фокус на цели).
   */
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
 * Шаг про плавающую кнопку Бита (`place.dock`): говорящий Бит уходит вниз, пузырь выходит из самой кнопки.
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
  const shown = text === null ? "" : keepDash(text);
  const typing = useTyping(shown, stepKey, reduce, sound, delay);

  // Модальный пузырь берёт фокус сам, когда появляется (читалка читает реплику, Enter — «Дальше»). Ref-функция, а не
  // эффект: новый пузырь появляется только после ухода старого (AnimatePresence mode="wait").
  const focusDialog = useCallback(
    (el: HTMLDivElement | null) => {
      if (el && modal) el.focus({ preventScroll: true });
    },
    [modal],
  );

  const right = place.corner === "br";
  // Хвостик пузыря смотрит на Бита (или на его кнопку): над Битом — снизу, сбоку — с его стороны (пузырь поднят над
  // нижней панелью — хвостик у самого низа пузыря, ближе к Биту).
  const tail =
    place.bubble === "above"
      ? { left: tailLeft(place), bottom: -9, cls: "border-b-2 border-r-2" }
      : right
        ? { right: -9, bottom: sideTail(place), cls: "border-r-2 border-t-2" }
        : { left: -9, bottom: sideTail(place), cls: "border-b-2 border-l-2" };
  // Пузырь из кнопки Бита поднят (его края не режут кнопки страницы): хвостик вытянут до кнопки — пузырь не «висит».
  const reach = place.dock ? dockTail(place) : 0;
  const spike =
    reach > TAIL_TIP
      ? {
          left: tailLeft(place) + 8 - SPIKE_W / 2,
          // Кончик — напротив центра кнопки (у края пузыря квадратик-хвостик мог упереться в поле).
          tipX: SPIKE_W / 2 + (place.bitX + BIT_SIZE / 2 - place.bubbleX - tailLeft(place) - 8),
          // От внутреннего края рамки пузыря (2 px) до кончика.
          h: reach + 2,
        }
      : null;

  return (
    <>
      <AnimatePresence>
        {!place.dock && (
          <m.div
            key="bit"
            data-guide-bit=""
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
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {text !== null && (
          <m.div
            key={stepKey}
            ref={focusDialog}
            data-guide=""
            role={modal ? "dialog" : "status"}
            aria-modal={modal ? true : undefined}
            aria-live={modal ? undefined : "polite"}
            aria-label={t("guide.aria")}
            tabIndex={modal ? -1 : undefined}
            onKeyDown={(e) => {
              // Фокус на самом пузыре: Enter — «Дальше» (как раньше с фокусом на кнопке).
              if (modal && action === "next" && e.key === "Enter" && e.target === e.currentTarget) {
                e.preventDefault();
                onNext();
              }
            }}
            className="pointer-events-auto absolute rounded-2xl border-2 border-border bg-surface px-4 pb-2.5 pt-3 shadow-[0_12px_32px_rgb(0_0_0/0.22)] outline-none"
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
            {spike ? (
              // Клин закрывает рамку пузыря под собой (заливка) и продолжает её двумя сторонами до кнопки.
              <svg
                aria-hidden
                data-guide-spike=""
                className="pointer-events-none absolute top-full overflow-visible"
                style={{ left: spike.left, width: SPIKE_W, height: spike.h }}
                viewBox={`0 0 ${SPIKE_W} ${spike.h}`}
              >
                <path d={`M0 0L${spike.tipX} ${spike.h}L${SPIKE_W} 0Z`} className="fill-surface" />
                <path d={`M0 0L${spike.tipX} ${spike.h}L${SPIKE_W} 0`} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-border" />
              </svg>
            ) : (
              <span aria-hidden className={cn("absolute h-4 w-4 rotate-45 border-border bg-surface", tail.cls)} style={{ left: tail.left, right: tail.right, bottom: tail.bottom }} />
            )}
            {/* Печать: невидимый «хвост» текста уже занимает место — строки не прыгают, пузырь не растёт.
                Классы текста — общие с «линейкой» проводника (BUBBLE_TEXT): по ней считается высота пузыря. */}
            <p aria-hidden className={cn("relative", BUBBLE_TEXT)}>
              <span>{shown.slice(0, typing.n)}</span>
              <span className="text-transparent">{shown.slice(typing.n)}</span>
            </p>
            <span className="sr-only">{text}</span>
            {action === "tap" && (
              // Подсказка, а не действие: своей строкой над кнопками (рядом с «Пропустить» в узком пузыре ей тесно),
              // текст приглушённый (синий — цвет кнопок), синяя только иконка пальца. Высота строки — ROW_TAP в lib/guide.ts.
              <p data-guide-tap-hint="" className="relative mt-2 flex items-center gap-1.5 text-xs font-bold leading-tight text-muted">
                <Pointer size={14} aria-hidden className="shrink-0 text-primary" />
                <span className="min-w-0">{t("guide.tapHint")}</span>
              </p>
            )}
            <div className={cn("relative flex items-center justify-end gap-2", action === "tap" ? "mt-1" : "mt-2")}>
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
              {/* Фокус модального пузыря — на нём самом (кольцо на «Дальше» — только после Tab: не спорит с рамкой цели);
                  у шага «нажми» фокус ставит GuideHost — на цель. */}
              {action === "next" && (
                <Button
                  size="md"
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
