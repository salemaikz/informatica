"use client";

import { Flame, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { ENT_TOPICS } from "@/content/ent-topics";
import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/date";
import { parseReport, type ReportData, type ReportPeriod } from "@/lib/report";
import { dataFromHash, unpackData } from "@/lib/share-link";
import { useApp } from "@/lib/store";
import type { Lang } from "@/lib/types";
import { dict, type DictKey } from "@/i18n/dict";
import { fmt } from "@/lib/text";
import { Mascot } from "@/components/mascot/Mascot";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useHash } from "./useHash";

type Loaded = { key: string; report: ReportData | null };

/** Цвет полосы по освоению: слабо / в процессе / освоено (семантика проекта). */
const barColor = (pct: number) => (pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warning)" : "var(--danger)");

/** Публичный отчёт: только чтение; язык переключается тут же и ни на что не влияет в приложении. */
export function ReportView() {
  const hash = useHash();
  const packed = dataFromHash(hash);
  const deviceLang = useApp((s) => s.profile.lang);
  const [pick, setPick] = useState<Lang | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!packed) return;
    let alive = true;
    void unpackData(packed).then((raw) => {
      if (alive) setLoaded({ key: packed, report: parseReport(raw) });
    });
    return () => {
      alive = false;
    };
  }, [packed]);

  const current = loaded && loaded.key === packed ? loaded : null;
  const r = current?.report ?? null;
  // Выбор на странице → язык ученика из отчёта → язык этого устройства.
  const lang = pick ?? r?.lang ?? deviceLang;
  const t = (key: DictKey, params?: Record<string, string | number>) => fmt(dict[key][lang], params);

  return (
    <main lang={lang} className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Mascot mood="happy" size={56} />
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight">{t("links.rep.title")}</h1>
            <p className="text-sm font-semibold text-muted">{t("links.rep.about")}</p>
          </div>
        </div>
      </div>
      <LangSwitch label={t("links.rep.lang")} value={lang} onChange={setPick} />

      {!packed && <Warn>{t("links.rep.empty")}</Warn>}
      {packed && !current && <p className="text-center font-semibold text-muted">…</p>}
      {current && !r && <Warn>{t("links.rep.bad")}</Warn>}

      {r && <Body r={r} lang={lang} t={t} />}

      <p className="text-center text-xs font-semibold text-muted">{t("links.rep.footer")}</p>
      <ButtonLink href="/" variant="secondary" block>
        {t("links.rep.open")}
      </ButtonLink>
    </main>
  );
}

