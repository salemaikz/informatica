"use client";

import { cn } from "@/lib/cn";
import { cosmeticDef, type CosmeticId } from "@/lib/cosmetics";
import { useApp } from "@/lib/store";
import { Avatar } from "@/components/app/Avatar";
import { AvatarFrame } from "./AvatarFrame";
import { ProfileBanner } from "./ProfileBanner";
import { TitleTag } from "./TitleTag";

/**
 * Превью украшения на СВОЁМ аватаре и имени ученика (карточка магазина, «Мои украшения», приз кейса):
 * рамка — вокруг аватара, фон — полоса с именем на плашке, титул — под именем. Блок всегда одной высоты
 * (md 112 px, lg 160 px), чтобы карточки в сетке выровнялись.
 */
export function CosmeticPreview({ id, size = "md", className }: { id: CosmeticId; size?: "md" | "lg"; className?: string }) {
  const name = useApp((s) => s.profile.name);
  const avatar = useApp((s) => s.profile.avatar);
  const def = cosmeticDef(id);
  if (!def) return null;
  const lg = size === "lg";
  const height = lg ? "h-40" : "h-28";

  if (def.slot === "banner") {
    return (
      <ProfileBanner banner={id} className={cn("w-full rounded-2xl", height, className)}>
        <span className="flex max-w-[88%] items-center gap-1.5 rounded-full bg-surface/90 py-1 pl-1 pr-3 shadow-sm">
          <Avatar config={avatar} name={name} size={lg ? 32 : 28} />
          <span className="truncate text-sm font-extrabold">{name || "—"}</span>
        </span>
      </ProfileBanner>
    );
  }

  if (def.slot === "frame") {
    const av = lg ? 88 : 56;
    return (
      <div className={cn("flex w-full items-center justify-center overflow-hidden rounded-2xl bg-surface-2", height, className)}>
        <AvatarFrame frame={id} size={av} full>
          <Avatar config={avatar} name={name} size={av} />
        </AvatarFrame>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-surface-2 px-2", lg ? "gap-1.5" : "gap-1", height, className)}>
      <Avatar config={avatar} name={name} size={lg ? 52 : 30} />
      <span className={cn("max-w-full truncate font-extrabold", lg ? "text-sm" : "text-[13px] leading-tight")}>{name || "—"}</span>
      <TitleTag title={id} size={lg ? "lg" : "sm"} />
    </div>
  );
}
