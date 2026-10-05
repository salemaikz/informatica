"use client";

import { m } from "motion/react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useT } from "@/i18n/useT";
import type { Scene } from "@/lib/types";
import { markNotes, messageSegments, senderInitial, type MessageSegment } from "./message";

type MessageSceneData = Extract<Scene, { kind: "message" }>;

/** Номер признака — маленький кружок рядом с подсвеченным фрагментом. */
function MarkBadge({ n }: { n: number }) {
  return (
    <span aria-hidden className="mx-0.5 inline-flex size-4 -translate-y-px items-center justify-center rounded-full border border-warning bg-warning-soft align-middle text-[10px] font-extrabold leading-none text-warning-strong">
      {n}
    </span>
  );
}

/** Текст сообщения; признаки — заливка warning-soft и подчёркивание, после каждого — номер. */
function Body({ segments }: { segments: MessageSegment[] }) {
  return (
    <p className="whitespace-pre-line text-[15px] font-semibold leading-snug text-text [overflow-wrap:anywhere]">
      {segments.map((s, i) =>
        s.mark === undefined ? (
          <span key={i}>{s.text}</span>
        ) : (
          <span key={i}>
            <mark className="rounded-sm bg-warning-soft px-0.5 font-bold text-text underline decoration-warning decoration-2 underline-offset-2">{s.text}</mark>
            <MarkBadge n={s.mark} />
          </span>
        ),
      )}
    </p>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[15px] font-extrabold text-primary-strong">
      {senderInitial(name)}
    </span>
  );
}

/** Сообщение: SMS в «телефоне», письмо в окне, чат с пузырём. Подсвеченные признаки — с номерами и списком под сообщением. */
export function MessageScene({ scene }: { scene: MessageSceneData }) {
  const { t, l, lang } = useT();
  const reduce = useReduceMotion();
  const from = l(scene.from);
  const subject = scene.subject !== undefined ? l(scene.subject) : undefined;
  const text = l(scene.text);
  const segments = messageSegments(scene, lang);
  const notes = markNotes(scene.marks, lang);

  const markAria = segments
    .filter((s) => s.mark !== undefined)
    .map((s) => {
      const note = notes.find((n) => n.n === s.mark)?.note;
      return " " + t("scene.message.ariaMark", { n: s.mark ?? 0, text: s.text }) + (note !== undefined ? ` — ${note}` : "") + ".";
    })
    .join("");

  const aria =
    (scene.channel === "sms"
      ? t("scene.message.aria.sms", { from, text })
      : scene.channel === "chat"
        ? t("scene.message.aria.chat", { from, text })
        : subject !== undefined
          ? t("scene.message.aria.emailSubject", { from, subject, text })
          : t("scene.message.aria.email", { from, text })) + markAria;

  const bubble = (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[88%] rounded-2xl rounded-tl-md bg-surface-2 px-3.5 py-2.5"
    >
      <Body segments={segments} />
    </m.div>
  );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3">
      {scene.channel === "email" ? (
        <div role="img" aria-label={aria} className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-b border-border bg-surface-2 px-3.5 py-2.5 text-[13px]">
            <span className="font-bold text-muted">{t("scene.message.from")}</span>
            <span className="min-w-0 font-extrabold text-text [overflow-wrap:anywhere]">{from}</span>
            {subject !== undefined && (
              <>
                <span className="font-bold text-muted">{t("scene.message.subject")}</span>
                <span className="min-w-0 font-bold text-text [overflow-wrap:anywhere]">{subject}</span>
              </>
            )}
          </div>
          <div className="px-3.5 py-3">
            <Body segments={segments} />
          </div>
        </div>
      ) : (
        <div role="img" aria-label={aria} className="w-full max-w-[320px] overflow-hidden rounded-[1.75rem] border-2 border-border bg-surface">
          <div aria-hidden className="mx-auto mt-2 h-1.5 w-14 rounded-full bg-border" />
          {scene.channel === "sms" ? (
            <div aria-hidden className="flex flex-col items-center gap-1 px-4 pb-2 pt-2">
              <Avatar name={from} />
              <span className="max-w-full text-center text-[13px] font-extrabold text-text [overflow-wrap:anywhere]">{from}</span>
            </div>
          ) : (
            <div aria-hidden className="flex items-center gap-2.5 border-b border-border px-3.5 pb-2.5 pt-2">
              <Avatar name={from} />
              <span className="min-w-0 text-[14px] font-extrabold text-text [overflow-wrap:anywhere]">{from}</span>
            </div>
          )}
          <div className="flex min-h-24 flex-col items-start gap-2 bg-surface px-3 pb-5 pt-2">{bubble}</div>
        </div>
      )}

      {notes.length > 0 && (
        <ul className="flex w-full max-w-[420px] flex-col gap-1.5">
          {notes.map((n) => (
            <li key={n.n} className="flex items-start gap-2 text-[14px] font-semibold leading-snug text-text">
              <MarkBadge n={n.n} />
              <span className="min-w-0 [overflow-wrap:anywhere]">
                <span className="sr-only">{n.n}: </span>
                <span className="text-muted">— </span>
                {n.note}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
