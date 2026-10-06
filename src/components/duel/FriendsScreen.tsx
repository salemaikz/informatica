"use client";

import { Check, ChevronDown, Copy, Link2, MoreHorizontal, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatFriendCode, normalizeFriendCode } from "@/lib/friend-code";
import { absoluteUrl, copyText } from "@/lib/share";
import {
  blockPlayer,
  createInvite,
  deleteMe,
  getFriends,
  getTop,
  removeFriend,
  requestFriend,
  respondFriend,
  saveMe,
  type FriendLists,
  type RequestStatus,
} from "@/lib/social/client";
import { playerTag, type MyPlayer, type TopRowView } from "@/lib/social/view";
import type { PublicCard } from "@/lib/duel/types";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/goals/controls";
import { Mascot } from "@/components/mascot/Mascot";
import { ShareTargets } from "@/components/share/ShareTargets";
import { FriendsTop } from "@/components/social/FriendsTop";
import { NameForm } from "@/components/social/NameForm";
import { PlayerRow, useShowName } from "@/components/social/PlayerCard";
import { ReportPlayerButton } from "@/components/social/ReportPlayerButton";
import { profileInput, profileStale, useMyPlayer } from "@/components/social/useSocial";

// Друзья /duel/friends (этап 16Д, Ф3; docs/specs/duels.md §9): мой код крупно, «Скопировать», «Пригласить» (ссылка /f/…),
// «Добавить по коду», заявки, список друзей (уровень, рамка, титул), топ друзей за неделю, настройки: имя, «Показывать мои очки
// в топе друзей», заблокированные, «Удалить мой профиль соревнований». Первый вход — сначала имя (из профиля, после фильтра).

const ADD_NOTE: Record<RequestStatus, DictKey> = {
  sent: "social.add.sent",
  accepted: "social.add.accepted",
  already: "social.add.already",
  self: "social.add.self",
  not_found: "social.add.not_found",
  limit: "social.add.limit",
};

export function FriendsScreen() {
  const { t } = useT();
  const { state, player, loaded, setPlayer, reload } = useMyPlayer();
  const [nameNote, setNameNote] = useState<DictKey | null>(null);
  const [editName, setEditName] = useState(false);
  const [lists, setLists] = useState<FriendLists | null>(null);
  const [top, setTop] = useState<TopRowView[] | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const code = player?.code ?? null;

  // Карточка на сервере отстала (уровень, рамка, титул) — обновляем молча, один раз за открытие экрана.
  const synced = useRef(false);
  useEffect(() => {
    if (!player || synced.current || !profileStale(player)) return;
    synced.current = true;
    void saveMe(profileInput(player.name, player.ft)).then((r) => {
      if (r.ok && r.data) setPlayer(r.data.player);
    });
  }, [player, setPlayer]);

  useEffect(() => {
    if (!code) return;
    const ctl = new AbortController();
    void getFriends(ctl.signal).then((r) => {
      if (!ctl.signal.aborted && r.ok && r.data) setLists(r.data);
    });
    void getTop(Date.now(), ctl.signal).then((r) => {
      if (!ctl.signal.aborted && r.ok && r.data) setTop(r.data);
    });
    return () => ctl.abort();
  }, [code, tick]);

  if (!loaded)
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Mascot mood="thinking" size={80} />
        <p className="font-bold text-muted" role="status">
          {t("common.loading")}
        </p>
      </div>
    );

  if (state === "off" || state === "down")
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center" data-testid="social-off">
        <Mascot mood={state === "off" ? "happy" : "sad"} size={88} />
        <h1 className="text-xl font-extrabold">{t(state === "off" ? "social.off.title" : "social.down")}</h1>
        {state === "off" ? <p className="font-semibold text-muted">{t("social.off.desc")}</p> : <Button onClick={reload}>{t("duel.retry")}</Button>}
      </div>
    );

  if (!player || editName)
    return (
      <div className="flex flex-col gap-4">
        <NameForm
          player={player}
          onDone={(p, note) => {
            setPlayer(p);
            setNameNote(note ?? null);
            setEditName(false);
          }}
          onCancel={player ? () => setEditName(false) : undefined}
        />
        <p className="text-center text-xs font-semibold text-muted">{t("social.device")}</p>
      </div>
    );

  return (
    <div className="flex flex-col gap-5" data-testid="friends-screen">
      <h1 className="text-2xl font-extrabold">{t("social.friends.title")}</h1>
      {(nameNote || player.nameState === "hidden") && (
        <p className="rounded-2xl bg-warning-soft px-3 py-2 text-sm font-bold text-ink-warning" role="status">
          {nameNote ? t(nameNote, { tag: t("social.player", { n: playerTag(player.code) }) }) : t("social.name.hidden")}
        </p>
      )}
      <CodeCard player={player} />
      <AddByCode onChange={refresh} />
      {lists && lists.requests.length > 0 && <Requests list={lists.requests} onChange={refresh} />}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">{t("social.top")}</h2>
        {top && top.length > 1 ? <FriendsTop rows={top} limit={10} report /> : <p className="rounded-3xl border-2 border-dashed border-border px-4 py-4 text-center text-sm font-semibold text-muted">{t("social.top.empty")}</p>}
        <p className="text-xs font-semibold text-muted">{t("social.top.reset")}</p>
      </section>
      <FriendList list={lists?.friends ?? null} onChange={refresh} />
      <Settings
        player={player}
        blocked={lists?.blocked ?? []}
        onPlayer={setPlayer}
        onEditName={() => {
          setNameNote(null);
          setEditName(true);
        }}
        onChange={refresh}
        onDeleted={() => {
          setLists(null);
          setTop(null);
          setPlayer(null);
        }}
      />
      <p className="text-center text-xs font-semibold text-muted">{t("social.device")}</p>
    </div>
  );
}

