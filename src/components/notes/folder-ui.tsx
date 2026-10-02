"use client";

import { Check, Folder, GraduationCap, NotebookPen, PencilLine, Plus, Sparkles, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { cn } from "@/lib/cn";
import { NOTE_LIMITS, type FolderColor, type NoteFolder, type SystemFolder } from "@/lib/notebook";
import { useApp } from "@/lib/store";

export const FOLDER_COLORS: FolderColor[] = ["primary", "success", "warning", "danger", "ai", "gold", "streak", "muted"];

/** Классы указаны целиком — Tailwind собирает только то, что видит в исходниках. */
export const FOLDER_STYLE: Record<FolderColor, { card: string; dot: string; ring: string }> = {
  primary: { card: "border-primary/30 bg-primary-soft text-primary", dot: "bg-primary", ring: "ring-primary" },
  success: { card: "border-success/30 bg-success-soft text-success-strong", dot: "bg-success", ring: "ring-success" },
  warning: { card: "border-warning/30 bg-warning-soft text-warning-strong", dot: "bg-warning", ring: "ring-warning" },
  danger: { card: "border-danger/30 bg-danger-soft text-danger-strong", dot: "bg-danger", ring: "ring-danger" },
  ai: { card: "border-ai/30 bg-ai-soft text-ai", dot: "bg-ai", ring: "ring-ai" },
  gold: { card: "border-gold/40 bg-gold-soft text-warning-strong", dot: "bg-gold", ring: "ring-gold" },
  streak: { card: "border-streak/30 bg-streak-soft text-streak", dot: "bg-streak", ring: "ring-streak" },
  muted: { card: "border-border bg-surface-2 text-muted", dot: "bg-muted", ring: "ring-muted" },
};

const SYSTEM_ICON: Record<SystemFolder, LucideIcon> = {
  general: NotebookPen,
  lessons: GraduationCap,
  ai: Sparkles,
  scratch: PencilLine,
};

export function FolderIcon({ folder, size = 22 }: { folder: Pick<NoteFolder, "system">; size?: number }) {
  const Icon = folder.system ? SYSTEM_ICON[folder.system] : Folder;
  return <Icon size={size} aria-hidden />;
}

/** Название папки: у системных — из словаря, у остальных — своё. */
export function useFolderName() {
  const { t } = useT();
  return useCallback(
    (f: Pick<NoteFolder, "name" | "system">) => (f.system ? t(`notes2.folder.${f.system}` as DictKey) : f.name.trim() || t("notes2.folder.untitled")),
    [t],
  );
}

/** Плитка папки (сетка 2×N на главной). */
export function FolderTile({ folder, count }: { folder: NoteFolder; count: number }) {
  const { t } = useT();
  const name = useFolderName()(folder);
  return (
    <Link
      href={`/notes/folder/${encodeURIComponent(folder.id)}`}
      className={cn(
        "flex min-h-[5.5rem] flex-col justify-between gap-2 rounded-3xl border-2 p-3.5 transition-transform active:scale-[0.98]",
        FOLDER_STYLE[folder.color].card,
      )}
    >
      <FolderIcon folder={folder} size={26} />
      <span className="min-w-0">
        <span className="line-clamp-2 font-extrabold leading-tight break-words text-text">{name}</span>
        <span className="block text-xs font-bold opacity-80">{t("notes2.notesCount", { n: count })}</span>
      </span>
    </Link>
  );
}

/** Выбор папки сеткой (шторка сохранения, перемещение записи). */
export function FolderPicker({
  folders,
  value,
  onChange,
  onNew,
}: {
  folders: NoteFolder[];
  value: string;
  onChange: (id: string) => void;
  /** Показать плитку «Новая папка…». */
  onNew?: () => void;
}) {
  const { t } = useT();
  const nameOf = useFolderName();
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("notes2.save.folder")}>
      {folders.map((f) => {
        const on = f.id === value;
        return (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(f.id)}
            className={cn(
              "flex min-h-12 items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left font-bold transition-colors",
              on ? cn(FOLDER_STYLE[f.color].card, "ring-2", FOLDER_STYLE[f.color].ring) : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            <span className={cn("shrink-0", on ? "" : "text-muted")}>
              <FolderIcon folder={f} size={20} />
            </span>
            <span className={cn("line-clamp-2 min-w-0 flex-1 leading-tight break-words", on && "text-text")}>{nameOf(f)}</span>
            {on && <Check size={16} aria-hidden className="shrink-0" />}
          </button>
        );
      })}
      {onNew && (
        <button
          type="button"
          onClick={onNew}
          className="flex min-h-12 items-center gap-2 rounded-2xl border-2 border-dashed border-border px-3 py-2 text-left font-bold text-muted hover:bg-surface-2 hover:text-text"
        >
          <Plus size={20} aria-hidden /> <span className="truncate">{t("notes2.folder.newDots")}</span>
        </button>
      )}
    </div>
  );
}

