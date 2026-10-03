"use client";

export interface SpeakButtonProps {
  /** Текст ответа (markdown — разметку убрать перед озвучкой). */
  text: string;
  className?: string;
}

// ЗАГЛУШКА: «Озвучить ответ» (speechSynthesis браузера) делает исполнитель C2. Пропсы не менять.
export function SpeakButton(props: SpeakButtonProps) {
  void props;
  return null;
}
