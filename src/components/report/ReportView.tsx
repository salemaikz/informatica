"use client";

import { BookOpenCheck, Flame, GraduationCap, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ENT_TOPICS } from "@/content/ent-topics";
import { dict, type DictKey } from "@/i18n/dict";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/date";
import { dataFromHash, unpackData } from "@/lib/hash-pack";
import { parseParentReport, type ParentReport, type ReportEnt } from "@/lib/parent-report";
import { useApp } from "@/lib/store";
import { fmt } from "@/lib/text";
import type { Lang } from "@/lib/types";
import { Mascot } from "@/components/mascot/Mascot";
import { toneOfRatio, TONE_TEXT, LEVEL_COLOR } from "@/components/progress/format";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useHash } from "./useHash";

type Loaded = { key: string; report: ParentReport | null };
type TFn = (key: DictKey, params?: Record<string, string | number>) => string;

/** Цвет полосы по освоению (семантика проекта): ≥ 80% освоено, ≥ 50% в процессе, иначе слабо. */
const BAR = { success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)" } as const;

/**
 * Публичный отчёт (#74): только чтение. Данные — во фрагменте адреса, на сервер не уходят.
 * Язык: выбор на странице → язык из отчёта → язык устройства; на приложение выбор не влияет.
 */
export function ReportView() {
  const hash = useHash();
  const packed = dataFromHash(hash);
  const deviceLang = useApp((s) => s.profile.lang);
  const [pick, setPick] = useState<Lang | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const opened = useRef<string | null>(null);

  useEffect(() => {
    if (!packed) return;
    let alive = true;
    void unpackData(packed).then((raw) => {
      if (!alive) return;
      const report = parseParentReport(raw);
      setLoaded({ key: packed, report });
      // «Открыли отчёт» — один раз на ссылку и только при удачном разборе (#69).
      if (report && opened.current !== packed) {
        opened.current = packed;
        track({ e: "share_open", what: "report" });
      }
    });
    return () => {
      alive = false;
    };
  }, [packed]);

  const current = loaded && loaded.key === packed ? loaded : null;
  const r = current?.report ?? null;
  const lang: Lang = pick ?? r?.lang ?? deviceLang;
  const t: TFn = (key, params) => fmt(dict[key][lang], params);

  return (
    <main lang={lang} className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-3">
        <Mascot mood="happy" size={56} />
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-tight">{t("report.title")}</h1>
          <p className="text-sm font-semibold text-muted">{r?.track === "school" ? t("report.about.school") : t("report.about.ent")}</p>
        </div>
      </div>
      <LangSwitch label={t("report.lang")} value={lang} onChange={setPick} />

      {!packed && <Warn title={t("report.bad.title")}>{t("report.empty")}</Warn>}
      {packed && !current && (
        <p role="status" className="text-center font-semibold text-muted">
          {t("report.loading")}
        </p>
      )}
      {current && !r && <Warn title={t("report.bad.title")}>{t("report.bad")}</Warn>}

      {r && <Body r={r} lang={lang} t={t} />}

      {r && (
        <p className="text-center text-xs font-semibold text-muted">
          <span className="block">{t("report.asof", { date: shortDate(new Date(r.at), lang) })}</span>
          <span className="block">{t("report.footer")}</span>
        </p>
      )}
      <ButtonLink href="/" variant="secondary" block>
        {t("report.open")}
      </ButtonLink>
    </main>
  );
}

