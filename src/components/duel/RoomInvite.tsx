"use client";

import { Swords, Users } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n/useT";
import { Button, ButtonLink } from "@/components/ui/Button";
import { HeartCost } from "@/components/economy/HeartCost";
import { ENTRY_COST } from "@/lib/economy";
import { LivePlay } from "./LivePlay";

// Ссылка друга /duel/r/<код> (этап 16Д, Ф4; docs/specs/duels.md §1, §9): сначала приглашение и кнопка «Войти в бой».
// Профиль игрока и вход в комнату — только по нажатию (POST): превью мессенджера и проверяльщики ссылок, исполняющие JS,
// не займут место друга.

export function RoomInvite({ code }: { code: string }) {
  const { t } = useT();
  const [go, setGo] = useState(false);
  if (go) return <LivePlay start={{ kind: "join", code }} />;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 pb-[max(16px,env(safe-area-inset-bottom))] text-center" data-testid="duel-room-invite">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-ink-primary">
        <Users size={32} aria-hidden />
      </span>
      <h1 className="text-2xl font-extrabold">{t("duel.room.invite")}</h1>
      <p className="max-w-sm font-semibold text-muted">{t("duel.room.invite.desc")}</p>
      <p className="rounded-full bg-surface-2 px-3 py-1 font-mono text-sm font-extrabold tracking-[0.2em]">{code}</p>
      <div className="flex w-full max-w-sm flex-col gap-2">
        <Button size="lg" block icon={<Swords size={20} />} onClick={() => setGo(true)} data-testid="duel-room-enter">
          {t("duel.room.enter")}
          <HeartCost n={ENTRY_COST.duel} variant="solid" />
        </Button>
        <ButtonLink href="/duel" variant="ghost" block>
          {t("duel.toHub")}
        </ButtonLink>
      </div>
    </div>
  );
}
