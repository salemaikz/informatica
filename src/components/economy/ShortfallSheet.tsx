"use client";

import { ArrowRight, Clock, Cpu, Crown, Heart, HeartCrack, HeartPlus, HeartPulse, Sparkles } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { track, type ChipOutWhere, type ShortPick } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { feedback } from "@/lib/feedback";
import { useApp } from "@/lib/store";
import {
  ENTRY_COST,
  HEARTS_REFILL_KZT,
  TRIAL_DAYS,
  canAfford,
  formatHearts,
  formatTenge,
  itemPrice,
  shopItem,
  type ChipPack,
  type ShopItemId,
} from "@/lib/economy";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Mascot } from "@/components/mascot/Mascot";
import { Shake } from "@/components/motion/Shake";
import { springBouncy, springSoft } from "@/components/motion/presets";
import { ComingSoonSheet } from "@/components/plans/ComingSoonSheet";
import type { PlansFrom } from "@/components/plans/plans-helpers";
import { useChips, useHearts, useNow } from "./useEconomy";
import { formatNum, formatRemaining, shopAvailability } from "./shop-helpers";
import { readHearts } from "./HeartsBar";
import { shortfallOptions, type ShortfallNeed } from "./shortfall";

/**
 * Единое окно «Не хватает» (#121): сердечек или чипов. Куда бы ни упёрся ученик — урок, тренировка, ИИ, магазин, примерка —
 * здесь же: купить сердечки за чипы (только недостающие), купить чипы (₸ → «Оплата скоро» поверх), «Безлимит» (и пробный),
 * заработать бесплатно, подождать. Покупка за ₸ не уводит со страницы: ИИ-панель и чат остаются на месте.
 */

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
  // Сердечки уже есть (вернулись сами) — покупать нечего: окно покажет «можно продолжать».
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
          av.ok ? "border-heart/40 bg-heart-soft shadow-[0_3px_0_var(--border)] hover:brightness-95" : "border-border bg-surface opacity-80",
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-heart" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold leading-tight">{t(nameKey)}</span>
          <span className="block text-[13px] font-semibold leading-snug text-muted">{t(descKey)}</span>
        </span>
        <span className={cn("flex shrink-0 flex-col items-end text-right font-extrabold", av.ok ? "text-warning-strong" : "text-muted")}>
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

/** Строка-кнопка за ₸ (оплата скоро): иконка, название, пояснение и цена справа. */
function PayRow({
  icon,
  tone,
  title,
  desc,
  price,
  badge,
  onPick,
}: {
  icon: ReactNode;
  tone: "gold" | "heart";
  title: string;
  desc: string;
  price: string;
  badge?: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "relative flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left shadow-[0_3px_0_var(--border)] transition-[translate,box-shadow,filter] duration-75 hover:brightness-95 active:translate-y-[2px]",
        tone === "gold" ? "border-gold/60 bg-gold-soft" : "border-heart/40 bg-heart-soft",
        badge && "mt-1.5",
      )}
    >
      {badge && (
        <span className="absolute -top-2.5 left-3 rounded-full bg-success px-2 py-0.5 text-[11px] font-extrabold leading-none text-white">{badge}</span>
      )}
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface", tone === "gold" ? "text-gold" : "text-heart")} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold leading-tight">{title}</span>
        <span className="block text-[13px] font-semibold leading-snug text-muted">{desc}</span>
      </span>
      <span className="shrink-0 whitespace-nowrap font-extrabold text-warning-strong">{price}</span>
    </button>
  );
}

