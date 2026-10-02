import { PHOTO_PREFIX, avatarInitial } from "@/lib/avatar";
import { cn } from "@/lib/cn";
import type { AvatarColor, AvatarConfig } from "@/lib/types";
import { findPreset } from "./avatars/presets";

// Статические классы (Tailwind не видит собранные на лету): цвет круга-инициала → токены темы.
const COLOR_CLASS: Record<AvatarColor, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  ai: "bg-ai-soft text-ai",
  gold: "bg-gold-soft text-gold",
  streak: "bg-streak-soft text-streak",
};

export function avatarColorClass(color: AvatarColor): string {
  return COLOR_CLASS[color] ?? COLOR_CLASS.primary;
}

/**
 * Круглый аватар: буква имени на цветном фоне, рисованный аватар из набора или своё фото.
 * Неизвестный preset, битое фото или отсутствующая конфигурация (старое сохранение) → буква на primary.
 */
export function Avatar({
  config,
  name,
  size = 36,
  className,
}: {
  config: AvatarConfig | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const base = cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", className);
  const box = { width: size, height: size };

  // Только свой JPEG dataURL: внешний адрес в src выдал бы IP ученика чужому серверу.
  if (config?.kind === "photo" && typeof config.data === "string" && config.data.startsWith(PHOTO_PREFIX)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data:-URL из localStorage, next/image не нужен
      <img src={config.data} alt="" width={size} height={size} draggable={false} className={cn(base, "object-cover")} style={box} />
    );
  }

  if (config?.kind === "preset") {
    const preset = findPreset(config.id);
    if (preset) {
      return (
        <span className={base} style={box} aria-hidden="true">
          <preset.Component size={size} />
        </span>
      );
    }
  }

  const color: AvatarColor = config?.kind === "initial" ? config.color : "primary";
  return (
    <span className={cn(base, "font-extrabold leading-none", avatarColorClass(color))} style={{ ...box, fontSize: size * 0.42 }} aria-hidden="true">
      {avatarInitial(name)}
    </span>
  );
}
