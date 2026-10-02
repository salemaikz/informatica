"use client";

import { FolderInput, GraduationCap, Pin, PinOff, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { getLesson } from "@/content/course";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { deleteImages } from "@/lib/note-images";
import { useApp } from "@/lib/store";
import { FolderPicker } from "./folder-ui";

function Row({ icon, children, onClick, danger }: { icon: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left font-extrabold hover:bg-surface-2", danger && "text-danger hover:bg-danger-soft")}
    >
      {icon}
      {children}
    </button>
  );
}

/** Меню записи: закрепить, переместить, спросить Бита, к уроку, удалить (с подтверждением). */
export function NoteMenu({ id, open, onClose, onDeleted }: { id: string; open: boolean; onClose: () => void; onDeleted: () => void }) {
  const { t } = useT();
  return (
    <Modal open={open} onClose={onClose} label={t("notes2.menu")}>
      {/* Внутренний шаг (главное меню / выбор папки / подтверждение) сбрасывается при каждом открытии. */}
      {open && <MenuBody id={id} onClose={onClose} onDeleted={onDeleted} />}
    </Modal>
  );
}

function MenuBody({ id, onClose, onDeleted }: { id: string; onClose: () => void; onDeleted: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const note = useApp((s) => s.notebook.notes.find((n) => n.id === id));
  const folders = useApp((s) => s.notebook.folders);
  const updateNote = useApp((s) => s.updateNote);
  const [step, setStep] = useState<"main" | "move" | "delete">("main");
  if (!note) return null;
  const lesson = note.lessonId ? getLesson(note.lessonId) : undefined;

  if (step === "move")
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-extrabold">{t("notes2.menu.move")}</h3>
        <FolderPicker
          folders={folders}
          value={note.folderId}
          onChange={(fid) => {
            updateNote(id, { folderId: fid });
            onClose();
          }}
        />
      </div>
    );

  if (step === "delete")
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-extrabold">{t("notes2.menu.delete")}</h3>
        <p className="font-semibold text-muted">{t("notes2.menu.deleteAsk")}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setStep("main")}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const ids = useApp.getState().deleteNote(id);
              void deleteImages(ids);
              onClose();
              onDeleted();
            }}
          >
            {t("notes2.menu.deleteYes")}
          </Button>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-1">
      <Row
        icon={note.pinned ? <PinOff size={20} aria-hidden /> : <Pin size={20} aria-hidden />}
        onClick={() => {
          updateNote(id, { pinned: !note.pinned });
          onClose();
        }}
      >
        {note.pinned ? t("notes2.menu.unpin") : t("notes2.menu.pin")}
      </Row>
      <Row icon={<FolderInput size={20} aria-hidden />} onClick={() => setStep("move")}>
        {t("notes2.menu.move")}
      </Row>
      <Row
        icon={<Sparkles size={20} aria-hidden className="text-ai" />}
        onClick={() => {
          onClose();
          router.push("/tutor");
        }}
      >
        <span className="text-ai">{t("notes2.menu.ask")}</span>
      </Row>
      {lesson && (
        <Row
          icon={<GraduationCap size={20} aria-hidden />}
          onClick={() => {
            onClose();
            router.push(`/notes/lesson/${lesson.id}`);
          }}
        >
          {t("notes2.menu.lesson")}
        </Row>
      )}
      <Row icon={<Trash2 size={20} aria-hidden />} danger onClick={() => setStep("delete")}>
        {t("notes2.menu.delete")}
      </Row>
    </div>
  );
}

