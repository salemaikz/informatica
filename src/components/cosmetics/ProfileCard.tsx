"use client";

import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { COSMETIC_SLOTS, type CosmeticEquipped, type CosmeticId, type CosmeticSlot } from "@/lib/cosmetics";
import { levelTitle } from "@/lib/gamification";
import { useLevel } from "@/lib/hooks";
import { LevelBadge } from "@/components/app/LevelBadge";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Avatar } from "@/components/app/Avatar";
import { AvatarFrame } from "./AvatarFrame";
import { ProfileBanner } from "./ProfileBanner";
import { TitleTag } from "./TitleTag";

/** Что показать вместо надетого (примерка): слот → украшение или null («без»); слот, которого нет в объекте, — как надето. */
export type ProfilePreview = Partial<Record<CosmeticSlot, CosmeticId | null>>;

/**
 * Карточка профиля: фон-полоса, аватар с рамкой (налезает на полосу), имя, титул и уровень.
 * Уровень показан так же, как на странице профиля (число в синем квадрате и название) — бейдж ступени подставит главная модель.
 * `preview` — примерка: показывает выбранное украшение вместо надетого, ничего не меняя в сторе.
 * `onEditAvatar` — кнопка-карандаш на аватаре; `nameEditor` — вместо имени (форма изменения имени); `children` — под именем.
 * `tour` ставит метку `data-tour="profile-card"` для проводника (нужна только на странице профиля).
 */
export function ProfileCard({
  preview,
  tour,
  onEditAvatar,
  nameEditor,
  children,
  className,
}: {
  preview?: ProfilePreview;
  tour?: boolean;
  onEditAvatar?: () => void;
  nameEditor?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { t, l } = useT();
  const name = useApp((s) => s.profile.name);
  const avatar = useApp((s) => s.profile.avatar);
  const equipped = useApp((s) => s.cosmetics.equipped);
  const { level } = useLevel();

  const shown = { ...equipped } as CosmeticEquipped;
  for (const slot of COSMETIC_SLOTS) if (preview && slot in preview) shown[slot] = preview[slot] ?? null;

  return (
    <section aria-label={t("cosmetics.card.aria")} data-tour={tour ? "profile-card" : undefined} className={cn("overflow-hidden rounded-3xl border-2 border-border bg-surface", className)}>
      <ProfileBanner banner={shown.banner} className="h-24 sm:h-28" />
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="-mt-12 flex items-end justify-between gap-3">
          <div className="relative shrink-0">
            <AvatarFrame frame={shown.frame} size={76} reserve>
              <Avatar config={avatar} name={name} size={76} />
            </AvatarFrame>
            {onEditAvatar && (
              <button
                type="button"
                onClick={onEditAvatar}
                aria-label={t("prof2.avatar.edit")}
                className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface bg-primary text-white shadow transition-transform active:scale-95"
              >
                <Pencil size={16} />
              </button>
            )}
          </div>
          <div className="-mb-1 flex min-w-0 items-center gap-2.5">
            <LevelBadge level={level} size="md" className="shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("stats.level")}</p>
              {/* Звание не обрезаем: «Жаңадан бастаушы» (~158 px) не влезает в ~130 px рядом с аватаром — переносится на вторую строку. */}
              <p className="break-words font-extrabold">{l(levelTitle(level))}</p>
            </div>
          </div>
        </div>
        <div className="mt-2.5 flex min-w-0 flex-col items-start gap-2">
          {nameEditor ?? <p className="max-w-full break-words text-2xl font-extrabold leading-tight">{name || "—"}</p>}
          <TitleTag title={shown.title} />
          {children}
        </div>
      </div>
    </section>
  );
}
