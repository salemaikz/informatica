"use client";

import { Cpu, Infinity as InfinityIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { aiFreeIsLifetime, PLAN_FEATURES, type AiKind } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { pluralForm } from "@/components/learn/map";
import { useAiQuote } from "./useEconomy";

type Quote = ReturnType<typeof useAiQuote>;
type Translate = (key: DictKey, params?: Record<string, string | number>) => string;

/**
 * Предложение про бесплатный ИИ (#99): у тарифа «Бесплатный» три обращения даны один раз — «бесплатно: осталось 2 из 3»,
 * потом «бесплатные закончились; сейчас — за 5 чипов · у тебя 20». У «Лайт» счёт дневной («бесплатно, осталось 20 из 30 сегодня»).
 * null — безлимит, лимит дня и отзыв (счёта нет).
 */
function quotaSentence(t: Translate, kind: AiKind, { quote, freeLeft, tier, chips }: Quote): string | null {
  if (kind === "feedback" || quote.pay === "plan" || (!quote.ok && quote.reason === "cap")) return null;
  const max = PLAN_FEATURES[tier].aiFree;
  if (!Number.isFinite(max)) return null;
  const life = aiFreeIsLifetime(tier);
  if (quote.pay === "free") return life ? t("ailimit.free", { n: freeLeft, max }) : t("hearts15.ai.free", { n: freeLeft, max });
  const head = life ? t("ailimit.out.free") : t("ailimit.out.day", { max });
  return `${head}; ${t(`ailimit.now.${pluralForm(quote.cost)}` as DictKey, { cost: quote.cost, have: chips })}`;
}

/** Та же фраза для подписи кнопки (скринридер, title); null — счёта нет. */
export function useAiQuotaText(kind: AiKind): string | null {
  const { t } = useT();
  const q = useAiQuote(kind);
  return quotaSentence(t, kind, q);
}

/** Виден ли значок с числом бесплатных (AiFreeDot): у тарифа есть счёт и платит не тариф. Проводник по нему выбирает реплику. */
export function useAiFreeDotShown(kind: AiKind = "ask"): boolean {
  const { quote, tier } = useAiQuote(kind);
  return Number.isFinite(PLAN_FEATURES[tier].aiFree) && quote.pay !== "plan";
}

/**
 * Значок на кнопке ИИ без текста (иконка «Спросить Бита»): сколько бесплатных осталось сегодня. Нет счёта (безлимит) — не рисуется.
 * Родитель — `relative`; подпись для скринридера и подсказка — на самой кнопке (useAiQuotaText).
 */
export function AiFreeDot({ kind = "ask" }: { kind?: AiKind }) {
  const { quote, freeLeft } = useAiQuote(kind);
  const shown = useAiFreeDotShown(kind);
  if (!shown) return null;
  const out = quote.pay !== "free";
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-extrabold leading-none tabular-nums",
        // На нуле — видимая плашка с рамкой (bg-surface-2 сливался с фоном кнопки и страницы), цвет «ИИ» только у платных бесплатных.
        out ? "border-2 border-border bg-surface text-muted ring-2 ring-bg" : "bg-action-ai text-white ring-2 ring-bg",
      )}
    >
      {out ? 0 : freeLeft}
    </span>
  );
}

/**
 * Цена обращения к ИИ (счётчик бесплатных виден всегда — этап 15):
 * на кнопке (short или solid) — коротко: «бесплатно · 2 из 3», «∞» при безлимите, чип и число, когда платится чипами;
 * вне кнопки (soft без short) — целой фразой: «бесплатно, осталось 2 из 3 сегодня» или «бесплатные на сегодня закончились, завтра снова 3; сейчас — за 5 чипов».
 * soft — цветная плашка на светлом фоне; solid — полупрозрачная на насыщенной кнопке (например, фиолетовой «ai»).
 * Отзыв после урока бесплатен всегда — цену не показываем.
 */
