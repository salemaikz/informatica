"use client";

import { ArrowRight, BookOpen, Clock, Cpu, Crown, Dumbbell, Heart, HeartCrack, HeartPlus, HeartPulse } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { feedback } from "@/lib/feedback";
import { AI_DAILY_CAP, shopItem, type ShopItemId } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Mascot } from "@/components/mascot/Mascot";
import { Shake } from "@/components/motion/Shake";
import { springBouncy, springSoft } from "@/components/motion/presets";
import { useChips, useHearts, useNow } from "./useEconomy";
import { formatNum, formatRemaining, shopAvailability } from "./shop-helpers";
import { readHearts } from "./HeartsBar";

/** Строка покупки сердечек за чипы (компактная, три подряд умещаются на 360 px): иконка, название, цена или «не хватает N». */
function BuyRow({
  id,
  icon,
  nameKey,
  descKey,
  onBought,
}: {
  id: ShopItemId;
  icon: ReactNode;
  nameKey: DictKey;
  descKey: DictKey;
  onBought: () => void;
}) {
  const { t } = useT();
  const hearts = useHearts();
  const { chips } = useChips();
  const [shake, setShake] = useState(false);
  const item = shopItem(id)!;
  const av = shopAvailability(item, hearts, chips);
  const missing = !av.ok && av.reason === "chips" ? (av.missing ?? 0) : 0;
  // Сердечки уже есть (вернулось само) — покупать нечего: окно покажет «можно продолжать».
  const blocked = !av.ok && av.reason !== "chips";

  const buy = () => {
    if (!av.ok) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    const res = useApp.getState().buy(id);
    if (res.ok) {
      feedback("xp");
      onBought();
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  return (
    <Shake active={shake}>
      <button
        type="button"
        onClick={buy}
        disabled={blocked}
        aria-disabled={!av.ok}
        className={cn(
          "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition-[translate,box-shadow,filter] duration-75 active:translate-y-[2px]",
          av.ok
            ? "border-heart/40 bg-heart-soft shadow-[0_3px_0_var(--border)] hover:brightness-95"
            : "border-border bg-surface opacity-80",
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-heart" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold leading-tight">{t(nameKey)}</span>
          <span className="block text-[13px] font-semibold leading-snug text-muted">{t(descKey)}</span>
        </span>
        <span
          className={cn(
            "flex shrink-0 flex-col items-end text-right font-extrabold",
            av.ok ? "text-warning-strong" : "text-muted",
          )}
        >
          <span className="flex items-center gap-1">
            <Cpu size={16} className={av.ok ? "text-gold" : undefined} aria-hidden />
            <span className="tabular-nums">{formatNum(item.price)}</span>
          </span>
          {missing > 0 && <span className="text-xs font-bold text-danger">{t("hearts.out.missing", { n: formatNum(missing) })}</span>}
        </span>
      </button>
    </Shake>
  );
}

/** Бесплатные и платные пути вернуть сердечки: тренировка, Безлимит. */
function LinkCard({ href, icon, title, desc, tone }: { href: string; icon: ReactNode; title: string; desc: string; tone: "primary" | "gold" }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-2xl border-2 p-3 transition-[translate,filter] duration-75 hover:brightness-95 active:translate-y-[2px]",
        tone === "gold" ? "border-gold bg-gold-soft" : "border-primary/40 bg-primary-soft",
      )}
    >
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface", tone === "gold" ? "text-gold" : "text-primary")} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block font-extrabold leading-tight", tone === "gold" ? "text-warning-strong" : "text-primary")}>{title}</span>
        <span className="block text-sm font-semibold text-muted">{desc}</span>
      </span>
      <ArrowRight size={20} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}

