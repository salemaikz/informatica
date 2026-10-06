"use client";

import { ArrowDownToLine, ArrowRightToLine, CheckCheck, Eraser, Eye, EyeOff, Minus, MousePointerClick, Plus, TriangleAlert } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EntryNote, PaidLabel } from "@/components/ide/EntryPrice";
import { cn } from "@/lib/cn";
import { checkExcel, describeSheetError } from "@/lib/ide/excel/check";
import type { WorkspaceProps } from "@/lib/ide/types";
import {
  addrOf,
  evaluateSheet,
  fillCells,
  formatValue,
  formulaRefs,
  GRID_COLS,
  GRID_ROWS,
  isError,
  isFormula,
  parseAddr,
  parseSheetCode,
  serializeSheet,
  type ErrorCode,
  type SheetCells,
} from "@/lib/sheet";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { FormulaBar } from "./FormulaBar";
import { Grid } from "./Grid";

/** Знаки для быстрого ввода (на телефоне переключать раскладку долго). */
const SYMBOLS = ["=", "+", "-", "*", "/", "^", "(", ")", ";", ":", "$", '"', "&", "<", ">", ","];
/** Функции для быстрого ввода: русские названия — в русском интерфейсе, английские — в казахском. */
const FUNCTIONS: { ru: string; en: string }[] = [
  { ru: "СУММ", en: "SUM" },
  { ru: "СРЗНАЧ", en: "AVERAGE" },
  { ru: "МИН", en: "MIN" },
  { ru: "МАКС", en: "MAX" },
  { ru: "СЧЁТ", en: "COUNT" },
  { ru: "СЧЁТЕСЛИ", en: "COUNTIF" },
  { ru: "СУММЕСЛИ", en: "SUMIF" },
  { ru: "ЕСЛИ", en: "IF" },
  { ru: "ОКРУГЛ", en: "ROUND" },
  { ru: "И", en: "AND" },
  { ru: "ИЛИ", en: "OR" },
];

const ERROR_KEYS: Record<ErrorCode, DictKey> = {
  "#ДЕЛ/0!": "idexl.err.div0",
  "#ЗНАЧ!": "idexl.err.value",
  "#ССЫЛКА!": "idexl.err.ref",
  "#ИМЯ?": "idexl.err.name",
  "#ЧИСЛО!": "idexl.err.num",
  "#ЦИКЛ!": "idexl.err.cycle",
};

