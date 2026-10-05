"use client";

import { useEffect, useState } from "react";
import { LESSON_META } from "@/content/catalog";
import { UNITS } from "@/content/course-map";
import type { ReadyLesson } from "@/lib/diagnostic";
import type { EntItem } from "@/lib/types";

// Банк заданий ЕНТ (тяжёлый) грузится отдельным куском после показа экрана: первый экран после онбординга должен
// открываться сразу. Готовые уроки карты (итогу — ссылки «Начать с неё») — из лёгкого каталога (этап 16).

export interface DiagnosticData {
  pool: readonly EntItem[];
  /** Готовые уроки карты в порядке курса. */
  ready: ReadyLesson[];
}

let cached: DiagnosticData | null = null;
let loading: Promise<DiagnosticData> | null = null;

function load(): Promise<DiagnosticData> {
  loading ??= import("@/content/ent")
    .then((ent) => {
      const ready = UNITS.flatMap((u) =>
        u.lessons.flatMap((r) => {
          const lesson = r.status === "available" ? LESSON_META[r.id] : undefined;
          return lesson ? [{ id: lesson.id, skills: lesson.skills, entTopics: lesson.entTopics, unit: u.id }] : [];
        }),
      );
      return (cached = { pool: ent.ENT_POOL, ready });
    })
    .catch((e: unknown) => {
      loading = null;
      throw e;
    });
  return loading;
}

/** Банк заданий и готовые уроки; data = null, пока грузятся, failed — не загрузились. */
export function useDiagnosticData(): { data: DiagnosticData | null; failed: boolean } {
  const [data, setData] = useState<DiagnosticData | null>(cached);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (data) return;
    let off = false;
    load()
      .then((d) => {
        if (!off) setData(d);
      })
      .catch(() => {
        if (!off) setFailed(true);
      });
    return () => {
      off = true;
    };
  }, [data]);
  return { data, failed };
}
