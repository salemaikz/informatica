"use client";

import {
  BadgeCheck,
  BookOpen,
  BookText,
  Bot,
  Camera,
  ClipboardCheck,
  Clock,
  Code2,
  Cpu,
  Dumbbell,
  Flag,
  Gamepad2,
  GraduationCap,
  Heart,
  Infinity as InfinityIcon,
  Layers,
  Lightbulb,
  MessageCircle,
  Mic,
  RefreshCw,
  ScrollText,
  Sparkles,
  Target,
  Trophy,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { AI_COST, CHIP_REWARD, ENTRY_COST, PERFECT_DROP, PLAN_FEATURES, SHOP_ITEMS, aiFreeIsLifetime, formatHearts, type AiKind, type ChipReason, type LedgerEntry } from "@/lib/economy";
import { shortDate } from "@/lib/date";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { dayDiff, formatClock, formatMult, formatNum, formatRemaining, knownAiKind, knownShopId } from "./shop-helpers";
import { ENTRY_RULE_KEYS, FREE_ENTRIES, FREE_ENTRY_KEYS, entryRules, regenRules, type EntryRuleId, type FreeEntryId } from "./shop-rules";
import { ChipPrice, IconTile } from "./ShopParts";
import { useAiQuote, useNow } from "./useEconomy";

// Информационные блоки магазина: как работают сердечки, как заработать чипы, цена ИИ, история чипов.

const ENTRY_ICONS: Record<EntryRuleId, LucideIcon> = {
  lesson: BookOpen,
  bigLesson: Layers,
  drill: Dumbbell,
  check: ClipboardCheck,
  exam: GraduationCap,
  checkpoint: Flag,
  game: Gamepad2,
  theory: BookText,
};

const FREE_ICONS: Record<FreeEntryId, LucideIcon> = {
  code: Code2,
  cheatsheet: ScrollText,
  chat: MessageCircle,
};

const TIER_NAME: Record<"free" | "lite" | "unlimited", DictKey> = {
  free: "plans.tier.free",
  lite: "plans.tier.lite",
  unlimited: "plans.tier.unlimited",
};

/** Цена входа в сердечках — всегда видна (у HeartCost при безлимите значок скрыт, а здесь это справка). */
function CostBadge({ n }: { n: number }) {
  const { t } = useT();
  const label = t("hearts.cost.aria", { n: formatHearts(n) });
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-heart-soft px-2.5 py-1 text-sm font-extrabold leading-none text-heart-strong"
    >
      <Heart size={14} fill="currentColor" aria-hidden />
      <span className="tabular-nums" aria-hidden>
        {formatHearts(n)}
      </span>
    </span>
  );
}

/**
 * «Как работают сердечки» (#40, #60; этап 16В): за что платятся (цены входа, в том числе тренировка), что бесплатно,
 * как возвращаются по тарифам и что делать при нуле. Числа — из ENTRY_COST, PLAN_FEATURES (через shop-rules.ts).
 */
