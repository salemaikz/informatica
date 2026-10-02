"use client";

import { GraduationCap } from "lucide-react";
import type { Grade, Track } from "@/lib/types";
import { SCHOOL_GRADES } from "@/lib/school";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Row, Segmented } from "@/components/goals/controls";

// Настройки программы обучения для профиля: трек (ЕНТ / Школа) и класс. Вставляется в профиль.

export function TrackSettings() {
  const { t } = useT();
  const track = useApp((s) => s.profile.track);
  const grade = useApp((s) => s.profile.grade);
  const updateProfile = useApp((s) => s.updateProfile);

  const tracks: { id: Track; label: string }[] = [
    { id: "ent", label: t("school.track.ent") },
    { id: "school", label: t("school.track.school") },
  ];
  const grades: { id: Grade; label: string }[] = [
    ...SCHOOL_GRADES.map((g) => ({ id: g as Grade, label: g })),
    { id: "other", label: t("onb.grade.other") },
  ];

  return (
    <section className="rounded-3xl border-2 border-border bg-surface p-4 sm:p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-extrabold">
        <GraduationCap size={20} className="text-primary" /> {t("school.settings.title")}
      </h2>
      <div className="divide-y-2 divide-border">
        <Row label={t("school.settings.track")} hint={track === "school" ? t("school.settings.track.school") : t("school.settings.track.ent")}>
          <Segmented value={track} options={tracks} onChange={(v) => updateProfile({ track: v })} label={t("school.track.label")} />
        </Row>
        <Row label={t("school.settings.grade")} hint={t("school.settings.grade.hint")}>
          <Segmented value={grade} options={grades} onChange={(v) => updateProfile({ grade: v })} label={t("school.settings.grade")} />
        </Row>
      </div>
    </section>
  );
}
