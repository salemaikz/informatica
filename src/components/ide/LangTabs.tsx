"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { IDE_LANGS, type IdeLang } from "@/lib/ide/types";
import { useT } from "@/i18n/useT";
import { LangIcon } from "./LangIcon";
import { IDE_REGISTRY } from "./registry";

/** Вкладки языков практикума: на телефоне прокручиваются по горизонтали. */
export function LangTabs({ active }: { active: IdeLang }) {
  const { t, l } = useT();
  return (
    <nav aria-label={t("ide.tabs.aria")} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex min-w-max gap-2">
        {IDE_LANGS.map((id) => {
          const info = IDE_REGISTRY[id];
          const on = id === active;
          return (
            <li key={id}>
              <Link
                href={`/code/${id}`}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-2xl border-2 px-3.5 font-extrabold transition-colors",
                  on ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                <LangIcon name={info.icon} size={18} />
                {l(info.title)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