/** Свой переключатель языка: крупные кнопки (≥ 44 px), меняет только язык отчёта. */
function LangSwitch({ label, value, onChange }: { label: string; value: Lang; onChange: (v: Lang) => void }) {
  const options: { id: Lang; label: string }[] = [
    { id: "kk", label: "Қазақша" },
    { id: "ru", label: "Русский" },
  ];
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          lang={o.id}
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

function Warn({ title, children }: { title: string; children: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl bg-warning-soft px-4 py-3">
      <TriangleAlert size={22} aria-hidden className="mt-0.5 shrink-0 text-warning-strong" />
      <div>
        <p className="font-extrabold">{title}</p>
        <p className="font-semibold">{children}</p>
      </div>
    </div>
  );
}

function Body({ r, lang, t }: { r: ParentReport; lang: Lang; t: TFn }) {
  const courseTitle = r.course.grade ? t("report.course.class", { g: r.course.grade }) : t("report.course.ent");
  const CourseIcon = r.course.grade ? GraduationCap : BookOpenCheck;
  return (
    <>
      <Card>
        <p className="break-words text-2xl font-extrabold leading-tight">{r.name || t("report.anon")}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-streak-soft p-3">
            <p className="flex items-center gap-1.5 text-3xl font-extrabold">
              <Flame size={26} aria-hidden className="text-streak" />
              {r.streak.cur}
            </p>
            <p className="mt-1 text-sm font-extrabold">{t("report.streak")}</p>
            <p className="text-xs font-semibold text-muted">{t("report.streak.best", { n: r.streak.best })}</p>
          </div>
          <div className="rounded-2xl bg-gold-soft p-3">
            <p className="flex items-center gap-1.5 text-3xl font-extrabold">
              <Sparkles size={26} aria-hidden className="text-gold" />
              {r.xp}
            </p>
            <p className="mt-1 text-sm font-extrabold">{t("report.xp")}</p>
            <p className="text-xs font-semibold text-muted">{t("report.xp.hint")}</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <h2 className="font-extrabold">{t("report.week")}</h2>
            <p className="mt-1 text-sm font-bold">{t("report.active", { n: r.d7.active, of: 7 })}</p>
            <p className="text-sm font-bold">{t("report.lessons", { n: r.d7.lessons })}</p>
            <p className="text-sm font-bold">{t("report.time", { n: r.d7.min })}</p>
            <p className={cn("text-sm font-bold", r.d7.acc === null && "text-muted")}>
              {r.d7.acc === null ? t("report.acc.none") : t("report.acc", { p: r.d7.acc })}
            </p>
          </div>
          <div>
            <h2 className="font-extrabold">{t("report.month")}</h2>
            <p className="mt-1 text-sm font-bold">{t("report.active", { n: r.d30.active, of: 30 })}</p>
            <p className="text-sm font-bold">{t("report.lessons", { n: r.d30.lessons })}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">{t("report.course.title")}</h2>
        <p className="mt-2 flex items-center gap-1.5 font-bold">
          <CourseIcon size={20} aria-hidden className="shrink-0 text-primary" />
          <span className="min-w-0">{courseTitle}</span>
        </p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="text-4xl font-extrabold text-primary">{t("report.course.pct", { p: r.course.pct })}</p>
          <p className="text-sm font-bold text-muted">{t("report.course.lessons", { done: r.course.done, total: r.course.total })}</p>
        </div>
        <ProgressBar value={r.course.pct / 100} color="var(--primary)" label={`${courseTitle}: ${r.course.pct}%`} className="mt-2" />
      </Card>

      {r.ent && <EntBlocks ent={r.ent} lang={lang} t={t} />}
    </>
  );
}

function EntBlocks({ ent, lang, t }: { ent: ReportEnt; lang: Lang; t: TFn }) {
  const f = ent.forecast;
  return (
    <>
      <Card>
        <h2 className="text-lg font-extrabold">{t("report.forecast")}</h2>
        {!f ? (
          <p className="mt-2 font-semibold text-muted">{t("report.forecast.none")}</p>
        ) : (
          <>
            <p className="mt-1 text-4xl font-extrabold text-primary">{t("report.forecast.value", { n: f.score })}</p>
            <p className="font-bold">{t("report.forecast.range", { low: f.low, high: f.high })}</p>
            <p className="mt-2 text-sm font-semibold text-muted">{f.basis === "diagnostic" ? t("report.forecast.prelim") : t("report.forecast.note")}</p>
          </>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">{t("report.topics")}</h2>
        {!f ? (
          <p className="mt-2 font-semibold text-muted">{t("report.topics.none")}</p>
        ) : (
          <>
            <p className="mb-3 text-sm font-semibold text-muted">{t("report.topics.hint")}</p>
            <ul className="flex flex-col gap-3">
              {ENT_TOPICS.map((tp, i) => {
                const pct = ent.topics[i] ?? 0;
                const tone = toneOfRatio(pct / 100);
                return (
                  <li key={tp.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm font-bold">
                      <span className="min-w-0">{tp.title[lang]}</span>
                      <span className={cn("shrink-0 tabular-nums", pct > 0 ? TONE_TEXT[tone] : "text-muted")}>{pct}%</span>
                    </div>
                    <ProgressBar value={pct / 100} color={pct > 0 ? BAR[tone] : LEVEL_COLOR.none} label={`${tp.title[lang]}: ${pct}%`} className="mt-1" />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">{t("report.exams")}</h2>
        {ent.exams.length === 0 ? (
          <p className="mt-2 font-semibold text-muted">{t("report.exams.none")}</p>
        ) : (
          <ul className="mt-2 divide-y-2 divide-border">
            {ent.exams.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block font-bold">{t(`report.kind.${e.kind}` as DictKey)}</span>
                  <span className="text-sm font-semibold text-muted">{shortDate(new Date(e.at), lang)}</span>
                </span>
                <span className="shrink-0 text-lg font-extrabold">{t("report.exam.points", { p: e.p, m: e.m })}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Без данных «слабых тем нет» вводило бы в заблуждение — карточку не показываем. */}
      {f && (
        <Card>
          <h2 className="text-lg font-extrabold">{t("report.weak")}</h2>
          {ent.weak.length === 0 ? (
            <p className="mt-2 font-semibold text-muted">{t("report.weak.none")}</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {ent.weak.map((id) => (
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
