"use client";

import { ChevronRight, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";

/** Строка-ссылка «Отзывы и предложения» (для «Профиля»): карточка с иконкой и стрелкой, касание не меньше 44 px. */
export function FeedbackLink({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <Link
      href="/feedback"
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-3xl border-2 border-border bg-surface px-4 py-2 transition-colors hover:bg-surface-2",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    >
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <MessageSquare size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold leading-tight">{t("feedback.link")}</span>
        <span className="block text-sm font-semibold text-muted">{t("feedback.link.hint")}</span>
      </span>
      <ChevronRight size={20} aria-hidden className="shrink-0 text-muted" />
    </Link>
  );
}
