"use client";

import { Camera, GraduationCap, Images, ListChecks } from "lucide-react";
import type { ChatMeta } from "@/lib/chats";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { Mascot } from "@/components/mascot/Mascot";
import { AiCost } from "@/components/economy/AiCost";
import { Button } from "@/components/ui/Button";
import { topicTitle } from "./helpers";

const FREE_Q: DictKey[] = ["tutor.s1", "tutor.s2", "tutor.s3", "tutor.s4"];
const ENT_Q: DictKey[] = ["chat2.ent.q1", "chat2.ent.q2", "chat2.ent.q3", "chat2.ent.q4"];
const EXPLAIN_Q: DictKey[] = ["chat2.explain.q1", "chat2.explain.q2", "chat2.explain.q3"];

function Chips({ items }: { items: { key: string; text: string; onClick: () => void }[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {items.map((q) => (
        <button
          key={q.key}
          type="button"
          onClick={q.onClick}
          className="rounded-2xl border-2 border-ai/30 bg-ai-soft px-3.5 py-2 text-sm font-bold text-ai hover:brightness-95"
        >
          {q.text}
        </button>
      ))}
    </div>
  );
}

/** Пустой чат: что делать дальше — зависит от режима. */
export function ChatEmpty({
  chat,
  onSend,
  onPhoto,
  onStartQuiz,
}: {
  chat: ChatMeta;
  onSend: (text: string) => void;
  onPhoto: (source: "camera" | "gallery") => void;
  onStartQuiz: () => void;
}) {
  const { t, lang } = useT();
  const topic = topicTitle(chat.topic, lang);
  const wrap = "flex flex-col items-center gap-4 py-6 text-center";

  if (chat.mode === "explain" && chat.topic) {
    const ask = t("chat2.explain.btn", { topic });
    return (
      <div className={wrap}>
        <Mascot mood="happy" size={88} />
        <p className="max-w-sm font-semibold text-muted">{t("chat2.explain.intro")}</p>
        <Button variant="ai" size="lg" icon={<GraduationCap size={20} />} onClick={() => onSend(ask)} className="h-auto min-h-13 w-full max-w-sm whitespace-normal py-2.5 text-center">
          <span>{ask}</span>
          <AiCost kind="chat" variant="solid" short />
        </Button>
        <Chips items={EXPLAIN_Q.map((k) => ({ key: k, text: t(k, { topic }), onClick: () => onSend(t(k, { topic })) }))} />
      </div>
    );
  }

  if (chat.mode === "tasks") {
    return (
      <div className={wrap}>
        <Mascot mood="happy" size={88} />
        <p className="max-w-sm font-semibold text-muted">{t("chat2.tasks.intro")}</p>
        {topic && <p className="font-extrabold text-ai">{topic}</p>}
        <Button variant="ai" size="lg" icon={<ListChecks size={20} />} onClick={onStartQuiz}>
          {t("chat2.tasks.start")}
        </Button>
      </div>
    );
  }

  if (chat.mode === "check") {
    return (
      <div className={wrap}>
        <Mascot mood="thinking" size={88} />
        <p className="max-w-sm font-semibold text-muted">{t("chat2.check.intro")}</p>
        <Button variant="ai" size="lg" icon={<Camera size={22} />} onClick={() => onPhoto("camera")} className="h-auto min-h-16 w-full max-w-sm py-3 text-lg">
          {t("chat2.check.btn")}
        </Button>
        <Button variant="secondary" icon={<Images size={20} />} onClick={() => onPhoto("gallery")} className="w-full max-w-sm">
          {t("chat2.check.gallery")}
        </Button>
        <p className="max-w-sm text-sm font-semibold text-muted">{t("chat2.check.hint")}</p>
      </div>
    );
  }

  if (chat.mode === "ent") {
    return (
      <div className={wrap}>
        <Mascot mood="happy" size={88} />
        <p className="max-w-sm font-semibold text-muted">{t("chat2.ent.intro")}</p>
        <Chips items={ENT_Q.map((k) => ({ key: k, text: t(k), onClick: () => onSend(t(k)) }))} />
      </div>
    );
  }

  // Свободный (и «Объясни тему» без темы — на случай старых данных).
  return (
    <div className={wrap}>
      <Mascot mood="happy" size={96} />
      <p className="max-w-sm font-semibold text-muted">{t("tutor.empty")}</p>
      <Chips items={FREE_Q.map((k) => ({ key: k, text: t(k), onClick: () => (k === "tutor.s4" ? onPhoto("gallery") : onSend(t(k))) }))} />
    </div>
  );
}
