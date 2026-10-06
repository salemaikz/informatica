"use client";

import { Check, Cpu, Lock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { cosmeticDef, owns, type CosmeticId } from "@/lib/cosmetics";
import { feedback } from "@/lib/feedback";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RARITY_LABEL, RARITY_SOFT, RARITY_TEXT } from "@/components/ui/rarity";
import { Shake } from "@/components/motion/Shake";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { formatNum } from "@/components/economy/shop-helpers";
import { ShortfallSheet } from "@/components/economy/ShortfallSheet";
import { cosmeticConfetti } from "./confetti";
import { cosmeticWhat } from "./names";
import { ProfileCard, type ProfilePreview } from "./ProfileCard";

function TryOnBody({ id, onClose, onShort }: { id: CosmeticId; onClose: () => void; onShort: () => void }) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const def = cosmeticDef(id);
  const owned = useApp((s) => owns(s.cosmetics, id));
  const equipped = useApp((s) => (def ? s.cosmetics.equipped[def.slot] === id : false));
  const chips = useApp((s) => s.wallet.chips);
  // Показывать ли украшение на карточке: после «Снять» карточка честно показывает слот без него.
  const [showing, setShowing] = useState(true);
  const [bought, setBought] = useState(false);
  const [shake, setShake] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  if (!def) return null;

  const preview: ProfilePreview = { [def.slot]: showing ? id : null };
  const missing = def.price === null ? 0 : Math.max(0, def.price - chips);

  const onBuy = () => {
    // Не хватает чипов — окно «Не хватает» поверх примерки (купить чипы, «Безлимит», заработать); тряска — отклик.
    if (missing > 0) {
      setShake(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShake(false), 400);
      onShort();
      return;
    }
    const res = useApp.getState().buyCosmetic(id);
    if (res.ok) {
      feedback("chips");
      if (!reduce) cosmeticConfetti(def.rarity);
      setBought(true);
      setShowing(true);
    } else {
      setShake(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShake(false), 400);
    }
  };
  const onEquip = () => {
    useApp.getState().equipCosmetic(def.slot, id);
    setShowing(true);
  };
  const onUnequip = () => {
    useApp.getState().equipCosmetic(def.slot, null);
    setShowing(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("cosmetics.try.title")}</p>
          <h2 className="break-words text-xl font-black leading-tight">{cosmeticWhat(id, t)}</h2>
          <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold", RARITY_SOFT[def.rarity], RARITY_TEXT[def.rarity])}>
            {t(RARITY_LABEL[def.rarity])}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-3 focus-visible:outline-primary"
        >
          <X size={22} />
        </button>
      </div>

      <ProfileCard preview={preview} />
      <p className="-mt-2 text-center text-sm font-semibold text-muted">{t("cosmetics.try.hint")}</p>

      {owned ? (
        <div className="flex flex-col gap-2">
          <p className={cn("flex items-center justify-center gap-1.5 text-sm font-extrabold", bought ? "text-success-strong" : "text-muted")} aria-live="polite">
            <Check size={16} strokeWidth={3} aria-hidden="true" />
            {bought ? t("cosmetics.try.bought") : t("cosmetics.try.owned")}
          </p>
          {equipped ? (
            <Button variant="secondary" size="lg" block onClick={onUnequip}>
              {t("cosmetics.act.unequip")}
            </Button>
          ) : (
            <Button variant="primary" size="lg" block onClick={onEquip}>
              {t("cosmetics.act.equip")}
            </Button>
          )}
        </div>
      ) : def.price === null ? (
        <p className="flex items-start gap-2 rounded-2xl bg-surface-2 p-3 text-sm font-bold text-muted">
          <Lock size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {t("cosmetics.try.caseOnly")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <Shake active={shake}>
            <Button variant="primary" size="lg" block onClick={onBuy} icon={<Cpu size={19} aria-hidden="true" />}>
              {t("cosmetics.act.buy", { n: formatNum(def.price) })}
            </Button>
          </Shake>
          {missing > 0 && (
            <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm font-extrabold">
              <span className="inline-flex items-center gap-1 text-warning-strong">
                {t("shop.fail.chips", { n: formatNum(missing) })}
                <Cpu size={14} aria-hidden="true" />
              </span>
              <a href="#shop-earn" onClick={onClose} className="text-primary underline underline-offset-2">
                {t("cosmetics.try.earn")}
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Шторка «Примерка»: крупная карточка профиля с выбранным украшением и действие — «Купить за N» / «Надеть» / «Снять».
 * Не хватает чипов — кнопка активна: нажатие открывает окно «Не хватает» поверх примерки (купить чипы, «Безлимит», заработать);
 * ниже остаётся «Не хватает N» и ссылка «Как заработать чипы». Легендарное — только пояснение про кейс.
 * Покупка: звук `chips`, лёгкое конфетти, украшение сразу надето.
 */
export function TryOnSheet({ open, id, onClose }: { open: boolean; id: CosmeticId; onClose: () => void }) {
  const { t } = useT();
  const [short, setShort] = useState(false);
  const price = cosmeticDef(id)?.price ?? 0;
  return (
    <>
      <Modal open={open} onClose={onClose} label={t("cosmetics.try.title")}>
        <TryOnBody id={id} onClose={onClose} onShort={() => setShort(true)} />
      </Modal>
      {/* Рядом с примеркой, а не внутри: у шторки есть transform, и вложенная шторка уехала бы */}
      <ShortfallSheet need="chips" cost={price} where="cosmetic" plansFrom="chips" open={open && short} onClose={() => setShort(false)} />
    </>
  );
}