/** Свой переключатель языка: крупные кнопки (≥ 44 px), меняет только язык отчёта. */
function LangSwitch({ label, value, onChange }: { label: string; value: Lang; onChange: (v: Lang) => void }) {
  const options: { id: Lang; label: string; lang: Lang }[] = [
    { id: "kk", label: "Қазақша", lang: "kk" },
    { id: "ru", label: "Русский", lang: "ru" },
  ];
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          lang={o.lang}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            "min-h-11 rounded-xl border-2 px-3.5 py-2 text-sm font-bold transition-colors",
            value === o.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type TFn = (key: DictKey, params?: Record<string, string | number>) => string;

function Warn({ children }: { children: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-2xl bg-warning-soft px-4 py-3 font-bold">
      <TriangleAlert size={20} aria-hidden className="mt-0.5 shrink-0 text-warning-strong" />
      {children}
    </p>
  );
}

function Body({ r, lang, t }: { r: ReportData; lang: Lang; t: TFn }) {
  const f = r.forecast;
  const name = r.name || t("links.rep.anon");
  return (
    <>
      <Card>
        <p className="break-words text-2xl font-extrabold leading-tight">{name}</p>
        <p className="mt-1 text-sm font-semibold text-muted">{t("links.rep.asof", { date: shortDate(new Date(r.at), lang) })}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-streak-soft p-3">
            <p className="flex items-center gap-1.5 text-3xl font-extrabold">
              <Flame size={26} aria-hidden className="text-streak" />
              {r.streak}
            </p>
            <p className="mt-1 text-sm font-extrabold">{t("links.rep.streak")}</p>
            <p className="text-xs font-semibold text-muted">{t("links.rep.streak.hint")}</p>
          </div>
          <div className="rounded-2xl bg-gold-soft p-3">
            <p className="flex items-center gap-1.5 text-3xl font-extrabold">
              <Sparkles size={26} aria-hidden className="text-gold" />
              {r.xp}
            </p>
            <p className="mt-1 text-sm font-extrabold">{t("links.rep.xp")}</p>
            <p className="text-xs font-semibold text-muted">{t("links.rep.xp.hint")}</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Period title={t("links.rep.week")} p={r.days.d7} of={7} t={t} />
          <Period title={t("links.rep.month")} p={r.days.d30} of={30} t={t} />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">{t("links.rep.forecast")}</h2>
        {f.basis === "none" ? (
          <p className="mt-2 font-semibold text-muted">{t("links.rep.forecast.none")}</p>
        ) : (
          <>
            <p className="mt-1 text-4xl font-extrabold text-primary">{t("links.rep.forecast.value", { n: f.score })}</p>
            <p className="font-bold">{t("links.rep.forecast.range", { low: f.low, high: f.high })}</p>
            <p className="mt-2 text-sm font-semibold text-muted">{t("links.rep.forecast.note")}</p>
          </>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">{t("links.rep.topics")}</h2>
        {f.basis === "none" ? (
          <p className="mt-2 font-semibold text-muted">{t("links.rep.topics.none")}</p>
        ) : (
          <>
            <p className="mb-3 text-sm font-semibold text-muted">{t("links.rep.topics.hint")}</p>
            <ul className="flex flex-col gap-3">
              {ENT_TOPICS.map((tp, i) => {
                const pct = Math.round(r.topics[i]);
                return (
                  <li key={tp.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm font-bold">
                      <span className="min-w-0">{tp.title[lang]}</span>
                      <span className={cn("shrink-0", pct >= 80 ? "text-success-strong" : pct >= 60 ? "text-warning-strong" : "text-danger")}>{pct}%</span>
                    </div>
                    <ProgressBar value={pct / 100} color={barColor(pct)} label={`${tp.title[lang]}: ${pct}%`} className="mt-1" />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">{t("links.rep.exams")}</h2>
        {r.exams.length === 0 ? (
          <p className="mt-2 font-semibold text-muted">{t("links.rep.exams.none")}</p>
        ) : (
          <ul className="mt-2 divide-y-2 divide-border">
            {r.exams.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block font-bold">{t(`links.rep.kind.${e.kind}` as DictKey)}</span>
                  <span className="text-sm font-semibold text-muted">{shortDate(new Date(e.at), lang)}</span>
                </span>
                <span className="shrink-0 text-lg font-extrabold">{t("links.rep.exam.points", { p: e.points, m: e.max })}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Без данных «слабых тем нет» вводило бы в заблуждение — карточку не показываем. */}
      {f.basis !== "none" && (
        <Card>
          <h2 className="text-lg font-extrabold">{t("links.rep.weak")}</h2>
          {r.weak.length === 0 ? (
            <p className="mt-2 font-semibold text-muted">{t("links.rep.weak.none")}</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {r.weak.map((id) => (
                <li key={id} className="rounded-xl bg-danger-soft px-3 py-1.5 text-sm font-bold text-danger">
                  {ENT_TOPICS.find((x) => x.id === id)?.title[lang]}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

function Period({ title, p, of, t }: { title: string; p: ReportPeriod; of: number; t: TFn }) {
  return (
    <div>
      <h2 className="font-extrabold">{title}</h2>
      <p className="mt-1 text-sm font-bold">{t("links.rep.active", { n: p.active, of })}</p>
      <p className="text-sm font-bold">{t("links.rep.lessons", { n: p.lessons })}</p>
    </div>
  );
}
