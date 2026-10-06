"use client";

import { useApp } from "@/lib/store";
import { COSMETICS, type Cosmetic } from "@/lib/cosmetics";
import { cn } from "@/lib/cn";

export function CosmeticAvatar({ name, cosmetic, size = 52, className }: { name: string; cosmetic?: Cosmetic; size?: number; className?: string }) {
  const color = cosmetic ? `var(--${cosmetic.color})` : "var(--primary)";
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <span className="flex items-center justify-center rounded-full bg-surface-2 font-extrabold" style={{ width: size * .73, height: size * .73, fontSize: size * .34, color }}>{(name.trim()[0] ?? "?").toUpperCase()}</span>
      <svg className="absolute inset-0" viewBox="0 0 64 64" width={size} height={size} aria-hidden style={{ color }}>
        {!cosmetic && <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="3" fill="none" />}
        {cosmetic?.style === "orbit" && <><circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="3" fill="none" /><ellipse cx="32" cy="32" rx="31" ry="13" transform="rotate(-30 32 32)" stroke="currentColor" strokeWidth="2" fill="none" /><circle cx="56" cy="17" r="5" fill="currentColor" /></>}
        {cosmetic?.style === "circuit" && <><rect x="6" y="6" width="52" height="52" rx="16" stroke="currentColor" strokeWidth="3" fill="none" /><path d="M6 23h9V13m43 28H48v10M23 6v8m18 44v-8M6 41h8m44-18h-8" stroke="currentColor" strokeWidth="3" fill="none" /><circle cx="15" cy="13" r="3" fill="currentColor" /><circle cx="48" cy="51" r="3" fill="currentColor" /></>}
        {cosmetic?.style === "prism" && <><path d="m32 2 26 15v30L32 62 6 47V17Z" stroke="currentColor" strokeWidth="3" fill="none" /><path d="m32 2 9 13M58 47 45 41M6 17l12 6M6 47l12-6M58 17l-12 7M32 62l-7-12" stroke="currentColor" strokeWidth="2" /></>}
        {cosmetic?.style === "crown" && <><circle cx="32" cy="35" r="25" stroke="currentColor" strokeWidth="3" fill="none" /><path d="m16 15-3-13 11 7 8-8 8 8 11-7-3 13Z" fill="currentColor" /><path d="M20 58h24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></>}
      </svg>
    </span>
  );
}

export function ProfileAvatar({ size = 36, className }: { size?: number; className?: string }) {
  const name = useApp((s) => s.profile.name);
  const equipped = useApp((s) => s.equippedCosmeticId);
  return <CosmeticAvatar name={name} cosmetic={COSMETICS.find((item) => item.id === equipped)} size={size} className={className} />;
}
