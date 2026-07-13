/** Semantic badge/button classes for admin user status — avoid brand-red for positive states. */

export function subscriptionStatusClass(status: string | null | undefined): string {
  const s = status ?? "none";
  if (s === "active" || s === "trialing") {
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  if (s === "canceled" || s === "unpaid" || s === "past_due" || s === "incomplete") {
    return "border-destructive/40 bg-destructive/15 text-destructive";
  }
  if (s === "none") {
    return "border-border bg-muted/50 text-muted-foreground";
  }
  return "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200";
}

export function verifiedStatusClass(verified: boolean): string {
  return verified
    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "border-border bg-muted/50 text-muted-foreground";
}

export const adminPanelCardClass =
  "rounded-lg border border-border bg-card text-card-foreground p-4 shadow-sm";

export const adminOutlineBtnClass =
  "font-display gap-1 border-border bg-background text-foreground hover:bg-muted/80";

export const adminSheetClass =
  "w-full sm:max-w-xl bg-card text-card-foreground border-border overflow-y-auto";
