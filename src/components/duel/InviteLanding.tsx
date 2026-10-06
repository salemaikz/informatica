"use client";

import { Check, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { acceptInvite, getInvite, socialStateOf, type JoinStatus } from "@/lib/social/client";
import type { PublicCard } from "@/lib/duel/types";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Mascot } from "@/components/mascot/Mascot";
import { LevelBadge } from "@/components/app/LevelBadge";
import { TitleTag } from "@/components/cosmetics/TitleTag";
import { NameForm } from "@/components/social/NameForm";
import { PlayerAvatar, useShowName } from "@/components/social/PlayerCard";
import { ReportPlayerButton } from "@/components/social/ReportPlayerButton";

// Приглашение в друзья по ссылке /f/<token> (этап 16Д, Ф3; docs/specs/duels.md §1, §6). Открытие страницы ничего не меняет
// (превью мессенджера и боты никого не добавят) — дружба появляется только по кнопке «Добавить в друзья» (POST).
// Нет профиля игрока — сначала имя (NameForm), потом добавление.

type State =
  | { s: "loading" }
  | { s: "gone"; key: DictKey }
  | { s: "view"; from: PublicCard; self: boolean; note?: DictKey }
  | { s: "name"; from: PublicCard }
  | { s: "done"; from: PublicCard; status: JoinStatus };

export function InviteLanding({ token }: { token: string }) {
  const router = useRouter();
  const { t } = useT();
  const show = useShowName();
  const [state, setState] = useState<State>({ s: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    void getInvite(token, ctl.signal).then((r) => {
      if (ctl.signal.aborted) return;
      if (r.ok && r.data) setState({ s: "view", from: r.data.from, self: r.data.self });
      else if (r.status === 404) setState({ s: "gone", key: "social.join.expired" });
      else setState({ s: "gone", key: socialStateOf(r) === "off" ? "social.off.title" : "social.down" });
    });
    return () => ctl.abort();
  }, [token]);

  const join = async (from: PublicCard) => {
    if (busy) return;
    setBusy(true);
    const r = await acceptInvite(token);
    setBusy(false);
    if (r.status === 401) return setState({ s: "name", from });
    if (!r.ok || !r.data) return setState({ s: "view", from, self: false, note: r.status === 429 ? "social.rate" : "social.error" });
    if (r.data === "expired") return setState({ s: "gone", key: "social.join.expired" });
    if (r.data === "self") return setState({ s: "view", from, self: true });
    if (r.data === "limit") return setState({ s: "view", from, self: false, note: "social.add.limit" });
    setState({ s: "done", from, status: r.data });
  };

  const close = () => router.replace("/duel");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-md items-center px-4">
        <button type="button" onClick={close} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
          <X size={24} />
        </button>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-[max(24px,env(safe-area-inset-bottom))]" data-testid="invite-landing">
        {state.s === "loading" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <Mascot mood="thinking" size={88} />
            <p className="font-bold text-muted" role="status">
              {t("common.loading")}
            </p>
          </div>
        )}
        {state.s === "gone" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <Mascot mood="sad" size={88} />
            <p className="max-w-sm font-bold">{t(state.key)}</p>
            <Button variant="ghost" onClick={close}>
              {t("duel.toHub")}
            </Button>
          </div>
        )}
        {state.s === "name" && (
          <>
            <NameForm player={null} onDone={() => void join(state.from)} onCancel={() => setState({ s: "view", from: state.from, self: false })} />
            <p className="text-center text-xs font-semibold text-muted">{t("social.device")}</p>
          </>
        )}
        {(state.s === "view" || state.s === "done") && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm font-extrabold uppercase text-muted">{t("social.join.title")}</p>
            <PlayerAvatar card={state.from} size={80} />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <LevelBadge level={state.from.lv} size="sm" />
              <TitleTag title={state.from.title} size="md" />
            </div>
            <h1 className="max-w-full text-xl font-extrabold [overflow-wrap:anywhere]" data-testid="invite-from">
              {t("social.join.desc", { name: show(state.from) })}
            </h1>
            {state.s === "done" ? (
              <>
                <p className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-2 font-extrabold text-ink-success" role="status" data-testid="invite-done">
                  <Check size={18} aria-hidden />
                  {t(state.status === "already" ? "social.add.already" : "social.add.accepted")}
                </p>
                <ButtonLink href="/duel/friends" replace size="lg" block>
                  {t("social.join.toFriends")}
                </ButtonLink>
              </>
            ) : state.self ? (
              <p className="rounded-2xl bg-surface-2 px-4 py-3 font-bold text-muted">{t("social.join.self")}</p>
            ) : (
              <>
                {state.note && (
                  <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-ink-danger">
                    {t(state.note)}
                  </p>
                )}
                <Button size="lg" block disabled={busy} onClick={() => void join(state.from)} icon={<UserPlus size={20} />} data-testid="invite-accept">
                  {t("social.join.add")}
                </Button>
                <ReportPlayerButton card={state.from} where="invite" label />
              </>
            )}
            <p className="text-xs font-semibold text-muted">{t("social.device")}</p>
          </div>
        )}
      </main>
    </div>
  );
}
