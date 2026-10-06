"use client";

import { Cpu } from "lucide-react";
import { useState } from "react";
import { ACHIEVEMENT_CHIPS } from "@/lib/economy";
import { achievementsOfRarity, tallyAchievements, type AchievementDef } from "@/lib/gamification";
import { RARITIES, type Rarity } from "@/lib/rarity";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { AchievementBadge } from "@/components/app/AchievementBadge";
import { formatDate } from "@/components/progress/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RARITY_BG, RARITY_BORDER, RARITY_SOFT, RARITY_VAR } from "@/components/ui/rarity";

/** От самых редких к обычным: легендарные — вверху. */
const ORDER: Rarity[] = [...RARITIES].reverse();

const GROUP_KEY: Record<Rarity, DictKey> = {
  common: "gamify.group.common",
  rare: "gamify.group.rare",
  epic: "gamify.group.epic",
  legendary: "gamify.group.legendary",
};
const KIND_KEY: Record<Rarity, DictKey> = {
  common: "gamify.kind.common",
  rare: "gamify.kind.rare",
  epic: "gamify.kind.epic",
  legendary: "gamify.kind.legendary",
};

const pct = (ratio: number) => Math.round(ratio * 100);

/**
 * Достижения в профиле (этап 16В, K): сводка «Собрано N из M» с четырьмя мини-полосками, затем группы по редкости
 * (легендарные сверху) — компактная сетка значков; касание значка открывает шторку с описанием и наградой.
 */
export function AchievementsSection() {
  const { t, l } = useT();
  const earned = useApp((s) => s.achievements);
  const [open, setOpen] = useState<AchievementDef | null>(null);
  const total = tallyAchievements(earned);

  return (
    <Card>
      <h2 className="text-lg font-extrabold">{t("prof.achievements")}</h2>
      <p className="mt-0.5 text-sm font-bold text-muted">
        {t("gamify.collected", { a: total.got, b: total.total })} · {pct(total.ratio)}%
      </p>

      {/* Четыре мини-полоски — по одной на редкость, в порядке групп ниже. У каждой подпись: точка цвета редкости, название и «N/M».
          Колонка на 360 px — около 138 px: счётчик короткий («0/5», не «0 из 5»), название не обрезаем (в крайнем случае оно переносится). */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {ORDER.map((r) => {
          const tally = tallyAchievements(earned, r);
          return (
            <div key={r} className="min-w-0">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-extrabold leading-tight">
                <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", RARITY_BG[r])} />
                <span className="min-w-0 flex-1 break-words">{t(GROUP_KEY[r])}</span>
                <span className="shrink-0 tabular-nums text-muted">{t("gamify.ofShort", { a: tally.got, b: tally.total })}</span>
              </div>
              <ProgressBar value={tally.ratio} color={RARITY_VAR[r]} height={8} label={t("gamify.barAria", { name: t(GROUP_KEY[r]), p: pct(tally.ratio) })} />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-5">
        {ORDER.map((r) => {
          const tally = tallyAchievements(earned, r);
          return (
            <section key={r} aria-label={t(GROUP_KEY[r])}>
              <div className="flex items-center gap-2">
                <span aria-hidden className={cn("size-3 shrink-0 rounded-full", RARITY_BG[r])} />
                <h3 className="min-w-0 flex-1 truncate font-extrabold">
                  {t(GROUP_KEY[r])} · <span className="text-muted">{t("gamify.of", { a: tally.got, b: tally.total })}</span>
                </h3>
                <span className="text-sm font-extrabold tabular-nums text-muted">{pct(tally.ratio)}%</span>
              </div>
              <ProgressBar value={tally.ratio} color={RARITY_VAR[r]} height={6} className="mt-1.5" label={t("gamify.barAria", { name: t(GROUP_KEY[r]), p: pct(tally.ratio) })} />
              <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-y-2">
                {achievementsOfRarity(r).map((a) => {
                  const got = !!earned[a.id];
                  return (
                    <li key={a.id} className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => setOpen(a)}
                        aria-label={`${l(a.title)}, ${t(KIND_KEY[r])}, ${t(got ? "gamify.badge.got" : "gamify.badge.locked")}`}
                        className="flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <AchievementBadge icon={a.icon} rarity={a.rarity} got={got} size={56} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <AchievementSheet def={open} gotAt={open ? earned[open.id] : undefined} onClose={() => setOpen(null)} />
    </Card>
  );
}

/** Шторка достижения: название, редкость, описание («как получить» или дата получения), награда в чипах. */
function AchievementSheet({ def, gotAt, onClose }: { def: AchievementDef | null; gotAt: number | undefined; onClose: () => void }) {
  const { t, l } = useT();
  // Пока шторка закрывается (анимация выхода), содержимое не пропадает: помним последнее достижение.
  const [last, setLast] = useState<AchievementDef | null>(null);
  if (def && def !== last) setLast(def);
  const shown = def ?? last;
  const got = typeof gotAt === "number" && gotAt > 0;

  return (
    <Modal open={!!def} onClose={onClose} label={shown ? l(shown.title) : undefined}>
      {shown && (
        <div className="flex flex-col items-center gap-3 text-center">
          <AchievementBadge icon={shown.icon} rarity={shown.rarity} got={got} size={88} />
          <h3 className="text-balance text-xl font-extrabold leading-tight">{l(shown.title)}</h3>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-0.5 text-xs font-extrabold", RARITY_SOFT[shown.rarity], RARITY_BORDER[shown.rarity])}>
            {t(KIND_KEY[shown.rarity])}
          </span>
          <div className="w-full rounded-2xl bg-surface-2 p-3">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
              {got ? t("gamify.sheet.gotOn", { date: formatDate(todayKey(new Date(gotAt))) }) : t("gamify.sheet.howTo")}
            </p>
            <p className="mt-1 font-bold">{l(shown.description)}</p>
          </div>
          <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-gold bg-gold-soft px-3.5 py-1.5 font-extrabold text-warning-strong">
            <span className="text-xs uppercase tracking-wide">{t("gamify.sheet.reward")}</span>
            <Cpu size={16} className="text-gold" aria-hidden />
            {t("gamify.chips", { n: ACHIEVEMENT_CHIPS[shown.rarity] })}
          </p>
          <Button variant="secondary" block onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      )}
    </Modal>
  );
}
