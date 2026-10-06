"use client";

import { Check, Flag } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { buildIssueBody, ISSUE_LIMITS, ISSUE_REASONS, issueKey, submitIssue, type IssueTarget } from "@/lib/issue";
import { Mascot } from "@/components/mascot/Mascot";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// ---------- «Уже отправлено»: что отправлено за сессию (вкладку) ----------
// Ключи лежат в памяти и в sessionStorage (переживают перезагрузку вкладки); хранилище может быть недоступно.

const SESSION_KEY = "informatica-issues-sent";
const sent = new Set<string>();
// Жалобы «в полёте» (отправляются прямо сейчас): общий набор по ключу жалобы. Закрыть шторку и открыть снова,
// пока идёт отправка, — не даёт второй запрос, а новая шторка показывает «Отправляем…».
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let loaded = false;

function loadSent() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) for (const k of list) if (typeof k === "string") sent.add(k);
  } catch {
    // без sessionStorage работаем на памяти
  }
}

function markSent(key: string) {
  loadSent();
  sent.add(key);
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify([...sent].slice(-100)));
  } catch {
    // не страшно
  }
  for (const l of listeners) l();
}

function setInflight(key: string, on: boolean) {
  if (on) inflight.add(key);
  else inflight.delete(key);
  for (const l of listeners) l();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

function useWasSent(key: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      loadSent();
      return sent.has(key);
    },
    () => false,
  );
}

function useInFlight(key: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => inflight.has(key),
    () => false,
  );
}

// ---------- Тексты причин ----------

const REASON_KEY = {
  "task:wrong_answer": "issue.reason.wrong_answer",
  "task:unclear": "issue.reason.unclear",
  "task:typo": "issue.reason.typo",
  "task:other": "issue.reason.other",
  "ai:wrong": "issue.reason.ai.wrong",
  "ai:unclear": "issue.reason.ai.unclear",
  "ai:gave_solution": "issue.reason.ai.gave_solution",
  "ai:other": "issue.reason.other",
} as const satisfies Record<string, DictKey>;

type Status = "idle" | "sending" | "done" | "error";

