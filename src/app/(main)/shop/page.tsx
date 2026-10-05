"use client";

import {
  ChevronRight,
  Cpu,
  Dumbbell,
  Heart,
  HeartPlus,
  Rocket,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { BOOST_PACKS, CHIP_PACKS, HEART_PASSES, PLAN_FEATURES, formatTenge, packSaving, shopItem } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import { CosmeticsShop } from "@/components/cosmetics/CosmeticsShop";
import { ComingSoonSheet } from "@/components/plans/ComingSoonSheet";
import { formatHours } from "@/components/plans/plans-helpers";
import { AiPricing, EarnList, HeartRules, LedgerList } from "@/components/economy/ShopInfo";
import { ShopStatus } from "@/components/economy/ShopStatus";
import { ShopPlanBanner } from "@/components/economy/ShopPlanBanner";
import {
  ChipItemRow,
  IconTile,
  MoneyRow,
  ShopSection,
} from "@/components/economy/ShopParts";
import { useHearts, usePlanTier, usePracticeHeartsLeft } from "@/components/economy/useEconomy";
import {
  formatNum,
  formatSpan,
  formatMult,
} from "@/components/economy/shop-helpers";
import { practiceRule } from "@/components/economy/shop-rules";

/** Магазин: строка сердечек и бустера (баланс — в шапке), тариф, сердечки за чипы и «Как работают сердечки», множитель, наборы за ₸ (оплата скоро), как заработать, цена ИИ, история чипов. */
export default function ShopPage() {
  const { t, lang } = useT();
  // Что выбрал ученик — показывается в шторке «Оплата скоро» (open отдельно, чтобы текст не пропадал при закрытии).
  const [soon, setSoon] = useState<{ open: boolean; what?: string }>({
    open: false,
  });
  const hearts = useHearts();
  const tier = usePlanTier();
  // Тренировка вернёт сердечко, только пока не исчерпан дневной лимит возвратов.
  const practiceLeft = usePracticeHeartsLeft();
  const showPractice = !hearts.unlimited && hearts.count < hearts.max && practiceLeft > 0;
  const practice = practiceRule();
  // Клик по товару за ₸ (спрос, #69): id товара из каталога экономики; оплата пока не подключена.
  const pick = (item: string, what: string) => {
    track({ e: "shop_click", item });
    setSoon({ open: true, what });
  };

  const heart1 = shopItem("heart-1");
  const heart3 = shopItem("hearts-3");
  const full = shopItem("hearts-full");
  const b15 = shopItem("boost-15");
  const b60 = shopItem("boost-60");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">{t("shop.title")}</h1>
        <p className="font-semibold text-muted">{t("shop.subtitle")}</p>
      </div>

      <ShopStatus />
      <ShopPlanBanner />

      <CosmeticsShop />

      <ShopSection
        title={t("shop.hearts.title")}
        hint={
          hearts.unlimited
            ? t("shop.hearts.hintUnlimited")
            : t("shop.hearts.hint", { time: formatHours(PLAN_FEATURES[tier].regenMs, lang) })
        }
      >
        <div className="flex flex-col gap-2.5">
          {heart1 && (
            <ChipItemRow
              item={heart1}
              tone="heart"
              icon={<HeartPlus size={26} />}
              nameKey="shop.item.heart-1"
              descKey="shop.item.heart-1.desc"
            />
          )}
          {heart3 && (
            <ChipItemRow
              item={heart3}
              tone="heart"
              icon={<HeartPlus size={26} />}
              nameKey="shop.item.hearts-3"
              descKey="shop.item.hearts-3.desc"
            />
          )}
          {full && (
            <ChipItemRow
              item={full}
              tone="heart"
              icon={<Heart size={26} fill="currentColor" />}
              nameKey="shop.item.hearts-full"
              descKey="shop.item.hearts-full.desc"
            />
          )}
          {showPractice && (
            <Link
              href="/practice"
              className="flex items-center gap-3 rounded-3xl border-2 border-dashed border-success/50 bg-success-soft p-3.5 transition-[translate] active:translate-y-0.5"
            >
              <IconTile tone="primary">
                <Dumbbell size={24} />
              </IconTile>
              <span className="min-w-0 flex-1 font-extrabold leading-snug text-success-strong">
                {t("shop.free.practice", { n: practice.answers, p: practice.percent })}
              </span>
              <ChevronRight
                size={20}
                className="shrink-0 text-success-strong"
              />
            </Link>
          )}
        </div>
      </ShopSection>

      <ShopSection title={t("shop.rules.title")} hint={t("shop.rules.hint")}>
        <HeartRules />
      </ShopSection>

      <ShopSection title={t("shop.passes.title")} hint={t("shop.passes.hint")}>
        <div className="flex flex-col gap-2.5">
          {HEART_PASSES.map((p) => {
            const title = t("shop.pass.title", { span: formatSpan(p.hours, lang) });
            const price = formatTenge(p.price);
            return (
              <MoneyRow
                key={p.id}
                tone="heart"
                icon={<Heart size={26} fill="currentColor" />}
                title={title}
                desc={t("shop.pass.desc")}
                price={price}
                onPick={() => pick(p.id, t("shop.soon.what", { item: title, price }))}
              />
            );
          })}
        </div>
      </ShopSection>

      <ShopSection title={t("shop.boost.title")} hint={t("shop.boost.hint")}>
        <div className="flex flex-col gap-2.5">
          {b15 && (
            <ChipItemRow
              item={b15}
              tone="gold"
              icon={<Rocket size={26} />}
              nameKey="shop.item.boost-15"
              descKey="shop.item.boost-15.desc"
            />
          )}
          {b60 && (
            <ChipItemRow
              item={b60}
              tone="gold"
              icon={<Rocket size={26} />}
              nameKey="shop.item.boost-60"
              descKey="shop.item.boost-60.desc"
            />
          )}
          {BOOST_PACKS.map((p) => {
            const title = t("shop.boost.pack", {
              mult: formatMult(p.mult),
              span: formatSpan(p.hours, lang),
            });
            const price = formatTenge(p.price);
            return (
              <MoneyRow
                key={p.id}
                icon={<Rocket size={26} />}
                title={title}
                desc={t("shop.boost.packDesc")}
                price={price}
                onPick={() => pick(p.id, t("shop.soon.what", { item: title, price }))}
              />
            );
          })}
        </div>
      </ShopSection>

      <ShopSection title={t("shop.chips.title")} hint={t("shop.chips.hint")}>
        <div className="flex flex-col gap-3">
          {CHIP_PACKS.map((p) => {
            const title = t("shop.chips.pack", { n: formatNum(p.chips) });
            const price = formatTenge(p.price);
            const saving = packSaving(p);
            return (
              <MoneyRow
                key={p.id}
                icon={<Cpu size={26} />}
                title={title}
                desc={saving > 0 ? t("shop.chips.saving", { n: saving }) : t("shop.chips.base")}
                price={price}
                highlight={p.badge === "popular"}
                badge={
                  p.badge
                    ? {
                        label: t(
                          p.badge === "popular"
                            ? "shop.badge.popular"
                            : "shop.badge.best",
                        ),
                        tone: p.badge === "popular" ? "gold" : "success",
                      }
                    : undefined
                }
                onPick={() => pick(p.id, t("shop.soon.what", { item: title, price }))}
              />
            );
          })}
        </div>
      </ShopSection>

      <div id="shop-earn" className="scroll-mt-20">
        <ShopSection title={t("shop.earn.title")}>
          <EarnList />
        </ShopSection>
      </div>

      <ShopSection title={t("shop.ai.title")}>
        <AiPricing />
      </ShopSection>

      <ShopSection title={t("shop.ledger.title")}>
        <LedgerList />
      </ShopSection>

      <ComingSoonSheet
        open={soon.open}
        what={soon.what}
        from="shop"
        onClose={() => setSoon((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
