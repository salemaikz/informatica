"use client";

import { Row, Segmented } from "@/components/goals/controls";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { MUSIC_TRACK_PREFS, type MusicTrackPref } from "@/lib/music-pref";
import { useApp } from "@/lib/store";

/** Строка профиля «Фоновая музыка»: вкл/выкл и выбор трека (авто — по занятию). По умолчанию выключено. */
export function MusicRow() {
  const { t } = useT();
  const music = useApp((s) => s.profile.music);
  const sound = useApp((s) => s.profile.sound);
  const update = useApp((s) => s.updateProfile);
  return (
    <div data-testid="music-row">
      <Row label={t("music.title")} hint={t(music.enabled && !sound ? "music.needSound" : "music.hint")}>
        <div className="flex flex-col gap-2">
          <Segmented<string>
            label={t("music.title")}
            value={music.enabled ? "on" : "off"}
            onChange={(v) => update({ music: { ...music, enabled: v === "on" } })}
            options={[
              { id: "on", label: t("common.on") },
              { id: "off", label: t("common.off") },
            ]}
          />
          {music.enabled && (
            <Segmented<MusicTrackPref>
              label={t("music.track")}
              value={music.track}
              onChange={(track) => update({ music: { ...music, track } })}
              options={MUSIC_TRACK_PREFS.map((id) => ({ id, label: t(`music.track.${id}` as DictKey) }))}
            />
          )}
        </div>
      </Row>
    </div>
  );
}