/** Содержимое шторки. Живёт, только пока шторка открыта (состояние каждый раз новое). */
function IssueSheet({ target, onClose }: { target: IssueTarget; onClose: () => void }) {
  const { t, lang } = useT();
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const firstRef = useRef<HTMLButtonElement>(null);
  const key = issueKey(target);
  const already = useWasSent(key);
  const sending = useInFlight(key);

  // Фокус — на кнопку (не на заголовок и не на фон): Enter на кнопке не листает шаг урока под шторкой.
  useEffect(() => {
    firstRef.current?.focus({ preventScroll: true });
  }, []);

  const send = async () => {
    // Уже идёт отправка этой жалобы (в том числе из закрытой шторки) — второй запрос не шлём.
    if (!reason || sending || inflight.has(key)) return;
    setStatus("sending");
    setInflight(key, true);
    let ok = false;
    try {
      ok = await submitIssue(buildIssueBody(target, reason, comment, lang));
      if (ok) markSent(key);
    } finally {
      setInflight(key, false);
    }
    setStatus(ok ? "done" : "error");
  };

  // «Отправлено» — своя отправка или та, что началась в прошлом открытии шторки и закончилась, пока эта была открыта.
  if (status === "done" || already) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <Mascot mood="happy" size={72} />
        <p role="status" className="text-xl font-extrabold">
          {t("issue.thanks")}
        </p>
        {/* autoFocus: после отправки кнопка «Отправить» исчезла, фокус нужен на «Закрыть» (Enter не должен листать шаг урока). */}
        <Button size="lg" block onClick={onClose} className="mt-2" autoFocus>
          {t("common.close")}
        </Button>
      </div>
    );
  }

  const reasons = ISSUE_REASONS[target.kind];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
          <Flag size={20} />
        </span>
        <div className="min-w-0">
          <h3 className="text-xl font-extrabold leading-tight">{t("issue.title")}</h3>
          <p className="text-sm font-semibold text-muted">{t(target.kind === "ai" ? "issue.lead.ai" : "issue.lead.task")}</p>
        </div>
      </div>

      <div role="radiogroup" aria-label={t("issue.reasons")} className="flex flex-col gap-2">
        {reasons.map((r, i) => {
          const picked = reason === r;
          return (
            <button
              key={r}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              role="radio"
              aria-checked={picked}
              onClick={() => setReason(r)}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-2xl border-2 px-4 py-2 text-left text-[15px] font-extrabold transition-colors",
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
                picked ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-surface text-text hover:bg-surface-2",
              )}
            >
              <span
                aria-hidden
                className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", picked ? "border-action-primary bg-action-primary text-white" : "border-border")}
              >
                {picked && <Check size={12} strokeWidth={4} />}
              </span>
              {t(REASON_KEY[`${target.kind}:${r}` as keyof typeof REASON_KEY])}
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-extrabold text-muted">{t("issue.comment")}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={ISSUE_LIMITS.comment}
          rows={3}
          placeholder={t("issue.comment.placeholder")}
          className="w-full resize-none rounded-2xl border-2 border-border bg-surface p-3 text-base font-semibold text-text placeholder:text-muted focus:border-primary/40 focus:outline-none"
        />
        <span className="self-end text-xs font-bold text-muted" aria-hidden>
          {comment.length}/{ISSUE_LIMITS.comment}
        </span>
      </label>

      {status === "error" && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-center text-sm font-bold text-danger">
          {t("issue.error")}
        </p>
      )}

      {/* Во время отправки кнопка остаётся доступной (фокус не теряется), повторное нажатие игнорируется. */}
      <Button size="lg" block disabled={!reason} aria-busy={sending} onClick={() => void send()}>
        {sending ? t("issue.sending") : t("issue.send")}
      </Button>
    </div>
  );
}

/**
 * Кнопка «Сообщить об ошибке» у задания и под ответом ИИ: открывает шторку с причиной и комментарием.
 * compact — только иконка (под ответом ИИ), иначе иконка с подписью.
 * Нейтральный цвет: это не ошибка ученика. Повторно то же самое за сессию не шлём — «Уже отправлено».
 */
export function ReportIssueButton({ target, compact, className }: { target: IssueTarget; compact?: boolean; className?: string }) {
  const { t } = useT();
  const already = useWasSent(issueKey(target));
  const [open, setOpen] = useState(false);
  // Шторку рисуем в body (вне нижней панели урока и карточек со скрытым переполнением) и только после первого открытия.
  const [opened, setOpened] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = t(already ? "issue.sent" : "issue.button");
  // После закрытия шторки фокус — обратно на кнопку, а не «в никуда». Кнопка после отправки не `disabled`,
  // а `aria-disabled` (она остаётся в порядке фокуса), поэтому фокус на неё возвращается и после успешной отправки.
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-disabled={already ? "true" : undefined}
        aria-label={compact ? label : undefined}
        title={compact ? label : undefined}
        onClick={() => {
          if (already) return;
          setOpened(true);
          setOpen(true);
        }}
        className={cn(
          "relative inline-flex select-none items-center justify-center gap-1.5 rounded-xl font-extrabold text-muted transition-colors after:absolute after:-inset-1.5",
          "hover:bg-surface-2 hover:text-text focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "aria-disabled:cursor-default aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted",
          compact ? "size-9" : "h-9 px-2.5 text-xs",
          className,
        )}
      >
        {already ? <Check size={compact ? 18 : 14} strokeWidth={3} aria-hidden /> : <Flag size={compact ? 18 : 14} aria-hidden />}
        {!compact && <span>{label}</span>}
      </button>
      {opened &&
        createPortal(
          <Modal open={open} onClose={close} label={t("issue.title")}>
            <IssueSheet target={target} onClose={close} />
          </Modal>,
          document.body,
        )}
    </>
  );
}
