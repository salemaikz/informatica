"use client";

import { useRef, useState } from "react";
import { DrawingCanvas, type DrawingHandle } from "@/components/lesson/DrawingCanvas";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/i18n/useT";

/** Модалка с холстом: нарисовал → «Вставить в запись» → PNG на белом фоне (exportPaper). */
export function DrawingModal({ open, onClose, onInsert }: { open: boolean; onClose: () => void; onInsert: (dataUrl: string) => void }) {
  const { t } = useT();
  return (
    <Modal open={open} onClose={onClose} label={t("notes2.draw.title")} className="sm:max-w-xl">
      {/* Холст создаётся заново при каждом открытии — чистый лист. */}
      {open && <DrawingBody onClose={onClose} onInsert={onInsert} />}
    </Modal>
  );
}

function DrawingBody({ onClose, onInsert }: { onClose: () => void; onInsert: (dataUrl: string) => void }) {
  const { t } = useT();
  const canvas = useRef<DrawingHandle>(null);
  const [empty, setEmpty] = useState(true);
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-extrabold">{t("notes2.draw.title")}</h3>
      <DrawingCanvas ref={canvas} onChange={setEmpty} height={300} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          disabled={empty}
          onClick={() => {
            const url = canvas.current?.exportPaper();
            if (!url) return;
            onInsert(url);
            onClose();
          }}
        >
          {t("notes2.draw.insert")}
        </Button>
      </div>
    </div>
  );
}
