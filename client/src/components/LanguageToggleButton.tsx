import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { cn } from "@/lib/utils";

type LanguageToggleButtonProps = {
  variant?: "outline" | "ghost" | "secondary";
  className?: string;
};

/** One-click EN ↔ FR toggle — globe + short code on phones, full label on desktop. */
export function LanguageToggleButton({ variant = "outline", className }: LanguageToggleButtonProps) {
  const { language, setLanguage, t } = useLanguage();
  const nextLanguage = language === "en" ? "fr" : "en";
  const shortLabel = nextLanguage === "en" ? t("languageToggleShortEn") : t("languageToggleShortFr");
  const longLabel = language === "fr" ? t("navTranslateEnglish") : t("navTranslateFrench");

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={() => setLanguage(nextLanguage)}
      className={cn(
        "font-display rounded-lg shrink-0 gap-1.5 border-border bg-background/90",
        "h-10 min-h-10 px-3 text-xs sm:h-9 sm:min-h-9 touch-manipulation",
        className
      )}
      aria-label={language === "en" ? t("navSwitchToFrench") : t("navSwitchToEnglish")}
      title={`${t("languageToggleLabel")}: ${longLabel}`}
    >
      <Languages className="size-4 shrink-0 text-brand-red/80" aria-hidden />
      <span className="sm:hidden font-bold tracking-widest">{shortLabel}</span>
      <span className="hidden sm:inline">{longLabel}</span>
    </Button>
  );
}
