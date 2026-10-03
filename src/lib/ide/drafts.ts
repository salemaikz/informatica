// Черновики практикума: код задачи или песочницы в localStorage (ключ informatica:code:v1:<id>).
// localStorage может быть недоступен (приватный режим) — тогда черновик живёт до перезагрузки.

const PREFIX = "informatica:code:v1:";
const memory = new Map<string, string>();

export const sandboxDraftId = (lang: string) => `sandbox-${lang}`;

export function loadDraft(id: string): string | null {
  try {
    const v = localStorage.getItem(PREFIX + id);
    if (v !== null) return v;
  } catch {
    // нет доступа
  }
  return memory.get(id) ?? null;
}

export function saveDraft(id: string, code: string): void {
  memory.set(id, code);
  try {
    localStorage.setItem(PREFIX + id, code.slice(0, 50_000));
  } catch {
    // переполнение или нет доступа — останется в памяти
  }
}

export function clearDraft(id: string): void {
  memory.delete(id);
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {
    // нет доступа
  }
}
