"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { checkNameFormat, cleanName, type NameFail } from "@/lib/moderation/name-format";
import { saveMe } from "@/lib/social/client";
import { playerTag, type MyPlayer } from "@/lib/social/view";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { profileInput } from "./useSocial";

// Имя для соревнований (этап 16Д, Ф3; docs/specs/duels.md §7). Подставляем имя из профиля; формат проверяем сразу (общий
// name-format.ts), стоп-слова — только сервер (checkName). Не прошло на сервере — ученика видят как «Игрок 1234»; отклонённое
// слово не показываем нигде (поле очищается).

const FAIL_KEY: Partial<Record<NameFail, DictKey>> = {
  short: "social.name.err.short",
  long: "social.name.err.long",
  chars: "social.name.err.chars",
  script_mix: "social.name.err.script_mix",
  digits: "social.name.err.digits",
  contact: "social.name.err.contact",
  reserved: "social.name.err.reserved",
};

export function NameForm({
  player,
  onDone,
  onCancel,
}: {
  /** Текущий профиль (смена имени) или null (первый раз). */
  player: MyPlayer | null;
  onDone: (p: MyPlayer, note?: DictKey) => void;
  onCancel?: () => void;
}) {
  const { t } = useT();
  const profileName = useApp((s) => s.profile.name);
  const [name, setName] = useState(() => (player?.name ?? cleanName(profileName ?? "")).slice(0, 16));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (raw: string | null) => {
    if (busy) return;
    if (raw !== null) {
      const fmt = checkNameFormat(raw);
      if (!fmt.ok) {
        setError(t(FAIL_KEY[fmt.code] ?? "social.name.err.chars"));
        return;
      }
    }
    setBusy(true);
    setError(null);
    const r = await saveMe(profileInput(raw, player?.ft ?? true));
    setBusy(false);
    if (!r.ok || !r.data) {
      setError(t(r.status === 429 ? "social.rate" : "social.error"));
      return;
    }
    const { player: p, hint } = r.data;
    if (hint === "limit" || hint === "locked") {
      setError(t(hint === "limit" ? "social.name.limit" : "social.name.locked"));
      return;
    }
    if (p.nameState === "rejected") {
      // Отклонённое слово не показываем: поле очищаем, ученика видят под номером.
      setName("");
      onDone(p, "social.name.rejected");
      return;
    }
    onDone(p);
  };

  const tag = t("social.player", { n: playerTag(player?.code ?? "XXXXXXXX") });
  return (
    <form
      className="flex flex-col gap-3"
      data-testid="social-name-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(name);
      }}
    >
      <h2 className="text-xl font-extrabold">{t("social.name.title")}</h2>
      <p className="text-sm font-semibold text-muted">{t("social.name.desc")}</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-extrabold text-muted">{t("social.name.label")}</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value.slice(0, 40));
            setError(null);
          }}
          maxLength={40}
          autoComplete="nickname"
          enterKeyHint="done"
          data-testid="social-name-input"
          className="h-12 w-full rounded-2xl border-2 border-border bg-surface px-3 text-base font-semibold text-text focus:border-primary/40 focus:outline-none"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-ink-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" block disabled={busy || !name.trim()} data-testid="social-name-save">
        {t("common.save")}
      </Button>
      <Button type="button" variant="ghost" block disabled={busy} onClick={() => void submit(null)}>
        {t("social.name.skip")}
      </Button>
      {player && <p className="text-center text-xs font-semibold text-muted">{t("social.name.skipHint", { tag })}</p>}
      {onCancel && (
        <Button type="button" variant="ghost" block onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      )}
    </form>
  );
}
