"use client";

import dynamic from "next/dynamic";
import type { Lang } from "@/lib/types";

// Remotion грузим лениво — только когда ученик дошёл до шага с видео.
const PlayerInner = dynamic(() => import("./PlayerInner"), {
  ssr: false,
  loading: () => <div className="aspect-square w-full animate-pulse rounded-3xl bg-surface-2" />,
});

export function LessonVideo({ videoId, lang, title }: { videoId: string; lang: Lang; title?: string }) {
  return <PlayerInner videoId={videoId} lang={lang} title={title} />;
}
