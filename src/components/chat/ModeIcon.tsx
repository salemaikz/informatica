import { BookOpen, GraduationCap, ListChecks, MessageCircle, ScanSearch, Target, type LucideIcon } from "lucide-react";
import type { ChatMode } from "@/lib/chats";
import { cn } from "@/lib/cn";

const ICONS: Record<ChatMode, LucideIcon> = {
  free: MessageCircle,
  explain: GraduationCap,
  tasks: ListChecks,
  check: ScanSearch,
  ent: Target,
};

/** Иконка режима чата (фиолетовая гамма ИИ). lesson — чат по теме урока теории: книга вместо режима. */
export function ModeIcon({ mode, size = 20, className, lesson }: { mode: ChatMode; size?: number; className?: string; lesson?: boolean }) {
  const Icon = lesson ? BookOpen : ICONS[mode];
  return <Icon size={size} className={cn("shrink-0", className)} aria-hidden />;
}

/** Круглая плашка с иконкой режима. */
export function ModeBadge({ mode, size = 44, className, lesson }: { mode: ChatMode; size?: number; className?: string; lesson?: boolean }) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-2xl bg-ai-soft text-ai", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <ModeIcon mode={mode} size={Math.round(size * 0.5)} lesson={lesson} />
    </span>
  );
}