export function HeartRules() {
  const { t, lang } = useT();

  return (
    <Card className="divide-y-2 divide-border p-0 sm:p-0">
      <section className="p-3.5" aria-labelledby="heart-rules-paid">
        <h3 id="heart-rules-paid" className="text-sm font-extrabold text-muted">
          {t("shop.rules.paid")}
        </h3>
        <ul className="mt-1.5 flex flex-col gap-1">
          {entryRules().map((r) => {
            const Icon = ENTRY_ICONS[r.id];
            return (
              <li key={r.id} className="flex min-h-11 items-center gap-3">
                <Icon size={20} className="shrink-0 text-heart" aria-hidden />
                <span className="min-w-0 flex-1 text-base font-extrabold leading-tight">{t(ENTRY_RULE_KEYS[r.id])}</span>
                <CostBadge n={r.cost} />
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-sm font-semibold text-muted">{t("econ16c.rules.when", { cost: formatHearts(ENTRY_COST.theory) })}</p>
      </section>

      <section className="p-3.5" aria-labelledby="heart-rules-free">
        <h3 id="heart-rules-free" className="text-sm font-extrabold text-muted">
          {t("shop.rules.free")}
        </h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {FREE_ENTRIES.map((id) => {
            const Icon = FREE_ICONS[id];
            return (
              <li key={id}>
                <Pill tone="success" icon={<Icon size={14} aria-hidden />} className="gap-1.5 px-3 py-1.5 text-sm">
                  {t(FREE_ENTRY_KEYS[id])}
                </Pill>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="p-3.5" aria-labelledby="heart-rules-regen">
        <h3 id="heart-rules-regen" className="text-sm font-extrabold text-muted">
          {t("shop.rules.regen")}
        </h3>
        <ul className="mt-1.5 flex flex-col gap-1">
          {regenRules().map((r) => (
            <li key={r.tier} className="flex min-h-11 items-center gap-3">
              {r.unlimited ? (
                <InfinityIcon size={20} strokeWidth={3} className="shrink-0 text-heart" aria-hidden />
              ) : (
                <Clock size={20} className="shrink-0 text-heart" aria-hidden />
              )}
              <span className="shrink-0 text-base font-extrabold leading-tight">{t(TIER_NAME[r.tier])}</span>
              <span className="min-w-0 flex-1 text-right text-[15px] font-bold leading-tight tabular-nums text-muted">
                {r.unlimited ? t("shop.rules.regen.unlimited") : t("shop.rules.regen.row", { max: r.max, time: formatRemaining(r.regenMs, lang) })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-start gap-3 p-3.5">
        <Heart size={20} className="mt-0.5 shrink-0 text-heart" aria-hidden />
        <p className="min-w-0 flex-1 text-[15px] font-bold leading-snug">{t("econ16c.rules.zero")}</p>
      </section>
    </Card>
  );
}

/** chips — гарантированная награда; у строки «сюрприз» (perfect) чипов нет: вместо числа — шанс (PERFECT_DROP). */
const EARN_ROWS: { id: string; icon: LucideIcon; key: DictKey; chips?: number }[] = [
  { id: "lessonFirst", icon: BookOpen, key: "economy.earn.lessonFirst", chips: CHIP_REWARD.lessonFirst },
  { id: "lessonRepeat", icon: RefreshCw, key: "economy.earn.lessonRepeat", chips: CHIP_REWARD.lessonRepeat },
  { id: "perfect", icon: BadgeCheck, key: "econ16c.earn.perfect" },
  { id: "dailyGoal", icon: Target, key: "economy.earn.dailyGoal", chips: CHIP_REWARD.dailyGoal },
  { id: "unit", icon: ClipboardCheck, key: "economy.earn.unit", chips: CHIP_REWARD.unit },
  { id: "exam", icon: GraduationCap, key: "economy.earn.exam", chips: CHIP_REWARD.exam },
  { id: "achievement", icon: Trophy, key: "economy.earn.achievement", chips: CHIP_REWARD.achievement },
];

/** «Как заработать чипы»: за что и сколько (числа — CHIP_REWARD из economy.ts, решение #105; сюрприз — PERFECT_DROP, этап 16В). */
export function EarnList() {
  const { t } = useT();
  const pct = (x: number) => Math.round(x * 100);
  const chancePct = pct(PERFECT_DROP.heartChance + PERFECT_DROP.chipsChance);
  return (
    <Card className="p-0 sm:p-0">
      <ul className="divide-y-2 divide-border">
        {EARN_ROWS.map((r) => (
          <li key={r.id} className="flex items-center gap-3 p-3.5">
            <IconTile tone="gold">
              <r.icon size={22} />
            </IconTile>
            <span className="min-w-0 flex-1 font-extrabold">
              {t(r.key)}
              {r.id === "perfect" && (
                <span className="block text-sm font-semibold text-muted">
                  {t("econ16c.earn.perfectSub", {
                    h: pct(PERFECT_DROP.heartChance),
                    c: pct(PERFECT_DROP.chipsChance),
                    n: 100 - chancePct,
                  })}
                </span>
              )}
            </span>
            {r.chips === undefined ? (
              <Pill tone="gold" className="py-1 text-sm">
                {t("econ16c.earn.perfectPill", { p: chancePct })}
              </Pill>
            ) : (
              <Pill tone="gold" className="py-1 text-sm">
                +<Cpu size={13} />
                {r.chips}
              </Pill>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t-2 border-border p-3.5 text-sm font-semibold text-muted">{t("econ16c.earn.note")}</p>
      <p className="border-t-2 border-border p-3.5 text-sm font-semibold text-muted">
        {t("shop.earn.mult", {
          lite: formatMult(PLAN_FEATURES.lite.chipMultiplier),
          unl: formatMult(PLAN_FEATURES.unlimited.chipMultiplier),
          boost: formatMult(SHOP_ITEMS.find((i) => i.kind === "boost")?.mult ?? 2),
        })}
      </p>
    </Card>
  );
}

/** desc — строка «что это» под названием (этап 16В, пункт H: чем подсказка отличается от сообщения в чате). У голоса — прежняя про расшифровку. */
const AI_ROWS: { kind: AiKind; icon: LucideIcon; key: DictKey; desc: DictKey }[] = [
  { kind: "hint", icon: Lightbulb, key: "shop.ai.hint", desc: "econ16c.ai.hint.desc" },
  { kind: "explain", icon: Wand2, key: "shop.ai.explain", desc: "econ16c.ai.explain.desc" },
  { kind: "ask", icon: Bot, key: "shop.ai.ask", desc: "econ16c.ai.ask.desc" },
  { kind: "chat", icon: MessageCircle, key: "shop.ai.chat", desc: "econ16c.ai.chat.desc" },
  { kind: "voice", icon: Mic, key: "shop.ai.voice", desc: "shop.ai.voice.sub" },
  { kind: "photo", icon: Camera, key: "shop.ai.photo", desc: "econ16c.ai.photo.desc" },
  { kind: "review", icon: GraduationCap, key: "shop.ai.review", desc: "econ16c.ai.review.desc" },
  { kind: "feedback", icon: Sparkles, key: "shop.ai.feedback", desc: "econ16c.ai.feedback.desc" },
];

/** «ИИ-помощник»: сколько бесплатных обращений осталось и цены сверх них. */
export function AiPricing() {
  const { t } = useT();
  const { freeLeft, tier } = useAiQuote("hint");
  const max = PLAN_FEATURES[tier].aiFree;
  const unlimited = !Number.isFinite(max);

  return (
    <Card className="flex flex-col gap-3 p-0 sm:p-0">
      <div className="flex items-center gap-3 p-3.5 pb-0">
        <IconTile tone="ai">
          <Sparkles size={24} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-tight">{unlimited ? t("shop.ai.unlimited") : t(aiFreeIsLifetime(tier) ? "shop.ai.freeLeft" : "ailimit.freeDay", { n: freeLeft, max })}</p>
          {!unlimited && <ProgressBar value={max > 0 ? freeLeft / max : 0} color="var(--ai)" height={10} className="mt-2" label={t("shop.ai.title")} />}
        </div>
      </div>
      {!unlimited && (
        <>
          <p className="px-3.5 text-sm font-bold text-muted">{t("shop.ai.over")}</p>
          <ul className="divide-y-2 divide-border border-t-2 border-border">
            {AI_ROWS.map((r) => (
              <li key={r.kind} className="flex items-center gap-3 px-3.5 py-2.5">
                <r.icon size={18} className="shrink-0 text-ai" />
                <span className="min-w-0 flex-1 text-[15px] font-bold">
                  {t(r.key)}
                  <span className="block text-sm font-semibold text-muted">{t(r.desc, { n: AI_COST.voice })}</span>
                </span>
                {AI_COST[r.kind] > 0 ? (
                  <ChipPrice n={AI_COST[r.kind]} plus={r.kind === "voice"} className="font-extrabold text-warning-strong" />
                ) : (
                  <span className="text-sm font-extrabold text-success-strong">{t("shop.ai.free")}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="px-3.5 pb-3 text-sm font-semibold text-muted">{t("shop.ai.voiceNote")}</p>
        </>
      )}
    </Card>
  );
}

const COLLAPSED = 5;

const REASON_KEY: Record<Exclude<ChipReason, "buy" | "ai" | "refund">, DictKey> = {
  welcome: "shop.ledger.welcome",
  xp: "shop.ledger.xp",
  lesson: "shop.ledger.lesson",
  perfect: "econ16c.ledger.perfect",
  dailyGoal: "shop.ledger.dailyGoal",
  achievement: "shop.ledger.achievement",
  exam: "shop.ledger.exam",
  unit: "economy.ledger.unit",
  case: "case.ledger",
};

const ITEM_NAME: Record<string, DictKey> = {
  "heart-1": "shop.item.heart-1",
  "hearts-3": "shop.item.hearts-3",
  "hearts-full": "shop.item.hearts-full",
  "boost-15": "shop.item.boost-15",
  "boost-60": "shop.item.boost-60",
};

/** История чипов: последние записи, свёрнуто до пяти. */
export function LedgerList() {
  const { t, lang } = useT();
  const ledger = useApp((s) => s.ledger);
  const now = useNow();
  const [open, setOpen] = useState(false);
  const rows = open ? ledger : ledger.slice(0, COLLAPSED);

  const title = (e: LedgerEntry): string => {
    if (e.reason === "buy") {
      const id = knownShopId(e.note);
      return t("shop.ledger.buy", { what: id ? t(ITEM_NAME[id]) : "" }).replace(/:\s*$/, "");
    }
    if (e.reason === "ai" || e.reason === "refund") {
      const kind = knownAiKind(e.note);
      const what = kind ? t(`shop.ai.${kind}` as DictKey) : "";
      return t(e.reason === "ai" ? "shop.ledger.ai" : "shop.ledger.refund", { what }).replace(/:\s*$/, "");
    }
    const key = REASON_KEY[e.reason];
    return key ? t(key) : "";
  };

  const when = (at: number): string => {
    const d = dayDiff(at, now);
    const day = d <= 0 ? t("shop.ledger.today") : d === 1 ? t("shop.ledger.yesterday") : shortDate(new Date(at), lang);
    return `${day}, ${formatClock(at)}`;
  };

  if (!ledger.length) {
    return <Card className="text-center font-semibold text-muted">{t("shop.ledger.empty")}</Card>;
  }

  return (
    <Card className="p-0 sm:p-0">
      <ul className="divide-y-2 divide-border">
        {rows.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold leading-tight">{title(e)}</p>
              <p className="text-[13px] font-semibold text-muted">{when(e.at)}</p>
            </div>
            <span className={e.amount > 0 ? "inline-flex items-center gap-1 font-extrabold tabular-nums text-success-strong" : "inline-flex items-center gap-1 font-extrabold tabular-nums text-text"}>
              {e.amount > 0 ? "+" : "−"}
              {formatNum(Math.abs(e.amount))}
              <Cpu size={14} className="text-gold" />
            </span>
          </li>
        ))}
      </ul>
      {ledger.length > COLLAPSED && (
        <div className="border-t-2 border-border p-2">
          <Button variant="ghost" block onClick={() => setOpen((v) => !v)}>
            {open ? t("shop.ledger.less") : t("shop.ledger.more")}
          </Button>
        </div>
      )}
    </Card>
  );
}
