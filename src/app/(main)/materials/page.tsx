"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { openCheatSheet } from "@/components/app/SectionTabs";
import { groupById } from "@/components/app/nav";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { PageTip } from "@/components/tour/PageTip";

const DESC: Record<string, DictKey> = {
  notes: "nav2.hub.notes",
  theory: "nav2.hub.theory",
  cheat: "nav2.hub.cheat",
  search: "nav2.hub.search",
};

/** Хаб группы «Материалы»: конспекты, теория, шпаргалка, поиск. Мини-игры живут в «Практике». */
export default function MaterialsPage() {
  const { t } = useT();
  const notesCount = useApp((s) => s.notebook.notes.length);
  const group = groupById("materials");

  return (
    <div className="flex flex-col gap-5">
      <PageTip id="page-materials" />
      <header>
        <h1 className="text-2xl font-extrabold">{t("nav2.materials")}</h1>
        <p className="mt-1 text-sm font-semibold text-muted">{t("nav2.hub.subtitle")}</p>
      </header>
      <div className="grid gap-3 min-[520px]:grid-cols-2">
        {group.subs.map((sub) => {
          const Icon = sub.icon;
          const className =
            "flex min-h-24 w-full items-center gap-4 rounded-3xl border-2 border-border bg-surface p-4 text-left transition-colors hover:bg-surface-2 active:translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";
          const body = (
            <>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Icon size={26} strokeWidth={2.4} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold">{t(sub.label)}</span>
                <span className="block text-sm font-semibold text-muted">
                  {sub.id === "notes" ? t("nav2.hub.notes", { n: notesCount }) : t(DESC[sub.id])}
                </span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
            </>
          );
          return sub.href ? (
            <Link key={sub.id} href={sub.href} className={className}>
              {body}
            </Link>
          ) : (
            <button key={sub.id} type="button" onClick={openCheatSheet} aria-haspopup="dialog" className={className}>
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}
