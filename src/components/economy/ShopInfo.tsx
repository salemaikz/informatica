"use client";

import { BadgeCheck, BookOpen, Bot, Camera, Cpu, GraduationCap, Lightbulb, MessageCircle, Mic, Sparkles, Target, Trophy, Wand2, Zap, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { AI_COST, CHIP_BONUS, PLAN_FEATURES, SHOP_ITEMS, type AiKind, type ChipReason, type LedgerEntry } from "@/lib/economy";
import { shortDate } from "@/lib/date";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { chipRate, dayDiff, formatClock, formatMult, formatNum, knownAiKind, knownShopId } from "./shop-helpers";
import { ChipPrice, IconTile } from "./ShopParts";
import { useAiQuote, useNow } from "./useEconomy";

// Информационные блоки магазина: как заработать чипы, цена ИИ, история чипов.

const EARN_ROWS: { id: "lesson" | "perfect" | "dailyGoal" | "achievement" | "exam"; icon: LucideIcon; key: DictKey }[] = [
  { id: "lesson", icon: BookOpen, key: "shop.earn.lesson" },
  { id: "perfect", icon: BadgeCheck, key: "shop.earn.perfect" },
  { id: "dailyGoal", icon: Target, key: "shop.earn.dailyGoal" },
  { id: "achievement", icon: Trophy, key: "shop.earn.achievement" },
  { id: "exam", icon: GraduationCap, key: "shop.earn.exam" },
];

/** «Как заработать чипы»: курс обмена и бонусы (значения из economy.ts). */
export function EarnList() {
  const { t } = useT();
  const rate = chipRate();
  return (
    <Card className="p-0 sm:p-0">
      <ul className="divide-y-2 divide-border">
        <li className="flex items-center gap-3 p-3.5">
          <IconTile tone="gold">
            <Zap size={22} />
          </IconTile>
          <span className="min-w-0 flex-1 font-extrabold">{t("shop.earn.xp", { xp: rate.xp, n: rate.n })}</span>
        </li>
        {EARN_ROWS.map((r) => (
          <li key={r.id} className="flex items-center gap-3 p-3.5">
            <IconTile tone="gold">
              <r.icon size={22} />
            </IconTile>
            <span className="min-w-0 flex-1 font-extrabold">{t(r.key)}</span>
            <Pill tone="gold" className="py-1 text-sm">
              +<Cpu size={13} />
              {CHIP_BONUS[r.id]}
            </Pill>
          </li>
        ))}
      </ul>
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

const AI_ROWS: { kind: AiKind; icon: LucideIcon; key: DictKey }[] = [
  { kind: "hint", icon: Lightbulb, key: "shop.ai.hint" },
  { kind: "explain", icon: Wand2, key: "shop.ai.explain" },
  { kind: "ask", icon: Bot, key: "shop.ai.ask" },
  { kind: "chat", icon: MessageCircle, key: "shop.ai.chat" },
  { kind: "voice", icon: Mic, key: "shop.ai.voice" },
  { kind: "photo", icon: Camera, key: "shop.ai.photo" },
  { kind: "review", icon: GraduationCap, key: "shop.ai.review" },
  { kind: "feedback", icon: Sparkles, key: "shop.ai.feedback" },
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
          <p className="font-extrabold leading-tight">{unlimited ? t("shop.ai.unlimited") : t("shop.ai.freeLeft", { n: freeLeft, max })}</p>
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
                <span className="min-w-0 flex-1 text-[15px] font-bold">{t(r.key)}</span>
                {AI_COST[r.kind] > 0 ? (
                  <ChipPrice n={AI_COST[r.kind]} className="font-extrabold text-warning-strong" />
                ) : (
                  <span className="text-sm font-extrabold text-success-strong">{t("shop.ai.free")}</span>
                )}
              </li>
            ))}
          </ul>
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
  perfect: "shop.ledger.perfect",
  dailyGoal: "shop.ledger.dailyGoal",
  achievement: "shop.ledger.achievement",
  exam: "shop.ledger.exam",
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
