"use client";

import type { DictKey } from "@/i18n/dict";

export interface VoiceButtonProps {
  /** Расшифрованный текст вопроса (вставляется в поле ввода). */
  onText: (text: string) => void;
  /** Ошибка: ключ словаря (нет чипов — "economy.noChips", нет доступа к микрофону и т.п.). */
  onError?: (key: DictKey) => void;
  disabled?: boolean;
}

// ЗАГЛУШКА: голосовой вопрос (запись → /api/ai/transcribe) делает исполнитель C2. Пропсы не менять.
export function VoiceButton(props: VoiceButtonProps) {
  void props;
  return null;
}
