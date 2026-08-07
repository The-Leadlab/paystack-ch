import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  panel?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">;

export function GlassCard({ children, className, panel, ...rest }: Props) {
  return (
    <div
      className={cn(panel ? "pp-glass-panel" : "pp-glass-card", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
