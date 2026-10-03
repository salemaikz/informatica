"use client";

import { cn } from "@/lib/cn";
import { m } from "motion/react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

type Variant = "primary" | "success" | "danger" | "ai" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-[0_4px_0_var(--primary-strong)] hover:brightness-105",
  success: "bg-success text-white shadow-[0_4px_0_var(--success-strong)] hover:brightness-105",
  danger: "bg-danger text-white shadow-[0_4px_0_var(--danger-strong)] hover:brightness-105",
  ai: "bg-ai text-white shadow-[0_4px_0_var(--ai-strong)] hover:brightness-105",
  secondary: "bg-surface text-text border-2 border-border shadow-[0_3px_0_var(--border)] hover:bg-surface-2",
  ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-text",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-xl",
  md: "h-11 px-4 text-[15px] rounded-2xl",
  lg: "h-13 px-6 text-base rounded-2xl",
};

export function buttonClass({ variant = "primary", size = "md", block, disabled }: { variant?: Variant; size?: Size; block?: boolean; disabled?: boolean } = {}) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 font-extrabold tracking-wide transition-[translate,box-shadow,filter] duration-75",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "active:translate-y-[3px] active:shadow-none",
    SIZES[size],
    disabled
      ? "cursor-not-allowed bg-surface-2 text-muted shadow-[0_4px_0_var(--border)] active:translate-y-0 active:shadow-[0_4px_0_var(--border)]"
      : VARIANTS[variant],
    block && "w-full",
  );
}

// Обработчики, у которых тип в motion отличается от DOM, — в кнопку не передаём.
type DomButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "style">;

export interface ButtonProps extends DomButtonProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
}

const PRESS = { scale: 0.97 };
const PRESS_SPRING = { type: "spring", stiffness: 700, damping: 22 } as const;

/**
 * Кнопка в стиле Duolingo (толстая нижняя «грань»). Поверх CSS-нажатия — пружинка:
 * при нажатии слегка сжимается, а когда кнопка становится доступной (disabled → active) — один раз «подпрыгивает».
 */
export function Button({ variant, size, block, icon, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <m.button
      {...rest}
      type={type}
      disabled={disabled}
      className={cn(buttonClass({ variant, size, block, disabled }), className)}
      initial={false}
      animate={disabled ? "off" : "on"}
      variants={{ off: { scale: 1 }, on: { scale: [1, 1.05, 1], transition: { duration: 0.28, ease: "easeOut" } } }}
      whileTap={disabled ? undefined : PRESS}
      transition={PRESS_SPRING}
    >
      {icon}
      {children}
    </m.button>
  );
}

/** Ссылка, оформленная как кнопка (без вложения <button> в <a>). */
export function ButtonLink({
  variant,
  size,
  block,
  icon,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; block?: boolean; icon?: ReactNode }) {
  return (
    <Link {...rest} className={cn(buttonClass({ variant, size, block }), className)}>
      {icon}
      {children}
    </Link>
  );
}
