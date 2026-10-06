import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadOwnerData, ownerSession } from "@/server/owner-data";
import { OwnerView } from "./OwnerView";

// Страница владельца (решение #69): статистика, жалобы, ошибки с телефонов. Только по-русски — исключение из правила двух языков.
// Нет OWNER_SECRET в окружении — 404. Вход — форма с паролем → /api/owner/login → cookie inf_owner (12 часов).
// Динамическая (cookies), без кэша, не индексируется. Вне оболочки приложения.

export const metadata: Metadata = {
  title: "Владелец",
  robots: { index: false, follow: false, nocache: true },
};

const ERRORS: Record<string, string> = {
  "1": "Неверный пароль.",
  "2": "Слишком много попыток. Подождите 10 минут.",
  "3": "Запрос не принят. Попробуйте ещё раз.",
};

const box = "rounded-3xl border-2 border-border bg-surface p-4";
const chip = "rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-extrabold text-muted";
const button =
  "inline-flex h-11 items-center justify-center rounded-2xl bg-action-primary px-5 text-[15px] font-extrabold text-white shadow-[0_4px_0_var(--action-primary-edge)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default async function OwnerPage({ searchParams }: { searchParams: Promise<{ days?: string; e?: string }> }) {
  // Сначала запрос: иначе при сборке (без OWNER_SECRET) «404» могла бы запечься в статику навсегда.
  await connection();
  const session = await ownerSession();
  if (session === "off") notFound();
  const sp = await searchParams;

  if (session === "anon") {
    const error = sp.e ? ERRORS[sp.e] : undefined;
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-4 py-10">
        <h1 className="text-2xl font-extrabold">Владелец</h1>
        <form method="post" action="/api/owner/login" className={`${box} flex flex-col gap-3`}>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-extrabold text-muted">Пароль</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={200}
              autoFocus
              className="h-12 w-full rounded-2xl border-2 border-border bg-surface px-3 text-base font-semibold text-text focus:border-primary/40 focus:outline-none"
            />
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
              {error}
            </p>
          )}
          <button type="submit" className={button}>
            Войти
          </button>
        </form>
      </main>
    );
  }

  const period = sp.days === "30" ? 30 : 7;
  const data = await loadOwnerData(period);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Владелец</h1>
        <form method="post" action="/api/owner/logout">
          <button
            type="submit"
            className="inline-flex h-11 items-center rounded-2xl border-2 border-border bg-surface px-4 text-[15px] font-extrabold text-text hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Выйти
          </button>
        </form>
      </header>

      <div className={`${box} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={chip}>Хранилище: {data.storage === "upstash" ? "Upstash (общее)" : "память процесса (у каждой копии сервера своя)"}</span>
          <span className={chip}>Сбор статистики: {data.collecting ? "включён" : "выключен (NEXT_PUBLIC_ANALYTICS не равен 1)"}</span>
        </div>
        <nav aria-label="Период" className="flex gap-2">
          {([7, 30] as const).map((d) => (
            <Link
              key={d}
              href={`/owner?days=${d}`}
              prefetch={false}
              aria-current={data.period === d ? "page" : undefined}
              className={`inline-flex h-11 items-center rounded-full border-2 px-5 text-sm font-extrabold ${
                data.period === d ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:bg-surface-2"
              }`}
            >
              {d} дней
            </Link>
          ))}
        </nav>
      </div>

      {data.unavailable ? (
        <p role="alert" className="rounded-3xl border-2 border-danger/40 bg-danger-soft px-4 py-3 text-base font-extrabold text-danger">
          Хранилище не ответило — данные не загружены. Это не значит, что их нет: обновите страницу.
        </p>
      ) : (
        <OwnerView data={data} />
      )}
    </main>
  );
}
