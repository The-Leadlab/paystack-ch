import { Button } from "@/components/ui/button";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { cn } from "@/lib/utils";

type LanguageToggleButtonProps = {
  variant?: "outline" | "ghost" | "secondary";
  className?: string;
};

/** One-click EN ↔ FR toggle (matches landing navbar behavior). */
export function LanguageToggleButton({ variant = "outline", className }: LanguageToggleButtonProps) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={() => setLanguage(language === "en" ? "fr" : "en")}
      className={cn("font-display text-xs rounded-lg px-3 h-8 shrink-0", className)}
      aria-label={language === "en" ? t("navSwitchToFrench") : t("navSwitchToEnglish")}
      title={language === "en" ? t("navSwitchToFrench") : t("navSwitchToEnglish")}
    >
      {language === "fr" ? t("navTranslateEnglish") : t("navTranslateFrench")}
    </Button>
  );
}
