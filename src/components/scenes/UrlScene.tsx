"use client";

import { Globe, Lock, LockOpen } from "lucide-react";
import { m } from "motion/react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import type { Scene, SceneTone, UrlRole } from "@/lib/types";
import { cn } from "@/lib/cn";
import { URL_FONT, URL_LABEL_FONT, layoutUrl, roleTone, urlLock, urlText } from "./url";

type UrlSceneData = Extract<Scene, { kind: "url" }>;

/** Классы по тону (целиком, чтобы Tailwind их увидел): заливка части и пилюля подписи. */
const PART_TONE: Record<SceneTone, string> = {
  primary: "bg-primary-soft text-primary-strong decoration-primary",
  success: "bg-success-soft text-success-strong decoration-success",
  danger: "bg-danger-soft text-danger-strong decoration-danger",
  warning: "bg-warning-soft text-warning-strong decoration-warning",
  ai: "bg-ai-soft text-ai-strong decoration-ai",
  gold: "bg-gold-soft text-warning-strong decoration-gold",
  muted: "bg-surface-2 text-muted decoration-muted",
};
const LABEL_TONE: Record<SceneTone, string> = {
  primary: "text-primary-strong",
  success: "text-success-strong",
  danger: "text-danger-strong",
  warning: "text-warning-strong",
  ai: "text-ai-strong",
  gold: "text-warning-strong",
  muted: "text-muted",
};

const ROLE_KEY: Record<UrlRole, DictKey> = {
  protocol: "scene.url.role.protocol",
  subdomain: "scene.url.role.subdomain",
  domain: "scene.url.role.domain",
  zone: "scene.url.role.zone",
  port: "scene.url.role.port",
  path: "scene.url.role.path",
  query: "scene.url.role.query",
  fragment: "scene.url.role.fragment",
};

const LINE_H = 24;
const LEVEL_H = 20;

/** Адресная строка браузера: части URL склеены, выделенные подсвечены, под ними — роль. Перенос — по частям. */
export function UrlScene({ scene }: { scene: UrlSceneData }) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const lines = layoutUrl(scene.parts, scene.highlight, (r) => t(ROLE_KEY[r]));
  const lock = urlLock(scene.parts);
  const hlSet = new Set(scene.highlight ?? []);
  const aria =
    t("scene.url.aria", { url: urlText(scene.parts) }) +
    scene.parts
      .filter((p) => hlSet.has(p.role))
      .map((p) => ` ${t("scene.url.ariaPart", { role: t(ROLE_KEY[p.role]), text: p.text })}.`)
      .join("");

  return (
    <div className="mx-auto w-full max-w-xl">
      <div role="img" aria-label={aria} className="flex items-start gap-2.5 rounded-2xl border border-border bg-surface-2 px-3 py-2.5">
        <span aria-hidden className="mt-[3px] shrink-0">
          {lock === "secure" ? (
            <Lock size={16} strokeWidth={2.5} className="text-success" />
          ) : lock === "open" ? (
            <LockOpen size={16} strokeWidth={2.5} className="text-warning" />
          ) : (
            <Globe size={16} strokeWidth={2.5} className="text-muted" />
          )}
        </span>
        <div className="min-w-0 flex-1 font-mono font-medium text-text" style={{ fontSize: URL_FONT }}>
          {lines.map((line, li) => (
            <div key={li} className="relative" style={{ height: LINE_H + line.levels * LEVEL_H }}>
              <div className="whitespace-pre leading-6" style={{ height: LINE_H }}>
                {line.segments.map((s, si) => (
                  <span
                    key={`${s.part}-${si}`}
                    className={cn(
                      "rounded-sm underline-offset-4 transition-colors motion-reduce:transition-none",
                      s.highlighted && cn("font-bold underline decoration-2", PART_TONE[roleTone(s.role)]),
                    )}
                  >
                    {s.text}
                  </span>
                ))}
              </div>
              {line.labels.map((lb) => (
                <m.div
                  key={`${lb.part}-${lb.role}`}
                  initial={reduce ? false : { opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="pointer-events-none absolute whitespace-nowrap"
                  style={{ left: `${lb.center}ch`, top: LINE_H + lb.level * LEVEL_H, x: "-50%" }}
                >
                  <span
                    className={cn("font-sans font-extrabold leading-none", LABEL_TONE[roleTone(lb.role)])}
                    style={{ fontSize: URL_LABEL_FONT }}
                  >
                    {t(ROLE_KEY[lb.role])}
                  </span>
                </m.div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