/** Мой код крупно, «Скопировать», «Пригласить» (ссылка /f/<token> через общее меню «Поделиться»). */
function CodeCard({ player }: { player: MyPlayer }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const shown = formatFriendCode(player.code);

  const copy = async () => {
    if (await copyText(shown)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };
  const share = async () => {
    setError(false);
    if (!invite) {
      const r = await createInvite();
      if (!r.ok || !r.data) {
        setError(true);
        return;
      }
      setInvite(r.data);
    }
    setOpen(true);
  };

  return (
    <section className="flex flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4">
      <h2 className="text-sm font-extrabold text-muted">{t("social.code.title")}</h2>
      <p className="text-center font-mono text-4xl font-black tracking-wider tabular-nums" data-testid="my-friend-code">
        {shown}
      </p>
      <p className="text-center text-xs font-semibold text-muted">{t("social.code.hint")}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" block onClick={copy} icon={copied ? <Check size={18} /> : <Copy size={18} />}>
          {copied ? t("social.code.copied") : t("social.code.copy")}
        </Button>
        <Button block onClick={share} icon={<Link2 size={18} />} data-testid="friends-invite">
          {t("social.invite")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-center text-sm font-bold text-ink-danger">
          {t("social.error")}
        </p>
      )}
      <Modal open={open && !!invite} onClose={() => setOpen(false)} label={t("social.invite.title")}>
        <div className="flex flex-col gap-3 pb-[max(8px,env(safe-area-inset-bottom))]" data-testid="invite-sheet" data-url={invite ?? ""}>
          <h2 className="text-xl font-extrabold">{t("social.invite.title")}</h2>
          <p className="text-sm font-semibold text-muted">{t("social.invite.note")}</p>
          {invite && <ShareTargets url={absoluteUrl(invite)} title={t("social.invite.title")} text={t("social.invite.text")} what="challenge" />}
          <Button variant="ghost" block onClick={() => setOpen(false)}>
            {t("common.close")}
          </Button>
        </div>
      </Modal>
    </section>
  );
}

function AddByCode({ onChange }: { onChange: () => void }) {
  const { t } = useT();
  const [value, setValue] = useState("");
  const [note, setNote] = useState<{ key: DictKey; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const code = normalizeFriendCode(value);
    if (!code) {
      setNote({ key: "social.add.bad", ok: false });
      return;
    }
    setBusy(true);
    const r = await requestFriend(code);
    setBusy(false);
    if (!r.ok || !r.data) {
      setNote({ key: r.status === 429 ? "social.rate" : "social.error", ok: false });
      return;
    }
    const ok = r.data === "sent" || r.data === "accepted" || r.data === "already";
    setNote({ key: ADD_NOTE[r.data], ok });
    if (ok) setValue("");
    if (r.data === "accepted") onChange();
  };

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-extrabold">{t("social.add.title")}</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value.slice(0, 20));
            setNote(null);
          }}
          placeholder={t("social.add.placeholder")}
          aria-label={t("social.add.title")}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          data-testid="add-code-input"
          className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-border bg-surface px-3 font-mono text-base font-bold uppercase text-text placeholder:font-sans placeholder:normal-case placeholder:text-muted focus:border-primary/40 focus:outline-none"
        />
        <Button type="submit" size="lg" disabled={busy || !value.trim()} icon={<UserPlus size={18} />} data-testid="add-code-send">
          {t("social.add.send")}
        </Button>
      </form>
      {note && (
        <p role="status" data-testid="add-code-note" className={cn("rounded-xl px-3 py-2 text-sm font-bold", note.ok ? "bg-success-soft text-ink-success" : "bg-surface-2 text-muted")}>
          {t(note.key)}
        </p>
      )}
    </section>
  );
}

function Requests({ list, onChange }: { list: PublicCard[]; onChange: () => void }) {
  const { t } = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const answer = async (code: string, accept: boolean) => {
    setBusy(code);
    await respondFriend(code, accept);
    setBusy(null);
    onChange();
  };
  return (
    <section className="flex flex-col gap-2" data-testid="friend-requests">
      <h2 className="text-lg font-extrabold">{t("social.requests")}</h2>
      {list.map((c) => (
        <PlayerRow
          key={c.code}
          card={c}
          testId="friend-request"
          right={<ReportPlayerButton card={c} where="request" />}
          below={
            <span className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" disabled={busy === c.code} onClick={() => void answer(c.code, false)}>
                {t("social.requests.decline")}
              </Button>
              <Button size="sm" variant="success" disabled={busy === c.code} onClick={() => void answer(c.code, true)} data-testid="request-accept">
                {t("social.requests.accept")}
              </Button>
            </span>
          }
        />
      ))}
    </section>
  );
}

