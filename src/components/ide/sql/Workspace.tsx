"use client";

import { CheckCheck, Loader2, Play, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SqlJsStatic } from "sql.js";
import { Button } from "@/components/ui/Button";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { checkSql, explainSqlError } from "@/lib/ide/sql/check";
import { describeSchema, loadSql, runSql, type SqlRun, type TableInfo } from "@/lib/ide/sql/db";
import type { WorkspaceProps } from "@/lib/ide/types";
import { useT } from "@/i18n/useT";
import { ResultTable } from "./ResultTable";
import { SchemaView } from "./SchemaView";

type Load = "loading" | "ready" | "error";

/**
 * Рабочая область SQL: справка по таблицам, редактор, «Запустить» / «Проверить» и результат.
 * sql.js грузится по требованию (один раз); база пересоздаётся перед каждым запуском.
 * Правильность задачи решает код (check.ts), а не ИИ.
 */
export function Workspace({ task, code, onCodeChange, onCheck, onRunError, beforeRun }: WorkspaceProps) {
  const { t, l } = useT();
  const [load, setLoad] = useState<Load>("loading");
  const [schema, setSchema] = useState<TableInfo[] | null>(null);
  // Результат привязан к задаче, для которой запускали, — при переходе на другую задачу старый результат не показываем.
  const [last, setLast] = useState<{ owner: string; run: SqlRun } | null>(null);
  const engine = useRef<SqlJsStatic | null>(null);
  const alive = useRef(true);
  const owner = task?.id ?? "sandbox";

  const start = () => {
    loadSql()
      .then((SQL) => {
        if (!alive.current) return;
        engine.current = SQL;
        setSchema(describeSchema(SQL));
        setLoad("ready");
      })
      .catch(() => {
        if (alive.current) setLoad("error");
      });
  };

  useEffect(() => {
    alive.current = true;
    start();
    return () => {
      alive.current = false;
    };
  }, []);

  const retry = () => {
    setLoad("loading");
    start();
  };

  const execute = (): SqlRun | null => {
    const SQL = engine.current;
    if (!SQL) return null;
    const run = runSql(SQL, code);
    setLast({ owner, run });
    onRunError?.(run.ok ? null : run.error);
    return run;
  };

  const onRun = () => {
    if (beforeRun && !beforeRun()) return;
    execute();
  };

  const onCheckClick = () => {
    const SQL = engine.current;
    if (!SQL || task?.check.kind !== "sql") return;
    if (beforeRun && !beforeRun()) return;
    execute();
    onCheck(checkSql(task.check, code, SQL));
  };

  const ready = load === "ready";
  const run = last && last.owner === owner ? last.run : null;

  return (
    <div className="flex flex-col gap-3">
      <SchemaView tables={schema} />

      <CodeEditor value={code} onChange={onCodeChange} language="sql" minHeight={170} ariaLabel={t("idesql.editor.aria")} />

      <div className="flex gap-2">
        <Button variant="primary" size="lg" className="flex-1" icon={ready || load === "error" ? <Play size={18} /> : <Loader2 size={18} className="animate-spin" />} disabled={!ready} onClick={onRun}>
          {t("idesql.run")}
        </Button>
        {task && (
          <Button variant="success" size="lg" className="flex-1" icon={<CheckCheck size={18} />} disabled={!ready} onClick={onCheckClick}>
            {t("idesql.check")}
          </Button>
        )}
      </div>

      {load === "loading" && (
        <p className="flex items-center gap-2 text-sm font-bold text-muted" role="status">
          <Loader2 size={16} className="animate-spin" aria-hidden /> {t("idesql.loading")}
        </p>
      )}
      {load === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-danger/40 bg-danger-soft px-4 py-3">
          <p className="min-w-0 flex-1 text-sm font-bold">{t("idesql.loadFailed")}</p>
          <Button variant="secondary" size="sm" onClick={retry}>
            {t("idesql.retry")}
          </Button>
        </div>
      )}

      <div aria-live="polite" className="flex flex-col gap-3">
        {!run && ready && <p className="rounded-2xl border-2 border-dashed border-border px-4 py-5 text-center text-sm text-muted">{t("idesql.result.placeholder")}</p>}
        {run && !run.ok && (
          <div role="alert" className="rounded-2xl border-2 border-danger/40 bg-danger-soft px-4 py-3">
            <p className="mb-1 flex items-center gap-2 text-sm font-extrabold text-danger">
              <TriangleAlert size={16} aria-hidden /> {t("idesql.error.title")}
            </p>
            <p className="text-sm">{l(explainSqlError(run.error))}</p>
            <p className="mt-2 text-xs font-bold text-muted">{t("idesql.error.raw")}</p>
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-surface px-3 py-2 font-mono text-xs">{run.error}</pre>
          </div>
        )}
        {run && run.ok && <RunView run={run} />}
      </div>
    </div>
  );
}

function RunView({ run }: { run: Extract<SqlRun, { ok: true }> }) {
  const { t } = useT();
  return (
    <>
      {run.sets.map((s, i) => (
        <ResultTable
          key={i}
          set={s}
          title={run.sets.length > 1 ? t("idesql.result.setN", { i: i + 1, n: run.sets.length }) : t("idesql.result.title")}
        />
      ))}
      {run.mutated && (
        <p className="rounded-2xl border-2 border-border bg-surface-2 px-4 py-3 text-sm font-bold">
          {t("idesql.result.changed", { n: run.changes })}
        </p>
      )}
      {run.after && <ResultTable set={run.after.set} title={t("idesql.result.after", { table: run.after.table })} />}
      {run.sets.length === 0 && !run.mutated && <p className="text-sm font-bold text-muted">{t("idesql.result.done")}</p>}
    </>
  );
}
