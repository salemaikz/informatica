"use client";

import { Check, Cpu } from "lucide-react";
import { m, useAnimationControls } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { feedback } from "@/lib/feedback";
import type { ShopItem } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Shake } from "@/components/motion/Shake";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { formatNum, shopAvailability } from "./shop-helpers";
import { useChips, useHearts } from "./useEconomy";

/** Раздел магазина: заголовок, подсказка и содержимое. */
export function ShopSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-extrabold">{title}</h2>
        {hint && <p className="text-sm font-semibold text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Плитка-иконка слева в строке товара. */
export function IconTile({
  children,
  tone = "gold",
}: {
  children: ReactNode;
  tone?: "gold" | "heart" | "ai" | "primary";
}) {
  const tones = {
    gold: "bg-gold-soft text-gold",
    heart: "bg-heart-soft text-heart",
    ai: "bg-ai-soft text-ai",
    primary: "bg-primary-soft text-primary",
  };
  return (
    <span
      className={cn(
        "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Цена в чипах: иконка и число. */
export function ChipPrice({ n, className, plus }: { n: number; className?: string; plus?: boolean }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 tabular-nums", className)}
    >
      <Cpu size={16} />
      {plus ? "+" : ""}
      {formatNum(n)}
    </span>
  );
}

/**
 * Строка товара за чипы (сердечки, бустеры). Кнопка «Купить»:
 * хватает чипов — покупка (звук, пульс строки, «Куплено»); не хватает — встряска и причина; запас полон/безлимит — неактивна.
 */
export function ChipItemRow({
  item,
  icon,
  tone,
  nameKey,
  descKey,
}: {
  item: ShopItem;
  icon: ReactNode;
  tone: "gold" | "heart";
  nameKey: DictKey;
  descKey: DictKey;
}) {
  const { t } = useT();
  const hearts = useHearts();
  const { chips } = useChips();
  const reduce = useReduceMotion();
  const controls = useAnimationControls();
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const list = timers.current;
    return () => {
      list.forEach(clearTimeout);
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, []);

  const av = shopAvailability(item, hearts, chips);
  const blocked = !av.ok && av.reason !== "chips";

  const onBuy = () => {
    if (done) return;
    const res = useApp.getState().buy(item.id);
    if (res.ok) {
      feedback("xp");
      setDone(true);
      if (!reduce)
        void controls.start({
          scale: [1, 1.03, 1],
          transition: { duration: 0.35, ease: "easeOut" },
        });
      if (doneTimer.current) clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setDone(false), 1500);
    } else {
      setShake(true);
      timers.current.push(setTimeout(() => setShake(false), 400));
    }
  };

  const reason = done
    ? t("shop.bought")
    : av.ok
      ? null
      : av.reason === "full"
        ? t("shop.fail.full")
        : av.reason === "unlimited"
          ? t("shop.fail.unlimited")
          : av.reason === "overflow"
            ? t("shop.fail.overflow")
            : t("shop.fail.chips", { n: av.missing ?? 0 });

  return (
    <m.div
      animate={controls}
      className="flex items-center gap-3 rounded-3xl border-2 border-border bg-surface p-3.5"
    >
      <IconTile tone={tone}>{icon}</IconTile>
      <div className="min-w-0 flex-1 break-words">
        <p className="font-extrabold leading-tight">{t(nameKey)}</p>
        <p className="text-sm font-semibold text-muted">{t(descKey)}</p>
        {reason && (
          <p
            className={cn(
              "mt-0.5 flex items-center gap-1 text-[13px] font-extrabold",
              done ? "text-success-strong" : blocked ? "text-muted" : "text-warning-strong",
            )}
          >
            {reason}
            {!blocked && !done && <Cpu size={13} />}
          </p>
        )}
      </div>
      <Shake active={shake} className="shrink-0">
        <Button
          variant={done ? "success" : av.ok ? "primary" : "secondary"}
          size="md"
          disabled={blocked && !done}
          onClick={onBuy}
          aria-label={
            done ? t("shop.bought") : `${t("shop.buy")}: ${t(nameKey)}`
          }
          className="w-28 justify-center"
        >
          {done ? (
            <Check size={20} strokeWidth={3} aria-label={t("shop.bought")} />
          ) : (
            <>
              <Cpu
                size={17}
                className={av.ok || blocked ? undefined : "text-gold"}
              />
              {formatNum(item.price)}
            </>
          )}
        </Button>
      </Shake>
    </m.div>
  );
}

/** Строка товара за тенге: нажатие открывает шторку «Оплата скоро». */
export function MoneyRow({
  icon,
  tone = "gold",
  title,
  desc,
  price,
  badge,
  highlight,
  onPick,
}: {
  icon: ReactNode;
  tone?: "gold" | "heart" | "ai" | "primary";
  title: string;
  desc: string;
  price: string;
  badge?: { label: string; tone: "gold" | "success" };
  highlight?: boolean;
  onPick: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-3xl border-2 bg-surface p-3.5",
        highlight ? "border-gold bg-gold-soft/40" : "border-border",
        badge && "mt-1.5",
      )}
    >
      {badge && (
        <Pill
          tone={badge.tone}
          className="absolute -top-2.5 left-4 border border-surface"
        >
          {badge.label}
        </Pill>
      )}
      <IconTile tone={tone}>{icon}</IconTile>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold leading-tight">{title}</p>
        <p className="text-sm font-semibold text-muted">{desc}</p>
      </div>
      <Button
        variant="secondary"
        size="md"
        onClick={onPick}
        className="min-w-24 shrink-0 whitespace-nowrap"
      >
        {price}
      </Button>
    </div>
  );
}
