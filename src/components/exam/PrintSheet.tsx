"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { entTopicById } from "@/content/ent-topics";
import type { DictKey } from "@/i18n/dict";
import { translate, useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { contextQuestionOf, type ExamQuestion } from "@/lib/exam";
import { tx } from "@/lib/text";
import type { Lang, Text } from "@/lib/types";
import { InlineMarkdown, Markdown } from "@/components/Markdown";
import { SceneView } from "@/components/scenes/SceneView";
import { ButtonLink } from "@/components/ui/Button";
import { letter, optionsOf } from "./logic";
import { buildPrintPaper, contextStart, keyRows, keyTotal, printLink, type PrintParams } from "./print-logic";

// Лист печатается на белой бумаге: переопределяем токены светлой темой (сцены рисуются теми же токенами),
// в печати — только чёрное на белом (цвет сцен гасится в серый), без меню и кнопок.
const CSS = `
.ps-screen{background:var(--bg);min-height:100dvh;padding:16px 16px 40px}
.ps-toolbar{max-width:820px;margin:0 auto 16px}
.ps-paper{--bg:#fff;--surface:#fff;--surface-2:#f0f2f7;--border:#c9ced9;--text:#000;--muted:#333;
  --primary:#1a91d6;--primary-strong:#1277b3;--primary-soft:#e4f3fc;--success:#21b26f;--success-strong:#17935a;--success-soft:#e3f7ec;
  --danger:#ec4c4c;--danger-strong:#c93636;--danger-soft:#fdeaea;--warning:#f2a516;--warning-strong:#c98507;--warning-soft:#fff3dc;
  --gold:#f0b400;--gold-soft:#fff6d6;color-scheme:light;
  max-width:820px;margin:0 auto;background:#fff;color:#000;border:2px solid var(--border);border-radius:16px;padding:28px 24px;font-size:15px;line-height:1.45}
.ps-paper h1{font-size:24px;font-weight:900;margin:0}
.ps-paper h2{font-size:18px;font-weight:900;margin:0 0 8px}
.ps-meta{margin:4px 0 0;font-weight:700;color:#333}
.ps-fields{display:grid;grid-template-columns:2fr 1fr 1fr;gap:16px;margin:18px 0 8px}
.ps-field{display:flex;align-items:flex-end;gap:6px;font-weight:700;border-bottom:1.5px solid #000;padding-bottom:2px;min-height:26px}
.ps-q{margin-top:18px;break-inside:avoid}
.ps-ctx{margin-top:22px;border:1.5px solid #000;border-radius:8px;padding:10px 12px;break-inside:auto}
.ps-ctx-title{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.ps-num{font-weight:900;margin-right:6px}
.ps-opts{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:6px}
.ps-opt{display:flex;gap:10px;align-items:flex-start}
.ps-mark{flex:none;width:26px;height:26px;border:1.5px solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}
.ps-mark.sq{border-radius:4px}
.ps-two{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px}
.ps-two h3{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;margin:0 0 4px}
.ps-two ol,.ps-two ul{margin:0;padding:0;list-style:none;display:grid;gap:6px}
.ps-write{margin-top:8px;font-weight:700}
.ps-paper mark{background:none;font-weight:800;text-decoration:underline;color:#000}
.ps-paper code{background:none;border:1px solid #999;color:#000}
.ps-paper pre{background:#fff !important;border:1px solid #666;color:#000}
.ps-scene{margin-top:8px;max-width:520px}
.ps-key{margin-top:32px}
.ps-key table{width:100%;border-collapse:collapse;font-size:14px}
.ps-key th,.ps-key td{border:1px solid #000;padding:4px 8px;text-align:left;vertical-align:top}
.ps-key td.n,.ps-key td.p,.ps-key th.n,.ps-key th.p{text-align:center;width:64px}
.ps-rules{margin:12px 0 0;padding-left:18px;font-size:13px}
.ps-short{margin-top:12px;font-weight:700;border:1.5px dashed #000;padding:6px 10px;border-radius:8px}
@media print{
  @page{margin:14mm}
  html,body{background:#fff !important}
  [data-toolbox],.ps-toolbar{display:none !important}
  .ps-screen{padding:0;background:#fff}
  .ps-paper{border:0;border-radius:0;padding:0;max-width:none;font-size:12pt}
  .ps-scene{filter:grayscale(1) contrast(1.2)}
  .ps-key{break-before:page;margin-top:0}
}
`;

function Options({ q, lang, box }: { q: ExamQuestion; lang: Lang; box?: boolean }) {
  const opts = optionsOf(q);
  return (
    <ol className="ps-opts">
      {opts.map((o, i) => (
        <li key={i} className="ps-opt">
          <span className={cn("ps-mark", box && "sq")}>{letter(i)}</span>
          <span className="min-w-0 whitespace-pre-wrap break-words pt-0.5">
            <InlineMarkdown>{tx(o, lang)}</InlineMarkdown>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Question({ q, n, lang, ctxRange }: { q: ExamQuestion; n: number; lang: Lang; ctxRange: { from: number; to: number } | null }) {
  const item = q.item;
  const cq = contextQuestionOf(q);
  const prompt: Text = cq ? cq.prompt : item.kind === "context" ? "" : item.prompt;
  const scene = item.kind === "context" ? undefined : item.scene;
  const tr = (key: DictKey, params?: Record<string, string | number>) => translate(lang, key, params);
  return (
    <>
      {ctxRange && item.kind === "context" && (
        <section className="ps-ctx">
          <p className="ps-ctx-title">{tr("share.print.context", { from: ctxRange.from, to: ctxRange.to })}</p>
          <Markdown>{tx(item.text, lang)}</Markdown>
          {item.scene && (
            <div className="ps-scene">
              <SceneView scene={item.scene} />
            </div>
          )}
        </section>
      )}
      <section className="ps-q" data-q={n}>
        <div className="flex gap-1">
          <span className="ps-num">{n}.</span>
          <div className="min-w-0 flex-1 whitespace-pre-wrap break-words font-semibold">
            <Markdown>{tx(prompt, lang)}</Markdown>
          </div>
        </div>
        {scene && (
          <div className="ps-scene">
            <SceneView scene={scene} />
          </div>
        )}
        {(item.kind === "single" || item.kind === "context") && <Options q={q} lang={lang} />}
        {item.kind === "multi" && <Options q={q} lang={lang} box />}
        {item.kind === "match" && (
          <>
            <div className="ps-two">
              <div>
                <h3>{tr("share.print.matchItems")}</h3>
                <ul>
                  {item.items.map((it, i) => (
                    <li key={i} className="ps-opt">
                      <span className="ps-mark sq">{letter(i)}</span>
                      <span className="pt-0.5">
                        <InlineMarkdown>{tx(it, lang)}</InlineMarkdown>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>{tr("share.print.matchChoices")}</h3>
                <ol>
                  {item.choices.map((c, i) => (
                    <li key={i} className="ps-opt">
                      <span className="ps-mark">{i + 1}</span>
                      <span className="pt-0.5">
                        <InlineMarkdown>{tx(c, lang)}</InlineMarkdown>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <p className="ps-write">{tr("share.print.matchWrite")}</p>
          </>
        )}
      </section>
    </>
  );
}

/** Лист варианта для печати: шапка, задания по порядку, ключ ответов на отдельной странице. */
export function PrintSheet({ params }: { params: PrintParams }) {
  const { t, lang: uiLang } = useT();
  const [lang, setLang] = useState<Lang>(params.lang ?? uiLang);
  const seed = params.seed;

  const paper = useMemo(() => (seed === null ? null : buildPrintPaper({ ...params, seed })), [params, seed]);
  const rows = useMemo(() => (paper ? keyRows(paper, lang) : []), [paper, lang]);
  const tr = (key: DictKey, p?: Record<string, string | number>) => translate(lang, key, p);

  if (seed === null || !paper) {
    return (
      <div className="ps-screen">
        <style>{CSS}</style>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
          <p className="text-lg font-extrabold">{t("share.print.noVariant")}</p>
          <ButtonLink href="/exam">{t("share.print.back")}</ButtonLink>
        </div>
      </div>
    );
  }

  const pickLang = (l: Lang) => {
    setLang(l);
    try {
      window.history.replaceState(null, "", printLink({ ...params, seed }, l));
    } catch {
      // адрес не обновился — не страшно
    }
  };

  const short = paper.notes.some((n) => n.unfilled > 0) || paper.items.length === 0;
  const topicsLine = paper.kind === "topic" && params.topics.length ? params.topics.map((x) => tx(entTopicById(x).short, lang)).join(", ") : "";
  const minutes = Math.round(paper.timeLimitSec / 60);

  return (
    <div className="ps-screen">
      <style>{CSS}</style>
      <div className="ps-toolbar flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/exam" variant="ghost" icon={<ArrowLeft size={18} aria-hidden />}>
            {t("share.print.back")}
          </ButtonLink>
          <div role="group" aria-label={t("share.print.langLabel")} className="ml-auto flex gap-2">
            {(["ru", "kk"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => pickLang(l)}
                className={cn(
                  "h-11 min-w-11 rounded-full border-2 px-4 text-sm font-extrabold uppercase",
                  lang === l ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-text hover:bg-surface-2",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-5 font-extrabold text-white shadow-[0_4px_0_var(--primary-strong)] active:translate-y-[3px] active:shadow-none"
          >
            <Printer size={18} aria-hidden /> {t("share.print.action")}
          </button>
        </div>
        <p className="text-sm font-semibold text-muted">{t("share.print.hint")}</p>
      </div>

      <article className="ps-paper" lang={lang}>
        <header>
          <h1>{tr("share.print.title", { n: seed })}</h1>
          <p className="ps-meta">
            {translate(lang, `exam.mode.${paper.kind}` as DictKey)}
            {topicsLine ? ` · ${topicsLine}` : ""}
          </p>
          <p className="ps-meta">{tr("share.print.meta", { questions: paper.items.length, minutes, points: paper.maxPoints })}</p>
          <div className="ps-fields">
            <div className="ps-field">{tr("share.print.name")}:</div>
            <div className="ps-field">{tr("share.print.class")}:</div>
            <div className="ps-field">{tr("share.print.date")}:</div>
          </div>
          {short && <p className="ps-short">{tr("share.print.short")}</p>}
        </header>

        {paper.items.map((q, i) => (
          <Question key={q.key} q={q} n={i + 1} lang={lang} ctxRange={contextStart(paper.items, i)} />
        ))}

        <section className="ps-key" data-key>
          <h2>
            {tr("share.print.key")} · {tr("share.print.title", { n: seed })}
          </h2>
          <table>
            <thead>
              <tr>
                <th className="n">{tr("share.print.keyNumber")}</th>
                <th>{tr("share.print.keyAnswer")}</th>
                <th className="p">{tr("share.print.keyPoints")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="n">{r.n}</td>
                  <td>
                    <InlineMarkdown>{r.answer}</InlineMarkdown>
                  </td>
                  <td className="p">{r.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ps-write">{tr("share.print.keyTotal", { points: keyTotal(rows) })}</p>
          <h2 style={{ marginTop: 16 }}>{tr("share.print.rulesTitle")}</h2>
          <ul className="ps-rules">
            <li>{tr("share.print.ruleSingle")}</li>
            <li>{tr("share.print.ruleMulti")}</li>
            <li>{tr("share.print.ruleMatch")}</li>
          </ul>
        </section>
      </article>
    </div>
  );
}
