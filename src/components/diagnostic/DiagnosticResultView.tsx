"use client";

import { CircleCheck, Play } from "lucide-react";
import { useRef } from "react";
import { entTopicById } from "@/content/ent-topics";
import { DIAGNOSTIC_MARGIN, forecastFromDiagnostic } from "@/lib/forecast";
import { topicStartHref, type DiagnosticResult, type ReadyLesson } from "@/lib/diagnostic";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MascotSays } from "@/components/mascot/Mascot";
import { Pill } from "@/components/ui/Pill";

/** Шкала 0–50: диапазон прогноза и точка «примерно». Цвет — primary (прогноз). */
function RangeScale({ low, high, score, label }: { low: number; high: number; score: number; label: string }) {
  const pct = (v: number) => `${(Math.max(0, Math.min(50, v)) / 50) * 100}%`;
  return (
    <div role="img" aria-label={label} className="mt-4">
      <div className="relative h-4">
        <div className="absolute inset-0 rounded-full bg-surface-2" />
        <div className="absolute inset-y-0 rounded-full bg-primary/25" style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }} />
        <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-primary" style={{ left: pct(score) }} />
      </div>
      <div className="mt-1 flex justify-between text-xs font-bold text-muted" aria-hidden="true">
        <span>0</span>
        <span>25</span>
        <span>50</span>
      </div>
    </div>
  );
}

/**
 * Итог диагностики: предварительный прогноз диапазоном, до трёх слабых тем с кнопкой «Начать с неё»,
 * сообщение про пропуск раздела «Старт». ИИ не используется. Кнопку «Дальше» рисует экран.
 * `fromOnboarding` — после онбординга «Начать с неё» идёт через окно тарифов (как «Дальше»): показ тарифов считается
 * один раз как «онбординг», а выбранная тема открывается после окна (`next`).
 */
export function DiagnosticResultView({ result, ready, fromOnboarding = false }: { result: DiagnosticResult; ready: ReadyLesson[]; fromOnboarding?: boolean }) {
  const { t, l } = useT();
  const lessons = useApp((s) => s.lessons);
  const forecast = forecastFromDiagnostic(result.summary);
  /** Показ тарифов отмечаем один раз, даже при двойном нажатии. */
  const paywallNoted = useRef(false);
  const notePaywall = () => {
    if (paywallNoted.current) return;
    paywallNoted.current = true;
    useApp.getState().notePaywallShown();
  };
  // Раздел «Старт» можно пропустить — его уроки в «Начать с неё» не предлагаем.
  const lessonsForLinks = result.skipBasics ? ready.filter((x) => x.unit !== "u0") : ready;

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <MascotSays mood="happy" size={88}>
        <span className="block font-extrabold">{t("diag.result.title")}</span>
        <span className="text-muted">{t("diag.result.sub")}</span>
      </MascotSays>

      {forecast && (
        <Card>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("diag.forecast.title")}</p>
          <p className="mt-1 text-3xl font-extrabold leading-tight text-primary">{t("diag.forecast.range", { low: forecast.low, high: forecast.high })}</p>
          <p className="text-sm font-bold text-muted">{t("diag.score", { points: result.summary.points, max: result.summary.max })}</p>
          <RangeScale low={forecast.low} high={forecast.high} score={forecast.score} label={t("diag.forecast.aria", { low: forecast.low, high: forecast.high })} />
          <p className="mt-3 text-xs font-semibold text-muted">{t("diag.forecast.note", { n: DIAGNOSTIC_MARGIN })}</p>
        </Card>
      )}

      <section aria-labelledby="diag-weak" className="flex flex-col gap-3">
        <div>
          <h2 id="diag-weak" className="text-lg font-extrabold">
            {t("diag.weak.title")}
          </h2>
          {result.weakTopics.length > 0 && <p className="text-sm font-semibold text-muted">{t("diag.weak.lead")}</p>}
        </div>
        {result.weakTopics.length === 0 ? (
          <Pill tone="success" icon={<CircleCheck size={14} aria-hidden />} className="self-start px-3 py-1 text-sm">
            {t("diag.weak.none")}
          </Pill>
        ) : (
          <ul className="flex flex-col gap-3">
            {result.weakTopics.map((topic) => {
              const score = result.summary.byTopic[topic];
              return (
                <li key={topic} className="flex flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-extrabold leading-snug">{l(entTopicById(topic).title)}</p>
                    {score && (
                      <Pill tone="danger" className="shrink-0">
                        {t("diag.weak.score", { points: score.points, max: score.max })}
                      </Pill>
                    )}
                  </div>
                  <ButtonLink
                    href={fromOnboarding ? `/plans?from=onboarding&next=${encodeURIComponent(topicStartHref(topic, lessonsForLinks, lessons))}` : topicStartHref(topic, lessonsForLinks, lessons)}
                    onClick={fromOnboarding ? notePaywall : undefined}
                    variant="secondary"
                    size="md"
                    block
                    icon={<Play size={16} fill="currentColor" aria-hidden />}
                  >
                    {t("diag.weak.start")}
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {result.skipBasics && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-success/40 bg-success-soft p-3.5 text-success-strong">
          <CircleCheck size={22} className="mt-0.5 shrink-0" aria-hidden />
          <p className="text-sm font-bold">{t("diag.basics.hidden")}</p>
        </div>
      )}
    </div>
  );
}
