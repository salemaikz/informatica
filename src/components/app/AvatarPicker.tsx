"use client";

import { Check, Image as ImageIcon, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/i18n/useT";
import {
  AVATAR_COLORS,
  PHOTO_SIZE,
  PHOTO_TARGET_BYTES,
  centerSquare,
  dataUrlBytes,
  avatarInitial,
  defaultAvatar,
  isValidPhoto,
  nextQuality,
  sanitizeAvatar,
} from "@/lib/avatar";
import { cn } from "@/lib/cn";
import type { AvatarConfig } from "@/lib/types";
import { Avatar, avatarColorClass } from "./Avatar";
import { AVATAR_PRESETS } from "./avatars/presets";

type Tab = "presets" | "letter" | "photo";

/** Больше этого исходный файл не открываем: декодирование огромной картинки на слабом телефоне подвесит вкладку. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Квадратная обрезка по центру → JPEG 160×160 (0.8; если > 45 КБ — снижаем качество, потом размер). */
async function compressPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const { sx, sy, side } = centerSquare(img.naturalWidth, img.naturalHeight);
    for (const size of [PHOTO_SIZE, 128, 96]) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.fillStyle = "#fff"; // прозрачные PNG не должны стать чёрными
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      let q: number | null = 0.8;
      while (q !== null) {
        const data = canvas.toDataURL("image/jpeg", q);
        if (dataUrlBytes(data) <= PHOTO_TARGET_BYTES) return data;
        q = nextQuality(q);
      }
    }
    throw new Error("too large");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PickerBody({ value, name, onChange, onClose }: { value: AvatarConfig; name: string; onChange: (c: AvatarConfig) => void; onClose: () => void }) {
  const { t, l } = useT();
  // Черновик — из проверенной копии: value может прийти из старого/повреждённого сохранения.
  const [draft, setDraft] = useState<AvatarConfig>(() => sanitizeAvatar(value));
  const [tab, setTab] = useState<Tab>(() => {
    const kind = sanitizeAvatar(value).kind;
    return kind === "photo" ? "photo" : kind === "initial" ? "letter" : "presets";
  });
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Номер последнего выбранного файла: результат более раннего (медленного) сжатия не перетирает новый.
  const pickSeq = useRef(0);
  const uid = useId();

  const TABS: { id: Tab; label: string }[] = [
    { id: "presets", label: t("avatar.tab.presets") },
    { id: "letter", label: t("avatar.tab.letter") },
    { id: "photo", label: t("avatar.tab.photo") },
  ];

  const pickedPreset = draft.kind === "preset" ? AVATAR_PRESETS.find((p) => p.id === draft.id) : undefined;

  async function onFile(file: File | undefined) {
    if (!file) return;
    const seq = ++pickSeq.current;
    setError(false);
    if ((file.type && !file.type.startsWith("image/")) || file.size > MAX_FILE_BYTES) {
      setError(true);
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const data = await compressPhoto(file);
      if (!isValidPhoto(data)) throw new Error("bad photo");
      if (seq === pickSeq.current) setDraft({ kind: "photo", data });
    } catch {
      if (seq === pickSeq.current) setError(true);
    } finally {
      if (seq === pickSeq.current) setBusy(false);
    }
  }

  const tabId = (id: Tab) => `${uid}-tab-${id}`;
  const panelId = (id: Tab) => `${uid}-panel-${id}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar config={draft} name={name} size={64} />
        <h2 className="text-xl font-black">{t("avatar.title")}</h2>
      </div>

      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            id={tabId(x.id)}
            aria-controls={panelId(x.id)}
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={cn(
              "h-10 rounded-xl text-sm font-extrabold transition-colors focus-visible:outline-3 focus-visible:outline-primary",
              tab === x.id ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-text",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === "presets" && (
        <div role="tabpanel" id={panelId("presets")} aria-labelledby={tabId("presets")} className="flex flex-col gap-3">
          <div className="grid grid-cols-4 gap-3">
            {AVATAR_PRESETS.map((p) => {
              const on = draft.kind === "preset" && draft.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-label={l(p.label)}
                  aria-pressed={on}
                  onClick={() => setDraft({ kind: "preset", id: p.id })}
                  className={cn(
                    "relative mx-auto rounded-full p-[3px] transition-transform active:scale-95 focus-visible:outline-3 focus-visible:outline-primary",
                    on ? "ring-4 ring-primary" : "ring-2 ring-border hover:ring-primary/50",
                  )}
                >
                  <Avatar config={{ kind: "preset", id: p.id }} name={name} size={56} />
                  {on && (
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-action-primary text-white">
                      <Check size={14} strokeWidth={3.5} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="min-h-6 text-center text-sm font-bold text-muted" aria-live="polite">
            {pickedPreset ? l(pickedPreset.label) : ""}
          </p>
        </div>
      )}

      {tab === "letter" && (
        <div role="tabpanel" id={panelId("letter")} aria-labelledby={tabId("letter")} className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-muted">{t("avatar.letter.hint")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {AVATAR_COLORS.map((color) => {
              const on = draft.kind === "initial" && draft.color === color;
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={t(`avatar.color.${color}`)}
                  aria-pressed={on}
                  onClick={() => setDraft({ kind: "initial", color })}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full text-lg font-extrabold transition-transform active:scale-95 focus-visible:outline-3 focus-visible:outline-primary",
                    avatarColorClass(color),
                    on ? "ring-4 ring-primary" : "ring-2 ring-border",
                  )}
                >
                  {on ? <Check size={20} strokeWidth={3.5} /> : avatarInitial(name)}
                </button>
              );
            })}
          </div>
          {draft.kind === "initial" && <p className="text-center text-sm font-bold text-muted">{t(`avatar.color.${draft.color}`)}</p>}
        </div>
      )}

      {tab === "photo" && (
        <div role="tabpanel" id={panelId("photo")} aria-labelledby={tabId("photo")} className="flex flex-col items-center gap-3">
          {draft.kind === "photo" ? (
            <Avatar config={draft} name={name} size={120} className="ring-4 ring-border" />
          ) : (
            <span className="flex h-[120px] w-[120px] items-center justify-center rounded-full border-2 border-dashed border-border bg-surface-2 text-muted">
              <ImageIcon size={36} />
            </span>
          )}
          <p className="text-center text-sm font-semibold text-muted">{t("avatar.photo.hint")}</p>
          {error && (
            <p role="alert" className="text-center text-sm font-bold text-danger">
              {t("avatar.photo.error")}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" icon={<ImageIcon size={18} />} disabled={busy} aria-busy={busy} onClick={() => fileRef.current?.click()}>
              {draft.kind === "photo" ? t("avatar.photo.change") : t("avatar.photo.choose")}
            </Button>
            {draft.kind === "photo" && (
              <Button variant="ghost" icon={<Trash2 size={18} />} disabled={busy} onClick={() => setDraft(defaultAvatar())}>
                {t("avatar.photo.remove")}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onClose}>
          {t("avatar.cancel")}
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            onChange(draft);
            onClose();
          }}
        >
          {t("avatar.save")}
        </Button>
      </div>
    </div>
  );
}

/** Окно выбора аватара. Стор не трогает: по «Сохранить» отдаёт новую конфигурацию в onChange. */
export function AvatarPicker({
  value,
  name,
  onChange,
  onClose,
  open,
}: {
  value: AvatarConfig;
  name: string;
  onChange: (config: AvatarConfig) => void;
  onClose: () => void;
  open: boolean;
}) {
  const { t } = useT();
  return (
    <Modal open={open} onClose={onClose} label={t("avatar.title")}>
      <PickerBody value={value} name={name} onChange={onChange} onClose={onClose} />
    </Modal>
  );
}