function Content({
  layout,
  onResume,
  onExit,
  theoryHref,
}: {
  layout: "sheet" | "screen";
  onResume: () => void;
  onExit: () => void;
  theoryHref?: string;
}) {
  const { t, lang } = useT();
  const hearts = useHearts();
  const { chips } = useChips();
  const now = useNow();
  // Сердечко вернулось само (таймер) или куплено — предлагаем продолжить.
  const back = hearts.unlimited || hearts.count > 0;
  const remaining = hearts.nextAt !== null && now > 0 ? formatRemaining(hearts.nextAt - now, lang) : null;

  // После покупки состояние в сторе уже обновлено — продолжаем сразу, без лишнего нажатия.
  const bought = () => {
    if (readHearts().count > 0 || readHearts().unlimited) onResume();
  };

  return (
    <div className={cn("flex flex-col gap-3", layout === "screen" && "w-full max-w-md")}>
      <div className="flex flex-col items-center gap-2 text-center">
        <m.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springBouncy}>
          <Mascot mood={back ? "happy" : "sad"} size={layout === "screen" ? 104 : 72} />
        </m.div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold leading-tight">
          {back ? (
            <Heart size={26} className="shrink-0 text-heart" fill="currentColor" aria-hidden />
          ) : (
            <HeartCrack size={26} className="shrink-0 text-heart" aria-hidden />
          )}
          {back ? t("hearts.out.back") : t("hearts.out.title")}
        </h2>
        <p className="font-semibold text-muted">{back ? t("hearts.out.backText") : t("hearts.out.text")}</p>
        {!back && remaining && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-heart-soft px-3 py-1 text-sm font-extrabold text-heart-strong">
            <Clock size={15} aria-hidden /> {t("hearts.out.next", { time: remaining })}
          </span>
        )}
      </div>

      {back ? (
        <Button size="lg" block variant="success" onClick={onResume} autoFocus>
          {t("hearts.out.resume")}
        </Button>
      ) : (
        <m.div
          className="flex flex-col gap-2.5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.08 }}
        >
          <div className="flex items-center justify-between px-1 text-sm font-extrabold text-muted">
            <span>{t("hearts.out.balance")}</span>
            <span className="flex items-center gap-1 text-warning-strong">
              <Cpu size={16} className="text-gold" aria-hidden />
              <span className="tabular-nums">{formatNum(chips)}</span>
            </span>
          </div>
          <BuyRow id="heart-1" icon={<Heart size={22} fill="currentColor" aria-hidden />} nameKey="hearts.out.one" descKey="hearts.out.oneDesc" onBought={bought} />
          <BuyRow id="hearts-3" icon={<HeartPlus size={22} aria-hidden />} nameKey="hearts.out.three" descKey="hearts.out.threeDesc" onBought={bought} />
          <BuyRow id="hearts-full" icon={<HeartPulse size={22} aria-hidden />} nameKey="hearts.out.refill" descKey="hearts.out.refillDesc" onBought={bought} />
          <LinkCard href="/practice" tone="primary" icon={<Dumbbell size={24} />} title={t("hearts.out.practice")} desc={t("hearts.out.practiceDesc")} />
          <LinkCard href="/plans?from=hearts" tone="gold" icon={<Crown size={24} fill="currentColor" />} title={t("hearts.out.unlimited")} desc={t("hearts.out.unlimitedDesc", { n: AI_DAILY_CAP.unlimited })} />
          {theoryHref && (
            <ButtonLink href={theoryHref} variant="ghost" block icon={<BookOpen size={18} />}>
              {t("hearts.out.theory")}
            </ButtonLink>
          )}
        </m.div>
      )}

      <Button variant="ghost" block onClick={onExit} className="text-danger">
        {t("hearts.out.exit")}
      </Button>
    </div>
  );
}

/**
 * «Сердечки закончились»: купить за чипы (полный запас, +1), вернуть тренировкой (бесплатно), взять «Безлимит» или выйти.
 * layout="sheet" — шторка поверх урока (open/onClose); layout="screen" — полноэкранно на входе в урок.
 * onResume — сердечки появились (куплены или восстановились): окно закрывается, урок продолжается.
 */
export function OutOfHearts({
  layout = "sheet",
  open = true,
  onClose,
  onResume,
  onExit,
  theoryHref,
}: {
  layout?: "sheet" | "screen";
  open?: boolean;
  onClose?: () => void;
  onResume: () => void;
  onExit: () => void;
  /** Ссылка «пока почитай теорию» (теория не блокируется сердечками). */
  theoryHref?: string;
}) {
  const { t } = useT();
  if (layout === "screen") {
    return (
      <main className="mx-auto flex min-h-dvh w-full items-center justify-center px-4 py-8">
        <Content layout="screen" onResume={onResume} onExit={onExit} theoryHref={theoryHref} />
      </main>
    );
  }
  return (
    <Modal open={open} onClose={onClose ?? onExit} label={t("hearts.out.title")}>
      <Content layout="sheet" onResume={onResume} onExit={onExit} theoryHref={theoryHref} />
    </Modal>
  );
}