/** Ссылка-карточка: «Безлимит» (золотая) и «Заработать бесплатно» (голубая). */
function LinkCard({
  href,
  icon,
  title,
  desc,
  tone,
  onClick,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  desc: string;
  tone: "primary" | "gold";
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
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

export interface ShortfallSheetProps {
  need: ShortfallNeed;
  /** Сердечки: цена входа (0,5 / 1 / 2). Чипы: цена покупки или обращения к ИИ. */
  cost: number;
  /** Чипы: где не хватило (для статистики). */
  where?: ChipOutWhere;
  /** sheet — шторка (open/onClose); screen — полноэкранно на входе (только сердечки); inline — карточка в потоке (ИИ-панель, чат). */
  layout?: "sheet" | "screen" | "inline";
  /** Сердечки: окно открытия темы теории (0,5) — другой текст. */
  what?: "entry" | "theory";
  open?: boolean;
  onClose?: () => void;
  /** Сердечек хватает (куплены, вернулись или пробный период): вызывающий продолжает вход. */
  onResume?: () => void;
  /** Чипы: нехватка снята (пробный «Безлимит»). */
  onEnough?: () => void;
  onExit?: () => void;
  /** Откуда пришли — для окна тарифов и «Оплата скоро». */
  plansFrom: PlansFrom;
  /** Только inline: классы карточки (отступы в ИИ-панели и чате). */
  className?: string;
}

function Content(props: ShortfallSheetProps & { layout: "sheet" | "screen" | "inline"; onSoon: (what: string, item: string) => void }) {
  const { need, cost, where, layout, what = "entry", onClose, onResume, onEnough, onExit, plansFrom, onSoon } = props;
  const { t, lang } = useT();
  const hearts = useHearts();
  const { chips } = useChips();
  const now = useNow();
  const plan = useApp((s) => s.plan);
  const opts = useMemo(() => shortfallOptions({ need, cost, chips, hearts, plan, now }), [need, cost, chips, hearts, plan, now]);
  const isHearts = need === "hearts";
  // Сердечек снова хватает на вход (вернулись по таймеру или куплены) — предлагаем продолжить.
  const back = isHearts && canAfford(hearts, cost);
  // Сердечки есть, но на вход за 2 не хватает — «Не хватает сердечек», а не «закончились».
  const short = isHearts && !back && hearts.count > 0;
  const remaining = isHearts && opts.waitUntil !== null && now > 0 ? formatRemaining(opts.waitUntil - now, lang) : null;
  const showPack = !back && opts.pack !== null;
  const packEnough = !!opts.pack && opts.pack.chips + opts.pack.bonus >= opts.missingChips;

  // Продолжаем один раз за открытие: закрывающееся окно ещё ~0,2 с принимает нажатия, а вызывающий (игра) по onResume
  // сразу списывает вход — второе нажатие списало бы ещё раз. Content монтируется заново при каждом открытии.
  const resumed = useRef(false);
  const resume = () => {
    if (resumed.current) return;
    resumed.current = true;
    onResume?.();
  };
  // После покупки состояние в сторе уже обновлено — хватает на вход: продолжаем сразу, без лишнего нажатия.
  const bought = () => {
    pick("heart");
    if (canAfford(readHearts(), cost)) resume();
  };

  const pick = (p: ShortPick) => track({ e: "short_pick", need, pick: p });

  // Статистика: окно с предложением купить чипы показано (один раз за открытие).
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current) return;
    if (need === "chips") track({ e: "chips_out", where: where ?? "ai" });
    else if (showPack) track({ e: "chips_out", where: "hearts" });
    else return;
    reported.current = true;
  }, [need, where, showPack]);

  const openPack = (pack: ChipPack) => {
    pick("pack");
    track({ e: "shop_click", item: pack.id });
    onSoon(t("shop.chips.pack", { n: formatNum(pack.chips + pack.bonus) }), formatTenge(pack.price));
  };
  const openRefill = () => {
    pick("refill");
    track({ e: "shop_click", item: "hearts-refill" });
    onSoon(t("short.refill"), formatTenge(HEARTS_REFILL_KZT));
  };
  const onTrial = () => {
    if (!useApp.getState().startTrial()) return;
    track({ e: "trial_start", from: plansFrom });
    pick("trial");
    feedback("levelUp");
    if (isHearts) {
      if (canAfford(readHearts(), cost)) resume();
    } else {
      onEnough?.();
      onClose?.();
    }
  };

  const planTitle = isHearts ? t("econ16c.out.unlimited") : t("aicost.need.plan");
  const planDesc = isHearts ? t("hearts.out.unlimitedDesc") : plansFrom === "ai" ? t("short.plan.ai") : t("short.plan.chips");
  const trialBtn = opts.trial ? (
    <Button size={layout === "inline" ? "md" : "lg"} block icon={<Sparkles size={layout === "inline" ? 18 : 20} aria-hidden />} onClick={onTrial}>
      {t("short.trial", { n: TRIAL_DAYS })}
    </Button>
  ) : null;
  const packRow = opts.pack && (
    <PayRow
      tone="gold"
      icon={<Cpu size={22} aria-hidden />}
      title={t("shop.chips.pack", { n: formatNum(opts.pack.chips + opts.pack.bonus) })}
      desc={t("short.buyChips")}
      price={formatTenge(opts.pack.price)}
      badge={packEnough ? t("short.packEnough") : undefined}
      onPick={() => openPack(opts.pack!)}
    />
  );

  // ---------- Встроенная карточка (ИИ-панель, чат): коротко, без ухода со страницы ----------
  if (layout === "inline") {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-gold" aria-hidden>
            <Cpu size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold text-warning-strong">{t("aicost.need.title")}</p>
            <p className="font-bold text-text">{t("aicost.need.text", { need: cost, have: chips })}</p>
          </div>
        </div>
        <p className="text-sm font-semibold text-muted">{t("aicost.need.earn")}</p>
        {packRow}
        <div className="grid gap-2">
          {opts.plan && (
            <ButtonLink href={`/plans?from=${plansFrom}`} size="md" variant="secondary" block icon={<Crown size={18} className="text-gold" aria-hidden />} onClick={() => pick("plan")}>
              {t("aicost.need.plan")}
            </ButtonLink>
          )}
          {trialBtn}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", layout === "screen" && "w-full max-w-md")}>
      <div className="flex flex-col items-center gap-2 text-center">
        <m.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springBouncy}>
          <Mascot mood={back ? "happy" : "sad"} size={layout === "screen" ? 104 : 72} />
        </m.div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold leading-tight">
          {isHearts ? (
            back ? (
              <Heart size={26} className="shrink-0 text-heart" fill="currentColor" aria-hidden />
            ) : (
              <HeartCrack size={26} className="shrink-0 text-heart" aria-hidden />
            )
          ) : (
            <Cpu size={26} className="shrink-0 text-gold" aria-hidden />
          )}
          {isHearts ? (back ? t("hearts.out.back") : short ? t("hearts.out.titleShort") : t("hearts.out.title")) : t("aicost.need.title")}
        </h2>
        {isHearts ? (
          <p className="font-semibold text-muted">
            {back ? t("hearts.out.backText") : what === "theory" ? t("hearts15.out.theoryText", { cost: formatHearts(ENTRY_COST.theory) }) : t("econ16c.out.text")}
          </p>
        ) : (
          <>
            <p className="font-bold">{t("aicost.need.text", { need: formatNum(cost), have: formatNum(chips) })}</p>
            {opts.missingChips > 0 && <p className="text-sm font-extrabold text-warning-strong">{t("short.chips.missing", { n: formatNum(opts.missingChips) })}</p>}
          </>
        )}
        {isHearts && !back && cost !== 1 && (
          <p className="text-sm font-extrabold text-heart-strong">{t("hearts.out.need", { need: formatHearts(cost), have: formatHearts(hearts.count) })}</p>
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
        <m.div className="flex flex-col gap-2.5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springSoft, delay: 0.08 }}>
          <div className="flex items-center justify-between px-1 text-sm font-extrabold text-muted">
            <span>{t("hearts.out.balance")}</span>
            <span className="flex items-center gap-1 text-warning-strong">
              <Cpu size={16} className="text-gold" aria-hidden />
              <span className="tabular-nums">{formatNum(chips)}</span>
            </span>
          </div>
          {isHearts && opts.heartItems.some((h) => h.id === "heart-1") && (
            <BuyRow id="heart-1" icon={<Heart size={22} fill="currentColor" aria-hidden />} nameKey="hearts.out.one" descKey="hearts.out.oneDesc" onBought={bought} />
          )}
          {isHearts && opts.heartItems.some((h) => h.id === "hearts-3") && (
            <BuyRow id="hearts-3" icon={<HeartPlus size={22} aria-hidden />} nameKey="hearts.out.three" descKey="hearts.out.threeDesc" onBought={bought} />
          )}
          {isHearts && opts.heartItems.some((h) => h.id === "hearts-full") && (
            <BuyRow id="hearts-full" icon={<HeartPulse size={22} aria-hidden />} nameKey="hearts.out.refill" descKey="hearts.out.refillDesc" onBought={bought} />
          )}
          {showPack && (
            <>
              {packRow}
              <Link href="/shop#shop-chips" onClick={() => pick("all")} className="self-center px-2 py-1 text-sm font-extrabold text-primary underline underline-offset-2">
                {t("short.allPacks")}
              </Link>
            </>
          )}
          {opts.refill && (
            <PayRow
              tone="heart"
              icon={<HeartPulse size={22} aria-hidden />}
              title={t("short.refill")}
              desc={t("short.refillDesc")}
              price={formatTenge(HEARTS_REFILL_KZT)}
              onPick={openRefill}
            />
          )}
          {opts.plan && (
            <LinkCard href={`/plans?from=${plansFrom}`} tone="gold" icon={<Crown size={24} fill="currentColor" />} title={planTitle} desc={planDesc} onClick={() => pick("plan")} />
          )}
          {trialBtn}
          <LinkCard href="/shop#shop-earn" tone="primary" icon={<Sparkles size={22} />} title={t("short.earn")} desc={t("short.earnDesc")} onClick={() => pick("earn")} />
        </m.div>
      )}

      {(onExit || onClose) && (
        <Button
          variant="ghost"
          block
          onClick={() => {
            pick("exit");
            (onExit ?? onClose)?.();
          }}
          className={onExit ? "text-danger" : undefined}
        >
          {onExit ? t("hearts.out.exit") : t("common.close")}
        </Button>
      )}
    </div>
  );
}

