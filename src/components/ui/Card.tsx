import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn("rounded-3xl border-2 border-border bg-surface p-4 sm:p-5", className)} />;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-lg font-extrabold">{children}</h2>
      {action}
    </div>
  );
}
