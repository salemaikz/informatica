import { Brain, CalendarCheck, Camera, Dumbbell, Flame, Gamepad2, Gem, GraduationCap, Sparkles, Star, Trophy, type LucideIcon } from "lucide-react";
import type { AchievementIcon } from "@/lib/gamification";
import { cn } from "@/lib/cn";

const ICONS: Record<AchievementIcon, LucideIcon> = {
  graduation: GraduationCap,
  gem: Gem,
  flame: Flame,
  calendar: CalendarCheck,
  trophy: Trophy,
  star: Star,
  sparkles: Sparkles,
  camera: Camera,
  dumbbell: Dumbbell,
  gamepad: Gamepad2,
  brain: Brain,
};

/** Значок достижения: рисованная иконка в золотом круге (серый — пока не получено). */
export function AchievementBadge({ icon, got = true, size = 48 }: { icon: AchievementIcon; got?: boolean; size?: number }) {
  const Icon = ICONS[icon];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-b-4",
        got ? "border-warning-strong/60 bg-gold text-white" : "border-border bg-surface-2 text-muted",
      )}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2.4} />
    </span>
  );
}
