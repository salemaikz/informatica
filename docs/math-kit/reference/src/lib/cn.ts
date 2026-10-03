import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Склейка классов с разрешением конфликтов Tailwind (последний побеждает: text-left + text-center → text-center). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
