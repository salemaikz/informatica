"use client";

import "./globals.css";
import { TriangleAlert } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { detectProfile, normalizeError, reportClientError } from "@/lib/client-errors";
import { dict } from "@/i18n/dict";

// Ошибка в самом корне (layout, провайдеры): эта страница заменяет корневой layout, поэтому свои <html> и <body>,
// свои стили (токены из globals.css) и никакого стора и провайдеров — язык и тема читаются напрямую из localStorage.

const noop = () => () => {};

// Профиль читаем один раз: в localStorage лежит весь прогресс, парсить его на каждый рендер незачем.
let profile: ReturnType<typeof detectProfile> | null = null;
const getProfile = () => (profile ??= detectProfile());

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // На сервере — ru и системная тема; в браузере — из сохранённого профиля, иначе по языку браузера.
  const lang = useSyncExternalStore(noop, () => getProfile().lang, () => "ru" as const);
  const theme = useSyncExternalStore(noop, () => getProfile().theme ?? "", () => "");

  useEffect(() => {
    reportClientError(normalizeError(error), lang);
  }, [error, lang]);

  return (
    <html lang={lang} data-theme={theme || undefined} suppressHydrationWarning>
      <body className="min-h-dvh">
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <span aria-hidden className="flex size-20 items-center justify-center rounded-full bg-warning-soft text-warning-strong">
              <TriangleAlert size={40} />
            </span>
            <h1 className="text-2xl font-extrabold">{dict["errors.crash.title"][lang]}</h1>
            <p className="text-muted">{dict["errors.crash.text"][lang]}</p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-13 w-full items-center justify-center rounded-2xl bg-primary px-6 text-base font-extrabold tracking-wide text-white shadow-[0_4px_0_var(--primary-strong)] active:translate-y-[3px] active:shadow-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {dict["errors.retry"][lang]}
            </button>
            {/* Обычная ссылка (полная перезагрузка), а не next/link: роутер после сбоя в корне мог сломаться. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex h-13 w-full items-center justify-center rounded-2xl border-2 border-border bg-surface px-6 text-base font-extrabold tracking-wide text-text shadow-[0_3px_0_var(--border)] active:translate-y-[3px] active:shadow-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {dict["errors.home"][lang]}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
