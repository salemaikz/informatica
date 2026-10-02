"use client";

import clsx from "clsx";
import { ChevronRight, Lock, MessageSquareText, NotebookPen } from "lucide-react";
import Link from "next/link";
import { UNITS } from "@/content/course";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";

export default function NotesPage() {
  const { t, l } = useT();
  const lessons = useApp((s) => s.lessons);
  const notes = useApp((s) => s.notes);
  const general = notes.general;
  const generalCount = (general?.saved.length ?? 0) + (general?.own.trim() ? 1 : 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">{t("notes.title")}</h1>
        <p className="font-semibold text-muted">{t("notes.subtitle")}</p>
      </div>

      <Link href="/notes/general" className="flex items-center gap-3 rounded-3xl border-2 border-ai/30 bg-ai-soft p-4 text-ai">
        <MessageSquareText size={26} />
        <div className="flex-1">
          <p className="font-extrabold">{t("notes.general")}</p>
          <p className="text-sm font-semibold opacity-80">{t("notes.generalDesc")}</p>
        </div>
        {generalCount > 0 && <span className="rounded-full bg-ai px-2.5 py-0.5 text-sm font-extrabold text-white">{generalCount}</span>}
        <ChevronRight size={20} />
      </Link>

      {UNITS.map((unit) => (
        <section key={unit.id}>
          <p className="mb-2 text-sm font-extrabold uppercase" style={{ color: unit.color }}>
            {l(unit.title)}
          </p>
          <ul className="flex flex-col gap-2">
            {unit.lessons.map((ref) => {
              const open = !!lessons[ref.id];
              const n = notes[ref.id];
              const extra = (n?.saved.length ?? 0) + (n?.own.trim() ? 1 : 0);
              return (
                <li key={ref.id}>
                  <Link
                    href={open ? `/notes/${ref.id}` : "#"}
                    aria-disabled={!open}
                    className={clsx(
                      "flex items-center gap-3 rounded-2xl border-2 px-4 py-3 font-bold",
                      open ? "border-border bg-surface hover:bg-surface-2" : "pointer-events-none border-dashed border-border text-muted",
                    )}
                  >
                    {open ? <NotebookPen size={20} style={{ color: unit.color }} /> : <Lock size={18} />}
                    <span className="flex-1">{l(ref.title)}</span>
                    {open && extra > 0 && <span className="rounded-full bg-surface-2 px-2 text-xs font-extrabold text-muted">+{extra}</span>}
                    {open ? <ChevronRight size={18} className="text-muted" /> : <span className="text-xs">{ref.status === "soon" ? t("common.soon") : ""}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
