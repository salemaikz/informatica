import { Braces, Database, FileCode, Globe, Table2 } from "lucide-react";
import type { IdeLangInfo } from "./registry";

const ICONS = { python: FileCode, database: Database, globe: Globe, braces: Braces, table: Table2 } as const;

/** Иконка языка практикума по имени из реестра (только lucide, без эмодзи). */
export function LangIcon({ name, size = 22, className }: { name: IdeLangInfo["icon"]; size?: number; className?: string }) {
  const Icon = ICONS[name];
  return <Icon size={size} className={className} aria-hidden />;
}

/** Цвета карточки языка по токену из реестра (классы перечислены явно — Tailwind не видит собранных строк). */
export const TONE_CLASS: Record<IdeLangInfo["tone"], { soft: string; bar: string }> = {
  primary: { soft: "bg-primary-soft text-primary", bar: "var(--primary)" },
  success: { soft: "bg-success-soft text-success-strong", bar: "var(--success)" },
  warning: { soft: "bg-warning-soft text-warning-strong", bar: "var(--warning)" },
  ai: { soft: "bg-ai-soft text-ai", bar: "var(--ai)" },
  gold: { soft: "bg-gold-soft text-gold", bar: "var(--gold)" },
};
