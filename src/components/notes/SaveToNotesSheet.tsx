"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { NoteImageError, putImage } from "@/lib/note-images";
import { noteSnippet } from "@/lib/note-markdown";
import { NOTE_LIMITS, folderForSource, titleFromBody, type FolderColor } from "@/lib/notebook";
import { useApp } from "@/lib/store";
import { ColorPicker, FolderPicker, useFolderName } from "./folder-ui";
import { useSaveToNotes, type SaveToNotesPayload } from "./saveToNotesBus";

/** PNG слишком тяжёлый — перекодируем в JPEG на белом фоне (картинки конспектов — до 3 МБ). */
function toJpeg(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("no-canvas"));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("bad-image"));
    img.src = dataUrl;
  });
}

interface Saved {
  noteId: string;
  folder: string;
}

/**
 * Шторка «Сохранить в конспект»: открывается по useSaveToNotes.open(payload) из любого места приложения.
 * Монтируется один раз (Providers) и без пропсов. После сохранения показывает тост «Сохранено в “Папку”» с кнопкой «Открыть».
 */
export function SaveToNotesSheet() {
  const { t } = useT();
  const router = useRouter();
  const payload = useSaveToNotes((s) => s.payload);
  const close = useSaveToNotes((s) => s.close);
  // Последняя открытая порция данных: пока шторка уезжает вниз, содержимое не должно пропасть.
  const [shown, setShown] = useState<{ p: SaveToNotesPayload; key: number } | null>(null);
  if (payload && payload !== shown?.p) setShown({ p: payload, key: (shown?.key ?? 0) + 1 });
  const [toast, setToast] = useState<Saved | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <>
      <Modal open={!!payload} onClose={close} label={t("notes2.save.title")}>
        {shown && (
          <SheetBody
            key={shown.key}
            payload={shown.p}
            onClose={close}
            onSaved={(s) => {
              setToast(s);
              close();
            }}
          />
        )}
      </Modal>
      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-text px-4 py-3 text-surface shadow-2xl lg:bottom-6">
          <Check size={20} className="shrink-0 text-success" aria-hidden />
          <span className="line-clamp-3 min-w-0 flex-1 text-sm font-bold">{t("notes2.save.done", { folder: toast.folder })}</span>
          <button
            type="button"
            onClick={() => {
              router.push(`/notes/${toast.noteId}`);
              setToast(null);
            }}
            className="h-10 shrink-0 rounded-xl bg-surface/15 px-3 font-extrabold hover:bg-surface/25"
          >
            {t("notes2.save.open")}
          </button>
          <button type="button" onClick={() => setToast(null)} aria-label={t("common.close")} className="-mr-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-surface/15">
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}

function SheetBody({ payload, onClose, onSaved }: { payload: SaveToNotesPayload; onClose: () => void; onSaved: (s: Saved) => void }) {
  const { t } = useT();
  const folders = useApp((s) => s.notebook.folders);
  const createFolder = useApp((s) => s.createFolder);
  const createNote = useApp((s) => s.createNote);
  const nameOf = useFolderName();
  const [title, setTitle] = useState(
    () => payload.title ?? (titleFromBody(payload.text ?? "") || t(`notes2.save.title.${payload.source}` as DictKey)),
  );
  const [folderId, setFolderId] = useState(() => folderForSource(payload.source, payload.lessonId));
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<FolderColor>("primary");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const full = folders.length >= NOTE_LIMITS.folders;
  const canSave = !busy && (!creating || newName.trim().length > 0);

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    let images: string[] | undefined;
    let body = payload.text ?? "";
    if (payload.image) {
      try {
        let id: string;
        try {
          id = await putImage(payload.image);
        } catch (e) {
          if (!(e instanceof NoteImageError && e.reason === "size")) throw e;
          id = await putImage(await toJpeg(payload.image));
        }
        images = [id];
        body = `${body.trimEnd()}${body.trim() ? "\n\n" : ""}![](note-img:${id})`;
      } catch {
        setError(t("notes2.save.error"));
        setBusy(false);
        return;
      }
    }
    const target = creating ? createFolder(newName, newColor) : folderId;
    const noteId = createNote({
      folderId: target,
      title: title.trim() || undefined,
      body,
      lessonId: payload.lessonId,
      source: payload.source,
      images,
    });
    const folder = useApp.getState().notebook.folders.find((f) => f.id === target);
    onSaved({ noteId, folder: folder ? nameOf(folder) : "" });
  };

  const preview = payload.text ? noteSnippet(payload.text, 280) : "";

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-extrabold">{t("notes2.save.title")}</h3>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-extrabold text-muted">{t("notes2.save.titleLabel")}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, NOTE_LIMITS.title))}
          maxLength={NOTE_LIMITS.title}
          className="h-12 rounded-2xl border-2 border-border bg-surface px-3 font-semibold outline-none focus:border-primary"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-extrabold text-muted">{t("notes2.save.folder")}</span>
        <FolderPicker
          folders={folders}
          value={creating ? "" : folderId}
          onChange={(id) => {
            setFolderId(id);
            setCreating(false);
          }}
          onNew={full ? undefined : () => setCreating(true)}
        />
        {creating && (
          <div className="mt-1 flex flex-col gap-3 rounded-2xl border-2 border-primary/30 bg-primary-soft p-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value.slice(0, NOTE_LIMITS.folderName))}
              placeholder={t("notes2.folder.namePlaceholder")}
              aria-label={t("notes2.folder.name")}
              autoFocus
              maxLength={NOTE_LIMITS.folderName}
              className="h-11 rounded-xl border-2 border-border bg-surface px-3 font-semibold outline-none focus:border-primary"
            />
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
        )}
      </div>

      {(payload.image || preview) && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-extrabold text-muted">{t("notes2.save.preview")}</span>
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-border bg-surface-2 p-3">
            {payload.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={payload.image} alt="" className="max-h-40 w-full rounded-xl bg-white object-contain" />
            )}
            {preview && <p className="line-clamp-5 text-sm font-semibold text-muted">{preview}</p>}
          </div>
        </div>
      )}

      {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">{error}</p>}
      {/* Кнопки всегда на виду, даже когда шторка прокручивается. */}
      <div className="sticky bottom-[-1.25rem] -mx-5 grid grid-cols-2 gap-2 bg-surface px-5 pb-1 pt-2">
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button disabled={!canSave} onClick={() => void save()}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
