import type { Rarity } from "@/lib/rarity";

/**
 * Лёгкое конфетти при покупке украшения. Цвета — токены темы (читаются из CSS-переменных страницы), а не «сырые» hex.
 * Вызывающий сам не зовёт при «Меньше анимаций»; системную настройку учитывает `disableForReducedMotion`.
 */
export function cosmeticConfetti(rarity: Rarity): void {
  if (typeof document === "undefined") return;
  const css = getComputedStyle(document.documentElement);
  const read = (name: string) => css.getPropertyValue(name).trim();
  const colors = [read(`--rarity-${rarity}`), read("--gold"), read("--primary"), read("--success")].filter(Boolean);
  void import("canvas-confetti")
    .then(({ default: confetti }) => {
      confetti({ particleCount: 46, spread: 62, startVelocity: 32, ticks: 110, scalar: 0.9, origin: { y: 0.72 }, colors, disableForReducedMotion: true });
    })
    .catch(() => {
      // конфетти — не критично
    });
}
