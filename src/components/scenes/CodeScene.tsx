"use client";

import { ChevronRight, SquareTerminal } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { createContext, use, useEffect, useState } from "react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { springBouncy } from "@/components/motion/presets";
import { cn } from "@/lib/cn";
import type { Scene } from "@/lib/types";
import { pythonHref } from "@/lib/python/codec";
import { useT } from "@/i18n/useT";
import { TOKEN_CLASS, tokenizeLine, type CodeLang } from "./highlight";

type CodeScene = Extract<Scene, { kind: "code" }>;

/**
 * Показывать ли в сцене Python ссылку «Запустить в Python». null — по умолчанию: только если вывод программы
 * уже показан в сцене (трассировка, разобранный пример). В заданиях «Что выведет программа?» и на пробном ЕНТ
 * вывода в сцене нет — запуск выдал бы ответ. Обёртка с true/false задаёт явно (теория, разбор, экзамен).
 */
export const CodeRunContext = createContext<boolean | null>(null);

/** Одна строка кода с подсветкой синтаксиса; отступы сохраняются (white-space: pre). */
function CodeText({ line, lang }: { line: string; lang: CodeLang }) {
  const tokens = tokenizeLine(line, lang);
  return (
    <span className="whitespace-pre">
      {tokens.length === 0
        ? " "
        : tokens.map((tk, i) => (
            <span key={i} className={TOKEN_CLASS[tk.type]}>
              {tk.text}
            </span>
          ))}
    </span>
  );
}

/**
 * Блок кода: номера строк серым, `active` — текущая строка (фон, полоска слева и стрелка), `marks` — отмеченные.
 * Широкий код прокручивается по горизонтали внутри блока.
 */
export function CodeBlock({
  lines,
  lang = "text",
  active,
  marks,
  className,
}: {
  lines: string[];
  lang?: CodeLang;
  active?: number;
  marks?: number[];
  className?: string;
}) {
  const marked = new Set(marks ?? []);
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-border bg-surface-2 py-2 font-mono text-[13px] leading-6", className)}>
      <div className="min-w-full w-max">
        {lines.map((line, i) => {
          const isActive = active === i;
          return (
            <div
              key={i}
              data-active={isActive || undefined}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex items-center border-l-[3px] border-l-transparent pr-3 transition-colors duration-200",
                marked.has(i) && "bg-warning-soft",
                isActive && "border-l-primary bg-primary-soft",
              )}
            >
              <span aria-hidden className="flex w-5 shrink-0 items-center justify-center text-primary">
                <ChevronRight size={16} strokeWidth={3} className={cn("transition-opacity duration-200", isActive ? "opacity-100" : "opacity-0")} />
              </span>
              <span aria-hidden className="min-w-6 shrink-0 select-none pr-2 text-right text-muted">
                {i + 1}
              </span>
              <CodeText line={line} lang={lang} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Сравнивает переменные с прошлым подшагом: имена, значение которых изменилось (или появилось). */
function changedNames(prev: Record<string, string>, vars: CodeScene["vars"]): string[] {
  return (vars ?? []).filter((v) => prev[v.name] !== v.value).map((v) => v.name);
}

const toMap = (vars: CodeScene["vars"]): Record<string, string> => Object.fromEntries((vars ?? []).map((v) => [v.name, v.value]));

/** Код с подсветкой текущей строки, панелью «Переменные» (изменения мигают) и «Вывод» — трассировка программы. */
export function CodeScene({ scene }: { scene: CodeScene }) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const runnable = use(CodeRunContext) ?? scene.output !== undefined;
  const vars = scene.vars;
  const sig = JSON.stringify(vars ?? null);

  // Что изменилось с прошлого подшага: сравниваем при рендере (без setState в эффекте), мигание гасим таймером.
  const [seen, setSeen] = useState({ sig, map: toMap(vars) });
  const [flash, setFlash] = useState<{ tick: number; names: string[] }>({ tick: 0, names: [] });
  if (seen.sig !== sig) {
    const names = changedNames(seen.map, vars);
    setSeen({ sig, map: toMap(vars) });
    setFlash({ tick: flash.tick + 1, names });
  }
  useEffect(() => {
    if (flash.names.length === 0) return;
    const id = setTimeout(() => setFlash((f) => (f.tick === flash.tick ? { ...f, names: [] } : f)), 1400);
    return () => clearTimeout(id);
  }, [flash.tick, flash.names.length]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-2.5">
      <CodeBlock lines={scene.lines} lang={scene.lang} active={scene.active} marks={scene.marks} />

      {scene.lang === "python" && runnable && (
        // Новая вкладка: урок не прерывается. Видимая высота 32 px, зона касания (after) — 44 px.
        <Link
          href={pythonHref(scene.lines.join("\n"))}
          target="_blank"
          rel="noopener"
          className="relative -mt-1 inline-flex h-8 items-center gap-1.5 self-end rounded-lg px-2 text-[13px] font-bold text-primary after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] hover:bg-primary-soft print:hidden"
        >
          <SquareTerminal size={15} aria-hidden />
          {t("python.scene.run")}
        </Link>
      )}

      {vars && vars.length > 0 && (
        <div>
          <div className="mb-1 text-[13px] font-extrabold text-muted">{t("scene.vars")}</div>
          <div className="flex flex-wrap gap-1.5">
            {vars.map((v) => {
              const changed = flash.names.includes(v.name);
              return (
                <span
                  key={v.name}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[13px] transition-colors duration-300",
                    changed ? "border-primary bg-primary-soft" : "border-border bg-surface",
                  )}
                >
                  <span className="text-muted">{v.name} =</span>
                  {/* Значение «подпрыгивает» при изменении: новый ключ — новая анимация; рамка гаснет плавно. */}
                  <m.span
                    key={changed ? flash.tick : "still"}
                    initial={changed && !reduce ? { scale: 1.3 } : false}
                    animate={{ scale: 1 }}
                    transition={springBouncy}
                    className="inline-block font-bold"
                  >
                    {v.value}
                  </m.span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {scene.output && (
        <div>
          <div className="mb-1 text-[13px] font-extrabold text-muted">{t("scene.output")}</div>
          <div className="min-h-9 rounded-xl border border-border bg-surface px-3 py-2 font-mono text-[13px] leading-6">
            {scene.output.length === 0 ? (
              <span className="font-sans text-muted">{t("scene.output.empty")}</span>
            ) : (
              scene.output.map((o, i) => (
                <div key={i} className="whitespace-pre-wrap break-words">
                  {o}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
