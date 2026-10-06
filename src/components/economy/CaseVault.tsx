"use client";

import { useState } from "react";
import { Check, Gift, Lock } from "lucide-react";
import { m } from "motion/react";
import { useApp } from "@/lib/store";
import { COSMETICS, type Cosmetic } from "@/lib/cosmetics";
import { useT } from "@/i18n/useT";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CaseVisual } from "./CaseVisual";
import { CosmeticAvatar } from "./ProfileAvatar";
import { cn } from "@/lib/cn";

export function CaseVault() {
  const { t, l } = useT();
  const cases = useApp((s) => s.cases);
  const owned = useApp((s) => s.cosmetics);
  const equipped = useApp((s) => s.equippedCosmeticId);
  const name = useApp((s) => s.profile.name);
  const openCase = useApp((s) => s.openCase);
  const equip = useApp((s) => s.equipCosmetic);
  const [revealed, setRevealed] = useState<Cosmetic | null>(null);
  const complete = owned.length >= COSMETICS.length;
  return (
    <Card className="flex flex-col gap-4">
      <div><h2 className="text-xl font-extrabold">{t("cases.title")}</h2><p className="text-sm font-semibold text-muted">{t("cases.hint")}</p></div>
      <div className="flex items-center gap-4 rounded-2xl bg-primary-soft p-4">
        <CaseVisual size={112} open={!!revealed} />
        <div className="min-w-0 flex-1"><p className="mb-2 font-extrabold text-primary">{t("cases.available", { n: cases })}</p><Button size="sm" disabled={!cases || complete} icon={<Gift size={18} />} onClick={() => setRevealed(openCase())}>{t("cases.open")}</Button></div>
      </div>
      {revealed && (
        <m.div key={revealed.id} initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-2xl border-2 border-gold bg-gold-soft p-3" aria-live="polite">
          <CosmeticAvatar name={name} cosmetic={revealed} size={64} />
          <div className="flex-1"><p className="text-xs font-extrabold text-warning-strong">{t("cases.received")}</p><p className="font-extrabold">{l(revealed.name)}</p></div>
          <Button size="sm" variant="secondary" disabled={equipped === revealed.id} onClick={() => equip(revealed.id)}>{equipped === revealed.id ? <Check size={18} /> : t("cases.equip")}</Button>
        </m.div>
      )}
      {complete && <p className="text-sm font-semibold text-success">{t("cases.complete")}</p>}
      <p className="font-extrabold">{t("cases.collection", { n: owned.length, total: COSMETICS.length })}</p>
      <div className="grid grid-cols-3 gap-2">
        {COSMETICS.map((item) => {
          const available = owned.includes(item.id);
          const active = equipped === item.id;
          return <button key={item.id} type="button" disabled={!available} aria-pressed={active} onClick={() => equip(item.id)} className={cn("relative flex min-h-32 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center transition-colors", active ? "border-primary bg-primary-soft" : "border-border bg-surface-2", !available && "opacity-50")}>
            <CosmeticAvatar name={name} cosmetic={item} size={58} />
            <span className="text-xs font-extrabold leading-tight">{l(item.name)}</span>
            <span className={cn("text-[10px] font-bold", item.rarity === "rare" ? "text-warning-strong" : "text-muted")}>{t(item.rarity === "rare" ? "cases.rare" : "cases.common")}</span>
            {!available && <Lock className="absolute right-2 top-2 text-muted" size={12} aria-label={t("cases.locked")} />}
            {active && <Check className="absolute right-2 top-2 text-primary" size={14} />}
          </button>;
        })}
      </div>
      {equipped && <Button variant="ghost" onClick={() => equip(null)}>{t("cases.reset")}</Button>}
    </Card>
  );
}