/** Знаки, после которых в формуле ждут адрес ячейки: нажатие на ячейку вставит её адрес. */
const AFTER_OPERATOR = /[=+\-*/^&(;,:<>]$/;

interface Draft {
  addr: string;
  text: string;
}

/** Состояние интерфейса привязано к задаче: при переходе на другую задачу всё начинается заново. */
interface Ui {
  owner: string;
  sel: string;
  draft: Draft | null;
  showFormulas: boolean;
  fillN: number;
  filled: string[];
}

const inGrid = (addr: string) => {
  const a = parseAddr(addr);
  return !!a && a.col <= GRID_COLS && a.row <= GRID_ROWS;
};

/** С какой ячейки начать: первая, которую нужно заполнить в задаче. */
function startCell(task: WorkspaceProps["task"]): string {
  if (task?.check.kind === "excel") {
    const first = task.check.formulas?.[0] ?? Object.keys(task.check.cells)[0];
    if (first && inGrid(first)) return first;
  }
  return "A1";
}

const freshUi = (owner: string, task: WorkspaceProps["task"]): Ui => ({ owner, sel: startCell(task), draft: null, showFormulas: false, fillN: 3, filled: [] });

/**
 * Рабочая область Excel: строка формул, сетка A–H × 1–15, быстрый ввод знаков и функций, «Протянуть» и проверка.
 * Код задачи — JSON ячеек; значения считает движок src/lib/sheet (правильность решает код, а не ИИ).
 */
export function Workspace({ task, code, onCodeChange, onCheck, onRunError, beforeRun }: WorkspaceProps) {
  const { t, lang } = useT();
  const owner = task?.id ?? "sandbox";
  const [ui, setUi] = useState<Ui>(() => freshUi(owner, task));
  const s = ui.owner === owner ? ui : freshUi(owner, task);
  const inputRef = useRef<HTMLInputElement>(null);

  const cells = useMemo(() => parseSheetCode(code), [code]);
  const result = useMemo(() => evaluateSheet(cells), [cells]);

  const patch = (p: Partial<Ui>) => setUi({ ...s, ...p, owner });

  const raw = cells[s.sel] ?? "";
  const editing = !!s.draft && s.draft.addr === s.sel;
  const barText = editing ? s.draft!.text : raw;
  const value = result.get(s.sel);
  const shownFormula = isFormula(barText);

  // Ячейки, на которые ссылается выбранная формула (или та, что набирается сейчас).
  const related = useMemo(() => {
    const out = new Set<string>();
    for (const ref of formulaRefs(barText)) {
      for (let r = ref.from.row; r <= ref.to.row && out.size < 400; r++) for (let c = ref.from.col; c <= ref.to.col; c++) out.add(addrOf(c, r));
    }
    return out;
  }, [barText]);
  const filledSet = useMemo(() => new Set(s.filled), [s.filled]);

  // ---------- Изменение ячеек ----------

  /** Записать новый набор ячеек в код и сообщить оболочке об ошибках формул. */
  const apply = (next: SheetCells) => {
    onCodeChange(serializeSheet(next));
    onRunError?.(describeSheetError(next));
  };

  /** Ячейки с применённым черновиком (сам черновик сбрасывает вызывающий). */
  const withDraft = (): SheetCells => {
    if (!s.draft) return cells;
    const text = s.draft.text.trim();
    if ((cells[s.draft.addr] ?? "") === text) return cells;
    const next = { ...cells };
    if (text === "") delete next[s.draft.addr];
    else next[s.draft.addr] = text;
    return next;
  };

  const commit = (): SheetCells => {
    const next = withDraft();
    if (next !== cells) apply(next);
    return next;
  };

  const focusInput = (selectAll: boolean, caret?: number) => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (caret !== undefined) el.setSelectionRange(caret, caret);
      else if (selectAll && !el.value.trimStart().startsWith("=")) el.select();
      else el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const moveTo = (dRow: number, dCol: number) => {
    const a = parseAddr(s.sel)!;
    return addrOf(Math.min(GRID_COLS, Math.max(1, a.col + dCol)), Math.min(GRID_ROWS, Math.max(1, a.row + dRow)));
  };

  const commitAndMove = (dRow: number, dCol: number) => {
    commit();
    patch({ draft: null, sel: moveTo(dRow, dCol), filled: [] });
    focusInput(true);
  };

  // ---------- Вставка в строку формул ----------

  /** В режиме набора формулы нажатие на ячейку вставляет её адрес (фокус остаётся в поле). */
  const canPick = () => {
    const el = inputRef.current;
    if (!el || document.activeElement !== el || !s.draft || !s.draft.text.trimStart().startsWith("=")) return false;
    const caret = el.selectionStart ?? s.draft.text.length;
    return AFTER_OPERATOR.test(s.draft.text.slice(0, caret).trimEnd());
  };

  const insertText = (text: string, caretBack = 0) => {
    const el = inputRef.current;
    const focused = !!el && document.activeElement === el;
    const base = focused ? barText : editing ? s.draft!.text : "";
    const a = focused ? (el.selectionStart ?? base.length) : base.length;
    const b = focused ? (el.selectionEnd ?? a) : a;
    const next = base.slice(0, a) + text + base.slice(b);
    patch({ draft: { addr: s.sel, text: next }, filled: [] });
    focusInput(false, a + text.length - caretBack);
  };

  const onSelect = (addr: string) => {
    if (canPick()) {
      insertText(addr);
      return;
    }
    if (s.draft) commit();
    patch({ sel: addr, draft: null, filled: [] });
  };

  const onCellMouseDown = (e: React.MouseEvent) => {
    if (canPick()) e.preventDefault();
  };

  // ---------- Протянуть, очистить, проверить ----------

  const fill = (direction: "down" | "right") => {
    const base = commit();
    if ((base[s.sel] ?? "").trim() === "") return;
    const src = parseAddr(s.sel);
    if (!src) return;
    const max = direction === "down" ? GRID_ROWS - src.row : GRID_COLS - src.col;
    if (max <= 0) return;
    const r = fillCells(base, s.sel, direction, Math.min(s.fillN, max));
    if (!r.filled.length) return;
    apply(r.cells);
    patch({ draft: null, filled: r.filled });
  };

  const clearCell = () => {
    const base = commit();
    if (base[s.sel] !== undefined) {
      const next = { ...base };
      delete next[s.sel];
      apply(next);
    }
    patch({ draft: null, filled: [] });
  };

  const onCheckClick = () => {
    if (task?.check.kind !== "excel") return;
    if (beforeRun && !beforeRun()) return;
    const base = commit();
    patch({ draft: null });
    onCheck(checkExcel(task.check, serializeSheet(base)));
  };

  const hasInput = (cells[s.sel] ?? "") !== "" || editing;
  const fillRange = s.filled.length ? (s.filled.length > 1 ? `${s.filled[0]}:${s.filled[s.filled.length - 1]}` : s.filled[0]) : "";
  const errCode = !editing && isError(value) ? value.error : null;
  const parseFailed = !editing && !!result.parseErrors[s.sel];

  return (
    <div className="flex flex-col gap-3">
      <FormulaBar
        addr={s.sel}
        value={barText}
        dirty={editing && s.draft!.text !== raw}
        inputRef={inputRef}
        onChange={(v) => patch({ draft: { addr: s.sel, text: v }, filled: [] })}
        onFocus={() => {
          if (!s.draft) patch({ draft: { addr: s.sel, text: raw } });
        }}
        onBlur={() => {
          if (s.draft) {
            commit();
            patch({ draft: null });
          }
        }}
        onEnter={() => commitAndMove(1, 0)}
        onTab={() => commitAndMove(0, 1)}
        onEscape={() => patch({ draft: null })}
        onApply={() => {
          commit();
          patch({ draft: null });
        }}
        onCancel={() => patch({ draft: null })}
      />

      <div role="toolbar" aria-label={t("idexl.keys.aria")} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {SYMBOLS.map((sym) => (
          <button
            key={sym}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertText(sym)}
            className="grid h-9 min-w-9 shrink-0 place-items-center rounded-xl border-2 border-border bg-surface px-2 font-mono text-sm font-extrabold hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-primary"
          >
            {sym}
          </button>
        ))}
        <span aria-hidden className="mx-0.5 w-px shrink-0 self-stretch bg-border" />
        {FUNCTIONS.map((f) => {
          const name = lang === "ru" ? f.ru : f.en;
          return (
            <button
              key={f.en}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertText(`${canPick() || barText.trim() !== "" ? "" : "="}${name}()`, 1)}
              className="h-9 shrink-0 rounded-xl border-2 border-border bg-primary-soft px-2.5 font-mono text-xs font-extrabold text-primary hover:brightness-95 focus-visible:outline-3 focus-visible:outline-primary"
            >
              {name}
            </button>
          );
        })}
      </div>

      {shownFormula && !editing && (
        <p className="text-sm font-bold" aria-live="polite">
          {t("idexl.result", { value: formatValue(value) })}
        </p>
      )}

      <Grid
        cols={GRID_COLS}
        rows={GRID_ROWS}
        cells={cells}
        values={result.values}
        selected={s.sel}
        showFormulas={s.showFormulas}
        related={related}
        filled={filledSet}
        onSelect={onSelect}
        onCellMouseDown={onCellMouseDown}
        onTypeStart={(ch) => {
          patch({ draft: { addr: s.sel, text: ch }, filled: [] });
          focusInput(false, ch.length);
        }}
        onEdit={() => {
          patch({ draft: { addr: s.sel, text: raw } });
          focusInput(false, raw.length);
        }}
        onClear={clearCell}
      />

      <p className="flex items-start gap-2 text-xs text-muted">
        <MousePointerClick size={14} className="mt-0.5 shrink-0" aria-hidden />
        <span>{editing && s.draft!.text.trimStart().startsWith("=") ? t("idexl.pick.hint") : related.size ? t("idexl.refs.hint") : t("idexl.grid.hint")}</span>
      </p>

      {(errCode || parseFailed) && (
        <div role="alert" className="rounded-2xl border-2 border-danger/40 bg-danger-soft px-4 py-3">
          <p className="mb-1 flex items-center gap-2 text-sm font-extrabold text-danger">
            <TriangleAlert size={16} aria-hidden /> {t("idexl.err.title", { code: errCode ?? "#ЗНАЧ!" })}
          </p>
          <p className="text-sm">{parseFailed ? t("idexl.err.syntax") : t(ERROR_KEYS[errCode!])}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border-2 border-border bg-surface-2 p-3">
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("idexl.fill.title")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" icon={<ArrowDownToLine size={16} />} disabled={!hasInput} onClick={() => fill("down")}>
            {t("idexl.fill.down")}
          </Button>
          <Button variant="secondary" size="sm" icon={<ArrowRightToLine size={16} />} disabled={!hasInput} onClick={() => fill("right")}>
            {t("idexl.fill.right")}
          </Button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t("idexl.fill.less")}
              disabled={s.fillN <= 1}
              onClick={() => patch({ fillN: Math.max(1, s.fillN - 1) })}
              className={cn("grid size-9 place-items-center rounded-xl border-2 border-border bg-surface", s.fillN <= 1 && "opacity-40")}
            >
              <Minus size={16} aria-hidden />
            </button>
            <span className="min-w-20 text-center text-sm font-bold tabular-nums">{t("idexl.fill.count", { n: s.fillN })}</span>
            <button
              type="button"
              aria-label={t("idexl.fill.more")}
              disabled={s.fillN >= 14}
              onClick={() => patch({ fillN: Math.min(14, s.fillN + 1) })}
              className={cn("grid size-9 place-items-center rounded-xl border-2 border-border bg-surface", s.fillN >= 14 && "opacity-40")}
            >
              <Plus size={16} aria-hidden />
            </button>
          </div>
        </div>
        {fillRange ? (
          <p role="status" className="text-sm font-bold text-success">
            {t("idexl.fill.done", { range: fillRange })}
          </p>
        ) : (
          !hasInput && <p className="text-xs text-muted">{t("idexl.fill.empty")}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" aria-pressed={s.showFormulas} icon={s.showFormulas ? <EyeOff size={16} /> : <Eye size={16} />} onClick={() => patch({ showFormulas: !s.showFormulas })}>
          {s.showFormulas ? t("idexl.showValues") : t("idexl.showFormulas")}
        </Button>
        <Button variant="ghost" size="sm" icon={<Eraser size={16} />} disabled={!hasInput} onClick={clearCell}>
          {t("idexl.clear")}
        </Button>
      </div>

      {task && (
        <Button variant="primary" size="lg" block icon={<CheckCheck size={18} />} onClick={onCheckClick}>
          <PaidLabel>{t("idexl.check")}</PaidLabel>
        </Button>
      )}
      <EntryNote />

      <p className="text-xs text-muted">{t("idexl.sep.hint")}</p>
    </div>
  );
}