/** Выбор цвета папки. */
export function ColorPicker({ value, onChange }: { value: FolderColor; onChange: (c: FolderColor) => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("notes2.folder.color")}>
      {FOLDER_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={t(`notes2.color.${c}` as DictKey)}
          title={t(`notes2.color.${c}` as DictKey)}
          onClick={() => onChange(c)}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full border-2 border-surface text-white ring-2 ring-transparent transition-shadow",
            FOLDER_STYLE[c].dot,
            value === c && cn("ring-offset-2 ring-offset-surface", FOLDER_STYLE[c].ring),
          )}
        >
          {value === c && <Check size={18} aria-hidden />}
        </button>
      ))}
    </div>
  );
}

/** Шторка «Новая папка» / «Изменить папку» (название, цвет, удаление). */
export function FolderSheet({
  open,
  onClose,
  folder,
  onCreated,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  /** Без папки — создание. */
  folder?: NoteFolder;
  onCreated?: (id: string) => void;
  onDeleted?: () => void;
}) {
  const { t } = useT();
  return (
    <Modal open={open} onClose={onClose} label={folder ? t("notes2.folder.edit") : t("notes2.folder.new")}>
      {/* Внутренняя часть пересоздаётся при каждом открытии — поля начинают с актуальных значений. */}
      {open && <FolderForm key={folder?.id ?? "new"} folder={folder} onClose={onClose} onCreated={onCreated} onDeleted={onDeleted} />}
    </Modal>
  );
}

function FolderForm({
  folder,
  onClose,
  onCreated,
  onDeleted,
}: {
  folder?: NoteFolder;
  onClose: () => void;
  onCreated?: (id: string) => void;
  onDeleted?: () => void;
}) {
  const { t } = useT();
  const createFolder = useApp((s) => s.createFolder);
  const updateFolder = useApp((s) => s.updateFolder);
  const deleteFolder = useApp((s) => s.deleteFolder);
  const full = useApp((s) => s.notebook.folders.length >= NOTE_LIMITS.folders);
  const [name, setName] = useState(folder?.name ?? "");
  const [color, setColor] = useState<FolderColor>(folder?.color ?? "primary");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const system = !!folder?.system;
  const canSave = system ? true : name.trim().length > 0 && (!!folder || !full);

  const save = () => {
    if (!canSave) return;
    if (folder) updateFolder(folder.id, system ? { color } : { name, color });
    else onCreated?.(createFolder(name, color));
    onClose();
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-extrabold">{folder ? t("notes2.folder.edit") : t("notes2.folder.new")}</h3>
      {system ? (
        <p className="rounded-2xl bg-surface-2 px-3 py-2 text-sm font-semibold text-muted">{t("notes2.folder.system")}</p>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-extrabold text-muted">{t("notes2.folder.name")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, NOTE_LIMITS.folderName))}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder={t("notes2.folder.namePlaceholder")}
            autoFocus
            maxLength={NOTE_LIMITS.folderName}
            className="h-12 rounded-2xl border-2 border-border bg-surface px-3 font-semibold outline-none focus:border-primary"
          />
        </label>
      )}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-extrabold text-muted">{t("notes2.folder.color")}</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      {!folder && full && <p className="text-sm font-bold text-warning-strong">{t("notes2.folder.limit")}</p>}
      <Button block size="lg" disabled={!canSave} onClick={save}>
        {folder ? t("common.save") : t("notes2.folder.create")}
      </Button>
      {folder && !system && (
        <div className="border-t-2 border-border pt-3">
          {confirmDelete ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-muted">{t("notes2.folder.deleteAsk")}</p>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => {
                    deleteFolder(folder.id);
                    onClose();
                    onDeleted?.();
                  }}
                >
                  {t("notes2.folder.deleteYes")}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex h-11 items-center gap-2 rounded-xl px-2 font-extrabold text-danger hover:bg-danger-soft"
            >
              <Trash2 size={18} aria-hidden /> {t("common.delete")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
