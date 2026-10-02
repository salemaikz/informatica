"use client";

import { Check, MessageSquarePlus, MoreHorizontal, Pencil, Pin, PinOff, Search, Trash2, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { MAX_TITLE, matchSnippet, searchChats, useChats, type Chat } from "@/lib/chat-store";
import { useT } from "@/i18n/useT";

/** Список чатов: поиск, «Новый чат», закрепление, переименование, удаление с подтверждением. */
export function ChatList({ onPicked, className }: { onPicked?: () => void; className?: string }) {
  const { t } = useT();
  const chats = useChats((s) => s.chats);
  const activeId = useChats((s) => s.activeId);
  const newChat = useChats((s) => s.newChat);
  const setActive = useChats((s) => s.setActive);
  const [query, setQuery] = useState("");
  // Открытая строка действий / режим строки: переименование или подтверждение удаления.
  const [menu, setMenu] = useState<{ id: string; mode: "actions" | "rename" | "delete" } | null>(null);

  const list = searchChats(chats, query);

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <button
        type="button"
        onClick={() => {
          newChat();
          setMenu(null);
          setQuery("");
          onPicked?.();
        }}
        className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-ai px-4 font-extrabold text-white shadow-[0_4px_0_var(--ai-strong)] active:translate-y-[3px] active:shadow-none"
      >
        <MessageSquarePlus size={18} /> {t("chats.new")}
      </button>

      <label className="flex min-h-11 items-center gap-2 rounded-2xl border-2 border-border bg-surface px-3 focus-within:border-ai">
        <Search size={16} className="shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("chats.search")}
          aria-label={t("chats.search")}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm font-semibold outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label={t("chats.clearSearch")} className="-mr-3 flex h-11 w-11 shrink-0 items-center justify-center text-muted hover:text-text">
            <X size={16} />
          </button>
        )}
      </label>

      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {list.length === 0 && <li className="px-2 py-4 text-center text-sm font-semibold text-muted">{chats.length ? t("chats.noResults") : t("chats.none")}</li>}
        {list.map((c) => (
          <ChatRow
            key={c.id}
            chat={c}
            active={c.id === activeId}
            query={query}
            mode={menu?.id === c.id ? menu.mode : null}
            setMode={(mode) => setMenu(mode ? { id: c.id, mode } : null)}
            onOpen={() => {
              setActive(c.id);
              setMenu(null);
              onPicked?.();
            }}
          />
        ))}
      </ul>
    </div>
  );
}

function ChatRow({
  chat,
  active,
  query,
  mode,
  setMode,
  onOpen,
}: {
  chat: Chat;
  active: boolean;
  query: string;
  mode: "actions" | "rename" | "delete" | null;
  setMode: (m: "actions" | "rename" | "delete" | null) => void;
  onOpen: () => void;
}) {
  const { t } = useT();
  const rename = useChats((s) => s.rename);
  const togglePin = useChats((s) => s.togglePin);
  const remove = useChats((s) => s.remove);
  const [draft, setDraft] = useState(chat.title);
  const title = chat.title || t("chats.untitled");
  const snippet = query ? matchSnippet(chat, query) : null;

  if (mode === "rename") {
    const save = () => {
      if (draft.trim()) rename(chat.id, draft);
      setMode(null);
    };
    return (
      <li className="flex items-center gap-1 rounded-2xl border-2 border-ai/40 bg-surface p-1.5">
        <input
          autoFocus
          value={draft}
          maxLength={MAX_TITLE}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setMode(null);
          }}
          aria-label={t("chats.titleLabel")}
          className="min-h-11 min-w-0 flex-1 bg-transparent px-2 font-bold outline-none"
        />
        <button type="button" onClick={save} aria-label={t("common.save")} className="flex h-11 w-11 items-center justify-center rounded-xl text-ai hover:bg-ai-soft">
          <Check size={18} />
        </button>
        <button type="button" onClick={() => setMode(null)} aria-label={t("common.cancel")} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
          <X size={18} />
        </button>
      </li>
    );
  }

  if (mode === "delete") {
    return (
      <li className="flex flex-col gap-2 rounded-2xl border-2 border-danger/40 bg-danger-soft p-3">
        <p className="text-sm font-bold text-danger">{t("chats.deleteConfirm")}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              remove(chat.id);
              setMode(null);
            }}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger px-3 text-sm font-extrabold text-white"
          >
            <Trash2 size={16} /> {t("chats.delete")}
          </button>
          <button type="button" onClick={() => setMode(null)} className="min-h-11 flex-1 rounded-xl border-2 border-border bg-surface px-3 text-sm font-extrabold">
            {t("common.cancel")}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className={cn("rounded-2xl", active ? "bg-ai-soft" : "hover:bg-surface-2")}>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onOpen} aria-current={active ? "true" : undefined} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center px-3 py-2 text-left">
          <span className={cn("flex items-center gap-1.5 truncate text-sm font-extrabold", active && "text-ai")}>
            {chat.pinned && <Pin size={13} className="shrink-0 text-muted" aria-label={t("chats.pinned")} />}
            <span className="truncate">{title}</span>
          </span>
          {snippet && <span className="truncate text-xs font-semibold text-muted">{snippet}</span>}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "actions" ? null : "actions")}
          aria-label={t("chats.actions")}
          aria-expanded={mode === "actions"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-text"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>
      {mode === "actions" && (
        <div className="flex flex-wrap gap-1 px-2 pb-2">
          <RowAction
            icon={chat.pinned ? <PinOff size={15} /> : <Pin size={15} />}
            label={chat.pinned ? t("chats.unpin") : t("chats.pin")}
            onClick={() => {
              togglePin(chat.id);
              setMode(null);
            }}
          />
          <RowAction
            icon={<Pencil size={15} />}
            label={t("chats.rename")}
            onClick={() => {
              setDraft(chat.title);
              setMode("rename");
            }}
          />
          <RowAction icon={<Trash2 size={15} />} label={t("chats.delete")} danger onClick={() => setMode("delete")} />
        </div>
      )}
    </li>
  );
}

function RowAction({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-border bg-surface px-2.5 text-xs font-extrabold",
        danger ? "text-danger hover:bg-danger-soft" : "text-text hover:bg-surface-2",
      )}
    >
      {icon} {label}
    </button>
  );
}
