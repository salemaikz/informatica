"use client";

import { Ellipsis, Pin, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { searchChats, sortChats, type ChatMeta, type ChatMode } from "@/lib/chats";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Mascot } from "@/components/mascot/Mascot";
import { Button } from "@/components/ui/Button";
import { useMinuteClock } from "@/components/goals/useClock";
import { ChatManageSheet, nextManageNonce, type ManageTarget } from "./ChatManageSheet";
import { displayTitle, formatChatTime, MODE_DESC_KEY, needsTopicStep } from "./helpers";
import { ModeBadge } from "./ModeIcon";
import { ModeList, NewChatSheet, useStartChat } from "./NewChatSheet";
import { useLegacyChatMigration } from "./useLegacyChatMigration";

function ChatRow({ chat, active, now, onMenu }: { chat: ChatMeta; active: boolean; now: number; onMenu: () => void }) {
  const { t, lang } = useT();
  const time = formatChatTime(chat.updatedAt, now, lang);
  return (
    <li
      className={cn(
        "flex items-center gap-1 rounded-2xl border-2 pr-1 transition-colors",
        active ? "border-ai/40 bg-ai-soft" : "border-border bg-surface hover:border-ai/30",
      )}
    >
      <Link href={`/tutor/${chat.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 p-2.5" aria-current={active ? "page" : undefined}>
        <ModeBadge mode={chat.mode} size={40} lesson={!!chat.lessonId} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {chat.pinned && <Pin size={13} className="shrink-0 text-ai" aria-label={t("chat2.pinnedMark")} />}
            <span className="truncate font-extrabold">{displayTitle(chat, lang, t)}</span>
            {time && <span className="ml-auto shrink-0 pl-1 text-xs font-bold text-muted">{time}</span>}
          </span>
          <span className="block truncate text-sm font-semibold text-muted">{chat.preview || (chat.lessonId ? t("theory16c.chat.badge") : t(MODE_DESC_KEY[chat.mode]))}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={onMenu}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ai"
        aria-label={t("chat2.menu.open")}
      >
        <Ellipsis size={20} />
      </button>
    </li>
  );
}

/** Список чатов: поиск, закреплённые сверху, меню «⋯», «Новый чат». Работает и на странице /tutor, и колонкой слева в чате. */
export function ChatList({ activeId, compact }: { activeId?: string; compact?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const chats = useApp((s) => s.chats);
  const now = useMinuteClock();
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newMode, setNewMode] = useState<ChatMode | undefined>();
  const startChat = useStartChat();
  const [manage, setManage] = useState<ManageTarget | null>(null);
  useLegacyChatMigration(activeId);

  const sorted = useMemo(() => sortChats(chats), [chats]);
  const shown = useMemo(() => searchChats(sorted, query), [sorted, query]);
  const searching = query.trim().length > 0;
  const pinned = shown.filter((c) => c.pinned);
  const rest = shown.filter((c) => !c.pinned);

  const openNew = (mode?: ChatMode) => {
    setNewMode(mode);
    setNewOpen(true);
  };
  const openMenu = (id: string) => setManage({ id, view: "actions", nonce: nextManageNonce() });

  const renderRows = (list: ChatMeta[]) => (
    <ul className="flex flex-col gap-2">
      {list.map((c) => (
        <ChatRow key={c.id} chat={c} active={c.id === activeId} now={now} onMenu={() => openMenu(c.id)} />
      ))}
    </ul>
  );

  const sheets = (
    <>
      <NewChatSheet open={newOpen} initialMode={newMode} onClose={() => setNewOpen(false)} />
      <ChatManageSheet
        target={manage}
        onClose={() => setManage(null)}
        onDeleted={(id) => {
          if (id === activeId) router.replace("/tutor");
        }}
      />
    </>
  );

  if (chats.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <Mascot mood="happy" size={compact ? 64 : 96} />
        <div>
          <p className="text-lg font-extrabold">{t("chat2.empty.title")}</p>
          <p className="font-semibold text-muted">{t("chat2.empty.text")}</p>
        </div>
        <div className="w-full text-left">
          {/* Метка проводника (сцена page-tutor): «Свободный» чат — «спрашивай о чём угодно». */}
          <ModeList tourFirst="tutor-free" onPick={(mode) => (needsTopicStep(mode) ? openNew(mode) : startChat(mode))} />
        </div>
        {sheets}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="ai" block icon={<Plus size={20} />} onClick={() => openNew()} data-tour="tutor-free">
        {t("chat2.new")}
      </Button>
      <label className="relative block">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("chat2.search")}
          aria-label={t("chat2.search")}
          className="h-11 w-full rounded-2xl border-2 border-border bg-surface pl-10 pr-3 font-semibold outline-none focus:border-ai"
        />
      </label>
      {shown.length === 0 ? (
        <p className="py-6 text-center font-bold text-muted">{t("chat2.search.empty")}</p>
      ) : searching || pinned.length === 0 ? (
        renderRows(shown)
      ) : (
        <>
          <h2 className="px-1 text-xs font-extrabold uppercase tracking-wide text-muted">{t("chat2.pinned")}</h2>
          {renderRows(pinned)}
          {rest.length > 0 && (
            <>
              <h2 className="mt-1 px-1 text-xs font-extrabold uppercase tracking-wide text-muted">{t("chat2.others")}</h2>
              {renderRows(rest)}
            </>
          )}
        </>
      )}
      {sheets}
    </div>
  );
}