export function ShortfallSheet(props: ShortfallSheetProps) {
  const { t } = useT();
  const { need, layout = "sheet", open = true, onClose, onExit, plansFrom } = props;
  // «Оплата скоро» — рядом с окном, а не внутри него: у шторки есть transform, и вложенное fixed-окно уехало бы.
  const [soon, setSoon] = useState<{ open: boolean; what?: string }>({ open: false });
  const onSoon = (item: string, price: string) => setSoon({ open: true, what: t("shop.soon.what", { item, price }) });
  const content = <Content {...props} layout={layout} onSoon={onSoon} />;
  // Монтируем только после первого открытия: окно тянет роутер и тариф, а нужно оно не каждому.
  const sheet = soon.what ? (
    <ComingSoonSheet open={soon.open} what={soon.what} from={plansFrom} onClose={() => setSoon((s) => ({ ...s, open: false }))} />
  ) : null;

  if (layout === "inline") {
    return (
      <>
        <m.div
          role="alert"
          className={cn("flex flex-col gap-2.5 rounded-2xl border-2 border-gold/50 bg-gold-soft p-3 text-left", props.className)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
        >
          {content}
        </m.div>
        {sheet}
      </>
    );
  }
  if (layout === "screen") {
    return (
      <>
        <main className="mx-auto flex min-h-dvh w-full items-center justify-center px-4 py-8">{content}</main>
        {sheet}
      </>
    );
  }
  return (
    <>
      <Modal open={open} onClose={onClose ?? onExit ?? (() => {})} label={need === "hearts" ? t("hearts.out.title") : t("aicost.need.title")}>
        {content}
      </Modal>
      {sheet}
    </>
  );
}
