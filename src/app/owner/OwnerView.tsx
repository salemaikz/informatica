import type { ReactNode } from "react";
import { HARD_MIN_N, TOP_ROWS, type Count } from "@/lib/owner-report";
import { formatAt } from "@/lib/owner-rows";
import type { OwnerData } from "@/server/owner-data";
import { label } from "./labels";

// Сводка для владельца: простые таблицы, читаются с телефона (широкие прокручиваются внутри своей карточки).
// Серверный компонент: никакого состояния и обработчиков. Любой текст из данных — только как текст (React его экранирует).

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border-2 border-border bg-surface p-4">
      <h2 className="text-lg font-extrabold">{title}</h2>
      {hint && <p className="mb-2 text-sm font-semibold text-muted">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

const Empty = () => <p className="text-sm font-semibold text-muted">Пока нет данных.</p>;

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={`border-b-2 border-border pb-1.5 pr-3 text-xs font-extrabold text-muted ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const td = "border-b border-border py-1.5 pr-3 text-right font-bold tabular-nums";
const tdFirst = "border-b border-border py-1.5 pr-3 text-left font-semibold";

/** Список «название — число» из счётчиков. */
function Counts({ rows, name }: { rows: readonly Count[]; name: (key: string) => string }) {
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => (
        <li key={r.key} className="flex items-baseline justify-between gap-3 border-b border-border py-1 text-sm">
          <span className="min-w-0 break-words font-semibold">{name(r.key)}</span>
          <span className="shrink-0 font-extrabold tabular-nums">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

export function OwnerView({ data }: { data: OwnerData }) {
  const { report: r, retention: ret } = data;
  const funnelNote = `Топ-${TOP_ROWS} по стартам. «Дошли» — доля тех, кто закончил урок. «Чаще выходят» — шаг, на котором ушли до конца.`;

  return (
    <div className="flex flex-col gap-4">
      <Section title={`За ${data.period} дней`}>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
          <span>
            Событий: <b className="tabular-nums">{r.totals.events}</b>
          </span>
          <span>
            Стартов уроков: <b className="tabular-nums">{r.totals.lessonStarts}</b>
          </span>
          <span>
            Законченных: <b className="tabular-nums">{r.totals.lessonFinishes}</b>
          </span>
        </div>
      </Section>

      <Section title="По дням" hint="Сутки по Астане (UTC+5).">
        {r.totals.events === 0 ? (
          <Empty />
        ) : (
          <Table head={["День", "Событий", "Стартов", "Законченных"]}>
            {r.perDay.map((d) => (
              <tr key={d.day}>
                <td className={tdFirst}>{d.day}</td>
                <td className={td}>{d.events}</td>
                <td className={td}>{d.lessonStarts}</td>
                <td className={td}>{d.lessonFinishes}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="Воронка уроков" hint={funnelNote}>
        {r.funnel.length === 0 ? (
          <Empty />
        ) : (
          <Table head={["Урок", "Старты", "Продолж.", "Конец", "Дошли", "Точность", "Чаще выходят"]}>
            {r.funnel.map((f) => (
              <tr key={f.lesson}>
                <td className={`${tdFirst} max-w-56 whitespace-normal`}>
                  {f.title ?? f.lesson}
                  {f.title && <span className="block text-xs font-semibold text-muted">{f.lesson}</span>}
                </td>
                <td className={td}>{f.starts}</td>
                <td className={td}>{f.resumes}</td>
                <td className={td}>{f.finishes}</td>
                <td className={td}>{pct(f.reach)}</td>
                <td className={td}>{pct(f.avgAcc)}</td>
                <td className={td}>{f.quitStep !== null ? `шаг ${f.quitStep}${f.quitOf ? ` из ${f.quitOf}` : ""} (${f.quits})` : "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="Трудные задания" hint={`Первая попытка, не меньше ${HARD_MIN_N} ответов. «Неверно» — неверно или пропущено.`}>
        {r.hardTasks.length === 0 ? (
          <Empty />
        ) : (
          <Table head={["Задание", "Ответов", "Неверно", "С подсказкой"]}>
            {r.hardTasks.map((t) => (
              <tr key={t.step}>
                <td className={`${tdFirst} max-w-64 whitespace-normal`}>
                  {t.title ?? t.step}
                  <span className="block text-xs font-semibold text-muted">{t.lesson ? `${t.lesson} · ${t.step}` : t.step}</span>
                </td>
                <td className={td}>{t.n}</td>
                <td className={td}>{t.wrongPct}%</td>
                <td className={td}>{t.hintPct}%</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="Удержание" hint="По когортам за 60 дней: вернулись ровно через N дней после первого запуска. Неполный сегодняшний день не считается.">
        <p className="mb-2 text-sm font-semibold">
          Первых запусков: <b className="tabular-nums">{ret.starts}</b>
        </p>
        <Table head={["День", "Вернулись", "Из", "Доля"]}>
          {ret.rows.map((x) => (
            <tr key={x.d}>
              <td className={tdFirst}>D{x.d}</td>
              <td className={td}>{x.returned}</td>
              <td className={td}>{x.cohort}</td>
              <td className={td}>{pct(x.pct)}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Спрос" hint="Показ окна тарифов → клик по тарифу → пробный период. Оплаты пока нет — это проверка интереса.">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-muted">Показы окна тарифов: {r.demand.viewsTotal}</h3>
            <Counts rows={r.demand.views} name={label.from} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-muted">Клики по тарифам: {r.demand.clicksTotal}</h3>
            <Counts rows={r.demand.clicks} name={label.planClick} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-muted">Пробный период: {r.demand.trialsTotal}</h3>
            <Counts rows={r.demand.trials} name={label.from} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-muted">Клики по товарам за ₸: {r.demand.shopTotal}</h3>
            <Counts rows={r.demand.shop} name={(k) => k} />
          </div>
        </div>
      </Section>

      <Section title="Сердечки закончились">
        <Counts rows={r.heartsOut} name={label.heartsWhere} />
      </Section>

      <Section title="Онбординг" hint="Шаги — по числу дошедших; завершили — по выбранному треку.">
        <div className="flex flex-col gap-4">
          <Counts rows={r.onboarding.steps} name={(k) => k} />
          <div>
            <h3 className="text-sm font-extrabold text-muted">Завершили</h3>
            <Counts rows={r.onboarding.done} name={label.track} />
          </div>
        </div>
      </Section>

      <Section title="Входная диагностика">
        <Counts
          rows={[
            { key: "Прошли до конца", n: r.diagnostic.finished },
            { key: "Не дошли до конца (пропуск или выход)", n: r.diagnostic.notFinished },
          ]}
          name={(k) => k}
        />
      </Section>

      <Section title="«Что помешало?»" hint="Ответы после перерыва от 3 дней.">
        <Counts rows={r.breakReasons} name={label.breakReason} />
      </Section>

      <Section title="Отзывы по видам" hint="Сколько отправлено; тексты — ниже, в «Жалобах и отзывах».">
        <Counts rows={r.feedback} name={label.feedback} />
      </Section>

      <Section title="Игры, тренировка, пробники">
        {r.practice.games.length + r.practice.drills.length + r.practice.exams.length === 0 ? (
          <Empty />
        ) : (
          <div className="flex flex-col gap-4">
            {r.practice.games.length > 0 && (
              <Table head={["Игра", "Старты", "Конец", "Вышли"]}>
                {r.practice.games.map((g) => (
                  <tr key={g.key}>
                    <td className={tdFirst}>{g.key}</td>
                    <td className={td}>{g.starts}</td>
                    <td className={td}>{g.finishes}</td>
                    <td className={td}>{g.quits}</td>
                  </tr>
                ))}
              </Table>
            )}
            {r.practice.drills.length > 0 && (
              <Table head={["Тренировка", "Старты", "Конец"]}>
                {r.practice.drills.map((d) => (
                  <tr key={d.key}>
                    <td className={tdFirst}>{label.drillMode(d.key)}</td>
                    <td className={td}>{d.starts}</td>
                    <td className={td}>{d.finishes}</td>
                  </tr>
                ))}
              </Table>
            )}
            {r.practice.exams.length > 0 && (
              <Table head={["Пробник", "Старты", "Конец"]}>
                {r.practice.exams.map((x) => (
                  <tr key={x.key}>
                    <td className={tdFirst}>{label.examKind(x.key)}</td>
                    <td className={td}>{x.starts}</td>
                    <td className={td}>{x.finishes}</td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        )}
      </Section>

      <Section title={`Жалобы и отзывы (${data.issues.length})`} hint="Последние 100, новые сверху. Текст — как есть, без имён и контактов.">
        {data.issues.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.issues.map((i, idx) => (
              <li key={idx} className="rounded-2xl border-2 border-border bg-surface-2 p-3 text-sm">
                <p className="font-extrabold">
                  {label.issueType(i.type)} · {label.issueReason(i.reason)}
                </p>
                <p className="text-xs font-semibold text-muted">
                  {[formatAt(i.at), label.issueWhere(i.where), i.lang?.toUpperCase(), i.version].filter(Boolean).join(" · ")}
                </p>
                {i.comment && <p className="mt-1 whitespace-pre-wrap break-words font-semibold">{i.comment}</p>}
                {i.snippet && <p className="mt-1 whitespace-pre-wrap break-words text-xs font-semibold text-muted">{i.snippet}</p>}
                {(i.lessonId || i.itemId) && <p className="mt-1 break-all text-xs font-semibold text-muted">{[i.lessonId, i.itemId].filter(Boolean).join(" · ")}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Ошибки с телефонов (${data.errors.length})`} hint="Последние 50, новые сверху. Только наши ошибки; без расширений браузера.">
        {data.errors.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.errors.map((e, idx) => (
              <li key={idx} className="rounded-2xl border-2 border-border bg-surface-2 p-3 text-sm">
                <p className="break-words font-extrabold text-danger">{e.message}</p>
                <p className="break-all text-xs font-semibold text-muted">
                  {[formatAt(e.at), e.path, e.lang?.toUpperCase(), e.version].filter(Boolean).join(" · ")}
                </p>
                {e.userAgent && <p className="break-words text-xs font-semibold text-muted">{e.userAgent}</p>}
                {e.stack && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs font-extrabold text-muted">Стек</summary>
                    <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all text-[11px] font-semibold">{e.stack}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