export function AiCost({
  kind,
  variant = "soft",
  short,
  className,
}: {
  kind: AiKind;
  variant?: "soft" | "solid";
  short?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const q = useAiQuote(kind);
  const { quote, freeLeft, tier, chips } = q;
  if (kind === "feedback") return null;

  const solid = variant === "solid";
  // Компактно — на кнопках; целая фраза — в подписях под полем ввода и в других строках, где есть место (перенос по словам).
  const compact = short || solid;
  const base = compact
    ? "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-extrabold leading-none"
    : "inline-flex max-w-full items-start gap-1.5 rounded-xl px-2.5 py-1 text-left text-xs font-extrabold leading-snug";
  const tone = (soft: string) => (solid ? "bg-white/20 text-white" : soft);
  const max = PLAN_FEATURES[tier].aiFree;
  const sentence = quotaSentence(t, kind, q);

  if (!quote.ok && quote.reason === "cap") {
    return <span className={cn(base, tone("bg-surface-2 text-muted"), className)}>{t("aicost.cap")}</span>;
  }

  if (quote.pay === "plan") {
    const label = t("aicost.aria.unlimited");
    return (
      <span role="img" aria-label={label} title={label} className={cn(base, tone("bg-gold-soft text-warning-strong"), className)}>
        <InfinityIcon size={14} strokeWidth={3} aria-hidden />
      </span>
    );
  }

  if (quote.pay === "free") {
    // Вне кнопки — «Бесплатно ещё 2 из 3» (без двоеточия: рядом подпись «Каждое сообщение:»); полная фраза — в title.
    const life = aiFreeIsLifetime(tier);
    const text = compact && Number.isFinite(max)
      ? t("hearts15.ai.freeShort", { n: freeLeft, max })
      : Number.isFinite(max)
        ? t(life ? "pol16d.ai.free" : "pol16d.ai.freeDay", { n: freeLeft, max })
        : t("aicost.freeShort");
    // Бесплатные обращения — про ИИ: фиолетовая плашка (зелёный — только «верно»).
    return (
      <span title={sentence ?? t("aicost.aria.free", { n: freeLeft })} className={cn(base, tone("bg-ai-soft text-ink-ai"), className)}>
        {text}
      </span>
    );
  }

  // Платно чипами; если чипов не хватает — красная плашка (на насыщенной кнопке — светлая с красным текстом).
  const enough = quote.ok;
  const label = t(enough ? "ailimit.aria.price" : "ailimit.aria.need", { n: quote.cost, have: chips });
  const asText = !compact && !!sentence;
  return (
    <span
      {...(asText ? {} : { role: "img", "aria-label": label })}
      title={sentence ?? label}
      className={cn(
        base,
        // Не хватает чипов — один цвет во всех окнах («частично»: янтарный), не красный.
        enough ? tone("bg-gold-soft text-warning-strong") : "bg-warning-soft text-ink-warning",
        className,
      )}
    >
      <Cpu size={14} className={cn("shrink-0", !solid && enough && "text-gold", !compact && "mt-px")} aria-hidden />
      {asText ? (
        <span>{sentence}</span>
      ) : (
        <>
          <span className="tabular-nums" aria-hidden>
            {quote.cost}
          </span>
          {/* Баланс рядом с ценой виден всегда: на узких кнопках (short, до 380px) — коротко «· 20», пошире — «· у тебя 20». */}
          {short ? (
            <>
              <span className="font-bold tabular-nums opacity-80 min-[380px]:hidden" aria-hidden>
                · {chips}
              </span>
              <span className="hidden font-bold tabular-nums opacity-80 min-[380px]:inline" aria-hidden>
                · {t("ailimit.have", { n: chips })}
              </span>
            </>
          ) : (
            <span className="font-bold tabular-nums opacity-80" aria-hidden>
              · {t("ailimit.have", { n: chips })}
            </span>
          )}
        </>
      )}
    </span>
  );
}
