"use client";

import { useEffect, useState } from "react";

// Жалобы на игроков (этап 16Д, Ф3; docs/specs/duels.md §7) на странице владельца. Только по-русски (исключение /owner).
// Данные — GET /api/owner/social (cookie владельца), решения — POST { code, action: allow | hide }.

interface Case {
  code: string;
  name: string | null;
  nameState: string;
  reasons: { name: number; cheat: number; other: number };
  where: string[];
  last: number;
}

const box = "rounded-3xl border-2 border-border bg-surface p-4";
const btn = "inline-flex h-11 items-center rounded-2xl border-2 px-4 text-sm font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";
const STATE: Record<string, string> = { ok: "видно всем", hidden: "скрыто", rejected: "не прошло фильтр", none: "без имени", off: "имена выключены" };

export function SocialModeration() {
  const [cases, setCases] = useState<Case[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/owner/social", { signal: ctl.signal, cache: "no-store" })
      .then(async (r) => {
        const data = (await r.json().catch(() => null)) as { cases?: Case[]; error?: string } | null;
        if (ctl.signal.aborted) return;
        if (r.ok && data?.cases) {
          setCases(data.cases);
          setError(null);
        } else setError(data?.error === "social_disabled" ? "Соревнования выключены (нет SOCIAL_SECRET или общего хранилища)." : "Не удалось загрузить жалобы.");
      })
      .catch(() => {
        if (!ctl.signal.aborted) setError("Не удалось загрузить жалобы.");
      });
    return () => ctl.abort();
  }, [tick]);

  const act = async (code: string, action: "allow" | "hide") => {
    const r = await fetch("/api/owner/social", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, action }) });
    if (!r.ok) setError("Действие не выполнено.");
    setTick((n) => n + 1);
  };

  return (
    <section className={`${box} flex flex-col gap-3`} aria-labelledby="owner-social">
      <h2 id="owner-social" className="text-lg font-extrabold">
        Жалобы на игроков (дуэли)
      </h2>
      <p className="text-sm font-semibold text-muted">
        Имя скрывается у всех после жалоб от 3 разных игроков за 30 дней. «Разрешить» — имя снова видно, жалобы сброшены. «Скрыть» — имя скрыто, пока игрок не выберет другое.
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
          {error}
        </p>
      )}
      {cases && cases.length === 0 && <p className="text-sm font-semibold text-muted">Открытых жалоб нет.</p>}
      {cases?.map((c) => (
        <div key={c.code} className="flex flex-col gap-2 rounded-2xl border-2 border-border p-3" data-code={c.code}>
          <p className="font-extrabold">
            {c.name ?? "без имени"} <span className="font-mono text-sm text-muted">· {c.code}</span>
          </p>
          <p className="text-sm font-semibold text-muted">
            Имя: {STATE[c.nameState] ?? c.nameState} · жалоб: имя {c.reasons.name}, нечестно {c.reasons.cheat}, другое {c.reasons.other} · где: {c.where.join(", ") || "—"} ·{" "}
            {new Date(c.last).toLocaleString("ru-RU")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${btn} border-border bg-surface`} onClick={() => void act(c.code, "allow")}>
              Разрешить
            </button>
            <button type="button" className={`${btn} border-danger/40 bg-danger-soft text-danger`} onClick={() => void act(c.code, "hide")}>
              Скрыть имя
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
