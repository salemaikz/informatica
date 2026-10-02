"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/useT";
import { getImage } from "@/lib/note-images";

/** Картинка конспекта из IndexedDB: пока грузится — плейсхолдер, нет на этом устройстве — спокойная заглушка. */
export function NoteImage({ id, alt }: { id: string; alt?: string }) {
  const { t } = useT();
  const [res, setRes] = useState<{ id: string; src?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void getImage(id).then((src) => {
      if (alive) setRes({ id, src });
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (res?.id !== id) return <span className="my-2 block h-32 animate-pulse rounded-2xl bg-surface-2" aria-hidden />;
  if (!res.src)
    return (
      <span className="my-2 flex items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface-2 px-3 py-4 text-sm font-semibold text-muted">
        <ImageOff size={18} aria-hidden /> {t("notes2.imgMissing")}
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={res.src} alt={alt ?? ""} className="my-2 block h-auto max-w-full rounded-2xl border-2 border-border bg-white" />;
}
