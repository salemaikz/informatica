"use client";

import { Flame, Play, Swords } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mascot } from "@/components/mascot/Mascot";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Ring } from "@/components/ui/ProgressBar";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import type { ShareResult } from "@/lib/share-code";
import { APP_NAME } from "@/lib/site-meta";
import type { Lang } from "@/lib/types";
import { useApp } from "@/lib/store";
import { landingModel } from "./landing";
import { tr } from "./labels";

const LANGS: Lang[] = ["ru", "kk"];
const LANG_NAME: Record<Lang, string> = { ru: "RU", kk: "ҚАЗ" };

/**
 * Страница результата, которым поделились (#72): друг или родитель открывает /r/<код> без онбординга.
 * Язык — профиль ученика (если уже занимается), иначе язык из кода; рядом маленький переключатель ru/kk.
 * Негодный код — нейтральная карточка Informatica (страница отвечает 200, не 404).
 * «Ссылку открыли» считаем один раз и только для верного кода; «активный день» тут не считается (#69).
 */
export function ResultLanding({ result }: { result: ShareResult | null }) {
  const onboarded = useApp((s) => s.onboarded);
  const profileLang = useApp((s) => s.profile.lang);
  const [picked, setPicked] = useState<Lang | null>(null);
  const lang: Lang = picked ?? (onboarded || !result ? profileLang : result.lang);
  const model = useMemo(() => landingModel(result, lang), [result, lang]);

  const opened = useRef(false);
  useEffect(() => {
    if (!result || opened.current) return;
    opened.current = true;
    track({ e: "share_open", what: result.t });
  }, [result]);

  const first = model.suffix && model.suffixFirst;
  const after = model.suffix && !model.suffixFirst;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Mascot size={40} className="shrink-0" />
          <span className="truncate text-xl font-extrabold">{APP_NAME}</span>
        </div>
        <div role="group" aria-label={tr(lang, "share.land.lang")} className="flex shrink-0 rounded-2xl border-2 border-border bg-surface p-0.5">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setPicked(l)}
              className={cn(
                "h-9 min-w-11 rounded-xl px-2.5 text-sm font-extrabold",
                "focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary",
                lang === l ? "bg-primary text-white" : "text-muted hover:bg-surface-2",
              )}
            >
              {LANG_NAME[l]}
            </button>
          ))}
        </div>
      </header>

      {model.kind === "invalid" ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <Mascot mood="thinking" size={88} />
          <h1 className="text-2xl font-extrabold">{model.eyebrow}</h1>
          <p className="text-muted">{model.text}</p>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 py-7 text-center">
          <h1 className="text-sm font-extrabold uppercase tracking-wide text-muted">{model.eyebrow}</h1>
          {model.chip && <Pill tone="primary">{model.chip}</Pill>}

          {model.ratio !== null ? (
            <Ring value={model.ratio} size={168} stroke={16} color="var(--primary)">
              <span className="px-2 text-4xl font-extrabold tabular-nums">{model.kind === "course" ? model.big : `${Math.round(model.ratio * 100)}%`}</span>
            </Ring>
          ) : (
            <Flame size={84} className="text-streak" fill="var(--streak-soft)" aria-hidden />
          )}

          {model.kind !== "course" && (
            <p className="flex flex-wrap items-baseline justify-center gap-x-2 text-muted">
              {first && <span className="text-xl font-extrabold">{model.suffix}</span>}
              <span className="text-6xl font-extrabold leading-none tabular-nums text-text">{model.big}</span>
              {after && <span className="text-xl font-extrabold">{model.suffix}</span>}
            </p>
          )}

          {model.lines.map((line) => (
            <p key={line} className="text-base font-extrabold text-muted">
              {line}
            </p>
          ))}
          <p className="mt-1 max-w-xs text-base font-semibold">{model.text}</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {model.acceptHref && (
          <ButtonLink
            href={model.acceptHref}
            size="lg"
            block
            icon={<Swords size={20} aria-hidden />}
            onClick={() => track({ e: "challenge", step: "accept" })}
          >
            {tr(lang, "share.land.cta.accept")}
          </ButtonLink>
        )}
        <ButtonLink href="/" size="lg" block variant={model.acceptHref ? "secondary" : "primary"} icon={<Play size={20} aria-hidden />}>
          {tr(lang, "share.land.cta.start")}
        </ButtonLink>
      </div>

      {result && <p className="text-center text-xs font-semibold text-muted">{tr(lang, "share.land.noteOnly")}</p>}
    </main>
  );
}
