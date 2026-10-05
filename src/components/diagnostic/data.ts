"use client";

import { useEffect, useState } from "react";
import type { ReadyLesson } from "@/lib/diagnostic";
import type { EntItem } from "@/lib/types";

// Данные диагностики грузятся отдельным куском после показа экрана: банк заданий ЕНТ (тяжёлый) и карта курса
// (нужна только итогу — ссылкам «Начать с неё»). Статически их не импортируем: первый экран после онбординга должен открываться сразу.

export interface DiagnosticData {
  pool: readonly EntItem[];
  /** Готовые уроки карты в порядке курса. */
  ready: ReadyLesson[];
}

let cached: DiagnosticData | null = null;
let loading: Promise<DiagnosticData> | null = null;

function load(): Promise<DiagnosticData> {
  loading ??= Promise.all([import("@/content/ent"), import("@/content/course")])
    .then(([ent, course]) => {
      const ready = course.UNITS.flatMap((u) =>
        u.lessons.flatMap((r) => {
          const lesson = r.status === "available" ? course.getLesson(r.id) : undefined;
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
