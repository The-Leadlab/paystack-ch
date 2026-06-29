import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
  panel,
}: {
  children: ReactNode;
  className?: string;
  panel?: boolean;
}) {
  return (
    <div className={cn(panel ? "pp-glass-panel" : "pp-glass-card", className)}>{children}</div>
  );
}