function FriendList({ list, onChange }: { list: PublicCard[] | null; onChange: () => void }) {
  const { t } = useT();
  const show = useShowName();
  const [menu, setMenu] = useState<PublicCard | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    await fn();
    setMenu(null);
    onChange();
  };
  return (
    <section className="flex flex-col gap-2" data-testid="friend-list">
      <h2 className="text-lg font-extrabold">{t("social.list")}</h2>
      {list && list.length === 0 && (
        <p className="rounded-3xl border-2 border-dashed border-border px-4 py-4 text-center text-sm font-semibold text-muted">{t("social.list.empty")}</p>
      )}
      {list?.map((c) => (
        <PlayerRow
          key={c.code}
          card={c}
          testId="friend-row"
          right={
            <span className="flex shrink-0 items-center">
              <ReportPlayerButton card={c} where="friend" onBlocked={onChange} />
              <button
                type="button"
                onClick={() => setMenu(c)}
                aria-label={t("social.friend.actions", { name: show(c) })}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2"
              >
                <MoreHorizontal size={20} aria-hidden />
              </button>
            </span>
          }
        />
      ))}
      <Modal open={!!menu} onClose={() => setMenu(null)} label={menu ? t("social.friend.actions", { name: show(menu) }) : undefined}>
        {menu && (
          <div className="flex flex-col gap-2 pb-[max(8px,env(safe-area-inset-bottom))]">
            <h2 className="mb-1 truncate text-xl font-extrabold">{show(menu)}</h2>
            <Button variant="secondary" block onClick={() => void act(() => removeFriend(menu.code))}>
              {t("social.friend.remove")}
            </Button>
            <Button variant="secondary" block onClick={() => void act(() => blockPlayer(menu.code))}>
              {t("social.friend.block")}
            </Button>
            <Button variant="ghost" block onClick={() => setMenu(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        )}
      </Modal>
    </section>
  );
}

function Settings({
  player,
  blocked,
  onPlayer,
  onEditName,
  onChange,
  onDeleted,
}: {
  player: MyPlayer;
  blocked: PublicCard[];
  onPlayer: (p: MyPlayer) => void;
  onEditName: () => void;
  onChange: () => void;
  onDeleted: () => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const show = useShowName();
  const [showBlocked, setShowBlocked] = useState(false);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleFt = async (ft: boolean) => {
    const r = await saveMe(profileInput(player.name, ft));
    if (r.ok && r.data) onPlayer(r.data.player);
  };
  const remove = async () => {
    setBusy(true);
    const r = await deleteMe();
    setBusy(false);
    if (!r.ok) return;
    setAsk(false);
    onDeleted();
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-extrabold">{t("social.settings")}</h2>
      <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-surface px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{t("social.name.current", { name: show(player) })}</span>
        <Button size="sm" variant="secondary" onClick={onEditName}>
          {t("social.name.change")}
        </Button>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-surface px-3 py-2">
        <span className="min-w-0 flex-1 text-sm font-bold">{t("social.ft")}</span>
        <Switch checked={player.ft} onChange={(v) => void toggleFt(v)} label={t("social.ft")} />
      </div>
      <div className="rounded-2xl border-2 border-border bg-surface">
        <button type="button" onClick={() => setShowBlocked((v) => !v)} aria-expanded={showBlocked} className="flex min-h-12 w-full items-center gap-2 px-3 text-left text-sm font-bold">
          <span className="flex-1">
            {t("social.blocked")} · {blocked.length}
          </span>
          <ChevronDown size={18} className={cn("text-muted transition-transform", showBlocked && "rotate-180")} aria-hidden />
        </button>
        {showBlocked && (
          <div className="flex flex-col gap-2 px-3 pb-3">
            {blocked.length === 0 && <p className="text-sm font-semibold text-muted">{t("social.blocked.empty")}</p>}
            {blocked.map((c) => (
              <PlayerRow
                key={c.code}
                card={c}
                right={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void blockPlayer(c.code, true).then(() => {
                        onChange();
                      })
                    }
                  >
                    {t("social.friend.unblock")}
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </div>
      <Button variant="ghost" block onClick={() => setAsk(true)} icon={<Trash2 size={18} />} className="text-ink-danger">
        {t("social.delete")}
      </Button>
      <Modal open={ask} onClose={() => setAsk(false)} label={t("social.delete.title")}>
        <div className="flex flex-col gap-3 pb-[max(8px,env(safe-area-inset-bottom))]">
          <h2 className="text-xl font-extrabold">{t("social.delete.title")}</h2>
          <p className="font-semibold text-muted">{t("social.delete.desc")}</p>
          <Button variant="danger" block disabled={busy} onClick={() => void remove()} data-testid="social-delete-yes">
            {t("common.delete")}
          </Button>
          <Button variant="ghost" block onClick={() => setAsk(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
