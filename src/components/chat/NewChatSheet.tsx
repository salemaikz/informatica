"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CHAT_MODES, type ChatMode } from "@/lib/chats";
import { useApp } from "@/lib/store";
import type { EntTopicId } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { Modal } from "@/components/ui/Modal";
import { MODE_DESC_KEY, MODE_NAME_KEY, needsTopicStep, TOPIC_REQUIRED, topicTitle } from "./helpers";
import { ModeBadge } from "./ModeIcon";
import { TopicPicker } from "./TopicPicker";

/** Создаёт чат нужного режима (и темы) и открывает его. Название по режиму и теме; у остальных — по первому вопросу. */
export function useStartChat() {
  const { t, lang } = useT();
  const router = useRouter();
  const createChat = useApp((s) => s.createChat);
  return (mode: ChatMode, topic?: EntTopicId) => {
    const title = topic ? `${t(MODE_NAME_KEY[mode])}: ${topicTitle(topic, lang, true)}` : "";
    const id = createChat(mode, title, topic);
    router.push(`/tutor/${id}`);
  };
}

/** Карточки режимов: иконка, название и одна строка «что умеет». `tourFirst` — метка проводника на первом режиме. */
export function ModeList({ onPick, tourFirst }: { onPick: (mode: ChatMode) => void; tourFirst?: string }) {
  const { t } = useT();
  return (
    <ul className="flex flex-col gap-2">
      {CHAT_MODES.map((mode, i) => (
        <li key={mode}>
          <button
            type="button"
            data-tour={i === 0 ? tourFirst : undefined}
            onClick={() => onPick(mode)}
            className="flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3 text-left hover:border-ai/40 hover:bg-ai-soft"
          >
            <ModeBadge mode={mode} />
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">{t(MODE_NAME_KEY[mode])}</span>
              <span className="block text-sm font-semibold text-muted">{t(MODE_DESC_KEY[mode])}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Шторка «Новый чат»: выбор режима, для «Объясни тему» и «Дай задачи» — ещё и темы (initialMode — сразу шаг темы). */
export function NewChatSheet({ open, onClose, initialMode }: { open: boolean; onClose: () => void; initialMode?: ChatMode }) {
  const { t } = useT();
  const startChat = useStartChat();
  // undefined — выбор не делали (берём initialMode), null — вернулись к списку режимов.
  const [picked, setPicked] = useState<ChatMode | null | undefined>(undefined);
  const pending = picked === undefined ? (initialMode && needsTopicStep(initialMode) ? initialMode : null) : picked;

  const close = () => {
    setPicked(undefined);
    onClose();
  };

  const start = (mode: ChatMode, topic?: EntTopicId) => {
    startChat(mode, topic);
    close();
  };

  const setPending = setPicked;
  const pickMode = (mode: ChatMode) => (needsTopicStep(mode) ? setPending(mode) : start(mode));

  return (
    <Modal open={open} onClose={close} label={t("chat2.new")}>
      {pending ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2"
              aria-label={t("common.back")}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold">{t("chat2.topic.title")}</h2>
              <p className="text-sm font-bold text-ai">{t(MODE_NAME_KEY[pending])}</p>
            </div>
          </div>
          <TopicPicker withAny={!TOPIC_REQUIRED.includes(pending)} onPick={(topic) => start(pending, topic)} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold">{t("chat2.new")}</h2>
          <ModeList onPick={pickMode} />
        </div>
      )}
    </Modal>
  );
}
