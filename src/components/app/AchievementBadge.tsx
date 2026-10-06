import {
  Activity,
  Atom,
  Award,
  BadgeCheck,
  BookOpen,
  Brain,
  CalendarCheck,
  Camera,
  ChevronsUp,
  CircleCheckBig,
  ClipboardCheck,
  Crosshair,
  Crown,
  Dumbbell,
  Flame,
  Gamepad2,
  Gem,
  GraduationCap,
  Library,
  Lightbulb,
  Lock,
  Medal,
  Mountain,
  NotebookPen,
  Orbit,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Terminal,
  Trophy,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AchievementIcon } from "@/lib/gamification";
import type { Rarity } from "@/lib/rarity";
import { cn } from "@/lib/cn";
import { RARITY_BORDER, RARITY_SOFT, RARITY_TEXT } from "@/components/ui/rarity";

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
  target: Crosshair,
  notebook: NotebookPen,
  book: BookOpen,
  library: Library,
  medal: Medal,
  crown: Crown,
  mountain: Mountain,
  sun: Sun,
  shield: ShieldCheck,
  badge: BadgeCheck,
  clipboard: ClipboardCheck,
  award: Award,
  check: CircleCheckBig,
  chevrons: ChevronsUp,
  zap: Zap,
  rocket: Rocket,
  orbit: Orbit,
  wrench: Wrench,
  terminal: Terminal,
  lightbulb: Lightbulb,
  atom: Atom,
  activity: Activity,
};

/**
 * Значок достижения (этап 16В): рисованная иконка в круге цвета редкости — мягкий фон и кольцо; у легендарных ещё и свечение.
 * Не полученное — серое, с замком в углу (`got={false}`).
 */
export function AchievementBadge({ icon, rarity, got = true, size = 48, className }: { icon: AchievementIcon; rarity: Rarity; got?: boolean; size?: number; className?: string }) {
  const Icon = ICONS[icon];
  const ring = size >= 64 ? 3 : 2;
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border-solid",
        // Полученный обычный — иконка цвета текста (читается как награда, а не как серая заглушка); закрытые — бледнее.
        got ? [RARITY_SOFT[rarity], RARITY_BORDER[rarity], rarity === "common" ? "text-text" : RARITY_TEXT[rarity]] : "border-border bg-surface-2 text-muted opacity-60",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderWidth: ring,
        ...(got && rarity === "legendary" ? { boxShadow: "0 0 12px color-mix(in srgb, var(--rarity-legendary) 55%, transparent)" } : {}),
      }}
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={2.4} className={got ? undefined : "opacity-45"} />
      {!got && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-surface bg-surface-2 text-muted"
          style={{ width: Math.max(16, Math.round(size * 0.36)), height: Math.max(16, Math.round(size * 0.36)) }}
        >
          <Lock size={Math.max(9, Math.round(size * 0.2))} strokeWidth={2.8} aria-hidden />
        </span>
      )}
    </span>
  );
}
