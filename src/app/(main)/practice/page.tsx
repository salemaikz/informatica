"use client";

import clsx from "clsx";
import { Brain, Braces, FileQuestion, Lock, RotateCcw, Timer, Trophy } from "lucide-react";
import Link from "next/link";
import { SKILLS } from "@/content/skills";
import { unlockedSkills } from "@/content/course";
import { useApp } from "@/lib/store";
import { masteryLevel } from "@/lib/mastery";
import { useT } from "@/i18n/useT";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { MASTERY_COLOR } from "@/components/lesson/Results";
import { GAMES } from "@/games/registry";

export default function PracticePage() {
  const { t, l } = useT();
  const skills = useApp((s) => s.skills);
  const lessons = useApp((s) => s.lessons);
  const mistakes = useApp((s) => s.mistakes);
  const games = useApp((s) => s.games);
  const unlocked = new Set(unlockedSkills(Object.keys(lessons)));
  const anyUnlocked = unlocked.size > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">{t("prac.title")}</h1>
        <p className="font-semibold text-muted">{t("prac.subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={anyUnlocked ? "/drill?mode=smart" : "/learn"}
          className="flex flex-col gap-2 rounded-3xl bg-action-primary p-5 text-white shadow-[0_5px_0_var(--primary-strong)] active:translate-y-1 active:shadow-none"
        >
          <Brain size={30} />
          <span className="text-lg font-extrabold">{t("prac.smart")}</span>
          <span className="text-sm font-semibold opacity-90">{anyUnlocked ? t("prac.smart.desc") : t("prac.locked")}</span>
        </Link>
        <Link
          href={mistakes.length ? "/drill?mode=mistakes" : "#"}
          aria-disabled={!mistakes.length}
          className={clsx(
            "flex flex-col gap-2 rounded-3xl p-5",
            mistakes.length
              ? "bg-action-danger text-white shadow-[0_5px_0_var(--danger-strong)] active:translate-y-1 active:shadow-none"
              : "pointer-events-none border-2 border-border bg-surface text-muted",
          )}
        >
          <RotateCcw size={30} />
          <span className="text-lg font-extrabold">{t("prac.mistakes")}</span>
          <span className="text-sm font-semibold opacity-90">
            {mistakes.length ? t("prac.mistakes.desc", { n: mistakes.length }) : t("prac.noMistakes")}
          </span>
        </Link>
      </div>

      {GAMES.length > 0 && (
        <section>
          <h2 className="text-lg font-extrabold">{t("games.title")}</h2>
          <p className="mb-3 text-sm font-semibold text-muted">{t("games.subtitle")}</p>
          <div className="grid grid-cols-2 gap-3">
            {GAMES.map((g) => {
              const open = g.skills.some((s) => unlocked.has(s));
              const best = games[g.id]?.best;
              return (
                <Link
                  key={g.id}
                  href={open ? `/game/${g.id}` : "#"}
                  aria-disabled={!open}
                  className={clsx(
                    "flex flex-col gap-2 rounded-3xl border-2 bg-surface p-3.5 transition-transform active:translate-y-0.5",
                    open ? "border-border hover:bg-surface-2" : "pointer-events-none border-dashed border-border opacity-60",
                  )}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: g.color, color: g.ink }}>
                    <g.icon size={26} strokeWidth={2.3} />
                  </span>
                  <span className="font-extrabold leading-tight">{l(g.title)}</span>
                  <span className="line-clamp-2 text-xs font-semibold text-muted">{l(g.description)}</span>
                  <span className="mt-auto flex items-center gap-1 text-xs font-extrabold text-warning-strong">
                    {open ? (
                      <>
                        <Trophy size={14} className="text-gold" /> {best ?? "—"}
                      </>
                    ) : (
                      <>
                        <Lock size={12} className="text-muted" /> <span className="text-muted">{t("games.locked")}</span>
                      </>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {[{ href: "/ent", title: "prac.ent", desc: "exam.format", Icon: Timer }, { href: "/context", title: "practice.context", desc: "practice.contextHint", Icon: FileQuestion }, { href: "/code-practice", title: "practice.code", desc: "practice.codeHint", Icon: Braces }, { href: "/assessment", title: "practice.section", desc: "practice.sectionHint", Icon: Trophy }].map(({ href, title, desc, Icon }) => <Link key={href} href={href} className="flex flex-col gap-2 rounded-3xl border-2 border-primary/25 bg-surface p-4 hover:bg-primary-soft"><Icon size={26} className="text-primary"/><h2 className="text-lg font-extrabold">{t(title as import('@/i18n/dict').DictKey)}</h2><p className="text-sm font-semibold text-muted">{t(desc as import('@/i18n/dict').DictKey)}</p><p className="mt-auto text-sm font-extrabold text-danger">{t('practice.heartCost')}</p></Link>)}
      </div>

      <Card>
        <p className="mb-3 text-lg font-extrabold">{t("prac.skills")}</p>
        <ul className="flex flex-col divide-y-2 divide-border">
          {SKILLS.map((sk) => {
            const st = skills[sk.id];
            const lvl = masteryLevel(st);
            const open = unlocked.has(sk.id);
            return (
              <li key={sk.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight">{l(sk.title)}</p>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: MASTERY_COLOR[lvl] }} />
                    {t(`mastery.${lvl}`)} {st ? `· ${Math.round(st.mastery * 100)}%` : ""}
                  </p>
                  <ProgressBar value={st?.mastery ?? 0} color={MASTERY_COLOR[lvl]} height={10} />
                </div>
                {open ? (
                  <Link
                    href={`/drill?mode=skill&skill=${encodeURIComponent(sk.id)}`}
                    className="shrink-0 rounded-xl border-2 border-primary/40 bg-primary-soft px-3 py-2 text-sm font-extrabold text-primary"
                  >
                    {t("prac.train")}
                  </Link>
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center text-muted" title={t("prac.locked")}>
                    <Lock size={18} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
