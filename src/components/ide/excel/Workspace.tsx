"use client";

import type { WorkspaceProps } from "@/lib/ide/types";

// ЗАГЛУШКА: рабочую область языка «excel» делает исполнитель по docs/specs/ide.md. Пропсы не менять.
export function Workspace({ code }: WorkspaceProps) {
  return <pre className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted">{code || "excel"}</pre>;
}
