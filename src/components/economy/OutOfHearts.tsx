"use client";

import { ArrowRight, Clock, Cpu, Crown, Dumbbell, Heart, HeartCrack, HeartPlus, HeartPulse } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { feedback } from "@/lib/feedback";
import { ENTRY_COST, PRACTICE_HEART_MIN_ACCURACY, PRACTICE_HEART_MIN_ANSWERS, canAfford, formatHearts, itemPrice, shopItem, type ShopItemId } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Mascot } from "@/components/mascot/Mascot";
import { Shake } from "@/components/motion/Shake";
import { springBouncy, springSoft } from "@/components/motion/presets";
import { useChips, useHearts, useNow, usePracticeHeartsLeft } from "./useEconomy";
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
            <span className="tabular-nums">{formatNum(itemPrice(item, hearts))}</span>
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
  need,
  what,
  onResume,
  onExit,
}: {
  layout: "sheet" | "screen";
  need: number;
  what: "entry" | "theory";
  onResume: () => void;
  onExit: () => void;
}) {
  const { t, lang } = useT();
  const hearts = useHearts();
  const { chips } = useChips();
  const now = useNow();
  // Карточку «Тренировка вернёт сердечко» показываем, только пока сегодняшний лимит возвратов не исчерпан.
  const practiceLeft = usePracticeHeartsLeft();
  // Сердечек снова хватает на вход (вернулись по таймеру или куплены) — предлагаем продолжить.
  const back = canAfford(hearts, need);
  // Сердечки есть, но на вход за 2 не хватает — «Не хватает сердечек», а не «закончились».
  const short = !back && hearts.count > 0;
  const remaining = hearts.nextAt !== null && now > 0 ? formatRemaining(hearts.nextAt - now, lang) : null;

  // Продолжаем один раз за открытие: закрывающееся окно ещё ~0,2 с принимает нажатия, а вызывающий (игра) по onResume
  // сразу списывает вход — второе нажатие списало бы ещё раз. Content монтируется заново при каждом открытии.
  const resumed = useRef(false);
  const resume = () => {
    if (resumed.current) return;
    resumed.current = true;
    onResume();
  };
  // После покупки состояние в сторе уже обновлено — хватает на вход: продолжаем сразу, без лишнего нажатия.
  const bought = () => {
    if (canAfford(readHearts(), need)) resume();
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
          {back ? t("hearts.out.back") : short ? t("hearts.out.titleShort") : t("hearts.out.title")}
        </h2>
        <p className="font-semibold text-muted">
          {back ? t("hearts.out.backText") : what === "theory" ? t("hearts15.out.theoryText", { cost: formatHearts(ENTRY_COST.theory) }) : t("hearts.out.text")}
        </p>
        {!back && need !== 1 && (
          <p className="text-sm font-extrabold text-heart-strong">{t("hearts.out.need", { need: formatHearts(need), have: formatHearts(hearts.count) })}</p>
        )}
        {!back && remaining && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-heart-soft px-3 py-1 text-sm font-extrabold text-heart-strong">
            <Clock size={15} aria-hidden /> {t("hearts.out.next", { time: remaining })}
          </span>
        )}
      </div>

      {back ? (
        <Button size="lg" block variant="success" onClick={resume} autoFocus>
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
          {practiceLeft > 0 && (
            <LinkCard
              href="/practice"
              tone="primary"
              icon={<Dumbbell size={24} />}
              title={t("hearts.out.practice")}
              desc={t("hearts.out.practiceDesc", { n: PRACTICE_HEART_MIN_ANSWERS, p: Math.round(PRACTICE_HEART_MIN_ACCURACY * 100) })}
            />
          )}
          <LinkCard href="/plans?from=hearts" tone="gold" icon={<Crown size={24} fill="currentColor" />} title={t("hearts.out.unlimited")} desc={t("hearts.out.unlimitedDesc")} />
          {/* Запасной путь: тренировка бесплатна (теория теперь платная). Если она уже вернёт сердечко — это карточка выше. */}
          {practiceLeft <= 0 && (
            <ButtonLink href="/practice" variant="ghost" block icon={<Dumbbell size={18} />}>
              {t("hearts15.out.practiceFree")}
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
 * «Сердечки закончились» / «Не хватает сердечек» (#40: сердечки — плата за вход в урок, тест или игру):
 * купить за чипы (+1, +3, полный запас), вернуть тренировкой (бесплатно), взять «Безлимит» или выйти.
 * layout="sheet" — шторка поверх экрана (open/onClose); layout="screen" — полноэкранно на входе.
 * need — цена входа (0,5, 1 или 2): окно предлагает продолжить, когда сердечек хватает на вход.
 * what="theory" — окно чтения конспекта (0,5): другой текст. Запасной путь — «Тренировка — бесплатно».
 * onResume — сердечек хватает (куплены или восстановились): окно закрывается, вызывающий продолжает вход.
 */
export function OutOfHearts({
  layout = "sheet",
  open = true,
  need = 1,
  onClose,
  what = "entry",
  onResume,
  onExit,
}: {
  layout?: "sheet" | "screen";
  open?: boolean;
  need?: number;
  onClose?: () => void;
  what?: "entry" | "theory";
  onResume: () => void;
  onExit: () => void;
}) {
  const { t } = useT();
  if (layout === "screen") {
    return (
      <main className="mx-auto flex min-h-dvh w-full items-center justify-center px-4 py-8">
        <Content layout="screen" need={need} what={what} onResume={onResume} onExit={onExit} />
      </main>
    );
  }
  return (
    <Modal open={open} onClose={onClose ?? onExit} label={t("hearts.out.title")}>
      <Content layout="sheet" need={need} what={what} onResume={onResume} onExit={onExit} />
    </Modal>
  );
}
